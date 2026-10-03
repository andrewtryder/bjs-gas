import type {
  NationalSummaryResponse,
  NationalTrendsResponse,
  PriceMoversResponse,
  StateSummariesResponse,
} from "@bjs-gas/contracts";

export type {
  NationalSummaryStation,
  PriceMoverItem,
  StateSummaryItem,
  TrendPoint,
} from "@bjs-gas/contracts";

export { CANONICAL_FUEL_SKU } from "./fuel-info.js";
export { getNationalSummary } from "./national-summary.js";
export { getNationalTrends } from "./trends.js";
export { getStateSummaries } from "./state-summary.js";
export { getPriceMovers } from "./movers.js";

export type NationalSummaryResult = NationalSummaryResponse;
export type NationalTrendsResult = NationalTrendsResponse;
export type StateSummariesResult = StateSummariesResponse;
export type PriceMoversResult = PriceMoversResponse;
