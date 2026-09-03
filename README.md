# bjs-gas

Hourly BJ's Wholesale Club fuel-price collector.

**Prisma owns Postgres + collection + the read API.**  
**Cloudflare only schedules** (and will later host a frontend that calls HTTP).

```
Cloudflare Cron Worker (hourly)
        |
        |  POST /internal/collect  + Bearer COLLECTOR_SECRET
        v
Prisma Compute  (bjs-gas-api)
        |
        +-- fetch eisapi fuel prices (bundled gas-clubs.json)
        +-- Zod validate / normalize (exact 3-decimal strings)
        +-- one bulk SQL write (JSONB → history-on-change + current upsert)
        +-- GET /api/v1/stations*  (future frontend)
        v
Prisma Postgres
```

## Why Cloudflare has no `DATABASE_URL`

The hard boundary is intentional:

- All SQL runs inside Prisma Compute (or local Prisma tooling).
- Cloudflare must never import Prisma Client / `pg` / Kysely / Drizzle.
- The eventual map UI will consume **HTTP/JSON** (and CDN cache), not Postgres.

Composer injects the colocated Postgres URL via `rawPostgres()` → `service.load().db.url`.  
`DATABASE_URL` / `DATABASE_URL_POOLED` are **reserved** platform names; do not bind them with `envSecret`.

## Layers

| Layer | Owner | Notes |
| --- | --- | --- |
| Discovery | Local (Playwright + Chrome) | Infrequent admin task. Locator is authoritative for membership + `hasGas`. Writes **candidates**; promote via diff/accept. |
| Sitemap canary | Local HTTP | `pnpm discover:sitemap-canary` — alert on **new** SEO IDs only. Never authoritative. |
| Collection | Prisma Compute | Poll every entry in bundled `gas-clubs.json` via eisapi. Prices only — not topology. |
| Persistence | Prisma Compute | Bulk CTE: insert history only when `price IS DISTINCT FROM`; upsert current. |
| API | Prisma Compute | `/health`, `/internal/collect`, `/api/v1/stations…` |
| Trigger | Cloudflare Worker | Cron `0 * * * *` UTC → authenticated POST only. |
| Frontend | Cloudflare (future) | Calls Prisma HTTP; no DB credentials. |

## DISCOVERY DATA SEMANTICS

The BJ's **locator** discovery output is authoritative for location membership and `hasGas`.

Do **not** infer production gas-club membership from the fuel API.

The following are **NOT** evidence that a club is non-gas:

- HTTP 200 with `fuelPriceResponse.data = []`
- absence from BJ's sitemap
- a temporarily incomplete/thin club HTML page
- a temporary fetch failure

Known behavior proves `data: []` can represent:

- an actual gas station with no current prices
- a non-gas warehouse
- a distribution center
- an invalid club ID

Therefore the hourly collector **MUST** poll every entry in `data/gas-clubs.json`, including stations that previously returned zero fuels.

If a configured gas station repeatedly returns zero fuels:

- log/measure the condition
- preserve existing current prices
- do **not** remove it from the polling list
- do **not** change `Club.hasGas`

Only a future authoritative locator discovery → `discovery:accept` → `import:clubs` may change `hasGas`.

Registry roles:

| File | Role |
| --- | --- |
| `data/clubs.json` | Authoritative discovered location registry |
| `data/gas-clubs.json` | Authoritative hourly poll list |
| Sitemap | Supplementary change detector only |

## Local scripts (pnpm)

```bash
pnpm discover                 # Playwright → data/*.candidate.json (does not overwrite registry)
pnpm discovery:diff           # Compare candidate vs clubs.json (exit 1 if removals)
pnpm discovery:accept         # Promote candidate → clubs.json + gas-clubs.json
pnpm discovery:accept -- --force   # After manual review of loud removals WARNING
pnpm import:clubs             # Bulk upsert DB from authoritative clubs.json (never deletes)
pnpm discover:sitemap-canary  # Alert if sitemap has IDs missing from clubs.json
pnpm collect:club -- 189
pnpm collect:once
pnpm collect:once -- --dry-run
pnpm probe:sitemap            # Full sitemap investigation artifact (research)
pnpm test
pnpm test:integration
pnpm run build:api
pnpm run deploy:compute
pnpm run deploy:trigger
```

**Discovery (maintenance only):**

`POST https://api.bjs.com/digital/live/api/v1.2/club/search/10201`  
Requires Playwright + real Chrome. Do **not** run this from Prisma Compute.

**Fuel (production):**

`GET https://eisapi.bjs.com/api/v1/fuelprice/clubnum/{clubNumber}`  
Plain `fetch` works; no cookies / special headers required.

