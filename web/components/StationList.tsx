"use client";

import type { StationDto } from "../lib/types";
import type { StationSortOption } from "../lib/stations/sort";
import StationLedger from "./StationLedger";
import { useStationFilters } from "../hooks/useStationFilters";
import { FilterToolbar } from "./filters/FilterToolbar";
import { FuelFilter } from "./filters/FuelFilter";
import { SearchField } from "./filters/SearchField";
import { SelectField } from "./filters/SelectField";

interface StationListProps {
  stations: StationDto[];
}

const SORT_OPTIONS: Array<{ value: StationSortOption; label: string }> = [
  { value: "location-asc", label: "Location: A–Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "updated-desc", label: "Recently updated" },
];

export default function StationList({ stations }: StationListProps) {
  const {
    query,
    setQuery,
    selectedState,
    setSelectedState,
    selectedFuel,
    setSelectedFuel,
    selectedSort,
    setSelectedSort,
    availableStates,
    availableFuels,
    collisionKeys,
    filteredStations,
    sortedStations,
    hasActiveFilters,
    resetFilters,
  } = useStationFilters({ stations });

  const stateOptions = [
    { value: "ALL", label: "All states" },
    ...availableStates.map((s) => ({
      value: s.state,
      label: `${s.state} (${s.count})`,
    })),
  ];

  return (
    <div className="directory-container">
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
              id="directory-state-select"
              label="Filter by state"
              value={selectedState}
              onChange={setSelectedState}
              options={stateOptions}
            />
            <SelectField
              id="directory-sort-select"
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
          />
        }
      />

      <StationLedger
        stations={sortedStations}
        collisionKeys={collisionKeys}
        selectedFuel={selectedFuel}
        onResetFilters={hasActiveFilters ? resetFilters : undefined}
        ariaLabel="BJ's Gas Stations Directory"
      />
    </div>
  );
}
