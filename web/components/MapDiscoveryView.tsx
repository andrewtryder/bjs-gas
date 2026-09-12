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
  stationsToGeoJson,
} from "../lib/discovery";
import { formatDate, formatPrice } from "../lib/stats";

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
}

export default function MapDiscoveryView({
  stations,
  initialState,
  initialStationNumber,
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
    setSelectedStation(null);
  };

  return (
    <div className="map-discovery-container">
      {/* Filter Control Bar */}
      <div className="discovery-filter-bar">
        <div className="discovery-search-wrapper" role="search">
          <input
            type="search"
            className="discovery-search-input"
            placeholder="Search by city, state, ZIP, or club name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search gas stations on map"
          />
          {searchQuery && (
            <button
              type="button"
              className="discovery-clear-search-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search text"
            >
              &times;
            </button>
          )}
        </div>

        <div className="discovery-select-wrapper">
          <label htmlFor="state-filter" className="discovery-select-label">
            State:
          </label>
          <select
            id="state-filter"
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
            {filteredStations.length} of {stations.length} stations
          </span>
          {(searchQuery || selectedState !== "ALL" || selectedFuel !== "ALL") && (
            <button
              type="button"
              className="discovery-reset-btn"
              onClick={handleClearFilters}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Sidebar + Map */}
      <div className="map-split-view">
        {/* Sidebar Station List & Selected Station Card */}
        <div className="discovery-sidebar">
          {selectedStation && (
            <div className="selected-station-card">
              <div className="selected-card-header">
                <div>
                  <span className="selected-card-badge">Selected Station</span>
                  <h3 className="selected-card-title">{selectedStation.name}</h3>
                  <div className="selected-card-club">
                    Club #{selectedStation.clubNumber} &bull; {selectedStation.city},{" "}
                    {selectedStation.state}
                  </div>
                </div>
                <button
                  type="button"
                  className="selected-card-close-btn"
                  onClick={() => setSelectedStation(null)}
                  title="Close station details"
                >
                  &times;
                </button>
              </div>

              <div className="selected-card-address">
                {selectedStation.address}, {selectedStation.city},{" "}
                {selectedStation.state} {selectedStation.postalCode}
              </div>

              <div className="selected-card-fuels">
                {selectedStation.fuels.length === 0 ? (
                  <span className="selected-card-no-fuel">No price data</span>
                ) : (
                  selectedStation.fuels.map((fuel: StationFuel) => (
                    <div key={fuel.sku} className="selected-card-fuel-pill">
                      <span className="selected-fuel-name">{fuel.name}</span>
                      <span className="selected-fuel-price">
                        {formatPrice(fuel.price)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="selected-card-footer">
                <Link
                  href={`/stations/${selectedStation.clubNumber}`}
                  className="selected-card-detail-link"
                >
                  View Station &amp; Price History &rarr;
                </Link>
              </div>
            </div>
          )}

          <div className="sidebar-list-header">
            <h3 className="sidebar-list-title">
              {selectedState !== "ALL" ? `${selectedState} Stations` : "All Stations"}
            </h3>
            <span className="sidebar-list-count">
              {filteredStations.length} match{filteredStations.length === 1 ? "" : "es"}
            </span>
          </div>

          <div className="sidebar-station-list">
            {filteredStations.length === 0 ? (
              <div className="discovery-empty-state">
                <p className="discovery-empty-title">No matching stations</p>
                <p className="discovery-empty-desc">
                  Try adjusting your search query, state, or fuel selection.
                </p>
                <button
                  type="button"
                  className="discovery-empty-reset-btn"
                  onClick={handleClearFilters}
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              filteredStations.map((station) => {
                const isSelected =
                  selectedStation?.clubNumber === station.clubNumber;
                const priceInfo = getStationPrice(station, selectedFuel);

                return (
                  <div
                    key={station.clubNumber}
                    className={`sidebar-station-item ${isSelected ? "active" : ""}`}
                    onClick={() => handleSelectStation(station)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleSelectStation(station);
                      }
                    }}
                  >
                    <div className="sidebar-item-content">
                      <div className="sidebar-item-header">
                        <span className="sidebar-item-name">{station.name}</span>
                        <span className="sidebar-item-price">
                          {priceInfo.priceFormatted}
                        </span>
                      </div>
                      <div className="sidebar-item-location">
                        {station.city}, {station.state} &bull; Club #{station.clubNumber}
                      </div>
                      {priceInfo.fuel && (
                        <div className="sidebar-item-fuel">
                          {priceInfo.fuel.name}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Map View */}
        <div className="discovery-map-pane">
          <InteractiveMap
            stationsGeoJson={stationsGeoJson}
            selectedStation={selectedStation}
            onSelectStation={handleSelectStation}
            stations={filteredStations}
          />
        </div>
      </div>
    </div>
  );
}
