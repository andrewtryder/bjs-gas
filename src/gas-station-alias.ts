import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import gasStationAliasesJson from "../data/gas-station-aliases.json" with { type: "json" };

/**
 * Semantics:
 * Key: Parent warehouse club number (e.g. 321 for Hyannis).
 * Value: Canonical dedicated gas station club number (e.g. 902 for Hyannis Gas Station).
 *
 * Why this mapping exists:
 * BJ's operates separate dedicated gas kiosk entities (such as Hyannis Gas Station #902 at
 * 590 Iyannough Road) adjacent or near to warehouse clubs (Hyannis #321 at 420 Attucks Ln).
 * In BJ's digital club search API, both entities are marked with hasGas: true.
 * However:
 * 1. Physical fuel pumps are located at the dedicated entity (590 Iyannough Road).
 * 2. BJ's upstream eisapi pricing telemetry attaches fuel product data to the parent warehouse (#321).
 * 3. The public product must expose ONE canonical gas station per site—the dedicated entity.
 * 4. The collector resolves upstream pricing telemetry from the parent club and attributes observations
 *    to the canonical dedicated station.
 */
export type GasStationAliasMap = Record<number, number>;

export class AliasValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AliasValidationError";
  }
}

/**
 * Validate alias map integrity.
 * Enforces:
 * - Positive integer identifiers
 * - No self-aliases (A -> A)
 * - No alias cycles (A -> B -> A)
 * - Known canonical targets when knownClubs set is provided
 */
export function validateAliasMap(
  aliases: Record<string | number, number>,
  knownClubs?: Set<number> | number[],
): Record<number, number> {
  const normalized: Record<number, number> = {};
  const knownSet = knownClubs ? (knownClubs instanceof Set ? knownClubs : new Set(knownClubs)) : null;

  for (const [sourceStr, targetVal] of Object.entries(aliases)) {
    const source = Number.parseInt(String(sourceStr), 10);
    const target = Number.parseInt(String(targetVal), 10);

    if (!Number.isFinite(source) || source <= 0) {
      throw new AliasValidationError(`Invalid alias source club number: ${sourceStr}`);
    }
    if (!Number.isFinite(target) || target <= 0) {
      throw new AliasValidationError(`Invalid alias target club number: ${targetVal}`);
    }

    if (source === target) {
      throw new AliasValidationError(`Self-alias rejected: club #${source} cannot alias to itself`);
    }

    if (knownSet) {
      if (!knownSet.has(target)) {
        throw new AliasValidationError(
          `Canonical target club #${target} does not exist in known clubs registry`,
        );
      }
    }

    normalized[source] = target;
  }

  // Detect cycles (e.g. A -> B -> ... -> A)
  for (const source of Object.keys(normalized).map(Number)) {
    const visited = new Set<number>([source]);
    let curr = normalized[source];
    while (curr !== undefined) {
      if (visited.has(curr)) {
        throw new AliasValidationError(`Alias cycle detected involving club #${curr}`);
      }
      visited.add(curr);
      curr = normalized[curr];
    }
  }

  return normalized;
}

/**
 * Canonicalize a list of gas clubs by removing aliased parent warehouse duplicates.
 * Retains all dedicated canonical stations and unrelated stations.
 * Pure and deterministic.
 */
export function canonicalizeGasClubs<T extends { clubNumber: number }>(
  clubs: T[],
  aliases: Record<string | number, number>,
): T[] {
  const suppressedSources = new Set(
    Object.keys(aliases).map((k) => Number.parseInt(k, 10)),
  );
  return clubs.filter((c) => !suppressedSources.has(c.clubNumber));
}

/**
 * Return the upstream pricing feed club number for a given club.
 * If the club is a dedicated canonical station (e.g. 902), returns its parent warehouse
 * source (e.g. 321) where BJ's eisapi pricing telemetry is attached.
 * Otherwise returns the clubNumber itself.
 */
export function getUpstreamFuelFeedClub(
  clubNumber: number,
  aliases: Record<string | number, number>,
): number {
  for (const [sourceStr, targetVal] of Object.entries(aliases)) {
    if (targetVal === clubNumber) {
      return Number.parseInt(sourceStr, 10);
    }
  }
  return clubNumber;
}

/**
 * Return the canonical gas club number for a given club.
 * If the club is an aliased parent warehouse (e.g. 321), returns the dedicated station (902).
 * Otherwise returns the clubNumber itself.
 */
export function getCanonicalGasClub(
  clubNumber: number,
  aliases: Record<string | number, number>,
): number {
  const target = aliases[clubNumber] ?? aliases[String(clubNumber)];
  return target !== undefined ? target : clubNumber;
}

/**
 * Returns true if the club is an aliased parent warehouse that should not be a public gas station.
 */
export function isAliasedParentClub(
  clubNumber: number,
  aliases: Record<string | number, number>,
): boolean {
  return (aliases[clubNumber] ?? aliases[String(clubNumber)]) !== undefined;
}

function resolveDataDir(explicit?: string): string {
  if (explicit) return explicit;
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(here, "data"),
    path.join(here, "..", "data"),
    path.join(here, "..", "..", "data"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "gas-station-aliases.json"))) return dir;
  }
  return path.join(process.cwd(), "data");
}

/**
 * Load and validate gas station aliases from disk or bundled JSON.
 */
export function loadGasStationAliases(dataDir?: string): Record<number, number> {
  const dir = resolveDataDir(dataDir);
  const file = path.join(dir, "gas-station-aliases.json");
  const raw = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, number>)
    : (gasStationAliasesJson as Record<string, number>);

  return validateAliasMap(raw);
}
