"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StationDto } from "../lib/types";
import { formatDate, formatPrice } from "../lib/stats";
import {
  filterStations,
  getAvailableStates,
  getAvailableFuels,
} from "../lib/discovery";

export default function StationList({ stations }: { stations: StationDto[] }) {
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedFuel, setSelectedFuel] = useState("ALL");

  const availableStates = useMemo(() => getAvailableStates(stations), [stations]);
  const availableFuels = useMemo(() => getAvailableFuels(stations), [stations]);

  const filtered = useMemo(() => {
    return filterStations(stations, {
      query,
      state: selectedState,
      fuelSku: selectedFuel,
    });
  }, [stations, query, selectedState, selectedFuel]);

  const handleReset = () => {
    setQuery("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
  };

  return (
    <div>
      <div className="discovery-filter-bar" style={{ marginBottom: "1rem" }}>
        <div className="discovery-search-wrapper">
          <input
            type="text"
            className="discovery-search-input"
            placeholder="Search stations by name, city, state, or ZIP..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search gas stations"
          />
          {query && (
            <button
              type="button"
              className="discovery-clear-search-btn"
              onClick={() => setQuery("")}
              aria-label="Clear search input"
            >
              &times;
            </button>
          )}
        </div>

        <div className="discovery-select-wrapper">
          <label htmlFor="directory-state" className="discovery-select-label">
            State:
          </label>
          <select
            id="directory-state"
            className="discovery-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="ALL">All States ({stations.length})</option>
            {availableStates.map((s) => (
              <option key={s.state} value={s.state}>
                {s.state} ({s.count})
              </option>
            ))}
          </select>
        </div>

        <div className="discovery-fuel-toggles">
          <span className="discovery-fuel-label">Fuel:</span>
          <button
            type="button"
            className={`discovery-fuel-btn ${selectedFuel === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedFuel("ALL")}
          >
            All
          </button>
          {availableFuels.map((f) => (
            <button
              key={f.sku}
              type="button"
              className={`discovery-fuel-btn ${selectedFuel === f.sku ? "active" : ""}`}
              onClick={() => setSelectedFuel(f.sku)}
            >
              {f.name}
            </button>
          ))}
        </div>

        <div className="discovery-summary">
          <span className="discovery-count">
            Showing {filtered.length} of {stations.length} stations
          </span>
          {(query || selectedState !== "ALL" || selectedFuel !== "ALL") && (
            <button
              type="button"
              className="discovery-reset-btn"
              onClick={handleReset}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="table-container">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <h3>No stations found</h3>
            <p>
              No stations match the selected criteria. Try adjusting your search
              or filters.
            </p>
            <button
              type="button"
              className="discovery-empty-reset-btn"
              onClick={handleReset}
              style={{ marginTop: "1rem" }}
            >
              Clear Filters
            </button>
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
                    ? station.fuels.reduce(
                        (latest, f) =>
                          new Date(f.observedAt) > new Date(latest)
                            ? f.observedAt
                            : latest,
                        station.fuels[0]!.observedAt,
                      )
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
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        Club #{station.clubNumber}
                      </div>
                    </td>
                    <td>
                      <div>
                        {station.city}, {station.state}
                      </div>
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {station.postalCode}
                      </div>
                    </td>
                    <td>
                      {station.fuels.length === 0 ? (
                        <span
                          style={{
                            color: "var(--text-muted)",
                            fontSize: "0.875rem",
                          }}
                        >
                          No prices reported
                        </span>
                      ) : (
                        <div className="fuel-badges">
                          {station.fuels.map((fuel) => (
                            <span
                              key={fuel.sku}
                              className={`fuel-badge ${
                                selectedFuel === fuel.sku ? "fuel-badge-highlight" : ""
                              }`}
                            >
                              <span className="fuel-badge-name">{fuel.name}:</span>
                              <span className="fuel-badge-price">
                                {formatPrice(fuel.price)}
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: "0.875rem",
                          color: "var(--text-secondary)",
                        }}
                      >
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
