import { afterEach, describe, expect, it, vi } from "vitest";
import { authorizeCollector } from "../src/auth.js";
import { createApp } from "../src/app.js";
import { evaluateHealthy } from "../src/api/status.js";
import { fetchClubFuel, mapPool, sleep } from "../src/fuel/client.js";
import {
  dedupeObservations,
  normalizePrice,
  normalizeSourcePriceAtLocal,
  observationsFromFuelResponse,
} from "../src/fuel/types.js";
import { runCollection } from "../src/collector.js";
import {
  persistFuelObservations,
  DEFAULT_DB_STATEMENT_TIMEOUT_MS,
  DEFAULT_DB_TRANSACTION_TIMEOUT_MS,
  DEFAULT_DB_MAX_WAIT_MS,
  DEFAULT_PERSIST_WATCHDOG_TIMEOUT_MS,
} from "../src/persist.js";
import type { PrismaClient } from "@prisma/client";

describe("price normalization", () => {
  it("keeps three decimal places exactly", () => {
    expect(normalizePrice(3.919)).toBe("3.919");
    expect(normalizePrice(4.469)).toBe("4.469");
    expect(normalizePrice(4)).toBe("4.000");
  });

  it("rejects non-finite prices", () => {
    expect(() => normalizePrice(Number.NaN)).toThrow(/Invalid price/);
  });

  it("normalizes local datetime without inventing timezone", () => {
    expect(normalizeSourcePriceAtLocal("2026-09-01T15:01:33")).toBe("2026-09-01T15:01:33");
    expect(normalizeSourcePriceAtLocal("2026-09-01T15:01:33.123")).toBe("2026-09-01T15:01:33");
    expect(normalizeSourcePriceAtLocal(null)).toBeNull();
  });
});

describe("fuel response parsing", () => {
  const observedAt = "2026-09-02T12:00:00.000Z";

  it("parses valid Unleaded/Premium response", () => {
    const obs = observationsFromFuelResponse(
      189,
      {
        response: {
          fuelPriceResponse: {
            data: [
              { name: "Unleaded", sku: "1", price: 3.919, priceDateTime: "2026-09-01T15:01:33" },
              { name: "Premium", sku: "3", price: 4.469, priceDateTime: "2026-08-08T09:23:36" },
            ],
          },
          statusCode: 0,
          statusMsg: "success",
        },
      },
      observedAt,
    );
    expect(obs).toHaveLength(2);
    expect(obs[0]?.price).toBe("3.919");
    expect(obs[0]?.fuelSku).toBe("1");
  });

  it("rejects malformed envelopes", () => {
    expect(() => observationsFromFuelResponse(1, {}, observedAt)).toThrow(/Malformed/);
  });

  it("rejects empty fuel arrays", () => {
    expect(() =>
      observationsFromFuelResponse(
        1,
        { response: { fuelPriceResponse: { data: [] }, statusCode: 0 } },
        observedAt,
      ),
    ).toThrow(/Empty fuel array/);
  });

  it("dedupes observations deterministically", () => {
    const out = dedupeObservations([
      {
        clubNumber: 1,
        fuelSku: "1",
        fuelName: "Unleaded",
        price: "3.000",
        sourcePriceAtLocal: null,
        observedAt,
      },
      {
        clubNumber: 1,
        fuelSku: "1",
        fuelName: "Unleaded",
        price: "3.111",
        sourcePriceAtLocal: null,
        observedAt,
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.price).toBe("3.111");
  });
});

describe("HTTP fetch behavior", () => {
  it("retries transient 503 then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls < 2) {
        return new Response("unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: {
              data: [{ name: "Unleaded", sku: "1", price: 3.919 }],
            },
            statusCode: 0,
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const result = await fetchClubFuel(189, "2026-09-02T12:00:00.000Z", {
      fetchImpl,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("does not retry permanent 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const result = await fetchClubFuel(189, "2026-09-02T12:00:00.000Z", {
      fetchImpl,
      maxAttempts: 3,
    });
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After on 429", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("slow", { status: 429, headers: { "retry-after": "0" } });
      }
      return new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: { data: [{ name: "Unleaded", sku: "1", price: 3.9 }] },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const result = await fetchClubFuel(1, "2026-09-02T12:00:00.000Z", { fetchImpl });
    expect(result.ok).toBe(true);
  });

  it("bounds Retry-After when delay exceeds remaining collection deadline", async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response("rate limited", {
        status: 429,
        headers: { "retry-after": "3600" }, // 1 hour requested
      });
    }) as unknown as typeof fetch;

    const startedAt = Date.now();
    const deadlineAtMs = startedAt + 40; // only 40ms left

    await expect(
      fetchClubFuel(1, "2026-09-02T12:00:00.000Z", {
        fetchImpl,
        deadlineAtMs,
      }),
    ).rejects.toMatchObject({ code: "COLLECTION_ABORTED" });

    // Must have aborted bounded by remaining deadline, not waited 3600s
    expect(Date.now() - startedAt).toBeLessThan(500);
  });

  it("sleep expires and rejects with COLLECTION_ABORTED when deadline reached", async () => {
    const start = Date.now();
    await expect(sleep(5000, undefined, start + 30)).rejects.toMatchObject({
      code: "COLLECTION_ABORTED",
    });
    expect(Date.now() - start).toBeLessThan(300);

    // Immediate rejection if deadline already passed
    await expect(sleep(5000, undefined, Date.now() - 10)).rejects.toMatchObject({
      code: "COLLECTION_ABORTED",
    });
  });

  it("sleep preserves AbortSignal cancellation", async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("parent canceled")), 15);
    await expect(sleep(5000, controller.signal, Date.now() + 10_000)).rejects.toThrow(
      "parent canceled",
    );
  });

  it("normal short retry sleep remains unchanged", async () => {
    const start = Date.now();
    await sleep(20, undefined, start + 5000);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("mapPool never exceeds concurrency", async () => {
    let inflight = 0;
    let max = 0;
    await mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      inflight += 1;
      max = Math.max(max, inflight);
      await new Promise((r) => setTimeout(r, 20));
      inflight -= 1;
      return n;
    });
    expect(max).toBeLessThanOrEqual(2);
  });

  it("times out aborted requests without retrying forever", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal;
      await new Promise<void>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
      return new Response("unreachable");
    }) as unknown as typeof fetch;

    const result = await fetchClubFuel(189, "2026-09-02T12:00:00.000Z", {
      fetchImpl,
      timeoutMs: 30,
      maxAttempts: 2,
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.attempts).toBe(2);
    expect(result.error.toLowerCase()).toMatch(/abort|timeout|network/);
  });
});

