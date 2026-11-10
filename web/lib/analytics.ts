import { getApiBaseUrl, parseApiErrorMessage } from "./api";
import { fetchWithCache } from "./cache";
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
  return fetchWithCache(`analytics:summary:${fuelSku}`, 300, async () => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/analytics/summary?fuelSku=${encodeURIComponent(fuelSku)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(await parseApiErrorMessage(res, "Failed to fetch national summary"));
    }
    return res.json();
  });
}

export async function getNationalTrends(
  days = 30,
  fuelSku = "1",
  state?: string,
): Promise<NationalTrendsResponse> {
  const stateKey = state ? state.trim().toUpperCase() : "all";
  return fetchWithCache(`analytics:trends:${days}:${fuelSku}:${stateKey}`, 300, async () => {
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
      throw new Error(await parseApiErrorMessage(res, "Failed to fetch trends"));
    }
    return res.json();
  });
}

export async function getStateSummaries(fuelSku = "1"): Promise<StateSummariesResponse> {
  return fetchWithCache(`analytics:states:${fuelSku}`, 300, async () => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/analytics/states?fuelSku=${encodeURIComponent(fuelSku)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(await parseApiErrorMessage(res, "Failed to fetch state summaries"));
    }
    return res.json();
  });
}

export async function getPriceMovers(days = 7, fuelSku = "1"): Promise<PriceMoversResponse> {
  return fetchWithCache(`analytics:movers:${days}:${fuelSku}`, 300, async () => {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(
      `${baseUrl}/api/v1/analytics/movers?days=${days}&fuelSku=${encodeURIComponent(fuelSku)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      throw new Error(await parseApiErrorMessage(res, "Failed to fetch price movers"));
    }
    return res.json();
  });
}

