# Repository & Release Guidelines for Agents

All agents and contributors working in `bjs-gas` must adhere to these established operational workflows.

## Mandatory Release Discipline

Whenever changing code or deploying updates, always follow this order:

```
implement
  ↓
test / typecheck / build
  ↓
commit
  ↓
push to GitHub
  ↓
deploy to Prisma Compute
  ↓
production smoke test
```

### Pre-Deployment Checks
Always validate locally before deploying:
```bash
pnpm typecheck
pnpm test
pnpm run build
```

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