describe("partial collection", () => {
  it("continues when one station fails", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/1")) {
        return new Response("fail", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: { data: [{ name: "Unleaded", sku: "1", price: 3.919 }] },
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    // Tiny fixture: monkey-patch by writing temp is hard; instead use runCollection with
    // dataDir pointing at a temp file — skip if too heavy. Unit-level via mapPool semantics:
    const clubs = [1, 39];
    const results = await mapPool(clubs, 2, async (clubNumber) =>
      fetchClubFuel(clubNumber, "2026-09-02T12:00:00.000Z", {
        fetchImpl,
        maxAttempts: 1,
      }),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(1);
  });
});

describe("auth + health API", () => {
  const prisma = {
    club: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
      count: vi.fn(async () => 0),
    },
    fuelPriceHistory: { findMany: vi.fn(async () => []) },
  } as unknown as PrismaClient;

  it("authorizes bearer secrets with constant-time compare", () => {
    expect(authorizeCollector("Bearer secret-value-123456", "secret-value-123456")).toBe(true);
    expect(authorizeCollector("Bearer wrong", "secret-value-123456")).toBe(false);
    expect(authorizeCollector(null, "secret-value-123456")).toBe(false);
  });

  it("health is public and reports configured gas clubs", async () => {
    const app = createApp({ prisma, collectorSecret: "test-secret-value-0001" });
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configuredGasClubs: number; ok: boolean };
    expect(body.ok).toBe(true);
    expect(body.configuredGasClubs).toBeGreaterThan(200);
  });

  it("collector rejects missing and bad secrets", async () => {
    const app = createApp({ prisma, collectorSecret: "test-secret-value-0001" });
    expect((await app.request("/internal/collect", { method: "POST" })).status).toBe(401);
    expect(
      (
        await app.request("/internal/collect", {
          method: "POST",
          headers: { authorization: "Bearer nope" },
        })
      ).status,
    ).toBe(401);
  });

  it("stations endpoint 404s for unknown club", async () => {
    const app = createApp({ prisma, collectorSecret: "test-secret-value-0001" });
    const res = await app.request("/api/v1/stations/99999");
    expect(res.status).toBe(404);
  });

  it("status endpoint is public and returns health payload", async () => {
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - 8000);
    const run = {
      startedAt,
      finishedAt,
      durationMs: 8000,
      clubsConfigured: 214,
      clubsSucceeded: 206,
      clubsEmptyFuels: 8,
      clubsHardFailed: 0,
      fuelObservations: 505,
      historyChanges: 0,
      databaseQueries: 1,
      degraded: false,
      failures: [],
    };
    const statusPrisma = {
      collectionRun: {
        findMany: vi.fn(async () => [run]),
      },
      $queryRaw: vi.fn(async () => [
        {
          latest: finishedAt,
          oldest: finishedAt,
          rows: 505n,
          stations_recent: 206n,
        },
      ]),
    } as unknown as PrismaClient;

    const app = createApp({ prisma: statusPrisma, collectorSecret: "test-secret-value-0001" });
    const res = await app.request("/api/v1/status");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      healthy: boolean;
      lastCollection: { clubsHardFailed: number; clubsEmptyFuels: number; usable?: boolean } | null;
      lastSuccessfulCollection: { usable?: boolean } | null;
      freshness: { stationsObservedRecently: number };
      collectionLock: { inProgress: boolean };
    };
    expect(body.ok).toBe(true);
    expect(body.healthy).toBe(true);
    expect(body.lastCollection?.clubsHardFailed).toBe(0);
    expect(body.lastCollection?.clubsEmptyFuels).toBe(8);
    expect(body.lastSuccessfulCollection?.usable).toBe(true);
    expect(body.freshness.stationsObservedRecently).toBe(206);
    expect(body.collectionLock.inProgress).toBe(false);
  });
});

