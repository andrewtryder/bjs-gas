import { Hono, type Context } from "hono";
import type { PrismaClient } from "@prisma/client";
import {
  getNationalSummary,
  getNationalTrends,
  getStateSummaries,
  getPriceMovers,
} from "../analytics/queries.js";
import { isPrismaPoolTimeout, prismaPoolTimeoutBody } from "./errors.js";
import {
  ConcurrencyLimiter,
  LimiterOverloadError,
  analyticsLimiter,
  publicDbLimiter,
} from "./limiter.js";

const SUMMARY_CACHE_CONTROL =
  "public, max-age=60, s-maxage=120, stale-while-revalidate=60";
const ANALYTICS_CACHE_CONTROL =
  "public, max-age=120, s-maxage=600, stale-while-revalidate=120";

function handleAnalyticsError(
  err: unknown,
  c: Context,
  event: string,
  fallbackError: string,
  limiter: ConcurrencyLimiter,
  dbLimiter?: ConcurrencyLimiter,
) {
  if (err instanceof LimiterOverloadError) {
    console.warn(
      JSON.stringify({
        event: "analytics_overloaded",
        route: c.req.path,
        method: c.req.method,
        queryCategory: "analytics",
        reason: err.code,
        message: err.message,
        poolPressure: {
          activeAnalytics: limiter.activeCount,
          waitingAnalytics: limiter.waitingCount,
          ...(dbLimiter
            ? {
                activeDb: dbLimiter.activeCount,
                waitingDb: dbLimiter.waitingCount,
              }
            : {}),
        },
      }),
    );
    return c.json(
      {
        error: "analytics_overloaded",
        reason: err.code,
      },
      503,
    );
  }

  if (isPrismaPoolTimeout(err)) {
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
          ...(dbLimiter
            ? {
                activeDb: dbLimiter.activeCount,
                waitingDb: dbLimiter.waitingCount,
              }
            : {}),
        },
      }),
    );
    return c.json(prismaPoolTimeoutBody, 503);
  }

  console.error(
    JSON.stringify({
      event,
      error: err instanceof Error ? err.message : String(err),
    }),
  );
  return c.json({ error: fallbackError }, 500);
}

async function runAnalyticsQuery<T>(
  c: Context,
  limiter: ConcurrencyLimiter,
  dbLimiter: ConcurrencyLimiter | undefined,
  options: {
    cacheControl: string;
    event: string;
    fallbackError: string;
    query: () => Promise<T>;
  },
) {
  try {
    const execute =
      dbLimiter && dbLimiter !== limiter
        ? () => limiter.run(() => dbLimiter.run(options.query))
        : () => limiter.run(options.query);
    const result = await execute();
    c.header("Cache-Control", options.cacheControl);
    return c.json(result);
  } catch (err) {
    return handleAnalyticsError(err, c, options.event, options.fallbackError, limiter, dbLimiter);
  }
}

export function createAnalyticsRouter(
  prisma: PrismaClient,
  limiter: ConcurrencyLimiter = analyticsLimiter,
  dbLimiter: ConcurrencyLimiter = publicDbLimiter,
): Hono {
  const router = new Hono();

  // 1. National Summary
  router.get("/summary", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    return runAnalyticsQuery(c, limiter, dbLimiter, {
      cacheControl: SUMMARY_CACHE_CONTROL,
      event: "analytics_summary_error",
      fallbackError: "analytics_summary_failed",
      query: () => getNationalSummary(prisma, fuelSku),
    });
  });

  // 2. Historical Trends (National or State-Scoped)
  router.get("/trends", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const state = c.req.query("state");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    return runAnalyticsQuery(c, limiter, dbLimiter, {
      cacheControl: ANALYTICS_CACHE_CONTROL,
      event: "analytics_trends_error",
      fallbackError: "analytics_trends_failed",
      query: () => getNationalTrends(prisma, { fuelSku, days, state }),
    });
  });

  router.get("/states/:state/trends", async (c) => {
    const state = c.req.param("state");
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 30;

    return runAnalyticsQuery(c, limiter, dbLimiter, {
      cacheControl: ANALYTICS_CACHE_CONTROL,
      event: "analytics_state_trends_error",
      fallbackError: "analytics_state_trends_failed",
      query: () => getNationalTrends(prisma, { fuelSku, days, state }),
    });
  });

  // 3. State Summaries
  router.get("/states", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    return runAnalyticsQuery(c, limiter, dbLimiter, {
      cacheControl: ANALYTICS_CACHE_CONTROL,
      event: "analytics_states_error",
      fallbackError: "analytics_states_failed",
      query: () => getStateSummaries(prisma, fuelSku),
    });
  });

  // 4. Price Movers
  router.get("/movers", async (c) => {
    const fuelSku = c.req.query("fuelSku");
    const daysRaw = c.req.query("days");
    const days = daysRaw ? Number.parseInt(daysRaw, 10) : 7;
    const limitRaw = c.req.query("limit");
    const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 10;

    return runAnalyticsQuery(c, limiter, dbLimiter, {
      cacheControl: ANALYTICS_CACHE_CONTROL,
      event: "analytics_movers_error",
      fallbackError: "analytics_movers_failed",
      query: () => getPriceMovers(prisma, { fuelSku, days, limit }),
    });
  });

  return router;
}
