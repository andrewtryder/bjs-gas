import type { StationDto, StationFuel } from "../types";

export interface StationFilterOptions {
  query?: string;
  state?: string;
  fuelSku?: string;
}

/**
 * Extracts and sorts unique state codes present in the station list, with counts.
 */
export function getAvailableStates(
  stations: StationDto[],
): Array<{ state: string; count: number }> {
  const counts = new Map<string, number>();
  for (const station of stations) {
    if (station.state) {
      const stateCode = station.state.toUpperCase().trim();
      counts.set(stateCode, (counts.get(stateCode) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => a.state.localeCompare(b.state));
}

/**
 * Tests whether a station matches a text search query across:
 * name, city, state, postalCode, clubNumber.
 */
export function matchesStationQuery(station: StationDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    station.name.toLowerCase().includes(q) ||
    station.city.toLowerCase().includes(q) ||
    station.state.toLowerCase().includes(q) ||
    station.postalCode.toLowerCase().includes(q) ||
    String(station.clubNumber).includes(q)
  );
}

/**
 * Unified filter function shared by the map and station directory list.
 */
export function filterStations(
  stations: StationDto[],
  filters: StationFilterOptions,
): StationDto[] {
  const query = (filters.query || "").trim().toLowerCase();
  const state = (filters.state || "").trim().toUpperCase();
  const fuelSku = filters.fuelSku || "ALL";

  return stations.filter((station) => {
    // 1. State filter
    if (state && state !== "ALL" && station.state.toUpperCase() !== state) {
      return false;
    }

    // 2. Fuel availability filter
    if (fuelSku && fuelSku !== "ALL") {
      const hasFuel = station.fuels.some((f: StationFuel) => {
        if (f.sku !== fuelSku) return false;
        const p = Number.parseFloat(f.price);
        return Number.isFinite(p) && p > 0;
      });
      if (!hasFuel) return false;
    }

    // 3. Search query filter (matches name, city, state, postalCode, clubNumber)
    if (query && !matchesStationQuery(station, query)) {
      return false;
    }

    return true;
  });
}
