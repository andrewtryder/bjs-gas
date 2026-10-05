import { describe, expect, it } from "vitest";
import { isPrismaPoolTimeout, parseApiErrorMessage } from "../src/api/errors.js";


describe("isPrismaPoolTimeout", () => {
  it("returns true for P2024 objects, including Error-shaped Prisma errors", () => {
    expect(isPrismaPoolTimeout({ code: "P2024" })).toBe(true);
    expect(
      isPrismaPoolTimeout(
        Object.assign(new Error("Timed out fetching a new connection from the connection pool"), {
          code: "P2024",
        }),
      ),
    ).toBe(true);
  });

  it("returns false for P1017, other Prisma codes, and non-objects", () => {
    expect(isPrismaPoolTimeout({ code: "P1017" })).toBe(false);
    expect(isPrismaPoolTimeout({ code: "P2028" })).toBe(false);
    expect(isPrismaPoolTimeout(new Error("ordinary"))).toBe(false);
    expect(isPrismaPoolTimeout(null)).toBe(false);
    expect(isPrismaPoolTimeout("P2024")).toBe(false);
    expect(isPrismaPoolTimeout(undefined)).toBe(false);
  });
});

describe("parseApiErrorMessage", () => {
  it("extracts structured P2024 JSON error into descriptive error message", async () => {
    const res = new Response(
      JSON.stringify({
        error: "database_pool_timeout",
        code: "P2024",
        message: "Database connection pool exhausted. Please retry.",
      }),
      { status: 503, statusText: "Service Unavailable" },
    );
    const msg = await parseApiErrorMessage(res, "Failed to fetch stations");
    expect(msg).toBe(
      "Failed to fetch stations: 503 Service Unavailable (P2024: database_pool_timeout: Database connection pool exhausted. Please retry.)",
    );
  });

  it("extracts database_overloaded QUEUE_FULL error into message", async () => {
    const res = new Response(
      JSON.stringify({
        error: "database_overloaded",
        code: "503",
        reason: "QUEUE_FULL",
        message: "Database admission queue full or timed out. Please retry.",
      }),
      { status: 503, statusText: "Service Unavailable" },
    );
    const msg = await parseApiErrorMessage(res, "Failed to fetch stations");
    expect(msg).toBe(
      "Failed to fetch stations: 503 Service Unavailable (503: database_overloaded: QUEUE_FULL: Database admission queue full or timed out. Please retry.)",
    );
  });

  it("extracts and strips HTML 502 responses", async () => {
    const res = new Response("<html><head><title>502 Bad Gateway</title></head><body><h1>502 Bad Gateway</h1></body></html>", {
      status: 502,
      statusText: "Bad Gateway",
    });
    const msg = await parseApiErrorMessage(res, "Failed to fetch stations");
    expect(msg).toContain("502 Bad Gateway");
    expect(msg).not.toContain("<html>");
  });

  it("falls back to status line when response body is empty", async () => {
    const res = new Response("", { status: 500, statusText: "Internal Server Error" });
    const msg = await parseApiErrorMessage(res, "Failed to fetch stations");
    expect(msg).toBe("Failed to fetch stations: 500 Internal Server Error");
  });
});

