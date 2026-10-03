import { describe, expect, it } from "vitest";
import { CollectionLock } from "../src/collector/lock.js";
import {
  COLLECTION_EXPECTED_MAX_MS,
  COLLECTION_LOCK_STALE_MS,
} from "../src/collector/policy.js";

describe("CollectionLock policy & state isolation", () => {
  it("starts in an unasserted idle state", () => {
    const lock = new CollectionLock();
    expect(lock.isInProgress()).toBe(false);
    const state = lock.getState();
    expect(state.inProgress).toBe(false);
    expect(state.startedAt).toBeNull();
    expect(state.ageMs).toBeNull();
    expect(state.ageSeconds).toBeNull();
    expect(state.overExpectedDuration).toBe(false);
    expect(state.stale).toBe(false);
  });

  it("calculates age and warns over expected duration using injected clock without process-global mutation", () => {
    const lock = new CollectionLock();
    const startMs = 1_000_000;
    lock.acquire(startMs);

    expect(lock.isInProgress()).toBe(true);

    // After 1 minute (within expected 3m bound)
    const state1m = lock.getState(startMs + 60_000);
    expect(state1m.inProgress).toBe(true);
    expect(state1m.ageMs).toBe(60_000);
    expect(state1m.ageSeconds).toBe(60);
    expect(state1m.overExpectedDuration).toBe(false);
    expect(state1m.stale).toBe(false);

    // After expected duration threshold (3m)
    const stateOverExpected = lock.getState(startMs + COLLECTION_EXPECTED_MAX_MS + 1000);
    expect(stateOverExpected.overExpectedDuration).toBe(true);
    expect(stateOverExpected.stale).toBe(false);

    // After stale threshold (17m = 12m timeout + 5m margin)
    const stateStale = lock.getState(startMs + COLLECTION_LOCK_STALE_MS + 1000);
    expect(stateStale.overExpectedDuration).toBe(true);
    expect(stateStale.stale).toBe(true);
    // Crucial invariant: reader NEVER auto-clears the lock
    expect(lock.isInProgress()).toBe(true);

    // Clearing releases the lock
    lock.clear();
    expect(lock.isInProgress()).toBe(false);
    expect(lock.getState().inProgress).toBe(false);
  });
});
