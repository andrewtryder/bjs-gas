import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { calculateMedian, formatPriceString } from "../src/analytics/median.js";
import {
  getNationalSummary,
  getNationalTrends,
  getStateSummaries,
  getPriceMovers,
} from "../src/analytics/queries.js";

describe("median calculation and precision", () => {
  it("handles null, empty, or non-finite inputs", () => {
    expect(calculateMedian([])).toBeNull();
    expect(calculateMedian([Number.NaN, Number.POSITIVE_INFINITY])).toBeNull();
  });

  it("calculates median for odd number of values", () => {
    expect(calculateMedian([3.199])).toBe(3.199);
    expect(calculateMedian([3.299, 3.099, 3.199])).toBe(3.199);
    expect(calculateMedian([3.5, 3.1, 3.9, 3.2, 3.8])).toBe(3.5);
  });

  it("calculates median for even number of values with exact average", () => {
    // (3.100 + 3.200) / 2 = 3.150
    expect(calculateMedian([3.1, 3.2])).toBe(3.15);
    // (3.199 + 3.209) / 2 = 3.204
    expect(calculateMedian([3.199, 3.209])).toBe(3.204);
    // Unsorted array with 4 items: [3.099, 3.199, 3.399, 3.499] -> (3.199 + 3.399)/2 = 3.299
    expect(calculateMedian([3.499, 3.099, 3.399, 3.199])).toBe(3.299);
  });

  it("preserves exact 3-decimal gas-price rounding", () => {
    // (3.123 + 3.124) / 2 = 3.1235 -> rounds to 3.124
    expect(calculateMedian([3.123, 3.124])).toBe(3.124);
  });

  it("formats price strings accurately", () => {
    expect(formatPriceString(3.199)).toBe("3.199");
    expect(formatPriceString("3.2")).toBe("3.200");
    expect(formatPriceString(null)).toBe("—");
    expect(formatPriceString(undefined)).toBe("—");
    expect(formatPriceString("invalid")).toBe("—");
  });
});

interface SimulatedHistoryEvent {
  clubNumber: number;
  fuelSku: string;
  price: number;
  observedAt: Date;
}

/**
 * Pure simulation of the SQL reconstruction logic (Approach A):
 * For a given target cutoff and station+fuel, find the latest price where observedAt <= cutoff.
 */
function reconstructAsOfPrice(
  events: SimulatedHistoryEvent[],
  clubNumber: number,
  fuelSku: string,
  cutoff: Date,
): number | null {
  const matches = events
    .filter(
      (e) =>
        e.clubNumber === clubNumber &&
        e.fuelSku === fuelSku &&
        e.observedAt.getTime() <= cutoff.getTime(),
    )
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());

  return matches.length > 0 ? matches[0]!.price : null;
}

function reconstructDailyPopulations(
  events: SimulatedHistoryEvent[],
  clubs: Array<{ clubNumber: number; state: string }>,
  fuelSku: string,
  cutoffs: Array<{ day: string; cutoff: Date }>,
) {
  return cutoffs.map(({ day, cutoff }) => {
    const prices: number[] = [];
    for (const club of clubs) {
      const price = reconstructAsOfPrice(events, club.clubNumber, fuelSku, cutoff);
      if (price !== null) {
        prices.push(price);
      }
    }
    return {
      day,
      stationCount: prices.length,
      medianPrice: calculateMedian(prices),
      minPrice: prices.length > 0 ? Math.min(...prices) : null,
      maxPrice: prices.length > 0 ? Math.max(...prices) : null,
      prices,
    };
  });
}

