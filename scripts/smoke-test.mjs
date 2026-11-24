#!/usr/bin/env node
/**
 * Post-deployment smoke test, revision verification, and bounded stale-collection refresh for bjs-gas.
 *
 * Usage:
 *   node scripts/smoke-test.mjs \
 *     --api-url https://... \
 *     --web-url https://... \
 *     --expected-revision <short-sha> \
 *     [--refresh-if-stale] \
 *     [--allow-unhealthy-status]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const RETRY_DELAYS_MS = [1_000, 3_000, 5_000];
const STALENESS_ONLY_REASONS = new Set([
  "no_collection_run",
  "last_collection_stale",
  "latest_observation_stale",
  "fresh_stations_below_majority",
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, fetchFn = fetch, sleepFn = wait, init = undefined) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetchFn(url, {
        ...init,
        signal: init?.signal ?? AbortSignal.timeout(15_000),
      });
      if (res.status < 500 || attempt === RETRY_DELAYS_MS.length) {
        return res;
      }
    } catch (error) {
      lastError = error;
      if (attempt === RETRY_DELAYS_MS.length) throw error;
    }
    await sleepFn(RETRY_DELAYS_MS[attempt]);
  }
  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

function isStalenessOnlyFailure(status) {
  if (!status || status.healthy === true) return false;
  if (status.collectionLock?.stale === true || status.collectionLock?.overExpectedDuration === true) {
    return false;
  }
  const reasons = Array.isArray(status.unhealthyReasons) ? status.unhealthyReasons : [];
  return reasons.length > 0 && reasons.every((reason) => STALENESS_ONLY_REASONS.has(reason));
}

async function fetchFreshStatus(apiBase, fetchFn, sleepFn, bustCache = false) {
  const suffix = bustCache ? `?_cb=${Date.now()}` : "";
  const res = await fetchWithRetry(`${apiBase}/api/v1/status${suffix}`, fetchFn, sleepFn, {
    headers: { "cache-control": "no-cache" },
  });
  if (!res.ok) {
    return { ok: false, httpStatus: res.status, status: null };
  }
  const status = await res.json();
  return { ok: true, httpStatus: res.status, status };
}

async function waitForCollectionLockToClear({
  apiBase,
  fetchFn,
  sleepFn,
  pollIntervalMs,
  maxPollAttempts,
}) {
  let latestStatus = null;
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    await sleepFn(pollIntervalMs);
    const result = await fetchFreshStatus(apiBase, fetchFn, sleepFn, true);
    if (!result.ok) {
      return { cleared: false, error: `GET /api/v1/status returned HTTP ${result.httpStatus} while waiting for lock`, status: latestStatus };
    }
    latestStatus = result.status;
    if (latestStatus?.collectionLock?.inProgress !== true) {
      return { cleared: true, status: latestStatus };
    }
  }
  return {
    cleared: false,
    error: "Timed out waiting for in-progress collection lock to clear",
    status: latestStatus,
  };
}

export async function runSmokeTest({
  apiUrl,
  webUrl,
  expectedRevision,
  allowUnhealthyStatus = false,
  refreshIfStale = false,
  collectorSecret,
  fetchFn = fetch,
  sleepFn = wait,
  collectTimeoutMs = 120_000,
  pollIntervalMs = 5_000,
  maxPollAttempts = 12,
}) {
  const availabilityFailures = [];
  const apiBase = apiUrl.replace(/\/$/, "");
  const webBase = webUrl.replace(/\/$/, "");

  // 1. API /health + revision check
  let health;
  try {
    const res = await fetchWithRetry(`${apiBase}/health`, fetchFn, sleepFn);
    if (!res.ok) {
      availabilityFailures.push(`GET /health returned HTTP ${res.status}`);
    } else {
      health = await res.json();
      if (health?.ok !== true) availabilityFailures.push("/health ok !== true");
      if (health?.dirty !== false) {
        availabilityFailures.push(`/health dirty is ${String(health?.dirty)} (expected false)`);
      }
      if (expectedRevision && health?.revision !== expectedRevision) {
        availabilityFailures.push(
          `/health revision '${String(health?.revision)}' !== expected '${expectedRevision}'`,
        );
      }
    }
  } catch (err) {
    availabilityFailures.push(`GET /health error: ${err.message}`);
  }

  // 2. API /api/v1/stations (verifies DB connectivity & seeded data)
  let stationCount = 0;
  try {
    const res = await fetchWithRetry(`${apiBase}/api/v1/stations`, fetchFn, sleepFn);
    if (!res.ok) {
      availabilityFailures.push(`GET /api/v1/stations returned HTTP ${res.status}`);
    } else {
      const data = await res.json();
      stationCount = Array.isArray(data?.stations) ? data.stations.length : 0;
      if (stationCount === 0) {
        availabilityFailures.push("GET /api/v1/stations returned 0 stations");
      }
    }
  } catch (err) {
    availabilityFailures.push(`GET /api/v1/stations error: ${err.message}`);
  }

  // 3. Web frontend rendering & worker asset
  for (const route of ["/", "/map", "/maplibre-gl-worker.mjs"]) {
    try {
      const res = await fetchWithRetry(`${webBase}${route}`, fetchFn, sleepFn);
      if (!res.ok) {
        availabilityFailures.push(`Web GET ${route} returned HTTP ${res.status}`);
      } else if (route !== "/maplibre-gl-worker.mjs") {
        const body = await res.text();
        if (!body || body.trim().length === 0) {
          availabilityFailures.push(`Web GET ${route} returned empty body`);
        }
      }
    } catch (err) {
      availabilityFailures.push(`Web GET ${route} error: ${err.message}`);
    }
  }

  // 4. API /api/v1/status reachability
  let status = null;
  try {
    const statusRes = await fetchFreshStatus(apiBase, fetchFn, sleepFn, false);
    if (!statusRes.ok) {
      availabilityFailures.push(`GET /api/v1/status returned HTTP ${statusRes.httpStatus}`);
    } else {
      status = statusRes.status;
    }
  } catch (err) {
    availabilityFailures.push(`GET /api/v1/status error: ${err.message}`);
  }

  // Fail immediately on deployment availability, DB, revision, or frontend errors.
  if (availabilityFailures.length > 0) {
    return {
      ok: false,
      availabilityOk: false,
      failures: availabilityFailures,
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered: false,
      refreshStatus: "aborted_availability_failure",
    };
  }

  // 5. Collection freshness & operational health
  if (status?.healthy === true) {
    return {
      ok: true,
      availabilityOk: true,
      failures: [],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: true,
      refreshTriggered: false,
      refreshStatus: "not_needed",
    };
  }

  if (allowUnhealthyStatus && !refreshIfStale) {
    return {
      ok: true,
      availabilityOk: true,
      failures: [],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered: false,
      refreshStatus: "allowed_unhealthy",
    };
  }

  const reasons = Array.isArray(status?.unhealthyReasons) ? status.unhealthyReasons : [];
  if (!isStalenessOnlyFailure(status)) {
    return {
      ok: false,
      availabilityOk: true,
      failures: [
        `GET /api/v1/status healthy=${String(status?.healthy)} reasons=${reasons.join(",") || "none"}`,
      ],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered: false,
      refreshStatus: "skipped_unhealthy_non_stale",
    };
  }

  if (!refreshIfStale) {
    return {
      ok: false,
      availabilityOk: true,
      failures: [
        `GET /api/v1/status healthy=${String(status?.healthy)} reasons=${reasons.join(",")}`,
      ],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered: false,
      refreshStatus: "stale_refresh_disabled",
    };
  }

  let refreshTriggered = false;
  let refreshStatus = "failed";

  // Respect an already-running collection before triggering another.
  if (status?.collectionLock?.inProgress === true) {
    const waitResult = await waitForCollectionLockToClear({
      apiBase,
      fetchFn,
      sleepFn,
      pollIntervalMs,
      maxPollAttempts,
    });
    if (!waitResult.cleared) {
      return {
        ok: false,
        availabilityOk: true,
        failures: [waitResult.error],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: waitResult.status?.healthy ?? status?.healthy ?? null,
        refreshTriggered: false,
        refreshStatus: "lock_timeout",
      };
    }
    status = waitResult.status;
    if (status?.healthy === true) {
      return {
        ok: true,
        availabilityOk: true,
        failures: [],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: true,
        refreshTriggered: false,
        refreshStatus: "waited_for_lock",
      };
    }
    if (!isStalenessOnlyFailure(status)) {
      const postLockReasons = Array.isArray(status?.unhealthyReasons) ? status.unhealthyReasons : [];
      return {
        ok: false,
        availabilityOk: true,
        failures: [
          `GET /api/v1/status healthy=${String(status?.healthy)} reasons=${postLockReasons.join(",") || "none"}`,
        ],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: status?.healthy ?? null,
        refreshTriggered: false,
        refreshStatus: "skipped_unhealthy_non_stale",
      };
    }
  }

  if (!collectorSecret) {
    return {
      ok: false,
      availabilityOk: true,
      failures: [
        `Collection is stale (${reasons.join(",")}) and refresh-if-stale is enabled, but COLLECTOR_SECRET is not set`,
      ],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered: false,
      refreshStatus: "missing_collector_secret",
    };
  }

  // Trigger a single bounded, authenticated collection refresh.
  try {
    refreshTriggered = true;
    const collectRes = await fetchFn(`${apiBase}/internal/collect`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${collectorSecret}`,
      },
      signal: AbortSignal.timeout(collectTimeoutMs),
    });

    if (collectRes.status === 409) {
      const waitResult = await waitForCollectionLockToClear({
        apiBase,
        fetchFn,
        sleepFn,
        pollIntervalMs,
        maxPollAttempts,
      });
      if (!waitResult.cleared) {
        return {
          ok: false,
          availabilityOk: true,
          failures: [waitResult.error],
          revision: health?.revision ?? null,
          dirty: health?.dirty ?? null,
          stationCount,
          healthy: waitResult.status?.healthy ?? null,
          refreshTriggered,
          refreshStatus: "lock_timeout",
        };
      }
      status = waitResult.status;
      refreshStatus = "waited_for_lock";
    } else if (collectRes.status === 429) {
      return {
        ok: false,
        availabilityOk: true,
        failures: ["POST /internal/collect rate-limited (HTTP 429)"],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: status?.healthy ?? null,
        refreshTriggered,
        refreshStatus: "rate_limited",
      };
    } else if (!collectRes.ok) {
      return {
        ok: false,
        availabilityOk: true,
        failures: [`POST /internal/collect failed with HTTP ${collectRes.status}`],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: status?.healthy ?? null,
        refreshTriggered,
        refreshStatus: "failed",
      };
    } else {
      refreshStatus = "refreshed";
    }
  } catch (err) {
    return {
      ok: false,
      availabilityOk: true,
      failures: [`POST /internal/collect error: ${err.message}`],
      revision: health?.revision ?? null,
      dirty: health?.dirty ?? null,
      stationCount,
      healthy: status?.healthy ?? null,
      refreshTriggered,
      refreshStatus: "failed",
    };
  }

  // Recheck status after refresh (cache-busted; allow bounded settle if CDN s-maxage=15 hasn't rolled).
  const recheckAttempts = 3;
  for (let attempt = 0; attempt < recheckAttempts; attempt += 1) {
    try {
      const recheck = await fetchFreshStatus(apiBase, fetchFn, sleepFn, true);
      if (!recheck.ok) {
        return {
          ok: false,
          availabilityOk: true,
          failures: [`Post-refresh GET /api/v1/status returned HTTP ${recheck.httpStatus}`],
          revision: health?.revision ?? null,
          dirty: health?.dirty ?? null,
          stationCount,
          healthy: null,
          refreshTriggered,
          refreshStatus: "failed",
        };
      }
      status = recheck.status;
      if (status?.healthy === true) {
        return {
          ok: true,
          availabilityOk: true,
          failures: [],
          revision: health?.revision ?? null,
          dirty: health?.dirty ?? null,
          stationCount,
          healthy: true,
          refreshTriggered,
          refreshStatus,
        };
      }
    } catch (err) {
      return {
        ok: false,
        availabilityOk: true,
        failures: [`Post-refresh GET /api/v1/status error: ${err.message}`],
        revision: health?.revision ?? null,
        dirty: health?.dirty ?? null,
        stationCount,
        healthy: null,
        refreshTriggered,
        refreshStatus: "failed",
      };
    }

    if (attempt < recheckAttempts - 1 && isStalenessOnlyFailure(status)) {
      await sleepFn(pollIntervalMs);
    } else {
      break;
    }
  }

  const finalReasons = Array.isArray(status?.unhealthyReasons) ? status.unhealthyReasons : [];
  return {
    ok: false,
    availabilityOk: true,
    failures: [
      `GET /api/v1/status remained unhealthy after bounded refresh: healthy=${String(status?.healthy)} reasons=${finalReasons.join(",") || "none"}`,
    ],
    revision: health?.revision ?? null,
    dirty: health?.dirty ?? null,
    stationCount,
    healthy: status?.healthy ?? null,
    refreshTriggered,
    refreshStatus: "failed",
  };
}

function parseArgs(argv) {
  const args = { allowUnhealthyStatus: false, refreshIfStale: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api-url") args.apiUrl = argv[++i];
    else if (arg === "--web-url") args.webUrl = argv[++i];
    else if (arg === "--expected-revision") args.expectedRevision = argv[++i];
    else if (arg === "--allow-unhealthy-status") args.allowUnhealthyStatus = true;
    else if (arg === "--refresh-if-stale") args.refreshIfStale = true;
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.apiUrl || !args.webUrl) {
    console.error(
      "Usage: node scripts/smoke-test.mjs --api-url <url> --web-url <url> [--expected-revision <sha>] [--refresh-if-stale] [--allow-unhealthy-status]",
    );
    process.exit(1);
  }
  const result = await runSmokeTest({
    ...args,
    collectorSecret: process.env.COLLECTOR_SECRET,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
}
