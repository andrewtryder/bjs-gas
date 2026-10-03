import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { persistFuelObservations } from "../src/persist.js";
import type { CollectionRunInput, FuelObservation } from "../src/fuel/types.js";

const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("bulk persistence against Postgres", () => {
  let prisma: PrismaClient;
  const clubNumber = 189001; // synthetic test club, unlikely to collide
  let runSeq = 0;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
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

  function runInput(
    overrides: Partial<CollectionRunInput> = {},
  ): CollectionRunInput & { finishedAt: string; durationMs: number } {
    runSeq += 1;
    const startedAt = new Date(Date.UTC(2026, 8, 2, 12, runSeq, 0)).toISOString();
    const finishedAt = new Date(Date.UTC(2026, 8, 2, 12, runSeq, 5)).toISOString();
    return {
      startedAt,
      clubsConfigured: 1,
      clubsSucceeded: 1,
      clubsEmptyFuels: 0,
      clubsHardFailed: 0,
      fuelObservations: 1,
      degraded: false,
      failures: [],
      ...overrides,
      scope: overrides.scope ?? "DIAGNOSTIC",
      finishedAt: overrides.finishedAt ?? finishedAt,
      durationMs: overrides.durationMs ?? 5000,
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
      scope: "FLEET",
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
    expect(inserted?.scope).toBe("FLEET");
  });

  it("cancels statement on PostgreSQL statement_timeout, rolls back, and leaves connection usable", async () => {
    const beforeRuns = await prisma.collectionRun.count();
    const beforeHist = await prisma.fuelPriceHistory.count({ where: { clubNumber } });
    const beforeCurrent = await prisma.fuelPriceCurrent.count({ where: { clubNumber } });

    let caughtError: unknown;
    try {
      await persistFuelObservations(
        prisma,
        [obs("3.999", "99", "2026-09-02T17:00:00.000Z")],
        runInput(),
        {
          statementTimeoutMs: 100,
          transactionTimeoutMs: 1_000,
          _testSleepSeconds: 0.5,
        },
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeDefined();
    const message = caughtError instanceof Error ? caughtError.message : String(caughtError);
    expect(message).toMatch(/statement timeout|57014/i);

    expect(await prisma.collectionRun.count()).toBe(beforeRuns);
    expect(await prisma.fuelPriceHistory.count({ where: { clubNumber } })).toBe(beforeHist);
    expect(await prisma.fuelPriceCurrent.count({ where: { clubNumber } })).toBe(beforeCurrent);

    const healthCheck = await prisma.club.count();
    expect(healthCheck).toBeGreaterThan(0);
  });

  it("computes finishedAt and durationMs including persistence when not provided", async () => {
    const run = runInput({
      startedAt: new Date(Date.now() - 5000).toISOString(),
    });
    const stats = await persistFuelObservations(
      prisma,
      [obs("3.777", "1", "2026-09-02T18:00:00.000Z")],
      {
        ...run,
        finishedAt: undefined,
        durationMs: undefined,
      },
    );
    expect(stats.finishedAt).toBeDefined();
    expect(new Date(stats.finishedAt).getTime()).toBeGreaterThan(0);
    expect(stats.durationMs).toBeGreaterThan(0);

    const inserted = await prisma.collectionRun.findFirst({
      where: { finishedAt: new Date(stats.finishedAt) },
    });
    expect(inserted).toBeDefined();
    expect(inserted?.durationMs).toBe(stats.durationMs);
  });

  it(
    "preserves exact ISO-8601 UTC instant when database session timezone is non-UTC (America/New_York)",
    async () => {
    const nyPrisma = new PrismaClient({
      datasources: {
        db: {
          url: `${url}${url!.includes("?") ? "&" : "?"}options=-c%20timezone=America/New_York`,
        },
      },
    });

    try {
      const tzRows = await nyPrisma.$queryRaw<Array<{ TimeZone: string }>>`SHOW timezone`;
      expect(tzRows[0]?.TimeZone).toBe("America/New_York");

      const testClubNumber = 189002;
      await nyPrisma.club.upsert({
        where: { clubNumber: testClubNumber },
        create: {
          clubNumber: testClubNumber,
          clubId: "T189_NY",
          name: "Test Club NY",
          address1: "1 NY Way",
          city: "New York",
          state: "NY",
          postalCode: "10001",
          hasGas: true,
        },
        update: { hasGas: true },
      });
      await nyPrisma.fuelPriceHistory.deleteMany({ where: { clubNumber: testClubNumber } });
      await nyPrisma.fuelPriceCurrent.deleteMany({ where: { clubNumber: testClubNumber } });

      const inputObservedAt = "2026-09-02T13:45:00.000Z";
      const inputStartedAt = "2026-09-02T13:40:00.000Z";
      const inputFinishedAt = "2026-09-02T13:45:10.000Z";

      const run = runInput({
        scope: "FLEET",
        startedAt: inputStartedAt,
        finishedAt: inputFinishedAt,
        durationMs: 70000,
      });

      const stats = await persistFuelObservations(
        nyPrisma,
        [
          {
            clubNumber: testClubNumber,
            fuelSku: "1",
            fuelName: "Unleaded",
            price: "3.799",
            sourcePriceAtLocal: "2026-09-02T09:45:00",
            observedAt: inputObservedAt,
          },
        ],
        run,
      );

      // Verify stats returned finishedAt matches exactly
      expect(stats.finishedAt).toBe(inputFinishedAt);

      // Query current price via Prisma findUnique on the America/New_York connection
      const current = await nyPrisma.fuelPriceCurrent.findUnique({
        where: { clubNumber_fuelSku: { clubNumber: testClubNumber, fuelSku: "1" } },
      });
      expect(current?.observedAt.toISOString()).toBe(inputObservedAt);

      // Query history row
      const history = await nyPrisma.fuelPriceHistory.findFirst({
        where: { clubNumber: testClubNumber, fuelSku: "1" },
      });
      expect(history?.observedAt.toISOString()).toBe(inputObservedAt);

      // Query CollectionRun row
      const collectionRun = await nyPrisma.collectionRun.findFirst({
        where: { startedAt: new Date(inputStartedAt) },
      });
      expect(collectionRun?.startedAt.toISOString()).toBe(inputStartedAt);
      expect(collectionRun?.finishedAt.toISOString()).toBe(inputFinishedAt);
      expect(collectionRun?.scope).toBe("FLEET");

      // Clean up
      await nyPrisma.fuelPriceCurrent.deleteMany({ where: { clubNumber: testClubNumber } });
      await nyPrisma.fuelPriceHistory.deleteMany({ where: { clubNumber: testClubNumber } });
      await nyPrisma.collectionRun.deleteMany({ where: { startedAt: new Date(inputStartedAt) } });
      await nyPrisma.club.deleteMany({ where: { clubNumber: testClubNumber } });
    } finally {
      await nyPrisma.$disconnect();
    }
  }, 15_000);

  it("diagnostic persist writes DIAGNOSTIC scope in the same bulk SQL", async () => {
    const run = runInput({
      scope: "DIAGNOSTIC",
      startedAt: "2026-10-03T12:10:00.000Z",
      finishedAt: "2026-10-03T12:10:05.000Z",
      durationMs: 5_000,
    });
    const stats = await persistFuelObservations(
      prisma,
      [obs("3.111", "1", "2026-10-03T12:10:00.000Z")],
      run,
    );
    expect(stats.databaseQueries).toBe(1);
    expect(stats.currentRowsUpserted).toBe(1);
    const inserted = await prisma.collectionRun.findFirst({
      where: { startedAt: new Date(run.startedAt) },
    });
    expect(inserted?.scope).toBe("DIAGNOSTIC");
    expect(inserted?.clubsConfigured).toBe(1);
    expect(inserted?.databaseQueries).toBe(1);
    await prisma.collectionRun.deleteMany({ where: { startedAt: new Date(run.startedAt) } });
  });
});
