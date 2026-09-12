import Link from "next/link";
import { notFound } from "next/navigation";
import { getStation, getStationHistory } from "../../../lib/api";
import { getNationalSummary, getStateSummaries } from "../../../lib/analytics";
import { formatDate, formatPrice } from "../../../lib/stats";
import PriceHistoryChart from "../../../components/PriceHistoryChart";

export const dynamic = "force-dynamic";

export default async function StationDetailPage({
  params,
}: {
  params: Promise<{ clubNumber: string }>;
}) {
  const resolvedParams = await params;
  const clubNumber = Number.parseInt(resolvedParams.clubNumber, 10);

  if (!Number.isFinite(clubNumber)) {
    notFound();
  }

  const [stationData, historyData, nationalSummaryRes, stateSummariesRes] = await Promise.allSettled([
    getStation(clubNumber),
    getStationHistory(clubNumber),
    getNationalSummary("1"),
    getStateSummaries("1"),
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

  return (
    <div>
      <div className="station-header">
        <div className="breadcrumbs">
          <Link href="/">&larr; Back to all stations</Link>
        </div>
        <h1 className="page-title">{station.name}</h1>
        <p className="detail-address">
          {station.address} &bull; {station.city}, {station.state} {station.postalCode}
        </p>
        <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
          Club #{station.clubNumber} &bull; {station.storeType || "Standard Club"}
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

      <section className="chart-section">
        <h2 className="section-title">Historical Price Trends</h2>
        <PriceHistoryChart history={history} />
      </section>

      {history.length > 0 && (
        <section className="history-section">
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
