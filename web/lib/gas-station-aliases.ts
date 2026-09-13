/**
 * Web-side gas station alias registry.
 *
 * Maps aliased parent warehouse club numbers (e.g. 321 for Hyannis) to their canonical
 * dedicated gas station club numbers (e.g. 902 for Hyannis Gas Station).
 *
 * The physical fuel dispensers are at the dedicated station addresses (898-905 series),
 * while BJ's upstream pricing telemetry attaches to the parent warehouse club numbers.
 * Canonical dedicated stations are the public-facing gas station records.
 *
 * Import and redeploy this file if the mapping changes; it is the single source of truth
 * for the web layer's alias resolution.
 */
export const GAS_STATION_ALIASES: Record<number, number> = {
  38: 901,   // Auburn → Auburn Gas Station
  55: 905,   // South Attleboro → Attleboro Gas Station
  60: 903,   // Columbia → Columbia Gas Station
  69: 898,   // Fredericksburg → Fredericksburg Gas Station
  208: 900,  // Johnston → Johnston Gas Station
  321: 902,  // Hyannis → Hyannis Gas Station
  353: 899,  // Quincy → Quincy Gas Station
} as const;

/**
 * If clubNumber is an aliased parent warehouse, return its canonical dedicated gas station.
 * Otherwise return clubNumber unchanged.
 */
export function getCanonicalGasClub(clubNumber: number): number {
  return GAS_STATION_ALIASES[clubNumber] ?? clubNumber;
}

/**
 * Returns true if clubNumber is an aliased parent warehouse with a canonical dedicated station.
 */
export function isAliasedParentClub(clubNumber: number): boolean {
  return GAS_STATION_ALIASES[clubNumber] !== undefined;
}
