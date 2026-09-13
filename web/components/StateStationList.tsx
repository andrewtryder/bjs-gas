"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { StationDto } from "../lib/types";
import {
  filterStations,
  sortStations,
  getAvailableFuels,
  getCityStateCollisionKeys,
  getPrimaryFuel,
  getStationPrice,
  getLatestObservation,
  type StationSortOption,
} from "../lib/discovery";
import { formatPrice } from "../lib/stats";
import { getFreshnessInfo } from "../lib/freshness";

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

      {/* Directory Content */}
      {displayedStations.length === 0 ? (
        <div className="directory-empty-card" role="status">
          <div className="directory-empty-icon" aria-hidden="true">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          </div>
          <h3 className="directory-empty-title">No matching stations</h3>
          <p className="directory-empty-desc">
            Try another city, ZIP code, or remove a filter.
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm directory-empty-action"
              onClick={handleReset}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="directory-view-wrapper">
          {/* Desktop Table View */}
          <div className="directory-table-wrapper">
            <table className="directory-table" aria-label={`BJ's Gas Stations in ${stateCode}`}>
              <thead>
                <tr>
                  <th scope="col" className="directory-col-location">
                    Station / Location
                  </th>
                  <th scope="col" className="directory-col-regular">
                    Regular
                  </th>
                  <th scope="col" className="directory-col-other">
                    Other fuels
                  </th>
                  <th scope="col" className="directory-col-updated">
                    Updated
                  </th>
                  <th scope="col" className="directory-col-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedStations.map((station) => {
                  const targetPrice = getStationPrice(station, selectedFuel);
                  const primaryFuel = getPrimaryFuel(station.fuels);
                  const displayFuel = selectedFuel !== "ALL" ? targetPrice.fuel : primaryFuel;
                  const displayPrice =
                    selectedFuel !== "ALL"
                      ? targetPrice.priceFormatted
                      : primaryFuel
                      ? formatPrice(primaryFuel.price)
                      : "—";

                  const otherFuels = station.fuels.filter((f) => f !== displayFuel);
                  const latestObservation = getLatestObservation(station);
                  const freshness = getFreshnessInfo(latestObservation);

                  return (
                    <tr key={station.clubNumber} className="directory-row">
                      <td className="directory-cell-location col-location">
                        <div className="station-location-block">
                          <Link
                            href={`/stations/${station.clubNumber}`}
                            className="station-location-title directory-station-link hover:underline"
                          >
                            <span className="directory-station-city">
                              {station.city}, {station.state}
                            </span>
                            {collisionKeys.has(`${station.city.toLowerCase().trim()}, ${station.state.toLowerCase().trim()}`) && (
                              <span className="station-location-qualifier"> · #{station.clubNumber}</span>
                            )}
                          </Link>
                          <div className="station-location-sub directory-station-subtext">
                            {station.address1 || station.address} &middot; Club #{station.clubNumber}
                          </div>
                        </div>
                      </td>

                      <td className="directory-cell-regular">
                        <span className="directory-primary-price tabular-nums">
                          {displayPrice}
                        </span>
                      </td>

                      <td className="directory-cell-other">
                        {otherFuels.length === 0 ? (
                          <span className="directory-none-muted">—</span>
                        ) : (
                          <div className="directory-other-fuels-inline">
                            {otherFuels.map((f) => {
                              const p = Number.parseFloat(f.price);
                              const isAvail = Number.isFinite(p) && p > 0;
                              const shortName = f.name.toLowerCase().includes("premium")
                                ? "Prem"
                                : f.name.toLowerCase().includes("diesel")
                                ? "Dsl"
                                : f.name;
                              return (
                                <span key={f.sku} className="directory-other-fuel-tag">
                                  <span className="directory-other-fuel-name">{shortName}</span>
                                  <span className="directory-other-fuel-price tabular-nums">
                                    {isAvail ? formatPrice(p) : "—"}
                                  </span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="directory-cell-updated">
                        <span
                          className="directory-updated-text"
                          title={latestObservation ? `Exact time: ${new Date(latestObservation).toLocaleString()}` : undefined}
                        >
                          {freshness.relativeText}
                          {freshness.level === "aging" && (
                            <span className="directory-freshness-tag aging"> &bull; Aging</span>
                          )}
                          {freshness.level === "stale" && (
                            <span className="directory-freshness-tag stale"> &bull; Stale</span>
                          )}
                        </span>
                      </td>

                      <td className="directory-cell-actions">
                        <Link
                          href={`/map?station=${station.clubNumber}`}
                          className="directory-map-action-link hover:underline"
                          aria-label={`View ${station.city} station on map`}
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

          {/* Mobile Card View */}
          <div className="directory-cards-wrapper" aria-label={`BJ's Gas Stations in ${stateCode}`}>
            {displayedStations.map((station) => {
              const targetPrice = getStationPrice(station, selectedFuel);
              const primaryFuel = getPrimaryFuel(station.fuels);
              const displayFuel = selectedFuel !== "ALL" ? targetPrice.fuel : primaryFuel;
              const displayPrice =
                selectedFuel !== "ALL"
                  ? targetPrice.priceFormatted
                  : primaryFuel
                  ? formatPrice(primaryFuel.price)
                  : "—";

              const otherFuels = station.fuels.filter((f) => f !== displayFuel);
              const latestObservation = getLatestObservation(station);
              const freshness = getFreshnessInfo(latestObservation);

              return (
                <div key={station.clubNumber} className="station-mobile-card">
                  <div className="mobile-card-top">
                    <div className="mobile-card-location">
                      <Link
                        href={`/stations/${station.clubNumber}`}
                        className="mobile-card-title hover:underline"
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
                      <span
                        className={`freshness-text ${
                          freshness.level === "aging"
                            ? "text-warning"
                            : freshness.level === "stale"
                            ? "text-higher"
                            : "text-muted"
                        }`}
                        title={latestObservation ? `Exact time: ${new Date(latestObservation).toLocaleString()}` : undefined}
                      >
                        {freshness.relativeText}
                        {freshness.level === "aging" && " · Aging"}
                        {freshness.level === "stale" && " · Stale"}
                      </span>
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
                        className="btn btn-primary btn-sm"
                        aria-label={`View ${station.city} on map`}
                      >
                        Map
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
