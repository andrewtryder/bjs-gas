import { describe, expect, it } from "vitest";
import { runSmokeTest } from "../scripts/smoke-test.mjs";

const noSleep = async () => {};

describe("scripts/smoke-test.mjs", () => {
  it("passes when API health, revision, stations, status, and web routes succeed", async () => {
    const fetchFn = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return new Response(JSON.stringify({ ok: true, dirty: false, revision: "abc1234" }), { status: 200 });
      }
      if (url.endsWith("/api/v1/stations")) {
        return new Response(JSON.stringify({ stations: [{ clubNumber: 1 }] }), { status: 200 });
      }
      if (url.endsWith("/api/v1/status")) {
        return new Response(JSON.stringify({ healthy: true }), { status: 200 });
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(true);
    expect(res.failures).toEqual([]);
    expect(res.revision).toBe("abc1234");
    expect(res.stationCount).toBe(1);
  });

  it("fails on revision mismatch, dirty build, or unhealthy status", async () => {
    const fetchFn = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/health")) {
        return new Response(JSON.stringify({ ok: true, dirty: true, revision: "wrong11" }), { status: 200 });
      }
      if (url.endsWith("/api/v1/stations")) {
        return new Response(JSON.stringify({ stations: [] }), { status: 200 });
      }
      if (url.endsWith("/api/v1/status")) {
        return new Response(JSON.stringify({ healthy: false, unhealthyReasons: ["stale"] }), { status: 200 });
      }
      return new Response("err", { status: 500 });
    }) as typeof fetch;

    const res = await runSmokeTest({
      apiUrl: "https://api.example",
      webUrl: "https://web.example",
      expectedRevision: "abc1234",
      fetchFn,
      sleepFn: noSleep,
    });

    expect(res.ok).toBe(false);
    expect(res.failures.length).toBeGreaterThanOrEqual(5);
  });
});
