import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchWithCache, clearMemoryCache } from "../lib/cache";

describe("fetchWithCache in-memory SWR cache", () => {
  beforeEach(() => {
    clearMemoryCache();
    vi.useRealTimers();
  });

  it("fetches and caches on first call, returns from cache on second call within TTL", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { value: "test" };
    };

    const res1 = await fetchWithCache("key-1", 60, fetcher);
    expect(res1).toEqual({ value: "test" });
    expect(callCount).toBe(1);

    const res2 = await fetchWithCache("key-1", 60, fetcher);
    expect(res2).toEqual({ value: "test" });
    expect(callCount).toBe(1); // Cached, fetcher not called again
  });

  it("re-fetches when TTL expires", async () => {
    vi.useFakeTimers();
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { count: callCount };
    };

    const res1 = await fetchWithCache("key-2", 10, fetcher);
    expect(res1).toEqual({ count: 1 });
    expect(callCount).toBe(1);

    // Advance time past 10s TTL
    vi.advanceTimersByTime(11_000);

    const res2 = await fetchWithCache("key-2", 10, fetcher);
    expect(res2).toEqual({ count: 2 });
    expect(callCount).toBe(2);
  });

  it("serves stale data if fetch fails after TTL expires", async () => {
    vi.useFakeTimers();
    let shouldFail = false;
    const fetcher = async () => {
      if (shouldFail) {
        throw new Error("Network timeout / DB offline");
      }
      return { status: "good" };
    };

    const res1 = await fetchWithCache("key-3", 10, fetcher);
    expect(res1).toEqual({ status: "good" });

    // Advance past TTL and simulate failure
    vi.advanceTimersByTime(11_000);
    shouldFail = true;

    const res2 = await fetchWithCache("key-3", 10, fetcher);
    expect(res2).toEqual({ status: "good" }); // Stale data served!
  });

  it("re-throws error if fetch fails and there is no prior cache", async () => {
    const fetcher = async () => {
      throw new Error("Initial failure");
    };

    await expect(fetchWithCache("key-4", 60, fetcher)).rejects.toThrow("Initial failure");
  });
});
