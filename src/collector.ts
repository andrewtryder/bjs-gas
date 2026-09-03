import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "@prisma/client";
import { fetchClubFuel, mapPool } from "./fuel/client.js";
import {
  dedupeObservations,
  type ClubFailure,
  type CollectionResult,
  type FuelObservation,
} from "./fuel/types.js";
import { persistFuelObservations } from "./persist.js";
import gasClubsJson from "../data/gas-clubs.json" with { type: "json" };

export const DEFAULT_CONCURRENCY = 5;
export const FAILURE_DEGRADED_RATIO = 0.2;
export const FAILURE_CRITICAL_RATIO = 0.8;

export type GasClubSeed = {
  clubNumber: number;
  clubId: string;
  name: string;
};

let collecting = false;

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
    if (existsSync(path.join(dir, "gas-clubs.json"))) return dir;
  }
  return path.join(process.cwd(), "data");
}

export function loadGasClubs(dataDir?: string): GasClubSeed[] {
  // Prefer filesystem when present (local / copied dist/data); fall back to bundled JSON.
  const dir = resolveDataDir(dataDir);
  const file = path.join(dir, "gas-clubs.json");
  const raw = existsSync(file)
    ? (JSON.parse(readFileSync(file, "utf8")) as GasClubSeed[])
    : (gasClubsJson as GasClubSeed[]);
  return raw.map((c) => ({
    clubNumber: c.clubNumber,
    clubId: c.clubId,
    name: c.name,
  }));
}

export type CollectOptions = {
  concurrency?: number;
  dryRun?: boolean;
  prisma?: PrismaClient | undefined;
  dataDir?: string;
  fetchImpl?: typeof fetch | undefined;
};

function isEmptyFuelFailure(error: string): boolean {
  return /empty fuel/i.test(error);
}

export async function runCollection(options: CollectOptions = {}): Promise<CollectionResult> {
  if (collecting) {
    const err = new Error("Collection already in progress");
    (err as Error & { code?: string }).code = "COLLECTION_IN_PROGRESS";
    throw err;
  }
  collecting = true;

  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const observedAt = startedAt;
  const clubs = loadGasClubs(options.dataDir);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  try {
    const results = await mapPool(clubs, concurrency, async (club) => {
      const fuelOpts =
        options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {};
      const result = await fetchClubFuel(club.clubNumber, observedAt, fuelOpts);
      return { clubNumber: club.clubNumber, result };
    });

    const observations: FuelObservation[] = [];
    const failures: ClubFailure[] = [];
    let clubsSucceeded = 0;
    let clubsEmptyFuels = 0;

    for (const { clubNumber, result } of results) {
      if (result.ok) {
        clubsSucceeded += 1;
        observations.push(...result.observations);
      } else {
        const failure: ClubFailure = {
          clubNumber,
          attempts: result.attempts,
          error: result.error,
        };
        if (result.status !== undefined) failure.status = result.status;
        failures.push(failure);
        // Empty fuels / fetch failures must NEVER flip Club.hasGas or remove
        // the club from data/gas-clubs.json. Preserve existing FuelPriceCurrent.
        if (isEmptyFuelFailure(result.error)) {
          clubsEmptyFuels += 1;
          console.warn(
            JSON.stringify({
              event: "gas_club_empty_fuels",
              clubNumber,
              message:
                "Configured gas club returned empty fuel array; preserving current prices and hasGas",
            }),
          );
        }
      }
    }

    const deduped = dedupeObservations(observations);
    const finishedAtDate = new Date();
    const finishedAt = finishedAtDate.toISOString();
    const clubsFailed = failures.length;
    const clubsHardFailed = clubsFailed - clubsEmptyFuels;
    const clubsConfigured = clubs.length;
    const failureRatio = clubsConfigured === 0 ? 0 : clubsFailed / clubsConfigured;
    const degraded = failureRatio > FAILURE_DEGRADED_RATIO;
    const durationMs = finishedAtDate.getTime() - startedAtDate.getTime();

    if (failureRatio >= FAILURE_CRITICAL_RATIO) {
      console.warn(
        JSON.stringify({
          event: "gas_collection_critical",
          message:
            "Possible BJ's upstream/API behavior change; widespread collection failure.",
          clubsConfigured,
          clubsFailed,
        }),
      );
    }

    if (deduped.length === 0 && !options.dryRun) {
      console.warn(
        JSON.stringify({
          event: "gas_collection_no_observations",
          message: "Zero valid fuel observations; current prices left unchanged",
          clubsConfigured,
          clubsFailed,
          clubsEmptyFuels,
        }),
      );
    }

    let historyChanges = 0;
    let databaseQueries = 0;

    if (!options.dryRun) {
      if (!options.prisma) {
        throw new Error("prisma client required unless dryRun");
      }
      const stats = await persistFuelObservations(options.prisma, deduped, {
        startedAt,
        finishedAt,
        durationMs,
        clubsConfigured,
        clubsSucceeded,
        clubsEmptyFuels,
        clubsHardFailed,
        fuelObservations: deduped.length,
        degraded,
        failures,
      });
      historyChanges = stats.historyRowsInserted;
      databaseQueries = stats.databaseQueries;
    }

    const summary: CollectionResult = {
      startedAt,
      finishedAt,
      durationMs,
      clubsConfigured,
      clubsAttempted: clubsConfigured,
      clubsSucceeded,
      clubsFailed,
      clubsEmptyFuels,
      fuelObservations: deduped.length,
      historyChanges,
      databaseQueries,
      degraded,
      failures,
    };

    console.log(
      JSON.stringify({
        event: "gas_collection_complete",
        ...summary,
      }),
    );

    return summary;
  } finally {
    collecting = false;
  }
}

export function isCollectionInProgress(): boolean {
  return collecting;
}
