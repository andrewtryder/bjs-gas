import type { Metadata } from "next";
import { getStations } from "../../lib/api";
import type { StationDto } from "../../lib/types";
import MapDiscoveryView from "../../components/MapDiscoveryView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Interactive Gas Station Map | BJ's Gas Prices",
  description:
    "Explore BJ's Wholesale Club gas station locations, live fuel prices, and regional coverage across 200+ clubs.",
};

export default async function MapPage() {
  let stations: StationDto[] = [];
  let fetchError: string | null = null;

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
        <h1 className="page-title">Interactive Gas Station Map</h1>
        <p className="page-description">
          Browse real-time fuel prices and explore BJ&apos;s Wholesale Club gas station
          locations across 20+ states.
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
        <MapDiscoveryView stations={stations} />
      )}
    </div>
  );
}
