import { describe, expect, it, vi } from "vitest";
import { ConcurrencyLimiter } from "../src/api/limiter.js";
import { getCollectionStatus } from "../src/api/status.js";
import { createAnalyticsRouter } from "../src/api/analytics.js";
import { createApp } from "../src/app.js";
import { persistFuelObservations } from "../src/persist.js";
import type { PrismaClient } from "@prisma/client";

describe("Admission Control and Concurrency Limiter", () => {
  it("bounds multiple concurrent analytics requests to maxConcurrency", async () => {
    const limiter = new ConcurrencyLimiter(1);
    let active = 0;
    let maxObservedActive = 0;
    const completed: number[] = [];

    const makeTask = (id: number, delayMs: number) =>
      limiter.run(async () => {
        active++;
        maxObservedActive = Math.max(maxObservedActive, active);
        await new Promise((r) => setTimeout(r, delayMs));
        completed.push(id);
        active--;
        return id;
      });

    // Launch 4 concurrent analytics requests
    const promises = [
      makeTask(1, 40),
      makeTask(2, 30),
      makeTask(3, 20),
      makeTask(4, 10),
    ];

    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(3);

    const results = await Promise.all(promises);

    expect(results).toEqual([1, 2, 3, 4]);
    expect(completed).toEqual([1, 2, 3, 4]); // Executed in FIFO order
    expect(maxObservedActive).toBe(1);
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  it("releases permits on errors so subsequent requests proceed", async () => {
    const limiter = new ConcurrencyLimiter(1);

    // Failing task
    await expect(
      limiter.run(async () => {
        throw new Error("analytics_db_failure");
      }),
    ).rejects.toThrow("analytics_db_failure");

    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);

    // Subsequent task must execute immediately
    let executed = false;
    const result = await limiter.run(async () => {
      executed = true;
      return "success";
    });

    expect(executed).toBe(true);
    expect(result).toBe("success");
    expect(limiter.activeCount).toBe(0);
  });

  it("status can complete while analytics work is queued", async () => {
    const limiter = new ConcurrencyLimiter(1);

    let analyticsStarted = false;
    let resolveAnalytics!: () => void;
    const analyticsPromise = new Promise<void>((r) => {
      resolveAnalytics = r;
    });

    // Start a blocking analytics task
    const longRunningAnalytics = limiter.run(async () => {
      analyticsStarted = true;
      await analyticsPromise;
      return "analytics_done";
    });

    // Queue a second analytics task
    const queuedAnalytics = limiter.run(async () => {
      return "second_analytics_done";
    });

    // Wait until the first analytics task has acquired the limiter
    while (!analyticsStarted) {
      await new Promise((r) => setTimeout(r, 5));
    }

    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(1);

    // Mock Prisma for getCollectionStatus
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn().mockResolvedValue([
          {
            startedAt: new Date(),
            finishedAt: new Date(),
            durationMs: 100,
            clubsConfigured: 214,
            clubsSucceeded: 208,
            clubsEmptyFuels: 6,
            clubsHardFailed: 0,
            fuelObservations: 511,
            historyChanges: 10,
            databaseQueries: 1,
            degraded: false,
            failures: [],
          },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          latest: new Date(),
          oldest: new Date(),
          rows: 511n,
          stations_recent: 208n,
        },
      ]),
    } as unknown as PrismaClient;

    // Status query does not acquire analytics limiter, runs and completes immediately
    const statusPayload = await getCollectionStatus(mockPrisma);

    expect(statusPayload.ok).toBe(true);
    expect(mockPrisma.collectionRun.findMany).toHaveBeenCalled();
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();

    // Analytics is still active/queued while status has completed
    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(1);

    // Cleanup
    resolveAnalytics();
    await Promise.all([longRunningAnalytics, queuedAnalytics]);
    expect(limiter.activeCount).toBe(0);
  });

  it("collector persistence is not blocked by analytics admission control", async () => {
    const limiter = new ConcurrencyLimiter(1);

    let resolveAnalytics!: () => void;
    const analyticsGate = new Promise<void>((r) => {
      resolveAnalytics = r;
    });

    // Saturate the analytics limiter
    const analyticsTask1 = limiter.run(async () => {
      await analyticsGate;
    });
    const analyticsTask2 = limiter.run(async () => {
      return "queued";
    });

    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(1);

    // Mock Prisma transaction for collector persistence
    const mockTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([
        {
          run_rows_inserted: 1n,
          current_rows_upserted: 1n,
          history_rows_inserted: 0n,
          finished_at: new Date(),
        },
      ]),
      collectionRun: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const mockPrisma = {
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        return cb(mockTx);
      }),
    } as unknown as PrismaClient;

    // Collector persistence proceeds immediately without waiting for analytics limiter
    const persistResult = await persistFuelObservations(
      mockPrisma,
      [
        {
          clubNumber: 101,
          fuelSku: "1",
          fuelName: "Regular",
          price: "3.199",
          sourcePriceAtLocal: "2026-10-02 12:00:00",
          observedAt: new Date().toISOString(),
        },
      ],
      {
        startedAt: new Date().toISOString(),
        clubsConfigured: 1,
        clubsSucceeded: 1,
        clubsEmptyFuels: 0,
        clubsHardFailed: 0,
        fuelObservations: 1,
        degraded: false,
        failures: [],
      },
    );

    expect(persistResult.currentRowsUpserted).toBe(1);
    expect(mockPrisma.$transaction).toHaveBeenCalled();

    // Clean up analytics queue
    resolveAnalytics();
    await Promise.all([analyticsTask1, analyticsTask2]);
    expect(limiter.activeCount).toBe(0);
  });

  it("analytics router returns 503 with structured P2024 JSON on pool timeout", async () => {
    const p2024Error = Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { code: "P2024" },
    );
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(p2024Error),
      fuelPriceCurrent: {
        findFirst: vi.fn().mockRejectedValue(p2024Error),
      },
    } as unknown as PrismaClient;

    const router = createAnalyticsRouter(mockPrisma);
    const res = await router.request("/summary");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      error: "database_pool_timeout",
      code: "P2024",
      message: "Database connection pool exhausted. Please retry.",
    });
  });

  it("app.onError catches P2024 on operational routes and returns 503 with structured JSON", async () => {
    const p2024Error = Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { code: "P2024" },
    );
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn().mockRejectedValue(p2024Error),
      },
    } as unknown as PrismaClient;

    const app = createApp({
      prisma: mockPrisma,
      collectorSecret: "secret",
    });

    const res = await app.request("/api/v1/status");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({
      error: "database_pool_timeout",
      code: "P2024",
      message: "Database connection pool exhausted. Please retry.",
    });
  });
});
