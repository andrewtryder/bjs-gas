import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { haversineDistanceMiles, EARTH_RADIUS_MILES } from "../src/analytics/haversine.js";
import { getNearbyStations } from "../src/api/stations.js";
import { getNationalTrends } from "../src/analytics/queries.js";

const url = process.env.DATABASE_URL;
const describeDb = url ? describe : describe.skip;

describe("haversineDistanceMiles utility", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineDistanceMiles(42.3601, -71.0589, 42.3601, -71.0589)).toBe(0);
  });

  it("calculates known city-to-city distance accurately (Boston to NYC ~190 miles)", () => {
    const boston = { lat: 42.3601, lon: -71.0589 };
    const nyc = { lat: 40.7128, lon: -74.0060 };
    const dist = haversineDistanceMiles(boston.lat, boston.lon, nyc.lat, nyc.lon);
    expect(dist).not.toBeNull();
    // Great circle distance is ~190.2 miles
    expect(dist).toBeGreaterThan(185);
    expect(dist).toBeLessThan(195);
  });

  it("is symmetric: distance(A, B) === distance(B, A)", () => {
    const a = { lat: 34.0522, lon: -118.2437 }; // Los Angeles
    const b = { lat: 25.7617, lon: -80.1918 };  // Miami
    const distAB = haversineDistanceMiles(a.lat, a.lon, b.lat, b.lon);
    const distBA = haversineDistanceMiles(b.lat, b.lon, a.lat, a.lon);
    expect(distAB).not.toBeNull();
    expect(distBA).not.toBeNull();
    expect(Math.abs((distAB ?? 0) - (distBA ?? 0))).toBeLessThan(1e-9);
  });

  it("handles negative coordinates and meridian boundaries correctly", () => {
    // Sydney to London
    const sydney = { lat: -33.8688, lon: 151.2093 };
    const london = { lat: 51.5074, lon: -0.1278 };
    const dist = haversineDistanceMiles(sydney.lat, sydney.lon, london.lat, london.lon);
    expect(dist).not.toBeNull();
    // Distance is approx 10,560 miles
    expect(dist).toBeGreaterThan(10500);
    expect(dist).toBeLessThan(10700);
  });

  it("returns null on null, undefined, or NaN inputs", () => {
    expect(haversineDistanceMiles(null, -71.0, 42.0, -71.0)).toBeNull();
    expect(haversineDistanceMiles(42.0, undefined, 42.0, -71.0)).toBeNull();
    expect(haversineDistanceMiles(Number.NaN, -71.0, 42.0, -71.0)).toBeNull();
    expect(haversineDistanceMiles(42.0, -71.0, 42.0, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("exports correct Earth radius constant", () => {
    expect(EARTH_RADIUS_MILES).toBe(3958.8);
  });
});

describeDb("getNearbyStations integration", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns nearest gas stations excluding target station, sorted ascending", async () => {
    // Station 1 is in Revere/Medford MA area
    const res = await getNearbyStations(prisma, 1, { limit: 5 });
    expect(res).not.toBeNull();
    if (!res) return;

    expect(res.targetStation.clubNumber).toBe(1);
    expect(res.nearby.length).toBeGreaterThan(0);
    expect(res.nearby.length).toBeLessThanOrEqual(5);

    // Target station itself must be excluded
    expect(res.nearby.every((s) => s.clubNumber !== 1)).toBe(true);

    // Distances must be sorted ascending
    for (let i = 1; i < res.nearby.length; i++) {
      const current = res.nearby[i];
      const prev = res.nearby[i - 1];
      if (current && prev) {
        expect(current.distanceMiles).toBeGreaterThanOrEqual(prev.distanceMiles);
      }
    }

    // Distance formatted checks
    for (const station of res.nearby) {
      expect(station.distanceFormatted).toMatch(/^\d+\.\d+ miles$/);
      expect(station.distanceMiles).toBeGreaterThan(0);
      if (station.regularPrice != null && res.targetStation.fuels.find((f) => f.sku === "1")) {
        expect(station.priceDeltaVsTarget).not.toBeNull();
        expect(station.priceDeltaFormatted).not.toBeNull();
        expect(
          station.priceDeltaFormatted === "Same price" ||
          station.priceDeltaFormatted?.includes("cheaper") ||
          station.priceDeltaFormatted?.includes("more expensive")
        ).toBe(true);
      }
    }
  }, 15000);

  it("respects maxMiles filter", async () => {
    const res = await getNearbyStations(prisma, 1, { limit: 10, maxMiles: 15 });
    expect(res).not.toBeNull();
    if (!res) return;

    for (const station of res.nearby) {
      expect(station.distanceMiles).toBeLessThanOrEqual(15);
    }
  });

  it("returns null for non-existent station", async () => {
    const res = await getNearbyStations(prisma, 999999);
    expect(res).toBeNull();
  });
});

describeDb("State-scoped price trends", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("scopes trend reconstruction strictly to requested state", async () => {
    const nationalTrends = await getNationalTrends(prisma, { days: 7 });
    const maTrends = await getNationalTrends(prisma, { days: 7, state: "MA" });

    expect(maTrends.state).toBe("MA");
    expect(maTrends.points.length).toBeGreaterThan(0);

    // MA station count should be smaller than national station count
    const latestMa = maTrends.points[maTrends.points.length - 1];
    const latestNational = nationalTrends.points[nationalTrends.points.length - 1];

    expect(latestMa).toBeDefined();
    expect(latestNational).toBeDefined();

    if (latestMa && latestNational) {
      expect(latestMa.stationCount).toBeLessThan(latestNational.stationCount);
      // In our dataset MA has ~22 gas stations, national has ~207
      expect(latestMa.stationCount).toBeGreaterThan(15);
      expect(latestMa.stationCount).toBeLessThan(35);
    }
  });
});
