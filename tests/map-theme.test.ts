import { describe, expect, it } from "vitest";
import { MAP_THEME_TOKENS } from "../web/lib/map-config.js";
import { normalizeFuelDisplayName } from "../web/lib/fuels.js";

describe("Map Theme & Display Tokens", () => {
  it("exports canonical Ledger Slate theme tokens for MapLibre paint expressions", () => {
    expect(MAP_THEME_TOKENS.accent).toBe("#2563eb");
    expect(MAP_THEME_TOKENS.accentHover).toBe("#1d4ed8");
    expect(MAP_THEME_TOKENS.textPrimary).toBe("#0f172a");
    expect(MAP_THEME_TOKENS.textMuted).toBe("#64748b");
    expect(MAP_THEME_TOKENS.border).toBe("#e2e8f0");
    expect(MAP_THEME_TOKENS.surface).toBe("#ffffff");
  });

  it("normalizes common gas SKU variants to canonical Regular, Premium, and Diesel", () => {
    expect(normalizeFuelDisplayName("Regular Unleaded")).toBe("Regular");
    expect(normalizeFuelDisplayName("Unleaded")).toBe("Regular");
    expect(normalizeFuelDisplayName("1")).toBe("Regular");
    expect(normalizeFuelDisplayName("Premium Unleaded")).toBe("Premium");
    expect(normalizeFuelDisplayName("3")).toBe("Premium");
    expect(normalizeFuelDisplayName("Diesel Fuel")).toBe("Diesel");
    expect(normalizeFuelDisplayName("4")).toBe("Diesel");
  });
});
