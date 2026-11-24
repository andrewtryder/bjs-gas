import { appRoot } from "@prisma/composer";
import { rawPostgres, variable } from "@prisma/composer-prisma-cloud";
import { cronScheduler } from "@prisma/composer-prisma-cloud/cron";
import { schedule } from "./src/schedule.ts";
import apiService from "./src/service.ts";
import webService from "./web/src/service.ts";

export default appRoot("bjs-gas", ({ provision }) => {
  // Keep all provision ids stable across Composer upgrades.
  const db = provision(rawPostgres({ name: "database" }));
  const collectorSecret = provision(variable.secret({ name: "COLLECTOR_SECRET" }));
  const honeybadgerApiKey = provision(variable.secret({ name: "HONEYBADGER_API_KEY" }));
  const cartoApiKey = provision(variable.secret({ name: "CARTO_API_KEY" }));

  const api = provision(apiService, {
    id: "bjsgasapi",
    deps: { db },
    input: {
      collectorSecret,
      honeybadgerApiKey,
    },
  });
  provision(webService, {
    id: "bjsgasweb",
    deps: { api: api.http },
    input: {
      cartoApiKey,
      honeybadgerApiKey,
    },
  });
  provision(cronScheduler(), {
    id: "scheduler",
    deps: { trigger: api.trigger },
    input: { jobs: [...schedule.jobs] },
  });
});
