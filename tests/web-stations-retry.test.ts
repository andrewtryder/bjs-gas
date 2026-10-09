import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../web/src/service", () => ({
  default: { load: () => ({ api: { url: "https://api.example.test" } }) },
}));

import { getStations } from "../web/lib/api";

const stationPayload = { generatedAt: "2026-10-09T00:00:00Z", stations: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web station fetch transient retry", () => {
  it("returns a successful first response without retrying", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(stationPayload)));
    vi.stubGlobal("fetch", request);

    await expect(getStations()).resolves.toEqual(stationPayload);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("https://api.example.test/api/v1/stations", {
      cache: "no-store",
    });
  });

  it.each([500, 502, 503, 504])("retries transient HTTP %i once", async (status) => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "temporary" }), { status }))
      .mockResolvedValueOnce(new Response(JSON.stringify(stationPayload)));
    vi.stubGlobal("fetch", request);

    await expect(getStations()).resolves.toEqual(stationPayload);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(2, "https://api.example.test/api/v1/stations", {
      cache: "no-store",
    });
  });

  it("does not retry permanent HTTP 404 failures", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
    }));
    vi.stubGlobal("fetch", request);

    await expect(getStations()).rejects.toThrow("404");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("surfaces a persistent 500 after only one retry", async () => {
    const request = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "internal_server_error" }),
      { status: 500 },
    ));
    vi.stubGlobal("fetch", request);

    await expect(getStations()).rejects.toThrow("internal_server_error");
    expect(request).toHaveBeenCalledTimes(2);
  });
});
