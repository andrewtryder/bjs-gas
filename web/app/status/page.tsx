import type { Metadata } from "next";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getSystemStatus } from "../../lib/api";
import { getFreshnessInfo, formatRelativeTime } from "../../lib/freshness";
import { resolveStatusHero, formatCollectionDuration } from "../../lib/status-view";

export const metadata: Metadata = {
  title: "Data status — BJ's Gas Prices",
  description:
    "Check current data freshness and update status for BJ's Wholesale Club gas prices. Updated hourly.",
};

export const revalidate = 60; // Refresh every 60s

export default async function StatusPage() {
  let status = null;
  let fetchError = null;

  try {
    status = await getSystemStatus();
  } catch (err: unknown) {
    fetchError = err instanceof Error ? err.message : "Failed to fetch status";
  }

  const lastRun = status?.lastCollection;
  const freshness = status?.freshness;
  const freshnessInfo = freshness?.latestObservedAt
    ? getFreshnessInfo(freshness.latestObservedAt)
    : null;

  const hero = resolveStatusHero(
    status,
    fetchError,
    freshness?.latestObservedAt
  );

  return (
    <div className="status-page-container">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Data status" }]} />

      {/* Page Title */}
      <div className="page-header">
        <h1 className="page-title">Data status</h1>
        <p className="page-subtitle">
          Current tracking status and price update freshness across BJ&apos;s gas stations.
        </p>
      </div>

      {/* Primary Status Hero Panel */}
      <div className={`status-hero-banner status-${hero.level}`}>
        <div className="status-hero-main">
          <div className="status-hero-indicator-group">
            <span className={`status-dot status-dot-${hero.level}`} aria-hidden="true" />
            <div>
              <h2 className="status-hero-heading">{hero.heading}</h2>
              <p className="status-hero-desc">{hero.description}</p>
            </div>
          </div>
          <span className="status-hero-timestamp tabular-nums">
            Last update: {freshness?.latestObservedAt ? formatRelativeTime(freshness.latestObservedAt) : "recently"}
          </span>
        </div>
      </div>

      {/* Supporting Key Metrics */}
      <div className="status-metrics-grid">
        {/* Metric 1: Reporting Locations */}
        <div className="status-metric-card">
          <div className="status-metric-label">
            Reporting locations
          </div>
          <div className="status-metric-val-row">
            <span className="status-metric-value tabular-nums">
              {freshness?.stationsObservedRecently ?? 0}
            </span>
            <span className="status-metric-subtext">
              of {status?.configuredGasClubs ?? 0} stations
            </span>
          </div>
          <p className="status-metric-desc">
            Active BJ&apos;s stations reporting fuel prices.
          </p>
        </div>

        {/* Metric 2: Current Prices Tracked */}
        <div className="status-metric-card">
          <div className="status-metric-label">
            Current prices
          </div>
          <div className="status-metric-val-row">
            <span className="status-metric-value tabular-nums">
              {freshness?.currentPriceRows ?? 0}
            </span>
            <span className="status-metric-subtext">
              {lastRun?.historyChanges ? `+${lastRun.historyChanges} updated` : "steady"}
            </span>
          </div>
          <p className="status-metric-desc">
            Active fuel price observations across all grades.
          </p>
        </div>

        {/* Metric 3: Collection Duration */}
        <div className="status-metric-card">
          <div className="status-metric-label">
            Collection duration
          </div>
          <div className="status-metric-val-row">
            <span className="status-metric-value tabular-nums">
              {formatCollectionDuration(lastRun?.durationMs)}
            </span>
            <span className="status-metric-subtext">
              hourly cadence
            </span>
          </div>
          <p className="status-metric-desc">
            Automated hourly refresh duration.
          </p>
        </div>
      </div>

      {/* Technical Collection Details in Collapsible Disclosure */}
      {lastRun && (
        <details className="price-changes-disclosure status-details-card">
          <summary className="price-changes-summary">
            <span>Collection details</span>
            <span className="disclosure-chevron" aria-hidden="true">&#9662;</span>
          </summary>
          <div className="disclosure-content">
            <dl className="status-details-grid">
              <div className="status-detail-item">
                <dt className="status-detail-dt">Configured stations</dt>
                <dd className="status-detail-dd tabular-nums">
                  {lastRun.clubsConfigured}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Successfully collected</dt>
                <dd className="status-detail-dd text-cheaper tabular-nums">
                  {lastRun.clubsSucceeded}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Empty fuel feeds</dt>
                <dd className="status-detail-dd tabular-nums">
                  {lastRun.clubsEmptyFuels}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Hard failures</dt>
                <dd className="status-detail-dd text-higher tabular-nums">
                  {lastRun.clubsHardFailed}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Fuel observations</dt>
                <dd className="status-detail-dd tabular-nums">
                  {lastRun.fuelObservations}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Price changes detected</dt>
                <dd className="status-detail-dd tabular-nums">
                  {lastRun.historyChanges}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Database operations</dt>
                <dd className="status-detail-dd tabular-nums">
                  {lastRun.databaseQueries}
                </dd>
              </div>
              <div className="status-detail-item">
                <dt className="status-detail-dt">Run duration</dt>
                <dd className="status-detail-dd tabular-nums">
                  {formatCollectionDuration(lastRun.durationMs)}
                </dd>
              </div>
            </dl>
          </div>
        </details>
      )}

      {/* Freshness Standards Information */}
      <section className="status-info-card">
        <h2 className="status-info-heading">How price updates work</h2>
        <p className="status-info-body">
          Prices are checked automatically each hour across all BJ&apos;s Wholesale Club gas locations.
          Observations are recorded to track historical trends, calculate state medians, and compare
          local station pricing.
        </p>
        <div className="status-info-footer">
          <span className="status-legend-item">
            <span className="status-legend-dot healthy" aria-hidden="true" />
            Updated recently: &le; 2 hours
          </span>
          <span className="status-legend-item">
            <span className="status-legend-dot aging" aria-hidden="true" />
            Aging: 2–6 hours
          </span>
          <span className="status-legend-item">
            <span className="status-legend-dot stale" aria-hidden="true" />
            Stale: &gt; 6 hours
          </span>
          <span className="status-legend-frequency">
            Cadence: Hourly
          </span>
        </div>
      </section>
    </div>
  );
}
