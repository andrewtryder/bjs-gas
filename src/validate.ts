import type { BjsClub, DiscoverySummary } from "./types.js";

const MIN_CLUBS = 200;
const MAX_MISSING_LOCATION_RATIO = 0.1;
const MAX_UNKNOWN_GAS_RATIO = 0.02;

export type ValidationIssue = {
  code: string;
  message: string;
};

export function validateClubs(
  clubs: BjsClub[],
  options: { requireKnownGas?: boolean } = {},
): ValidationIssue[] {
  const requireKnownGas = options.requireKnownGas ?? true;
  const issues: ValidationIssue[] = [];

  if (clubs.length < MIN_CLUBS) {
    issues.push({
      code: "too_few_clubs",
      message: `Implausibly small club count: ${clubs.length} (expected at least ${MIN_CLUBS})`,
    });
  }

  const byNumber = new Map<number, number>();
  const byId = new Map<string, number>();
  for (const club of clubs) {
    byNumber.set(club.clubNumber, (byNumber.get(club.clubNumber) ?? 0) + 1);
    byId.set(club.clubId, (byId.get(club.clubId) ?? 0) + 1);
  }

  const dupNumbers = [...byNumber.entries()].filter(([, count]) => count > 1);
  if (dupNumbers.length > 0) {
    issues.push({
      code: "duplicate_club_number",
      message: `Duplicate clubNumber values: ${dupNumbers
        .slice(0, 10)
        .map(([n, c]) => `${n}×${c}`)
        .join(", ")}`,
    });
  }

  const dupIds = [...byId.entries()].filter(([, count]) => count > 1);
  if (dupIds.length > 0) {
    issues.push({
      code: "duplicate_club_id",
      message: `Duplicate clubId values: ${dupIds
        .slice(0, 10)
        .map(([id, c]) => `${id}×${c}`)
        .join(", ")}`,
    });
  }

  if (clubs.length > 0) {
    const missingLocation = clubs.filter(
      (c) => !c.city || !c.state || !c.postalCode || !c.address1,
    ).length;
    const ratio = missingLocation / clubs.length;
    if (ratio > MAX_MISSING_LOCATION_RATIO) {
      issues.push({
        code: "missing_location_fields",
        message: `${missingLocation}/${clubs.length} clubs (${(ratio * 100).toFixed(1)}%) missing required location fields`,
      });
    }
  }

  if (requireKnownGas && clubs.length > 0) {
    const unknown = clubs.filter((c) => c.gasStatus === "unknown").length;
    const ratio = unknown / clubs.length;
    if (ratio > MAX_UNKNOWN_GAS_RATIO) {
      issues.push({
        code: "unknown_gas_status",
        message: `${unknown}/${clubs.length} clubs (${(ratio * 100).toFixed(1)}%) have unknown gas status`,
      });
    }
  }

  return issues;
}

export function buildSummary(
  clubs: BjsClub[],
  discoveryMethod: string,
  sourceEndpoints: string[],
): DiscoverySummary {
  const gasClubs = clubs.filter((c) => c.gasStatus === "yes").length;
  const unknownGasStatus = clubs.filter((c) => c.gasStatus === "unknown").length;
  const nonGasClubs = clubs.filter((c) => c.gasStatus === "no").length;

  return {
    generatedAt: new Date().toISOString(),
    totalClubs: clubs.length,
    gasClubs,
    nonGasClubs,
    unknownGasStatus,
    discoveryMethod,
    sourceEndpoints,
  };
}

export function assertValidOrThrow(issues: ValidationIssue[]): void {
  if (issues.length === 0) return;
  const message = issues.map((i) => `- [${i.code}] ${i.message}`).join("\n");
  throw new Error(`Discovery validation failed:\n${message}`);
}
