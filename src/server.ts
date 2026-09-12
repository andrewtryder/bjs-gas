import "./prisma-engine.ts";
import { createApp } from "./app.ts";
import { createPrismaClient } from "./db.ts";
import { initApiHoneybadger } from "./honeybadger.ts";
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
