# bjs-gas

Hourly BJ's Wholesale Club fuel-price collector and public map UI.

**Prisma Composer owns Postgres, the collector API, the native cron scheduler, and the Next.js web app.**

```
Prisma cronScheduler (every 60m)
        |
        |  POST /rpc/trigger  { jobId: "collect" }
        v
Prisma Compute API  (bjsgasapi)
        |
        +-- fetch eisapi fuel prices (bundled gas-clubs.json)
        +-- Zod validate / normalize (exact 3-decimal strings)
        +-- one bulk SQL write (JSONB → history-on-change + current upsert)
        +-- GET /api/v1/status | /api/v1/stations* | /api/v1/analytics*
        v
Prisma Postgres
        ^
Prisma Compute Web (bjsgasweb)  --HTTP-->  API (cache: "no-store" from the app)
```

Cloudflare is **not** the production scheduler. Earlier Worker-based triggers were removed when the app moved to Prisma-native cron (`defineSchedule` + `cronScheduler` + `serveSchedule`).

## Why the web/API boundary exists

- All SQL runs inside the API Compute service (or local Prisma tooling).
- The web service never imports Prisma Client / `pg` / Kysely / Drizzle.
- The map UI consumes **HTTP/JSON** only.

Composer injects the colocated Postgres URL via `rawPostgres()` → `service.load().db.url`.  
`DATABASE_URL` / `DATABASE_URL_POOLED` are **reserved** platform names; do not bind them with `envSecret`.

## Layers

| Layer | Owner | Notes |
| --- | --- | --- |
| Discovery | Local (Playwright + Chrome) | Infrequent admin task. Locator is authoritative for membership + `hasGas`. Writes **candidates**; promote via diff/accept. |
| Sitemap canary | Local HTTP | `pnpm discover:sitemap-canary` — alert on **new** SEO IDs only. Never authoritative. |
| Collection | Prisma Compute API | Poll every entry in bundled `gas-clubs.json` via eisapi. Prices only — not topology. |
| Persistence | Prisma Compute API | Bulk CTE: insert history only when `price IS DISTINCT FROM`; upsert current (`observedAt` always advances). |
| API | Prisma Compute | `/health`, `/internal/collect`, `/api/v1/*`, `/rpc/trigger` |
| Scheduler | Prisma `cronScheduler` | Hourly `collect` job → authenticated peer RPC to the API |
| Frontend | Prisma Compute (Next.js) | Calls API over HTTP; no DB credentials |

## DISCOVERY DATA SEMANTICS

The BJ's **locator** discovery output is authoritative for location membership and `hasGas`.

Do **not** infer production gas-club membership from the fuel API.

The following are **NOT** evidence that a club is non-gas:

- HTTP 200 with `fuelPriceResponse.data = []`
- absence from BJ's sitemap
- a temporarily incomplete/thin club HTML page
- a temporary fetch failure

Therefore the hourly collector **MUST** poll every entry in `data/gas-clubs.json`, including stations that previously returned zero fuels.

If a configured gas station repeatedly returns zero fuels:

- log/measure the condition
- preserve existing current prices
- do **not** remove it from the polling list
- do **not** change `Club.hasGas`

Only a future authoritative locator discovery → `discovery:accept` → `import:clubs` may change `hasGas`.

## Local scripts (pnpm)

```bash
pnpm discover                 # Playwright → data/*.candidate.json
pnpm discovery:diff
pnpm discovery:accept
pnpm import:clubs
pnpm discover:sitemap-canary
pnpm collect:club -- 189
pnpm collect:once             # local collect against DATABASE_URL
pnpm collect:once -- --dry-run
pnpm test
pnpm test:integration
pnpm run build                # API + web
pnpm run deploy:compute       # build + prisma-composer deploy of module.ts
```

**Fuel (production):**

`GET https://eisapi.bjs.com/api/v1/fuelprice/clubnum/{clubNumber}`  
Plain `fetch` works; no cookies / special headers required.

## Scheduler + collection flow

1. `src/schedule.ts` defines `defineSchedule({ collect: "60m" })`.
2. `module.ts` provisions `cronScheduler()` with `deps: { trigger: api.trigger }` and `input: { jobs: [...schedule.jobs] }`.
3. `src/service.ts` exposes `{ trigger: triggerContract }`.
4. `src/server.ts` mounts `serveSchedule(...)` at `/rpc/*` and runs `runCollection` for job `collect`.
5. First tick is after one interval (`setInterval` semantics), not immediately on boot.

### Manual collection

```bash
# Against production API (requires COLLECTOR_SECRET)
curl -X POST \
  -H "Authorization: Bearer $COLLECTOR_SECRET" \
  https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build/internal/collect

# Or locally against DATABASE_URL
pnpm collect:once
```

### Inspect health / freshness

```bash
curl -sS https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build/health
curl -sS https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build/api/v1/status | jq
```

Expected healthy signals:

- `lastSuccessfulCollection.finishedAt` age **< 90 minutes**
- `fuelObservations` **> 0** on the latest usable run
- hard failures **< 20%** of configured clubs
- `freshness.stationsObservedRecently` ≈ majority of `clubsSucceeded`
- `collectionLock.inProgress` may be true briefly during a normal run
- `/health.revision` matches the deployed git SHA with `dirty: false`

