import { Hono } from "hono";
import type { PrismaClient } from "@prisma/client";
import {
  getNationalSummary,
  getNationalTrends,
  getStateSummaries,
  getPriceMovers,
} from "../analytics/queries.js";

export function createAnalyticsRouter(prisma: PrismaClient): Hono {
  const router = new Hono();

  // 1. National Summary
  router.get("/summary", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    try {
      const result = await getNationalSummary(prisma, fuelSku);
      c.header("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=60");
      return c.json(result);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "analytics_summary_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return c.json({ error: "analytics_summary_failed" }, 500);
    }
  });

  // 2. Historical Trends (National or State-Scoped)
  router.get("/trends", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const state = c.req.query("state");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    try {
      const result = await getNationalTrends(prisma, { fuelSku, days, state });
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "analytics_trends_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return c.json({ error: "analytics_trends_failed" }, 500);
    }
  });

  router.get("/states/:state/trends", async (c) => {
    const state = c.req.param("state");
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    try {
      const result = await getNationalTrends(prisma, { fuelSku, days, state });
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "analytics_state_trends_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return c.json({ error: "analytics_state_trends_failed" }, 500);
    }
  });

  // 3. State Summaries
  router.get("/states", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    try {
      const result = await getStateSummaries(prisma, fuelSku);
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "analytics_states_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return c.json({ error: "analytics_states_failed" }, 500);
    }
  });

  // 4. Price Movers
  router.get("/movers", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 7;
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;

    try {
      const result = await getPriceMovers(prisma, { fuelSku, days, limit });
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "analytics_movers_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
      return c.json({ error: "analytics_movers_failed" }, 500);
    }
  });

  return router;
}
