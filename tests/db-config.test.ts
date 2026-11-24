import { describe, expect, it } from "vitest";
import { buildPoolConfig } from "../src/db.js";

describe("buildPoolConfig", () => {
  it("applies bounded pool, connection, idle, lifetime, and statement timeouts by default", () => {
    const config = buildPoolConfig("postgresql://user:pass@db.example:5432/bjs");
    expect(config.connectionString).toBe("postgresql://user:pass@db.example:5432/bjs");
    expect(config.max).toBe(10);
    expect(config.connectionTimeoutMillis).toBe(10_000);
    expect(config.idleTimeoutMillis).toBe(30_000);
    expect(config.maxLifetimeSeconds).toBe(1800);
    expect(config.statement_timeout).toBe(20_000);
  });

  it("respects explicit URL timeout, limit, and options parameters", () => {
    const config = buildPoolConfig(
      "postgresql://user:pass@db.example:5432/bjs?connection_limit=5&connect_timeout=4&socket_timeout=12&options=-c%20timezone%3DAmerica%2FNew_York",
    );
    expect(config.max).toBe(5);
    expect(config.connectionTimeoutMillis).toBe(4_000);
    expect(config.statement_timeout).toBe(12_000);
    expect(config.options).toBe("-c timezone=America/New_York");
  });
});
