import { CollectionRunScope, type PrismaClient } from "@prisma/client";
import type {
  StatusFreshness,
  StatusLastCollection,
  SystemStatusResponse,
} from "@bjs-gas/contracts";
export type { StatusFreshness, StatusLastCollection, SystemStatusResponse as StatusPayload } from "@bjs-gas/contracts";
import {
  COLLECTION_EXPECTED_MAX_MS,
  getCollectionLockState,
  isUsableCollectionRun,
  loadGasClubs,
  type CollectionLockState,
} from "../collector.js";
import type { ClubFailure } from "../fuel/types.js";

/**
 * Operator health: a usable FLEET run (or latest observation) older than this
 * is `last_collection_stale` / `latest_observation_stale`.
 *
 * Cadence is 120 minutes (boot-relative). 180 minutes (~3 hours) keeps a
 * normal two-hour cycle healthy, including modest deploy/jitter delay.
 * Public UI aging is 3–6 hours; stale is > 6 hours (`web/lib/freshness.ts`).
 */
export const FRESH_WINDOW_MINUTES = 180;
export const HARD_FAILURE_UNHEALTHY_RATIO = 0.2;


function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toStatusRun(latestRun: {
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  clubsConfigured: number;
  clubsSucceeded: number;
  clubsEmptyFuels: number;
  clubsHardFailed: number;
  fuelObservations: number;
  historyChanges: number;
  databaseQueries: number;
  degraded: boolean;
  failures: unknown;
}): StatusLastCollection {
  const failures = (latestRun.failures ?? []) as ClubFailure[];
  const run: StatusLastCollection = {
    startedAt: latestRun.startedAt.toISOString(),
    finishedAt: latestRun.finishedAt.toISOString(),
    durationMs: latestRun.durationMs,
    clubsConfigured: latestRun.clubsConfigured,
    clubsSucceeded: latestRun.clubsSucceeded,
    clubsEmptyFuels: latestRun.clubsEmptyFuels,
    clubsHardFailed: latestRun.clubsHardFailed,
    clubsFailed: latestRun.clubsHardFailed + latestRun.clubsEmptyFuels,
    fuelObservations: latestRun.fuelObservations,
    historyChanges: latestRun.historyChanges,
    databaseQueries: latestRun.databaseQueries,
    degraded: latestRun.degraded,
    failures,
    usable: false,
  };
  run.usable = isUsableCollectionRun(run);
  return run;
}

