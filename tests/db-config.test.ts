import { describe, expect, it } from "vitest";
import { configureDatabaseUrl } from "../src/db.js";

describe("configureDatabaseUrl", () => {
  it("adds default pool, connect, and socket timeouts when absent", () => {
    const configured = new URL(configureDatabaseUrl("postgresql://user:pass@db.example:5432/bjs"));
    expect(configured.searchParams.get("connection_limit")).toBe("10");
    expect(configured.searchParams.get("pool_timeout")).toBe("20");
    expect(configured.searchParams.get("connect_timeout")).toBe("10");
    expect(configured.searchParams.get("socket_timeout")).toBe("20");
  });

  it("preserves explicit timeout and pool parameters", () => {
    const configured = new URL(
      configureDatabaseUrl(
        "postgresql://user:pass@db.example:5432/bjs?connection_limit=5&pool_timeout=15&connect_timeout=5&socket_timeout=12",
      ),
    );
    expect(configured.searchParams.get("connection_limit")).toBe("5");
    expect(configured.searchParams.get("pool_timeout")).toBe("15");
    expect(configured.searchParams.get("connect_timeout")).toBe("5");
    expect(configured.searchParams.get("socket_timeout")).toBe("12");
  });
});
