#!/usr/bin/env node
/**
 * Refuse production deploys from a dirty worktree so `/health.revision`
 * cannot claim a clean SHA for uncommitted code.
 *
 * Local `pnpm build` remains allowed when dirty (revision becomes `<sha>-dirty`).
 * Override only when explicitly needed: ALLOW_DIRTY_DEPLOY=1
 */
import { spawnSync } from "node:child_process";

if (process.env.ALLOW_DIRTY_DEPLOY === "1") {
  console.warn(
    JSON.stringify({
      event: "deploy_dirty_override",
      message: "ALLOW_DIRTY_DEPLOY=1 set; proceeding with dirty worktree",
    }),
  );
  process.exit(0);
}

const status = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });
if (status.status !== 0) {
  console.error("Unable to determine git worktree status; refusing deploy.");
  process.exit(1);
}

const dirty = status.stdout.trim();
if (dirty) {
  console.error(
    [
      "Refusing production deploy with a dirty git worktree.",
      "Commit (or stash) tracked/untracked project changes first so /health.revision matches HEAD.",
      "To override intentionally: ALLOW_DIRTY_DEPLOY=1 pnpm run deploy:compute",
      "",
      dirty,
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(0);
