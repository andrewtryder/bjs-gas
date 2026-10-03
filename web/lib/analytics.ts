import { getApiBaseUrl } from "./api";
import type {
  NationalSummaryResponse,
  NationalTrendsResponse,
  PriceMoversResponse,
  StateSummariesResponse,
} from "@bjs-gas/contracts";
export type {
  NationalSummaryResponse,
  NationalSummaryStation,
  NationalTrendsResponse,
  PriceMoverItem,
  PriceMoversResponse,
  StateSummariesResponse,
  StateSummaryItem,
  TrendPoint,
} from "@bjs-gas/contracts";

export async function getNationalSummary(fuelSku = "1"): Promise<NationalSummaryResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/analytics/summary?fuelSku=${encodeURIComponent(fuelSku)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch national summary: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getNationalTrends(
  days = 30,
  fuelSku = "1",
  state?: string,
): Promise<NationalTrendsResponse> {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams({
    days: String(days),
    fuelSku,
  });
  if (state) {
    query.set("state", state.trim().toUpperCase());
  }
  const res = await fetch(`${baseUrl}/api/v1/analytics/trends?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch trends: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getStateSummaries(fuelSku = "1"): Promise<StateSummariesResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/analytics/states?fuelSku=${encodeURIComponent(fuelSku)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch state summaries: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getPriceMovers(days = 7, fuelSku = "1"): Promise<PriceMoversResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/v1/analytics/movers?days=${days}&fuelSku=${encodeURIComponent(fuelSku)}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch price movers: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
