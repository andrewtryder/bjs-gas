/**
 * Operational thresholds and concurrency policy for the gas collector.
 *
 * Collection timing hierarchy:
 * >3m  COLLECTION_EXPECTED_MAX_MS → status: collection_over_expected_duration
 *                                   (warning/unhealthy; lock NOT auto-cleared)
 * >12m COLLECTION_TIMEOUT_MS      → abort in-flight fetches/retries/sleeps;
 *                                   lock held until aborted work settles + finally
 * >17m COLLECTION_LOCK_STALE_MS   → status: collection_lock_stale
 *                                   (abort/cleanup failed); NEVER auto-unlock
 */

export const DEFAULT_CONCURRENCY = 5;
export const FAILURE_DEGRADED_RATIO = 0.2;
export const FAILURE_CRITICAL_RATIO = 0.8;

/**
 * Hard deadline for one collection. On expiry the collection AbortController
 * aborts all in-flight club fetches/retries; the lock stays held until that
 * work settles and `finally` runs.
 */
export const COLLECTION_TIMEOUT_MS = 12 * 60_000;

/**
 * Healthy collects finish well under this. Longer means status should flag
 * `collection_over_expected_duration` — but the lock is NOT auto-cleared.
 */
export const COLLECTION_EXPECTED_MAX_MS = 3 * 60_000;

/**
 * Defensive status-only threshold (= TIMEOUT + 5m). If a lock is still held
 * this long, abort/cleanup failed. Never used to unlock while live work may
 * still exist.
 */
export const COLLECTION_LOCK_STALE_MS = COLLECTION_TIMEOUT_MS + 5 * 60_000;

export const COLLECTION_POLICY = {
  defaultConcurrency: DEFAULT_CONCURRENCY,
  failureDegradedRatio: FAILURE_DEGRADED_RATIO,
  failureCriticalRatio: FAILURE_CRITICAL_RATIO,
  timeoutMs: COLLECTION_TIMEOUT_MS,
  expectedMaxMs: COLLECTION_EXPECTED_MAX_MS,
  lockStaleMs: COLLECTION_LOCK_STALE_MS,
} as const;
