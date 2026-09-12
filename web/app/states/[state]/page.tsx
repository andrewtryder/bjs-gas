import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumbs from "../../../components/Breadcrumbs";
import NationalTrendChart from "../../../components/NationalTrendChart";
import StateStationList from "../../../components/StateStationList";
import { getStations, getWebBaseUrl } from "../../../lib/api";
import { getNationalTrends, getStateSummaries } from "../../../lib/analytics";
import { getStateName, normalizeStateCode, toStateSlug } from "../../../lib/states";
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
    title: `BJ's Gas Prices in ${stateName} (${stateCode}) — Current Rates & Locations`,
    description: `Compare current regular fuel prices across BJ's Wholesale Club gas stations in ${stateName}. View live state medians, lowest prices, and local club station directories.`,
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

  const freshnessInfo = latestObservedAt ? getFreshnessInfo(latestObservedAt) : null;

  return (
    <div className="state-detail-page" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "States", href: "/states" },
          { label: stateName },
        ]}
      />

      <div
        className="page-intro"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "0.25rem",
            }}
          >
            <h1
              className="page-title"
              style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}
            >
              BJ&apos;s Gas Prices in {stateName}
            </h1>
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 700,
                color: "var(--primary)",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                padding: "0.2rem 0.5rem",
                borderRadius: "9999px",
              }}
            >
              {stateCode}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <p
              className="page-description"
              style={{ color: "var(--text-secondary)", fontSize: "1rem", margin: 0 }}
            >
              Live fuel rates and club gas locations across {stateName}.
            </p>
            {freshnessInfo && (
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${freshnessInfo.badgeClass}`}
                title={latestObservedAt ? `Last observed: ${new Date(latestObservedAt).toLocaleString()}` : undefined}
              >
                {freshnessInfo.relativeText} &bull; {freshnessInfo.label}
              </span>
            )}
          </div>
        </div>

        <Link
          href={`/map?state=${stateCode}`}
          className="filter-btn active"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <span>🗺️</span> View on Map
        </Link>
      </div>

      {/* Overview KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            State Median (Regular)
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 800, color: "var(--text)" }}>
            {stateSummary ? `$${stateSummary.medianPrice}` : "N/A"}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Calculated across {stateStations.length} locations
          </div>
        </div>

        {lowestStation && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Lowest in {stateCode}
            </div>
            <div style={{ fontSize: "1.875rem", fontWeight: 800, color: "var(--cheaper)" }}>
              ${lowestStation.price.toFixed(3)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {lowestStation.name} ({lowestStation.city})
            </div>
          </div>
        )}

        {highestStation && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Highest in {stateCode}
            </div>
            <div style={{ fontSize: "1.875rem", fontWeight: 800, color: "var(--expensive)" }}>
              ${highestStation.price.toFixed(3)}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {highestStation.name} ({highestStation.city})
            </div>
          </div>
        )}

        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            Reporting Gas Stations
          </div>
          <div style={{ fontSize: "1.875rem", fontWeight: 800, color: "var(--text)" }}>
            {stateStations.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Active BJ&apos;s fuel stations
          </div>
        </div>
      </div>

      {/* State Trend Chart */}
      {stateTrends && stateTrends.points.length > 0 && (
        <NationalTrendChart
          initialTrends={stateTrends}
          title={`${stateName} Unleaded Price Trend`}
          subtitle={`Daily median and price bounds for BJ's Wholesale Club gas stations in ${stateName}`}
        />
      )}

      {/* Searchable Station List */}
      <StateStationList stations={stateStations} stateCode={stateCode} />
    </div>
  );
}
