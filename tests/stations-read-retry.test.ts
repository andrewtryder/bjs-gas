import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app.js";

function createStationsApp(findMany: ReturnType<typeof vi.fn>) {
  const prisma = { club: { findMany } } as unknown as PrismaClient;
  return createApp({ prisma, collectorSecret: "test-secret" });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/v1/stations closed-connection recovery", () => {
  it("retries a P1017 socket close once and returns stations", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const closed = Object.assign(new Error("Server has closed the connection."), {
      code: "P1017",
    });
    const findMany = vi.fn().mockRejectedValueOnce(closed).mockResolvedValueOnce([]);
    const res = await createStationsApp(findMany).request("/api/v1/stations");

    expect(res.status).toBe(200);
    expect((await res.json()).stations).toEqual([]);
    expect(findMany).toHaveBeenCalledTimes(2);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
  });

  it("does not retry indefinitely when the connection remains closed", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const closed = Object.assign(new Error("Server has closed the connection."), {
      code: "P1017",
    });
    const findMany = vi.fn().mockRejectedValue(closed);
    const res = await createStationsApp(findMany).request("/api/v1/stations");

    expect(res.status).toBe(500);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it("does not retry unrelated database exceptions", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const findMany = vi.fn().mockRejectedValue(new Error("invalid query"));
    const res = await createStationsApp(findMany).request("/api/v1/stations");

    expect(res.status).toBe(500);
    expect(findMany).toHaveBeenCalledTimes(1);
  });

  it("preserves 503 pool-exhaustion handling and does not retry P2024", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const timedOut = Object.assign(new Error("Pool timeout"), { code: "P2024" });
    const findMany = vi.fn().mockRejectedValue(timedOut);
    const res = await createStationsApp(findMany).request("/api/v1/stations");

    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("database_pool_timeout");
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
