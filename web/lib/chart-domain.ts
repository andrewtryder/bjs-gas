/**
 * Y-axis domain with padding from series values, ignoring non-positive outliers
 * so invalid zero prices do not compress the chart.
 */
export function priceSeriesDomain(
  values: number[],
  paddingRatio = 0.08,
  minPadding = 0.05,
): [number, number] | undefined {
  const positives = values.filter((v) => Number.isFinite(v) && v > 0);
  if (positives.length === 0) return undefined;

  const lo = Math.min(...positives);
  const hi = Math.max(...positives);
  const span = hi - lo;
  const pad = Math.max(minPadding, span * paddingRatio);

  return [lo - pad, hi + pad];
}