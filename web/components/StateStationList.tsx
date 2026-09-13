"use client";

import { useState, useMemo } from "react";
import type { StationDto } from "../lib/types";
import {
  filterStations,
  sortStations,
  getAvailableFuels,
  getCityStateCollisionKeys,
  type StationSortOption,
} from "../lib/discovery";
import StationLedger from "./StationLedger";

interface StateStationListProps {
  stations: StationDto[];
  stateCode: string;
}

export default function StateStationList({ stations, stateCode }: StateStationListProps) {
  const [query, setQuery] = useState("");
  const [selectedFuel, setSelectedFuel] = useState("ALL");
  const [selectedSort, setSelectedSort] = useState<StationSortOption>("location-asc");

  const availableFuels = useMemo(() => getAvailableFuels(stations), [stations]);
  const collisionKeys = useMemo(() => getCityStateCollisionKeys(stations), [stations]);

  const filteredStations = useMemo(() => {
    return filterStations(stations, {
      query,
      fuelSku: selectedFuel,
    });
  }, [stations, query, selectedFuel]);

  const displayedStations = useMemo(() => {
    return sortStations(filteredStations, selectedSort, selectedFuel);
  }, [filteredStations, selectedSort, selectedFuel]);

  const hasActiveFilters =
    query.trim() !== "" ||
    selectedFuel !== "ALL" ||
    selectedSort !== "location-asc";

  const handleReset = () => {
    setQuery("");
    setSelectedFuel("ALL");
    setSelectedSort("location-asc");
  };

  return (
    <div className="directory-container" style={{ marginTop: "2rem" }}>
      <div className="directory-header">
        <h2 className="section-title">Stations in {stateCode}</h2>
        <p className="section-subtitle">
          Compare current prices and find your closest BJ&apos;s gas station in {stateCode}.
        </p>
      </div>

      {/* Filter & Sort Toolbar */}
      <div className="directory-toolbar">
        <div className="directory-toolbar-primary">
          {/* Search Input */}
          <div className="directory-search-field" role="search">
            <span className="directory-search-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              className="directory-search-input"
              placeholder="Search city, ZIP, or club"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search city, ZIP, or club"
            />
            {query && (
              <button
                type="button"
                className="directory-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search query"
              >
                &times;
              </button>
            )}
          </div>

          {/* Sort Selector */}
          <div className="directory-select-field">
            <label htmlFor="state-sort-select" className="sr-only">
              Sort stations
            </label>
            <select
              id="state-sort-select"
              className="directory-select"
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as StationSortOption)}
              aria-label="Sort stations"
            >
              <option value="location-asc">Location: A–Z</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="updated-desc">Recently updated</option>
            </select>
          </div>
        </div>

        {/* Secondary Toolbar: Fuel Pills & Meta summary */}
        <div className="directory-toolbar-secondary">
          <div
            className="directory-fuel-group"
            role="group"
            aria-label="Filter stations by fuel type"
          >
            <button
              type="button"
              className={`directory-fuel-chip ${selectedFuel === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedFuel("ALL")}
              aria-pressed={selectedFuel === "ALL"}
            >
              All fuels
            </button>
            {availableFuels.map((f) => (
              <button
                key={f.sku}
                type="button"
                className={`directory-fuel-chip ${selectedFuel === f.sku ? "active" : ""}`}
                onClick={() => setSelectedFuel(f.sku)}
                aria-pressed={selectedFuel === f.sku}
              >
                {f.name}
              </button>
            ))}
          </div>

          <div className="directory-meta">
            <span className="directory-count tabular-nums">
              {displayedStations.length === stations.length
                ? `${stations.length} locations`
                : `${displayedStations.length} of ${stations.length} locations`}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                className="directory-clear-btn"
                onClick={handleReset}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Shared Ledger Slate Station Ledger */}
      <StationLedger
        stations={displayedStations}
        collisionKeys={collisionKeys}
        selectedFuel={selectedFuel}
        onResetFilters={hasActiveFilters ? handleReset : undefined}
        ariaLabel={`BJ's Gas Stations in ${stateCode}`}
      />
    </div>
  );
}
