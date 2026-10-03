import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const ENGINE_NAME = "libquery_engine-debian-openssl-3.0.x.so.node";

export function findEngine() {
  const searchedPaths = [];
  try {
    const clientPkg = path.dirname(require.resolve("@prisma/client/package.json"));
    // @prisma/client is scoped under @prisma/, so grandparent is the package's enclosing node_modules
    const candidates = [
      path.resolve(clientPkg, "..", "..", ".prisma", "client", ENGINE_NAME),
      path.resolve(clientPkg, "..", ".prisma", "client", ENGINE_NAME),
      path.resolve(clientPkg, ".prisma", "client", ENGINE_NAME),
    ];
    for (const c of candidates) {
      searchedPaths.push(c);
      if (existsSync(c)) return c;
    }
  } catch (err) {
    searchedPaths.push(`@prisma/client resolution failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Check top-level node_modules/.prisma/client
  const rootPrisma = path.resolve(process.cwd(), "node_modules", ".prisma", "client", ENGINE_NAME);
  searchedPaths.push(rootPrisma);
  if (existsSync(rootPrisma)) return rootPrisma;

  // Check prisma CLI package directory
  try {
    const prismaPkg = path.dirname(require.resolve("prisma/package.json"));
    const prismaEngine = path.join(prismaPkg, ENGINE_NAME);
    searchedPaths.push(prismaEngine);
    if (existsSync(prismaEngine)) return prismaEngine;
  } catch {}

  // Dynamic pnpm layout scan without version hardcoding
  try {
    const pnpmDir = path.resolve(process.cwd(), "node_modules", ".pnpm");
    if (existsSync(pnpmDir)) {
      const entries = readdirSync(pnpmDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("@prisma+client@")) {
          const candidate = path.join(pnpmDir, entry.name, "node_modules", ".prisma", "client", ENGINE_NAME);
          searchedPaths.push(candidate);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  } catch {}

  throw new Error(
    `Could not locate Prisma query engine '${ENGINE_NAME}'.\nSearched paths:\n${searchedPaths.map((p) => `  - ${p}`).join("\n")}\nEnsure 'prisma generate' has run.`,
  );
}

export function copyPrismaEngine(destDir = "dist") {
  mkdirSync(destDir, { recursive: true });
  const src = findEngine();
  const dest = path.join(destDir, ENGINE_NAME);
  copyFileSync(src, dest);
  if (!existsSync(dest) || statSync(dest).size < 1000) {
    throw new Error(`Engine verification failed: ${dest} is missing or empty`);
  }
  console.log(`Copied Prisma engine -> ${dest}`);
  return dest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  copyPrismaEngine();
}
