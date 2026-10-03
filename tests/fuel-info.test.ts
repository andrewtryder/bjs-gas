import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { CANONICAL_FUEL_SKU, resolveFuelInfo } from "../src/analytics/fuel-info.js";

function prismaWithFuelName(fuelName: string | null): PrismaClient {
  return {
    fuelPriceCurrent: {
      findFirst: vi.fn().mockResolvedValue(fuelName ? { fuelName } : null),
    },
  } as unknown as PrismaClient;
}

describe("resolveFuelInfo", () => {
  it("uses FuelPriceCurrent name when present", async () => {
    const prisma = prismaWithFuelName("Regular");
    await expect(resolveFuelInfo(prisma, "1")).resolves.toEqual({ sku: "1", name: "Regular" });
    expect(vi.mocked(prisma.fuelPriceCurrent.findFirst)).toHaveBeenCalledWith({
      where: { fuelSku: "1", club: { hasGas: true } },
      select: { fuelName: true },
    });
  });

  it("falls back to canonical names when the lookup is empty", async () => {
    const prisma = prismaWithFuelName(null);
    await expect(resolveFuelInfo(prisma, CANONICAL_FUEL_SKU)).resolves.toEqual({
      sku: "1",
      name: "Unleaded",
    });
    await expect(resolveFuelInfo(prisma, "3")).resolves.toEqual({ sku: "3", name: "Premium" });
    await expect(resolveFuelInfo(prisma, "4")).resolves.toEqual({ sku: "4", name: "Diesel" });
  });

  it("falls back to Fuel for unknown SKUs", async () => {
    const prisma = prismaWithFuelName(null);
    await expect(resolveFuelInfo(prisma, "99")).resolves.toEqual({ sku: "99", name: "Fuel" });
  });
});
