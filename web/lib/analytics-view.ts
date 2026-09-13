export interface TrendPointLike {
  medianPrice: string;
  date?: string;
  minPrice?: string;
  maxPrice?: string;
  stationCount?: number;
}

export interface StateSummaryItemLike {
  state: string;
  medianPrice: string;
  stationCount?: number;
  minPrice?: string;
  maxPrice?: string;
}

/**
 * Calculates the net change in cents between the earliest and latest points in a trend series.
 * Returns null if points array has fewer than 2 items or contains invalid numeric data.
 */
export function calculateTrendDeltaCents(
  points?: TrendPointLike[] | null
): number | null {
  if (!points || points.length < 2) return null;
  const startVal = Number.parseFloat(points[0]!.medianPrice);
  const endVal = Number.parseFloat(points[points.length - 1]!.medianPrice);
  if (!Number.isFinite(startVal) || !Number.isFinite(endVal)) {
    return null;
  }
  return Math.round((endVal - startVal) * 100);
}

/**
 * Returns the states with the lowest median prices, sorted ascending by price.
 */
export function getTopLowestStates<T extends StateSummaryItemLike>(
  states?: T[] | null,
  limit = 5
): T[] {
  if (!states || states.length === 0) return [];
  const valid = states.filter((s) => Number.isFinite(Number.parseFloat(s.medianPrice)));
  valid.sort((a, b) => Number.parseFloat(a.medianPrice) - Number.parseFloat(b.medianPrice));
  return valid.slice(0, limit);
}

/**
 * Returns the states with the highest median prices, sorted descending by price.
 * Excludes states already captured in the lowest set when sufficient states exist.
 */
export function getTopHighestStates<T extends StateSummaryItemLike>(
  states?: T[] | null,
  limit = 5
): T[] {
  if (!states || states.length === 0) return [];
  const lowest = getTopLowestStates(states, limit);
  const lowestCodes = new Set(lowest.map((s) => s.state));

  const valid = states.filter((s) => Number.isFinite(Number.parseFloat(s.medianPrice)));
  valid.sort((a, b) => Number.parseFloat(b.medianPrice) - Number.parseFloat(a.medianPrice));

  const candidates = valid.filter((s) => states.length <= limit || !lowestCodes.has(s.state));
  return candidates.slice(0, limit);
}

/**
 * Formats a mover absolute change string (e.g. "-0.290" or "0.180") into absolute cents and display string.
 */
export function formatMoverCentChange(
  changeStr: string,
  isDrop: boolean
): { cents: number; display: string } {
  const num = Number.parseFloat(changeStr.replace(/[^0-9.-]/g, ""));
  if (Number.isFinite(num)) {
    const absCents = Math.round(Math.abs(num) * 100);
    return {
      cents: isDrop ? -absCents : absCents,
      display: isDrop ? `\u2193 ${absCents}\u00A2` : `\u2191 ${absCents}\u00A2`,
    };
  }
  return {
    cents: 0,
    display: isDrop ? `\u2193 ${changeStr}` : `\u2191 ${changeStr}`,
  };
}
