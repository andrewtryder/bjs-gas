import { describe, expect, it } from "vitest";
import { getFreshnessInfo, formatAgeAgo, formatRelativeTime } from "../web/lib/freshness.js";

describe("Data Freshness Model", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("classifies <= 3 hours as fresh", () => {
    const timestamp = new Date(now.getTime() - 130 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("fresh");
    expect(info.relativeText).toBe("Updated 2h ago");
  });

  it("classifies exactly 180 minutes as the fresh boundary", () => {
    const timestamp = new Date(now.getTime() - 180 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("fresh");
    expect(info.relativeText).toBe("Updated 3h ago");
  });

  it("classifies between 3 and 6 hours as aging", () => {
    const timestamp = new Date(now.getTime() - 181 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("aging");
    expect(info.label).toBe("Aging");
  });

  it("classifies > 6 hours as stale", () => {
    const timestamp = new Date(now.getTime() - 8 * 60 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("stale");
    expect(info.label).toBe("Stale");
    expect(info.relativeText).toBe("Updated 8h ago");
  });

  it("classifies days-old data with day notation", () => {
    const timestamp = new Date(now.getTime() - 48 * 60 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("stale");
    expect(info.relativeText).toBe("Updated 2d ago");
  });

  it("handles null/undefined gracefully", () => {
    const infoNull = getFreshnessInfo(null, now);
    expect(infoNull.level).toBe("stale");
    expect(infoNull.relativeText).toBe("Update time unknown");

    const infoUndef = getFreshnessInfo(undefined, now);
    expect(infoUndef.level).toBe("stale");
  });

  it("formats relative minutes correctly", () => {
    expect(formatRelativeTime(0)).toBe("Just updated");
    expect(formatRelativeTime(45)).toBe("Updated 45m ago");
    expect(formatRelativeTime(59)).toBe("Updated 59m ago");
    expect(formatRelativeTime(60)).toBe("Updated 1h ago");
    expect(formatRelativeTime(90)).toBe("Updated 1h ago");
    expect(formatRelativeTime(1439)).toBe("Updated 23h ago");
    expect(formatRelativeTime(1440)).toBe("Updated 1d ago");
  });

  it("handles clock drift between server and client hydration across boundary transitions", () => {
    // Simulated Station 68 observation from Honeybadger fault 135660356
    const observedAt = "2026-11-15T19:04:21.438Z";

    // Server renders at 08:04:00 UTC (12 hours, 59 minutes elapsed)
    const serverNow = new Date("2026-11-16T08:04:00.000Z");
    const serverFreshness = getFreshnessInfo(observedAt, serverNow);
    expect(serverFreshness.relativeText).toBe("Updated 12h ago");
    expect(serverFreshness.level).toBe("stale");

    // Client hydrates a moment later at 08:05:00 UTC (13 hours elapsed)
    const clientNow = new Date("2026-11-16T08:05:00.000Z");
    const clientFreshness = getFreshnessInfo(observedAt, clientNow);
    expect(clientFreshness.relativeText).toBe("Updated 13h ago");
    expect(clientFreshness.level).toBe("stale");

    // Demonstrates text mismatch when hydration occurs across clock boundaries
    expect(serverFreshness.relativeText).not.toBe(clientFreshness.relativeText);
  });

  it("handles minute-rollover clock drift during hydration (59m vs 1h)", () => {
    const observedAt = "2026-11-16T07:24:00.000Z";

    // Server renders at 08:23:40 UTC (59 minutes elapsed)
    const serverNow = new Date("2026-11-16T08:23:40.000Z");
    const serverFreshness = getFreshnessInfo(observedAt, serverNow);
    expect(serverFreshness.relativeText).toBe("Updated 59m ago");

    // Client hydrates at 08:24:05 UTC (60 minutes elapsed)
    const clientNow = new Date("2026-11-16T08:24:05.000Z");
    const clientFreshness = getFreshnessInfo(observedAt, clientNow);
    expect(clientFreshness.relativeText).toBe("Updated 1h ago");

    expect(serverFreshness.relativeText).not.toBe(clientFreshness.relativeText);
  });

  it("formats spoken ages for the About page", () => {
    expect(formatAgeAgo(42)).toBe("42 minutes ago");
    expect(formatAgeAgo(1)).toBe("1 minute ago");
    expect(formatAgeAgo(240)).toBe("4 hours ago");
    expect(formatAgeAgo(0)).toBe("just now");
  });
});
