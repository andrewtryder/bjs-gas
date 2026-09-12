import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "../../components/Breadcrumbs";
import { getStateSummaries } from "../../lib/analytics";
import { getStateName, toStateSlug } from "../../lib/states";
import { getWebBaseUrl } from "../../lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BJ's Gas Prices by State — Directory & State Averages",
  description:
    "Compare BJ's Wholesale Club gas prices across all 20+ states. Find current median fuel rates, lowest state gas prices, and local club directories.",
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

  // Sort alphabetically by full state name
  const sortedStates = [...rawStates].sort((a, b) => {
    const nameA = getStateName(a.state);
    const nameB = getStateName(b.state);
    return nameA.localeCompare(nameB);
  });

  // Derived summary metrics
  const totalStates = sortedStates.length;
  const cheapestState =
    sortedStates.length > 0
      ? [...sortedStates].sort(
          (a, b) => Number.parseFloat(a.medianPrice) - Number.parseFloat(b.medianPrice),
        )[0]
      : null;

  const highestState =
    sortedStates.length > 0
      ? [...sortedStates].sort(
          (a, b) => Number.parseFloat(b.medianPrice) - Number.parseFloat(a.medianPrice),
        )[0]
      : null;

  return (
    <div className="states-index-page" style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "States" }]} />

      <div className="page-intro" style={{ marginBottom: "1.5rem" }}>
        <h1 className="page-title" style={{ fontSize: "1.875rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
          BJ&apos;s Gas Prices by State
        </h1>
        <p className="page-description" style={{ color: "var(--text-secondary)", fontSize: "1rem", margin: 0 }}>
          Browse current regular fuel medians, price ranges, and station counts across all {totalStates || "20+"} states
          with reporting BJ&apos;s Wholesale Club gas stations.
        </p>
      </div>

      {fetchError && (
        <div
          className="card"
          style={{
            borderColor: "var(--expensive)",
            backgroundColor: "var(--expensive-bg)",
            marginBottom: "1.5rem",
          }}
        >
          <p style={{ color: "var(--expensive)", margin: 0 }}>{fetchError}</p>
        </div>
      )}

      {/* KPI Overview */}
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
            States with BJ&apos;s Gas
          </div>
          <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--text)" }}>
            {totalStates}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
            Active operating markets
          </div>
        </div>

        {cheapestState && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Lowest State Median
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--cheaper)" }}>
              ${cheapestState.medianPrice}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {getStateName(cheapestState.state)} ({cheapestState.state})
            </div>
          </div>
        )}

        {highestState && (
          <div className="card" style={{ padding: "1.25rem" }}>
            <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", marginBottom: "0.25rem" }}>
              Highest State Median
            </div>
            <div style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--expensive)" }}>
              ${highestState.medianPrice}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: "0.25rem" }}>
              {getStateName(highestState.state)} ({highestState.state})
            </div>
          </div>
        )}
      </div>

      {/* State Cards Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.25rem",
        }}
      >
        {sortedStates.map((item) => {
          const stateName = getStateName(item.state);
          const slug = toStateSlug(item.state);

          return (
            <Link
              key={item.state}
              href={`/states/${slug}`}
              className="card hover-lift"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "1.25rem",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.75rem",
                  }}
                >
                  <h2 style={{ fontSize: "1.125rem", fontWeight: 700, margin: 0, color: "var(--text)" }}>
                    {stateName}
                  </h2>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      color: "var(--primary)",
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "9999px",
                    }}
                  >
                    {item.state}
                  </span>
                </div>

                <div style={{ marginBottom: "1rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "0.2rem" }}>
                    Median Regular Price
                  </div>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
                    ${item.medianPrice}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "0.8125rem",
                    color: "var(--text-secondary)",
                    padding: "0.5rem 0",
                    borderTop: "1px solid var(--border)",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: "0.75rem",
                  }}
                >
                  <span>Range:</span>
                  <span style={{ fontWeight: 600, color: "var(--text)" }}>
                    ${item.minPrice} – ${item.maxPrice}
                  </span>
                </div>

                <div style={{ fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                  {item.stationCount} {item.stationCount === 1 ? "station" : "stations"}
                </div>
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                View {item.state} Stations <span aria-hidden="true">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
