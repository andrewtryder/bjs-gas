import { defineSchedule } from "@prisma/composer-prisma-cloud/cron";

/**
 * Hourly collection schedule.
 * Fires every 60 minutes to poll BJ's station prices across configured clubs.
 */
export const schedule = defineSchedule({ collect: "60m" });
