"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

import type { StationDto } from "../lib/types";
import {
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
import { useStationFilters } from "../hooks/useStationFilters";
import { FilterToolbar } from "./filters/FilterToolbar";
import { FuelFilter } from "./filters/FuelFilter";
import { SearchField } from "./filters/SearchField";
import { SelectField } from "./filters/SelectField";

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
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    selectedState,
    setSelectedState,
    selectedFuel,
    setSelectedFuel,
    availableStates,
    availableFuels,
    collisionKeys,
    filteredStations,
    hasActiveFilters,
    resetFilters: handleClearFilters,
  } = useStationFilters({
    stations,
    initialState: initialState || "ALL",
  });

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
  }, [initialState, setSelectedState]);

  useEffect(() => {
    if (initialStationNumber != null) {
      const target = stations.find((s) => s.clubNumber === initialStationNumber) || null;
      if (target) {
        setSelectedStation(target);
      }
    }
  }, [initialStationNumber, stations]);

  // Synchronize selected station when filtered set changes (DS-4 Section 29)
  useEffect(() => {
    setSelectedStation((current) => syncSelectedStationWithFilter(current, filteredStations));
  }, [filteredStations]);

  const stationsGeoJson = useMemo(() => {
    return stationsToGeoJson(filteredStations, selectedFuel);
  }, [filteredStations, selectedFuel]);

  const handleSelectStation = useCallback((station: StationDto | null) => {
    setSelectedStation(station);
  }, []);

  const stateOptions = useMemo(
    () => [
      { value: "ALL", label: "All states" },
      ...availableStates.map((s) => ({
        value: s.state,
        label: `${s.state} (${s.count})`,
      })),
    ],
    [availableStates]
  );

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
      <FilterToolbar
        className="map-toolbar directory-toolbar"
        totalCount={stations.length}
        filteredCount={filteredStations.length}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleClearFilters}
        primary={
          <>
            <SearchField
              id="map-station-search"
              ariaLabel="Search city, ZIP, or club"
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search city, ZIP, or club"
            />
            <SelectField
              id="map-state-select"
              label="Filter by state"
              value={selectedState}
              onChange={setSelectedState}
              options={stateOptions}
            />
          </>
        }
        secondary={
          <FuelFilter
            fuels={availableFuels}
            selectedFuel={selectedFuel}
            onSelectFuel={setSelectedFuel}
          />
        }
      />

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
          <div className="map-sidebar-list">
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
