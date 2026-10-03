import { describe, expect, it } from "vitest";
import { classifyFuelProbePayload } from "../src/bjs-client.js";
import {
  fuelPriceEnvelopeSchema,
  fuelProductsFromEnvelope,
} from "../src/fuel/schema.js";
import { observationsFromFuelResponse } from "../src/fuel/types.js";
import { parseFuelHasProducts } from "../src/normalize.js";

const observedAt = "2026-10-03T12:00:00.000Z";

const regularStringSku = {
  response: {
    fuelPriceResponse: {
      data: [{ name: "Regular", sku: "1", price: 3.159 }],
    },
  },
};

const regularNumericSku = {
  response: {
    fuelPriceResponse: {
      data: [{ name: "Regular", sku: 1, price: 3.159 }],
    },
  },
};

const emptyProducts = {
  response: {
    fuelPriceResponse: {
      data: [],
    },
  },
};

describe("canonical BJ's fuel HTTP schema", () => {
  it("normalizes string and numeric SKUs to the same string", () => {
    const stringParsed = fuelPriceEnvelopeSchema.parse(regularStringSku);
    const numericParsed = fuelPriceEnvelopeSchema.parse(regularNumericSku);
    expect(fuelProductsFromEnvelope(stringParsed)[0]?.sku).toBe("1");
    expect(fuelProductsFromEnvelope(numericParsed)[0]?.sku).toBe("1");

    expect(observationsFromFuelResponse(189, regularStringSku, observedAt)[0]?.fuelSku).toBe("1");
    expect(observationsFromFuelResponse(189, regularNumericSku, observedAt)[0]?.fuelSku).toBe("1");

    expect(classifyFuelProbePayload(regularStringSku)).toEqual({ kind: "has_products" });
    expect(classifyFuelProbePayload(regularNumericSku)).toEqual({ kind: "has_products" });
    expect(parseFuelHasProducts(regularStringSku)).toBe(true);
    expect(parseFuelHasProducts(regularNumericSku)).toBe(true);
  });

  it("accepts empty data[] without treating it as hasGas === false", () => {
    const parsed = fuelPriceEnvelopeSchema.safeParse(emptyProducts);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(fuelProductsFromEnvelope(parsed.data)).toEqual([]);
    }

    expect(classifyFuelProbePayload(emptyProducts)).toEqual({ kind: "empty_products" });
    expect(parseFuelHasProducts(emptyProducts)).toBe(false);
    expect(() => observationsFromFuelResponse(189, emptyProducts, observedAt)).toThrow(
      /Empty fuel array/,
    );
  });

  it("treats absent fuelPriceResponse as empty products, not a missing-gas proof", () => {
    const absent = { response: { statusCode: 0, statusMsg: "success" } };
    expect(fuelPriceEnvelopeSchema.safeParse(absent).success).toBe(true);
    expect(classifyFuelProbePayload(absent)).toEqual({ kind: "empty_products" });
    expect(parseFuelHasProducts(absent)).toBe(false);
    expect(() => observationsFromFuelResponse(189, absent, observedAt)).toThrow(/Empty fuel array/);
  });

  it("passthroughs unknown upstream fields", () => {
    const extra = {
      response: {
        fuelPriceResponse: {
          data: [
            {
              name: "Regular",
              sku: "1",
              price: 3.159,
              extraProductFlag: true,
            },
          ],
          extraEnvelopeField: "keep",
        },
        leftover: 1,
      },
      unusedTopLevel: "ok",
    };
    const parsed = fuelPriceEnvelopeSchema.parse(extra);
    const envelope = parsed as typeof parsed & {
      unusedTopLevel?: unknown;
      response: typeof parsed.response & {
        leftover?: unknown;
        fuelPriceResponse?: {
          extraEnvelopeField?: unknown;
          data: Array<{ extraProductFlag?: unknown }>;
        };
      };
    };
    expect(envelope.unusedTopLevel).toBe("ok");
    expect(envelope.response.leftover).toBe(1);
    expect(envelope.response.fuelPriceResponse?.extraEnvelopeField).toBe("keep");
    expect(envelope.response.fuelPriceResponse?.data[0]?.extraProductFlag).toBe(true);
    expect(observationsFromFuelResponse(1, extra, observedAt)[0]?.fuelSku).toBe("1");
    expect(classifyFuelProbePayload(extra)).toEqual({ kind: "has_products" });
  });

  it("accepts null or absent priceDateTime without inventing a timestamp", () => {
    const absentDate = {
      response: {
        fuelPriceResponse: { data: [{ name: "Regular", sku: "1", price: 3.159 }] },
      },
    };
    const nullDate = {
      response: {
        fuelPriceResponse: {
          data: [{ name: "Regular", sku: "1", price: 3.159, priceDateTime: null }],
        },
      },
    };
    expect(fuelPriceEnvelopeSchema.safeParse(absentDate).success).toBe(true);
    expect(fuelPriceEnvelopeSchema.safeParse(nullDate).success).toBe(true);
    expect(observationsFromFuelResponse(1, absentDate, observedAt)[0]?.sourcePriceAtLocal).toBeNull();
    expect(observationsFromFuelResponse(1, nullDate, observedAt)[0]?.sourcePriceAtLocal).toBeNull();
  });

  it("rejects malformed usable products instead of persisting them", () => {
    const missingPrice = {
      response: {
        fuelPriceResponse: { data: [{ name: "Regular", sku: "1" }] },
      },
    };
    const emptyName = {
      response: {
        fuelPriceResponse: { data: [{ name: "", sku: "1", price: 3.159 }] },
      },
    };
    const nonFinitePrice = {
      response: {
        fuelPriceResponse: { data: [{ name: "Regular", sku: "1", price: Number.NaN }] },
      },
    };

    for (const payload of [missingPrice, emptyName, nonFinitePrice]) {
      expect(fuelPriceEnvelopeSchema.safeParse(payload).success).toBe(false);
      expect(classifyFuelProbePayload(payload).kind).toBe("error");
      expect(() => observationsFromFuelResponse(1, payload, observedAt)).toThrow(/Malformed fuel response/);
      expect(() => parseFuelHasProducts(payload)).toThrow(/Malformed fuel response/);
    }
  });
});
