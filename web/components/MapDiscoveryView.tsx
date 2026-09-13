"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import type { StationDto, StationFuel } from "../lib/types";
import {
  filterStations,
  getAvailableStates,
  getAvailableFuels,
  getStationPrice,
  getPrimaryFuel,
  getLatestObservation,
  stationsToGeoJson,
} from "../lib/discovery";
import { formatPrice } from "../lib/stats";
import { getFreshnessInfo } from "../lib/freshness";

// Dynamically import InteractiveMap without SSR since MapLibre GL is browser-only
const InteractiveMap = dynamic(() => import("./InteractiveMap"), {
  ssr: false,
  loading: () => (
    <div className="map-loading-placeholder">
      <div className="map-loading-spinner" />
      <p>Loading interactive fuel map...</p>
    </div>
  ),
});

interface MapDiscoveryViewProps {
  stations: StationDto[];
  initialState?: string;
  initialStationNumber?: number;
  cartoApiKey?: string | null;
}

export default function MapDiscoveryView({
  stations,
  initialState,
  initialStationNumber,
  cartoApiKey,
}: MapDiscoveryViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedState, setSelectedState] = useState(initialState || "ALL");
  const [selectedFuel, setSelectedFuel] = useState("ALL");
  const [selectedStation, setSelectedStation] = useState<StationDto | null>(() => {
    if (initialStationNumber != null) {
      return stations.find((s) => s.clubNumber === initialStationNumber) || null;
    }
    return null;
  });

  useEffect(() => {
    if (initialState) {
      setSelectedState(initialState);
    }
  }, [initialState]);

  useEffect(() => {
    if (initialStationNumber != null) {
      const target = stations.find((s) => s.clubNumber === initialStationNumber) || null;
      if (target) {
        setSelectedStation(target);
      }
    }
  }, [initialStationNumber, stations]);

  const availableStates = useMemo(() => getAvailableStates(stations), [stations]);
  const availableFuels = useMemo(() => getAvailableFuels(stations), [stations]);

  const filteredStations = useMemo(() => {
    return filterStations(stations, {
      query: searchQuery,
      state: selectedState,
      fuelSku: selectedFuel,
    });
  }, [stations, searchQuery, selectedState, selectedFuel]);

  const stationsGeoJson = useMemo(() => {
    return stationsToGeoJson(filteredStations, selectedFuel);
  }, [filteredStations, selectedFuel]);

  const handleSelectStation = (station: StationDto | null) => {
    setSelectedStation(station);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
  };

  const hasActiveFilters = searchQuery.trim() !== "" || selectedState !== "ALL" || selectedFuel !== "ALL";

  // Selected station summary details
  const selectedStationFuel = selectedStation ? getPrimaryFuel(selectedStation.fuels) : null;
  const selectedStationPrice = selectedStation ? getStationPrice(selectedStation, selectedFuel) : null;
  const selectedStationFreshness = selectedStation
    ? getFreshnessInfo(getLatestObservation(selectedStation))
    : null;

  return (
    <div className="map-discovery-v2">
      {/* Unified Filter Toolbar */}
      <div className="map-toolbar directory-toolbar" role="search">
        {/* Search Field */}
        <div className="directory-search-field">
          <label htmlFor="map-station-search" className="sr-only">
            Search gas stations on map
          </label>
          <span className="directory-search-icon" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="8.5" cy="8.5" r="5.5" />
              <line x1="12.5" y1="12.5" x2="18" y2="18" />
            </svg>
          </span>
          <input
            id="map-station-search"
            type="search"
            className="directory-search-input"
            placeholder="Search city, ZIP, or club"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="directory-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* State Selector */}
        <div className="directory-select-wrapper">
          <label htmlFor="map-state-select" className="sr-only">
            Filter by state
          </label>
          <select
            id="map-state-select"
            className="directory-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
          >
            <option value="ALL">All states</option>
            {availableStates.map((s) => (
              <option key={s.state} value={s.state}>
                {s.state} ({s.count})
              </option>
            ))}
          </select>
        </div>

        {/* Fuel Pill Toggles */}
        <div className="directory-fuel-segments" role="group" aria-label="Filter by fuel type">
          <button
            type="button"
            className={`directory-fuel-pill ${selectedFuel === "ALL" ? "active" : ""}`}
            onClick={() => setSelectedFuel("ALL")}
          >
            All fuels
          </button>
          {availableFuels.map((f) => (
            <button
              key={f.sku}
              type="button"
              className={`directory-fuel-pill ${selectedFuel === f.sku ? "active" : ""}`}
              onClick={() => setSelectedFuel(f.sku)}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Status Count & Clear Action */}
        <div className="directory-status-group">
          <span className="directory-count-badge">
            {hasActiveFilters
              ? `${filteredStations.length} of ${stations.length} locations`
              : `${stations.length} locations`}
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              className="directory-clear-btn"
              onClick={handleClearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Sidebar + Map */}
      <div className="map-split-v2">
        {/* Desktop Sidebar */}
        <div className="map-sidebar-pane">
          {/* Selected Station Sticky Banner */}
          {selectedStation && (
            <div className="map-selected-banner">
              <div className="map-selected-header">
                <div>
                  <h3 className="map-selected-title">
                    {selectedStation.city}, {selectedStation.state}
                  </h3>
                  <p className="map-selected-address">
                    {selectedStation.address} &bull; #{selectedStation.clubNumber}
                  </p>
                </div>
                <button
                  type="button"
                  className="map-selected-close-btn"
                  onClick={() => handleSelectStation(null)}
                  aria-label="Close selected station"
                >
                  &times;
                </button>
              </div>

              <div className="map-selected-price-row">
                <div className="map-selected-price tabular-nums">
                  {selectedStationPrice?.priceFormatted}
                </div>
                <div className="map-selected-fuel">
                  {selectedStationPrice?.fuel?.name || "Regular"}
                </div>
              </div>

              {selectedStation.fuels.length > 1 && (
                <div className="map-selected-other-fuels">
                  {selectedStation.fuels
                    .filter((f) => f.sku !== selectedStationFuel?.sku)
                    .map((f: StationFuel) => (
                      <span key={f.sku} className="map-selected-fuel-pill">
                        {f.name} {formatPrice(f.price)}
                      </span>
                    ))}
                </div>
              )}

              <div className="map-selected-footer">
                {selectedStationFreshness && (
                  <span className="map-selected-freshness">
                    {selectedStationFreshness.relativeText}
                  </span>
                )}
                <Link
                  href={`/stations/${selectedStation.clubNumber}`}
                  className="map-selected-detail-link"
                >
                  Details &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Station List Header */}
          <div className="map-sidebar-list-header">
            <span className="map-sidebar-heading">
              {selectedState !== "ALL" ? `${selectedState} stations` : "Stations"}
            </span>
            <span className="map-sidebar-count">
              {filteredStations.length} locations
            </span>
          </div>

          {/* Station Items List */}
          <div className="map-sidebar-list" role="list">
            {filteredStations.length === 0 ? (
              <div className="map-empty-state">
                <p className="map-empty-title">No matching stations</p>
                <p className="map-empty-desc">
                  Try another city, ZIP code, or remove a filter.
                </p>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearFilters}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              filteredStations.map((station) => {
                const isSelected = selectedStation?.clubNumber === station.clubNumber;
                const priceInfo = getStationPrice(station, selectedFuel);

                return (
                  <button
                    type="button"
                    key={station.clubNumber}
                    className={`map-sidebar-item ${isSelected ? "active" : ""}`}
                    onClick={() => handleSelectStation(station)}
                    aria-pressed={isSelected}
                  >
                    <div className="map-item-top-row">
                      <span className="map-item-city">
                        {station.city}, {station.state}
                      </span>
                      <span className="map-item-price tabular-nums">
                        {priceInfo.priceFormatted}
                      </span>
                    </div>

                    <div className="map-item-sub-row">
                      <span className="map-item-address">
                        {station.address} &bull; #{station.clubNumber}
                      </span>
                      <span className="map-item-fuel-label">
                        {priceInfo.fuel ? priceInfo.fuel.name : "Regular"}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map Pane */}
        <div className="map-canvas-pane">
          <InteractiveMap
            stationsGeoJson={stationsGeoJson}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            stations={filteredStations}
            cartoApiKey={cartoApiKey}
          />

          {/* Mobile Bottom Sheet / Selected Station Floating Panel */}
          {selectedStation && (
            <div className="map-mobile-station-panel" role="region" aria-label="Selected station details">
              <div className="map-mobile-panel-header">
                <div>
                  <h4 className="map-mobile-panel-title">
                    {selectedStation.city}, {selectedStation.state}
                  </h4>
                  <p className="map-mobile-panel-address">
                    {selectedStation.address} &bull; #{selectedStation.clubNumber}
                  </p>
                </div>
                <button
                  type="button"
                  className="map-mobile-panel-close"
                  onClick={() => handleSelectStation(null)}
                  aria-label="Dismiss selected station"
                >
                  &times;
                </button>
              </div>

              <div className="map-mobile-panel-body">
                <div className="map-mobile-price-group">
                  <span className="map-mobile-price tabular-nums">
                    {selectedStationPrice?.priceFormatted}
                  </span>
                  <span className="map-mobile-fuel">
                    {selectedStationPrice?.fuel?.name || "Regular"}
                  </span>
                </div>

                <Link
                  href={`/stations/${selectedStation.clubNumber}`}
                  className="btn btn-primary btn-sm"
                >
                  Details &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