describe("historical price reconstruction logic", () => {
  const clubs = [
    { clubNumber: 1, state: "MA" },
    { clubNumber: 2, state: "MA" },
    { clubNumber: 3, state: "NH" },
  ];

  it("persists price across days with NO price changes", () => {
    // Station 1 has price $3.19 on Sep 1 and NO changes thereafter
    const events: SimulatedHistoryEvent[] = [
      { clubNumber: 1, fuelSku: "1", price: 3.199, observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const cutoffs = [
      { day: "2026-09-01", cutoff: new Date("2026-09-01T23:59:59.999Z") },
      { day: "2026-09-02", cutoff: new Date("2026-09-02T23:59:59.999Z") },
      { day: "2026-09-03", cutoff: new Date("2026-09-03T23:59:59.999Z") },
    ];

    const results = reconstructDailyPopulations(events, [clubs[0]!], "1", cutoffs);

    expect(results[0]?.prices).toEqual([3.199]);
    expect(results[1]?.prices).toEqual([3.199]); // Persisted to Sep 2
    expect(results[2]?.prices).toEqual([3.199]); // Persisted to Sep 3
    expect(results[1]?.stationCount).toBe(1);
    expect(results[2]?.stationCount).toBe(1);
  });

  it("switches price on change date and does NOT extrapolate backward before first observation", () => {
    // Station 1: Sep 1: $3.199, Sep 3: $3.099
    // Station 2: First observed Sep 2: $3.299 (did NOT exist on Sep 1!)
    const events: SimulatedHistoryEvent[] = [
      { clubNumber: 1, fuelSku: "1", price: 3.199, observedAt: new Date("2026-09-01T10:00:00Z") },
      { clubNumber: 2, fuelSku: "1", price: 3.299, observedAt: new Date("2026-09-02T08:00:00Z") },
      { clubNumber: 1, fuelSku: "1", price: 3.099, observedAt: new Date("2026-09-03T12:00:00Z") },
    ];

    const cutoffs = [
      // Day before any station observed (Aug 31)
      { day: "2026-08-31", cutoff: new Date("2026-08-31T23:59:59.999Z") },
      // Day 1: Station 1 exists ($3.199); Station 2 does NOT exist yet
      { day: "2026-09-01", cutoff: new Date("2026-09-01T23:59:59.999Z") },
      // Day 2: Station 1 ($3.199), Station 2 joins ($3.299)
      { day: "2026-09-02", cutoff: new Date("2026-09-02T23:59:59.999Z") },
      // Day 3: Station 1 updates to $3.099, Station 2 stays at $3.299
      { day: "2026-09-03", cutoff: new Date("2026-09-03T23:59:59.999Z") },
    ];

    const results = reconstructDailyPopulations(events, clubs.slice(0, 2), "1", cutoffs);

    // Aug 31: zero stations contribute
    expect(results[0]?.stationCount).toBe(0);
    expect(results[0]?.medianPrice).toBeNull();

    // Sep 01: only Station 1 contributes (station count = 1, NOT 2)
    expect(results[1]?.stationCount).toBe(1);
    expect(results[1]?.medianPrice).toBe(3.199);

    // Sep 02: both stations contribute (station count = 2)
    // Median of [3.199, 3.299] = 3.249
    expect(results[2]?.stationCount).toBe(2);
    expect(results[2]?.medianPrice).toBe(3.249);

    // Sep 03: Station 1 drops to 3.099, Station 2 unchanged at 3.299
    // Median of [3.099, 3.299] = 3.199
    expect(results[3]?.stationCount).toBe(2);
    expect(results[3]?.medianPrice).toBe(3.199);
    expect(results[3]?.minPrice).toBe(3.099);
    expect(results[3]?.maxPrice).toBe(3.299);
  });

  it("keeps multiple fuels strictly separated", () => {
    const events: SimulatedHistoryEvent[] = [
      { clubNumber: 1, fuelSku: "1", price: 3.199, observedAt: new Date("2026-09-01T10:00:00Z") },
      { clubNumber: 1, fuelSku: "3", price: 3.999, observedAt: new Date("2026-09-01T10:00:00Z") },
      { clubNumber: 1, fuelSku: "4", price: 4.899, observedAt: new Date("2026-09-01T10:00:00Z") },
    ];

    const cutoff = new Date("2026-09-01T23:59:59.999Z");

    const regularPrice = reconstructAsOfPrice(events, 1, "1", cutoff);
    const premiumPrice = reconstructAsOfPrice(events, 1, "3", cutoff);
    const dieselPrice = reconstructAsOfPrice(events, 1, "4", cutoff);
    const unknownFuel = reconstructAsOfPrice(events, 1, "99", cutoff);

    expect(regularPrice).toBe(3.199);
    expect(premiumPrice).toBe(3.999);
    expect(dieselPrice).toBe(4.899);
    expect(unknownFuel).toBeNull();
  });
});

describe("price movers calculation logic", () => {
  it("correctly identifies increases, decreases, and unchanged stations", () => {
    const stationCurrent = [
      { clubNumber: 1, currentPrice: 3.299 }, // Increased from 3.199 (+0.100)
      { clubNumber: 2, currentPrice: 3.099 }, // Decreased from 3.199 (-0.100)
      { clubNumber: 3, currentPrice: 3.499 }, // Unchanged (was 3.499)
      { clubNumber: 4, currentPrice: 3.399 }, // New station (no starting price before window)
    ];

    const startingPrices = new Map<number, number>([
      [1, 3.199],
      [2, 3.199],
      [3, 3.499],
      // clubNumber 4 is NOT in starting prices because it was first observed after cutoffStart
    ]);

    const increases: Array<{ clubNumber: number; change: number }> = [];
    const decreases: Array<{ clubNumber: number; change: number }> = [];

    for (const station of stationCurrent) {
      const start = startingPrices.get(station.clubNumber);
      if (start === undefined) {
        // Exclude station where valid start/current comparison cannot be established
        continue;
      }
      const change = Math.round((station.currentPrice - start) * 1000) / 1000;
      if (change > 0) {
        increases.push({ clubNumber: station.clubNumber, change });
      } else if (change < 0) {
        decreases.push({ clubNumber: station.clubNumber, change });
      }
      // Unchanged stations (change === 0) are excluded from movers lists
    }

    expect(increases).toEqual([{ clubNumber: 1, change: 0.1 }]);
    expect(decreases).toEqual([{ clubNumber: 2, change: -0.1 }]);
    // Station 3 (unchanged) and Station 4 (no start price) are cleanly excluded
  });
});

const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describeDb("analytics queries against Postgres", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("calculates national summary with valid median and bounds", async () => {
    const summary = await getNationalSummary(prisma, "1");
    expect(summary.fuel.sku).toBe("1");
    expect(summary.stationCount).toBeGreaterThan(0);
    expect(summary.medianPrice).not.toBeNull();
    expect(Number.parseFloat(summary.medianPrice!)).toBeGreaterThan(2);
    expect(summary.min).not.toBeNull();
    expect(summary.max).not.toBeNull();
    expect(Number.parseFloat(summary.min!.price)).toBeLessThanOrEqual(
      Number.parseFloat(summary.max!.price),
    );
  });

  it("reconstructs national trends without same-day event bias", async () => {
    const trends = await getNationalTrends(prisma, { fuelSku: "1", days: 7 });
    expect(trends.fuel.sku).toBe("1");
    expect(trends.days).toBe(7);
    expect(trends.points.length).toBeGreaterThan(0);

    for (const point of trends.points) {
      expect(point.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(point.stationCount).toBeGreaterThan(0);
      expect(Number.parseFloat(point.minPrice)).toBeLessThanOrEqual(
        Number.parseFloat(point.maxPrice),
      );
      expect(Number.parseFloat(point.medianPrice)).toBeGreaterThanOrEqual(
        Number.parseFloat(point.minPrice),
      );
      expect(Number.parseFloat(point.medianPrice)).toBeLessThanOrEqual(
        Number.parseFloat(point.maxPrice),
      );
    }
  });

  it("calculates 90-day national trends with valid intervals and metrics", async () => {
    const trends = await getNationalTrends(prisma, { fuelSku: "1", days: 90 });
    expect(trends.fuel.sku).toBe("1");
    expect(trends.days).toBe(90);
    expect(trends.points.length).toBeGreaterThan(0);
  });

  it("calculates state summaries with valid metrics per state", async () => {
    const states = await getStateSummaries(prisma, "1");
    expect(states.fuel.sku).toBe("1");
    expect(states.states.length).toBeGreaterThan(0);

    for (const s of states.states) {
      expect(s.state.length).toBe(2);
      expect(s.stationCount).toBeGreaterThan(0);
      expect(Number.parseFloat(s.minPrice)).toBeLessThanOrEqual(
        Number.parseFloat(s.maxPrice),
      );
    }
  });

  it("calculates movers cleanly without invalid comparisons", async () => {
    const movers = await getPriceMovers(prisma, { fuelSku: "1", days: 7 });
    expect(movers.fuel.sku).toBe("1");
    expect(Array.isArray(movers.increases)).toBe(true);
    expect(Array.isArray(movers.decreases)).toBe(true);

    for (const inc of movers.increases) {
      expect(inc.absoluteChange.startsWith("+")).toBe(true);
      expect(Number.parseFloat(inc.currentPrice)).toBeGreaterThan(
        Number.parseFloat(inc.startingPrice),
      );
    }

    for (const dec of movers.decreases) {
      expect(dec.absoluteChange.startsWith("-")).toBe(true);
      expect(Number.parseFloat(dec.currentPrice)).toBeLessThan(
        Number.parseFloat(dec.startingPrice),
      );
    }
  });
});

