import Link from "next/link";
import { getStations } from "../lib/api";
import {
  getNationalSummary,
  getNationalTrends,
  getStateSummaries,
  getPriceMovers,
  type NationalSummaryResponse,
  type NationalTrendsResponse,
  type StateSummariesResponse,
  type PriceMoversResponse,
} from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import StationList from "../components/StationList";
import NationalTrendChart from "../components/NationalTrendChart";
import StateComparisonTable from "../components/StateComparisonTable";
import PriceMovers from "../components/PriceMovers";

import type { StationDto } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stations: StationDto[] = [];
  let summary: NationalSummaryResponse | null = null;
  let trends: NationalTrendsResponse | null = null;
  let statesData: StateSummariesResponse | null = null;
  let moversData: PriceMoversResponse | null = null;
  let fetchError: string | null = null;

  try {
    const [
      stationsRes,
      summaryRes,
      trendsRes,
      statesRes,
      moversRes,
    ] = await Promise.allSettled([
      getStations(),
      getNationalSummary("1"),
      getNationalTrends(30, "1"),
      getStateSummaries("1"),
      getPriceMovers(7, "1"),
    ]);

    if (stationsRes.status === "fulfilled") {
      stations = stationsRes.value.stations || [];
    } else {
      fetchError = stationsRes.reason instanceof Error ? stationsRes.reason.message : "Failed to load stations";
    }

    if (summaryRes.status === "fulfilled") {
      summary = summaryRes.value;
    }
    if (trendsRes.status === "fulfilled") {
      trends = trendsRes.value;
    }
    if (statesRes.status === "fulfilled") {
      statesData = statesRes.value;
    }
    if (moversRes.status === "fulfilled") {
      moversData = moversRes.value;
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load dashboard data";
  }

  return (
    <div>
      <section className="page-intro">
        <h1 className="page-title">BJ&apos;s Wholesale Club Gas Tracker</h1>
        <p className="page-description">
          Real-time gas prices, historical analytics, national trends, and interactive station discovery across BJ&apos;s clubs.
        </p>
      </section>

      {fetchError && (
        <div
          className="card"
          style={{
            marginBottom: "2rem",
            borderColor: "var(--expensive)",
            backgroundColor: "var(--expensive-bg)",
          }}
        >
          <h3 style={{ color: "var(--expensive)", marginBottom: "0.25rem" }}>
            Unable to load complete station data
          </h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
            {fetchError}
          </p>
        </div>
      )}

      {/* Map Callout Banner */}
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

      {/* National Summary Cards */}
      <section className="stats-grid">
        <div className="card">
          <div className="stat-label">National Median ({summary?.fuel.name || "Regular"})</div>
          <div className="stat-value">
            {summary?.medianPrice ? formatPrice(summary.medianPrice) : "—"}
          </div>
          <div className="stat-subtext">
            Across {summary?.stationCount ?? stations.length} reporting stations
          </div>
        </div>

        <div className="card stat-cheapest">
          <div className="stat-label" style={{ color: "var(--cheapest)" }}>
            Cheapest Station
          </div>
          <div className="stat-value" style={{ color: "var(--cheapest)" }}>
            {summary?.min ? formatPrice(summary.min.price) : "—"}
          </div>
          <div className="stat-subtext">
            {summary?.min ? (
              <Link
                href={`/stations/${summary.min.station.clubNumber}`}
                style={{
                  color: "var(--cheapest)",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                {summary.min.station.name} ({summary.min.station.state})
              </Link>
            ) : (
              "No price data available"
            )}
          </div>
        </div>

        <div className="card stat-expensive">
          <div className="stat-label" style={{ color: "var(--expensive)" }}>
            Highest Station
          </div>
          <div className="stat-value" style={{ color: "var(--expensive)" }}>
            {summary?.max ? formatPrice(summary.max.price) : "—"}
          </div>
          <div className="stat-subtext">
            {summary?.max ? (
              <Link
                href={`/stations/${summary.max.station.clubNumber}`}
                style={{
                  color: "var(--expensive)",
                  fontWeight: 600,
                  textDecoration: "underline",
                }}
              >
                {summary.max.station.name} ({summary.max.station.state})
              </Link>
            ) : (
              "No price data available"
            )}
          </div>
        </div>

        <div className="card">
          <div className="stat-label">Total Gas Clubs</div>
          <div className="stat-value">{stations.length}</div>
          <div className="stat-subtext">
            Active clubs with fuel facility
          </div>
        </div>
      </section>

      {/* National Historical Trend Chart */}
      {trends && trends.points.length > 0 && (
        <section>
          <NationalTrendChart initialTrends={trends} />
        </section>
      )}

      {/* Recent Price Movers */}
      {moversData && (moversData.increases.length > 0 || moversData.decreases.length > 0) && (
        <section>
          <PriceMovers movers={moversData} />
        </section>
      )}

      {/* State Price Rankings */}
      {statesData && statesData.states.length > 0 && (
        <section>
          <StateComparisonTable
            states={statesData.states}
            fuelName={statesData.fuel.name}
          />
        </section>
      )}

      {/* Station Directory */}
      <section>
        <h2 className="section-title">Gas Stations Directory</h2>
        <StationList stations={stations} />
      </section>
    </div>
  );
}
