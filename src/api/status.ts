import type { PrismaClient } from "@prisma/client";
import { loadGasClubs } from "../collector.js";
import type { ClubFailure } from "../fuel/types.js";

export const FRESH_WINDOW_MINUTES = 90;
export const HARD_FAILURE_UNHEALTHY_RATIO = 0.2;

export type StatusFreshness = {
  latestObservedAt: string | null;
  oldestObservedAt: string | null;
  currentPriceRows: number;
  stationsObservedRecently: number;
  freshWindowMinutes: number;
};

export type StatusLastCollection = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  clubsConfigured: number;
  clubsSucceeded: number;
  clubsEmptyFuels: number;
  clubsHardFailed: number;
  clubsFailed: number;
  fuelObservations: number;
  historyChanges: number;
  databaseQueries: number;
  degraded: boolean;
  failures: ClubFailure[];
};

export type StatusPayload = {
  ok: true;
  healthy: boolean;
  unhealthyReasons: string[];
  lastCollection: StatusLastCollection | null;
  freshness: StatusFreshness;
  configuredGasClubs: number;
};

function asIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

export function evaluateHealthy(input: {
  configuredGasClubs: number;
  lastCollection: StatusLastCollection | null;
  freshness: StatusFreshness;
  now?: Date;
}): { healthy: boolean; unhealthyReasons: string[] } {
  const now = input.now ?? new Date();
  const reasons: string[] = [];
  const run = input.lastCollection;

  if (!run) {
    reasons.push("no_collection_run");
    return { healthy: false, unhealthyReasons: reasons };
  }

  const ageMs = now.getTime() - new Date(run.finishedAt).getTime();
  if (ageMs > FRESH_WINDOW_MINUTES * 60_000) {
    reasons.push("last_collection_stale");
  }

  if (run.clubsConfigured !== input.configuredGasClubs) {
    reasons.push("configured_clubs_mismatch");
  }

  if (run.clubsConfigured > 0) {
    const hardRatio = run.clubsHardFailed / run.clubsConfigured;
    if (hardRatio >= HARD_FAILURE_UNHEALTHY_RATIO) {
      reasons.push("hard_failure_ratio_high");
    }
  }

  if (run.databaseQueries !== 1) {
    reasons.push("unexpected_database_queries");
  }

  // Majority of stations that produced prices this run should still look fresh.
  if (run.clubsSucceeded > 0) {
    const freshRatio = input.freshness.stationsObservedRecently / run.clubsSucceeded;
    if (freshRatio < 0.8) {
      reasons.push("fresh_stations_below_majority");
    }
  }

  return { healthy: reasons.length === 0, unhealthyReasons: reasons };
}

export async function getCollectionStatus(prisma: PrismaClient): Promise<StatusPayload> {
  const configuredGasClubs = loadGasClubs().length;

  const [latestRun, freshnessRows] = await Promise.all([
    prisma.collectionRun.findFirst({
      orderBy: { finishedAt: "desc" },
    }),
    prisma.$queryRaw<
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
    `,
  ]);

  const fres = freshnessRows[0];
  const freshness: StatusFreshness = {
    latestObservedAt: asIso(fres?.latest ?? null),
    oldestObservedAt: asIso(fres?.oldest ?? null),
    currentPriceRows: Number(fres?.rows ?? 0n),
    stationsObservedRecently: Number(fres?.stations_recent ?? 0n),
    freshWindowMinutes: FRESH_WINDOW_MINUTES,
  };

  let lastCollection: StatusLastCollection | null = null;
  if (latestRun) {
    const failures = (latestRun.failures ?? []) as ClubFailure[];
    lastCollection = {
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
    };
  }

  const { healthy, unhealthyReasons } = evaluateHealthy({
    configuredGasClubs,
    lastCollection,
    freshness,
  });

  return {
    ok: true,
    healthy,
    unhealthyReasons,
    lastCollection,
    freshness,
    configuredGasClubs,
  };
}