describe("status healthy evaluation", () => {
  const baseRun = {
    startedAt: "2026-09-02T14:00:00.000Z",
    finishedAt: "2026-09-02T14:00:08.000Z",
    durationMs: 8000,
    clubsConfigured: 214,
    clubsSucceeded: 206,
    clubsEmptyFuels: 8,
    clubsHardFailed: 0,
    clubsFailed: 8,
    fuelObservations: 505,
    historyChanges: 0,
    databaseQueries: 1,
    degraded: false,
    failures: [],
    usable: true,
  };

  const freshness = {
    latestObservedAt: "2026-09-02T14:00:00.000Z",
    oldestObservedAt: "2026-09-02T14:00:00.000Z",
    currentPriceRows: 505,
    stationsObservedRecently: 206,
    freshStationRatio: 206 / 214,
    freshWindowMinutes: 90,
  };

  it("marks healthy for a fresh successful run", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: baseRun,
      lastSuccessfulCollection: baseRun,
      freshness,
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(true);
    expect(result.unhealthyReasons).toEqual([]);
  });

  it("does not mark unhealthy merely because a normal collection is in progress", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: baseRun,
      lastSuccessfulCollection: baseRun,
      freshness,
      collectionLock: {
        inProgress: true,
        startedAt: "2026-09-02T14:29:40.000Z",
        ageMs: 20_000,
        ageSeconds: 20,
        overExpectedDuration: false,
        stale: false,
      },
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(true);
    expect(result.unhealthyReasons).toEqual([]);
  });

  it("marks unhealthy when last collection is stale", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: baseRun,
      lastSuccessfulCollection: baseRun,
      freshness,
      now: new Date("2026-09-02T16:00:00.000Z"),
    });
    expect(result.healthy).toBe(false);
    expect(result.unhealthyReasons).toContain("last_collection_stale");
  });

  it("marks unhealthy on zero fuel observations", () => {
    const failed = {
      ...baseRun,
      clubsSucceeded: 0,
      clubsEmptyFuels: 214,
      clubsHardFailed: 0,
      clubsFailed: 214,
      fuelObservations: 0,
      degraded: true,
      usable: false,
    };
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: failed,
      lastSuccessfulCollection: null,
      freshness: {
        ...freshness,
        stationsObservedRecently: 0,
        freshStationRatio: 0,
        latestObservedAt: null,
      },
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(false);
    expect(result.unhealthyReasons).toContain("zero_fuel_observations");
    expect(result.unhealthyReasons).toContain("no_clubs_succeeded");
  });

  it("marks unhealthy on excessive hard failures", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: {
        ...baseRun,
        clubsSucceeded: 100,
        clubsEmptyFuels: 0,
        clubsHardFailed: 114,
        clubsFailed: 114,
        fuelObservations: 200,
        degraded: true,
      },
      lastSuccessfulCollection: {
        ...baseRun,
        clubsSucceeded: 100,
        clubsEmptyFuels: 0,
        clubsHardFailed: 114,
        clubsFailed: 114,
        fuelObservations: 200,
        degraded: true,
      },
      freshness: {
        ...freshness,
        stationsObservedRecently: 100,
        freshStationRatio: 100 / 214,
      },
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(false);
    expect(result.unhealthyReasons).toContain("hard_failure_ratio_high");
  });

  it("marks unhealthy when collection exceeds expected duration", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 214,
      lastAttemptedCollection: baseRun,
      lastSuccessfulCollection: baseRun,
      freshness,
      collectionLock: {
        inProgress: true,
        startedAt: "2026-09-02T14:20:00.000Z",
        ageMs: 10 * 60_000,
        ageSeconds: 600,
        overExpectedDuration: true,
        stale: false,
      },
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(false);
    expect(result.unhealthyReasons).toContain("collection_over_expected_duration");
    expect(result.unhealthyReasons).not.toContain("collection_in_progress");
  });
});

