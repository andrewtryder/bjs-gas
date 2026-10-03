import type { StationDto, StationFuel } from "../types";
import type { FreshnessInfo } from "../freshness";

/**
 * Extracts the latest observedAt ISO timestamp from a station's fuels array.
 */
export function getLatestObservation(station: StationDto): string | null {
  if (!station.fuels || station.fuels.length === 0) return null;
  return station.fuels.reduce((latest: string | null, f: StationFuel) => {
    if (!latest) return f.observedAt;
    return new Date(f.observedAt).getTime() > new Date(latest).getTime()
      ? f.observedAt
      : latest;
  }, null);
}

/**
 * Formats station freshness text according to Ledger Slate rules:
 * - Fresh (<= 2h): "Updated 17m ago"
 * - Aging (2-6h): "Updated 4h ago · Aging"
 * - Stale (> 6h): "Updated 9h ago · Stale"
 * No decorative healthy "Fresh" badge.
 */
export function formatMapFreshnessText(freshness: FreshnessInfo | null): string | null {
  if (!freshness) return null;
  if (freshness.level === "aging") {
    return `${freshness.relativeText} · Aging`;
  }
  if (freshness.level === "stale") {
    return `${freshness.relativeText} · Stale`;
  }
  return freshness.relativeText;
}
