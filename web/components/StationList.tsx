"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StationDto } from "../lib/types";
import { formatDate, formatPrice } from "../lib/stats";

export default function StationList({ stations }: { stations: StationDto[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stations;
    return stations.filter((s) => {
      return (
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q) ||
        s.postalCode.toLowerCase().includes(q) ||
        String(s.clubNumber).includes(q)
      );
    });
  }, [stations, query]);

  return (
    <div>
      <div className="search-container">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search stations by name, city, state, or ZIP..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search gas stations"
          />
        </div>
        <div className="search-count">
          Showing {filtered.length} of {stations.length} stations
        </div>
      </div>

      <div className="table-container">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No stations found</h3>
            <p>No stations match &ldquo;{query}&rdquo;. Try another search term.</p>
          </div>
        ) : (
          <table className="station-table">
            <thead>
              <tr>
                <th>Station</th>
                <th>Location</th>
                <th>Current Fuel Prices</th>
                <th>Last Observed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((station) => {
                const latestObservation =
                  station.fuels.length > 0
                    ? station.fuels.reduce((latest, f) =>
                        new Date(f.observedAt) > new Date(latest) ? f.observedAt : latest,
                      station.fuels[0]!.observedAt)
                    : null;

                return (
                  <tr key={station.clubNumber}>
                    <td>
                      <Link
                        href={`/stations/${station.clubNumber}`}
                        className="station-name-link"
                      >
                        {station.name}
                      </Link>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        Club #{station.clubNumber}
                      </div>
                    </td>
                    <td>
                      <div>
                        {station.city}, {station.state}
                      </div>
                      <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                        {station.postalCode}
                      </div>
                    </td>
                    <td>
                      {station.fuels.length === 0 ? (
                        <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                          No prices reported
                        </span>
                      ) : (
                        <div className="fuel-badges">
                          {station.fuels.map((fuel) => (
                            <span key={fuel.sku} className="fuel-badge">
                              <span className="fuel-badge-name">{fuel.name}:</span>
                              <span className="fuel-badge-price">{formatPrice(fuel.price)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
                        {formatDate(latestObservation)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
