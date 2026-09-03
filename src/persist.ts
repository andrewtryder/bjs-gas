import type { PrismaClient } from "@prisma/client";
import {
  dedupeObservations,
  type CollectionRunInput,
  type FuelObservation,
  type PersistStats,
} from "./fuel/types.js";

/**
 * Persist observations + one CollectionRun with a single parameterized SQL statement.
 * History inserts only when price is new or changed (NUMERIC IS DISTINCT FROM).
 * Empty observation arrays leave current prices untouched but still record the run.
 */
export async function persistFuelObservations(
  prisma: PrismaClient,
  observations: FuelObservation[],
  run: CollectionRunInput,
): Promise<PersistStats> {
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
      finished_at: run.finishedAt,
      duration_ms: run.durationMs,
      clubs_configured: run.clubsConfigured,
      clubs_succeeded: run.clubsSucceeded,
      clubs_empty_fuels: run.clubsEmptyFuels,
      clubs_hard_failed: run.clubsHardFailed,
      fuel_observations: run.fuelObservations,
      degraded: run.degraded,
      failures: run.failures,
    },
  ];

  const rows = await prisma.$queryRaw<
    Array<{
      observations_received: bigint;
      history_rows_inserted: bigint;
      current_rows_upserted: bigint;
      run_rows_inserted: bigint;
    }>
  >`
    WITH incoming AS (
      SELECT
        club_number::int AS club_number,
        fuel_sku::text AS fuel_sku,
        fuel_name::text AS fuel_name,
        price::numeric(6,3) AS price,
        NULLIF(source_price_at_local, '')::text AS source_price_at_local,
        observed_at::timestamptz AS observed_at
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
        r.started_at::timestamptz,
        r.finished_at::timestamptz,
        r.duration_ms::int,
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
      RETURNING 1
    )
    SELECT
      (SELECT count(*)::bigint FROM incoming) AS observations_received,
      (SELECT count(*)::bigint FROM changed) AS history_rows_inserted,
      (SELECT count(*)::bigint FROM upserted) AS current_rows_upserted,
      (SELECT count(*)::bigint FROM run_row) AS run_rows_inserted
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Bulk persistence returned no stats row");
  }
  if (Number(row.run_rows_inserted) !== 1) {
    throw new Error("CollectionRun insert did not return exactly one row");
  }

  return {
    observationsReceived: Number(row.observations_received),
    currentRowsUpserted: Number(row.current_rows_upserted),
    historyRowsInserted: Number(row.history_rows_inserted),
    databaseQueries: 1,
  };
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
