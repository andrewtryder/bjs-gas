import { module } from "@prisma/composer";
import { envSecret, rawPostgres } from "@prisma/composer-prisma-cloud";
import { cronScheduler } from "@prisma/composer-prisma-cloud/cron";
import { schedule } from "./src/schedule.ts";
import apiService from "./src/service.ts";
import webService from "./web/src/service.ts";

export default module("bjs-gas", ({ provision }) => {
  // Platform-managed Prisma Postgres; connection injected via service.load().
  // Provision ids must be alphanumeric only ([A-Za-z0-9]), min length 3.
  const db = provision(rawPostgres({ name: "database" }));
  const api = provision(apiService, {
    id: "bjsgasapi",
    deps: { db },
    input: {
      collectorSecret: envSecret("COLLECTOR_SECRET"),
      honeybadgerApiKey: envSecret("HONEYBADGER_API_KEY"),
    },
  });
  provision(webService, {
    id: "bjsgasweb",
    deps: { api },
    input: {
      cartoApiKey: envSecret("CARTO_API_KEY"),
      honeybadgerApiKey: envSecret("HONEYBADGER_API_KEY"),
    },
  });
  provision(cronScheduler(), {
    id: "scheduler",
    deps: { trigger: api.trigger },
    input: { jobs: [...schedule.jobs] },
  });
});
