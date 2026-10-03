import type { PrismaClient } from "@prisma/client";
import type { NationalSummaryResponse } from "@bjs-gas/contracts";
import { CANONICAL_FUEL_SKU, resolveFuelInfo } from "./fuel-info.js";
import { calculateMedian, formatPriceString } from "./median.js";
import { timedQuery } from "./query-timing.js";

/**
 * Current national summary: median, min, max, and station count for the active fuel.
 */
export async function getNationalSummary(
  prisma: PrismaClient,
  fuelSku: string = CANONICAL_FUEL_SKU,
): Promise<NationalSummaryResponse> {
  return timedQuery("getNationalSummary", async () => {
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
        AND c."hasGas" = true
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
  });
}
