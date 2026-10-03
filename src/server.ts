import "./prisma-engine.ts";
import { serveSchedule } from "@prisma/composer-prisma-cloud/cron";
import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";
import { initApiHoneybadger, reportApiError } from "./honeybadger.ts";
import { getCollectionLockState, runCollection } from "./collector.ts";
import { schedule } from "./schedule.ts";
import service from "./service.ts";

const { db } = service.load();
const input = service.input();
const collectorSecret = input.collectorSecret.expose();
const honeybadgerApiKey = input.honeybadgerApiKey?.expose();

if (honeybadgerApiKey) {
  initApiHoneybadger(honeybadgerApiKey);
}

const prisma = createPrismaClient(db.url);
const app = createApp({
  prisma,
  collectorSecret,
  ...(honeybadgerApiKey !== undefined ? { honeybadgerApiKey } : {}),
});

const cronHandler = serveSchedule(service, schedule, {
  collect: async () => {
    const lock = getCollectionLockState();
    if (lock.inProgress) {
      console.log(
        JSON.stringify({
          event: "cron_collection_skipped",
          reason: "in_progress",
          lockStartedAt: lock.startedAt,
          lockAgeMs: lock.ageMs,
        }),
      );
      return;
    }
    try {
      console.log(JSON.stringify({ event: "cron_collection_start", jobId: "collect" }));
      const result = await runCollection({ prisma });
      console.log(
        JSON.stringify({
          event: "cron_collection_complete",
          clubsPolled: result.clubsAttempted,
          clubsSucceeded: result.clubsSucceeded,
          clubsFailed: result.clubsFailed,
          observations: result.fuelObservations,
          historyChanges: result.historyChanges,
          durationMs: result.durationMs,
          degraded: result.degraded,
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
    // Prisma Composer RPC contract: POST /rpc/<method> (here: /rpc/trigger)
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
    scheduleJobs: schedule.jobs,
  }),
);
