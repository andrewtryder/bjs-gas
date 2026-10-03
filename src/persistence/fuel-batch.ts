import type { Prisma, PrismaClient } from "@prisma/client";
import {
  dedupeObservations,
  type CollectionRunInput,
  type FuelObservation,
  type PersistStats,
} from "../fuel/types.js";
import {
  DEFAULT_DB_MAX_WAIT_MS,
  DEFAULT_DB_STATEMENT_TIMEOUT_MS,
  DEFAULT_DB_TRANSACTION_TIMEOUT_MS,
  resolvePersistWatchdogTimeoutMs,
  type PersistOptions,
} from "./policy.js";
import { isClosedConnectionError } from "./transaction-policy.js";
import { createWatchdog } from "./watchdog.js";

type QueryableClient = {
  $executeRaw?: Prisma.TransactionClient["$executeRaw"] | PrismaClient["$executeRaw"];
  $queryRaw: Prisma.TransactionClient["$queryRaw"] | PrismaClient["$queryRaw"];
};

/**
 * Persist observations + one CollectionRun with a single parameterized SQL statement.
 * History inserts only when price is new or changed (NUMERIC IS DISTINCT FROM).
 * Empty observation arrays leave current prices untouched but still record the run.
 * Enforces PostgreSQL server-side statement_timeout within an interactive transaction,
 * and a client-side fail-closed watchdog to guard against unresolvable client hangs.
 */
