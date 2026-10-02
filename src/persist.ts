import type { PrismaClient } from "@prisma/client";
import {
  dedupeObservations,
  type CollectionRunInput,
  type FuelObservation,
  type PersistStats,
} from "./fuel/types.js";

export const DEFAULT_DB_STATEMENT_TIMEOUT_MS = 30_000;
export const DEFAULT_DB_TRANSACTION_TIMEOUT_MS = 35_000;
export const DEFAULT_DB_MAX_WAIT_MS = 15_000;
export const DEFAULT_WATCHDOG_SAFETY_MARGIN_MS = 10_000;
export const DEFAULT_PERSIST_WATCHDOG_TIMEOUT_MS =
  DEFAULT_DB_MAX_WAIT_MS + DEFAULT_DB_TRANSACTION_TIMEOUT_MS + DEFAULT_WATCHDOG_SAFETY_MARGIN_MS;

export type PersistOptions = {
  statementTimeoutMs?: number | undefined;
  transactionTimeoutMs?: number | undefined;
  maxWaitMs?: number | undefined;
  watchdogTimeoutMs?: number | undefined;
  onWatchdogTimeout?: ((fatalError: Error) => void) | undefined;
  terminateProcess?: ((code: number) => void) | undefined;
  _testSleepSeconds?: number | undefined;
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
  const watchdogTimeoutMs =
    options.watchdogTimeoutMs ??
    maxWaitMs + transactionTimeoutMs + DEFAULT_WATCHDOG_SAFETY_MARGIN_MS;
  const terminate = options.terminateProcess ?? ((code: number) => process.exit(code));

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

  const executePersist = async (db: {
    $executeRaw?: PrismaClient["$executeRaw"];
    $queryRaw: PrismaClient["$queryRaw"];
  }): Promise<PersistStats> => {
    if (typeof db.$executeRaw === "function") {
      await db.$executeRaw`SELECT set_config('statement_timeout', ${String(Math.floor(statementTimeoutMs))}, true)`;
    }

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

    return {
      observationsReceived: Number(row.observations_received),
      currentRowsUpserted: Number(row.current_rows_upserted),
      historyRowsInserted: Number(row.history_rows_inserted),
      databaseQueries: 1,
      finishedAt,
      durationMs,
    };
  };

  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;

  const watchdogPromise = new Promise<never>((_, reject) => {
    watchdogTimer = setTimeout(() => {
      const fatalError = new Error(
        `Persist watchdog expired after ${watchdogTimeoutMs}ms: Prisma persistence did not settle within statement/transaction timeouts`,
      );
      (fatalError as { code?: string }).code = "PERSIST_WATCHDOG_TIMEOUT";
      console.error(
        JSON.stringify({
          event: "collector_persistence_watchdog_timeout",
          message:
            "Prisma persistence failed to settle within watchdog timeout; terminating process to prevent lock overlap and close hanging sockets",
          watchdogTimeoutMs,
          statementTimeoutMs,
          transactionTimeoutMs,
        }),
      );
      options.onWatchdogTimeout?.(fatalError);
      terminate(1);
      reject(fatalError);
    }, watchdogTimeoutMs);
  });

  try {
    const persistWork = async (): Promise<PersistStats> => {
      if (typeof prisma.$transaction === "function") {
        return await prisma.$transaction(
          async (tx) => executePersist(tx as unknown as PrismaClient),
          {
            maxWait: maxWaitMs,
            timeout: transactionTimeoutMs,
          },
        );
      }
      return await executePersist(prisma);
    };

    return await Promise.race([persistWork(), watchdogPromise]);
  } finally {
    if (watchdogTimer !== undefined) {
      clearTimeout(watchdogTimer);
    }
  }
}

/**
 * Idempotent bulk upsert of clubs.
 * Never DELETEs clubs omitted from the payload — discovery absence must not
 * remove registry rows or flip hasGas via eisapi/sitemap.
 */
export async function importClubsBulk(
  prisma: PrismaClient,
  clubs: Array<{
    clubNumber: number;
    clubId: string;
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    hasGas: boolean;
    storeType: string | null;
    gasClassification: { source: string; signals: string[] } | null;
    services: string[];
    clubUrl: string | null;
    source: string | null;
  }>,
): Promise<{ upserted: number }> {
  if (clubs.length === 0) return { upserted: 0 };

  const payload = clubs.map((c) => ({
    club_number: c.clubNumber,
    club_id: c.clubId,
    name: c.name,
    address1: c.address1,
    address2: c.address2,
    city: c.city,
    state: c.state,
    postal_code: c.postalCode,
    latitude: c.latitude,
    longitude: c.longitude,
    phone: c.phone,
    has_gas: c.hasGas,
    store_type: c.storeType,
    gas_classification: c.gasClassification,
    services: c.services,
    club_url: c.clubUrl,
    source: c.source,
  }));

  const result = await prisma.$executeRaw`
    INSERT INTO "Club" (
      "clubNumber", "clubId", "name", "address1", "address2", "city", "state", "postalCode",
      "latitude", "longitude", "phone", "hasGas", "storeType", "gasClassification",
      "services", "clubUrl", "source", "createdAt", "updatedAt"
    )
    SELECT
      club_number,
      club_id,
      name,
      address1,
      NULLIF(address2, ''),
      city,
      state,
      postal_code,
      latitude,
      longitude,
      NULLIF(phone, ''),
      has_gas,
      NULLIF(store_type, ''),
      gas_classification,
      COALESCE(
        (SELECT array_agg(elem) FROM jsonb_array_elements_text(COALESCE(services, '[]'::jsonb)) AS elem),
        ARRAY[]::text[]
      ),
      NULLIF(club_url, ''),
      NULLIF(source, ''),
      NOW(),
      NOW()
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
      AS x(
        club_number int,
        club_id text,
        name text,
        address1 text,
        address2 text,
        city text,
        state text,
        postal_code text,
        latitude double precision,
        longitude double precision,
        phone text,
        has_gas boolean,
        store_type text,
        gas_classification jsonb,
        services jsonb,
        club_url text,
        source text
      )
    ON CONFLICT ("clubNumber") DO UPDATE SET
      "clubId" = EXCLUDED."clubId",
      "name" = EXCLUDED."name",
      "address1" = EXCLUDED."address1",
      "address2" = EXCLUDED."address2",
      "city" = EXCLUDED."city",
      "state" = EXCLUDED."state",
      "postalCode" = EXCLUDED."postalCode",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "phone" = EXCLUDED."phone",
      "hasGas" = EXCLUDED."hasGas",
      "storeType" = EXCLUDED."storeType",
      "gasClassification" = EXCLUDED."gasClassification",
      "services" = EXCLUDED."services",
      "clubUrl" = EXCLUDED."clubUrl",
      "source" = EXCLUDED."source",
      "updatedAt" = NOW()
  `;

  return { upserted: typeof result === "number" ? result : clubs.length };
}
