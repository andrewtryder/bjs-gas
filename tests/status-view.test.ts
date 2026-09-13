import { describe, expect, it } from "vitest";
import {
  resolveStatusHero,
  formatCollectionDuration,
} from "../web/lib/status-view.js";

describe("status-view helpers", () => {
  describe("resolveStatusHero", () => {
    it("returns healthy status with relative time when healthy", () => {
      const nowIso = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      const hero = resolveStatusHero({ healthy: true }, null, nowIso);
      expect(hero.level).toBe("healthy");
      expect(hero.heading).toBe("Prices are up to date");
      expect(hero.badgeLabel).toBe("Up to date");
      expect(hero.description).toContain("15m ago");
    });

    it("returns degraded status when unhealthy without fetch error", () => {
      const hero = resolveStatusHero(
        { healthy: false, unhealthyReasons: ["2 stations missing recent observations"] },
        null,
        null
      );
      expect(hero.level).toBe("degraded");
      expect(hero.heading).toBe("Some prices may be delayed");
      expect(hero.badgeLabel).toBe("Some delays");
      expect(hero.description).toBe("2 stations missing recent observations");
    });

    it("returns stale status when fetchError is present", () => {
      const hero = resolveStatusHero(null, "Failed to connect", null);
      expect(hero.level).toBe("stale");
      expect(hero.heading).toBe("Price updates are delayed");
      expect(hero.badgeLabel).toBe("Delayed");
      expect(hero.description).toContain("Unable to reach data status service");
    });
  });

  describe("formatCollectionDuration", () => {
    it("formats duration in seconds to 1 decimal place", () => {
      expect(formatCollectionDuration(12430)).toBe("12.4s");
      expect(formatCollectionDuration(1500)).toBe("1.5s");
      expect(formatCollectionDuration(450)).toBe("0.5s");
    });

    it("handles null, undefined, or invalid durations gracefully", () => {
      expect(formatCollectionDuration(null)).toBe("—");
      expect(formatCollectionDuration(undefined)).toBe("—");
      expect(formatCollectionDuration(0)).toBe("—");
      expect(formatCollectionDuration(-100)).toBe("—");
    });
  });
});