describe("collection lock semantics", () => {
  afterEach(async () => {
    const { __setCollectionLockForTests } = await import("../src/collector.js");
    __setCollectionLockForTests(null);
  });

  it("reports over-expected and stale without auto-clearing the lock", async () => {
    const {
      COLLECTION_EXPECTED_MAX_MS,
      COLLECTION_LOCK_STALE_MS,
      getCollectionLockState,
      isCollectionInProgress,
      __setCollectionLockForTests,
    } = await import("../src/collector.js");

    __setCollectionLockForTests(Date.now() - COLLECTION_EXPECTED_MAX_MS - 1_000);
    const longRunning = getCollectionLockState();
    expect(longRunning.inProgress).toBe(true);
    expect(longRunning.overExpectedDuration).toBe(true);
    expect(longRunning.stale).toBe(false);
    expect(isCollectionInProgress()).toBe(true);

    __setCollectionLockForTests(Date.now() - COLLECTION_LOCK_STALE_MS - 1_000);
    const stale = getCollectionLockState();
    expect(stale.inProgress).toBe(true);
    expect(stale.stale).toBe(true);
    expect(isCollectionInProgress()).toBe(true);

    __setCollectionLockForTests(Date.now() - 1_000);
    const active = getCollectionLockState();
    expect(active.inProgress).toBe(true);
    expect(active.overExpectedDuration).toBe(false);
    expect(active.stale).toBe(false);

    __setCollectionLockForTests(null);
    expect(isCollectionInProgress()).toBe(false);
  });

  it("rejects concurrent collections and releases lock after completion", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");
    const fetchImpl = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 80));
      return new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: {
              data: [
                {
                  sku: "1",
                  name: "Unleaded",
                  price: 3.919,
                  priceDateTime: "2026-09-02T12:00:00",
                },
              ],
            },
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const first = runCollection({
      dryRun: true,
      dataDir: "tests/fixtures/tiny-data",
      concurrency: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(isCollectionInProgress()).toBe(true);

    await expect(
      runCollection({
        dryRun: true,
        dataDir: "tests/fixtures/tiny-data",
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "COLLECTION_IN_PROGRESS" });

    await first;
    expect(isCollectionInProgress()).toBe(false);
  });
});

describe("collection abort propagation", () => {
  afterEach(async () => {
    const { __setCollectionLockForTests } = await import("../src/collector.js");
    __setCollectionLockForTests(null);
  });

  it("aborts in-flight fetchClubFuel when parent signal aborts", async () => {
    const { fetchClubFuel } = await import("../src/fuel/client.js");
    const parent = new AbortController();
    let sawAbort = false;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing signal"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            sawAbort = true;
            reject(new DOMException("The operation was aborted.", "AbortError"));
          },
          { once: true },
        );
      });
    });

    const pending = fetchClubFuel(189, "2026-09-02T14:00:00.000Z", {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      signal: parent.signal,
      maxAttempts: 3,
      timeoutMs: 30_000,
    });

    await new Promise((r) => setTimeout(r, 10));
    parent.abort(new Error("collection_aborted"));

    await expect(pending).rejects.toMatchObject({ code: "COLLECTION_ABORTED" });
    expect(sawAbort).toBe(true);
  });

  it("runCollection deadline aborts underlying fetches and releases the lock", async () => {
    const { runCollection, isCollectionInProgress, __setCollectionLockForTests } =
      await import("../src/collector.js");
    __setCollectionLockForTests(null);

    let abortedFetches = 0;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing signal"));
          return;
        }
        const onAbort = () => {
          abortedFetches += 1;
          reject(new DOMException("The operation was aborted.", "AbortError"));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      });
    });

    await expect(
      runCollection({
        dryRun: true,
        dataDir: "tests/fixtures/tiny-data",
        concurrency: 1,
        timeoutMs: 40,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ code: "COLLECTION_ABORTED" });

    expect(abortedFetches).toBeGreaterThan(0);
    expect(isCollectionInProgress()).toBe(false);
  });
});

