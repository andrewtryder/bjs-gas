import type { StationDto } from "../types";

/**
 * Validates that a list of stations does not contain duplicate clubNumber values.
 * Identifies duplicate clubNumber occurrences as invalid data conditions,
 * while verifying distinct clubNumber stations (even in the same city/state) are valid.
 */
export function validateUniqueStations(stations: StationDto[]): {
  isValid: boolean;
  duplicateClubNumbers: number[];
} {
  const seen = new Set<number>();
  const duplicates = new Set<number>();

  for (const s of stations) {
    if (seen.has(s.clubNumber)) {
      duplicates.add(s.clubNumber);
    } else {
      seen.add(s.clubNumber);
    }
  }

  return {
    isValid: duplicates.size === 0,
    duplicateClubNumbers: Array.from(duplicates),
  };
}

/**
 * Synchronizes selected station with the currently filtered station list.
 * If the selected station is no longer present in the filtered set, returns null.
 */
export function syncSelectedStationWithFilter(
  selectedStation: StationDto | null,
  filteredStations: StationDto[],
): StationDto | null {
  if (!selectedStation) return null;
  const exists = filteredStations.some((s) => s.clubNumber === selectedStation.clubNumber);
  return exists ? selectedStation : null;
}
