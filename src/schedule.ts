import { defineSchedule } from "@prisma/composer-prisma-cloud/cron";

/**
 * Hourly collection schedule — single source of truth for the Prisma cron module.
 * `defineSchedule({ collect: "60m" })` → `{ jobs: [{ jobId: "collect", every: "60m" }] }`.
 * The scheduler service fires `POST /rpc/trigger` with `{ jobId: "collect" }` on that interval.
 * First tick is after one interval (setInterval semantics), not immediately on boot.
 */
export const schedule = defineSchedule({ collect: "60m" });
