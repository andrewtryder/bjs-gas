import "./prisma-engine.ts";
import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";
import service from "./service.ts";

const { db } = service.load();
const { collectorSecret } = service.input();

const prisma = createPrismaClient(db.url);
const app = createApp({
  prisma,
  collectorSecret: collectorSecret.expose(),
});

Bun.serve({
  port: service.port(),
  hostname: "0.0.0.0",
  fetch: app.fetch,
});

console.log(
  JSON.stringify({
    event: "bjs_gas_api_started",
    port: service.port(),
  }),
);
