import { describe, expect, it } from "vitest";
import {
  sortStates,
  filterStates,
  type StateSummaryItemLike,
} from "../web/lib/states-view.js";

describe("State Index Sorting & Comparison", () => {
  const mockStates: StateSummaryItemLike[] = [
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

  it("filters states by state code or full name", () => {
    const byCode = filterStates(mockStates, "ma");
    expect(byCode.map((s) => s.state)).toEqual(["MA"]);

    const byName = filterStates(mockStates, "florida");
    expect(byName.map((s) => s.state)).toEqual(["FL"]);

    const emptyFilter = filterStates(mockStates, "   ");
    expect(emptyFilter.length).toBe(4);

    const noMatch = filterStates(mockStates, "xyz");
    expect(noMatch.length).toBe(0);
  });
});
