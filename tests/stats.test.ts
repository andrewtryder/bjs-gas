import { describe, expect, it } from "vitest";
import {
  formatPrice,
  formatDate,
  formatDisplayDate,
  formatPriceComparison,
  formatNearbyPriceDelta,
  calculateFuelStats,
} from "../web/lib/stats.js";
import type { StationDto } from "../web/lib/types.js";

describe("formatPriceComparison", () => {
  it("formats cheaper prices in cents below reference", () => {
    const res = formatPriceComparison(3.899, 3.979, "Massachusetts median");
    expect(res.isCheaper).toBe(true);
    expect(res.isHigher).toBe(false);
    expect(res.isSame).toBe(false);
    expect(res.deltaCents).toBe(-8);
    expect(res.text).toBe("8¢ below Massachusetts median");
  });

  it("formats more expensive prices in cents above reference", () => {
    const res = formatPriceComparison(4.029, 3.979, "national median");
    expect(res.isCheaper).toBe(false);
    expect(res.isHigher).toBe(true);
    expect(res.isSame).toBe(false);
    expect(res.deltaCents).toBe(5);
    expect(res.text).toBe("5¢ above national median");
  });

  it("formats essentially identical prices as about the same", () => {
    const res = formatPriceComparison(3.979, 3.980, "Massachusetts median");
    expect(res.isSame).toBe(true);
    expect(res.isCheaper).toBe(false);
    expect(res.isHigher).toBe(false);
    expect(res.deltaCents).toBe(0);
    expect(res.text).toBe("About the same as Massachusetts median");
  });
});

describe("formatNearbyPriceDelta", () => {
  it("formats negative delta as cheaper", () => {
    const res = formatNearbyPriceDelta("-0.080");
    expect(res.isCheaper).toBe(true);
    expect(res.isHigher).toBe(false);
    expect(res.isSame).toBe(false);
    expect(res.text).toBe("8¢ cheaper");
  });

  it("formats positive delta as more", () => {
    const res = formatNearbyPriceDelta("+0.050");
    expect(res.isCheaper).toBe(false);
    expect(res.isHigher).toBe(true);
    expect(res.isSame).toBe(false);
    expect(res.text).toBe("5¢ higher");
  });

  it("formats zero delta as same price", () => {
    const res = formatNearbyPriceDelta("0.000");
    expect(res.isSame).toBe(true);
    expect(res.isCheaper).toBe(false);
    expect(res.isHigher).toBe(false);
    expect(res.text).toBe("Same price");
  });

  it("handles null/undefined gracefully", () => {
    const res = formatNearbyPriceDelta(null);
    expect(res.text).toBe("");
  });
});

describe("formatDisplayDate", () => {
  it("formats ISO string without UTC headline", () => {
    const formatted = formatDisplayDate("2026-09-04T22:00:51.519Z");
    expect(formatted).not.toContain("UTC");
    expect(formatted).toMatch(/Sep 4, 2026/);
  });
});
