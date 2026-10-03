import type { PrismaClient } from "@prisma/client";
import { fetchClubFuel, mapPool } from "../fuel/client.js";
import {
  COLLECTION_RUN_SCOPE,
  dedupeObservations,
  type ClubFailure,
  type CollectionResult,
  type FuelObservation,
} from "../fuel/types.js";
import {
  persistFuelObservations,
  resolvePersistWatchdogTimeoutMs,
  type PersistOptions,
} from "../persistence/index.js";
import { getUpstreamFuelFeedClub, loadGasStationAliases } from "../gas-station-alias.js";
import {
  COLLECTION_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
  FAILURE_CRITICAL_RATIO,
  FAILURE_DEGRADED_RATIO,
} from "./policy.js";
import {
  acquireCollectionLock,
  clearCollectionLock,
  getCollectionLockState,
} from "./lock.js";
import {
  assertWithinDeadline,
  collectionAbortedError,
} from "./deadline.js";
import { loadGasClubs, type GasClubSeed } from "./collect-clubs.js";
import { isEmptyFuelFailure } from "./result.js";

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

export async function runCollection(options: CollectOptions = {}): Promise<CollectionResult> {
  if (getCollectionLockState().inProgress) {
    const err = new Error("Collection already in progress");
    (err as Error & { code?: string }).code = "COLLECTION_IN_PROGRESS";
    throw err;
  }

  const timeoutMs = options.timeoutMs ?? COLLECTION_TIMEOUT_MS;
  const deadline = new AbortController();
  acquireCollectionLock();

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
              scope: COLLECTION_RUN_SCOPE.FLEET,
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
    const remainingMs = deadlineAtMs - Date.now();
    const requiredPersistBudgetMs = resolvePersistWatchdogTimeoutMs(options.persistOptions);
    if (remainingMs <= requiredPersistBudgetMs) {
      throw collectionAbortedError(
        `insufficient time remaining for persistence: ${remainingMs}ms remaining <= ${requiredPersistBudgetMs}ms required budget`,
      );
    }
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
        scope: COLLECTION_RUN_SCOPE.FLEET,
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
