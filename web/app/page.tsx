import Link from "next/link";
import { getStations, getSystemStatus, getWebBaseUrl } from "../lib/api";
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
import { getFreshnessInfo } from "../lib/freshness";
import StationList from "../components/StationList";
import NationalTrendChart from "../components/NationalTrendChart";
import StatePricePreview from "../components/StatePricePreview";
import PriceMovers from "../components/PriceMovers";
import SectionHeader from "../components/ui/SectionHeader";

import type { StationDto, SystemStatusResponse } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let stations: StationDto[] = [];
  let summary: NationalSummaryResponse | null = null;
  let trends: NationalTrendsResponse | null = null;
  let statesData: StateSummariesResponse | null = null;
  let moversData: PriceMoversResponse | null = null;
  let systemStatus: SystemStatusResponse | null = null;
  let fetchError: string | null = null;

  try {
    const [
      stationsRes,
      summaryRes,
      trendsRes,
      statesRes,
      moversRes,
      statusRes,
    ] = await Promise.allSettled([
      getStations(),
      getNationalSummary("1"),
      getNationalTrends(30, "1"),
      getStateSummaries("1"),
      getPriceMovers(7, "1"),
      getSystemStatus(),
    ]);

    if (stationsRes.status === "fulfilled") {
      stations = stationsRes.value.stations || [];
    } else {
      fetchError =
        stationsRes.reason instanceof Error
          ? stationsRes.reason.message
          : "Failed to load stations";
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
    if (statusRes.status === "fulfilled") {
      systemStatus = statusRes.value;
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load data";
  }

  const latestObservedAt = systemStatus?.freshness?.latestObservedAt;
  const freshnessInfo = latestObservedAt ? getFreshnessInfo(latestObservedAt) : null;

  // Derive 30-day delta from existing trends data if available
  let delta30d: { text: string; isFavorable: boolean; isUnfavorable: boolean } | null = null;
  if (trends && trends.points.length >= 2) {
    const startVal = Number.parseFloat(trends.points[0]!.medianPrice);
    const endVal = Number.parseFloat(trends.points[trends.points.length - 1]!.medianPrice);
    if (Number.isFinite(startVal) && Number.isFinite(endVal)) {
      const diff = endVal - startVal;
      const cents = Math.round(diff * 100);
      if (cents > 0) {
        delta30d = { text: `+${cents}¢ over 30 days`, isFavorable: false, isUnfavorable: true };
      } else if (cents < 0) {
        delta30d = { text: `${cents}¢ over 30 days`, isFavorable: true, isUnfavorable: false };
      } else {
        delta30d = { text: "No change over 30 days", isFavorable: false, isUnfavorable: false };
      }
    }
  }

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BJ's gas prices",
    url: getWebBaseUrl(),
    description:
      "Current BJ's gas prices, price history, and locations across the U.S. Updated hourly.",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${getWebBaseUrl()}/map?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <div className="homepage-content">
      {/* Schema.org WebSite Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <div className="hero-badge-row">
            {freshnessInfo && (
              <Link
                href="/status"
                className={`hero-freshness-pill ${freshnessInfo.badgeClass}`}
                title="Data status"
              >
                <span className="status-dot-sm" aria-hidden="true" />
                <span>Updated hourly &bull; {freshnessInfo.relativeText}</span>
              </Link>
            )}
          </div>

          <h1 className="hero-title">BJ&apos;s gas prices</h1>
          <p className="hero-subtitle">
            Current BJ&apos;s gas prices, price history, and locations across the U.S. Updated hourly.
          </p>

          <div className="hero-actions">
            <a href="#stations" className="btn btn-primary">
              Find a station
            </a>
            <Link href="/map" className="btn btn-secondary">
              View map
            </Link>
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="notice-banner notice-banner-error" role="alert">
          <p className="notice-title">Unable to load complete gas price data</p>
          <p className="notice-message">{fetchError}</p>
        </div>
      )}

      {/* National Summary Section: Price-First Hierarchy */}
      <section className="national-summary-section" aria-label="National gas price summary">
        <div className="national-median-block">
          <span className="national-median-label">National median</span>
          <div className="national-median-value-row">
            <span className="national-median-price tabular-nums">
              {summary?.medianPrice ? formatPrice(summary.medianPrice) : "—"}
            </span>
            {delta30d && (
              <span
                className={`national-median-delta ${
                  delta30d.isFavorable
                    ? "text-cheaper"
                    : delta30d.isUnfavorable
                    ? "text-higher"
                    : "text-muted"
                }`}
              >
                {delta30d.text}
              </span>
            )}
          </div>
          <span className="national-median-fuel">
            Regular unleaded across {summary?.stationCount ?? stations.length} stations
          </span>
        </div>

        {/* Subordinate secondary metrics */}
        <div className="supporting-metrics-grid">
          {/* Lowest */}
          <div className="supporting-metric-item">
            <span className="supporting-metric-label">Lowest price</span>
            <span className="supporting-metric-value tabular-nums text-cheaper">
              {summary?.min ? formatPrice(summary.min.price) : "—"}
            </span>
            <div className="supporting-metric-subtext">
              {summary?.min ? (
                <Link
                  href={`/stations/${summary.min.station.clubNumber}`}
                  className="supporting-metric-link"
                >
                  {summary.min.station.name} ({summary.min.station.state})
                </Link>
              ) : (
                "No price reported"
              )}
            </div>
          </div>

          {/* Highest */}
          <div className="supporting-metric-item">
            <span className="supporting-metric-label">Highest price</span>
            <span className="supporting-metric-value tabular-nums text-higher">
              {summary?.max ? formatPrice(summary.max.price) : "—"}
            </span>
            <div className="supporting-metric-subtext">
              {summary?.max ? (
                <Link
                  href={`/stations/${summary.max.station.clubNumber}`}
                  className="supporting-metric-link"
                >
                  {summary.max.station.name} ({summary.max.station.state})
                </Link>
              ) : (
                "No price reported"
              )}
            </div>
          </div>

          {/* Locations */}
          <div className="supporting-metric-item">
            <span className="supporting-metric-label">Locations tracked</span>
            <span className="supporting-metric-value tabular-nums">
              {stations.length}
            </span>
            <div className="supporting-metric-subtext">
              BJ&apos;s clubs with fuel stations
            </div>
          </div>
        </div>
      </section>

      {/* Historical Trend Section */}
      {trends && trends.points.length > 0 && (
        <section className="section-block">
          <NationalTrendChart initialTrends={trends} />
        </section>
      )}

      {/* Price Movers Section */}
      {moversData &&
        (moversData.increases.length > 0 || moversData.decreases.length > 0) && (
          <section className="section-block">
            <PriceMovers movers={moversData} />
          </section>
        )}

      {/* State Price Preview */}
      {statesData && statesData.states.length > 0 && (
        <section className="section-block">
          <StatePricePreview
            states={statesData.states}
            fuelName={statesData.fuel.name}
          />
        </section>
      )}

      {/* Find a Station Section */}
      <section id="stations" className="section-block station-directory-section">
        <SectionHeader
          title="Find a station"
          subtitle={`Browse all ${stations.length} BJ's gas stations with current fuel prices`}
        />
        <StationList stations={stations} />
      </section>
    </div>
  );
}
