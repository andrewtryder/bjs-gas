import { describe, expect, it } from "vitest";
import { getFreshnessInfo, formatRelativeTime } from "../web/lib/freshness.js";

describe("Data Freshness Model", () => {
  const now = new Date("2026-09-12T12:00:00.000Z");

  it("classifies <= 2 hours as fresh", () => {
    // 30 minutes ago
    const timestamp = new Date(now.getTime() - 30 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("fresh");
    expect(info.relativeText).toBe("Updated 30m ago");
  });

  it("classifies exactly 120 minutes as fresh boundary", () => {
    const timestamp = new Date(now.getTime() - 120 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("fresh");
    expect(info.relativeText).toBe("Updated 2h ago");
  });

  it("classifies between 2 and 6 hours as aging", () => {
    // 180 minutes (3 hours) ago
    const timestamp = new Date(now.getTime() - 180 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("aging");
    expect(info.label).toBe("Aging");
    expect(info.relativeText).toBe("Updated 3h ago");
  });

  it("classifies > 6 hours as stale", () => {
    // 8 hours ago
    const timestamp = new Date(now.getTime() - 8 * 60 * 60_000).toISOString();
    const info = getFreshnessInfo(timestamp, now);
    expect(info.level).toBe("stale");
    expect(info.label).toBe("Stale");
    expect(info.relativeText).toBe("Updated 8h ago");
  });

  it("classifies days-old data with day notation", () => {
    // 48 hours ago
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
    expect(formatRelativeTime(90)).toBe("Updated 1h ago");
    expect(formatRelativeTime(1440)).toBe("Updated 1d ago");
  });
});
