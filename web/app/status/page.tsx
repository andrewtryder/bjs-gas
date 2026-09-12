import type { Metadata } from "next";
import Link from "next/link";
import { getSystemStatus } from "../../lib/api";
import { getFreshnessInfo, formatRelativeTime } from "../../lib/freshness";

export const metadata: Metadata = {
  title: "System Status & Pipeline Health | BJ's Gas Price Tracker",
  description: "Live operational status, collector pipeline health, station coverage, and data freshness for BJ's Wholesale gas stations.",
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
  const freshnessInfo = freshness?.latestObservedAt ? getFreshnessInfo(freshness.latestObservedAt) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <ol className="flex items-center space-x-2">
          <li>
            <Link href="/" className="hover:text-slate-900 transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="font-medium text-slate-900" aria-current="page">
            Status
          </li>
        </ol>
      </nav>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Status & Data Pipeline</h1>
        <p className="mt-1 text-slate-600">
          Real-time collector metrics, station coverage, and observation freshness across all BJ&apos;s Wholesale gas locations.
        </p>
      </div>

      {/* Primary Status Banner */}
      <div
        className={`rounded-2xl border p-6 shadow-sm transition-all ${
          isHealthy
            ? "border-emerald-200 bg-emerald-50/60"
            : fetchError
            ? "border-rose-200 bg-rose-50/60"
            : "border-amber-200 bg-amber-50/60"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="relative flex h-4 w-4">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                  isHealthy ? "bg-emerald-400" : fetchError ? "bg-rose-400" : "bg-amber-400"
                }`}
              />
              <span
                className={`relative inline-flex h-4 w-4 rounded-full ${
                  isHealthy ? "bg-emerald-500" : fetchError ? "bg-rose-500" : "bg-amber-500"
                }`}
              />
            </span>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                {fetchError
                  ? "Status Feed Temporarily Unavailable"
                  : isHealthy
                  ? "All Systems Operational"
                  : "Pipeline Operating in Degraded State"}
              </h2>
              <p className="text-sm text-slate-600">
                {fetchError
                  ? "Unable to reach collector status endpoint. Core web pages continue serving cached data."
                  : isHealthy
                  ? "Hourly price ingestion and analytics reconstruction are operating normally."
                  : status?.unhealthyReasons?.join(", ") || "Some stations or metrics are experiencing delayed updates."}
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-slate-500">
            Checked: {new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Health State */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pipeline State</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${
                isHealthy ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {isHealthy ? "Healthy" : "Degraded"}
            </span>
            {lastRun && (
              <span className="text-xs text-slate-500">
                {(lastRun.durationMs / 1000).toFixed(1)}s run
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Automated hourly poll against BJ&apos;s station data.
          </p>
        </div>

        {/* Card 2: Freshness */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Data Freshness</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-bold text-slate-900">
              {freshness?.latestObservedAt ? formatRelativeTime(freshness.latestObservedAt) : "N/A"}
            </span>
            {freshnessInfo && (
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${freshnessInfo.badgeClass}`}>
                {freshnessInfo.label}
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Latest price observation timestamp.
          </p>
        </div>

        {/* Card 3: Station Coverage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reporting Stations</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {freshness?.stationsObservedRecently ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-500">
              of {status?.configuredGasClubs ?? 0} clubs
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Active gas stations reporting prices within fresh window.
          </p>
        </div>

        {/* Card 4: Price Observations */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Price Rows</div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900">
              {freshness?.currentPriceRows ?? 0}
            </span>
            <span className="text-xs font-medium text-slate-500">
              {lastRun?.historyChanges ? `+${lastRun.historyChanges} changes` : "0 changes"}
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Current fuel observation records tracked in Prisma Postgres.
          </p>
        </div>
      </div>

      {/* Detailed Pipeline Run Section */}
      {lastRun && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900">Latest Collector Run Details</h2>
            <p className="text-xs text-slate-500">
              Started {new Date(lastRun.startedAt).toLocaleString("en-US")} ({formatRelativeTime(lastRun.startedAt)})
            </p>
          </div>
          <div className="p-6">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
              <div>
                <dt className="text-xs font-medium text-slate-500">Clubs Polled</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">{lastRun.clubsConfigured}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Clubs Succeeded</dt>
                <dd className="mt-1 text-base font-semibold text-emerald-600">{lastRun.clubsSucceeded}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Empty Fuel Feeds</dt>
                <dd className="mt-1 text-base font-semibold text-slate-700">{lastRun.clubsEmptyFuels}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Hard Failed</dt>
                <dd className="mt-1 text-base font-semibold text-rose-600">{lastRun.clubsHardFailed}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Fuel Observations</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">{lastRun.fuelObservations}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">History Delta Rows</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">{lastRun.historyChanges}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Database Queries</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">{lastRun.databaseQueries}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Run Duration</dt>
                <dd className="mt-1 text-base font-semibold text-slate-900">{(lastRun.durationMs / 1000).toFixed(2)}s</dd>
              </div>
            </dl>
          </div>
        </section>
      )}

      {/* Architecture Transparency Card */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">About Our Data Pipeline</h2>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          BJ&apos;s Gas Tracker operates an automated collector on Prisma Compute that polls public station pricing data
          directly from BJ&apos;s Wholesale Club feeds. Observations are recorded into Prisma Postgres and preserved across
          time to build longitudinal price trends, volatility calculations, and state-by-state comparisons.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Fresh: &le; 2 hours
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
            Collection Cadence: Hourly
          </span>
        </div>
      </section>
    </div>
  );
}
