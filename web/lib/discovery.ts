import type { StationDto, StationFuel } from "./types.js";
import { formatPrice } from "./stats.js";

/**
 * Deterministically identifies the primary/regular gasoline fuel item from a station's fuels array.
 * Priority:
 * 1. Exact SKU '1' (standard BJ's Unleaded SKU)
 * 2. Name containing 'unleaded' or 'regular' (case-insensitive)
 * 3. First available fuel in array
 */
export function getPrimaryFuel(fuels: StationFuel[] | null | undefined): StationFuel | null {
  if (!fuels || fuels.length === 0) return null;

  // 1. Look for canonical SKU 1
  const sku1 = fuels.find((f) => f.sku === "1");
  if (sku1) return sku1;

  // 2. Look for name matches (unleaded or regular)
  const nameMatch = fuels.find((f) => {
    const lower = f.name.toLowerCase();
    return lower.includes("unleaded") || lower.includes("regular");
  });
  if (nameMatch) return nameMatch;

  // 3. Fallback to first fuel
  return fuels[0] ?? null;
}

/**
 * Resolves the display price for a station given an optional target fuel SKU.
 * If fuelSku is 'ALL' or omitted, uses the primary/regular fuel.
 */
export function getStationPrice(
  station: StationDto,
  targetFuelSku?: string,
): {
  fuel: StationFuel | null;
  priceNumeric: number | null;
  priceFormatted: string;
  isAvailable: boolean;
} {
  let matchedFuel: StationFuel | null = null;

  if (targetFuelSku && targetFuelSku !== "ALL") {
    matchedFuel = station.fuels.find((f: StationFuel) => f.sku === targetFuelSku) || null;
  } else {
    matchedFuel = getPrimaryFuel(station.fuels);
  }

  if (!matchedFuel) {
    return {
      fuel: null,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }

  const numeric = Number.parseFloat(matchedFuel.price);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      fuel: matchedFuel,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }

  return {
    fuel: matchedFuel,
    priceNumeric: numeric,
    priceFormatted: formatPrice(numeric),
    isAvailable: true,
  };
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
 * Extracts distinct fuel types found across all stations.
 */
export function getAvailableFuels(
  stations: StationDto[],
): Array<{ sku: string; name: string; count: number }> {
  const map = new Map<string, { sku: string; name: string; count: number }>();
  for (const s of stations) {
    for (const f of s.fuels) {
      const existing = map.get(f.sku);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(f.sku, { sku: f.sku, name: f.name, count: 1 });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    // Sort SKU 1 first, then 3, 4, etc.
    const numA = Number.parseInt(a.sku, 10);
    const numB = Number.parseInt(b.sku, 10);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return a.sku.localeCompare(b.sku);
  });
}

export interface StationFilterOptions {
  query?: string;
  state?: string;
  fuelSku?: string;
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

    // 3. Search query filter
    if (query) {
      const matchesQuery =
        station.name.toLowerCase().includes(query) ||
        station.city.toLowerCase().includes(query) ||
        station.state.toLowerCase().includes(query) ||
        station.postalCode.toLowerCase().includes(query) ||
        String(station.clubNumber).includes(query);
      if (!matchesQuery) return false;
    }

    return true;
  });
}

export interface StationGeoJsonProperties {
  clubNumber: number;
  clubId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  priceFormatted: string;
  priceNumeric: number | null;
  fuelName: string;
  fuelSku: string;
  hasPrice: boolean;
  observedAt: string | null;
}

export interface StationGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: StationGeoJsonProperties;
}

export interface StationGeoJsonCollection {
  type: "FeatureCollection";
  features: StationGeoJsonFeature[];
}

/**
 * Converts stations to a GeoJSON FeatureCollection for MapLibre GL.
 * Strictly validates coordinates: lat must be between -90 and 90, lng between -180 and 180.
 * Any missing or invalid coordinates are safely omitted.
 */
export function stationsToGeoJson(
  stations: StationDto[],
  targetFuelSku?: string,
): StationGeoJsonCollection {
  const features: StationGeoJsonFeature[] = [];

  for (const s of stations) {
    const lat = s.latitude;
    const lng = s.longitude;

    if (
      lat === null ||
      lat === undefined ||
      lng === null ||
      lng === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      continue;
    }

    const priceInfo = getStationPrice(s, targetFuelSku);

    // Get latest observation timestamp for this station
    const latestObs =
      s.fuels.length > 0
        ? s.fuels.reduce((latest: string, f: StationFuel) =>
            new Date(f.observedAt) > new Date(latest) ? f.observedAt : latest,
          s.fuels[0]!.observedAt)
        : null;

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        clubNumber: s.clubNumber,
        clubId: s.clubId,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        postalCode: s.postalCode,
        priceFormatted: priceInfo.priceFormatted,
        priceNumeric: priceInfo.priceNumeric,
        fuelName: priceInfo.fuel?.name || "Fuel",
        fuelSku: priceInfo.fuel?.sku || "",
        hasPrice: priceInfo.isAvailable,
        observedAt: latestObs,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
