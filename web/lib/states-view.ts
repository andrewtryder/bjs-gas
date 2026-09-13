import { getStateName } from "./states.js";

export type StateSortOption = "price-asc" | "price-desc" | "name-asc" | "stations-desc";

export interface StateSummaryItemLike {
  state: string;
  stationCount: number;
  medianPrice: string;
  minPrice?: string;
  maxPrice?: string;
}

/**
 * Sorts state summary items according to the selected criterion.
 */
export function sortStates<T extends StateSummaryItemLike>(
  states: T[],
  sortBy: StateSortOption = "price-asc"
): T[] {
  return [...states].sort((a, b) => {
    const priceA = Number.parseFloat(a.medianPrice);
    const priceB = Number.parseFloat(b.medianPrice);

    switch (sortBy) {
      case "price-asc":
        return priceA - priceB;
      case "price-desc":
        return priceB - priceA;
      case "name-asc": {
        const nameA = getStateName(a.state);
        const nameB = getStateName(b.state);
        return nameA.localeCompare(nameB);
      }
      case "stations-desc":
        return b.stationCount - a.stationCount;
      default:
        return priceA - priceB;
    }
  });
}

/**
 * Filters state summary items by query against state code or full state name.
 */
export function filterStates<T extends StateSummaryItemLike>(
  states: T[],
  query: string
): T[] {
  const q = query.toLowerCase().trim();
  if (!q) return [...states];

  return states.filter((item) => {
    const fullName = getStateName(item.state).toLowerCase();
    const code = item.state.toLowerCase();
    return fullName.includes(q) || code.includes(q);
  });
}
