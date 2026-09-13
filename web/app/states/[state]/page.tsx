import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "../../../components/Breadcrumbs";
import NationalTrendChart from "../../../components/NationalTrendChart";
import StateStationList from "../../../components/StateStationList";
import { getStations, getWebBaseUrl } from "../../../lib/api";
import { getNationalTrends, getStateSummaries } from "../../../lib/analytics";
import { getStateName, normalizeStateCode, toStateSlug } from "../../../lib/states";
import { formatPrice } from "../../../lib/stats";
import { getFreshnessInfo } from "../../../lib/freshness";

export const dynamic = "force-dynamic";

interface StatePageProps {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({ params }: StatePageProps): Promise<Metadata> {
  const resolved = await params;
  const stateCode = normalizeStateCode(resolved.state);
  const stateName = getStateName(stateCode);

  return {
    title: `${stateName} Gas Prices — Current BJ's Rates & Locations`,
    description: `Current BJ's gas prices across ${stateName} locations. Compare state medians, lowest gas rates, and find local club stations. Updated hourly.`,
    alternates: {
      canonical: `${getWebBaseUrl()}/states/${toStateSlug(stateCode)}`,
    },
  };
}

export default async function StateDetailPage({ params }: StatePageProps) {
  const resolved = await params;
  const stateCode = normalizeStateCode(resolved.state);
  const stateName = getStateName(stateCode);

  const [stationsRes, stateSummariesRes, trendsRes] = await Promise.allSettled([
    getStations(),
    getStateSummaries("1"),
    getNationalTrends(30, "1", stateCode),
  ]);

  if (stationsRes.status !== "fulfilled") {
    throw new Error("Failed to load station data");
  }

  const allStations = stationsRes.value.stations || [];
  const stateStations = allStations.filter((s) => s.state === stateCode);

  // If no gas stations exist in this state, return 404
  if (stateStations.length === 0) {
    notFound();
  }

  const stateSummaries = stateSummariesRes.status === "fulfilled" ? stateSummariesRes.value : null;
  const stateTrends = trendsRes.status === "fulfilled" ? trendsRes.value : null;

  // Find state summary info
  const stateSummary = stateSummaries?.states.find((s) => s.state === stateCode);

  // Calculate lowest and highest station in state, and find latest observation
  let lowestStation: { name: string; city: string; price: number } | null = null;
  let highestStation: { name: string; city: string; price: number } | null = null;
  let latestObservedAt: string | null = null;

  for (const s of stateStations) {
    for (const f of s.fuels) {
      if (!latestObservedAt || f.observedAt > latestObservedAt) {
        latestObservedAt = f.observedAt;
      }
    }
    const regularFuel = s.fuels.find((f) => f.sku === "1");
    if (!regularFuel) continue;
    const p = Number.parseFloat(regularFuel.price);
    if (!Number.isFinite(p)) continue;

    if (!lowestStation || p < lowestStation.price) {
      lowestStation = { name: s.name, city: s.city, price: p };
    }
    if (!highestStation || p > highestStation.price) {
      highestStation = { name: s.name, city: s.city, price: p };
    }
  }

  const freshness = getFreshnessInfo(latestObservedAt);

  return (
    <div className="state-detail-page">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "States", href: "/states" },
          { label: stateName },
        ]}
      />

      {/* State Hero Card */}
      <div className="state-hero-card">
        <div className="state-hero-header">
          <div>
            <h1 className="state-hero-title">
              {stateName} gas prices
            </h1>
            <p className="state-hero-subtitle">
              Current BJ&apos;s gas prices across {stateStations.length} {stateName} locations.
            </p>
          </div>

          <Link
            href={`/map?state=${stateCode}`}
            className="btn btn-primary"
          >
            <span>🗺️</span> View {stateName} on map
          </Link>
        </div>

        {/* State Median & Overview Grid */}
        <div className="state-hero-metrics">
          <div className="state-median-block">
            <div className="state-median-price tabular-nums">
              {stateSummary?.medianPrice ? `$${stateSummary.medianPrice}` : "—"}
            </div>
            <div className="state-median-label">State median (Regular)</div>
            <div
              className="state-median-freshness"
              title={latestObservedAt ? `Exact time: ${new Date(latestObservedAt).toLocaleString()}` : undefined}
            >
              {freshness.relativeText}
              {freshness.level === "aging" && (
                <span className="directory-freshness-tag aging"> &bull; Aging</span>
              )}
              {freshness.level === "stale" && (
                <span className="directory-freshness-tag stale"> &bull; Stale</span>
              )}
            </div>
          </div>

          <div className="state-kpi-grid">
            <div className="state-kpi-item">
              <span className="state-kpi-label">Lowest</span>
              <span className="state-kpi-value text-cheaper tabular-nums">
                {lowestStation ? formatPrice(lowestStation.price) : "—"}
              </span>
              <span className="state-kpi-subtext">
                {lowestStation ? lowestStation.city : "None"}
              </span>
            </div>

            <div className="state-kpi-item">
              <span className="state-kpi-label">Highest</span>
              <span className="state-kpi-value tabular-nums">
                {highestStation ? formatPrice(highestStation.price) : "—"}
              </span>
              <span className="state-kpi-subtext">
                {highestStation ? highestStation.city : "None"}
              </span>
            </div>

            <div className="state-kpi-item">
              <span className="state-kpi-label">Locations</span>
              <span className="state-kpi-value tabular-nums">
                {stateStations.length}
              </span>
              <span className="state-kpi-subtext">Active stations</span>
            </div>
          </div>
        </div>
      </div>

      {/* State Trend Chart */}
      {stateTrends && stateTrends.points.length > 0 && (
        <section className="state-chart-section" style={{ marginTop: "2rem" }}>
          <NationalTrendChart
            initialTrends={stateTrends}
            title={`${stateName} price trend`}
            subtitle={`Daily median and price bounds for BJ's gas stations in ${stateName}`}
          />
        </section>
      )}

      {/* Searchable Station Directory */}
      <StateStationList stations={stateStations} stateCode={stateCode} />
    </div>
  );
}