describe("schedule definition", () => {
  it("defines hourly collect job for Prisma cronScheduler", async () => {
    const { schedule } = await import("../src/schedule.js");
    expect(schedule.jobs).toEqual([{ jobId: "collect", every: "60m" }]);
  });
});

describe("API cache headers", () => {
  it("keeps status highly fresh and stations moderately cached", async () => {
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - 8000);
    const run = {
      startedAt,
      finishedAt,
      durationMs: 8000,
      clubsConfigured: 214,
      clubsSucceeded: 206,
      clubsEmptyFuels: 8,
      clubsHardFailed: 0,
      fuelObservations: 505,
      historyChanges: 0,
      databaseQueries: 1,
      degraded: false,
      failures: [],
    };
    const statusPrisma = {
      collectionRun: {
        findMany: vi.fn(async () => [run]),
      },
      $queryRaw: vi.fn(async () => [
        {
          latest: finishedAt,
          oldest: finishedAt,
          rows: 505n,
          stations_recent: 206n,
        },
      ]),
      club: {
        findMany: vi.fn(async () => []),
      },
    } as unknown as PrismaClient;

    const app = createApp({ prisma: statusPrisma, collectorSecret: "test-secret-value-0001" });
    const statusRes = await app.request("/api/v1/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.headers.get("cache-control")).toContain("s-maxage=15");
    expect(statusRes.headers.get("cache-control")).toContain("stale-while-revalidate");

    const healthRes = await app.request("/health");
    expect(healthRes.headers.get("cache-control")).toBe("no-store");
    const healthBody = (await healthRes.json()) as {
      revision?: string;
      dirty?: boolean;
      collectionInProgress?: boolean;
    };
    expect(healthBody.revision).toBeTruthy();
    expect(typeof healthBody.dirty).toBe("boolean");
    expect(healthBody.collectionInProgress).toBe(false);

    const stationsRes = await app.request("/api/v1/stations");
    expect(stationsRes.status).toBe(200);
    expect(stationsRes.headers.get("cache-control")).toContain("s-maxage=300");
  });
});

