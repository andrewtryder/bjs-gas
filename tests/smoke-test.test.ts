import { describe, expect, it } from "vitest";
import { runSmokeTest } from "../scripts/smoke-test.mjs";

const noSleep = async () => {};

function baseHealthyFetch(overrides: Record<string, (url: string, init?: RequestInit) => Response> = {}) {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    for (const [pattern, handler] of Object.entries(overrides)) {
      if (url.includes(pattern)) {
        return handler(url, init);
      }
    }
    if (url.includes("/health")) {
      return new Response(JSON.stringify({ ok: true, dirty: false, revision: "abc1234" }), { status: 200 });
    }
    if (url.includes("/api/v1/stations")) {
      return new Response(JSON.stringify({ stations: [{ clubNumber: 1 }] }), { status: 200 });
    }
    if (url.includes("/api/v1/status")) {
      return new Response(JSON.stringify({ healthy: true, unhealthyReasons: [] }), { status: 200 });
    }
    return new Response("<html>ok</html>", { status: 200 });
  }) as typeof fetch;
}

describe("scripts/smoke-test.mjs", () => {
  it("passes without triggering collection when data is already fresh", async () => {
    let collectCalls = 0;
    const fetchFn = baseHealthyFetch({
      "/internal/collect": () => {
        collectCalls += 1;
        return new Response("{}", { status: 200 });
      },
    });

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(true);
    expect(res.availabilityOk).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.revision).toBe("abc1234");
    expect(res.stationCount).toBe(1);
    expect(res.refreshTriggered).toBe(false);
    expect(res.refreshStatus).toBe("not_needed");
    expect(collectCalls).toBe(0);
  });

  it("fails immediately on availability/revision errors without triggering collection refresh", async () => {
    let collectCalls = 0;
    const fetchFn = baseHealthyFetch({
      "/health": () =>
        new Response(JSON.stringify({ ok: true, dirty: true, revision: "wrong11" }), { status: 200 }),
      "/api/v1/stations": () => new Response(JSON.stringify({ stations: [] }), { status: 200 }),
      "/api/v1/status": () =>
        new Response(JSON.stringify({ healthy: false, unhealthyReasons: ["last_collection_stale"] }), { status: 200 }),
      "/internal/collect": () => {
        collectCalls += 1;
        return new Response("{}", { status: 200 });
      },
    });

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(false);
    expect(res.availabilityOk).toBe(false);
    expect(res.refreshTriggered).toBe(false);
    expect(res.refreshStatus).toBe("aborted_availability_failure");
    expect(collectCalls).toBe(0);
    expect(res.failures.length).toBeGreaterThanOrEqual(3);
  });

  it("triggers a bounded authenticated refresh on stale collection data and passes when recheck is healthy", async () => {
    let statusCalls = 0;
    let collectAuthHeader: string | null = null;
    const fetchFn = baseHealthyFetch({
      "/api/v1/status": () => {
        statusCalls += 1;
        if (statusCalls === 1) {
          return new Response(
            JSON.stringify({
              healthy: false,
              unhealthyReasons: ["last_collection_stale", "fresh_stations_below_majority"],
              collectionLock: { inProgress: false, stale: false, overExpectedDuration: false },
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ healthy: true, unhealthyReasons: [] }), { status: 200 });
      },
      "/internal/collect": (_url, init) => {
        collectAuthHeader = new Headers(init?.headers).get("authorization");
        return new Response(JSON.stringify({ clubsSucceeded: 211 }), { status: 200 });
      },
    });

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(true);
    expect(res.availabilityOk).toBe(true);
    expect(res.refreshTriggered).toBe(true);
    expect(res.refreshStatus).toBe("refreshed");
    expect(collectAuthHeader).toBe("Bearer secret-123");
    expect(statusCalls).toBe(2);
  });

  it("does not trigger refresh for non-staleness health failures", async () => {
    let collectCalls = 0;
    const fetchFn = baseHealthyFetch({
      "/api/v1/status": () =>
        new Response(
          JSON.stringify({
            healthy: false,
            unhealthyReasons: ["hard_failure_ratio_high", "last_collection_stale"],
            collectionLock: { inProgress: false, stale: false, overExpectedDuration: false },
          }),
          { status: 200 },
        ),
      "/internal/collect": () => {
        collectCalls += 1;
        return new Response("{}", { status: 200 });
      },
    });

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(false);
    expect(res.availabilityOk).toBe(true);
    expect(res.refreshTriggered).toBe(false);
    expect(res.refreshStatus).toBe("skipped_unhealthy_non_stale");
    expect(collectCalls).toBe(0);
  });

  it("respects existing collector locks (409) by polling until healthy", async () => {
    let statusCalls = 0;
    const fetchFn = baseHealthyFetch({
      "/api/v1/status": () => {
        statusCalls += 1;
        if (statusCalls === 1) {
          return new Response(
            JSON.stringify({
              healthy: false,
              unhealthyReasons: ["last_collection_stale"],
              collectionLock: { inProgress: false, stale: false, overExpectedDuration: false },
            }),
            { status: 200 },
          );
        }
        if (statusCalls === 2) {
          return new Response(
            JSON.stringify({
              healthy: false,
              unhealthyReasons: ["last_collection_stale"],
              collectionLock: { inProgress: true, stale: false, overExpectedDuration: false },
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            healthy: true,
            unhealthyReasons: [],
            collectionLock: { inProgress: false, stale: false, overExpectedDuration: false },
          }),
          { status: 200 },
        );
      },
      "/internal/collect": () => new Response(JSON.stringify({ error: "collection_in_progress" }), { status: 409 }),
    });

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn,
      sleepFn: noSleep,
      pollIntervalMs: 1,
      maxPollAttempts: 5,
    });

    expect(res.ok).toBe(true);
    expect(res.refreshTriggered).toBe(true);
    expect(res.refreshStatus).toBe("waited_for_lock");
  });

  it("fails explicitly on rate limit (429) or when health remains unhealthy after refresh", async () => {
    const rateLimitedFetch = baseHealthyFetch({
      "/api/v1/status": () =>
        new Response(
          JSON.stringify({
            healthy: false,
            unhealthyReasons: ["last_collection_stale"],
          }),
          { status: 200 },
        ),
      "/internal/collect": () => new Response("rate limited", { status: 429 }),
    });

    const rateRes = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn: rateLimitedFetch,
      sleepFn: noSleep,
    });

    expect(rateRes.ok).toBe(false);
    expect(rateRes.refreshStatus).toBe("rate_limited");
    expect(rateRes.failures[0]).toContain("429");

    const stillUnhealthyFetch = baseHealthyFetch({
      "/api/v1/status": () =>
        new Response(
          JSON.stringify({
            healthy: false,
            unhealthyReasons: ["last_collection_stale"],
          }),
          { status: 200 },
        ),
      "/internal/collect": () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    });

    const unhealthyRes = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      refreshIfStale: true,
      collectorSecret: "secret-123",
      fetchFn: stillUnhealthyFetch,
      sleepFn: noSleep,
      pollIntervalMs: 1,
    });

    expect(unhealthyRes.ok).toBe(false);
    expect(unhealthyRes.refreshTriggered).toBe(true);
    expect(unhealthyRes.refreshStatus).toBe("failed");
    expect(unhealthyRes.failures[0]).toContain("remained unhealthy");
  });
});
