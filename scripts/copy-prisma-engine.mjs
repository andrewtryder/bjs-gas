import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engineName = "libquery_engine-debian-openssl-3.0.x.so.node";

function engineCandidates(startDir) {
  const candidates = [];
  let current = startDir;

  while (true) {
    candidates.push(path.join(current, ".prisma", "client", engineName));
    candidates.push(path.join(current, "node_modules", ".prisma", "client", engineName));

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return [...new Set(candidates)];
}

function findEngine() {
  let clientPkgDir;
  try {
    clientPkgDir = path.dirname(require.resolve("@prisma/client/package.json"));
  } catch (error) {
    throw new Error(
      `Could not resolve @prisma/client/package.json while locating ${engineName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const candidates = engineCandidates(clientPkgDir);
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `Could not find ${engineName} relative to @prisma/client at ${clientPkgDir}. Checked:\n${candidates
      .map((candidate) => `- ${candidate}`)
      .join("\n")}`,
  );
}

mkdirSync("dist", { recursive: true });
const src = findEngine();
const dest = path.join("dist", engineName);
copyFileSync(src, dest);
console.log(`Copied Prisma engine -> ${dest}`);
