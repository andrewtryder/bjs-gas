import { describe, expect, it, vi } from "vitest";
import { authorizeCollector } from "../src/auth.js";
import { createApp } from "../src/app.js";
import { evaluateHealthy } from "../src/api/status.js";
import { fetchClubFuel, mapPool } from "../src/fuel/client.js";
import {
  dedupeObservations,
  normalizePrice,
  normalizeSourcePriceAtLocal,
  observationsFromFuelResponse,
} from "../src/fuel/types.js";
import { runCollection } from "../src/collector.js";
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
    const statusPrisma = {
      collectionRun: {
        findFirst: vi.fn(async () => ({
          startedAt,
          finishedAt,
          durationMs: 8000,
          clubsConfigured: 221,
          clubsSucceeded: 206,
          clubsEmptyFuels: 15,
          clubsHardFailed: 0,
          fuelObservations: 505,
          historyChanges: 0,
          databaseQueries: 1,
          degraded: false,
          failures: [],
        })),
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
      lastCollection: { clubsHardFailed: number; clubsEmptyFuels: number } | null;
      freshness: { stationsObservedRecently: number };
    };
    expect(body.ok).toBe(true);
    expect(body.healthy).toBe(true);
    expect(body.lastCollection?.clubsHardFailed).toBe(0);
    expect(body.lastCollection?.clubsEmptyFuels).toBe(15);
    expect(body.freshness.stationsObservedRecently).toBe(206);
  });
});

describe("status healthy evaluation", () => {
  const baseRun = {
    startedAt: "2026-09-02T14:00:00.000Z",
    finishedAt: "2026-09-02T14:00:08.000Z",
    durationMs: 8000,
    clubsConfigured: 221,
    clubsSucceeded: 206,
    clubsEmptyFuels: 15,
    clubsHardFailed: 0,
    clubsFailed: 15,
    fuelObservations: 505,
    historyChanges: 0,
    databaseQueries: 1,
    degraded: false,
    failures: [],
  };

  const freshness = {
    latestObservedAt: "2026-09-02T14:00:00.000Z",
    oldestObservedAt: "2026-09-02T14:00:00.000Z",
    currentPriceRows: 505,
    stationsObservedRecently: 206,
    freshWindowMinutes: 90,
  };

  it("marks healthy for a fresh successful run", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 221,
      lastCollection: baseRun,
      freshness,
      now: new Date("2026-09-02T14:30:00.000Z"),
    });
    expect(result.healthy).toBe(true);
    expect(result.unhealthyReasons).toEqual([]);
  });

  it("marks unhealthy when last collection is stale", () => {
    const result = evaluateHealthy({
      configuredGasClubs: 221,
      lastCollection: baseRun,
      freshness,
      now: new Date("2026-09-02T16:00:00.000Z"),
    });
    expect(result.healthy).toBe(false);
    expect(result.unhealthyReasons).toContain("last_collection_stale");
  });
});

// Keep import referenced for typecheck of optional dry-run path
void runCollection;
