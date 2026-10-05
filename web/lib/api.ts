import webService from "../src/service";
import type {
  NearbyStationsResponse,
  StationDetailResponse,
  StationHistoryResponse,
  StationsResponse,
  SystemStatusResponse,
} from "./types";

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

export function getWebBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    "https://ejiib93jmwi0jbi4ui8598xn.ewr.prisma.build";
  return envUrl.endsWith("/") ? envUrl.slice(0, -1) : envUrl;
}

export async function parseApiErrorMessage(res: Response, fallbackPrefix: string): Promise<string> {
  const statusInfo = `${res.status} ${res.statusText}`.trim();
  let detail = "";
  try {
    const rawText = await res.text();
    if (rawText) {
      try {
        const json = JSON.parse(rawText);
        if (json && typeof json === "object") {
          const parts: string[] = [];
          if (json.code) parts.push(String(json.code));
          if (json.error) parts.push(String(json.error));
          if (json.reason) parts.push(String(json.reason));
          if (json.message) parts.push(String(json.message));
          detail = parts.join(": ");
        }
      } catch {
        const stripped = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (stripped) {
          detail = stripped.length > 120 ? `${stripped.slice(0, 117)}...` : stripped;
        }
      }
    }
  } catch {
    // Ignore response read errors
  }
  const detailSuffix = detail ? ` (${detail})` : "";
  return `${fallbackPrefix}: ${statusInfo}${detailSuffix}`;
}

export async function getStations(): Promise<StationsResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/stations`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await parseApiErrorMessage(res, `Failed to fetch stations from ${baseUrl}/api/v1/stations`),
    );
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
    throw new Error(
      await parseApiErrorMessage(res, `Failed to fetch station ${clubNumber}`),
    );
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
    throw new Error(
      await parseApiErrorMessage(res, `Failed to fetch history for station ${clubNumber}`),
    );
  }
  return res.json();
}

export async function getNearbyStations(
  clubNumber: number,
  limit = 5,
  miles?: number,
): Promise<NearbyStationsResponse | null> {
  const baseUrl = getApiBaseUrl();
  const query = new URLSearchParams({ limit: String(limit) });
  if (miles != null) {
    query.set("miles", String(miles));
  }
  const res = await fetch(`${baseUrl}/api/v1/stations/${clubNumber}/nearby?${query.toString()}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      await parseApiErrorMessage(res, `Failed to fetch nearby stations for ${clubNumber}`),
    );
  }
  return res.json();
}

export async function getSystemStatus(): Promise<SystemStatusResponse> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/v1/status`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      await parseApiErrorMessage(res, "Failed to fetch system status"),
    );
  }
  return res.json();
}



