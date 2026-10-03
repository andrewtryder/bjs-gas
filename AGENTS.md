# Repository & Release Guidelines for Agents

All agents and contributors working in `bjs-gas` must adhere to these established operational workflows.

## Mandatory Release Discipline

Whenever changing code or deploying updates, always follow branch-based release discipline:

```
implement on branch
  ↓
test / typecheck / build
  ↓
push branch to GitHub
  ↓
open PR & verify GitHub Actions CI
  ↓
merge PR to main
  ↓
checkout & pull exact merged main
  ↓
deploy that exact main SHA to Prisma Compute
  ↓
production smoke test
```

This guarantees GitHub `main` always directly describes what production is running.

### Pre-Deployment Checks
Always validate locally before deploying:
```bash
pnpm --filter bjs-gas run lint
pnpm --filter bjs-gas run format:check
pnpm typecheck
pnpm test
pnpm test:integration
pnpm run build
```

`pnpm --filter bjs-gas run lint` is Biome (correctness/suspicious). `pnpm typecheck` remains the TypeScript coverage for core, deploy entrypoints, and web. Do not treat lint as a substitute for `tsc`. In this workspace, `pnpm lint` is not the root script (pnpm may treat it as a recursive/exec alias).

A repository-wide Biome format rewrite is deferred: a check-only run would change ~167 files (~67k lines), mostly CSS wrapping. Formatter enforcement currently covers `biome.json` only.

### Composer dependency pins
Root `alchemy@2.0.0-beta.74` and `effect@4.0.0-rc.112` are **not** application imports. They pin Prisma Composer's runtime graph (Composer 0.18 fails when the Effect constellation resolves incompatibly). `pnpm-workspace.yaml` `overrides` is the authoritative pin set, including `@prisma/config>effect` at 3.21.0 for Prisma CLI vs Composer Effect 4.

### Audit ignore
`GHSA-vfj7-8cjw-p6xm` remains ignored: transitive `braces@3.0.3` via `alchemy` → `fast-glob` → `micromatch`. Latest `braces` is still 3.0.3 (unpatched). CI still fails on any other high/critical advisory.

### Prisma agent skills
Canonical generated skill location is `.agents/skills/` (portable Agent Skills path). Sync with `pnpm skills:sync`, which passes `--config prisma.skills.config.ts` (`agents: ["agents"]` only).

Do **not** add `prisma.config.ts` while Prisma Client remains 6.x: `pnpm prisma generate` auto-loads that filename and cannot parse the CLI 8 `$prismaConfig` marker. Unconfigured `pnpm dlx @prisma/cli@8.0.0-rc.19 skills sync` still targets every harness and would recreate `.cursor/skills`, `.claude/skills`, and `.devin/skills` (gitignored).

### Synchronized Git Remote
- Never leave local `main` ahead of `origin/main`.
- If deployment happens before push for a technical or operational reason, the task is **not complete** until the exact deployed commit has been pushed to GitHub.
- At the end of every task, verify that the working tree is clean and `main` is synchronized:
```bash
git status --short
test "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)"
```

### Secrets & Security
- Never commit `.env` or print secret values (`CARTO_API_KEY`, `HONEYBADGER_API_KEY`, `COLLECTOR_SECRET`, etc.) in logs, diffs, terminal commands, or documentation.
- Production environment variables live in Prisma Cloud (`prisma project env`).
- Never force-push (`git push --force` or `--force-with-lease`) to `main`.
- Normal GitHub Actions CI must run without requiring production database or API credentials.
