import { describe, expect, it } from "vitest";
import {
  dedupeClubsByNumber,
  determineGasStatus,
  normalizeClubId,
  normalizeClubNumber,
  normalizePhysicalStore,
  parseFuelHasProducts,
  parseServices,
} from "../src/normalize.js";
import type { BjsClub } from "../src/types.js";
import { validateClubs } from "../src/validate.js";
import { mapPool, probeFuelPrice } from "../src/bjs-client.js";

describe("club number normalization", () => {
  it("normalizes zero-padded club ids", () => {
    expect(normalizeClubId("0189")).toBe("0189");
    expect(normalizeClubNumber("0189")).toBe(189);
    expect(normalizeClubId(189)).toBe("0189");
    expect(normalizeClubNumber("39")).toBe(39);
    expect(normalizeClubId("0039")).toBe("0039");
  });

  it("rejects empty ids", () => {
    expect(() => normalizeClubId("")).toThrow(/Invalid club id/);
  });
});

describe("deduplication", () => {
  it("dedupes by clubNumber and merges services/gas", () => {
    const a: BjsClub = {
      clubNumber: 189,
      clubId: "0189",
      name: "Haverhill",
      city: "Haverhill",
      state: "MA",
      postalCode: "01835",
      address1: "25 Shelley Rd.",
      services: ["Optical"],
      hasGas: false,
      gasStatus: "no",
      storeType: "CLUB",
      gasClassification: { source: "locator", signals: [] },
      source: "a",
    };
    const b: BjsClub = {
      clubNumber: 189,
      clubId: "0189",
      name: "Haverhill",
      city: "Haverhill",
      state: "MA",
      postalCode: "01835",
      address1: "25 Shelley Rd.",
      services: ["Gas"],
      hasGas: true,
      gasStatus: "yes",
      storeType: "CLUB",
      gasClassification: { source: "locator", signals: ["Features=Gas"] },
      source: "b",
    };

    const result = dedupeClubsByNumber([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]?.hasGas).toBe(true);
    expect(result[0]?.services).toEqual(["Gas", "Optical"]);
    expect(result[0]?.gasClassification.signals).toContain("Features=Gas");
  });
});

describe("API response parsing", () => {
  it("parses services and gas from a physical store", () => {
    const club = normalizePhysicalStore(
      {
        storeName: "0189",
        uniqueID: "189",
        city: "Haverhill",
        stateOrProvinceName: "MA",
        postalCode: "01835",
        addressLine: ["25 Shelley Rd."],
        latitude: "42.75717",
        longitude: "-71.11847",
        telephone1: "978-241-1050                    ",
        Description: [{ displayStoreName: "Haverhill" }],
        Attribute: [
          {
            name: "Features",
            displayValue:
              "Apparel & Footwear|Bakery|Curbside Pickup|Delicatessen|Express Pay|Gas|Lottery|Optical",
            value: "Apparel & Footwear|Bakery|Curbside Pickup|Delicatessen|Express Pay|Gas|Lot",
          },
          { name: "StoreType", value: "CLUB", displayValue: "CLUB" },
          {
            name: "Gas Hours",
            value: "Mon. - Sat.: 6:30 AM - 10 PM",
            displayValue: "Mon. - Sat.: 6:30 AM - 10 PM",
          },
        ],
      },
      "https://api.bjs.com/digital/live/api/v1.2/club/search/10201",
    );

    expect(club.clubNumber).toBe(189);
    expect(club.clubId).toBe("0189");
    expect(club.hasGas).toBe(true);
    expect(club.gasStatus).toBe("yes");
    expect(club.storeType).toBe("CLUB");
    expect(club.gasClassification.source).toBe("locator");
    expect(club.gasClassification.signals).toEqual(
      expect.arrayContaining(["Features=Gas", "GasHours"]),
    );
    expect(club.services).toContain("Gas");
    expect(club.phone).toBe("978-241-1050");
    expect(club.latitude).toBeCloseTo(42.75717);
  });

  it("marks standalone GAS store type as hasGas even without Features", () => {
    const club = normalizePhysicalStore(
      {
        storeName: "0901",
        city: "Auburn",
        stateOrProvinceName: "MA",
        postalCode: "01501",
        addressLine: ["385 Southbridge St"],
        Description: [{ displayStoreName: "Auburn Gas Station" }],
        Attribute: [
          { name: "Features", displayValue: "", value: "" },
          { name: "StoreType", displayValue: "GAS", value: "GAS" },
          {
            name: "Gas Hours",
            displayValue: "Mon. - Sat.: 6:30 AM - 10 PM",
            value: "Mon. - Sat.: 6:30 AM - 10 PM",
          },
        ],
      },
      "test",
    );

    expect(club.hasGas).toBe(true);
    expect(club.gasStatus).toBe("yes");
    expect(club.storeType).toBe("GAS");
    expect(club.gasClassification.signals).toEqual(
      expect.arrayContaining(["StoreType=GAS", "GasHours", "Name=GasStation"]),
    );
  });

  it("marks clubs without Gas feature as no-gas", () => {
    expect(
      determineGasStatus({
        services: parseServices(
          "Apparel & Footwear|Bakery|Beer & Wine|Curbside Pickup|Optical",
        ),
        storeType: "CLUB",
        gasHours: "",
        name: "Salem",
      }),
    ).toBe("no");
  });

  it("marks distribution centers as no-gas", () => {
    expect(
      determineGasStatus({
        services: [],
        storeType: "DC",
        gasHours: "",
        name: "Uxbridge Distribution Center",
      }),
    ).toBe("no");
  });
});

