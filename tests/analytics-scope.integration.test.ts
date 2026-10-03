import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  getNationalSummary,
  getPriceMovers,
  getStateSummaries,
} from "../src/analytics/queries.js";

const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("analytics exclude non-gas clubs", () => {
  let prisma: PrismaClient;
  const gasClub = 189201;
  const nonGasClub = 189202;
  const fuelSku = "scope-test";
  const state = "ZZ";

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
    await prisma.fuelPriceHistory.deleteMany({
      where: { clubNumber: { in: [gasClub, nonGasClub] } },
    });
    await prisma.fuelPriceCurrent.deleteMany({
      where: { clubNumber: { in: [gasClub, nonGasClub] } },
    });
    await prisma.club.deleteMany({ where: { clubNumber: { in: [gasClub, nonGasClub] } } });

    await prisma.club.createMany({
      data: [
        {
          clubNumber: gasClub,
          clubId: "S201",
          name: "Scope Gas",
          address1: "1 Gas",
          city: "Gasville",
          state,
          postalCode: "00000",
          hasGas: true,
        },
        {
          clubNumber: nonGasClub,
          clubId: "S202",
          name: "Scope NonGas",
          address1: "2 Closed",
          city: "Closedville",
          state,
          postalCode: "00000",
          hasGas: false,
        },
      ],
    });

    const startObservedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const currentObservedAt = new Date();

    await prisma.fuelPriceHistory.createMany({
      data: [
        {
          clubNumber: gasClub,
          fuelSku,
          fuelName: "Scope Fuel",
          price: "3.000",
          observedAt: startObservedAt,
        },
        {
          clubNumber: nonGasClub,
          fuelSku,
          fuelName: "Scope Fuel",
          price: "3.000",
          observedAt: startObservedAt,
        },
      ],
    });

    await prisma.fuelPriceCurrent.createMany({
      data: [
        {
          clubNumber: gasClub,
          fuelSku,
          fuelName: "Scope Fuel",
          price: "3.500",
          observedAt: currentObservedAt,
        },
        {
          clubNumber: nonGasClub,
          fuelSku,
          fuelName: "Scope Fuel",
          price: "9.999",
          observedAt: currentObservedAt,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.fuelPriceHistory.deleteMany({
      where: { clubNumber: { in: [gasClub, nonGasClub] } },
    });
    await prisma.fuelPriceCurrent.deleteMany({
      where: { clubNumber: { in: [gasClub, nonGasClub] } },
    });
    await prisma.club.deleteMany({ where: { clubNumber: { in: [gasClub, nonGasClub] } } });
    await prisma.$disconnect();
  });

  it("national summary counts only hasGas clubs and uses their prices", async () => {
    const summary = await getNationalSummary(prisma, fuelSku);
    expect(summary.stationCount).toBe(1);
    expect(summary.medianPrice).toBe("3.500");
    expect(summary.min?.price).toBe("3.500");
    expect(summary.max?.price).toBe("3.500");
    expect(summary.min?.station.clubNumber).toBe(gasClub);
    expect(summary.max?.station.clubNumber).toBe(gasClub);
  });

  it("state summaries ignore non-gas clubs in the same state", async () => {
    const states = await getStateSummaries(prisma, fuelSku);
    const scoped = states.states.find((s) => s.state === state);
    expect(scoped).toEqual({
      state,
      stationCount: 1,
      minPrice: "3.500",
      maxPrice: "3.500",
      medianPrice: "3.500",
    });
  });

  it("price movers omit non-gas clubs even when their change would rank first", async () => {
    const movers = await getPriceMovers(prisma, { fuelSku, days: 7, limit: 50 });
    const ids = [...movers.increases, ...movers.decreases].map((m) => m.clubNumber);
    expect(ids).toContain(gasClub);
    expect(ids).not.toContain(nonGasClub);
    expect(
      movers.increases.some((m) => m.clubNumber === gasClub && m.currentPrice === "3.500"),
    ).toBe(true);
  });
});
