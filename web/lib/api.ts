import webService from "../src/service";
import type { StationDetailResponse, StationHistoryResponse, StationsResponse } from "./types";

export function getApiBaseUrl(): string {
  try {
    const { api } = webService.load();
    if (api?.url) {
      return api.url.endsWith("/") ? api.url.slice(0, -1) : api.url;
    }
  } catch {
    // Outside Composer runtime (e.g. Next dev or build)
  }
  const envUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
}

export async function getStations(): Promise<StationsResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/stations`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch stations from ${baseUrl}/api/v1/stations: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getStation(clubNumber: number): Promise<StationDetailResponse | null> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/stations/${clubNumber}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch station ${clubNumber}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getStationHistory(clubNumber: number, limit = 100): Promise<StationHistoryResponse | null> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/stations/${clubNumber}/history?limit=${limit}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch history for station ${clubNumber}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
