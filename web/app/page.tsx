import Link from "next/link";
import { getStations } from "../lib/api";
import { calculateFuelStats, formatPrice } from "../lib/stats";
import StationList from "../components/StationList";

import type { StationDto } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stations: StationDto[] = [];
  let fetchError: string | null = null;

  try {
    const data = await getStations();
    stations = data.stations || [];
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load stations";
  }

  const stats = calculateFuelStats(stations);

  return (
    <div>
      <section className="page-intro">
        <h1 className="page-title">BJ&apos;s Wholesale Club Gas Prices</h1>
        <p className="page-description">
          Real-time gas prices, interactive station map, and historical price
          monitoring across BJ&apos;s fuel stations.
        </p>
      </section>

      {fetchError ? (
        <div
          className="card"
          style={{
            marginBottom: "2rem",
            borderColor: "var(--expensive)",
            backgroundColor: "var(--expensive-bg)",
          }}
        >
          <h3 style={{ color: "var(--expensive)", marginBottom: "0.25rem" }}>
            Unable to load station data
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            {fetchError}
          </p>
        </div>
      ) : (
        <>
          <section className="map-banner-card">
            <div className="map-banner-text">
              <h2 className="map-banner-title">Interactive Station Map</h2>
              <p className="map-banner-desc">
                Explore all {stations.length} locations across 20+ states with
                interactive clustering, live fuel pricing, and state filters.
              </p>
            </div>
            <Link href="/map" className="map-banner-btn">
              Open Map View &rarr;
            </Link>
          </section>

          <section className="stats-grid">
            <div className="card">
              <div className="stat-label">Total Gas Stations</div>
              <div className="stat-value">{stations.length}</div>
              <div className="stat-subtext">Active BJ&apos;s clubs with fuel</div>
            </div>

            <div className="card">
              <div className="stat-label">
                Median {stats?.fuelName || "Regular"} Price
              </div>
              <div className="stat-value">
                {stats?.medianPrice !== null && stats?.medianPrice !== undefined
                  ? formatPrice(stats.medianPrice)
                  : "—"}
              </div>
              <div className="stat-subtext">
                Across {stats?.stationsWithFuel ?? 0} reporting stations
              </div>
            </div>

            <div className="card stat-cheapest">
              <div className="stat-label" style={{ color: "var(--cheapest)" }}>
                Cheapest {stats?.fuelName || "Regular"}
              </div>
              <div className="stat-value" style={{ color: "var(--cheapest)" }}>
                {stats?.cheapestStation
                  ? formatPrice(stats.cheapestStation.price)
                  : "—"}
              </div>
              <div className="stat-subtext">
                {stats?.cheapestStation ? (
                  <Link
                    href={`/stations/${stats.cheapestStation.station.clubNumber}`}
                    style={{
                      color: "var(--cheapest)",
                      fontWeight: 600,
                      textDecoration: "underline",
                    }}
                  >
                    {stats.cheapestStation.station.name} (
                    {stats.cheapestStation.station.state})
                  </Link>
                ) : (
                  "No price data available"
                )}
              </div>
            </div>

            <div className="card stat-expensive">
              <div className="stat-label" style={{ color: "var(--expensive)" }}>
                Highest {stats?.fuelName || "Regular"}
              </div>
              <div className="stat-value" style={{ color: "var(--expensive)" }}>
                {stats?.mostExpensiveStation
                  ? formatPrice(stats.mostExpensiveStation.price)
                  : "—"}
              </div>
              <div className="stat-subtext">
                {stats?.mostExpensiveStation ? (
                  <Link
                    href={`/stations/${stats.mostExpensiveStation.station.clubNumber}`}
                    style={{
                      color: "var(--expensive)",
                      fontWeight: 600,
                      textDecoration: "underline",
                    }}
                  >
                    {stats.mostExpensiveStation.station.name} (
                    {stats.mostExpensiveStation.station.state})
                  </Link>
                ) : (
                  "No price data available"
                )}
              </div>
            </div>
          </section>

          <section>
            <h2 className="section-title">Gas Stations Directory</h2>
            <StationList stations={stations} />
          </section>
        </>
      )}
    </div>
  );
}
