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
    "Compare current BJ's Wholesale Club gas prices across all operating states. Find lowest state fuel medians, price ranges, and local station directories. Checked approximately every two hours.",
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
    <div className="state-index-page">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "States" }]} />

      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">
          Gas prices by state
        </h1>
        <p className="page-subtitle">
          Compare current BJ&apos;s Regular prices across states. Checked approximately every two
          hours.
        </p>
      </div>

      {fetchError && (
        <div className="state-fetch-error-card">
          <p>{fetchError}</p>
        </div>
      )}

      {/* State Price Summary Highlights */}
      <div className="state-summary-grid">
        {cheapestState && (
          <div className="state-summary-card">
            <div className="state-summary-label">
              Cheapest State Median
            </div>
            <div className="state-summary-price text-cheaper tabular-nums">
              {formatPrice(cheapestState.medianPrice)}
            </div>
            <div className="state-summary-meta">
              <Link
                href={`/states/${toStateSlug(cheapestState.state)}`}
                className="state-summary-link"
              >
                {getStateName(cheapestState.state)}
              </Link>{" "}
              &bull; {cheapestState.stationCount} locations
            </div>
          </div>
        )}

        {highestState && (
          <div className="state-summary-card">
            <div className="state-summary-label">
              Highest State Median
            </div>
            <div className="state-summary-price text-higher tabular-nums">
              {formatPrice(highestState.medianPrice)}
            </div>
            <div className="state-summary-meta">
              <Link
                href={`/states/${toStateSlug(highestState.state)}`}
                className="state-summary-link"
              >
                {getStateName(highestState.state)}
              </Link>{" "}
              &bull; {highestState.stationCount} locations
            </div>
          </div>
        )}

        <div className="state-summary-card">
          <div className="state-summary-label">
            States Tracked
          </div>
          <div className="state-summary-price tabular-nums">
            {totalStates}
          </div>
          <div className="state-summary-meta">
            Operating BJ&apos;s gas markets
          </div>
        </div>
      </div>

      {/* Directory & Comparison Table / Mobile Rows */}
      <StateIndexDirectory states={rawStates} />
    </div>
  );
}
