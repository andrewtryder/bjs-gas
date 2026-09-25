#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, copyFileSync } from "node:fs";
import path from "node:path";

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function gitShortSha() {
  const git = spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    encoding: "utf8",
  });
  return git.status === 0 ? git.stdout.trim() : "dev";
}

function gitWorktreeDirty() {
  const status = spawnSync("git", ["status", "--porcelain"], {
    encoding: "utf8",
  });
  if (status.status !== 0) return true;
  return status.stdout.trim().length > 0;
}

let dirty = false;
let revision = process.env.BUILD_REVISION;
if (!revision) {
  const sha = gitShortSha();
  dirty = gitWorktreeDirty();
  revision = dirty ? `${sha}-dirty` : sha;
} else {
  dirty = revision.endsWith("-dirty") || process.env.BUILD_DIRTY === "true";
}

const defines = [
  `process.env.BUILD_REVISION=${JSON.stringify(revision)}`,
  `process.env.BUILD_DIRTY=${JSON.stringify(dirty ? "true" : "false")}`,
];

run("bun", [
  "build",
  "src/server.ts",
  "--target=bun",
  "--outfile",
  "dist/server.mjs",
  ...defines.flatMap((d) => ["--define", d]),
]);

run("node", ["scripts/copy-prisma-engine.mjs"]);

const dataDir = path.join("dist", "data");
mkdirSync(dataDir, { recursive: true });
for (const file of ["gas-clubs.json", "clubs.json", "gas-station-aliases.json"]) {
  copyFileSync(path.join("data", file), path.join(dataDir, file));
}

console.log(JSON.stringify({ event: "build_api_complete", revision, dirty }));
