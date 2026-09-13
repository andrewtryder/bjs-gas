import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getSystemStatus } from "../../lib/api";
import { getFreshnessInfo, formatRelativeTime } from "../../lib/freshness";

export const metadata: Metadata = {
  title: "Data status — BJ's Gas Prices",
  description:
    "Check live data freshness and update status for BJ's Wholesale Club gas prices.",
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

  const isHealthy = status?.healthy === true;
  const lastRun = status?.lastCollection;
  const freshness = status?.freshness;
  const freshnessInfo = freshness?.latestObservedAt
    ? getFreshnessInfo(freshness.latestObservedAt)
    : null;

  const isDegraded = !fetchError && !isHealthy;
  const isStale = fetchError !== null || freshnessInfo?.level === "stale";

  // Standardized plain health wording
  const statusHeading = fetchError
    ? "Price updates are delayed"
    : isHealthy
    ? "Prices are up to date"
    : "Some prices may be delayed";

  const statusDescription = fetchError
    ? "Unable to reach data status service. Station pages continue serving recently cached prices."
    : isHealthy
    ? `Latest price check completed ${
        freshness?.latestObservedAt ? formatRelativeTime(freshness.latestObservedAt) : "recently"
      }.`
    : status?.unhealthyReasons?.join(", ") ||
      "Some station prices have not updated on schedule.";

  return (
    <div className="space-y-6" style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Data status" }]} />

      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Data status</h1>
        <p className="mt-1 text-slate-600">
          Current tracking status and price update freshness across BJ&apos;s gas stations.
        </p>
      </div>

      {/* Primary Status Banner */}
      <div
        className={`rounded-2xl border p-6 shadow-sm transition-all ${
          isHealthy && !fetchError
            ? "border-emerald-200 bg-emerald-50/60"
            : isDegraded
            ? "border-amber-200 bg-amber-50/60"
            : "border-rose-200 bg-rose-50/60"
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-4 w-4">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isHealthy && !fetchError
                    ? "bg-emerald-400"
                    : isDegraded
                    ? "bg-amber-400"
                    : "bg-rose-400"
                }`}
              />
              <span
                className={`relative inline-flex h-4 w-4 rounded-full ${
                  isHealthy && !fetchError
                    ? "bg-emerald-500"
                    : isDegraded
                    ? "bg-amber-500"
                    : "bg-rose-500"
                }`}
              />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{statusHeading}</h2>
              <p className="text-sm text-slate-600 mt-0.5">{statusDescription}</p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500 self-start sm:self-auto">
            Checked: {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Supporting Key Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Metric 1: Reporting Locations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Reporting locations
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {freshness?.stationsObservedRecently ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-500">
              of {status?.configuredGasClubs ?? 0} stations
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Active BJ&apos;s stations reporting fuel prices.
          </p>
        </div>

        {/* Metric 2: Current Prices Tracked */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Current prices
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {freshness?.currentPriceRows ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {lastRun?.historyChanges ? `+${lastRun.historyChanges} updated` : "steady"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Active fuel price observations across all grades.
          </p>
        </div>

        {/* Metric 3: Last Update */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Last update
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-slate-900">
              {freshness?.latestObservedAt ? formatRelativeTime(freshness.latestObservedAt) : "Recently"}
            </span>
            {lastRun && (
              <span className="text-xs text-slate-500">
                in {(lastRun.durationMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Hourly automated refresh cadence.
          </p>
        </div>
      </div>

      {/* Technical Collection Details in Collapsible Disclosure */}
      {lastRun && (
        <details className="price-changes-disclosure rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <summary className="price-changes-summary px-6 py-4 bg-slate-50 font-semibold text-sm text-slate-900 cursor-pointer">
            Collection details
          </summary>
          <div className="p-6 border-t border-slate-100">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-slate-500">Configured stations</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                  {lastRun.clubsConfigured}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Successfully collected</dt>
                <dd className="mt-1 text-base font-semibold text-emerald-600 tabular-nums">
                  {lastRun.clubsSucceeded}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Empty fuel feeds</dt>
                <dd className="mt-1 text-base font-semibold text-slate-700 tabular-nums">
                  {lastRun.clubsEmptyFuels}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Hard failures</dt>
                <dd className="mt-1 text-base font-semibold text-rose-600 tabular-nums">
                  {lastRun.clubsHardFailed}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Fuel observations</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                  {lastRun.fuelObservations}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Price changes detected</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                  {lastRun.historyChanges}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Database operations</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                  {lastRun.databaseQueries}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Run duration</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900 tabular-nums">
                  {(lastRun.durationMs / 1000).toFixed(2)}s
                </dd>
              </div>
            </dl>
          </div>
        </details>
      )}

      {/* Freshness Standards Information */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">How price updates work</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          Prices are checked automatically each hour across all BJ&apos;s Wholesale Club gas locations.
          Observations are securely saved to track historical trends, calculate state medians, and compare
          local station pricing.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Updated recently: &le; 2 hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            Aging: 2–6 hours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Stale: &gt; 6 hours
          </span>
          <span className="ml-auto">
            Check frequency: Hourly
          </span>
        </div>
      </section>
    </div>
  );
}
