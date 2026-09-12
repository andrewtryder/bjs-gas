import { type PrismaClient, Prisma } from "@prisma/client";
import { calculateMedian, formatPriceString } from "./median.js";

export const CANONICAL_FUEL_SKU = "1";

export interface NationalSummaryStation {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
}

export interface NationalSummaryResult {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  stationCount: number;
  medianPrice: string | null;
  min: {
    price: string;
    station: NationalSummaryStation;
  } | null;
  max: {
    price: string;
    station: NationalSummaryStation;
  } | null;
}

export interface TrendPoint {
  date: string;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
  stationCount: number;
}

export interface NationalTrendsResult {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  days: number;
  state?: string | undefined;
  points: TrendPoint[];
}

export interface StateSummaryItem {
  state: string;
  stationCount: number;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
}

export interface StateSummariesResult {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  states: StateSummaryItem[];
}

export interface PriceMoverItem {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
  fuel: {
    sku: string;
    name: string;
  };
  startingPrice: string;
  currentPrice: string;
  absoluteChange: string;
  percentageChange: string;
  startObservedAt: string;
  currentObservedAt: string;
}

export interface PriceMoversResult {
  generatedAt: string;
  fuel: {
    sku: string;
    name: string;
  };
  days: number;
  increases: PriceMoverItem[];
  decreases: PriceMoverItem[];
}

/**
 * Resolves fuel name for SKU, defaulting to standard name or querying FuelPriceCurrent.
 */
async function resolveFuelInfo(
  prisma: PrismaClient,
  fuelSku: string,
): Promise<{ sku: string; name: string }> {
  const row = await prisma.fuelPriceCurrent.findFirst({
    where: { fuelSku },
    select: { fuelName: true },
  });
  if (row?.fuelName) {
    return { sku: fuelSku, name: row.fuelName };
  }
  const defaultNames: Record<string, string> = {
    "1": "Unleaded",
    "3": "Premium",
    "4": "Diesel",
  };
  return { sku: fuelSku, name: defaultNames[fuelSku] || "Fuel" };
}

/**
 * 1. Current National Summary
 * Computes national median, minimum, maximum, and station count for the active fuel.
 */
export async function getNationalSummary(
  prisma: PrismaClient,
  fuelSku: string = CANONICAL_FUEL_SKU,
): Promise<NationalSummaryResult> {
  const fuel = await resolveFuelInfo(prisma, fuelSku);

  const rows = await prisma.$queryRaw<
    Array<{
      clubNumber: number;
      name: string;
      city: string;
      state: string;
      price: string;
    }>
  >`
    SELECT
      c."clubNumber",
      c.name,
      c.city,
      c.state,
      p.price::text as price
    FROM "FuelPriceCurrent" p
    JOIN "Club" c ON c."clubNumber" = p."clubNumber"
    WHERE p."fuelSku" = ${fuelSku}
    ORDER BY p.price ASC, c."clubNumber" ASC;
  `;

  if (rows.length === 0) {
    return {
      generatedAt: new Date().toISOString(),
      fuel,
      stationCount: 0,
      medianPrice: null,
      min: null,
      max: null,
    };
  }

  const prices = rows.map((r) => Number.parseFloat(r.price));
  const median = calculateMedian(prices);
  const minRow = rows[0]!;
  const maxRow = rows[rows.length - 1]!;

  return {
    generatedAt: new Date().toISOString(),
    fuel,
    stationCount: rows.length,
    medianPrice: median !== null ? formatPriceString(median) : null,
    min: {
      price: formatPriceString(minRow.price),
      station: {
        clubNumber: minRow.clubNumber,
        name: minRow.name,
        city: minRow.city,
        state: minRow.state,
      },
    },
    max: {
      price: formatPriceString(maxRow.price),
      station: {
        clubNumber: maxRow.clubNumber,
        name: maxRow.name,
        city: maxRow.city,
        state: maxRow.state,
      },
    },
  };
}

/**
 * 2. Historical National Trend
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
): Promise<NationalTrendsResult> {
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
}

/**
 * 3. State Analytics
 * Returns state-by-state median, minimum, maximum, and station counts.
 */
