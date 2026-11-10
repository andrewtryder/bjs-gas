import { describe, expect, it } from "vitest";
import { filterStations } from "../web/lib/stations/filter.js";
import { getAvailableFuels } from "../web/lib/stations/fuels.js";
import { stationsToGeoJson } from "../web/lib/stations/geojson.js";
import { syncSelectedStationWithFilter } from "../web/lib/stations/selection.js";
import { sortStations } from "../web/lib/stations/sort.js";
import type { StationDto } from "../web/lib/types.js";

const stations: StationDto[] = [
  {
    clubNumber: 1,
    clubId: "0001",
    name: "Medford",
    storeType: "CLUB",
    address1: "1 Main St",
    address2: null,
    address: "1 Main St",
    city: "Medford",
    state: "MA",
    postalCode: "02155",
    latitude: 42.4,
    longitude: -71.1,
    fuels: [{ sku: "1", name: "Unleaded", price: "3.500", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" }],
  },
  {
    clubNumber: 2,
    clubId: "0002",
    name: "Orlando",
    storeType: "GAS",
    address1: "2 Main St",
    address2: null,
    address: "2 Main St",
    city: "Orlando",
    state: "FL",
    postalCode: "32801",
    latitude: null,
    longitude: null,
    fuels: [],
  },
];

describe("modular station utilities", () => {
  it("keeps filtering, sorting, and reset selection semantics composable", () => {
    const filtered = filterStations(stations, { state: "MA", fuelSku: "1" });

    expect(filtered.map((station) => station.clubNumber)).toEqual([1]);
    expect(sortStations(stations, "location-asc")).not.toBe(stations);
    expect(syncSelectedStationWithFilter(stations[1]!, filtered)).toBeNull();
  });

  it("keeps fuel and map conversion utilities independently importable", () => {
    expect(getAvailableFuels(stations)).toEqual([{ sku: "1", name: "Regular", count: 1 }]);
    expect(stationsToGeoJson(stations).features).toHaveLength(1);
  });

  it("applies default limit of 500 and clamps limit to max 1000 for station history", async () => {
    const { getStationHistory } = await import("../src/api/stations.js");
    let capturedArgs: any = null;
    const mockPrisma = {
      fuelPriceHistory: {
        findMany: async (args: any) => {
          capturedArgs = args;
          return [
            {
              fuelSku: "1",
              fuelName: "Unleaded",
              price: "3.500",
              sourcePriceAtLocal: null,
              observedAt: new Date("2026-09-04T12:00:00Z"),
            },
          ];
        },
      },
    } as any;

    const resDefault = await getStationHistory(mockPrisma, 1);
    expect(capturedArgs.take).toBe(500);
    expect(resDefault).toHaveLength(1);

    await getStationHistory(mockPrisma, 1, { limit: 2000 });
    expect(capturedArgs.take).toBe(1000);

    await getStationHistory(mockPrisma, 1, { limit: 50 });
    expect(capturedArgs.take).toBe(50);
  });
});
