"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { StationDto } from "../lib/types";

interface StateStationListProps {
  stations: StationDto[];
  stateCode: string;
}

export default function StateStationList({ stations, stateCode }: StateStationListProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.postalCode.includes(q) ||
        String(s.clubNumber).includes(q),
    );
  }, [stations, query]);

  return (
    <div style={{ marginTop: "2rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.25rem" }}>
            All BJ&apos;s Gas Stations in {stateCode}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", margin: 0 }}>
            Showing {filtered.length} of {stations.length} locations
          </p>
        </div>

        <div style={{ minWidth: "240px" }}>
          <input
            type="text"
            placeholder="Filter by city or club #..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input"
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              fontSize: "0.875rem",
              borderRadius: "8px",
            }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          className="card"
          style={{
            padding: "2rem",
            textAlign: "center",
            color: "var(--text-secondary)",
          }}
        >
          No gas stations found matching &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
          }}
        >
          {filtered.map((station) => {
            const regularFuel = station.fuels.find((f) => f.sku === "1");
            const otherFuels = station.fuels.filter((f) => f.sku !== "1");

            return (
              <div
                key={station.clubNumber}
                className="card hover-lift"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  padding: "1.25rem",
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
                          fontWeight: 700,
                          margin: "0 0 0.25rem",
                          color: "var(--text)",
                        }}
                      >
                        {station.name}
                      </h3>
                      <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", margin: 0 }}>
                        {station.city}, {station.state} {station.postalCode}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--text-secondary)",
                        backgroundColor: "rgba(255, 255, 255, 0.05)",
                        padding: "0.15rem 0.4rem",
                        borderRadius: "4px",
                      }}
                    >
                      #{station.clubNumber}
                    </span>
                  </div>

                  {/* Regular Price Hero */}
                  <div
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "0.75rem",
                      marginTop: "0.75rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                      Regular Unleaded
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text)" }}>
                      {regularFuel ? `$${regularFuel.price}` : "N/A"}
                    </div>
                  </div>

                  {/* Other fuels */}
                  {otherFuels.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {otherFuels.map((fuel) => (
                        <span
                          key={fuel.sku}
                          style={{
                            padding: "0.2rem 0.4rem",
                            borderRadius: "4px",
                            backgroundColor: "rgba(255, 255, 255, 0.04)",
                          }}
                        >
                          {fuel.name}: <strong style={{ color: "var(--text)" }}>${fuel.price}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "0.5rem",
                    paddingTop: "0.75rem",
                    borderTop: "1px solid var(--border)",
                    fontSize: "0.8125rem",
                  }}
                >
                  <Link
                    href={`/stations/${station.clubNumber}`}
                    style={{
                      color: "var(--primary)",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                    className="hover:underline"
                  >
                    View Details & History →
                  </Link>

                  <Link
                    href={`/map?station=${station.clubNumber}`}
                    style={{
                      color: "var(--text-secondary)",
                      textDecoration: "none",
                    }}
                    className="hover:underline"
                  >
                    Map ↗
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
