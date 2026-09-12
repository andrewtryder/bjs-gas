import Link from "next/link";
import type { NearbyStationDto } from "../lib/types";

interface NearbyStationsProps {
  nearby: NearbyStationDto[];
  targetStationName: string;
}

export default function NearbyStations({ nearby, targetStationName }: NearbyStationsProps) {
  if (!nearby || nearby.length === 0) {
    return null;
  }

  return (
    <section style={{ marginTop: "2.5rem" }} aria-labelledby="nearby-stations-heading">
      <div style={{ marginBottom: "1rem" }}>
        <h2
          id="nearby-stations-heading"
          style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.25rem" }}
        >
          Nearby BJ&apos;s Gas Stations
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
          Closest reporting BJ&apos;s Wholesale Club fuel locations compared to {targetStationName}.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "1rem",
        }}
      >
        {nearby.map((station) => {
          const isCheaper = station.priceDeltaFormatted?.includes("cheaper");
          const isMoreExpensive = station.priceDeltaFormatted?.includes("more expensive");

          const badgeBg = isCheaper
            ? "var(--cheaper-bg)"
            : isMoreExpensive
            ? "var(--expensive-bg)"
            : "rgba(255, 255, 255, 0.05)";

          const badgeColor = isCheaper
            ? "var(--cheaper)"
            : isMoreExpensive
            ? "var(--expensive)"
            : "var(--text-secondary)";

          const badgeBorder = isCheaper
            ? "rgba(34, 197, 94, 0.2)"
            : isMoreExpensive
            ? "rgba(239, 68, 68, 0.2)"
            : "var(--border)";

          return (
            <Link
              key={station.clubNumber}
              href={`/stations/${station.clubNumber}`}
              className="card hover-lift"
              style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "1.25rem",
                textDecoration: "none",
                color: "inherit",
                transition: "all 0.2s ease",
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.5rem",
                  }}
                >
                  <div>
                    <h3
                      style={{
                        fontSize: "1.0625rem",
                        fontWeight: 600,
                        margin: "0 0 0.25rem",
                        color: "var(--text)",
                      }}
                    >
                      {station.name}
                    </h3>
                    <p
                      style={{
                        fontSize: "0.8125rem",
                        color: "var(--text-secondary)",
                        margin: 0,
                      }}
                    >
                      {station.city}, {station.state}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--primary)",
                      backgroundColor: "rgba(59, 130, 246, 0.1)",
                      border: "1px solid rgba(59, 130, 246, 0.25)",
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {station.distanceFormatted}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: "1rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                    Regular Unleaded
                  </div>
                  <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text)" }}>
                    {station.regularPrice ? `$${station.regularPrice}` : "N/A"}
                  </div>
                </div>

                {station.priceDeltaFormatted && (
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "6px",
                      backgroundColor: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeBorder}`,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    {isCheaper && <span aria-hidden="true">↓</span>}
                    {isMoreExpensive && <span aria-hidden="true">↑</span>}
                    {station.priceDeltaFormatted}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
