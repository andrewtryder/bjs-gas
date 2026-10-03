import type { PrismaClient } from "@prisma/client";
import type { StateSummariesResponse } from "@bjs-gas/contracts";
import { CANONICAL_FUEL_SKU, resolveFuelInfo } from "./fuel-info.js";
import { timedQuery } from "./query-timing.js";

/**
 * State analytics: state-by-state median, minimum, maximum, and station counts.
 */
export async function getStateSummaries(
  prisma: PrismaClient,
  fuelSku: string = CANONICAL_FUEL_SKU,
): Promise<StateSummariesResponse> {
  return timedQuery("getStateSummaries", async () => {
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
        AND c."hasGas" = true
      GROUP BY c.state
      ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY p.price) ASC, c.state ASC;
    `;

    return {
      generatedAt: new Date().toISOString(),
      fuel,
      states,
    };
  });
}
