import type { PrismaClient } from "@prisma/client";

export const CANONICAL_FUEL_SKU = "1";

/**
 * Resolves fuel name for SKU, defaulting to standard name or querying FuelPriceCurrent.
 */
export async function resolveFuelInfo(
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