describe("persistence timeout and lock safety", () => {
  afterEach(async () => {
    const { __setCollectionLockForTests } = await import("../src/collector.js");
    __setCollectionLockForTests(null);
  });

  const successfulFetchImpl = (async () => {
    return new Response(
      JSON.stringify({
        response: {
          fuelPriceResponse: {
            data: [
              {
                sku: "1",
                name: "Unleaded",
                price: 3.919,
                priceDateTime: "2026-09-02T12:00:00",
              },
            ],
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  function createMockPrisma(options: {
    onQuery?: (query: unknown) => Promise<unknown>;
    onTransaction?: (cb: (tx: any) => Promise<unknown>, txOptions?: any) => Promise<unknown>;
  } = {}) {
    const txClient = {
      $executeRaw: vi.fn(async () => 1),
      $executeRawUnsafe: vi.fn(async () => 1),
      $queryRaw: vi.fn(async (query: unknown) => {
        if (options.onQuery) return await options.onQuery(query);
        return [
          {
            observations_received: 1n,
            history_rows_inserted: 1n,
            current_rows_upserted: 1n,
            run_rows_inserted: 1n,
          },
        ];
      }),
    };

    const prisma = {
      ...txClient,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<unknown>, txOptions?: any) => {
        if (options.onTransaction) {
          return await options.onTransaction(cb, txOptions);
        }
        return await cb(txClient);
      }),
    } as unknown as PrismaClient;

    return { prisma, txClient };
  }

  it("persistence takes longer than its configured DB timeout -> collection rejects/fails observably", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");

    const { prisma } = createMockPrisma({
      onTransaction: async (_cb, txOptions) => {
        // Simulate database statement timeout inside the transaction
        const timeoutMs = txOptions?.timeout ?? 50;
        await new Promise((r) => setTimeout(r, 10));
        const err = new Error(
          `Raw query failed. Code: 57014. Message: ERROR: canceling statement due to statement timeout after ${timeoutMs}ms`,
        );
        throw err;
      },
    });

    await expect(
      runCollection({
        prisma,
        dataDir: "tests/fixtures/tiny-data",
        fetchImpl: successfulFetchImpl,
        persistOptions: { statementTimeoutMs: 50, transactionTimeoutMs: 100, maxWaitMs: 50 },
      }),
    ).rejects.toThrow(/statement timeout/);

    expect(isCollectionInProgress()).toBe(false);
  });

  it("collection lock is eventually released after the DB operation actually settles", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");

    let resolveDb: () => void = () => {};
    const dbPromise = new Promise<void>((resolve) => {
      resolveDb = resolve;
    });

    const { prisma } = createMockPrisma({
      onTransaction: async (cb) => {
        await dbPromise;
        return await cb({
          $executeRawUnsafe: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => [
            {
              observations_received: 1n,
              history_rows_inserted: 1n,
              current_rows_upserted: 1n,
              run_rows_inserted: 1n,
            },
          ]),
        });
      },
    });

    const collectionPromise = runCollection({
      prisma,
      dataDir: "tests/fixtures/tiny-data",
      fetchImpl: successfulFetchImpl,
    });

    // Wait briefly so fetch finishes and persistence starts
    await new Promise((r) => setTimeout(r, 20));
    expect(isCollectionInProgress()).toBe(true);

    // Release the DB operation
    resolveDb();
    const result = await collectionPromise;

    expect(result.clubsSucceeded).toBe(1);
    expect(isCollectionInProgress()).toBe(false);
  });

  it("no subsequent collection overlaps unresolved persistence", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");

    let resolveFirstDb: () => void = () => {};
    const firstDbPromise = new Promise<void>((resolve) => {
      resolveFirstDb = resolve;
    });

    const { prisma: prismaFirst } = createMockPrisma({
      onTransaction: async (cb) => {
        await firstDbPromise;
        return await cb({
          $executeRawUnsafe: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => [
            {
              observations_received: 1n,
              history_rows_inserted: 1n,
              current_rows_upserted: 1n,
              run_rows_inserted: 1n,
            },
          ]),
        });
      },
    });

    const first = runCollection({
      prisma: prismaFirst,
      dataDir: "tests/fixtures/tiny-data",
      fetchImpl: successfulFetchImpl,
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(isCollectionInProgress()).toBe(true);

    // Second collection must be rejected with COLLECTION_IN_PROGRESS while first is persisting
    await expect(
      runCollection({
        prisma: prismaFirst,
        dataDir: "tests/fixtures/tiny-data",
        fetchImpl: successfulFetchImpl,
      }),
    ).rejects.toMatchObject({ code: "COLLECTION_IN_PROGRESS" });

    // Let the first collection finish
    resolveFirstDb();
    await first;
    expect(isCollectionInProgress()).toBe(false);

    // Third collection is now allowed to run and succeed
    const { prisma: prismaThird } = createMockPrisma();
    const third = await runCollection({
      prisma: prismaThird,
      dataDir: "tests/fixtures/tiny-data",
      fetchImpl: successfulFetchImpl,
    });
    expect(third.clubsSucceeded).toBe(1);
    expect(isCollectionInProgress()).toBe(false);
  });

  it("duration includes persistence time", async () => {
    const { runCollection } = await import("../src/collector.js");

    const delayMs = 60;
    const { prisma } = createMockPrisma({
      onTransaction: async (cb) => {
        await new Promise((r) => setTimeout(r, delayMs));
        return await cb({
          $executeRawUnsafe: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => [
            {
              observations_received: 1n,
              history_rows_inserted: 1n,
              current_rows_upserted: 1n,
              run_rows_inserted: 1n,
            },
          ]),
        });
      },
    });

    const result = await runCollection({
      prisma,
      dataDir: "tests/fixtures/tiny-data",
      fetchImpl: successfulFetchImpl,
    });

    expect(result.durationMs).toBeGreaterThanOrEqual(delayMs);
    const measuredWallClock =
      new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime();
    expect(measuredWallClock).toBeGreaterThanOrEqual(delayMs);
  });

  it("rejects on wall-clock deadline even if setTimeout callback did not fire and prevents persistence", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");

    const realNow = Date.now;
    let mockedNow = realNow();
    vi.spyOn(Date, "now").mockImplementation(() => mockedNow);

    let mainPersistCalled = false;
    let failurePersistCalled = false;

    const { prisma } = createMockPrisma({
      onTransaction: async (cb, txOptions) => {
        if (txOptions?.timeout === 6_000) {
          failurePersistCalled = true;
        } else {
          mainPersistCalled = true;
        }
        return await cb({
          $executeRaw: vi.fn(async () => 1),
          $executeRawUnsafe: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => [
            {
              observations_received: 0n,
              history_rows_inserted: 0n,
              current_rows_upserted: 0n,
              run_rows_inserted: 1n,
            },
          ]),
        });
      },
    });

    // Simulate 5-hour suspension/delay during fetch:
    const customFetch: typeof fetch = vi.fn(async (input, init) => {
      mockedNow += 5 * 3600 * 1000;
      return await successfulFetchImpl(input, init);
    });

    try {
      await expect(
        runCollection({
          prisma,
          dataDir: "tests/fixtures/tiny-data",
          fetchImpl: customFetch,
          timeoutMs: 10_000,
        }),
      ).rejects.toMatchObject({ code: "COLLECTION_ABORTED" });

      // Crucial: must NOT enter main persistence for observations!
      expect(mainPersistCalled).toBe(false);
      // Lock is released on ordinary deadline exceeded
      expect(isCollectionInProgress()).toBe(false);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it("fail-closed watchdog: unresolved persistence keeps lock asserted and blocks subsequent collections", async () => {
    const { runCollection, isCollectionInProgress } = await import("../src/collector.js");

    // DB hangs indefinitely
    const neverSettlingPromise = new Promise(() => {});
    const { prisma } = createMockPrisma({
      onTransaction: async () => {
        return await neverSettlingPromise;
      },
    });

    const onWatchdogTimeout = vi.fn();
    const terminateProcess = vi.fn();

    const collectionPromise = runCollection({
      prisma,
      dataDir: "tests/fixtures/tiny-data",
      fetchImpl: successfulFetchImpl,
      persistOptions: {
        statementTimeoutMs: 30,
        transactionTimeoutMs: 50,
        maxWaitMs: 20,
        watchdogTimeoutMs: 100,
        onWatchdogTimeout,
        terminateProcess,
      },
    });

    // Expect collection to reject with PERSIST_WATCHDOG_TIMEOUT
    await expect(collectionPromise).rejects.toMatchObject({
      code: "PERSIST_WATCHDOG_TIMEOUT",
    });

    // 1. Watchdog hook and terminateProcess were invoked
    expect(onWatchdogTimeout).toHaveBeenCalled();
    expect(terminateProcess).toHaveBeenCalledWith(1);

    // 2. Lock is STILL ASSERTED (fail-closed, not cleared!)
    expect(isCollectionInProgress()).toBe(true);

    // 3. Second collection is BLOCKED from running
    await expect(
      runCollection({
        prisma,
        dataDir: "tests/fixtures/tiny-data",
        fetchImpl: successfulFetchImpl,
      }),
    ).rejects.toMatchObject({ code: "COLLECTION_IN_PROGRESS" });

    // Clean up test lock
    const { __setCollectionLockForTests } = await import("../src/collector.js");
    __setCollectionLockForTests(null);
  });

  it("enforces timeout hierarchy: statementTimeout < transactionTimeout < maxWait + transactionTimeout < watchdogTimeout", () => {
    expect(DEFAULT_DB_STATEMENT_TIMEOUT_MS).toBeLessThan(DEFAULT_DB_TRANSACTION_TIMEOUT_MS);
    expect(DEFAULT_DB_TRANSACTION_TIMEOUT_MS).toBeLessThan(
      DEFAULT_DB_MAX_WAIT_MS + DEFAULT_DB_TRANSACTION_TIMEOUT_MS,
    );
    expect(
      DEFAULT_DB_MAX_WAIT_MS + DEFAULT_DB_TRANSACTION_TIMEOUT_MS,
    ).toBeLessThan(DEFAULT_PERSIST_WATCHDOG_TIMEOUT_MS);
    expect(DEFAULT_PERSIST_WATCHDOG_TIMEOUT_MS).toBeGreaterThanOrEqual(60_000);
  });

  it("watchdog does not fire during a transaction that legitimately consumes most/all of maxWait plus transaction timeout", async () => {
    const onWatchdogTimeout = vi.fn();
    const terminateProcess = vi.fn();

    // Mock Prisma that simulates legitimate time to acquire connection (maxWait) + execute query
    const mockPrisma = {
      $transaction: vi.fn(
        async (
          fn: (tx: unknown) => Promise<unknown>,
          _txOpts?: { maxWait?: number; timeout?: number },
        ) => {
          // Simulate connection acquisition delay (e.g. 25ms out of 35ms maxWait)
          await new Promise((r) => setTimeout(r, 25));
          const mockTx = {
            $executeRaw: vi.fn(async () => 1),
            $queryRaw: vi.fn(async () => {
              // Simulate query execution delay (e.g. 35ms out of 45ms transaction timeout)
              await new Promise((r) => setTimeout(r, 35));
              return [
                {
                  observations_received: 1n,
                  history_rows_inserted: 0n,
                  current_rows_upserted: 1n,
                  run_rows_inserted: 1n,
                  run_finished_at: new Date(),
                  run_duration_ms: 60,
                },
              ];
            }),
          };
          return await fn(mockTx);
        },
      ),
    } as unknown as PrismaClient;

    // maxWaitMs = 35, transactionTimeoutMs = 45 -> combined bound = 80ms.
    // watchdogTimeoutMs = 120ms (with 40ms safety margin).
    // Total elapsed is ~60ms, which exceeds maxWaitMs and transactionTimeoutMs individually,
    // but settles safely within the outer bound and well before watchdog.
    const stats = await persistFuelObservations(
      mockPrisma,
      [
        {
          clubNumber: 1,
          fuelSku: "1",
          fuelName: "Regular",
          price: "3.50",
          sourcePriceAtLocal: null,
          observedAt: "2026-09-02T12:00:00.000Z",
        },
      ],
      {
        startedAt: "2026-09-02T12:00:00.000Z",
        clubsConfigured: 1,
        clubsSucceeded: 1,
        clubsEmptyFuels: 0,
        clubsHardFailed: 0,
        fuelObservations: 1,
        degraded: false,
        failures: [],
      },
      {
        statementTimeoutMs: 30,
        maxWaitMs: 35,
        transactionTimeoutMs: 45,
        watchdogTimeoutMs: 120,
        onWatchdogTimeout,
        terminateProcess,
      },
    );

    expect(stats.observationsReceived).toBe(1);
    expect(onWatchdogTimeout).not.toHaveBeenCalled();
    expect(terminateProcess).not.toHaveBeenCalled();
  });

  it("watchdog fires only after that outer bound (maxWait + transactionTimeout)", async () => {
    const onWatchdogTimeout = vi.fn();
    const terminateProcess = vi.fn();

    const maxWaitMs = 25;
    const transactionTimeoutMs = 35;
    // Outer bound is maxWaitMs + transactionTimeoutMs = 60ms.
    // Watchdog is set to 80ms (with 20ms safety margin).
    const watchdogTimeoutMs = 80;

    let watchdogFiredAt = 0;
    onWatchdogTimeout.mockImplementation(() => {
      watchdogFiredAt = Date.now();
    });

    const hungPrisma = {
      $transaction: vi.fn(async () => {
        // Hangs indefinitely beyond outer bound
        await new Promise(() => {});
      }),
    } as unknown as PrismaClient;

    const start = Date.now();
    await expect(
      persistFuelObservations(
        hungPrisma,
        [],
        {
          startedAt: "2026-09-02T12:00:00.000Z",
          clubsConfigured: 1,
          clubsSucceeded: 1,
          clubsEmptyFuels: 0,
          clubsHardFailed: 0,
          fuelObservations: 0,
          degraded: false,
          failures: [],
        },
        {
          statementTimeoutMs: 20,
          maxWaitMs,
          transactionTimeoutMs,
          watchdogTimeoutMs,
          onWatchdogTimeout,
          terminateProcess,
        },
      ),
    ).rejects.toMatchObject({ code: "PERSIST_WATCHDOG_TIMEOUT" });

    const elapsed = watchdogFiredAt - start;
    // Watchdog must NOT have fired prematurely before maxWait + transactionTimeout
    expect(elapsed).toBeGreaterThanOrEqual(maxWaitMs + transactionTimeoutMs);
    expect(onWatchdogTimeout).toHaveBeenCalled();
    expect(terminateProcess).toHaveBeenCalledWith(1);
  });
});

// Keep import referenced for typecheck of optional dry-run path
void runCollection;