export async function getStateSummaries(
  prisma: PrismaClient,
  fuelSku: string = CANONICAL_FUEL_SKU,
): Promise<StateSummariesResult> {
  const fuel = await resolveFuelInfo(prisma, fuelSku);

  const states = await prisma.$queryRaw<
    Array<{
      state: string;
      stationCount: number;
      minPrice: string;
      maxPrice: string;
      medianPrice: string;
    }>
  >`
    SELECT
      c.state,
      count(*)::int AS "stationCount",
      min(p.price)::numeric(6,3)::text AS "minPrice",
      max(p.price)::numeric(6,3)::text AS "maxPrice",
      percentile_cont(0.5) WITHIN GROUP (ORDER BY p.price)::numeric(6,3)::text AS "medianPrice"
    FROM "FuelPriceCurrent" p
    JOIN "Club" c ON c."clubNumber" = p."clubNumber"
    WHERE p."fuelSku" = ${fuelSku}
    GROUP BY c.state
    ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY p.price) ASC, c.state ASC;
  `;

  return {
    generatedAt: new Date().toISOString(),
    fuel,
    states,
  };
}

/**
 * 4. Recent Price Movers
 * Returns stations with the largest price increases and decreases over the requested window.
 */
export async function getPriceMovers(
  prisma: PrismaClient,
  options: {
    fuelSku?: string | undefined;
    days?: number | undefined;
    limit?: number | undefined;
  } = {},
): Promise<PriceMoversResult> {
  const fuelSku = options.fuelSku || CANONICAL_FUEL_SKU;
  const rawDays = options.days !== undefined ? options.days : 7;
  const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : 7, 1), 90);
  const limit = Math.min(Math.max(options.limit || 10, 1), 50);

  const fuel = await resolveFuelInfo(prisma, fuelSku);

  const rows = await prisma.$queryRaw<
    Array<{
      clubNumber: number;
      name: string;
      city: string;
      state: string;
      fuelName: string;
      currentPrice: string;
      currentObservedAt: Date;
      startingPrice: string;
      startObservedAt: Date;
      absoluteChange: number;
      percentageChange: number;
    }>
  >`
    WITH starting_prices AS (
      SELECT DISTINCT ON (h."clubNumber")
        h."clubNumber",
        h.price AS starting_price,
        h."observedAt" AS start_observed_at
      FROM "FuelPriceHistory" h
      WHERE h."fuelSku" = ${fuelSku}
        AND h."observedAt" <= now() - (${days} * INTERVAL '1 day')
      ORDER BY h."clubNumber", h."observedAt" DESC
    )
    SELECT
      c."clubNumber",
      c.name,
      c.city,
      c.state,
      curr."fuelName",
      curr.price::numeric(6,3)::text AS "currentPrice",
      curr."observedAt" AS "currentObservedAt",
      s.starting_price::numeric(6,3)::text AS "startingPrice",
      s.start_observed_at AS "startObservedAt",
      (curr.price - s.starting_price)::numeric(6,3)::float8 AS "absoluteChange",
      ROUND(((curr.price - s.starting_price) / s.starting_price) * 100, 2)::float8 AS "percentageChange"
    FROM "FuelPriceCurrent" curr
    JOIN starting_prices s
      ON s."clubNumber" = curr."clubNumber"
    JOIN "Club" c
      ON c."clubNumber" = curr."clubNumber"
    WHERE curr."fuelSku" = ${fuelSku}
      AND curr.price IS DISTINCT FROM s.starting_price
    ORDER BY "absoluteChange" DESC;
  `;

  const increases: PriceMoverItem[] = [];
  const decreases: PriceMoverItem[] = [];

  for (const r of rows) {
    const item: PriceMoverItem = {
      clubNumber: r.clubNumber,
      name: r.name,
      city: r.city,
      state: r.state,
      fuel: { sku: fuelSku, name: r.fuelName },
      startingPrice: formatPriceString(r.startingPrice),
      currentPrice: formatPriceString(r.currentPrice),
      absoluteChange: (r.absoluteChange > 0 ? "+" : "") + r.absoluteChange.toFixed(3),
      percentageChange: (r.percentageChange > 0 ? "+" : "") + r.percentageChange.toFixed(2) + "%",
      startObservedAt: r.startObservedAt.toISOString(),
      currentObservedAt: r.currentObservedAt.toISOString(),
    };

    if (r.absoluteChange > 0) {
      increases.push(item);
    } else if (r.absoluteChange < 0) {
      decreases.push(item);
    }
  }

  // Sort decreases by largest negative change first
  decreases.sort((a, b) => Number.parseFloat(a.absoluteChange) - Number.parseFloat(b.absoluteChange));

  return {
    generatedAt: new Date().toISOString(),
    fuel,
    days,
    increases: increases.slice(0, limit),
    decreases: decreases.slice(0, limit),
  };
}
