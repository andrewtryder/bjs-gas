import type { PrismaClient } from "@prisma/client";
import type { PriceMoverItem, PriceMoversResponse } from "@bjs-gas/contracts";
import { CANONICAL_FUEL_SKU, resolveFuelInfo } from "./fuel-info.js";
import { formatPriceString } from "./median.js";
import { timedQuery } from "./query-timing.js";

/**
 * Recent price movers: stations with the largest price increases and decreases
 * over the requested window.
 */
export async function getPriceMovers(
  prisma: PrismaClient,
  options: {
    fuelSku?: string | undefined;
    days?: number | undefined;
    limit?: number | undefined;
  } = {},
): Promise<PriceMoversResponse> {
  return timedQuery("getPriceMovers", async () => {
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
  });
}
