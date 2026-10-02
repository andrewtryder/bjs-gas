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
import { persistFuelObservations, type PersistOptions } from "./persist.js";
import { getUpstreamFuelFeedClub, loadGasStationAliases } from "./gas-station-alias.js";
import gasClubsJson from "../data/gas-clubs.json" with { type: "json" };

export const DEFAULT_CONCURRENCY = 5;
export const FAILURE_DEGRADED_RATIO = 0.2;
export const FAILURE_CRITICAL_RATIO = 0.8;

/**
 * Collection timing hierarchy (do not "simplify" without understanding):
 *
 * >3m  COLLECTION_EXPECTED_MAX_MS → status: collection_over_expected_duration
 *                                   (warning/unhealthy; lock NOT auto-cleared)
 * >12m COLLECTION_TIMEOUT_MS      → abort in-flight fetches/retries/sleeps;
 *                                   lock held until aborted work settles + finally
 * >17m COLLECTION_LOCK_STALE_MS   → status: collection_lock_stale
 *                                   (abort/cleanup failed); NEVER auto-unlock
 *
 * Hard deadline for one collection. On expiry the collection AbortController
 * aborts all in-flight club fetches/retries; the lock stays held until that
 * work settles and `finally` runs.
 */
export const COLLECTION_TIMEOUT_MS = 12 * 60_000;

/**
 * Healthy collects finish well under this. Longer means status should flag
 * `collection_over_expected_duration` — but the lock is NOT auto-cleared.
 */
export const COLLECTION_EXPECTED_MAX_MS = 3 * 60_000;

/**
 * Defensive status-only threshold (= TIMEOUT + 5m). If a lock is still held
 * this long, abort/cleanup failed. Never used to unlock while live work may
 * still exist.
 */
export const COLLECTION_LOCK_STALE_MS = COLLECTION_TIMEOUT_MS + 5 * 60_000;

export type GasClubSeed = {
  clubNumber: number;
  clubId: string;
  name: string;
};

export type CollectionLockState = {
  inProgress: boolean;
  startedAt: string | null;
  ageMs: number | null;
  ageSeconds: number | null;
  /** True when age exceeds COLLECTION_EXPECTED_MAX_MS. */
  overExpectedDuration: boolean;
  /**
   * True when age exceeds COLLECTION_LOCK_STALE_MS. Status-only signal —
   * the lock is never forcibly cleared here (that would allow overlap).
   */
  stale: boolean;
};

let collecting = false;
let collectingStartedAtMs: number | null = null;
/** Active deadline controller for the current collection, if any. */
let activeDeadline: AbortController | null = null;

function clearCollectionLock(): void {
  collecting = false;
  collectingStartedAtMs = null;
  activeDeadline = null;
}

function acquireCollectionLock(deadline: AbortController): void {
  collecting = true;
  collectingStartedAtMs = Date.now();
  activeDeadline = deadline;
}

/**
 * Process-local single-flight state.
 *
 * Incident model: a collection with no hard deadline never settled, so its
 * `finally` never ran and the lock stayed asserted — later cron/manual
 * attempts saw `collection_in_progress`. This reader NEVER auto-clears the
 * lock (that would allow overlap with still-running network/DB work).
 */
export function getCollectionLockState(nowMs: number = Date.now()): CollectionLockState {
  if (!collecting || collectingStartedAtMs == null) {
    return {
      inProgress: false,
      startedAt: null,
      ageMs: null,
      ageSeconds: null,
      overExpectedDuration: false,
      stale: false,
    };
  }
  const ageMs = nowMs - collectingStartedAtMs;
  return {
    inProgress: true,
    startedAt: new Date(collectingStartedAtMs).toISOString(),
    ageMs,
    ageSeconds: Math.floor(ageMs / 1000),
    overExpectedDuration: ageMs > COLLECTION_EXPECTED_MAX_MS,
    stale: ageMs > COLLECTION_LOCK_STALE_MS,
  };
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
  /** Override hard deadline (tests). */
  timeoutMs?: number | undefined;
  /** Override database persistence timeouts (tests/ops). */
  persistOptions?: PersistOptions | undefined;
};

function isEmptyFuelFailure(error: string): boolean {
  return /empty fuel/i.test(error);
}

