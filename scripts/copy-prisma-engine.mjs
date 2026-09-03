import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const engineName = "libquery_engine-debian-openssl-3.0.x.so.node";

function findEngine() {
  try {
    const clientPkg = path.dirname(require.resolve("@prisma/client/package.json"));
    const candidates = [
      path.join(clientPkg, "..", ".prisma", "client", engineName),
      path.join(clientPkg, ".prisma", "client", engineName),
    ];
    for (const c of candidates) {
      if (existsSync(c)) return c;
    }
  } catch {
    // fall through
  }
  const fallback = path.join(
    process.cwd(),
    "node_modules",
    ".pnpm",
  );
  // last-resort scan via known pnpm layout used in this repo
  const known = path.join(
    process.cwd(),
    "node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules/.prisma/client",
    engineName,
  );
  if (existsSync(known)) return known;
  throw new Error(`Could not find ${engineName} (looked under ${fallback})`);
}

mkdirSync("dist", { recursive: true });
const src = findEngine();
const dest = path.join("dist", engineName);
copyFileSync(src, dest);
console.log(`Copied Prisma engine -> ${dest}`);
