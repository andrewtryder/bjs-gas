import { defineSchedule } from "@prisma/composer-prisma-cloud/cron";

/**
 * Fleet collection schedule — single source of truth for the Prisma cron module.
 * `defineSchedule({ collect: "120m" })` → `{ jobs: [{ jobId: "collect", every: "120m" }] }`.
 * The scheduler service fires `POST /rpc/trigger` with `{ jobId: "collect" }` on that interval.
 * First tick is after one interval (setInterval semantics), not immediately on boot.
 * Deploy/restart resets the next fire; do not assume wall-clock minutes.
 */
export const schedule = defineSchedule({ collect: "120m" });
