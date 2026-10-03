import { describe, expect, it, vi } from "vitest";
import { diffClubRegistries } from "../src/discover.js";
import { runCollection } from "../src/collector.js";
import type { BjsClub } from "../src/types.js";
import type { PrismaClient } from "@prisma/client";

function club(partial: Partial<BjsClub> & Pick<BjsClub, "clubNumber" | "name" | "hasGas">): BjsClub {
  return {
    clubId: String(partial.clubNumber).padStart(4, "0"),
    city: "X",
    state: "MA",
    postalCode: "00000",
    address1: "1 Main",
    services: partial.hasGas ? ["Gas"] : [],
    gasStatus: partial.hasGas ? "yes" : "no",
    storeType: "CLUB",
    gasClassification: { source: "locator", signals: [] },
    source: "t",
    ...partial,
  };
}

describe("discovery:diff semantics", () => {
  it("flags removals as unclean", () => {
    const prev = [club({ clubNumber: 1, name: "A", hasGas: true }), club({ clubNumber: 2, name: "B", hasGas: false })];
    const cand = [club({ clubNumber: 1, name: "A", hasGas: true })];
    const diff = diffClubRegistries(prev, cand);
    expect(diff.clean).toBe(false);
    expect(diff.removed).toHaveLength(1);
    expect(diff.warnings.length).toBeGreaterThan(0);
  });

  it("reports additions and hasGas flips while staying clean if no removals", () => {
    const prev = [club({ clubNumber: 1, name: "A", hasGas: false })];
    const cand = [
      club({ clubNumber: 1, name: "A", hasGas: true }),
      club({ clubNumber: 2, name: "B", hasGas: true }),
    ];
    const diff = diffClubRegistries(prev, cand);
    expect(diff.clean).toBe(true);
    expect(diff.added).toHaveLength(1);
    expect(diff.hasGasFlips).toEqual([
      { clubNumber: 1, name: "A", from: false, to: true },
    ]);
  });
});

describe("collector never mutates Club.hasGas", () => {
  it("dry-run collection does not call prisma.club.update", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "bjs-gas-"));
    writeFileSync(
      join(dir, "gas-clubs.json"),
      JSON.stringify([{ clubNumber: 189, clubId: "0189", name: "Haverhill" }]),
    );

    const clubUpdate = vi.fn();
    const prisma = {
      club: { update: clubUpdate, updateMany: clubUpdate },
    } as unknown as PrismaClient;

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: {
              data: [{ name: "Unleaded", sku: "1", price: 3.919 }],
            },
            statusCode: 0,
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await runCollection({
      dryRun: true,
      concurrency: 1,
      fetchImpl,
      dataDir: dir,
      prisma,
    });

    expect(clubUpdate).not.toHaveBeenCalled();
    expect(result.clubsConfigured).toBe(1);
    expect(result.clubsSucceeded).toBe(1);
    expect(result.clubsEmptyFuels).toBe(0);
  });

  it("counts empty-fuel clubs without mutating hasGas", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");
    const dir = mkdtempSync(join(tmpdir(), "bjs-gas-empty-"));
    writeFileSync(
      join(dir, "gas-clubs.json"),
      JSON.stringify([{ clubNumber: 901, clubId: "0901", name: "Auburn Gas Station" }]),
    );

    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          response: {
            fuelPriceResponse: { data: [] },
            statusCode: 0,
            statusMsg: "success",
          },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await runCollection({
      dryRun: true,
      concurrency: 1,
      fetchImpl,
      dataDir: dir,
    });

    expect(result.clubsEmptyFuels).toBe(1);
    expect(result.clubsFailed).toBe(1);
    expect(result.fuelObservations).toBe(0);
    expect(result.databaseQueries).toBe(0);
  });
});
