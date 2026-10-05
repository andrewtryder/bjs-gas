import { describe, expect, it } from "vitest";
import { checkHealth, FALLBACK_MAX_STALENESS_MINUTES } from "../scripts/monitor-health.mjs";

function createMockFetch(
  healthStatus: number,
  statusPayload: Record<string, unknown>,
): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/health")) {
      return {
        ok: healthStatus === 200,
        status: healthStatus,
        json: async () => ({ ok: healthStatus === 200, revision: "test-rev-123" }),
      } as unknown as Response;
    }
    if (url.endsWith("/api/v1/status")) {
      return {
        ok: true,
        status: 200,
        json: async () => statusPayload,
      } as unknown as Response;
    }
    return { ok: false, status: 404 } as unknown as Response;
  }) as typeof fetch;
}

describe("monitor-health.mjs checkHealth function", () => {
  it("passes when status is healthy and within API-provided freshWindowMinutes", async () => {
    const now = Date.now();
    const mockFetch = createMockFetch(200, {
      healthy: true,
      unhealthyReasons: [],
      collectionLock: { stale: false },
      freshness: {
        freshStationRatio: 0.95,
        freshWindowMinutes: 120,
        latestObservedAt: new Date(now - 80 * 60_000).toISOString(),
      },
      lastSuccessfulCollection: {
        startedAt: new Date(now - 80 * 60_000).toISOString(),
      },
    });

    const result = await checkHealth("http://mock-api", {
      fetchFn: mockFetch,
      now,
    });

    expect(result.ok).toBe(true);
    expect(result.output?.status).toBe("PASS");
    expect(result.output?.freshWindowMinutes).toBe(120);
    expect(result.output?.revision).toBe("test-rev-123");
  });

  it("fails when collection age exceeds the API-provided freshWindowMinutes", async () => {
    const now = Date.now();
    const mockFetch = createMockFetch(200, {
      healthy: true,
      unhealthyReasons: [],
      collectionLock: { stale: false },
      freshness: {
        freshStationRatio: 0.95,
        freshWindowMinutes: 120,
        latestObservedAt: new Date(now - 130 * 60_000).toISOString(),
      },
      lastSuccessfulCollection: {
        startedAt: new Date(now - 130 * 60_000).toISOString(),
      },
    });

    const result = await checkHealth("http://mock-api", {
      fetchFn: mockFetch,
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.alert?.status).toBe("FAIL");
    expect(
      result.alert?.failures.some((f: string) => f.includes("exceeds 120m threshold")),
    ).toBe(true);
  });

  it("falls back to 180 minutes when freshWindowMinutes is not provided", async () => {
    const now = Date.now();
    const mockFetch = createMockFetch(200, {
      healthy: true,
      unhealthyReasons: [],
      collectionLock: { stale: false },
      freshness: {
        freshStationRatio: 0.95,
        latestObservedAt: new Date(now - 150 * 60_000).toISOString(),
      },
      lastSuccessfulCollection: {
        startedAt: new Date(now - 150 * 60_000).toISOString(),
      },
    });

    const result = await checkHealth("http://mock-api", {
      fetchFn: mockFetch,
      now,
    });

    expect(result.ok).toBe(true);
    expect(result.output?.status).toBe("PASS");
    expect(result.output?.freshWindowMinutes).toBe(FALLBACK_MAX_STALENESS_MINUTES);
  });

  it("reports failure when /health fails or status is unhealthy", async () => {
    const now = Date.now();
    const mockFetch = createMockFetch(503, {
      healthy: false,
      unhealthyReasons: ["last_collection_stale"],
      collectionLock: { stale: true, ageMs: 300_000 },
      freshness: { freshStationRatio: 0.1 },
    });

    const result = await checkHealth("http://mock-api", {
      fetchFn: mockFetch,
      now,
    });

    expect(result.ok).toBe(false);
    expect(result.alert?.failureCount).toBeGreaterThanOrEqual(3);
    expect(result.alert?.failures).toContain("/health returned HTTP 503");
  });
});
