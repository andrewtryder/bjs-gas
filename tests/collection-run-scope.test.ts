import { describe, expect, it, vi } from "vitest";
import { CollectionRunScope, type PrismaClient } from "@prisma/client";
import { createApp } from "../src/app.js";
import { getCollectionStatus } from "../src/api/status.js";
import {
  COLLECTION_RUN_SCOPE,
  diagnosticCollectionRunInput,
} from "../src/fuel/types.js";

function freshnessNow(at: Date) {
  return [
    {
      latest: at,
      oldest: at,
      rows: 511n,
      stations_recent: 208n,
    },
  ];
}

function fleetRun(finishedAt: Date, clubsConfigured: number) {
  return {
    startedAt: new Date(finishedAt.getTime() - 8_000),
    finishedAt,
    durationMs: 8_000,
    clubsConfigured,
    clubsSucceeded: clubsConfigured === 214 ? 208 : clubsConfigured,
    clubsEmptyFuels: clubsConfigured === 214 ? 6 : 0,
    clubsHardFailed: 0,
    fuelObservations: clubsConfigured === 214 ? 511 : 2,
    historyChanges: 0,
    databaseQueries: 1,
    degraded: false,
    failures: [],
  };
}

describe("CollectionRun scope", () => {
  it("collect:club persist helper is diagnostic, not fleet", () => {
    const run = diagnosticCollectionRunInput({
      startedAt: "2026-10-03T12:10:00.000Z",
      finishedAt: "2026-10-03T12:10:05.000Z",
      durationMs: 5_000,
      fuelObservations: 2,
    });
    expect(run.scope).toBe(COLLECTION_RUN_SCOPE.DIAGNOSTIC);
    expect(run.scope).not.toBe(COLLECTION_RUN_SCOPE.FLEET);
    expect(run.clubsConfigured).toBe(1);
    expect(run.clubsSucceeded).toBe(1);
    expect(run.degraded).toBe(false);
  });

  it("status ignores a newer diagnostic run and keeps the last fleet attempt", async () => {
    const now = new Date();
    const fleetFinished = new Date(now.getTime() - 20 * 60_000);
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn(async (args: { where?: { scope?: string } }) => {
          expect(args.where).toEqual({ scope: CollectionRunScope.FLEET });
          return [fleetRun(fleetFinished, 214)];
        }),
      },
      $queryRaw: vi.fn(async () => freshnessNow(fleetFinished)),
    } as unknown as PrismaClient;

    const body = await getCollectionStatus(mockPrisma);
    expect(body.lastAttemptedCollection?.finishedAt).toBe(fleetFinished.toISOString());
    expect(body.lastSuccessfulCollection?.finishedAt).toBe(fleetFinished.toISOString());
    expect(body.lastCollection?.finishedAt).toBe(fleetFinished.toISOString());
    expect(body.lastAttemptedCollection?.clubsConfigured).toBe(214);
    expect(body.unhealthyReasons).not.toContain("configured_clubs_mismatch");
  });

  it("does not hide a one-club fleet run from health", async () => {
    const now = new Date();
    const validFleet = new Date(now.getTime() - 20 * 60_000);
    const brokenFleet = new Date(now.getTime() - 10 * 60_000);
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn(async (args: { where?: { scope?: string } }) => {
          expect(args.where).toEqual({ scope: CollectionRunScope.FLEET });
          return [fleetRun(brokenFleet, 1), fleetRun(validFleet, 214)];
        }),
      },
      $queryRaw: vi.fn(async () => freshnessNow(brokenFleet)),
    } as unknown as PrismaClient;

    const body = await getCollectionStatus(mockPrisma);
    expect(body.lastAttemptedCollection?.finishedAt).toBe(brokenFleet.toISOString());
    expect(body.lastAttemptedCollection?.clubsConfigured).toBe(1);
    expect(body.unhealthyReasons).toContain("configured_clubs_mismatch");
  });

  it("HTTP /api/v1/status queries fleet-scoped CollectionRun rows", async () => {
    const finishedAt = new Date();
    const mockPrisma = {
      collectionRun: {
        findMany: vi.fn(async () => [fleetRun(finishedAt, 214)]),
      },
      $queryRaw: vi.fn(async () => freshnessNow(finishedAt)),
    } as unknown as PrismaClient;

    const app = createApp({ prisma: mockPrisma, collectorSecret: "test-secret-value-0001" });
    const res = await app.request("/api/v1/status");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { lastAttemptedCollection: { clubsConfigured: number } };
    expect(json.lastAttemptedCollection.clubsConfigured).toBe(214);
    expect(mockPrisma.collectionRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { scope: CollectionRunScope.FLEET },
      }),
    );
  });
});
