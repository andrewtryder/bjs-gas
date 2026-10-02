import { Hono } from "hono";
import type { PrismaClient } from "@prisma/client";
import {
  getNationalSummary,
  getNationalTrends,
  getStateSummaries,
  getPriceMovers,
} from "../analytics/queries.js";
import { ConcurrencyLimiter, analyticsLimiter } from "./limiter.js";

function handleAnalyticsError(
  err: unknown,
  c: any,
  event: string,
  fallbackError: string,
  limiter: ConcurrencyLimiter,
) {
  const isP2024 =
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "P2024";

  if (isP2024) {
    console.error(
      JSON.stringify({
        event: "prisma_pool_timeout_p2024",
        route: c.req.path,
        method: c.req.method,
        queryCategory: "analytics",
        code: "P2024",
        error: err instanceof Error ? err.message : String(err),
        poolPressure: {
          activeAnalytics: limiter.activeCount,
          waitingAnalytics: limiter.waitingCount,
        },
      }),
    );
    return c.json(
      {
        error: "database_pool_timeout",
        code: "P2024",
        message: "Database connection pool exhausted. Please retry.",
      },
      503,
    );
  }

  console.error(
    JSON.stringify({
      event,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  return c.json({ error: fallbackError }, 500);
}

export function createAnalyticsRouter(
  prisma: PrismaClient,
  limiter: ConcurrencyLimiter = analyticsLimiter,
): Hono {
  const router = new Hono();

  // 1. National Summary
  router.get("/summary", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    try {
      const result = await limiter.run(() => getNationalSummary(prisma, fuelSku));
      c.header("Cache-Control", "public, max-age=60, s-maxage=120, stale-while-revalidate=60");
      return c.json(result);
    } catch (err) {
      return handleAnalyticsError(err, c, "analytics_summary_error", "analytics_summary_failed", limiter);
    }
  });

  // 2. Historical Trends (National or State-Scoped)
  router.get("/trends", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const state = c.req.query("state");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    try {
      const result = await limiter.run(() =>
        getNationalTrends(prisma, { fuelSku, days, state }),
      );
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      return handleAnalyticsError(err, c, "analytics_trends_error", "analytics_trends_failed", limiter);
    }
  });

  router.get("/states/:state/trends", async (c) => {
    const state = c.req.param("state");
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    try {
      const result = await limiter.run(() =>
        getNationalTrends(prisma, { fuelSku, days, state }),
      );
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      return handleAnalyticsError(err, c, "analytics_state_trends_error", "analytics_state_trends_failed", limiter);
    }
  });

  // 3. State Summaries
  router.get("/states", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    try {
      const result = await limiter.run(() => getStateSummaries(prisma, fuelSku));
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      return handleAnalyticsError(err, c, "analytics_states_error", "analytics_states_failed", limiter);
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
      const result = await limiter.run(() =>
        getPriceMovers(prisma, { fuelSku, days, limit }),
      );
      c.header("Cache-Control", "public, max-age=120, s-maxage=600, stale-while-revalidate=120");
      return c.json(result);
    } catch (err) {
      return handleAnalyticsError(err, c, "analytics_movers_error", "analytics_movers_failed", limiter);
    }
  });

  return router;
}
