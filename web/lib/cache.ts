interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

/**
 * Executes a fetch with an in-memory SWR (stale-while-revalidate) cache.
 * - If cache is valid (< ttlSeconds old): returns immediately from memory.
 * - If cache is expired: attempts fetchFn. On success, updates cache.
 * - On failure with existing cache: logs warning and serves STALE data so users and monitors never see transient errors.
 * - On failure without cache: re-throws the error.
 */
export async function fetchWithCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = memoryCache.get(cacheKey) as CacheEntry<T> | undefined;

  // Fresh cache hit
  if (entry && now - entry.cachedAt < entry.ttlMs) {
    return entry.data;
  }

  try {
    const data = await fetchFn();
    memoryCache.set(cacheKey, {
      data,
      cachedAt: now,
      ttlMs: ttlSeconds * 1000,
    });
    return data;
  } catch (err) {
    if (entry) {
      console.warn(
        `Fetch failed for ${cacheKey}, serving stale cache:`,
        err instanceof Error ? err.message : String(err),
      );
      return entry.data;
    }
    throw err;
  }
}

/** Clear cache (useful for testing or forced resets) */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
