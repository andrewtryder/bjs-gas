import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getStation, getStationHistory, getNearbyStations, getWebBaseUrl } from "../../../lib/api";
import { getNationalSummary, getStateSummaries } from "../../../lib/analytics";
import { formatDisplayDate, formatPrice, formatPriceComparison } from "../../../lib/stats";
import { getFreshnessInfo } from "../../../lib/freshness";
import { getPrimaryFuel, formatFuelDisplayName } from "../../../lib/discovery";
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
    title: `BJ's Gas in ${station.city}, ${station.state} — Current Fuel Prices & History`,
    description: `Current fuel prices for BJ's Wholesale Club in ${station.city}, ${station.state}. Compare regular unleaded rates, station price trends, and nearby club prices. Updated hourly.`,
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

  // Identify canonical primary fuel
  const primaryFuel = getPrimaryFuel(station.fuels);
  const primaryPriceNum = primaryFuel ? Number.parseFloat(primaryFuel.price) : null;
  const isPrimaryValid = primaryPriceNum !== null && Number.isFinite(primaryPriceNum) && primaryPriceNum > 0;

  // Secondary fuels
  const secondaryFuels = station.fuels.filter((f) => f.sku !== primaryFuel?.sku);

  // Comparisons
  const stateName = getStateName(station.state);
  const stateSlug = toStateSlug(station.state);

  let stateComparison = null;
  const stateData = stateSummaries?.states.find((s) => s.state === station.state);
  if (isPrimaryValid && stateData?.medianPrice) {
    const stMed = Number.parseFloat(stateData.medianPrice);
    if (Number.isFinite(stMed)) {
      stateComparison = formatPriceComparison(primaryPriceNum!, stMed, `${stateName} median`);
    }
  }

  let nationalComparison = null;
  if (isPrimaryValid && nationalSummary?.medianPrice) {
    const natMed = Number.parseFloat(nationalSummary.medianPrice);
    if (Number.isFinite(natMed)) {
      nationalComparison = formatPriceComparison(primaryPriceNum!, natMed, "national median");
    }
  }

  // Freshness
  const latestObservation = station.fuels.reduce((latest: string | null, f) => {
    if (!latest) return f.observedAt;
    return new Date(f.observedAt).getTime() > new Date(latest).getTime() ? f.observedAt : latest;
  }, null);
  const freshness = getFreshnessInfo(latestObservation);

  // Structured Data (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "GasStation",
    name: `BJ's Gas - ${station.city}, ${station.state}`,
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
    <div className="station-page-wrapper">
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
          { label: `${station.city}, ${station.state}` },
        ]}
      />

      {/* Hero Panel */}
      <div className="station-hero-card">
        <div className="station-hero-header">
          <div>
            <h1 className="station-hero-city">
              {station.city}, {station.state}
              <span className="station-hero-club-qualifier"> &bull; #{station.clubNumber}</span>
            </h1>
            <p className="station-hero-address">
              {station.address}
            </p>
          </div>

          <div className="station-hero-actions">
            <Link
              href={`/map?station=${station.clubNumber}`}
              className="btn btn-primary"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{ marginRight: "0.375rem" }}
              >
                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
              View on map
            </Link>
            <Link
              href={`/states/${stateSlug}`}
              className="btn btn-secondary"
            >
              Browse {stateName}
            </Link>
          </div>
        </div>

        {/* Primary Fuel Price Hero */}
        <div className="station-price-hero">
          <div className="station-primary-price-group">
            <div className="station-primary-price tabular-nums">
              {isPrimaryValid ? formatPrice(primaryPriceNum) : "—"}
            </div>
            <div className="station-primary-fuel-label">
              {formatFuelDisplayName(primaryFuel?.name || "Regular")}
            </div>
          </div>

          {/* Comparisons & Freshness */}
          <div className="station-hero-insights">
            {(stateComparison || nationalComparison) && (
              <div className="station-comparisons-list">
                {stateComparison && (
                  <span
                    className={`badge ${
                      stateComparison.isCheaper
                        ? "badge-cheaper"
                        : stateComparison.isHigher
                        ? "badge-higher"
                        : "badge-neutral"
                    }`}
                  >
                    {stateComparison.isCheaper && <span aria-hidden="true">&darr; </span>}
                    {stateComparison.isHigher && <span aria-hidden="true">&uarr; </span>}
                    {stateComparison.text}
                  </span>
                )}
                {nationalComparison && (
                  <span
                    className={`badge ${
                      nationalComparison.isCheaper
                        ? "badge-cheaper"
                        : nationalComparison.isHigher
                        ? "badge-higher"
                        : "badge-neutral"
                    }`}
                  >
                    {nationalComparison.isCheaper && <span aria-hidden="true">&darr; </span>}
                    {nationalComparison.isHigher && <span aria-hidden="true">&uarr; </span>}
                    {nationalComparison.text}
                  </span>
                )}
              </div>
            )}

            <div
              className="station-freshness-text"
              title={latestObservation ? `Exact timestamp: ${new Date(latestObservation).toLocaleString()}` : undefined}
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
        </div>

        {/* Secondary Fuels Grid */}
        {secondaryFuels.length > 0 && (
          <div className="station-secondary-fuels-section">
            <div className="secondary-fuels-title">Other fuels</div>
            <div className="secondary-fuels-grid">
              {secondaryFuels.map((fuel) => {
                const fuelPrice = Number.parseFloat(fuel.price);
                const isAvailable = Number.isFinite(fuelPrice) && fuelPrice > 0;
                return (
                  <div key={fuel.sku} className="secondary-fuel-pill">
                    <span className="secondary-fuel-name">
                      {formatFuelDisplayName(fuel.name)}
                    </span>
                    <span className="secondary-fuel-price tabular-nums">
                      {isAvailable ? formatPrice(fuelPrice) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Price History Section */}
      <section className="station-section" style={{ marginTop: "2rem" }}>
        <h2 className="section-title">Price history</h2>
        <PriceHistoryChart
          history={history}
          defaultFuelName={primaryFuel ? formatFuelDisplayName(primaryFuel.name) : "Regular"}
        />
      </section>

      {/* Nearby Stations Section */}
      <NearbyStations nearby={nearby} targetStationName={`${station.city}, ${station.state}`} />

      {/* Raw Price Change History Disclosure */}
      {history.length > 0 && (
        <section className="station-section" style={{ marginTop: "2rem" }}>
          <details className="price-changes-disclosure">
            <summary className="price-changes-summary">
              <span>View all price changes ({history.length})</span>
              <span className="disclosure-chevron" aria-hidden="true">&#9662;</span>
            </summary>
            <div className="disclosure-content">
              <div className="table-container">
                <table className="station-table directory-table">
                  <thead>
                    <tr>
                      <th scope="col">Fuel</th>
                      <th scope="col">Price</th>
                      <th scope="col">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((item, index) => (
                      <tr key={`${item.fuelSku}-${item.observedAt}-${index}`}>
                        <td style={{ fontWeight: 600 }}>
                          {formatFuelDisplayName(item.fuelName)}
                        </td>
                        <td className="tabular-nums" style={{ fontWeight: 700 }}>
                          {formatPrice(item.price)}
                        </td>
                        <td style={{ color: "var(--color-text-secondary)", fontSize: "0.875rem" }}>
                          {formatDisplayDate(item.observedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        </section>
      )}
    </div>
  );
}
