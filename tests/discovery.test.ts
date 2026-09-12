import { describe, expect, it } from "vitest";
import {
  filterStations,
  getAvailableFuels,
  getAvailableStates,
  getPrimaryFuel,
  getStationPrice,
  stationsToGeoJson,
} from "../web/lib/discovery.js";
import type { StationDto } from "../web/lib/types.js";

const sampleStations: StationDto[] = [
  {
    clubNumber: 1,
    clubId: "0001",
    name: "Medford",
    storeType: "CLUB",
    address1: "278 Middlesex Ave.",
    address2: null,
    address: "278 Middlesex Ave.",
    city: "Medford",
    state: "MA",
    postalCode: "02155",
    latitude: 42.41266,
    longitude: -71.07937,
    fuels: [
      { sku: "1", name: "Unleaded", price: "3.929", sourcePriceAtLocal: "2026-09-04T06:37:02", observedAt: "2026-09-04T22:00:51.519Z" },
      { sku: "3", name: "Premium", price: "4.729", sourcePriceAtLocal: null, observedAt: "2026-09-04T22:00:51.519Z" },
    ],
  },
  {
    clubNumber: 189,
    clubId: "0189",
    name: "Haverhill",
    storeType: "CLUB",
    address1: "25 Shelley Rd.",
    address2: null,
    address: "25 Shelley Rd.",
    city: "Haverhill",
    state: "MA",
    postalCode: "01835",
    latitude: 42.75717,
    longitude: -71.11847,
    fuels: [
      { sku: "1", name: "Unleaded", price: "3.799", sourcePriceAtLocal: null, observedAt: "2026-09-04T22:00:51.519Z" },
      { sku: "4", name: "Diesel", price: "4.999", sourcePriceAtLocal: null, observedAt: "2026-09-04T22:00:51.519Z" },
    ],
  },
  {
    clubNumber: 398,
    clubId: "0398",
    name: "St Johns",
    storeType: "CLUB",
    address1: "115 Beachwalk Blvd",
    address2: null,
    address: "115 Beachwalk Blvd",
    city: "St Johns",
    state: "FL",
    postalCode: "32259",
    latitude: 30.08506,
    longitude: -81.47384,
    fuels: [
      { sku: "1", name: "Unleaded", price: "3.599", sourcePriceAtLocal: null, observedAt: "2026-09-04T22:00:51.519Z" },
    ],
  },
  {
    clubNumber: 901,
    clubId: "0901",
    name: "Auburn Gas Station",
    storeType: "GAS",
    address1: "782 Washington St.",
    address2: null,
    address: "782 Washington St.",
    city: "Auburn",
    state: "MA",
    postalCode: "01501",
    latitude: null, // Invalid coordinates test
    longitude: null,
    fuels: [], // Empty fuels test
  },
];

describe("getPrimaryFuel", () => {
  it("prioritizes SKU 1 (Unleaded)", () => {
    const fuels = [
      { sku: "3", name: "Premium", price: "4.500", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
      { sku: "1", name: "Regular Gasoline", price: "3.500", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
    ];
    expect(getPrimaryFuel(fuels)?.sku).toBe("1");
  });

  it("identifies unleaded by name if SKU is non-standard", () => {
    const fuels = [
      { sku: "88", name: "Unleaded Plus", price: "3.600", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
      { sku: "99", name: "Diesel Ultra", price: "4.800", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
    ];
    expect(getPrimaryFuel(fuels)?.name).toBe("Unleaded Plus");
  });

  it("returns null for empty or null fuel array", () => {
    expect(getPrimaryFuel([])).toBeNull();
    expect(getPrimaryFuel(null)).toBeNull();
  });
});

describe("getStationPrice", () => {
  it("resolves primary fuel price when no target fuel specified", () => {
    const res = getStationPrice(sampleStations[0]!);
    expect(res.isAvailable).toBe(true);
    expect(res.priceNumeric).toBe(3.929);
    expect(res.priceFormatted).toBe("$3.929");
    expect(res.fuel?.name).toBe("Unleaded");
  });

  it("resolves specific fuel price when targetFuelSku specified", () => {
    const res = getStationPrice(sampleStations[0]!, "3");
    expect(res.isAvailable).toBe(true);
    expect(res.priceNumeric).toBe(4.729);
    expect(res.priceFormatted).toBe("$4.729");
    expect(res.fuel?.name).toBe("Premium");
  });

  it("handles missing target fuel gracefully", () => {
    const res = getStationPrice(sampleStations[0]!, "4"); // Station 1 has no diesel
    expect(res.isAvailable).toBe(false);
    expect(res.priceNumeric).toBeNull();
    expect(res.priceFormatted).toBe("—");
  });
});

describe("getAvailableStates", () => {
  it("extracts unique sorted states with accurate counts", () => {
    const states = getAvailableStates(sampleStations);
    expect(states).toEqual([
      { state: "FL", count: 1 },
      { state: "MA", count: 3 },
    ]);
  });
});

describe("getAvailableFuels", () => {
  it("extracts sorted distinct fuels across stations", () => {
    const fuels = getAvailableFuels(sampleStations);
    expect(fuels.map((f) => f.sku)).toEqual(["1", "3", "4"]);
  });
});

describe("filterStations", () => {
  it("filters by text search query across name, city, ZIP, clubNumber", () => {
    expect(filterStations(sampleStations, { query: "Medford" })).toHaveLength(1);
    expect(filterStations(sampleStations, { query: "01835" })).toHaveLength(1);
    expect(filterStations(sampleStations, { query: "398" })).toHaveLength(1);
    expect(filterStations(sampleStations, { query: "nonexistent" })).toHaveLength(0);
  });

  it("filters by state", () => {
    expect(filterStations(sampleStations, { state: "FL" })).toHaveLength(1);
    expect(filterStations(sampleStations, { state: "MA" })).toHaveLength(3);
    expect(filterStations(sampleStations, { state: "ALL" })).toHaveLength(4);
  });

  it("filters by fuel availability", () => {
    // Diesel (SKU 4) is only at station 189
    expect(filterStations(sampleStations, { fuelSku: "4" })).toHaveLength(1);
    expect(filterStations(sampleStations, { fuelSku: "4" })[0]?.clubNumber).toBe(189);
  });

  it("combines query, state, and fuel filters", () => {
    expect(
      filterStations(sampleStations, { state: "MA", query: "Haverhill", fuelSku: "1" }),
    ).toHaveLength(1);

    expect(
      filterStations(sampleStations, { state: "MA", query: "Medford", fuelSku: "4" }),
    ).toHaveLength(0);
  });
});

describe("stationsToGeoJson", () => {
  it("converts stations with valid coordinates to GeoJSON points", () => {
    const geojson = stationsToGeoJson(sampleStations);
    // 3 valid stations, 1 station with null coordinates omitted
    expect(geojson.features).toHaveLength(3);

    const first = geojson.features[0]!;
    expect(first.geometry.coordinates).toEqual([-71.07937, 42.41266]); // [lng, lat]
    expect(first.properties.clubNumber).toBe(1);
    expect(first.properties.priceFormatted).toBe("$3.929");
    expect(first.properties.hasPrice).toBe(true);
  });

  it("omits stations with invalid/out-of-bounds coordinates safely", () => {
    const invalidStations: StationDto[] = [
      {
        ...sampleStations[0]!,
        latitude: 999, // out of range lat
        longitude: 0,
      },
      {
        ...sampleStations[0]!,
        latitude: 40,
        longitude: Number.NaN,
      },
    ];
    const geojson = stationsToGeoJson(invalidStations);
    expect(geojson.features).toHaveLength(0);
  });
});
