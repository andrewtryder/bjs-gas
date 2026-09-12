import { getApiBaseUrl } from "./api";

export interface NationalSummaryStation {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
}

export interface NationalSummaryResponse {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  stationCount: number;
  medianPrice: string | null;
  min: {
    price: string;
    station: NationalSummaryStation;
  } | null;
  max: {
    price: string;
    station: NationalSummaryStation;
  } | null;
}

export interface TrendPoint {
  date: string;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
  stationCount: number;
}

export interface NationalTrendsResponse {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  days: number;
  points: TrendPoint[];
}

export interface StateSummaryItem {
  state: string;
  stationCount: number;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
}

export interface StateSummariesResponse {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  states: StateSummaryItem[];
}

export interface PriceMoverItem {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
  fuel: {
    sku: string;
    name: string;
  };
  startingPrice: string;
  currentPrice: string;
  absoluteChange: string;
  percentageChange: string;
  startObservedAt: string;
  currentObservedAt: string;
}

export interface PriceMoversResponse {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  days: number;
  increases: PriceMoverItem[];
  decreases: PriceMoverItem[];
}

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

export async function getNationalTrends(days = 30, fuelSku = "1"): Promise<NationalTrendsResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/v1/analytics/trends?days=${days}&fuelSku=${encodeURIComponent(fuelSku)}`,
    {
      cache: "no-store",
    },
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch national trends: ${res.status} ${res.statusText}`);
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
