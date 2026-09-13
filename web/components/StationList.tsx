"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StationDto } from "../lib/types";
import { formatDate, formatPrice } from "../lib/stats";
import { getFreshnessInfo } from "../lib/freshness";
import {
  filterStations,
  getAvailableStates,
  getAvailableFuels,
  getCityStateCollisionKeys,
  getLatestObservation,
  getPrimaryFuel,
  getStationPrice,
  sortStations,
  type StationSortOption,
} from "../lib/discovery";

interface StationListProps {
  stations: StationDto[];
}

export default function StationList({ stations }: StationListProps) {
  const [query, setQuery] = useState("");
  const [selectedState, setSelectedState] = useState("ALL");
  const [selectedFuel, setSelectedFuel] = useState("ALL");
  const [selectedSort, setSelectedSort] = useState<StationSortOption>("location-asc");

  const availableStates = useMemo(() => getAvailableStates(stations), [stations]);
  const availableFuels = useMemo(() => getAvailableFuels(stations), [stations]);
  const collisionKeys = useMemo(() => getCityStateCollisionKeys(stations), [stations]);

  // 1. Filter
  const filtered = useMemo(() => {
    return filterStations(stations, {
      query,
      state: selectedState,
      fuelSku: selectedFuel,
    });
  }, [stations, query, selectedState, selectedFuel]);

  // 2. Sort
  const sortedAndFiltered = useMemo(() => {
    return sortStations(filtered, selectedSort, selectedFuel);
  }, [filtered, selectedSort, selectedFuel]);

  const hasActiveFilters =
    query.trim() !== "" ||
    selectedState !== "ALL" ||
    selectedFuel !== "ALL" ||
    selectedSort !== "location-asc";

  const handleReset = () => {
    setQuery("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
    setSelectedSort("location-asc");
  };

  return (
    <div className="directory-container">
      {/* Refined Filter & Sort Toolbar */}
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

          {/* State Filter */}
          <div className="directory-select-field">
            <label htmlFor="directory-state-select" className="sr-only">
              Filter by state
            </label>
            <select
              id="directory-state-select"
              className="directory-select"
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              aria-label="Filter by state"
            >
              <option value="ALL">All states</option>
              {availableStates.map((s) => (
                <option key={s.state} value={s.state}>
                  {s.state} ({s.count})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="directory-select-field">
            <label htmlFor="directory-sort-select" className="sr-only">
              Sort stations
            </label>
            <select
              id="directory-sort-select"
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
            aria-label="Filter by fuel type"
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
              {filtered.length === stations.length
                ? `${stations.length} locations`
                : `${filtered.length} of ${stations.length} locations`}
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

      {/* Empty State */}
      {sortedAndFiltered.length === 0 ? (
        <div className="directory-empty-state">
          <h3 className="directory-empty-title">No matching stations</h3>
          <p className="directory-empty-desc">
            Try another city, ZIP code, or remove a filter.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table Presentation (Visible >= 640px) */}
          <div className="directory-table-wrapper">
            <table className="directory-table" aria-label="BJ's Gas Stations Directory">
              <thead>
                <tr>
                  <th scope="col" className="col-location">
                    Station / Location
                  </th>
                  <th scope="col" className="col-price">
                    {selectedFuel !== "ALL"
                      ? availableFuels.find((f) => f.sku === selectedFuel)?.name || "Price"
                      : "Regular"}
                  </th>
                  <th scope="col" className="col-other-fuels">
                    Other fuels
                  </th>
                  <th scope="col" className="col-updated">
                    Updated
                  </th>
                  <th scope="col" className="col-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFiltered.map((station) => {
                  const targetPrice = getStationPrice(station, selectedFuel);
                  const primaryFuel = getPrimaryFuel(station.fuels);
                  const displayFuel = selectedFuel !== "ALL" ? targetPrice.fuel : primaryFuel;
                  const displayPrice = selectedFuel !== "ALL" ? targetPrice.priceFormatted : (primaryFuel ? formatPrice(primaryFuel.price) : "—");
                  const otherFuels = station.fuels.filter((f) => f !== displayFuel);

                  const latestObs = getLatestObservation(station);
                  const freshness = latestObs ? getFreshnessInfo(latestObs) : null;

                  return (
                    <tr key={station.clubNumber} className="directory-row">
                      <td className="col-location">
                        <div className="station-location-block">
                          <Link
                            href={`/stations/${station.clubNumber}`}
                            className="station-location-title"
                          >
                            <span>{station.city}, {station.state}</span>
                            {collisionKeys.has(`${station.city.toLowerCase().trim()}, ${station.state.toLowerCase().trim()}`) && (
                              <span className="station-location-qualifier"> · #{station.clubNumber}</span>
                            )}
                          </Link>
                          <span className="station-location-sub">
                            {station.address1 || station.address} &middot; Club #{station.clubNumber}
                          </span>
                        </div>
                      </td>

                      <td className="col-price">
                        <div className="station-primary-price tabular-nums">
                          {displayPrice}
                        </div>
                        <span className="station-price-label">
                          {displayFuel ? displayFuel.name : "Regular"}
                        </span>
                      </td>

                      <td className="col-other-fuels">
                        {otherFuels.length === 0 ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <div className="other-fuels-row">
                            {otherFuels.map((f) => (
                              <span key={f.sku} className="other-fuel-pill tabular-nums">
                                <span className="other-fuel-name">{f.name}</span>
                                <span className="other-fuel-val">{formatPrice(f.price)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="col-updated">
                        {freshness ? (
                          <span
                            className={`freshness-text ${
                              freshness.level === "aging"
                                ? "text-warning"
                                : freshness.level === "stale"
                                ? "text-higher"
                                : "text-muted"
                            }`}
                            title={latestObs ? formatDate(latestObs) : undefined}
                          >
                            {freshness.relativeText}
                            {freshness.level === "aging" && " · Aging"}
                            {freshness.level === "stale" && " · Stale"}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>

                      <td className="col-actions">
                        <Link
                          href={`/map?station=${station.clubNumber}`}
                          className="station-map-action"
                          title={`View ${station.city}, ${station.state} on map`}
                          aria-label={`View ${station.city}, ${station.state} on map`}
                        >
                          Map &rarr;
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Purpose-Built Mobile Cards (Visible < 640px) */}
          <div className="directory-cards-wrapper" aria-label="BJ's Gas Stations">
            {sortedAndFiltered.map((station) => {
              const targetPrice = getStationPrice(station, selectedFuel);
              const primaryFuel = getPrimaryFuel(station.fuels);
              const displayFuel = selectedFuel !== "ALL" ? targetPrice.fuel : primaryFuel;
              const displayPrice = selectedFuel !== "ALL" ? targetPrice.priceFormatted : (primaryFuel ? formatPrice(primaryFuel.price) : "—");
              const otherFuels = station.fuels.filter((f) => f !== displayFuel);

              const latestObs = getLatestObservation(station);
              const freshness = latestObs ? getFreshnessInfo(latestObs) : null;

              return (
                <div key={station.clubNumber} className="station-mobile-card">
                  <div className="mobile-card-top">
                    <div className="mobile-card-location">
                      <Link
                        href={`/stations/${station.clubNumber}`}
                        className="mobile-card-title"
                      >
                        <span>{station.city}, {station.state}</span>
                        {collisionKeys.has(`${station.city.toLowerCase().trim()}, ${station.state.toLowerCase().trim()}`) && (
                          <span className="station-location-qualifier"> · #{station.clubNumber}</span>
                        )}
                      </Link>
                      <div className="mobile-card-address">
                        {station.address1 || station.address} &middot; Club #{station.clubNumber}
                      </div>
                    </div>

                    <div className="mobile-card-price-block">
                      <span className="mobile-card-price tabular-nums">
                        {displayPrice}
                      </span>
                      <span className="mobile-card-fuel-label">
                        {displayFuel ? displayFuel.name : "Regular"}
                      </span>
                    </div>
                  </div>

                  {otherFuels.length > 0 && (
                    <div className="mobile-card-other-fuels">
                      {otherFuels.map((f) => (
                        <span key={f.sku} className="other-fuel-pill tabular-nums">
                          <span className="other-fuel-name">{f.name}</span>
                          <span className="other-fuel-val">{formatPrice(f.price)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mobile-card-bottom">
                    <div className="mobile-card-freshness">
                      {freshness ? (
                        <span
                          className={`freshness-text ${
                            freshness.level === "aging"
                              ? "text-warning"
                              : freshness.level === "stale"
                              ? "text-higher"
                              : "text-muted"
                          }`}
                          title={latestObs ? formatDate(latestObs) : undefined}
                        >
                          {freshness.relativeText}
                          {freshness.level === "aging" && " · Aging"}
                          {freshness.level === "stale" && " · Stale"}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>

                    <div className="mobile-card-actions">
                      <Link
                        href={`/stations/${station.clubNumber}`}
                        className="btn btn-secondary btn-sm"
                      >
                        Details
                      </Link>
                      <Link
                        href={`/map?station=${station.clubNumber}`}
                        className="btn btn-secondary btn-sm"
                        aria-label={`View ${station.city}, ${station.state} on map`}
                      >
                        Map
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