## Price semantics

- BJ's values like `3.919` are stored as PostgreSQL `NUMERIC(6,3)`.
- Application code normalizes to decimal **strings** before compare/persist — never IEEE floats.
- History rows are **price-change events**, not hourly snapshots.
- Unchanged price → update `observedAt` / metadata on current; **no** history row.
- `priceDateTime` from BJ's has no timezone → stored as local datetime **text** (`sourcePriceAtLocal`).
- Our `observedAt` is always UTC ISO-8601; one value per collection run.

## Bulk persistence

Successful collections pass the full observation batch as **one JSONB parameter** into a single data-modifying CTE (`jsonb_to_recordset` → history insert → current upsert). Parameterized only — never string-interpolated SQL.

## Environment ownership

| Where | Variables |
| --- | --- |
| Local / Prisma CLI | `PRISMA_SERVICE_TOKEN`, `PRISMA_WORKSPACE_ID`, `DATABASE_URL` (CLI migrate/import), `COLLECTOR_SECRET` (local collect tests) |
| Prisma Compute | `COLLECTOR_SECRET` (via `envSecret`); Postgres URL from `rawPostgres()` / `service.load().db.url` (platform-managed) |
| Cloudflare trigger | `COLLECTOR_SECRET`, `PRISMA_COLLECT_URL` |
| Cloudflare frontend (future) | No DB secret |

Never commit `.env`, `.dev.vars`, or secret values.

## Prisma deploy

```bash
pnpm run build:api
# requires alchemy@2.0.0-beta.74 + PRISMA_SERVICE_TOKEN + COLLECTOR_SECRET in env
pnpm dlx @prisma/cli@latest deploy module.ts --name bjs-gas --yes
pnpm dlx prisma@6.19.3 migrate deploy   # against DATABASE_URL for the Composer DB
pnpm import:clubs
```

Compute entry ships `dist/server.mjs` **plus** the Linux Prisma query engine (`debian-openssl-3.0.x`) because Compute runs Bun on Linux.

Public Compute URL:

`https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build`

## Cloudflare trigger

```bash
cd cloudflare-trigger
pnpm install
printf '%s' "$COLLECTOR_SECRET" | pnpm exec wrangler secret put COLLECTOR_SECRET
pnpm exec wrangler deploy
```

Cron: `0 * * * *` (UTC). Worker is ~2 KiB; no database packages.

## Updating club discovery

1. `pnpm discover` (Playwright) → writes `data/*.candidate.json` only.
2. `pnpm discovery:diff` — review adds/removes/hasGas flips. Removals are a loud WARNING and block accept.
3. `pnpm discovery:accept` (or `--force` after review).
4. `pnpm import:clubs` — upserts Postgres; **never deletes** clubs omitted from a run.
5. Rebuild + redeploy Compute so the **bundled** `gas-clubs.json` updates.
6. Optionally `pnpm discover:sitemap-canary` between full discovers (new SEO IDs → run full discover). See [docs/sitemap-discovery-investigation.md](docs/sitemap-discovery-investigation.md).

## Failure handling

- Per-club timeout ~8–10s; retries on 429/5xx/network (max 2 retries) with backoff + jitter.
- One club failure never aborts the run; existing current prices are preserved.
- Empty fuel arrays are treated as **fetch/station failures for that hour**: preserve `FuelPriceCurrent`, do **not** change `hasGas`, do **not** drop from `gas-clubs.json`.
- `degraded: true` if >20% of configured clubs fail; explicit warning if ≥80% fail.
- Concurrent collect → `409` (in-process single-flight). This guard is per Compute process only; it does not coordinate across horizontally scaled replicas. Revisit distributed locking if production ever runs multiple concurrent collect workers.

## Future frontend

Call:

- `GET /api/v1/status` — collection health + freshness (public; Cache-Control ~60s)
- `GET /api/v1/stations` (Cache-Control ~5–15 minutes)
- `GET /api/v1/stations/:clubNumber`
- `GET /api/v1/stations/:clubNumber/history` (capped)

`/health` is liveness only (no DB). Prefer `/api/v1/status` for ops: last run age under 90m, hard failures under 20%, majority of priced stations fresh within 90m, `databaseQueries: 1`. Empty-fuel clubs are counted separately from hard failures.

Behind Cloudflare CDN/cache. Never give the browser or Workers a `DATABASE_URL`.

## Expected scale (illustrative)

- ~720 Compute collect invocations / month
- ~159k upstream BJ's fuel HTTP requests / month (221 × 24 × 30)
- ~720 primary bulk SQL ops / month (plus reads/migrations/admin)
