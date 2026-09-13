"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import type { StationDto } from "../lib/types";
import {
  filterStations,
  getAvailableStates,
  getAvailableFuels,
  getCityStateCollisionKeys,
  getStationPrice,
  getCanonicalFuelPrices,
  formatStationTitle,
  formatFuelDisplayName,
  formatMapFreshnessText,
  syncSelectedStationWithFilter,
  getLatestObservation,
  stationsToGeoJson,
} from "../lib/discovery";
import { getFreshnessInfo } from "../lib/freshness";
import { STATE_NAMES } from "../lib/states";

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
  const collisionKeys = useMemo(() => getCityStateCollisionKeys(stations), [stations]);

  const filteredStations = useMemo(() => {
    return filterStations(stations, {
      query: searchQuery,
      state: selectedState,
      fuelSku: selectedFuel,
    });
  }, [stations, searchQuery, selectedState, selectedFuel]);

  // Synchronize selected station when filtered set changes (DS-4 Section 29)
  useEffect(() => {
    setSelectedStation((current) => syncSelectedStationWithFilter(current, filteredStations));
  }, [filteredStations]);

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
  const selectedStationPrice = selectedStation ? getStationPrice(selectedStation, selectedFuel) : null;
  const selectedCanonicalPrices = selectedStation ? getCanonicalFuelPrices(selectedStation) : null;
  const selectedStationFreshness = selectedStation
    ? getFreshnessInfo(getLatestObservation(selectedStation))
    : null;
  const selectedStationFreshnessText = formatMapFreshnessText(selectedStationFreshness);

  // Secondary fuels for selected station panel (DS-4 Section 9)
  const selectedStationSecondaryFuels = useMemo(() => {
    if (!selectedStation || !selectedCanonicalPrices) return [];
    const targetSku = selectedFuel.trim().toLowerCase();
    const fuels: Array<{ label: string; priceFormatted: string }> = [];

    if (targetSku === "4" || targetSku === "diesel") {
      if (selectedCanonicalPrices.regular.isAvailable) {
        fuels.push({ label: "Regular", priceFormatted: selectedCanonicalPrices.regular.priceFormatted });
      }
      if (selectedCanonicalPrices.premium.isAvailable) {
        fuels.push({ label: "Premium", priceFormatted: selectedCanonicalPrices.premium.priceFormatted });
      }
    } else if (targetSku === "3" || targetSku === "premium") {
      if (selectedCanonicalPrices.regular.isAvailable) {
        fuels.push({ label: "Regular", priceFormatted: selectedCanonicalPrices.regular.priceFormatted });
      }
      if (selectedCanonicalPrices.diesel.isAvailable) {
        fuels.push({ label: "Diesel", priceFormatted: selectedCanonicalPrices.diesel.priceFormatted });
      }
    } else {
      if (selectedCanonicalPrices.premium.isAvailable) {
        fuels.push({ label: "Premium", priceFormatted: selectedCanonicalPrices.premium.priceFormatted });
      }
      if (selectedCanonicalPrices.diesel.isAvailable) {
        fuels.push({ label: "Diesel", priceFormatted: selectedCanonicalPrices.diesel.priceFormatted });
      }
    }
    return fuels;
  }, [selectedStation, selectedCanonicalPrices, selectedFuel]);

  const sidebarHeading = selectedState !== "ALL"
    ? `${STATE_NAMES[selectedState] || selectedState} stations`
    : "Stations";

  return (
    <div className="map-discovery-v2">
      {/* Unified Filter Toolbar */}
      <div className="map-toolbar directory-toolbar" role="search">
        <div className="directory-toolbar-primary">
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
              aria-label="Search city, ZIP, or club"
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
          <div className="directory-select-field">
            <label htmlFor="map-state-select" className="sr-only">
              Filter by state
            </label>
            <select
              id="map-state-select"
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
              {filteredStations.length === stations.length
                ? `${stations.length} locations`
                : `${filteredStations.length} of ${stations.length} locations`}
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
      </div>

      {/* Main Split Layout: Sidebar + Map */}
      <div className="map-split-v2">
        {/* Desktop Sidebar */}
        <div className="map-sidebar-pane">
          {/* Selected Station Panel (Desktop - DS-4 Section 7) */}
          {selectedStation && (
            <div className="map-selected-panel">
              <div className="map-selected-header">
                <div className="map-selected-location">
                  <h3 className="map-selected-title">
                    {formatStationTitle(selectedStation, collisionKeys)}
                  </h3>
                  <p className="map-selected-address">
                    {selectedStation.address1 || selectedStation.address}
                  </p>
                </div>
                <button
                  type="button"
                  className="map-selected-close-btn"
                  onClick={() => handleSelectStation(null)}
                  aria-label="Dismiss selected station"
                >
                  &times;
                </button>
              </div>

              <div className="map-selected-price-block">
                <div className="map-selected-price tabular-nums">
                  {selectedStationPrice?.priceFormatted}
                </div>
                <div className="map-selected-fuel-label">
                  {selectedStationPrice?.fuel ? formatFuelDisplayName(selectedStationPrice.fuel.name) : "Regular"}
                </div>
              </div>

              {selectedStationSecondaryFuels.length > 0 && (
                <div className="map-selected-secondary-fuels">
                  {selectedStationSecondaryFuels.map((f) => (
                    <span key={f.label} className="map-selected-secondary-fuel">
                      <span className="map-selected-sec-label">{f.label}</span>{" "}
                      <span className="map-selected-sec-price tabular-nums">{f.priceFormatted}</span>
                    </span>
                  ))}
                </div>
              )}

              <div className="map-selected-footer">
                {selectedStationFreshnessText && (
                  <span className={`map-selected-freshness freshness-${selectedStationFreshness?.level || "fresh"}`}>
                    {selectedStationFreshnessText}
                  </span>
                )}
                <Link
                  href={`/stations/${selectedStation.clubNumber}`}
                  className="map-selected-detail-link"
                >
                  View club details &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* Station List Header (DS-4 Section 33) */}
          <div className="map-sidebar-list-header">
            <span className="map-sidebar-heading">{sidebarHeading}</span>
            <span className="map-sidebar-count tabular-nums">
              {filteredStations.length === stations.length
                ? `${stations.length} locations`
                : `${filteredStations.length} of ${stations.length} locations`}
            </span>
          </div>

          {/* Station Items List (DS-4 Section 12-16) */}
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
                        {formatStationTitle(station, collisionKeys)}
                      </span>
                      <span className="map-item-price tabular-nums">
                        {priceInfo.priceFormatted}
                      </span>
                    </div>

                    <div className="map-item-sub-row">
                      <span className="map-item-address">
                        {station.address1 || station.address}
                      </span>
                      <span className="map-item-fuel-label">
                        {priceInfo.fuel ? formatFuelDisplayName(priceInfo.fuel.name) : "Regular"}
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
            selectedFuel={selectedFuel}
            collisionKeys={collisionKeys}
            cartoApiKey={cartoApiKey}
          />

          {/* Mobile Bottom Sheet / Selected Station Floating Panel (DS-4 Section 18-19) */}
          {selectedStation && (
            <div className="map-mobile-station-panel" role="region" aria-label="Selected station details">
              <div className="map-mobile-panel-header">
                <div className="map-mobile-panel-info">
                  <h4 className="map-mobile-panel-title">
                    {formatStationTitle(selectedStation, collisionKeys)}
                  </h4>
                  <p className="map-mobile-panel-address">
                    {selectedStation.address1 || selectedStation.address}
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
                    {selectedStationPrice?.fuel ? formatFuelDisplayName(selectedStationPrice.fuel.name) : "Regular"}
                  </span>
                </div>

                <Link
                  href={`/stations/${selectedStation.clubNumber}`}
                  className="map-mobile-detail-link"
                >
                  View club details &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

