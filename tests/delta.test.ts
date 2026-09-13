import { describe, expect, it } from "vitest";
import { resolveDeltaBadgeInfo } from "../web/lib/delta.js";

describe("Delta Badge Formatting Model", () => {
  it("formats price drop as positive/favorable with down arrow and cents", () => {
    const info = resolveDeltaBadgeInfo({ cents: -12 });
    expect(info.direction).toBe("down");
    expect(info.variant).toBe("positive");
    expect(info.formattedText).toBe("↓ 12¢");
    expect(info.ariaLabel).toBe("Price decreased by 12 cents");
  });

  it("formats price increase as negative/danger with up arrow and cents", () => {
    const info = resolveDeltaBadgeInfo({ cents: 15 });
    expect(info.direction).toBe("up");
    expect(info.variant).toBe("negative");
    expect(info.formattedText).toBe("↑ 15¢");
    expect(info.ariaLabel).toBe("Price increased by 15 cents");
  });

  it("formats zero cents as neutral Same price", () => {
    const info = resolveDeltaBadgeInfo({ cents: 0 });
    expect(info.direction).toBe("neutral");
    expect(info.variant).toBe("neutral");
    expect(info.formattedText).toBe("Same price");
    expect(info.ariaLabel).toBe("No price change");
  });

  it("converts diffDollars into rounded cents accurately", () => {
    const info1 = resolveDeltaBadgeInfo({ diffDollars: -0.091 });
    expect(info1.formattedText).toBe("↓ 9¢");

    const info2 = resolveDeltaBadgeInfo({ diffDollars: 0.148 });
    expect(info2.formattedText).toBe("↑ 15¢");
  });

  it("appends timeframe when specified", () => {
    const info = resolveDeltaBadgeInfo({ cents: -7 }, "this week");
    expect(info.formattedText).toBe("↓ 7¢ this week");
    expect(info.ariaLabel).toBe("Price decreased by 7 cents this week");
  });

  it("handles custom label override correctly", () => {
    const info = resolveDeltaBadgeInfo({ label: "Steady price" });
    expect(info.formattedText).toBe("Steady price");
    expect(info.ariaLabel).toBe("Steady price");
  });

  it("handles null or undefined input gracefully", () => {
    const info = resolveDeltaBadgeInfo({});
    expect(info.formattedText).toBe("—");
    expect(info.ariaLabel).toBe("Price change unavailable");
  });
});
