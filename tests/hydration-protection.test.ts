import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Hydration Mismatch Protection for Dynamic Timestamps", () => {
  it("enforces suppressHydrationWarning on MapDiscoveryView selected station freshness", () => {
    const filePath = resolve(__dirname, "../web/components/MapDiscoveryView.tsx");
    const content = readFileSync(filePath, "utf-8");

    // The selected station footer freshness tag must suppress hydration warnings
    // because server rendering time and client hydration time can cross minute/hour boundaries.
    expect(content).toMatch(
      /map-selected-freshness[\s\S]*?suppressHydrationWarning[\s\S]*?selectedStationFreshnessText/,
    );
  });

  it("enforces suppressHydrationWarning on StatusPill text and container", () => {
    const filePath = resolve(__dirname, "../web/components/ui/StatusPill.tsx");
    const content = readFileSync(filePath, "utf-8");

    expect(content).toContain("suppressHydrationWarning");
  });

  it("enforces suppressHydrationWarning on StationDetailPage freshness text", () => {
    const filePath = resolve(
      __dirname,
      "../web/app/stations/[clubNumber]/page.tsx",
    );
    const content = readFileSync(filePath, "utf-8");

    expect(content).toMatch(/station-freshness-text[\s\S]*?suppressHydrationWarning/);
  });
});
