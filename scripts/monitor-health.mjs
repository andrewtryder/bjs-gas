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
 * 6. lastSuccessfulCollection.startedAt within past 90 minutes
 * 7. freshness.latestObservedAt within past 90 minutes
 *
 * Usage:
 *   node scripts/monitor-health.mjs [API_BASE_URL]
 */

const DEFAULT_API_URL = "https://a3i9pecpa5hxogp2hpozah6d.ewr.prisma.build";
const API_URL = (process.argv[2] || process.env.API_URL || DEFAULT_API_URL).replace(/\/$/, "");
const MAX_STALENESS_MINUTES = 90;
const MIN_FRESH_STATION_RATIO = 0.8;

async function checkHealth() {
  const failures = [];
  const now = Date.now();

  // Check 1: /health HTTP 200 & ok: true
  let healthJson;
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(10_000) });
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
    const res = await fetch(`${API_URL}/api/v1/status`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      failures.push(`/api/v1/status returned HTTP ${res.status}`);
    } else {
      statusJson = await res.json();
    }
  } catch (err) {
    failures.push(`/api/v1/status request failed: ${err.message}`);
  }

  if (statusJson) {
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

    // Check 6: last successful collection within 90 minutes
    const lastStartedAt = statusJson.lastSuccessfulCollection?.startedAt;
    if (!lastStartedAt) {
      failures.push(`No lastSuccessfulCollection recorded`);
    } else {
      const elapsedMinutes = (now - new Date(lastStartedAt).getTime()) / 60_000;
      if (elapsedMinutes > MAX_STALENESS_MINUTES) {
        failures.push(`Last successful collection occurred ${elapsedMinutes.toFixed(1)}m ago (exceeds ${MAX_STALENESS_MINUTES}m threshold)`);
      }
    }

    // Check 7: latestObservedAt within 90 minutes
    const latestObservedAt = statusJson.freshness?.latestObservedAt;
    if (!latestObservedAt) {
      failures.push(`No latestObservedAt recorded in freshness`);
    } else {
      const elapsedMinutes = (now - new Date(latestObservedAt).getTime()) / 60_000;
      if (elapsedMinutes > MAX_STALENESS_MINUTES) {
        failures.push(`Latest fuel observation is ${elapsedMinutes.toFixed(1)}m old (exceeds ${MAX_STALENESS_MINUTES}m threshold)`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      JSON.stringify({
        event: "external_monitoring_alert",
        status: "FAIL",
        apiUrl: API_URL,
        failureCount: failures.length,
        failures,
        timestamp: new Date().toISOString(),
      }, null, 2)
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      event: "external_monitoring_ok",
      status: "PASS",
      apiUrl: API_URL,
      revision: healthJson?.revision ?? statusJson?.revision ?? "unknown",
      healthy: statusJson?.healthy,
      freshStationRatio: statusJson?.freshness?.freshStationRatio,
      lastCollectionStartedAt: statusJson?.lastSuccessfulCollection?.startedAt,
      timestamp: new Date().toISOString(),
    }, null, 2)
  );
  process.exit(0);
}

checkHealth().catch((err) => {
  console.error("Unhandled monitor error:", err);
  process.exit(2);
});
