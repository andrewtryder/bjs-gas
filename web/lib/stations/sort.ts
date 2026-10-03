import type { StationDto } from "../types";
import { getStationPrice } from "./fuels";
import { getLatestObservation } from "./observations";

export type StationSortOption =
  | "location-asc"
  | "price-asc"
  | "price-desc"
  | "updated-desc";

/**
 * Pure client-side sort function for stations.
 * - location-asc: sorts alphabetically by City, State, then name.
 * - price-asc: sorts by target fuel price low-to-high (missing prices sort last).
 * - price-desc: sorts by target fuel price high-to-low (missing prices sort last).
 * - updated-desc: sorts by latest fuel observation time (most recent first).
 */
export function sortStations(
  stations: StationDto[],
  sortOption: StationSortOption = "location-asc",
  targetFuelSku?: string,
): StationDto[] {
  const list = [...stations];

  switch (sortOption) {
    case "price-asc":
      return list.sort((a, b) => {
        const pA = getStationPrice(a, targetFuelSku).priceNumeric;
        const pB = getStationPrice(b, targetFuelSku).priceNumeric;
        if (pA === null && pB === null) {
          return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
        }
        if (pA === null) return 1;
        if (pB === null) return -1;
        if (pA !== pB) return pA - pB;
        return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
      });

    case "price-desc":
      return list.sort((a, b) => {
        const pA = getStationPrice(a, targetFuelSku).priceNumeric;
        const pB = getStationPrice(b, targetFuelSku).priceNumeric;
        if (pA === null && pB === null) {
          return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
        }
        if (pA === null) return 1;
        if (pB === null) return -1;
        if (pA !== pB) return pB - pA;
        return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
      });

    case "updated-desc":
      return list.sort((a, b) => {
        const tA = getLatestObservation(a);
        const tB = getLatestObservation(b);
        const timeA = tA ? new Date(tA).getTime() : null;
        const timeB = tB ? new Date(tB).getTime() : null;
        if (timeA === null && timeB === null) {
          return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
        }
        if (timeA === null) return 1;
        if (timeB === null) return -1;
        if (timeA !== timeB) return timeB - timeA;
        return `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
      });

    case "location-asc":
    default:
      return list.sort((a, b) => {
        const locA = `${a.city}, ${a.state}`;
        const locB = `${b.city}, ${b.state}`;
        const comp = locA.localeCompare(locB);
        if (comp !== 0) return comp;
        return a.name.localeCompare(b.name);
      });
  }
}
