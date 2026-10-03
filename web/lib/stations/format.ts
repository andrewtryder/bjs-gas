import type { StationDto } from "../types";
import { getFreshnessInfo } from "../freshness";
import { getCanonicalFuelPrices } from "./fuels";
import { getLatestObservation, formatMapFreshnessText } from "./observations";

/**
 * Computes a Set of normalized "city, state" keys that appear more than once in the collection.
 */
export function getCityStateCollisionKeys(stations: StationDto[]): Set<string> {
  const counts = new Map<string, number>();
  for (const s of stations) {
    if (s.city && s.state) {
      const key = `${s.city.toLowerCase().trim()}, ${s.state.toLowerCase().trim()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const collisions = new Set<string>();
  for (const [key, count] of counts.entries()) {
    if (count > 1) {
      collisions.add(key);
    }
  }
  return collisions;
}

/**
 * Formats a station display title.
 * When multiple stations share the same city and state, appends a compact qualifier `· #${clubNumber}`.
 */
export function formatStationTitle(
  station: StationDto,
  collisionKeys?: Set<string>,
): string {
  const base = `${station.city}, ${station.state}`;
  if (!collisionKeys) return base;
  const key = `${station.city.toLowerCase().trim()}, ${station.state.toLowerCase().trim()}`;
  if (collisionKeys.has(key)) {
    return `${base} · #${station.clubNumber}`;
  }
  return base;
}

export interface MapPopupFuelItem {
  name: string;
  price: string;
}

export interface MapPopupData {
  title: string;
  clubNumber: number;
  primaryPriceFormatted: string;
  primaryFuelName: string;
  secondaryFuels: MapPopupFuelItem[];
  freshnessText: string | null;
}

/**
 * Generates structured, normalized popup card data for MapLibre map popups.
 */
export function formatMapPopupData(
  station: StationDto,
  selectedFuelSku: string = "ALL",
  collisionKeys?: Set<string>,
  now: Date = new Date(),
): MapPopupData {
  const title = formatStationTitle(station, collisionKeys);
  const canonicalPrices = getCanonicalFuelPrices(station);
  const targetSku = selectedFuelSku.trim().toLowerCase();

  let primaryPriceFormatted = "—";
  let primaryFuelName = "Regular";
  const secondaryFuels: MapPopupFuelItem[] = [];

  if (targetSku === "4" || targetSku === "diesel") {
    primaryFuelName = "Diesel";
    primaryPriceFormatted = canonicalPrices.diesel.priceFormatted;
    if (canonicalPrices.regular.isAvailable) {
      secondaryFuels.push({ name: "Regular", price: canonicalPrices.regular.priceFormatted });
    }
    if (canonicalPrices.premium.isAvailable) {
      secondaryFuels.push({ name: "Premium", price: canonicalPrices.premium.priceFormatted });
    }
  } else if (targetSku === "3" || targetSku === "premium") {
    primaryFuelName = "Premium";
    primaryPriceFormatted = canonicalPrices.premium.priceFormatted;
    if (canonicalPrices.regular.isAvailable) {
      secondaryFuels.push({ name: "Regular", price: canonicalPrices.regular.priceFormatted });
    }
    if (canonicalPrices.diesel.isAvailable) {
      secondaryFuels.push({ name: "Diesel", price: canonicalPrices.diesel.priceFormatted });
    }
  } else {
    primaryFuelName = "Regular";
    primaryPriceFormatted = canonicalPrices.regular.priceFormatted;
    if (canonicalPrices.premium.isAvailable) {
      secondaryFuels.push({ name: "Premium", price: canonicalPrices.premium.priceFormatted });
    }
    if (canonicalPrices.diesel.isAvailable) {
      secondaryFuels.push({ name: "Diesel", price: canonicalPrices.diesel.priceFormatted });
    }
  }

  const latestObs = getLatestObservation(station);
  const freshnessInfo = latestObs ? getFreshnessInfo(latestObs, now) : null;
  const freshnessText = formatMapFreshnessText(freshnessInfo);

  return {
    title,
    clubNumber: station.clubNumber,
    primaryPriceFormatted,
    primaryFuelName,
    secondaryFuels,
    freshnessText,
  };
}
