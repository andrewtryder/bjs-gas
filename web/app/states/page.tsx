import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../components/Breadcrumbs";
import StateIndexDirectory from "../../components/StateIndexDirectory";
import { getStateSummaries } from "../../lib/analytics";
import { getStateName, toStateSlug } from "../../lib/states";
import { formatPrice } from "../../lib/stats";
import { getWebBaseUrl } from "../../lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gas prices by state — Compare BJ's Gas Rates",
  description:
    "Compare current BJ's Wholesale Club gas prices across all operating states. Find lowest state fuel medians, price ranges, and local station directories.",
  alternates: {
    canonical: `${getWebBaseUrl()}/states`,
  },
};

export default async function StatesIndexPage() {
  let statesData: Awaited<ReturnType<typeof getStateSummaries>> | null = null;
  let fetchError: string | null = null;

  try {
    statesData = await getStateSummaries("1");
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load state price summaries";
  }

  const rawStates = statesData?.states || [];

  // Summary highlights
  const totalStates = rawStates.length;
  const sortedByPrice = [...rawStates].sort(
    (a, b) => Number.parseFloat(a.medianPrice) - Number.parseFloat(b.medianPrice)
  );
  const cheapestState = sortedByPrice.length > 0 ? sortedByPrice[0] : null;
  const highestState =
    sortedByPrice.length > 0 ? sortedByPrice[sortedByPrice.length - 1] : null;

  return (
    <div className="space-y-6" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "States" }]} />

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Gas prices by state
        </h1>
        <p className="mt-1 text-slate-600">
          Compare current BJ&apos;s Regular prices across states.
        </p>
      </div>

      {fetchError && (
        <div
          className="card"
          style={{
            borderColor: "var(--expensive)",
            backgroundColor: "var(--expensive-bg)",
          }}
        >
          <p style={{ color: "var(--expensive)", margin: 0 }}>{fetchError}</p>
        </div>
      )}

      {/* State Price Summary Highlights */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cheapestState && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Cheapest State Median
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--cheaper)" }}>
              {formatPrice(cheapestState.medianPrice)}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              <Link
                href={`/states/${toStateSlug(cheapestState.state)}`}
                className="hover:underline font-semibold text-slate-900"
              >
                {getStateName(cheapestState.state)}
              </Link>{" "}
              &bull; {cheapestState.stationCount} locations
            </div>
          </div>
        )}

        {highestState && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Highest State Median
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--expensive)" }}>
              {formatPrice(highestState.medianPrice)}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              <Link
                href={`/states/${toStateSlug(highestState.state)}`}
                className="hover:underline font-semibold text-slate-900"
              >
                {getStateName(highestState.state)}
              </Link>{" "}
              &bull; {highestState.stationCount} locations
            </div>
          </div>
        )}

        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
            States Tracked
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
            {totalStates}
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Operating BJ&apos;s gas markets
          </div>
        </div>
      </div>

      {/* Directory & Comparison Table / Cards */}
      <StateIndexDirectory states={rawStates} />
    </div>
  );
}
