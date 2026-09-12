import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStation, getStationHistory, getNearbyStations, getWebBaseUrl } from "../../../lib/api";
import { getNationalSummary, getStateSummaries } from "../../../lib/analytics";
import { formatDate, formatPrice } from "../../../lib/stats";
import { getStateName, toStateSlug } from "../../../lib/states";
import PriceHistoryChart from "../../../components/PriceHistoryChart";
import Breadcrumbs from "../../../components/Breadcrumbs";
import NearbyStations from "../../../components/NearbyStations";

export const dynamic = "force-dynamic";

interface StationPageProps {
  params: Promise<{ clubNumber: string }>;
}

export async function generateMetadata({ params }: StationPageProps): Promise<Metadata> {
  const resolved = await params;
  const clubNumber = Number.parseInt(resolved.clubNumber, 10);
  if (!Number.isFinite(clubNumber)) {
    return { title: "BJ's Gas Station" };
  }

  const stationData = await getStation(clubNumber).catch(() => null);
  const station = stationData?.station;

  if (!station) {
    return { title: "Station Not Found | BJ's Gas Prices" };
  }

  return {
    title: `BJ's Gas Price in ${station.city}, ${station.state} — Current & Historical Rates`,
    description: `Live fuel prices for BJ's Wholesale Club #${station.clubNumber} in ${station.city}, ${station.state}. Compare regular unleaded rates, station price history, and nearby club prices.`,
    alternates: {
      canonical: `${getWebBaseUrl()}/stations/${station.clubNumber}`,
    },
  };
}

export default async function StationDetailPage({ params }: StationPageProps) {
  const resolvedParams = await params;
  const clubNumber = Number.parseInt(resolvedParams.clubNumber, 10);

  if (!Number.isFinite(clubNumber)) {
    notFound();
  }

  const [stationData, historyData, nationalSummaryRes, stateSummariesRes, nearbyData] =
    await Promise.allSettled([
      getStation(clubNumber),
      getStationHistory(clubNumber),
      getNationalSummary("1"),
      getStateSummaries("1"),
      getNearbyStations(clubNumber, 5),
    ]);

  if (stationData.status !== "fulfilled" || !stationData.value?.station) {
    notFound();
  }

  const station = stationData.value.station;
  const history =
    historyData.status === "fulfilled" && historyData.value
      ? historyData.value.history || []
      : [];
  const nationalSummary = nationalSummaryRes.status === "fulfilled" ? nationalSummaryRes.value : null;
  const stateSummaries = stateSummariesRes.status === "fulfilled" ? stateSummariesRes.value : null;
  const nearby = nearbyData.status === "fulfilled" && nearbyData.value ? nearbyData.value.nearby : [];

  // Regular fuel comparison
  const regularFuel = station.fuels.find((f) => f.sku === "1");
  const regularPrice = regularFuel ? Number.parseFloat(regularFuel.price) : null;

  let nationalDiffStr: string | null = null;
  let nationalIsCheaper = false;
  if (regularPrice !== null && nationalSummary?.medianPrice) {
    const natMed = Number.parseFloat(nationalSummary.medianPrice);
    if (Number.isFinite(natMed)) {
      const diff = regularPrice - natMed;
      nationalIsCheaper = diff <= 0;
      nationalDiffStr = (diff >= 0 ? "+" : "") + diff.toFixed(3);
    }
  }

  let stateDiffStr: string | null = null;
  let stateIsCheaper = false;
  const stateData = stateSummaries?.states.find((s) => s.state === station.state);
  if (regularPrice !== null && stateData?.medianPrice) {
    const stMed = Number.parseFloat(stateData.medianPrice);
    if (Number.isFinite(stMed)) {
      const diff = regularPrice - stMed;
      stateIsCheaper = diff <= 0;
      stateDiffStr = (diff >= 0 ? "+" : "") + diff.toFixed(3);
    }
  }

  const stateName = getStateName(station.state);
  const stateSlug = toStateSlug(station.state);

  // Structured Data (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GasStation",
    name: `BJ's Gas - ${station.name}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: station.address,
      addressLocality: station.city,
      addressRegion: station.state,
      postalCode: station.postalCode,
      addressCountry: "US",
    },
    ...(station.latitude && station.longitude
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: station.latitude,
            longitude: station.longitude,
          },
        }
      : {}),
  };

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "States", href: "/states" },
          { label: stateName, href: `/states/${stateSlug}` },
          { label: station.name },
        ]}
      />

      <div className="station-header" style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "1rem",
            marginBottom: "0.5rem",
          }}
        >
          <div>
            <h1 className="page-title" style={{ margin: "0 0 0.25rem" }}>
              {station.name}
            </h1>
            <p className="detail-address" style={{ margin: "0 0 0.25rem" }}>
              {station.address} &bull; {station.city}, {station.state} {station.postalCode}
            </p>
            <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Club #{station.clubNumber} &bull; {station.storeType || "Standard Club"}
            </div>
          </div>

          <Link
            href={`/map?station=${station.clubNumber}`}
            className="filter-btn active"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <span>🗺️</span> View on Map
          </Link>
        </div>

        {/* Analytics Context Badges */}
        {(nationalDiffStr || stateDiffStr) && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            {nationalDiffStr && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: nationalIsCheaper ? "var(--cheapest-bg)" : "var(--expensive-bg)",
                  color: nationalIsCheaper ? "var(--cheapest)" : "var(--expensive)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {nationalDiffStr} vs National Median
              </span>
            )}
            {stateDiffStr && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  padding: "0.25rem 0.6rem",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: stateIsCheaper ? "var(--cheapest-bg)" : "var(--expensive-bg)",
                  color: stateIsCheaper ? "var(--cheapest)" : "var(--expensive)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {stateDiffStr} vs {station.state} Median
              </span>
            )}
          </div>
        )}
      </div>

      <section style={{ marginBottom: "2.5rem" }}>
        <h2 className="section-title">Current Fuel Prices</h2>
        {station.fuels.length === 0 ? (
          <div className="card">
            <p style={{ color: "var(--text-muted)" }}>
              No current prices reported for this station.
            </p>
          </div>
        ) : (
          <div className="prices-grid">
            {station.fuels.map((fuel) => (
              <div key={fuel.sku} className="price-card">
                <div className="stat-label">{fuel.name}</div>
                <div className="stat-value">{formatPrice(fuel.price)}</div>
                <div className="stat-subtext">
                  Updated: {formatDate(fuel.observedAt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="chart-section" style={{ marginBottom: "2.5rem" }}>
        <h2 className="section-title">Historical Price Trends</h2>
        <PriceHistoryChart history={history} />
      </section>

      {/* Nearby Stations Section */}
      <NearbyStations nearby={nearby} targetStationName={station.name} />

      {history.length > 0 && (
        <section className="history-section" style={{ marginTop: "2.5rem" }}>
          <h2 className="section-title">Price Change History Log</h2>
          <div className="table-container">
            <table className="station-table">
              <thead>
                <tr>
                  <th>Fuel</th>
                  <th>Price</th>
                  <th>Observed At (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={`${item.fuelSku}-${item.observedAt}-${index}`}>
                    <td style={{ fontWeight: 600 }}>{item.fuelName}</td>
                    <td style={{ fontWeight: 700 }}>{formatPrice(item.price)}</td>
                    <td style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                      {formatDate(item.observedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
