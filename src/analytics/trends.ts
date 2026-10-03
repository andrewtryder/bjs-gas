import { type PrismaClient, Prisma } from "@prisma/client";
import type { NationalTrendsResponse } from "@bjs-gas/contracts";
import { CANONICAL_FUEL_SKU, resolveFuelInfo } from "./fuel-info.js";
import { timedQuery } from "./query-timing.js";

/**
 * Historical national trend.
 * Reconstructs daily national median, min, max, and station count.
 * Cutoff: End-of-day UTC (23:59:59.999Z) for past dates; now() for current date.
 */
export async function getNationalTrends(
  prisma: PrismaClient,
  options: {
    fuelSku?: string | undefined;
    days?: number | undefined;
    state?: string | undefined;
  } = {},
): Promise<NationalTrendsResponse> {
  return timedQuery("getNationalTrends", async () => {
    const fuelSku = options.fuelSku || CANONICAL_FUEL_SKU;
    const rawDays = options.days !== undefined ? options.days : 30;
    // Clamp days between 1 and 90
    const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : 30, 1), 90);
    const normalizedState = options.state ? options.state.trim().toUpperCase() : undefined;
    const stateFilter = normalizedState
      ? Prisma.sql`AND c.state = ${normalizedState}`
      : Prisma.empty;

    const fuel = await resolveFuelInfo(prisma, fuelSku);

  const points = await prisma.$queryRaw<
    Array<{
      date: string;
      stationCount: number;
      minPrice: string;
      maxPrice: string;
      medianPrice: string;
    }>
  >`
    WITH dates AS (
      SELECT
        generate_series(
          CURRENT_DATE - (${days} - 1) * INTERVAL '1 day',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day_date
    ),
    day_cutoffs AS (
      SELECT
        to_char(day_date, 'YYYY-MM-DD') AS day,
        CASE
          WHEN day_date = CURRENT_DATE THEN now()
          ELSE (day_date + INTERVAL '1 day' - INTERVAL '1 millisecond')::timestamptz
        END AS cutoff
      FROM dates
    ),
    price_intervals AS (
      SELECT
        h."clubNumber",
        h."fuelSku",
        h.price,
        h."observedAt" AS valid_from,
        COALESCE(
          LEAD(h."observedAt") OVER (
            PARTITION BY h."clubNumber", h."fuelSku"
            ORDER BY h."observedAt"
          ),
          '9999-12-31'::timestamptz
        ) AS valid_to
      FROM "FuelPriceHistory" h
      WHERE h."fuelSku" = ${fuelSku}
    ),
    station_prices AS (
      SELECT
        d.day,
        p."clubNumber",
        p.price
      FROM day_cutoffs d
      JOIN price_intervals p
        ON p.valid_from <= d.cutoff
       AND d.cutoff < p.valid_to
      JOIN "Club" c
        ON c."clubNumber" = p."clubNumber"
      WHERE c."hasGas" = true
      ${stateFilter}
    )
    SELECT
      day AS date,
      count(*)::int AS "stationCount",
      min(price)::numeric(6,3)::text AS "minPrice",
      max(price)::numeric(6,3)::text AS "maxPrice",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY price)::numeric(6,3)::text AS "medianPrice"
    FROM station_prices
    GROUP BY day
    HAVING count(*) > 0
    ORDER BY day ASC;
  `;

    return {
      generatedAt: new Date().toISOString(),
      fuel,
      days,
      ...(normalizedState ? { state: normalizedState } : {}),
      points,
    };
  });
}
