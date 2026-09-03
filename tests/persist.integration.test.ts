import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { persistFuelObservations } from "../src/persist.js";
import type { CollectionRunInput, FuelObservation } from "../src/fuel/types.js";

const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("bulk persistence against Postgres", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url! } } });
  const clubNumber = 189001; // synthetic test club, unlikely to collide
  let runSeq = 0;

  beforeAll(async () => {
    await prisma.club.upsert({
      where: { clubNumber },
      create: {
        clubNumber,
        clubId: "T189",
        name: "Test Club",
        address1: "1 Test",
        city: "Testville",
        state: "TS",
        postalCode: "00000",
        hasGas: true,
      },
      update: { hasGas: true },
    });
    await prisma.fuelPriceHistory.deleteMany({ where: { clubNumber } });
    await prisma.fuelPriceCurrent.deleteMany({ where: { clubNumber } });
  });

  afterAll(async () => {
    await prisma.fuelPriceHistory.deleteMany({ where: { clubNumber } });
    await prisma.fuelPriceCurrent.deleteMany({ where: { clubNumber } });
    await prisma.club.deleteMany({ where: { clubNumber } });
    await prisma.$disconnect();
  });

  function obs(price: string, sku = "1", at = "2026-09-02T12:00:00.000Z"): FuelObservation {
    return {
      clubNumber,
      fuelSku: sku,
      fuelName: sku === "1" ? "Unleaded" : "Premium",
      price,
      sourcePriceAtLocal: "2026-09-01T15:01:33",
      observedAt: at,
    };
  }

  function runInput(overrides: Partial<CollectionRunInput> = {}): CollectionRunInput {
    runSeq += 1;
    const startedAt = new Date(Date.UTC(2026, 8, 2, 12, runSeq, 0)).toISOString();
    const finishedAt = new Date(Date.UTC(2026, 8, 2, 12, runSeq, 5)).toISOString();
    return {
      startedAt,
      finishedAt,
      durationMs: 5000,
      clubsConfigured: 1,
      clubsSucceeded: 1,
      clubsEmptyFuels: 0,
      clubsHardFailed: 0,
      fuelObservations: 1,
      degraded: false,
      failures: [],
      ...overrides,
    };
  }

  it("first price creates current + history in one SQL query", async () => {
    const stats = await persistFuelObservations(prisma, [obs("3.919")], runInput());
    expect(stats.databaseQueries).toBe(1);
    expect(stats.historyRowsInserted).toBe(1);
    expect(stats.currentRowsUpserted).toBe(1);
  });

  it("unchanged price updates current but creates no history", async () => {
    const before = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    const stats = await persistFuelObservations(
      prisma,
      [obs("3.919", "1", "2026-09-02T13:00:00.000Z")],
      runInput(),
    );
    const after = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    expect(stats.historyRowsInserted).toBe(0);
    expect(after).toBe(before);
    const current = await prisma.fuelPriceCurrent.findUnique({
      where: { clubNumber_fuelSku: { clubNumber, fuelSku: "1" } },
    });
    expect(current?.observedAt.toISOString()).toBe("2026-09-02T13:00:00.000Z");
  });

  it("changed price creates exactly one history row", async () => {
    const before = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    const stats = await persistFuelObservations(
      prisma,
      [obs("3.859", "1", "2026-09-02T14:00:00.000Z")],
      runInput(),
    );
    const after = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    expect(stats.historyRowsInserted).toBe(1);
    expect(after - before).toBe(1);
  });

  it("source-timestamp-only change creates no history", async () => {
    const before = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    await persistFuelObservations(
      prisma,
      [
        {
          ...obs("3.859", "1", "2026-09-02T15:00:00.000Z"),
          sourcePriceAtLocal: "2026-09-02T10:00:00",
        },
      ],
      runInput(),
    );
    const after = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    expect(after).toBe(before);
  });

  it("new SKU creates current + history", async () => {
    const stats = await persistFuelObservations(
      prisma,
      [obs("4.469", "3", "2026-09-02T16:00:00.000Z")],
      runInput(),
    );
    expect(stats.historyRowsInserted).toBe(1);
    expect(stats.currentRowsUpserted).toBe(1);
  });

  it("empty batch records CollectionRun and leaves current untouched", async () => {
    const beforeCurrent = await prisma.fuelPriceCurrent.count({ where: { clubNumber } });
    const beforeHist = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    const beforeRuns = await prisma.collectionRun.count();
    const emptyRun = runInput({
      clubsSucceeded: 0,
      clubsEmptyFuels: 1,
      clubsHardFailed: 0,
      fuelObservations: 0,
      failures: [{ clubNumber: 901, attempts: 1, error: "Empty fuel array", status: 200 }],
    });
    const stats = await persistFuelObservations(prisma, [], emptyRun);
    expect(stats.databaseQueries).toBe(1);
    expect(stats.observationsReceived).toBe(0);
    expect(stats.historyRowsInserted).toBe(0);
    expect(await prisma.fuelPriceCurrent.count({ where: { clubNumber } })).toBe(beforeCurrent);
    expect(await prisma.fuelPriceHistory.count({ where: { clubNumber } })).toBe(beforeHist);
    expect(await prisma.collectionRun.count()).toBe(beforeRuns + 1);
    const inserted = await prisma.collectionRun.findFirst({
      where: { finishedAt: new Date(emptyRun.finishedAt) },
    });
    expect(inserted?.fuelObservations).toBe(0);
    expect(inserted?.databaseQueries).toBe(1);
    expect(inserted?.historyChanges).toBe(0);
    expect(inserted?.clubsEmptyFuels).toBe(1);
  });
});