export function evaluateHealthy(input: {
  configuredGasClubs: number;
  lastAttemptedCollection: StatusLastCollection | null;
  lastSuccessfulCollection: StatusLastCollection | null;
  freshness: StatusFreshness;
  collectionLock?: CollectionLockState;
  now?: Date;
}): { healthy: boolean; unhealthyReasons: string[] } {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const attempted = input.lastAttemptedCollection;
  const successful = input.lastSuccessfulCollection;

  // A normal active collect (seconds) is expected — not unhealthy.
  // Only flag when the lock has been held far longer than a healthy run.
  if (input.collectionLock?.stale) {
    reasons.push("collection_lock_stale");
  } else if (input.collectionLock?.overExpectedDuration) {
    reasons.push("collection_over_expected_duration");
  }

  if (!attempted && !successful) {
    reasons.push("no_collection_run");
    return { healthy: false, unhealthyReasons: reasons };
  }

  // Staleness is based on the last usable collection, not a failed/aborted attempt.
  const freshnessAnchor = successful ?? attempted;
  if (freshnessAnchor) {
    const ageMs = now.getTime() - new Date(freshnessAnchor.finishedAt).getTime();
    if (!successful || ageMs > FRESH_WINDOW_MINUTES * 60_000) {
      reasons.push("last_collection_stale");
    }
  }

  // Latest attempt failure semantics (does not require the whole fleet to look bad).
  if (attempted) {
    if (attempted.clubsConfigured !== input.configuredGasClubs) {
      reasons.push("configured_clubs_mismatch");
    }

    if (attempted.fuelObservations === 0) {
      reasons.push("zero_fuel_observations");
    }

    if (attempted.clubsConfigured > 0) {
      const hardRatio = attempted.clubsHardFailed / attempted.clubsConfigured;
      if (hardRatio >= HARD_FAILURE_UNHEALTHY_RATIO) {
        reasons.push("hard_failure_ratio_high");
      }
    }

    if (attempted.databaseQueries !== 1) {
      reasons.push("unexpected_database_queries");
    }

    if (attempted.usable && attempted.clubsSucceeded > 0) {
      const freshRatio =
        input.freshness.stationsObservedRecently / attempted.clubsSucceeded;
      if (freshRatio < 0.8) {
        reasons.push("fresh_stations_below_majority");
      }
    } else if (
      attempted.clubsConfigured > 0 &&
      attempted.clubsSucceeded === 0 &&
      attempted.fuelObservations === 0
    ) {
      reasons.push("no_clubs_succeeded");
    }
  }

  // Observation age is authoritative for "are prices actually fresh?"
  // Empty-fuel clubs may retain old observedAt; judge fleet freshness via ratio,
  // not oldestObservedAt alone.
  if (input.freshness.latestObservedAt) {
    const obsAgeMs =
      now.getTime() - new Date(input.freshness.latestObservedAt).getTime();
    if (obsAgeMs > FRESH_WINDOW_MINUTES * 60_000) {
      if (!reasons.includes("last_collection_stale")) {
        reasons.push("latest_observation_stale");
      }
    }
  }

  return { healthy: reasons.length === 0, unhealthyReasons: reasons };
}

export { COLLECTION_EXPECTED_MAX_MS };

export async function getCollectionStatus(prisma: PrismaClient): Promise<SystemStatusResponse> {
  const configuredGasClubs = loadGasClubs().length;
  const collectionLock = getCollectionLockState();

  const latestRuns = await prisma.collectionRun.findMany({
    where: { scope: CollectionRunScope.FLEET },
    orderBy: { finishedAt: "desc" },
    take: 20,
  });

  const freshnessRows = await prisma.$queryRaw<
    Array<{
      latest: Date | null;
      oldest: Date | null;
      rows: bigint;
      stations_recent: bigint;
    }>
  >`
    SELECT
      MAX("observedAt") AS latest,
      MIN("observedAt") AS oldest,
      COUNT(*)::bigint AS rows,
      COUNT(DISTINCT "clubNumber") FILTER (
        WHERE "observedAt" >= NOW() - (${FRESH_WINDOW_MINUTES}::int * INTERVAL '1 minute')
      )::bigint AS stations_recent
    FROM "FuelPriceCurrent"
  `;

  const fres = freshnessRows[0];
  const stationsObservedRecently = Number(fres?.stations_recent ?? 0n);
  const freshness: StatusFreshness = {
    latestObservedAt: asIso(fres?.latest ?? null),
    oldestObservedAt: asIso(fres?.oldest ?? null),
    currentPriceRows: Number(fres?.rows ?? 0n),
    stationsObservedRecently,
    freshStationRatio:
      configuredGasClubs === 0 ? 0 : stationsObservedRecently / configuredGasClubs,
    freshWindowMinutes: FRESH_WINDOW_MINUTES,
  };

  const mapped = latestRuns.map(toStatusRun);
  const lastAttemptedCollection = mapped[0] ?? null;
  const lastSuccessfulCollection = mapped.find((r) => r.usable) ?? null;
  const lastCollection = lastSuccessfulCollection ?? lastAttemptedCollection;

  const { healthy, unhealthyReasons } = evaluateHealthy({
    configuredGasClubs,
    lastAttemptedCollection,
    lastSuccessfulCollection,
    freshness,
    collectionLock,
  });

  return {
    ok: true,
    healthy,
    unhealthyReasons,
    lastAttemptedCollection,
    lastSuccessfulCollection,
    lastCollection,
    collectionLock,
    freshness,
    configuredGasClubs,
  };
}
