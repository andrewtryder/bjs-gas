import type { Metadata } from "next";
import { getStations } from "../../lib/api";
import { getCartoApiKey } from "../../lib/config";
import type { StationDto } from "../../lib/types";
import MapDiscoveryView from "../../components/MapDiscoveryView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BJ's Gas Station Map | BJ's Gas Prices",
  description:
    "Find BJ's gas stations and current fuel prices across the U.S. Updated hourly.",
};

interface MapPageProps {
  searchParams?: Promise<{ state?: string; station?: string }>;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  let stations: StationDto[] = [];
  let fetchError: string | null = null;
  const cartoApiKey = getCartoApiKey();

  const resolvedParams = searchParams ? await searchParams : {};
  const initialState = resolvedParams.state ? resolvedParams.state.trim().toUpperCase() : undefined;
  const initialStation = resolvedParams.station ? Number.parseInt(resolvedParams.station, 10) : undefined;

  try {
    const data = await getStations();
    stations = data.stations || [];
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load station locations";
  }

  return (
    <div className="map-page-wrapper">
      <div className="page-intro" style={{ marginBottom: "1.25rem" }}>
        <h1 className="page-title">BJ&apos;s gas station map</h1>
        <p className="page-description">
          Find BJ&apos;s gas stations and current fuel prices across the U.S. Updated hourly.
        </p>
      </div>

      {fetchError ? (
        <div
          className="card"
          style={{
            borderColor: "var(--expensive)",
            backgroundColor: "var(--expensive-bg)",
          }}
        >
          <h3 style={{ color: "var(--expensive)", marginBottom: "0.25rem" }}>
            Unable to load map data
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            {fetchError}
          </p>
        </div>
      ) : (
        <MapDiscoveryView
          stations={stations}
          initialState={initialState}
          initialStationNumber={Number.isFinite(initialStation) ? initialStation : undefined}
          cartoApiKey={cartoApiKey}
        />
      )}
    </div>
  );
}
