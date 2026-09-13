import { describe, expect, it } from "vitest";
import {
  calculateTrendDeltaCents,
  formatMoverCentChange,
  getTopHighestStates,
  getTopLowestStates,
  type StateSummaryItemLike,
  type TrendPointLike,
} from "../web/lib/analytics-view.js";

describe("Homepage Analytics Utilities", () => {
  describe("calculateTrendDeltaCents", () => {
    it("returns null when points array is missing or has fewer than 2 points", () => {
      expect(calculateTrendDeltaCents(null)).toBeNull();
      expect(calculateTrendDeltaCents([])).toBeNull();
      expect(
        calculateTrendDeltaCents([
          { date: "2026-09-01", medianPrice: "3.500", minPrice: "3.200", maxPrice: "3.800", stationCount: 200 },
        ])
      ).toBeNull();
    });

    it("calculates positive cent change when price increases", () => {
      const points: TrendPointLike[] = [
        { medianPrice: "3.849" },
        { medianPrice: "3.999" },
      ];
      expect(calculateTrendDeltaCents(points)).toBe(15);
    });

    it("calculates negative cent change when price drops", () => {
      const points: TrendPointLike[] = [
        { medianPrice: "4.119" },
        { medianPrice: "3.999" },
      ];
      expect(calculateTrendDeltaCents(points)).toBe(-12);
    });

    it("handles zero change cleanly", () => {
      const points: TrendPointLike[] = [
        { medianPrice: "3.999" },
        { medianPrice: "3.999" },
      ];
      expect(calculateTrendDeltaCents(points)).toBe(0);
    });
  });

  describe("State Rankings Preview", () => {
    const fixtureStates: StateSummaryItemLike[] = [
      { state: "IN", stationCount: 4, medianPrice: "3.399", minPrice: "3.399", maxPrice: "3.499" },
      { state: "OH", stationCount: 12, medianPrice: "3.459", minPrice: "3.429", maxPrice: "3.599" },
      { state: "VA", stationCount: 15, medianPrice: "3.529", minPrice: "3.459", maxPrice: "3.699" },
      { state: "NC", stationCount: 18, medianPrice: "3.599", minPrice: "3.499", maxPrice: "3.759" },
      { state: "FL", stationCount: 35, medianPrice: "3.649", minPrice: "3.499", maxPrice: "3.899" },
      { state: "MD", stationCount: 10, medianPrice: "3.729", minPrice: "3.619", maxPrice: "3.899" },
      { state: "PA", stationCount: 20, medianPrice: "3.849", minPrice: "3.699", maxPrice: "3.999" },
      { state: "NJ", stationCount: 22, medianPrice: "3.899", minPrice: "3.759", maxPrice: "4.099" },
      { state: "MA", stationCount: 25, medianPrice: "3.949", minPrice: "3.829", maxPrice: "4.199" },
      { state: "CT", stationCount: 14, medianPrice: "3.999", minPrice: "3.899", maxPrice: "4.249" },
      { state: "NY", stationCount: 40, medianPrice: "4.129", minPrice: "3.899", maxPrice: "4.549" },
    ];

    it("returns top 5 lowest priced states ascending", () => {
      const lowest = getTopLowestStates(fixtureStates, 5);
      expect(lowest).toHaveLength(5);
      expect(lowest.map((s) => s.state)).toEqual(["IN", "OH", "VA", "NC", "FL"]);
      expect(lowest[0]!.medianPrice).toBe("3.399");
    });

    it("returns top 5 highest priced states descending without duplicating lowest", () => {
      const highest = getTopHighestStates(fixtureStates, 5);
      expect(highest).toHaveLength(5);
      expect(highest.map((s) => s.state)).toEqual(["NY", "CT", "MA", "NJ", "PA"]);
      expect(highest[0]!.medianPrice).toBe("4.129");
    });

    it("handles fewer states than limit gracefully", () => {
      const fewStates: StateSummaryItemLike[] = [
        { state: "IN", stationCount: 4, medianPrice: "3.399", minPrice: "3.399", maxPrice: "3.499" },
        { state: "OH", stationCount: 12, medianPrice: "3.459", minPrice: "3.429", maxPrice: "3.599" },
      ];
      const lowest = getTopLowestStates(fewStates, 5);
      const highest = getTopHighestStates(fewStates, 5);
      expect(lowest).toHaveLength(2);
      expect(highest).toHaveLength(2);
    });
  });

  describe("formatMoverCentChange", () => {
    it("formats price drop with down arrow and negative cents", () => {
      const res = formatMoverCentChange("-0.290", true);
      expect(res.cents).toBe(-29);
      expect(res.display).toBe("↓ 29¢");
    });

    it("formats price increase with up arrow and positive cents", () => {
      const res = formatMoverCentChange("0.180", false);
      expect(res.cents).toBe(18);
      expect(res.display).toBe("↑ 18¢");
    });
  });
});
