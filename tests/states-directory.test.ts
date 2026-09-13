import { describe, expect, it } from "vitest";
import { getStateName } from "../web/lib/states.js";

interface StateSummaryItem {
  state: string;
  stationCount: number;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
}

function sortStates(
  states: StateSummaryItem[],
  sortBy: "price-asc" | "price-desc" | "name-asc" | "stations-desc"
): StateSummaryItem[] {
  return [...states].sort((a, b) => {
    const priceA = Number.parseFloat(a.medianPrice);
    const priceB = Number.parseFloat(b.medianPrice);

    switch (sortBy) {
      case "price-asc":
        return priceA - priceB;
      case "price-desc":
        return priceB - priceA;
      case "name-asc":
        return getStateName(a.state).localeCompare(getStateName(b.state));
      case "stations-desc":
        return b.stationCount - a.stationCount;
      default:
        return priceA - priceB;
    }
  });
}

describe("State Index Sorting & Comparison", () => {
  const mockStates: StateSummaryItem[] = [
    {
      state: "MA",
      stationCount: 26,
      medianPrice: "3.299",
      minPrice: "3.099",
      maxPrice: "3.499",
    },
    {
      state: "FL",
      stationCount: 35,
      medianPrice: "2.999",
      minPrice: "2.799",
      maxPrice: "3.199",
    },
    {
      state: "NY",
      stationCount: 42,
      medianPrice: "3.499",
      minPrice: "3.199",
      maxPrice: "3.799",
    },
    {
      state: "GA",
      stationCount: 15,
      medianPrice: "3.099",
      minPrice: "2.899",
      maxPrice: "3.299",
    },
  ];

  it("sorts by price low to high (default consumer comparison)", () => {
    const sorted = sortStates(mockStates, "price-asc");
    expect(sorted.map((s) => s.state)).toEqual(["FL", "GA", "MA", "NY"]);
  });

  it("sorts by price high to low", () => {
    const sorted = sortStates(mockStates, "price-desc");
    expect(sorted.map((s) => s.state)).toEqual(["NY", "MA", "GA", "FL"]);
  });

  it("sorts by state name alphabetically", () => {
    const sorted = sortStates(mockStates, "name-asc");
    // Florida (FL), Georgia (GA), Massachusetts (MA), New York (NY)
    expect(sorted.map((s) => s.state)).toEqual(["FL", "GA", "MA", "NY"]);
  });

  it("sorts by station count descending (most locations)", () => {
    const sorted = sortStates(mockStates, "stations-desc");
    expect(sorted.map((s) => s.state)).toEqual(["NY", "FL", "MA", "GA"]);
  });
});
