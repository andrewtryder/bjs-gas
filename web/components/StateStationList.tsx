"use client";

import type { StationDto } from "../lib/types";
import type { StationSortOption } from "../lib/stations/sort";
import StationLedger from "./StationLedger";
import { useStationFilters } from "../hooks/useStationFilters";
import { FilterToolbar } from "./filters/FilterToolbar";
import { FuelFilter } from "./filters/FuelFilter";
import { SearchField } from "./filters/SearchField";
import { SelectField } from "./filters/SelectField";

interface StateStationListProps {
  stations: StationDto[];
  stateCode: string;
}

const SORT_OPTIONS: Array<{ value: StationSortOption; label: string }> = [
  { value: "location-asc", label: "Location: A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "updated-desc", label: "Recently updated" },
];

export default function StateStationList({ stations, stateCode }: StateStationListProps) {
  const {
    query,
    setQuery,
    selectedFuel,
    setSelectedFuel,
    selectedSort,
    setSelectedSort,
    availableFuels,
    collisionKeys,
    filteredStations,
    sortedStations,
    hasActiveFilters,
    resetFilters,
  } = useStationFilters({ stations });

  return (
    <div className="directory-container" style={{ marginTop: "2rem" }}>
      <div className="directory-header">
        <h2 className="section-title">Stations in {stateCode}</h2>
        <p className="section-subtitle">
          Compare current prices and find your closest BJ&apos;s gas station in {stateCode}.
        </p>
      </div>

      {/* Filter & Sort Toolbar */}
      <FilterToolbar
        totalCount={stations.length}
        filteredCount={filteredStations.length}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        primary={
          <>
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search city, ZIP, or club"
              ariaLabel="Search city, ZIP, or club"
            />
            <SelectField
              id="state-sort-select"
              label="Sort stations"
              value={selectedSort}
              onChange={(val) => setSelectedSort(val as StationSortOption)}
              options={SORT_OPTIONS}
            />
          </>
        }
        secondary={
          <FuelFilter
            fuels={availableFuels}
            selectedFuel={selectedFuel}
            onSelectFuel={setSelectedFuel}
            ariaLabel="Filter stations by fuel type"
          />
        }
      />

      {/* Shared Ledger Slate Station Ledger */}
      <StationLedger
        stations={sortedStations}
        collisionKeys={collisionKeys}
        selectedFuel={selectedFuel}
        onResetFilters={hasActiveFilters ? resetFilters : undefined}
        ariaLabel={`BJ's Gas Stations in ${stateCode}`}
      />
    </div>
  );
}
