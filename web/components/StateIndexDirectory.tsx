"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StateSummaryItem } from "../lib/analytics";
import { formatPrice } from "../lib/stats";
import { getStateName, toStateSlug } from "../lib/states";
import {
  sortStates,
  filterStates,
  type StateSortOption,
} from "../lib/states-view";

interface StateIndexDirectoryProps {
  states: StateSummaryItem[];
}

export default function StateIndexDirectory({ states }: StateIndexDirectoryProps) {
  const [selectedSort, setSelectedSort] = useState<StateSortOption>("price-asc");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAndSorted = useMemo(() => {
    const filtered = filterStates(states, searchQuery);
    return sortStates(filtered, selectedSort);
  }, [states, selectedSort, searchQuery]);

  return (
    <div className="directory-container" style={{ marginTop: "2rem" }}>
      {/* Filter & Sort Toolbar */}
      <div className="directory-toolbar">
        <div className="directory-toolbar-primary">
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
              placeholder="Filter by state name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter by state name or code"
            />
            {searchQuery && (
              <button
                type="button"
                className="directory-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear state search"
              >
                &times;
              </button>
            )}
          </div>

          <div className="directory-select-field">
            <label htmlFor="state-sort-select" className="sr-only">
              Sort states
            </label>
            <select
              id="state-sort-select"
              className="directory-select"
              value={selectedSort}
              onChange={(e) => setSelectedSort(e.target.value as StateSortOption)}
              aria-label="Sort states"
            >
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="name-asc">State A–Z</option>
              <option value="stations-desc">Most locations</option>
            </select>
          </div>
        </div>

        <div className="directory-toolbar-secondary">
          <span className="directory-count">
            {filteredAndSorted.length} {filteredAndSorted.length === 1 ? "state" : "states"}
          </span>
          {searchQuery && (
            <button
              type="button"
              className="btn-clear-filters"
              onClick={() => setSearchQuery("")}
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* Empty State */}
      {filteredAndSorted.length === 0 ? (
        <div className="directory-empty-state">
          <h3 className="directory-empty-title">No matching states</h3>
          <p className="directory-empty-desc">
            Try another state name or clear your search query.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSearchQuery("")}
          >
            Clear filter
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table Presentation (Visible >= 640px) */}
          <div className="directory-table-wrapper">
            <table className="directory-table" aria-label="BJ's Gas Prices by State">
              <thead>
                <tr>
                  <th scope="col" className="col-location">
                    State
                  </th>
                  <th scope="col" className="col-price">
                    Median Regular
                  </th>
                  <th scope="col" style={{ width: "24%" }}>
                    Price Range
                  </th>
                  <th scope="col" style={{ width: "16%", textAlign: "right" }}>
                    Locations
                  </th>
                  <th scope="col" className="col-actions">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((item) => {
                  const stateName = getStateName(item.state);
                  const slug = toStateSlug(item.state);

                  return (
                    <tr key={item.state} className="directory-row">
                      <td className="col-location">
                        <div className="station-location-block">
                          <Link href={`/states/${slug}`} className="station-location-title">
                            {stateName}
                          </Link>
                          <span className="station-location-address">
                            {item.state} &bull; {item.stationCount}{" "}
                            {item.stationCount === 1 ? "location" : "locations"}
                          </span>
                        </div>
                      </td>

                      <td className="col-price">
                        <span className="station-price-primary tabular-nums">
                          {formatPrice(item.medianPrice)}
                        </span>
                      </td>

                      <td>
                        <span className="text-secondary text-sm tabular-nums">
                          {formatPrice(item.minPrice)} – {formatPrice(item.maxPrice)}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <span className="text-secondary text-sm font-medium tabular-nums">
                          {item.stationCount}
                        </span>
                      </td>

                      <td className="col-actions">
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem" }}>
                          <Link
                            href={`/map?state=${item.state}`}
                            className="station-map-action"
                            title={`View ${stateName} stations on map`}
                            aria-label={`View ${stateName} stations on map`}
                          >
                            Map &rarr;
                          </Link>
                          <Link
                            href={`/states/${slug}`}
                            className="btn btn-secondary btn-sm"
                            aria-label={`View ${stateName} gas prices`}
                          >
                            View state
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Clean Rows (Visible < 640px) */}
          <div className="state-mobile-list" aria-label="BJ's Gas Prices by State">
            {filteredAndSorted.map((item) => {
              const stateName = getStateName(item.state);
              const slug = toStateSlug(item.state);

              return (
                <div key={item.state} className="state-mobile-row">
                  <div className="state-mobile-top">
                    <Link href={`/states/${slug}`} className="state-mobile-title">
                      {stateName}
                    </Link>
                    <span className="state-mobile-price tabular-nums">
                      {formatPrice(item.medianPrice)}
                    </span>
                  </div>

                  <div className="state-mobile-sub">
                    <span>{item.stationCount} {item.stationCount === 1 ? "location" : "locations"}</span>
                    <span className="state-mobile-dot">&bull;</span>
                    <span className="tabular-nums">{formatPrice(item.minPrice)} – {formatPrice(item.maxPrice)}</span>
                  </div>

                  <div className="state-mobile-actions">
                    <Link
                      href={`/map?state=${item.state}`}
                      className="station-map-action text-sm"
                      aria-label={`View ${stateName} on map`}
                    >
                      Map &rarr;
                    </Link>
                    <Link
                      href={`/states/${slug}`}
                      className="btn btn-secondary btn-sm"
                      aria-label={`View ${stateName} prices`}
                    >
                      View state &rarr;
                    </Link>
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