describe("gas / fuel response parsing", () => {
  it("detects products in a successful fuel response", () => {
    expect(
      parseFuelHasProducts({
        response: {
          fuelPriceResponse: {
            data: [
              { name: "Unleaded", sku: "1", price: 3.919 },
              { name: "Premium", sku: "3", price: 4.469 },
            ],
          },
          statusCode: 0,
          statusMsg: "success",
        },
      }),
    ).toBe(true);
  });

  it("treats empty or absent fuel data as no products, not as hasGas === false", () => {
    expect(
      parseFuelHasProducts({
        response: {
          fuelPriceResponse: { data: [] },
          statusCode: 0,
          statusMsg: "success",
        },
      }),
    ).toBe(false);
    expect(parseFuelHasProducts({ response: {} })).toBe(false);
  });

  it("rejects malformed fuel responses", () => {
    expect(() => parseFuelHasProducts({})).toThrow(/Malformed fuel response/);
    expect(() => parseFuelHasProducts(null)).toThrow(/Malformed fuel response/);
  });
});

describe("transient failure handling", () => {
  it("mapPool respects concurrency and preserves order", async () => {
    const seen: number[] = [];
    const results = await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
      await new Promise((r) => setTimeout(r, 10));
      return n * 10;
    });
    expect(results).toEqual([10, 20, 30, 40, 50]);
    expect(seen).toHaveLength(5);
  });

  it("probeFuelPrice returns a structured result for a real club", async () => {
    const result = await probeFuelPrice(189, { maxAttempts: 2 });
    expect(["has_products", "empty_products", "error"]).toContain(result.kind);
  }, 20_000);
});

describe("validation", () => {
  it("flags duplicate club numbers", () => {
    const base: BjsClub = {
      clubNumber: 1,
      clubId: "0001",
      name: "A",
      city: "City",
      state: "MA",
      postalCode: "02101",
      address1: "1 Main",
      services: ["Gas"],
      hasGas: true,
      gasStatus: "yes",
      storeType: "CLUB",
      gasClassification: { source: "locator", signals: ["Features=Gas"] },
      source: "t",
    };
    const issues = validateClubs([base, { ...base }], { requireKnownGas: false });
    expect(issues.some((i) => i.code === "duplicate_club_number")).toBe(true);
  });
});
