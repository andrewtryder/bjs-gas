import { useState, useMemo } from "react";
import type { StationDto } from "../lib/types";
import { filterStations, getAvailableStates } from "../lib/stations/filter";
import { getAvailableFuels } from "../lib/stations/fuels";
import { getCityStateCollisionKeys } from "../lib/stations/format";
import { sortStations, type StationSortOption } from "../lib/stations/sort";

export interface UseStationFiltersOptions {
  stations: StationDto[];
  initialState?: string;
  initialFuel?: string;
  initialSort?: StationSortOption;
  initialQuery?: string;
}

export function useStationFilters({
  stations,
  initialState = "ALL",
  initialFuel = "ALL",
  initialSort = "location-asc",
  initialQuery = "",
}: UseStationFiltersOptions) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedFuel, setSelectedFuel] = useState(initialFuel);
  const [selectedSort, setSelectedSort] = useState<StationSortOption>(initialSort);

  const availableStates = useMemo(() => getAvailableStates(stations), [stations]);
  const availableFuels = useMemo(() => getAvailableFuels(stations), [stations]);
  const collisionKeys = useMemo(() => getCityStateCollisionKeys(stations), [stations]);

  const filteredStations = useMemo(() => {
    return filterStations(stations, {
      query,
      state: selectedState,
      fuelSku: selectedFuel,
    });
  }, [stations, query, selectedState, selectedFuel]);

  const sortedStations = useMemo(() => {
    return sortStations(filteredStations, selectedSort, selectedFuel);
  }, [filteredStations, selectedSort, selectedFuel]);

  const hasActiveFilters =
    query.trim() !== "" ||
    selectedState !== "ALL" ||
    selectedFuel !== "ALL" ||
    selectedSort !== initialSort;

  const resetFilters = () => {
    setQuery("");
    setSelectedState("ALL");
    setSelectedFuel("ALL");
    setSelectedSort(initialSort);
  };

  return {
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
  };
}
