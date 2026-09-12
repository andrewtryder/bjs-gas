/**
 * Calculates the median of an array of numbers with exact 3-decimal gas-price precision.
 * - Empty array -> null
 * - Odd length -> middle element
 * - Even length -> arithmetic mean of the two middle elements
 */
export function calculateMedian(values: number[]): number | null {
  if (!values || values.length === 0) return null;

  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return null;

  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 !== 0) {
    const val = sorted[mid]!;
    return Math.round(val * 1000) / 1000;
  }

  const val = (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(val * 1000) / 1000;
}

/**
 * Formats a numeric price into a 3-decimal string (e.g. 3.199 -> "3.199").
 */
export function formatPriceString(price: number | string | null | undefined): string {
  if (price === null || price === undefined) return "—";
  const num = typeof price === "number" ? price : Number.parseFloat(price);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(3);
}
