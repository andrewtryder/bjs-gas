#!/usr/bin/env node
/**
 * Post-deployment smoke test and revision verification for bjs-gas.
 *
 * Usage:
 *   node scripts/smoke-test.mjs \
 *     --api-url https://... \
 *     --web-url https://... \
 *     --expected-revision <short-sha> \
 *     [--allow-unhealthy-status]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const RETRY_DELAYS_MS = [1_000, 3_000, 5_000];

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, fetchFn = fetch, sleepFn = wait) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(15_000) });
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

export async function runSmokeTest({
  apiUrl,
  webUrl,
  expectedRevision,
  allowUnhealthyStatus = false,
  fetchFn = fetch,
  sleepFn = wait,
}) {
  const failures = [];
  const apiBase = apiUrl.replace(/\/$/, "");
  const webBase = webUrl.replace(/\/$/, "");

  // 1. API /health + revision check
  let health;
  try {
    const res = await fetchWithRetry(`${apiBase}/health`, fetchFn, sleepFn);
    if (!res.ok) {
      failures.push(`GET /health returned HTTP ${res.status}`);
    } else {
      health = await res.json();
      if (health?.ok !== true) failures.push("/health ok !== true");
      if (health?.dirty !== false) failures.push(`/health dirty is ${String(health?.dirty)} (expected false)`);
      if (expectedRevision && health?.revision !== expectedRevision) {
        failures.push(`/health revision '${String(health?.revision)}' !== expected '${expectedRevision}'`);
      }
    }
  } catch (err) {
    failures.push(`GET /health error: ${err.message}`);
  }

  // 2. API /api/v1/stations
  let stationCount = 0;
  try {
    const res = await fetchWithRetry(`${apiBase}/api/v1/stations`, fetchFn, sleepFn);
    if (!res.ok) {
      failures.push(`GET /api/v1/stations returned HTTP ${res.status}`);
    } else {
      const data = await res.json();
      stationCount = Array.isArray(data?.stations) ? data.stations.length : 0;
      if (stationCount === 0) {
        failures.push("GET /api/v1/stations returned 0 stations");
      }
    }
  } catch (err) {
    failures.push(`GET /api/v1/stations error: ${err.message}`);
  }

  // 3. API /api/v1/status
  let status;
  try {
    const res = await fetchWithRetry(`${apiBase}/api/v1/status`, fetchFn, sleepFn);
    if (!res.ok) {
      failures.push(`GET /api/v1/status returned HTTP ${res.status}`);
    } else {
      status = await res.json();
      if (!allowUnhealthyStatus && status?.healthy !== true) {
        failures.push(
          `GET /api/v1/status healthy=${String(status?.healthy)} reasons=${(status?.unhealthyReasons || []).join(",")}`,
        );
      }
    }
  } catch (err) {
    failures.push(`GET /api/v1/status error: ${err.message}`);
  }

  // 4. Web / and /maplibre-gl-worker.mjs
  for (const route of ["/", "/map", "/maplibre-gl-worker.mjs"]) {
    try {
      const res = await fetchWithRetry(`${webBase}${route}`, fetchFn, sleepFn);
      if (!res.ok) {
        failures.push(`Web GET ${route} returned HTTP ${res.status}`);
      }
    } catch (err) {
      failures.push(`Web GET ${route} error: ${err.message}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    revision: health?.revision ?? null,
    dirty: health?.dirty ?? null,
    stationCount,
    healthy: status?.healthy ?? null,
  };
}

function parseArgs(argv) {
  const args = { allowUnhealthyStatus: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--api-url") args.apiUrl = argv[++i];
    else if (arg === "--web-url") args.webUrl = argv[++i];
    else if (arg === "--expected-revision") args.expectedRevision = argv[++i];
    else if (arg === "--allow-unhealthy-status") args.allowUnhealthyStatus = true;
  }
  return args;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.apiUrl || !args.webUrl) {
    console.error("Usage: node scripts/smoke-test.mjs --api-url <url> --web-url <url> [--expected-revision <sha>] [--allow-unhealthy-status]");
    process.exit(1);
  }
  const result = await runSmokeTest(args);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exit(1);
  }
}
