#!/usr/bin/env node
/**
 * External monitoring probe for BJ's Gas Collector.
 *
 * Verifies 7 critical operational invariants:
 * 1. GET /health returns HTTP 200 and ok: true
 * 2. GET /api/v1/status returns HTTP 200
 * 3. healthy === true
 * 4. collectionLock.stale === false
 * 5. freshStationRatio >= 0.8
 * 6. lastSuccessfulCollection.startedAt within freshness window (default: 180m)
 * 7. freshness.latestObservedAt within freshness window (default: 180m)
 *
 * Usage:
 *   node scripts/monitor-health.mjs [API_BASE_URL]
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_API_URL = "https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build";
export const FALLBACK_MAX_STALENESS_MINUTES = 180;
export const MIN_FRESH_STATION_RATIO = 0.8;
export const TRANSIENT_REQUEST_ATTEMPTS = 3;
export const TRANSIENT_RETRY_DELAYS_MS = [1_000, 3_000];

function isTransientStatus(status) {
  return status >= 500 && status <= 599;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTransientRetry(url, fetchFn, sleepFn) {
  let transientRetries = 0;

  for (let attempt = 1; attempt <= TRANSIENT_REQUEST_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
      if (!isTransientStatus(response.status) || attempt === TRANSIENT_REQUEST_ATTEMPTS) {
        return { response, transientRetries };
      }
    } catch (error) {
      if (attempt === TRANSIENT_REQUEST_ATTEMPTS) throw error;
    }

    transientRetries += 1;
    await sleepFn(TRANSIENT_RETRY_DELAYS_MS[attempt - 1]);
  }

  throw new Error("Transient retry exhausted without a response");
}

export async function checkHealth(apiUrl = DEFAULT_API_URL, options = {}) {
  const targetUrl = (apiUrl || DEFAULT_API_URL).replace(/\/$/, "");
  const fetchFn = options.fetchFn || fetch;
  const sleepFn = options.sleepFn || wait;
  const now = options.now || Date.now();
  const failures = [];
  let transientRetries = 0;

  // Check 1: /health HTTP 200 & ok: true
  let healthJson;
  try {
    const { response: res, transientRetries: retries } = await fetchWithTransientRetry(
      `${targetUrl}/health`,
      fetchFn,
      sleepFn,
    );
    transientRetries += retries;
    if (!res.ok) {
      failures.push(`/health returned HTTP ${res.status}`);
    } else {
      healthJson = await res.json();
      if (!healthJson || healthJson.ok !== true) {
        failures.push(`/health response ok field is not true`);
      }
    }
  } catch (err) {
    failures.push(`/health request failed: ${err.message}`);
  }

  // Check 2: /api/v1/status HTTP 200
  let statusJson;
  try {
    const { response: res, transientRetries: retries } = await fetchWithTransientRetry(
      `${targetUrl}/api/v1/status`,
      fetchFn,
      sleepFn,
    );
    transientRetries += retries;
    if (!res.ok) {
      failures.push(`/api/v1/status returned HTTP ${res.status}`);
    } else {
      statusJson = await res.json();
    }
  } catch (err) {
    failures.push(`/api/v1/status request failed: ${err.message}`);
  }

  let maxStalenessMinutes = FALLBACK_MAX_STALENESS_MINUTES;

  if (statusJson) {
    maxStalenessMinutes =
      Number.isFinite(statusJson?.freshness?.freshWindowMinutes)
        ? statusJson.freshness.freshWindowMinutes
        : FALLBACK_MAX_STALENESS_MINUTES;

    // Check 3: healthy === true
    if (statusJson.healthy !== true) {
      failures.push(`Status is unhealthy. Reasons: ${(statusJson.unhealthyReasons || []).join(", ") || "none specified"}`);
    }

    // Check 4: collectionLock.stale === false
    if (statusJson.collectionLock?.stale === true) {
      failures.push(`Collection lock is marked stale (ageMs: ${statusJson.collectionLock.ageMs})`);
    }

    // Check 5: freshStationRatio >= 0.8
    const ratio = statusJson.freshness?.freshStationRatio;
    if (typeof ratio === "number" && ratio < MIN_FRESH_STATION_RATIO) {
      failures.push(`freshStationRatio (${(ratio * 100).toFixed(1)}%) is below threshold (${MIN_FRESH_STATION_RATIO * 100}%)`);
    }

    // Check 6: last successful collection within freshness window
    const lastStartedAt = statusJson.lastSuccessfulCollection?.startedAt;
    if (!lastStartedAt) {
      failures.push(`No lastSuccessfulCollection recorded`);
    } else {
      const elapsedMinutes = (now - new Date(lastStartedAt).getTime()) / 60_000;
      if (elapsedMinutes > maxStalenessMinutes) {
        failures.push(`Last successful collection occurred ${elapsedMinutes.toFixed(1)}m ago (exceeds ${maxStalenessMinutes}m threshold)`);
      }
    }

    // Check 7: latestObservedAt within freshness window
    const latestObservedAt = statusJson.freshness?.latestObservedAt;
    if (!latestObservedAt) {
      failures.push(`No latestObservedAt recorded in freshness`);
    } else {
      const elapsedMinutes = (now - new Date(latestObservedAt).getTime()) / 60_000;
      if (elapsedMinutes > maxStalenessMinutes) {
        failures.push(`Latest fuel observation is ${elapsedMinutes.toFixed(1)}m old (exceeds ${maxStalenessMinutes}m threshold)`);
      }
    }
  }

  if (failures.length > 0) {
    return {
      ok: false,
      alert: {
        event: "external_monitoring_alert",
        status: "FAIL",
        apiUrl: targetUrl,
        failureCount: failures.length,
        failures,
        timestamp: new Date(now).toISOString(),
      },
    };
  }

  return {
    ok: true,
    output: {
      event: "external_monitoring_ok",
      status: "PASS",
      apiUrl: targetUrl,
      revision: healthJson?.revision ?? statusJson?.revision ?? "unknown",
      healthy: statusJson?.healthy,
      freshStationRatio: statusJson?.freshness?.freshStationRatio,
      freshWindowMinutes: statusJson?.freshness?.freshWindowMinutes ?? maxStalenessMinutes,
      lastCollectionStartedAt: statusJson?.lastSuccessfulCollection?.startedAt,
      transientRetries,
      timestamp: new Date(now).toISOString(),
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const targetUrl = (process.argv[2] || process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, "");
  checkHealth(targetUrl)
    .then((result) => {
      if (!result.ok) {
        console.error(JSON.stringify(result.alert, null, 2));
        process.exit(1);
      }
      console.log(JSON.stringify(result.output, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error("Unhandled monitor error:", err);
      process.exit(2);
    });
}
