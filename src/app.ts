import { Hono } from "hono";
import type { PrismaClient } from "@prisma/client";
import { authorizeCollector } from "./auth.js";
import { isCollectionInProgress, loadGasClubs, runCollection } from "./collector.js";
import { getStationHistory, getStationWithPrices, listStationsWithPrices } from "./api/stations.js";
import { getCollectionStatus } from "./api/status.js";
import { fetchClubFuel } from "./fuel/client.js";

export const SERVICE_NAME = "bjs-gas-api";
export const SERVICE_VERSION = "0.1.0";

export type AppEnv = {
  prisma: PrismaClient;
  collectorSecret: string;
};

export function createApp(env: AppEnv): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    const gasClubs = loadGasClubs();
    return c.json({
      ok: true,
      service: SERVICE_NAME,
      configuredGasClubs: gasClubs.length,
      time: new Date().toISOString(),
      version: SERVICE_VERSION,
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
    c.header("Cache-Control", "public, max-age=60, s-maxage=60");
    return c.json(payload);
  });

  app.get("/api/v1/stations", async (c) => {
    const payload = await listStationsWithPrices(env.prisma);
    c.header("Cache-Control", "public, max-age=300, s-maxage=600");
    return c.json(payload);
  });

  app.get("/api/v1/stations/:clubNumber", async (c) => {
    const clubNumber = Number.parseInt(c.req.param("clubNumber"), 10);
    if (!Number.isFinite(clubNumber)) {
      return c.json({ error: "invalid_club_number" }, 400);
    }
    const station = await getStationWithPrices(env.prisma, clubNumber);
    if (!station) return c.json({ error: "not_found" }, 404);
    c.header("Cache-Control", "public, max-age=300, s-maxage=600");
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
    c.header("Cache-Control", "public, max-age=120, s-maxage=300");
    return c.json({ clubNumber, history });
  });

  return app;
}