### Diagnose stale data

1. Check `/api/v1/status` → `unhealthyReasons` (`last_collection_stale`, `zero_fuel_observations`, `collection_over_expected_duration`, …).
2. A short `collectionLock.inProgress: true` is normal. Unhealthy only when `overExpectedDuration` / `stale` is true.
3. If `lastSuccessfulCollection` is old but lock is idle, the scheduler may not be reaching `/rpc/trigger` — redeploy the full Composer module (API + scheduler + web together).
4. Probe upstream without touching Postgres: `GET /internal/probe/fuel/:clubNumber` with collector auth.
5. Confirm `/health.revision` matches `git rev-parse --short HEAD` after a **clean** deploy. Dirty builds report `<sha>-dirty`.

## Price semantics

- BJ's values like `3.919` are stored as PostgreSQL `NUMERIC(6,3)`.
- Application code normalizes to decimal **strings** before compare/persist — never IEEE floats.
- History rows are **price-change events**, not hourly snapshots.
- Unchanged price → update `observedAt` / metadata on current; **no** history row.
- `priceDateTime` from BJ's has no timezone → stored as local datetime **text** (`sourcePriceAtLocal`).
- Our `observedAt` is always UTC ISO-8601; one value per collection run.

## Bulk persistence

Successful collections pass the full observation batch as **one JSONB parameter** into a single data-modifying CTE (`jsonb_to_recordset` → history insert → current upsert). Parameterized only — never string-interpolated SQL.

Empty observation arrays still insert a `CollectionRun` (so ops can see failed/empty hours) and leave `FuelPriceCurrent` untouched.

## Environment ownership

| Where | Variables |
| --- | --- |
| Local / Prisma CLI | `PRISMA_SERVICE_TOKEN`, `PRISMA_WORKSPACE_ID`, `DATABASE_URL`, `COLLECTOR_SECRET` |
| Prisma Compute API | `COLLECTOR_SECRET`, `HONEYBADGER_API_KEY` via `envSecret`; Postgres URL from `rawPostgres()` |
| Prisma Compute Web | `CARTO_API_KEY`, `HONEYBADGER_API_KEY` via `envSecret`; API origin from Composer HTTP dep |

Never commit `.env`, `.dev.vars`, or secret values.

## Prisma deploy (API + scheduler + web together)

```bash
# Requires a clean git worktree so /health.revision matches HEAD.
pnpm run deploy:compute
# Override only when intentional:
# ALLOW_DIRTY_DEPLOY=1 pnpm run deploy:compute

pnpm dlx prisma@6.19.3 migrate deploy   # against DATABASE_URL for the Composer DB
pnpm import:clubs                       # when registry changes
```

`pnpm run deploy:compute` runs `scripts/check-clean-tree.mjs`, then build, then Composer deploy.
Local `pnpm build` remains allowed on a dirty tree; revision becomes `<sha>-dirty`.

Compute API entry ships `dist/server.mjs` **plus** the Linux Prisma query engine (`debian-openssl-3.0.x`) because Compute runs Bun on Linux. `/health.revision` + `dirty` are baked in at `build:api` time.

Public Compute API URL:

`https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build`

## Updating club discovery

1. `pnpm discover` → `data/*.candidate.json` only.
2. `pnpm discovery:diff` — review adds/removes/hasGas flips.
3. `pnpm discovery:accept` (or `--force` after review).
4. `pnpm import:clubs` — upserts Postgres; **never deletes** clubs omitted from a run.
5. Rebuild + redeploy Compute so the **bundled** `gas-clubs.json` updates.
6. Optionally `pnpm discover:sitemap-canary` between full discovers.

## Failure handling

- Per-club timeout ~8–10s; retries on 429/5xx/network (max 2 retries) with backoff + jitter.
- Collection-scoped `AbortSignal` cancels in-flight fetches/retries when the 12m hard deadline expires; the process-local lock is released only after that work settles.
- One club failure never aborts the run; existing current prices are preserved.
- Empty fuel arrays preserve `FuelPriceCurrent`, do **not** change `hasGas`, do **not** drop from `gas-clubs.json`.
- `degraded: true` if >20% of configured clubs fail; explicit warning if ≥80% fail.
- Zero observations / hard-failure ratio / stale last usable run → `/api/v1/status` reports `healthy: false` with actionable `unhealthyReasons`.
- Concurrent collect → `409` (in-process single-flight). The lock is never auto-cleared while live work may still run.
- Aborted collections persist a failure `CollectionRun` (`collection_aborted: …`) so status does not keep showing only an older success.
- The in-process lock does not coordinate across horizontally scaled replicas.

## Caching

- Web client fetches use `cache: "no-store"`.
- `/api/v1/status`: short CDN TTL (~15s).
- `/api/v1/stations*`: ~5 minute `s-maxage` (collector is hourly).
- Analytics endpoints: moderate TTL with `stale-while-revalidate`.

## Expected scale (illustrative)

- ~720 Compute collect invocations / month
- ~159k upstream BJ's fuel HTTP requests / month (≈214 × 24 × 30)
- ~720 primary bulk SQL ops / month (plus reads/migrations/admin)