export async function persistFuelObservations(
  prisma: PrismaClient,
  observations: FuelObservation[],
  run: CollectionRunInput,
  options: PersistOptions = {},
): Promise<PersistStats> {
  const statementTimeoutMs = options.statementTimeoutMs ?? DEFAULT_DB_STATEMENT_TIMEOUT_MS;
  const transactionTimeoutMs = options.transactionTimeoutMs ?? DEFAULT_DB_TRANSACTION_TIMEOUT_MS;
  const maxWaitMs = options.maxWaitMs ?? DEFAULT_DB_MAX_WAIT_MS;
  const watchdogTimeoutMs = resolvePersistWatchdogTimeoutMs(options);

  const batch = dedupeObservations(observations);

  const payload = batch.map((o) => ({
    club_number: o.clubNumber,
    fuel_sku: o.fuelSku,
    fuel_name: o.fuelName,
    price: o.price,
    source_price_at_local: o.sourcePriceAtLocal,
    observed_at: o.observedAt,
  }));

  const runPayload = [
    {
      started_at: run.startedAt,
      finished_at: run.finishedAt ?? null,
      duration_ms: run.durationMs ?? null,
      clubs_configured: run.clubsConfigured,
      clubs_succeeded: run.clubsSucceeded,
      clubs_empty_fuels: run.clubsEmptyFuels,
      clubs_hard_failed: run.clubsHardFailed,
      fuel_observations: run.fuelObservations,
      degraded: run.degraded,
      failures: run.failures,
    },
  ];

  const executePersist = async (db: QueryableClient): Promise<PersistStats> => {
    if (typeof db.$executeRaw === "function") {
      await db.$executeRaw`SELECT set_config('statement_timeout', ${String(Math.floor(statementTimeoutMs))}, true)`;
    }

    console.log(
      JSON.stringify({
        event: "collector_persistence_sql_start",
        observations: payload.length,
      }),
    );

    const rows = await db.$queryRaw<
      Array<{
        observations_received: bigint;
        history_rows_inserted: bigint;
        current_rows_upserted: bigint;
        run_rows_inserted: bigint;
        run_finished_at: Date | string | null;
        run_duration_ms: number | bigint | null;
      }>
    >`
      WITH sleep_step AS (
        SELECT pg_sleep(${options._testSleepSeconds ?? 0})
      ),
      incoming AS (
        SELECT
          club_number::int AS club_number,
          fuel_sku::text AS fuel_sku,
          fuel_name::text AS fuel_name,
          price::numeric(6,3) AS price,
          NULLIF(source_price_at_local, '')::text AS source_price_at_local,
          (observed_at::timestamptz AT TIME ZONE 'UTC') AS observed_at
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
          AS x(
            club_number int,
            fuel_sku text,
            fuel_name text,
            price text,
            source_price_at_local text,
            observed_at text
          )
      ),
      changed AS (
        INSERT INTO "FuelPriceHistory" (
          "clubNumber", "fuelSku", "fuelName", "price", "sourcePriceAtLocal", "observedAt"
        )
        SELECT
          i.club_number,
          i.fuel_sku,
          i.fuel_name,
          i.price,
          i.source_price_at_local,
          i.observed_at
        FROM incoming i
        LEFT JOIN "FuelPriceCurrent" c
          ON c."clubNumber" = i.club_number
         AND c."fuelSku" = i.fuel_sku
        WHERE c."clubNumber" IS NULL
           OR c."price" IS DISTINCT FROM i.price
        RETURNING 1
      ),
      upserted AS (
        INSERT INTO "FuelPriceCurrent" (
          "clubNumber", "fuelSku", "fuelName", "price", "sourcePriceAtLocal", "observedAt", "createdAt", "updatedAt"
        )
        SELECT
          i.club_number,
          i.fuel_sku,
          i.fuel_name,
          i.price,
          i.source_price_at_local,
          i.observed_at,
          NOW(),
          NOW()
        FROM incoming i
        ON CONFLICT ("clubNumber", "fuelSku")
        DO UPDATE SET
          "fuelName" = EXCLUDED."fuelName",
          "price" = EXCLUDED."price",
          "sourcePriceAtLocal" = EXCLUDED."sourcePriceAtLocal",
          "observedAt" = EXCLUDED."observedAt",
          "updatedAt" = NOW()
        RETURNING 1
      ),
      run_row AS (
        INSERT INTO "CollectionRun" (
          "startedAt",
          "finishedAt",
          "durationMs",
          "clubsConfigured",
          "clubsSucceeded",
          "clubsEmptyFuels",
          "clubsHardFailed",
          "fuelObservations",
          "historyChanges",
          "databaseQueries",
          "degraded",
          "failures",
          "createdAt"
        )
        SELECT
          (r.started_at::timestamptz AT TIME ZONE 'UTC'),
          (COALESCE(r.finished_at::timestamptz, clock_timestamp()) AT TIME ZONE 'UTC'),
          COALESCE(
            r.duration_ms::int,
            LEAST(
              2147483647,
              GREATEST(
                1,
                ROUND(
                  EXTRACT(
                    EPOCH FROM (
                      COALESCE(r.finished_at::timestamptz, clock_timestamp()) -
                      r.started_at::timestamptz
                    )
                  ) * 1000
                )::bigint
              )
            )::int
          ),
          r.clubs_configured::int,
          r.clubs_succeeded::int,
          r.clubs_empty_fuels::int,
          r.clubs_hard_failed::int,
          r.fuel_observations::int,
          (SELECT count(*)::int FROM changed),
          1,
          r.degraded::boolean,
          COALESCE(r.failures, '[]'::jsonb),
          NOW()
        FROM jsonb_to_recordset(${JSON.stringify(runPayload)}::jsonb)
          AS r(
            started_at text,
            finished_at text,
            duration_ms int,
            clubs_configured int,
            clubs_succeeded int,
            clubs_empty_fuels int,
            clubs_hard_failed int,
            fuel_observations int,
            degraded boolean,
            failures jsonb
          )
        RETURNING "finishedAt", "durationMs"
      )
      SELECT
        (SELECT count(*)::bigint FROM incoming) AS observations_received,
        (SELECT count(*)::bigint FROM changed) AS history_rows_inserted,
        (SELECT count(*)::bigint FROM upserted) AS current_rows_upserted,
        (SELECT count(*)::bigint FROM run_row) AS run_rows_inserted,
        (SELECT "finishedAt" FROM run_row) AS run_finished_at,
        (SELECT "durationMs" FROM run_row) AS run_duration_ms,
        (SELECT count(*)::int FROM sleep_step) AS _sleep_done
    `;

    const row = rows[0];
    if (!row) {
      throw new Error("Bulk persistence returned no stats row");
    }
    if (Number(row.run_rows_inserted) !== 1) {
      throw new Error("CollectionRun insert did not return exactly one row");
    }

    const finishedAt =
      row.run_finished_at instanceof Date
        ? row.run_finished_at.toISOString()
        : typeof row.run_finished_at === "string"
          ? row.run_finished_at
          : new Date().toISOString();
    const durationMs =
      row.run_duration_ms != null
        ? Number(row.run_duration_ms)
        : Math.max(1, new Date(finishedAt).getTime() - new Date(run.startedAt).getTime());

    const resultStats: PersistStats = {
      observationsReceived: Number(row.observations_received),
      currentRowsUpserted: Number(row.current_rows_upserted),
      historyRowsInserted: Number(row.history_rows_inserted),
      databaseQueries: 1,
      finishedAt,
      durationMs,
    };

    console.log(
      JSON.stringify({
        event: "collector_persistence_sql_complete",
        historyRowsInserted: resultStats.historyRowsInserted,
        currentRowsUpserted: resultStats.currentRowsUpserted,
        durationMs: resultStats.durationMs,
      }),
    );

    return resultStats;
  };

  const watchdog = createWatchdog(
    watchdogTimeoutMs,
    statementTimeoutMs,
    transactionTimeoutMs,
    options,
  );

  try {
    const persistWork = async (): Promise<PersistStats> => {
      if (typeof prisma.$transaction !== "function") {
        return await executePersist(prisma);
      }

      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let transactionEntered = false;
        console.log(
          JSON.stringify({
            event: "collector_persistence_acquisition_attempt",
            attempt,
            maxAttempts,
          }),
        );

        try {
          return await prisma.$transaction(
            async (tx: Prisma.TransactionClient) => {
              transactionEntered = true;
              console.log(
                JSON.stringify({
                  event: "collector_persistence_transaction_entered",
                  attempt,
                }),
              );
              return await executePersist(tx);
            },
            {
              maxWait: maxWaitMs,
              timeout: transactionTimeoutMs,
            },
          );
        } catch (error) {
          const rawCode =
            (error as { code?: unknown; errorCode?: unknown })?.code ??
            (error as { code?: unknown; errorCode?: unknown })?.errorCode;
          const code = typeof rawCode === "string" ? rawCode : undefined;
          // Safe retry invariant: retry only on attempt 1 when the transaction
          // callback has NOT started and the error indicates a severed connection.
          if (attempt === 1 && !transactionEntered && isClosedConnectionError(error)) {
            console.warn(
              JSON.stringify({
                event: "collector_persistence_connection_retry",
                reason: "closed_connection_before_transaction",
                attempt,
                maxAttempts,
                code: code ?? "NONE",
              }),
            );
            continue;
          }
          throw error;
        }
      }
      throw new Error("Persistence transaction acquisition exhausted attempts");
    };

    return await Promise.race([persistWork(), watchdog.promise]);
  } finally {
    watchdog.cancel();
  }
}
