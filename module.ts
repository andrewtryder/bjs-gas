import { appRoot } from "@prisma/composer";
import { envSecret, rawPostgres } from "@prisma/composer-prisma-cloud";
import { cronScheduler } from "@prisma/composer-prisma-cloud/cron";
import { schedule } from "./src/schedule.ts";
import apiService from "./src/service.ts";
import webService from "./web/src/service.ts";

export default appRoot("bjs-gas", ({ provision }) => {
  // Keep all provision ids stable across the Composer address migration.
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
    deps: { api: api.http },
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