export function isDeadlineExceeded(deadlineAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs >= deadlineAtMs;
}

export function assertWithinDeadline(
  deadlineAtMs: number,
  signal?: AbortSignal,
  stage?: string,
  nowMs: number = Date.now(),
): void {
  if (signal?.aborted) {
    throw collectionAbortedError(signal.reason);
  }
  if (isDeadlineExceeded(deadlineAtMs, nowMs)) {
    const stageInfo = stage ? ` at stage '${stage}'` : "";
    throw collectionAbortedError(
      `runCollection exceeded wall-clock deadline${stageInfo} (deadlineAtMs=${deadlineAtMs}, nowMs=${nowMs})`,
    );
  }
}

function collectionAbortedError(reason?: unknown): Error & { code: string } {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "runCollection timed out / aborted";
  const err = new Error(message) as Error & { code: string };
  err.code = "COLLECTION_ABORTED";
  return err;
}

export async function runCollection(options: CollectOptions = {}): Promise<CollectionResult> {
  if (getCollectionLockState().inProgress) {
    const err = new Error("Collection already in progress");
    (err as Error & { code?: string }).code = "COLLECTION_IN_PROGRESS";
    throw err;
  }

  const timeoutMs = options.timeoutMs ?? COLLECTION_TIMEOUT_MS;
  const deadline = new AbortController();
  acquireCollectionLock(deadline);

  const startedAtDate = new Date();
  const startedAt = startedAtDate.toISOString();
  const startedAtMs = startedAtDate.getTime();
  const deadlineAtMs = startedAtMs + timeoutMs;
  const observedAt = startedAt;
  const clubs = loadGasClubs(options.dataDir);
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const aliases = loadGasStationAliases(options.dataDir);

  let deadlineTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    deadline.abort(collectionAbortedError(`runCollection timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  let persistWatchdogTriggered = false;

  try {
    try {
      return await runCollectionBody({
        options,
        clubs,
        concurrency,
        aliases,
        startedAtDate,
        startedAt,
        observedAt,
        deadlineAtMs,
        signal: deadline.signal,
      });
    } catch (error) {
      if (deadline.signal.aborted) {
        throw collectionAbortedError(deadline.signal.reason ?? error);
      }
      throw error;
    }
  } catch (error) {
    const isWatchdog = (error as { code?: string }).code === "PERSIST_WATCHDOG_TIMEOUT";
    if (isWatchdog) {
      persistWatchdogTriggered = true;
    }
    // Persist a failure run when possible so status cannot keep showing only an older success.
    // Do NOT attempt to persist a failure run if Prisma watchdog timed out (Prisma is hung/broken).
    if (!options.dryRun && options.prisma && !isWatchdog) {
      const finishedAtDate = new Date();
      const message = error instanceof Error ? error.message : String(error);
      const code = (error as { code?: string }).code;
      if (code !== "COLLECTION_IN_PROGRESS") {
        try {
          await persistFuelObservations(
            options.prisma,
            [],
            {
              startedAt,
              finishedAt: finishedAtDate.toISOString(),
              durationMs: finishedAtDate.getTime() - startedAtDate.getTime(),
              clubsConfigured: clubs.length,
              clubsSucceeded: 0,
              clubsEmptyFuels: 0,
              clubsHardFailed: clubs.length,
              fuelObservations: 0,
              degraded: true,
              failures: [
                {
                  clubNumber: 0,
                  attempts: 1,
                  error: `collection_aborted: ${message}`,
                },
              ],
            },
            {
              statementTimeoutMs: 5_000,
              transactionTimeoutMs: 6_000,
              maxWaitMs: 3_000,
              watchdogTimeoutMs: 12_000,
            },
          );
        } catch (persistError) {
          console.error(
            JSON.stringify({
              event: "gas_collection_failure_persist_error",
              error:
                persistError instanceof Error ? persistError.message : String(persistError),
            }),
          );
        }
      }
    }
    throw error;
  } finally {
    if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
    // Abort any stragglers before releasing the lock so a subsequent tick
    // cannot overlap still-running fetches/writes from this attempt.
    if (!deadline.signal.aborted) {
      deadline.abort(collectionAbortedError("runCollection cleanup"));
    }
    // Fail-closed: never clear lock if persistence watchdog triggered (unsettled Prisma hang)
    if (!persistWatchdogTriggered) {
      clearCollectionLock();
    }
  }
}

async function runCollectionBody(input: {
  options: CollectOptions;
  clubs: GasClubSeed[];
  concurrency: number;
  aliases: ReturnType<typeof loadGasStationAliases>;
  startedAtDate: Date;
  startedAt: string;
  observedAt: string;
  deadlineAtMs: number;
  signal: AbortSignal;
}): Promise<CollectionResult> {
  const {
    options,
    clubs,
    concurrency,
    aliases,
    startedAtDate,
    startedAt,
    observedAt,
    deadlineAtMs,
    signal,
  } = input;

  assertWithinDeadline(deadlineAtMs, signal, "start");

  const results = await mapPool(clubs, concurrency, async (club) => {
    assertWithinDeadline(deadlineAtMs, signal, "pre-fetch");
    const feedClubNumber = getUpstreamFuelFeedClub(club.clubNumber, aliases);
    const fuelOpts = {
      signal,
      deadlineAtMs,
      ...(options.fetchImpl !== undefined ? { fetchImpl: options.fetchImpl } : {}),
      ...(feedClubNumber !== club.clubNumber ? { feedClubNumber } : {}),
    };
    const result = await fetchClubFuel(club.clubNumber, observedAt, fuelOpts);
    assertWithinDeadline(deadlineAtMs, signal, "post-fetch");
    return { clubNumber: club.clubNumber, result };
  });

  assertWithinDeadline(deadlineAtMs, signal, "post-pool");

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
  const clubsFailed = failures.length;
  const clubsHardFailed = clubsFailed - clubsEmptyFuels;
  const clubsConfigured = clubs.length;
  const failureRatio = clubsConfigured === 0 ? 0 : clubsFailed / clubsConfigured;
  const degraded = failureRatio > FAILURE_DEGRADED_RATIO;

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
  let finishedAt: string;
  let durationMs: number;

  if (!options.dryRun) {
    assertWithinDeadline(deadlineAtMs, signal, "pre-persistence");
    if (!options.prisma) {
      throw new Error("prisma client required unless dryRun");
    }
    console.log(
      JSON.stringify({
        event: "gas_persistence_start",
        observations: deduped.length,
      }),
    );
    const persistStartedAtMs = Date.now();
    const stats = await persistFuelObservations(
      options.prisma,
      deduped,
      {
        startedAt,
        clubsConfigured,
        clubsSucceeded,
        clubsEmptyFuels,
        clubsHardFailed,
        fuelObservations: deduped.length,
        degraded,
        failures,
      },
      options.persistOptions,
    );
    const persistDurationMs = Date.now() - persistStartedAtMs;
    historyChanges = stats.historyRowsInserted;
    databaseQueries = stats.databaseQueries;
    finishedAt = stats.finishedAt;
    durationMs = stats.durationMs;
    console.log(
      JSON.stringify({
        event: "gas_persistence_complete",
        durationMs: persistDurationMs,
        historyRowsInserted: stats.historyRowsInserted,
        currentRowsUpserted: stats.currentRowsUpserted,
      }),
    );
    assertWithinDeadline(deadlineAtMs, signal, "post-persistence");
  } else {
    const finishedAtDate = new Date();
    finishedAt = finishedAtDate.toISOString();
    durationMs = finishedAtDate.getTime() - startedAtDate.getTime();
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
}

export function isCollectionInProgress(): boolean {
  return getCollectionLockState().inProgress;
}

/** Test-only: force lock state for status/lock coverage. Does not start network work. */
export function __setCollectionLockForTests(startedAtMs: number | null): void {
  if (startedAtMs == null) {
    clearCollectionLock();
    return;
  }
  collecting = true;
  collectingStartedAtMs = startedAtMs;
  activeDeadline = null;
}

export function isCollectionAbortedFailure(failures: ClubFailure[] | undefined): boolean {
  return (failures ?? []).some((f) => /collection_aborted/i.test(f.error));
}

export function isUsableCollectionRun(run: {
  fuelObservations: number;
  failures?: ClubFailure[];
}): boolean {
  if (run.fuelObservations <= 0) return false;
  if (isCollectionAbortedFailure(run.failures)) return false;
  return true;
}
