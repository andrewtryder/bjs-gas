import "./prisma-engine.ts";
import { serveSchedule } from "@prisma/composer-prisma-cloud/cron";
import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";
import { initApiHoneybadger, reportApiError } from "./honeybadger.ts";
import { isCollectionInProgress, runCollection } from "./collector.ts";
import { schedule } from "./schedule.ts";
import service from "./service.ts";

const { db } = service.load();
const input = service.input() as Record<string, any>;
const collectorSecret = input.collectorSecret.expose();
const honeybadgerApiKey = input.honeybadgerApiKey
  ? input.honeybadgerApiKey.expose()
  : undefined;

if (honeybadgerApiKey) {
  initApiHoneybadger(honeybadgerApiKey);
}

const prisma = createPrismaClient(db.url);
const app = createApp({
  prisma,
  collectorSecret,
  honeybadgerApiKey,
});

const cronHandler = serveSchedule(service, schedule, {
  collect: async () => {
    if (isCollectionInProgress()) {
      console.log(
        JSON.stringify({
          event: "cron_collection_skipped",
          reason: "in_progress",
        }),
      );
      return;
    }
    try {
      const result = await runCollection({ prisma });
      console.log(
        JSON.stringify({
          event: "cron_collection_complete",
          clubsPolled: result.clubsAttempted,
          observations: result.fuelObservations,
        }),
      );
    } catch (err) {
      reportApiError(err, { context: { trigger: "cron_schedule" } });
      console.error(
        JSON.stringify({
          event: "cron_collection_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  },
});

Bun.serve({
  port: service.port(),
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/rpc/")) {
      return cronHandler(req);
    }
    return app.fetch(req);
  },
});

console.log(
  JSON.stringify({
    event: "bjs_gas_api_started",
    port: service.port(),
  }),
);
