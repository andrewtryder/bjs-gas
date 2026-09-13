import { describe, expect, it } from "vitest";
import {
  filterStations,
  formatFuelDisplayName,
  formatStationTitle,
  getAvailableFuels,
  getAvailableStates,
  getCanonicalFuelPrices,
  getCityStateCollisionKeys,
  getLatestObservation,
  getMobileStationRowData,
  getPrimaryFuel,
  getStationPrice,
  sortStations,
  stationsToGeoJson,
  syncSelectedStationWithFilter,
  formatMapFreshnessText,
  formatMapPopupData,
  validateUniqueStations,
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

  it("normalizes search query case and whitespace", () => {
    expect(filterStations(sampleStations, { query: "   MEDFORD   " })).toHaveLength(1);
    expect(filterStations(sampleStations, { query: "  ma  " })).toHaveLength(3);
  });
});

describe("getLatestObservation", () => {
  it("extracts latest timestamp from fuels array", () => {
    const station = sampleStations[0]!;
    expect(getLatestObservation(station)).toBe("2026-09-04T22:00:51.519Z");
  });

  it("returns null for empty fuels", () => {
    const station = sampleStations[3]!;
    expect(getLatestObservation(station)).toBeNull();
  });
});

describe("sortStations", () => {
  it("sorts by location A-Z by default (city, state)", () => {
    const sorted = sortStations(sampleStations, "location-asc");
    // Auburn MA (#901), Haverhill MA (#189), Medford MA (#1), St Johns FL (#398)
    expect(sorted.map((s) => s.city)).toEqual(["Auburn", "Haverhill", "Medford", "St Johns"]);
  });

  it("sorts regular price low-to-high with missing prices at end", () => {
    const sorted = sortStations(sampleStations, "price-asc");
    // St Johns ($3.599), Haverhill ($3.799), Medford ($3.929), Auburn (null -> end)
    expect(sorted.map((s) => s.clubNumber)).toEqual([398, 189, 1, 901]);
  });

  it("sorts regular price high-to-low with missing prices at end", () => {
    const sorted = sortStations(sampleStations, "price-desc");
    // Medford ($3.929), Haverhill ($3.799), St Johns ($3.599), Auburn (null -> end)
    expect(sorted.map((s) => s.clubNumber)).toEqual([1, 189, 398, 901]);
  });

  it("sorts by selected fuel price (e.g. Premium SKU 3)", () => {
    // Only Medford has SKU 3 ($4.729); others sort to end
    const sorted = sortStations(sampleStations, "price-asc", "3");
    expect(sorted[0]?.clubNumber).toBe(1);
    expect(sorted.slice(1).map((s) => s.clubNumber)).toContain(189);
    expect(sorted.slice(1).map((s) => s.clubNumber)).toContain(398);
  });

  it("sorts recently updated descending", () => {
    // Modify one station to have a newer timestamp
    const stationsWithTimes: StationDto[] = [
      {
        ...sampleStations[0]!,
        fuels: [{ sku: "1", name: "U", price: "3.5", sourcePriceAtLocal: null, observedAt: "2026-09-01T00:00:00Z" }],
      },
      {
        ...sampleStations[1]!,
        fuels: [{ sku: "1", name: "U", price: "3.5", sourcePriceAtLocal: null, observedAt: "2026-09-05T00:00:00Z" }],
      },
      {
        ...sampleStations[2]!,
        fuels: [{ sku: "1", name: "U", price: "3.5", sourcePriceAtLocal: null, observedAt: "2026-09-03T00:00:00Z" }],
      },
      sampleStations[3]!, // No fuels -> end
    ];
    const sorted = sortStations(stationsWithTimes, "updated-desc");
    expect(sorted.map((s) => s.clubNumber)).toEqual([189, 398, 1, 901]);
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

describe("MapLibre GL worker assets & configuration", () => {
  it("provides worker and shared scripts in web/public", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const workerPath = path.resolve(process.cwd(), "web/public/maplibre-gl-worker.mjs");
    const sharedPath = path.resolve(process.cwd(), "web/public/maplibre-gl-shared.mjs");
    expect(fs.existsSync(workerPath)).toBe(true);
    expect(fs.statSync(workerPath).size).toBeGreaterThan(1000);
    expect(fs.existsSync(sharedPath)).toBe(true);
    expect(fs.statSync(sharedPath).size).toBeGreaterThan(1000);
  });

  it("configures WORKER_URL in InteractiveMap component", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const componentSource = fs.readFileSync(
      path.resolve(process.cwd(), "web/components/InteractiveMap.tsx"),
      "utf-8",
    );
    expect(componentSource).toContain('WORKER_URL = "/maplibre-gl-worker.mjs"');
  });
});

describe("validateUniqueStations", () => {
  it("preserves multiple stations with same city/state but different clubNumber", () => {
    const columbiaStations: StationDto[] = [
      {
        clubNumber: 60,
        clubId: "0060",
        name: "Columbia",
        storeType: "CLUB",
        address1: "9011 Snowden River Pkwy.",
        address2: null,
        address: "9011 Snowden River Pkwy.",
        city: "Columbia",
        state: "MD",
        postalCode: "21046",
        latitude: 39.18523,
        longitude: -76.8179,
        fuels: [{ sku: "1", name: "Unleaded", price: "3.299", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" }],
      },
      {
        clubNumber: 903,
        clubId: "0903",
        name: "Columbia Gas Station",
        storeType: "STANDALONE_GAS",
        address1: "6345 Dobbin Road",
        address2: null,
        address: "6345 Dobbin Road",
        city: "Columbia",
        state: "MD",
        postalCode: "21045",
        latitude: 39.1966,
        longitude: -76.8203,
        fuels: [{ sku: "1", name: "Unleaded", price: "3.259", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" }],
      },
    ];

    const result = validateUniqueStations(columbiaStations);
    expect(result.isValid).toBe(true);
    expect(result.duplicateClubNumbers).toEqual([]);
  });

  it("detects duplicate clubNumber values as an invalid data condition", () => {
    const invalidList: StationDto[] = [
      {
        clubNumber: 60,
        clubId: "0060",
        name: "Columbia 1",
        storeType: "CLUB",
        address1: "9011 Snowden River Pkwy.",
        address2: null,
        address: "9011 Snowden River Pkwy.",
        city: "Columbia",
        state: "MD",
        postalCode: "21046",
        latitude: 39.18523,
        longitude: -76.8179,
        fuels: [],
      },
      {
        clubNumber: 60,
        clubId: "0060-dup",
        name: "Columbia 2",
        storeType: "CLUB",
        address1: "Duplicate Club Row",
        address2: null,
        address: "Duplicate Club Row",
        city: "Columbia",
        state: "MD",
        postalCode: "21046",
        latitude: 39.18523,
        longitude: -76.8179,
        fuels: [],
      },
    ];

    const result = validateUniqueStations(invalidList);
    expect(result.isValid).toBe(false);
    expect(result.duplicateClubNumbers).toEqual([60]);
  });
});

describe("same-city station preservation & disambiguation", () => {
  const columbiaFixture: StationDto[] = [
    {
      clubNumber: 60,
      clubId: "0060",
      name: "Columbia",
      storeType: "CLUB",
      address1: "9011 Snowden River Pkwy.",
      address2: null,
      address: "9011 Snowden River Pkwy.",
      city: "Columbia",
      state: "MD",
      postalCode: "21046",
      latitude: 39.18523,
      longitude: -76.8179,
      fuels: [
        { sku: "1", name: "Unleaded", price: "3.299", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" },
        { sku: "3", name: "Premium", price: "3.899", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" },
      ],
    },
    {
      clubNumber: 903,
      clubId: "0903",
      name: "Columbia Gas Station",
      storeType: "STANDALONE_GAS",
      address1: "6345 Dobbin Road",
      address2: null,
      address: "6345 Dobbin Road",
      city: "Columbia",
      state: "MD",
      postalCode: "21045",
      latitude: 39.1966,
      longitude: -76.8203,
      fuels: [
        { sku: "1", name: "Unleaded", price: "3.259", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" },
        { sku: "3", name: "Premium", price: "3.859", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" },
      ],
    },
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
        { sku: "1", name: "Unleaded", price: "3.399", sourcePriceAtLocal: null, observedAt: "2026-09-13T10:00:00.000Z" },
      ],
    },
  ];

  it("both Columbia stations survive state and text filtering as distinct records", () => {
    const mdFiltered = filterStations(columbiaFixture, { state: "MD" });
    expect(mdFiltered).toHaveLength(2);
    expect(mdFiltered.map((s) => s.clubNumber).sort()).toEqual([60, 903]);

    const columbiaFiltered = filterStations(columbiaFixture, { query: "Columbia" });
    expect(columbiaFiltered).toHaveLength(2);
    expect(columbiaFiltered.map((s) => s.clubNumber).sort()).toEqual([60, 903]);
  });

  it("both Columbia stations survive sorting and retain authoritative clubNumber identity", () => {
    const sortedByPrice = sortStations(columbiaFixture, "price-asc", "1");
    // Club 903 ($3.259) < Club 60 ($3.299) < Club 1 ($3.399)
    expect(sortedByPrice.map((s) => s.clubNumber)).toEqual([903, 60, 1]);
  });

  it("computes city/state collisions and appends compact qualifier only for colliding cities", () => {
    const collisions = getCityStateCollisionKeys(columbiaFixture);
    expect(collisions.has("columbia, md")).toBe(true);
    expect(collisions.has("medford, ma")).toBe(false);

    const title60 = formatStationTitle(columbiaFixture[0]!, collisions);
    const title903 = formatStationTitle(columbiaFixture[1]!, collisions);
    const titleMedford = formatStationTitle(columbiaFixture[2]!, collisions);

    expect(title60).toBe("Columbia, MD · #60");
    expect(title903).toBe("Columbia, MD · #903");
    expect(titleMedford).toBe("Medford, MA");
  });
});

describe("fuel label normalization", () => {
  it("normalizes Unleaded and variants to Regular while preserving others", () => {
    expect(formatFuelDisplayName("Unleaded")).toBe("Regular");
    expect(formatFuelDisplayName("Regular Unleaded")).toBe("Regular");
    expect(formatFuelDisplayName("regular")).toBe("Regular");
    expect(formatFuelDisplayName("Premium Unleaded")).toBe("Premium");
    expect(formatFuelDisplayName("Premium")).toBe("Premium");
    expect(formatFuelDisplayName("Diesel")).toBe("Diesel");
  });

  it("getAvailableFuels uses normalized fuel display names", () => {
    const fuels = getAvailableFuels(sampleStations);
    const regularFuel = fuels.find((f) => f.sku === "1");
    expect(regularFuel?.name).toBe("Regular");
    const premiumFuel = fuels.find((f) => f.sku === "3");
    expect(premiumFuel?.name).toBe("Premium");
  });
});

describe("getCanonicalFuelPrices (Phase DS-3)", () => {
  it("extracts Regular, Premium, and Diesel with accurate formatted prices", () => {
    // Medford has Unleaded ($3.929) and Premium ($4.729)
    const medfordPrices = getCanonicalFuelPrices(sampleStations[0]!);
    expect(medfordPrices.regular.isAvailable).toBe(true);
    expect(medfordPrices.regular.priceFormatted).toBe("$3.929");
    expect(medfordPrices.premium.isAvailable).toBe(true);
    expect(medfordPrices.premium.priceFormatted).toBe("$4.729");
    expect(medfordPrices.diesel.isAvailable).toBe(false);
    expect(medfordPrices.diesel.priceFormatted).toBe("—");

    // Haverhill has Unleaded ($3.799) and Diesel ($4.999)
    const haverhillPrices = getCanonicalFuelPrices(sampleStations[1]!);
    expect(haverhillPrices.regular.isAvailable).toBe(true);
    expect(haverhillPrices.regular.priceFormatted).toBe("$3.799");
    expect(haverhillPrices.premium.isAvailable).toBe(false);
    expect(haverhillPrices.premium.priceFormatted).toBe("—");
    expect(haverhillPrices.diesel.isAvailable).toBe(true);
    expect(haverhillPrices.diesel.priceFormatted).toBe("$4.999");
  });

  it("handles empty fuel array and missing prices gracefully with em dash placeholder", () => {
    // Auburn has empty fuels
    const auburnPrices = getCanonicalFuelPrices(sampleStations[3]!);
    expect(auburnPrices.regular.isAvailable).toBe(false);
    expect(auburnPrices.regular.priceFormatted).toBe("—");
    expect(auburnPrices.premium.isAvailable).toBe(false);
    expect(auburnPrices.premium.priceFormatted).toBe("—");
    expect(auburnPrices.diesel.isAvailable).toBe(false);
    expect(auburnPrices.diesel.priceFormatted).toBe("—");
  });

  it("treats zero or invalid prices as unavailable", () => {
    const zeroPriceStation: StationDto = {
      ...sampleStations[0]!,
      clubNumber: 999,
      fuels: [
        { sku: "1", name: "Unleaded", price: "0.000", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
        { sku: "3", name: "Premium", price: "-1.500", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
        { sku: "4", name: "Diesel", price: "invalid", sourcePriceAtLocal: null, observedAt: "2026-09-04T12:00:00Z" },
      ],
    };
    const prices = getCanonicalFuelPrices(zeroPriceStation);
    expect(prices.regular.isAvailable).toBe(false);
    expect(prices.regular.priceFormatted).toBe("—");
    expect(prices.premium.isAvailable).toBe(false);
    expect(prices.premium.priceFormatted).toBe("—");
    expect(prices.diesel.isAvailable).toBe(false);
    expect(prices.diesel.priceFormatted).toBe("—");
  });
});

describe("getMobileStationRowData (Phase DS-3)", () => {
  it("defaults to Regular as primary when selectedFuel is ALL", () => {
    const data = getMobileStationRowData(sampleStations[0]!, "ALL");
    expect(data.primaryFuelLabel).toBe("Regular");
    expect(data.primaryPriceFormatted).toBe("$3.929");
    expect(data.secondaryFuels).toEqual([
      { label: "Premium", price: "$4.729" },
    ]);
  });

  it("switches primary to Diesel when Diesel SKU (4) is selected", () => {
    const data = getMobileStationRowData(sampleStations[1]!, "4");
    expect(data.primaryFuelLabel).toBe("Diesel");
    expect(data.primaryPriceFormatted).toBe("$4.999");
    expect(data.secondaryFuels).toEqual([
      { label: "Regular", price: "$3.799" },
    ]);
  });

  it("switches primary to Premium when Premium SKU (3) is selected", () => {
    const data = getMobileStationRowData(sampleStations[0]!, "3");
    expect(data.primaryFuelLabel).toBe("Premium");
    expect(data.primaryPriceFormatted).toBe("$4.729");
    expect(data.secondaryFuels).toEqual([
      { label: "Regular", price: "$3.929" },
    ]);
  });
});

describe("generic same-city collision handling (Section 31)", () => {
  it("disambiguates any synthetic same-city pair using formatStationTitle", () => {
    const tampaStations: StationDto[] = [
      {
        ...sampleStations[0]!,
        clubNumber: 101,
        city: "Tampa",
        state: "FL",
      },
      {
        ...sampleStations[1]!,
        clubNumber: 202,
        city: "Tampa",
        state: "FL",
      },
      {
        ...sampleStations[2]!,
        clubNumber: 303,
        city: "Orlando",
        state: "FL",
      },
    ];

    const collisions = getCityStateCollisionKeys(tampaStations);
    expect(collisions.has("tampa, fl")).toBe(true);
    expect(collisions.has("orlando, fl")).toBe(false);

    expect(formatStationTitle(tampaStations[0]!, collisions)).toBe("Tampa, FL · #101");
    expect(formatStationTitle(tampaStations[1]!, collisions)).toBe("Tampa, FL · #202");
    expect(formatStationTitle(tampaStations[2]!, collisions)).toBe("Orlando, FL");
  });
});

describe("selected-fuel sorting behavior (Section 20)", () => {
  it("sorts by selected fuel price with unavailable stations sorted last", () => {
    // Medford has Premium ($4.729)
    // Haverhill has no Premium
    // St Johns has no Premium
    const sortedByPremiumAsc = sortStations(sampleStations, "price-asc", "3");
    expect(sortedByPremiumAsc[0]!.clubNumber).toBe(1); // Medford with $4.729
    // Haverhill, St Johns, Auburn without Premium sort to the end
    const remainingClubNumbers = sortedByPremiumAsc.slice(1).map((s) => s.clubNumber);
    expect(remainingClubNumbers).toContain(189);
    expect(remainingClubNumbers).toContain(398);
    expect(remainingClubNumbers).toContain(901);
  });
});

describe("syncSelectedStationWithFilter (DS-4 Section 29)", () => {
  it("preserves selected station when still present in filtered set", () => {
    const selected = sampleStations[0]!;
    const result = syncSelectedStationWithFilter(selected, sampleStations);
    expect(result).toBe(selected);
  });

  it("clears selected station when excluded from filtered set", () => {
    const selected = sampleStations[0]!; // Medford MA
    const filteredFL = sampleStations.filter((s) => s.state === "FL");
    const result = syncSelectedStationWithFilter(selected, filteredFL);
    expect(result).toBeNull();
  });

  it("returns null when no station was selected", () => {
    expect(syncSelectedStationWithFilter(null, sampleStations)).toBeNull();
  });
});

describe("formatMapFreshnessText (DS-4 Section 10)", () => {
  it("formats fresh timestamps without a decorative Fresh pill", () => {
    const text = formatMapFreshnessText({
      level: "fresh",
      label: "Updated recently",
      relativeText: "Updated 17m ago",
      badgeBg: "",
      badgeColor: "",
      badgeBorder: "",
      badgeClass: "",
      ageMinutes: 17,
    });
    expect(text).toBe("Updated 17m ago");
  });

  it("appends · Aging for aging timestamps", () => {
    const text = formatMapFreshnessText({
      level: "aging",
      label: "Aging",
      relativeText: "Updated 4h ago",
      badgeBg: "",
      badgeColor: "",
      badgeBorder: "",
      badgeClass: "",
      ageMinutes: 240,
    });
    expect(text).toBe("Updated 4h ago · Aging");
  });

  it("appends · Stale for stale timestamps", () => {
    const text = formatMapFreshnessText({
      level: "stale",
      label: "Stale",
      relativeText: "Updated 9h ago",
      badgeBg: "",
      badgeColor: "",
      badgeBorder: "",
      badgeClass: "",
      ageMinutes: 540,
    });
    expect(text).toBe("Updated 9h ago · Stale");
  });

  it("handles null gracefully", () => {
    expect(formatMapFreshnessText(null)).toBeNull();
  });
});

describe("formatMapPopupData (DS-4 Sections 21 & 22)", () => {
  it("formats popup data with primary regular fuel and secondary fuels", () => {
    const station = sampleStations[0]!; // Medford: Regular $3.929, Premium $4.729
    const data = formatMapPopupData(station, "ALL");
    expect(data.title).toBe("Medford, MA");
    expect(data.clubNumber).toBe(1);
    expect(data.primaryPriceFormatted).toBe("$3.929");
    expect(data.primaryFuelName).toBe("Regular");
    expect(data.secondaryFuels).toEqual([
      { name: "Premium", price: "$4.729" },
    ]);
  });

  it("prioritizes selected fuel SKU as primary price", () => {
    const station = sampleStations[0]!;
    const data = formatMapPopupData(station, "3"); // Premium
    expect(data.primaryPriceFormatted).toBe("$4.729");
    expect(data.primaryFuelName).toBe("Premium");
    expect(data.secondaryFuels).toEqual([
      { name: "Regular", price: "$3.929" },
    ]);
  });

  it("applies disambiguation qualifier when collision key matches", () => {
    const colStation1 = { ...sampleStations[0]!, city: "Columbia", state: "MD", clubNumber: 60 };
    const colStation2 = { ...sampleStations[0]!, city: "Columbia", state: "MD", clubNumber: 903 };
    const collisions = new Set(["columbia, md"]);

    const data1 = formatMapPopupData(colStation1, "ALL", collisions);
    const data2 = formatMapPopupData(colStation2, "ALL", collisions);

    expect(data1.title).toBe("Columbia, MD · #60");
    expect(data2.title).toBe("Columbia, MD · #903");
  });
});



