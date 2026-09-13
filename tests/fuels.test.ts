import { describe, expect, it } from "vitest";
import { normalizeFuelDisplayName } from "../web/lib/fuels.js";

describe("Fuel Display Label Normalization", () => {
  it("normalizes SKU '1' and unleaded variants to Regular", () => {
    expect(normalizeFuelDisplayName("1")).toBe("Regular");
    expect(normalizeFuelDisplayName("Unleaded")).toBe("Regular");
    expect(normalizeFuelDisplayName("Regular Unleaded")).toBe("Regular");
    expect(normalizeFuelDisplayName("regular gasoline")).toBe("Regular");
    expect(normalizeFuelDisplayName("UNLEADED")).toBe("Regular");
  });

  it("normalizes SKU '3' and premium variants to Premium", () => {
    expect(normalizeFuelDisplayName("3")).toBe("Premium");
    expect(normalizeFuelDisplayName("Premium")).toBe("Premium");
    expect(normalizeFuelDisplayName("Premium Unleaded")).toBe("Premium");
    expect(normalizeFuelDisplayName("PREMIUM")).toBe("Premium");
  });

  it("normalizes SKU '4' and diesel variants to Diesel", () => {
    expect(normalizeFuelDisplayName("4")).toBe("Diesel");
    expect(normalizeFuelDisplayName("Diesel")).toBe("Diesel");
    expect(normalizeFuelDisplayName("Ultra Low Sulfur Diesel")).toBe("Diesel");
  });

  it("handles empty or null values gracefully by defaulting to Regular", () => {
    expect(normalizeFuelDisplayName(null)).toBe("Regular");
    expect(normalizeFuelDisplayName(undefined)).toBe("Regular");
    expect(normalizeFuelDisplayName("")).toBe("Regular");
  });

  it("preserves unrecognized fuel names safely", () => {
    expect(normalizeFuelDisplayName("E85 Flex Fuel")).toBe("E85 Flex Fuel");
    expect(normalizeFuelDisplayName("Biodiesel B20")).toBe("Biodiesel B20");
  });
});
