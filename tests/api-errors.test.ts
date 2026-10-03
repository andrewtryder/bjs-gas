import { describe, expect, it } from "vitest";
import { isPrismaPoolTimeout } from "../src/api/errors.js";

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
