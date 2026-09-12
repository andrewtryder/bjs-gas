import Link from "next/link";
import { notFound } from "next/navigation";
import { getStation, getStationHistory } from "../../../lib/api";
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

  const [stationData, historyData] = await Promise.all([
    getStation(clubNumber),
    getStationHistory(clubNumber),
  ]);

  if (!stationData || !stationData.station) {
    notFound();
  }

  const station = stationData.station;
  const history = historyData?.history || [];

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
                  Observed {formatDate(fuel.observedAt)}
                </div>
                {fuel.sourcePriceAtLocal && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      marginTop: "0.25rem",
                    }}
                  >
                    Station time: {fuel.sourcePriceAtLocal}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="chart-section">
        <h2 className="section-title">Price Change History</h2>
        <PriceHistoryChart history={history} />
      </section>

      <section className="history-section">
        <h2 className="section-title">Chronological Price Changes</h2>
        {history.length === 0 ? (
          <div className="empty-state">
            <p>No historical price change events recorded yet.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="station-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Fuel Type</th>
                  <th>Price</th>
                  <th>BJ&apos;s Local Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={`${item.observedAt}-${item.fuelSku}-${idx}`}>
                    <td>{formatDate(item.observedAt)}</td>
                    <td>
                      <span className="fuel-badge">
                        <span className="fuel-badge-name">{item.fuelName}</span>
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{formatPrice(item.price)}</span>
                    </td>
                    <td>
                      <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                        {item.sourcePriceAtLocal || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
