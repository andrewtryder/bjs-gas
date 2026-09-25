import { Hono } from "hono";
import type { PrismaClient } from "@prisma/client";
import { authorizeCollector } from "./auth.js";
import {
  getCollectionLockState,
  isCollectionInProgress,
  loadGasClubs,
  runCollection,
} from "./collector.js";
import { getNearbyStations, getStationHistory, getStationWithPrices, listStationsWithPrices } from "./api/stations.js";
import { getCollectionStatus } from "./api/status.js";
import { createAnalyticsRouter } from "./api/analytics.js";
import { fetchClubFuel } from "./fuel/client.js";
import { reportApiError } from "./honeybadger.js";

export const SERVICE_NAME = "bjs-gas-api";
export const SERVICE_VERSION = "0.1.0";
/** Injected at `bun build` via --define; falls back for local/dev. */
export const BUILD_REVISION =
  typeof process !== "undefined" && process.env.BUILD_REVISION
    ? process.env.BUILD_REVISION
    : "dev";
/** Injected at build time; true when worktree differed from HEAD at build. */
export const BUILD_DIRTY =
  typeof process !== "undefined" && process.env.BUILD_DIRTY === "true";

export type AppEnv = {
  prisma: PrismaClient;
  collectorSecret: string;
  honeybadgerApiKey?: string;
};

export function createApp(env: AppEnv): Hono {
  const app = new Hono();

  app.onError((err, c) => {
    const status =
      "status" in err && typeof err.status === "number" ? err.status : 500;
    if (status >= 500) {
      reportApiError(err, {
        route: c.req.path,
        method: c.req.method,
        statusCode: status,
      });
    }
    console.error("API error caught:", err);
    return c.json({ error: "internal_server_error" }, 500);
  });

  app.get("/health", (c) => {
    const gasClubs = loadGasClubs();
    const lock = getCollectionLockState();
    c.header("Cache-Control", "no-store");
    return c.json({
      ok: true,
      service: SERVICE_NAME,
      configuredGasClubs: gasClubs.length,
      time: new Date().toISOString(),
      version: SERVICE_VERSION,
      revision: BUILD_REVISION,
      dirty: BUILD_DIRTY || BUILD_REVISION.endsWith("-dirty"),
      collectionInProgress: lock.inProgress,
      collectionLock: {
        inProgress: lock.inProgress,
        startedAt: lock.startedAt,
        ageSeconds: lock.ageSeconds,
        overExpectedDuration: lock.overExpectedDuration,
        stale: lock.stale,
      },
    });
  });

  /**
   * Phase-1 / ops probe: prove Prisma Compute egress to eisapi without collecting.
   * Auth required. Does not touch Postgres.
   */
  app.get("/internal/probe/fuel/:clubNumber", async (c) => {
    if (!authorizeCollector(c.req.header("authorization"), env.collectorSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    const clubNumber = Number.parseInt(c.req.param("clubNumber"), 10);
    if (!Number.isFinite(clubNumber)) {
      return c.json({ error: "invalid_club_number" }, 400);
    }
    const observedAt = new Date().toISOString();
    const started = Date.now();
    const result = await fetchClubFuel(clubNumber, observedAt);
    return c.json({
      clubNumber,
      durationMs: Date.now() - started,
      observedAt,
      result,
    });
  });

  app.post("/internal/collect", async (c) => {
    if (!authorizeCollector(c.req.header("authorization"), env.collectorSecret)) {
      return c.json({ error: "unauthorized" }, 401);
    }
    if (isCollectionInProgress()) {
      return c.json({ error: "collection_in_progress" }, 409);
    }
    try {
      const result = await runCollection({ prisma: env.prisma });
      return c.json(result);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "COLLECTION_IN_PROGRESS") {
        return c.json({ error: "collection_in_progress" }, 409);
      }
      reportApiError(error, {
        route: "/internal/collect",
        method: "POST",
        statusCode: 500,
      });
      console.error(
        JSON.stringify({
          event: "gas_collection_error",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return c.json({ error: "collection_failed" }, 500);
    }
  });

  app.get("/api/v1/status", async (c) => {
    const payload = await getCollectionStatus(env.prisma);
    // Status must stay highly fresh while diagnosing collector/scheduler health.
    c.header("Cache-Control", "public, max-age=15, s-maxage=15, stale-while-revalidate=30");
    return c.json(payload);
  });

  app.get("/api/v1/stations", async (c) => {
    const payload = await listStationsWithPrices(env.prisma);
    // Hourly collector → ~5 minute CDN cache is safe; avoid longer stale windows.
    c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
    return c.json(payload);
  });

  app.get("/api/v1/stations/:clubNumber", async (c) => {
    const clubNumber = Number.parseInt(c.req.param("clubNumber"), 10);
    if (!Number.isFinite(clubNumber)) {
      return c.json({ error: "invalid_club_number" }, 400);
    }
    const station = await getStationWithPrices(env.prisma, clubNumber);
    if (!station) return c.json({ error: "not_found" }, 404);
    c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
    return c.json({ generatedAt: new Date().toISOString(), station });
  });

  app.get("/api/v1/stations/:clubNumber/history", async (c) => {
    const clubNumber = Number.parseInt(c.req.param("clubNumber"), 10);
    if (!Number.isFinite(clubNumber)) {
      return c.json({ error: "invalid_club_number" }, 400);
    }
    const club = await env.prisma.club.findUnique({ where: { clubNumber } });
    if (!club) return c.json({ error: "not_found" }, 404);
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 100;
    const history = await getStationHistory(env.prisma, clubNumber, {
      limit: Number.isFinite(limit) ? limit : 100,
    });
    c.header("Cache-Control", "public, max-age=120, s-maxage=300, stale-while-revalidate=120");
    return c.json({ clubNumber, history });
  });

  app.get("/api/v1/stations/:clubNumber/nearby", async (c) => {
    const clubNumber = Number.parseInt(c.req.param("clubNumber"), 10);
    if (!Number.isFinite(clubNumber)) {
      return c.json({ error: "invalid_club_number" }, 400);
    }
    const limitRaw = c.req.query("limit");
    const milesRaw = c.req.query("miles");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 5;
    const maxMiles = milesRaw ? Number.parseFloat(milesRaw) : undefined;

    const result = await getNearbyStations(env.prisma, clubNumber, {
      limit: Number.isFinite(limit) ? limit : 5,
      maxMiles: maxMiles != null && Number.isFinite(maxMiles) ? maxMiles : undefined,
    });

    if (!result) return c.json({ error: "not_found" }, 404);

    c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=60");
    return c.json({
      generatedAt: new Date().toISOString(),
      clubNumber,
      station: result.targetStation,
      nearby: result.nearby,
    });
  });

  app.route("/api/v1/analytics", createAnalyticsRouter(env.prisma));

  return app;
}
