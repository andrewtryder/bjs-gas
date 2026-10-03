/**
 * Wraps analytics queries to track latency and warn if execution exceeds 500ms.
 */
export async function timedQuery<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const durationMs = performance.now() - start;
  if (durationMs > 500) {
    console.warn(`[analytics_query_slow] query=${name} duration=${durationMs.toFixed(1)}ms`);
  }
  return result;
}
