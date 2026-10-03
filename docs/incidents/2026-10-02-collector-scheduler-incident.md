# Incident Post-Mortem & Resolution Archive

**Incident Date:** 2026-10-02  
**Resolution Date:** 2026-10-03  
**Status:** CLOSED & FULLY RESOLVED  
**Final Production Recovery Revisions:** 
- `bb1aa39`: Upgrade Prisma Composer to 0.18.0 (Native scheduler KeepAwakeGuard fix)
- `b6136f4`: Safe single retry for pre-callback transaction acquisition failure (Stale pooled socket resilience)
- `cd4ee75`: Pool admission control and sequential status queries (Database pool exhaustion mitigation)

---

## 1. Executive Summary

Over an extended operational period, the BJ's gas price collection service experienced intermittent collection gaps and failures originating from three distinct structural root causes:
1. **Broken Autonomous Scheduling**: An orphaned Cloudflare Worker cron trigger was firing against `/internal/collect` while the native Prisma cron scheduler stalled due to serverless runtime idle suspension.
2. **Stale Connection Pool Socket Dropping**: In long idle periods between hourly cron executions (60 minutes with zero database queries), pooled TCP connections to PostgreSQL were dropped by upstream timeouts. Upon the next collection, `prisma.$transaction(...)` failed immediately with `"Server has closed the connection."`
3. **Database Connection Pool Exhaustion (P2024)**: Burst analytics traffic and parallel queries on `/api/v1/status` competed for a tightly bounded connection pool, occasionally triggering `P2024` errors.

All three failure modes have been permanently resolved, tested with comprehensive safety boundaries, and verified through live autonomous production execution.

---

## 2. Root Cause Analysis & Remediation

### A. Scheduler Stalling & Cloudflare Trigger Removal
* **Root Cause**: The Prisma scheduler compute instance entered idle sleep without waking for scheduled interval cron jobs (`KeepAwakeGuard` deficiency in Composer 0.16). Additionally, an obsolete Cloudflare worker (`bjs-gas-trigger`) configured with `0 * * * *` was still firing unauthenticated requests against `/internal/collect`.
* **Fix**:
  - Upgraded `@prisma/composer` and `@prisma/composer-prisma-cloud` from `0.16.0` to `0.18.0` ([PR #23](https://github.com/andrewtryder/bjs-gas/pull/23)).
  - Permanently deleted the orphaned Cloudflare Worker trigger `bjs-gas-trigger` via Cloudflare API.
  - Rotated `COLLECTOR_SECRET` in Prisma Cloud environment variables.
* **Proof**: First autonomous native cron collection fired cleanly via internal RPC `POST /rpc/trigger` (`jobId: "collect"`) without any external trigger.

### B. Safe Persistence Transaction Acquisition Retry
* **Root Cause**: After idling for 60 minutes, the pooled database connection severed. Transaction acquisition failed with `"Server has closed the connection."`
* **Commit-Ambiguity Safety Boundary**: Retrying whole operations blindly is unsafe because dropping a connection after PostgreSQL commits leads to ambiguous commit states and duplicate writes.
* **Fix ([PR #27](https://github.com/andrewtryder/bjs-gas/pull/27))**:
  - Implemented `isClosedConnectionError()`: matches structured Prisma error `P1017` and narrow message fallbacks (`Server has closed the connection`, `Connection terminated unexpectedly`). Fails closed on all other Prisma `Pxxxx` codes (`P1000`, `P2010`, `P2024`, `P2028`).
  - Added a single pre-callback retry: `attempt === 1 && !transactionEntered && isClosedConnectionError(error)`.
  - If the interactive transaction callback was entered (`transactionEntered === true`), retrying is strictly prohibited.
  - Outer watchdog timeout covers both acquisition attempts.
* **Proof**: Comprehensive unit test suite (`tests/persist-retry.test.ts`) verifies callback entry invariants and commit ambiguity prevention.

### C. Database Pool Admission Control
* **Root Cause**: High-concurrency requests to analytics and status endpoints exhausted the database connection pool (`P2024`).
* **Fix ([PR #24](https://github.com/andrewtryder/bjs-gas/pull/24))**:
  - Sequentialized queries on `/api/v1/status` to hold at most one connection at a time.
  - Implemented bounded concurrency limiter with queue depth and wait timeout on analytics queries (`src/api/limiter.ts`).
  - Added structured `P2024` error handling and 503 overload responses.

---

## 3. Production Verification & Milestone Metrics

* **First Proven Autonomous Successful Run**: `2026-10-03T01:09:24.884Z`
  - Fired autonomously 60m after boot via internal RPC.
  - 214 stations polled across 15 states in 5.52 seconds.
  - 208 successful club stations with fuel data; 6 expected clubs returned empty fuel arrays; 0 hard failures.
  - 511 fuel observations collected and persisted.
  - 12 price changes inserted into history atomically.
  - Telemetry: `collector_persistence_acquisition_attempt` -> `collector_persistence_transaction_entered` -> `collector_persistence_sql_complete` -> `cron_collection_complete`.
* **Production Concurrency Load Test**:
  - 20 parallel requests against `/api/v1/status` and `/api/v1/stations/:id`.
  - **Result**: `20/20 (100%) HTTP 200 OK`, **zero** `P2024` pool exhaustion errors.
* **Health & Freshness**:
  - `collectionLock`: `inProgress: false`, `stale: false`.
  - `freshStationRatio`: 97.2%.

---

## 4. Operational Backlog & Follow-Ups Completed

1. **Dependency & Security Audit Remediation ([PR #25](https://github.com/andrewtryder/bjs-gas/pull/25))**:
   - Upgraded `next` to 16.3.8, pinned `undici` and `fast-uri` overrides.
   - Configured audit ignore for unpatched `braces` GHSA-vfj7-8cjw-p6xm.
   - CI audit gate passed 100% clean.
2. **PostgreSQL Integration Tests in CI ([PR #26](https://github.com/andrewtryder/bjs-gas/pull/26))**:
   - Provisioned ephemeral `postgres:16-alpine` service container in GitHub Actions CI.
   - Added schema setup (`prisma db push --skip-generate`) and real Postgres integration test gate on every PR.
3. **External Monitoring Probe (`scripts/monitor-health.mjs`)**:
   - Added probe script checking 7 core operational invariants:
     1. `/health` HTTP 200 & `ok: true`
     2. `/api/v1/status` HTTP 200
     3. `healthy === true`
     4. `collectionLock.stale === false`
     5. `freshStationRatio >= 0.8`
     6. Successful collection within 90 minutes
     7. Latest observation within 90 minutes
