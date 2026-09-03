import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

/**
 * Prisma Compute runs Bun on Linux. When the Client is bundled, absolute
 * generate-time paths do not exist on the VM — point at the engine we ship
 * next to server.mjs (see build:api).
 */
if (platform() === "linux") {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const name = "libquery_engine-debian-openssl-3.0.x.so.node";
  const candidates = [
    path.join(here, name),
    path.join(here, "..", name),
    path.join(process.cwd(), name),
    path.join(process.cwd(), "bundle", name),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = candidate;
      break;
    }
  }
}
