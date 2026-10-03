import {
  COLLECTION_EXPECTED_MAX_MS,
  COLLECTION_LOCK_STALE_MS,
} from "./policy.js";

export type CollectionLockState = {
  inProgress: boolean;
  startedAt: string | null;
  ageMs: number | null;
  ageSeconds: number | null;
  /** True when age exceeds COLLECTION_EXPECTED_MAX_MS. */
  overExpectedDuration: boolean;
  /**
   * True when age exceeds COLLECTION_LOCK_STALE_MS. Status-only signal —
   * the lock is never forcibly cleared here (that would allow overlap).
   */
  stale: boolean;
};

export class CollectionLock {
  private collecting = false;
  private collectingStartedAtMs: number | null = null;

  acquire(nowMs: number = Date.now()): void {
    this.collecting = true;
    this.collectingStartedAtMs = nowMs;
  }

  clear(): void {
    this.collecting = false;
    this.collectingStartedAtMs = null;
  }

  getState(nowMs: number = Date.now()): CollectionLockState {
    if (!this.collecting || this.collectingStartedAtMs == null) {
      return {
        inProgress: false,
        startedAt: null,
        ageMs: null,
        ageSeconds: null,
        overExpectedDuration: false,
        stale: false,
      };
    }
    const ageMs = nowMs - this.collectingStartedAtMs;
    return {
      inProgress: true,
      startedAt: new Date(this.collectingStartedAtMs).toISOString(),
      ageMs,
      ageSeconds: Math.floor(ageMs / 1000),
      overExpectedDuration: ageMs > COLLECTION_EXPECTED_MAX_MS,
      stale: ageMs > COLLECTION_LOCK_STALE_MS,
    };
  }

  isInProgress(): boolean {
    return this.getState().inProgress;
  }

  /** Test-only: force lock state for status/lock coverage without running network work. */
  setForTests(startedAtMs: number | null): void {
    if (startedAtMs == null) {
      this.clear();
      return;
    }
    this.collecting = true;
    this.collectingStartedAtMs = startedAtMs;
  }
}

/** Global default process-local lock instance. */
export const defaultCollectionLock = new CollectionLock();

export function clearCollectionLock(): void {
  defaultCollectionLock.clear();
}

export function acquireCollectionLock(nowMs?: number): void {
  defaultCollectionLock.acquire(nowMs);
}

/**
 * Process-local single-flight state.
 *
 * Incident model: a collection with no hard deadline never settled, so its
 * `finally` never ran and the lock stayed asserted — later cron/manual
 * attempts saw `collection_in_progress`. This reader NEVER auto-clears the
 * lock (that would allow overlap with still-running network/DB work).
 */
export function getCollectionLockState(nowMs: number = Date.now()): CollectionLockState {
  return defaultCollectionLock.getState(nowMs);
}

export function isCollectionInProgress(): boolean {
  return defaultCollectionLock.isInProgress();
}

/** Test-only: force lock state for status/lock coverage. Does not start network work. */
export function __setCollectionLockForTests(startedAtMs: number | null): void {
  defaultCollectionLock.setForTests(startedAtMs);
}
