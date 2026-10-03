import { describe, expect, it, vi } from "vitest";
import { ConcurrencyLimiter, LimiterOverloadError } from "../src/api/limiter.js";
import { getCollectionStatus } from "../src/api/status.js";
import { createAnalyticsRouter } from "../src/api/analytics.js";
import { createApp } from "../src/app.js";
import { persistFuelObservations } from "../src/persist.js";
import { CollectionRunScope, type PrismaClient } from "@prisma/client";

describe("Admission Control and Concurrency Limiter", () => {
  // 1. concurrent analytics work never exceeds maxConcurrency
  it("bounds multiple concurrent analytics requests to maxConcurrency", async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1, maxQueueLength: 10 });
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

  // 2. permits are released after success & 10. limiter metrics return to zero after requests settle
  it("releases permits after success and settles metrics to zero", async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1 });
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);

    const result = await limiter.run(async () => {
      expect(limiter.activeCount).toBe(1);
      return 42;
    });

    expect(result).toBe(42);
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  // 3. permits are released after errors
  it("releases permits on errors so subsequent requests proceed", async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1 });

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
    expect(limiter.waitingCount).toBe(0);
  });

  // 4. queue length is bounded & 6. queue overflow receives controlled overload failure
  it("bounds queue length and rejects overflow with QUEUE_FULL LimiterOverloadError", async () => {
    const limiter = new ConcurrencyLimiter({
      maxConcurrency: 1,
      maxQueueLength: 2,
      maxQueueWaitMs: 5_000,
    });

    let releaseFirstTask!: () => void;
    const firstTaskBlocker = new Promise<void>((r) => {
      releaseFirstTask = r;
    });

    // 1 active task
    const t1 = limiter.run(async () => {
      await firstTaskBlocker;
      return "t1";
    });

    // 2 queued tasks (filling maxQueueLength: 2)
    const t2 = limiter.run(async () => "t2");
    const t3 = limiter.run(async () => "t3");

    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(2);

    // 4th task must immediately reject with QUEUE_FULL
    await expect(limiter.run(async () => "t4")).rejects.toSatisfy(
      (err: any) => err instanceof LimiterOverloadError && err.code === "QUEUE_FULL",
    );

    // Metrics remain bounded
    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(2);

    // Unblock and allow queued to complete
    releaseFirstTask();
    const [r1, r2, r3] = await Promise.all([t1, t2, t3]);
    expect([r1, r2, r3]).toEqual(["t1", "t2", "t3"]);

    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  // 5. queued work exceeding max wait receives controlled overload failure
  it("rejects queued tasks exceeding maxQueueWaitMs with QUEUE_TIMEOUT", async () => {
    const limiter = new ConcurrencyLimiter({
      maxConcurrency: 1,
      maxQueueLength: 5,
      maxQueueWaitMs: 30, // 30ms queue wait limit
    });

    let releaseActiveTask!: () => void;
    const activeBlocker = new Promise<void>((r) => {
      releaseActiveTask = r;
    });

    // Start long-running active task
    const activeTask = limiter.run(async () => {
      await activeBlocker;
      return "active_done";
    });

    // Queue a task that will wait longer than 30ms
    const queuedTask = limiter.run(async () => "queued_done");

    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(1);

    // Queued task must reject with QUEUE_TIMEOUT after 30ms
    await expect(queuedTask).rejects.toSatisfy(
      (err: any) => err instanceof LimiterOverloadError && err.code === "QUEUE_TIMEOUT",
    );

    // Item was removed from queue on timeout
    expect(limiter.waitingCount).toBe(0);

    // Release active task
    releaseActiveTask();
    await activeTask;
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  // 7. /api/v1/status completes while analytics work is queued
  it("status can complete while analytics work is queued", async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1, maxQueueLength: 5 });

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
    expect(mockPrisma.collectionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: CollectionRunScope.FLEET },
        orderBy: { finishedAt: "desc" },
        take: 20,
      }),
    );
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();

    // Analytics is still active/queued while status has completed
    expect(limiter.activeCount).toBe(1);
    expect(limiter.waitingCount).toBe(1);

    // Cleanup
    resolveAnalytics();
    await Promise.all([longRunningAnalytics, queuedAnalytics]);
    expect(limiter.activeCount).toBe(0);
    expect(limiter.waitingCount).toBe(0);
  });

  // 8. collector persistence itself is not wrapped in the analytics limiter
  it("collector persistence is not blocked by analytics admission control", async () => {
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1, maxQueueLength: 5 });

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
        scope: "FLEET",
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
    expect(limiter.waitingCount).toBe(0);
  });

  // 9. P2024 becomes structured HTTP 503 & overload becomes structured HTTP 503
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

  it("analytics router returns 503 with analytics_overloaded on limiter queue rejection", async () => {
    const mockPrisma = {} as unknown as PrismaClient;
    const overloadedLimiter = new ConcurrencyLimiter({
      maxConcurrency: 1,
      maxQueueLength: 0, // Queue full immediately on second request
    });

    const router = createAnalyticsRouter(mockPrisma, overloadedLimiter);

    // Block the 1 active permit
    void router.request("/summary");

    // Next request hits queue full (maxQueueLength: 0)
    const secondRes = await router.request("/summary");
    expect(secondRes.status).toBe(503);
    const body = await secondRes.json();
    expect(body).toEqual({
      error: "analytics_overloaded",
      reason: "QUEUE_FULL",
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

  it("app.onError catches P2024 on stations list and returns the same 503 shape", async () => {
    const p2024Error = Object.assign(
      new Error("Timed out fetching a new connection from the connection pool"),
      { code: "P2024" },
    );
    const mockPrisma = {
      club: {
        findMany: vi.fn().mockRejectedValue(p2024Error),
      },
    } as unknown as PrismaClient;

    const app = createApp({
      prisma: mockPrisma,
      collectorSecret: "secret",
    });

    const res = await app.request("/api/v1/stations");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: "database_pool_timeout",
      code: "P2024",
      message: "Database connection pool exhausted. Please retry.",
    });
  });

  it("analytics router returns route-specific 500 on generic errors", async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockRejectedValue(new Error("query exploded")),
      fuelPriceCurrent: {
        findFirst: vi.fn().mockRejectedValue(new Error("query exploded")),
      },
    } as unknown as PrismaClient;

    const router = createAnalyticsRouter(mockPrisma);
    const res = await router.request("/summary");
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "analytics_summary_failed" });
  });

  it("analytics summary still runs through the limiter, sets cache, and returns the query result", async () => {
    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      fuelPriceCurrent: {
        findFirst: vi.fn().mockResolvedValue({ fuelName: "Unleaded" }),
      },
    } as unknown as PrismaClient;
    const limiter = new ConcurrencyLimiter({ maxConcurrency: 1 });
    const runSpy = vi.spyOn(limiter, "run");

    const router = createAnalyticsRouter(mockPrisma, limiter);
    const res = await router.request("/summary");

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=60, s-maxage=120, stale-while-revalidate=60",
    );
    const body = (await res.json()) as {
      stationCount: number;
      fuel: { sku: string; name: string };
      medianPrice: string | null;
    };
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(body.stationCount).toBe(0);
    expect(body.fuel).toEqual({ sku: "1", name: "Unleaded" });
    expect(body.medianPrice).toBeNull();
  });

  it("retries one P1017 closed connection for the read-only status endpoint", async () => {
    const finishedAt = new Date();
    const p1017Error = Object.assign(new Error("Server has closed the connection."), {
      code: "P1017",
    });
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn().mockRejectedValueOnce(p1017Error).mockResolvedValueOnce([
          {
            startedAt: new Date(finishedAt.getTime() - 8_000),
            finishedAt,
            durationMs: 8_000,
            clubsConfigured: 214,
            clubsSucceeded: 208,
            clubsEmptyFuels: 6,
            clubsHardFailed: 0,
            fuelObservations: 511,
            historyChanges: 0,
            databaseQueries: 1,
            degraded: false,
            failures: [],
          },
        ]),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        {
          latest: finishedAt,
          oldest: finishedAt,
          rows: 511n,
          stations_recent: 208n,
        },
      ]),
    } as unknown as PrismaClient;

    const app = createApp({ prisma: mockPrisma, collectorSecret: "secret" });
    const res = await app.request("/api/v1/status");

    expect(res.status).toBe(200);
    expect(mockPrisma.collectionRun.findMany).toHaveBeenCalledTimes(2);
    expect(mockPrisma.collectionRun.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { scope: CollectionRunScope.FLEET },
      }),
    );
  });
});
