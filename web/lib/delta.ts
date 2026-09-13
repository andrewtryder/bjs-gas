/**
 * Delta Badge Formatting Model & Logic
 *
 * Encodes consumer gas price movement semantics:
 * - Price drop (negative cents): favorable/positive for fuel shoppers (emerald styling, ↓ glyph)
 * - Price increase (positive cents): unfavorable/danger for fuel shoppers (crimson styling, ↑ glyph)
 * - Zero or no change: neutral (slate styling, Same price)
 */

export type DeltaVariant = "positive" | "negative" | "neutral";
export type DeltaDirection = "down" | "up" | "neutral";

export interface DeltaBadgeInfo {
  cents: number | null;
  formattedText: string;
  direction: DeltaDirection;
  variant: DeltaVariant;
  ariaLabel: string;
}

export function resolveDeltaBadgeInfo(
  input: {
    cents?: number | null;
    diffDollars?: number | null;
    label?: string;
    direction?: DeltaDirection;
    variant?: DeltaVariant;
  },
  timeframe?: string
): DeltaBadgeInfo {
  const { label, direction, variant } = input;

  if (label) {
    return {
      cents: null,
      formattedText: timeframe ? `${label} ${timeframe}` : label,
      direction: direction || "neutral",
      variant: variant || "neutral",
      ariaLabel: timeframe ? `${label} ${timeframe}` : label,
    };
  }

  let resolvedCents: number | null = null;
  if (input.cents !== undefined && input.cents !== null && Number.isFinite(input.cents)) {
    resolvedCents = Math.round(input.cents);
  } else if (input.diffDollars !== undefined && input.diffDollars !== null && Number.isFinite(input.diffDollars)) {
    resolvedCents = Math.round(input.diffDollars * 100);
  }

  if (resolvedCents === null) {
    return {
      cents: null,
      formattedText: "—",
      direction: "neutral",
      variant: "neutral",
      ariaLabel: "Price change unavailable",
    };
  }

  const absCents = Math.abs(resolvedCents);
  let dir: DeltaDirection = "neutral";
  let resolvedVariant: DeltaVariant = "neutral";
  let formattedText = "";
  let ariaLabel = "";

  if (direction) {
    dir = direction;
  } else if (resolvedCents < 0) {
    dir = "down";
  } else if (resolvedCents > 0) {
    dir = "up";
  } else {
    dir = "neutral";
  }

  if (dir === "down") {
    resolvedVariant = variant || "positive";
    formattedText = `\u2193 ${absCents}\u00A2`;
    ariaLabel = `Price decreased by ${absCents} cents`;
  } else if (dir === "up") {
    resolvedVariant = variant || "negative";
    formattedText = `\u2191 ${absCents}\u00A2`;
    ariaLabel = `Price increased by ${absCents} cents`;
  } else {
    resolvedVariant = variant || "neutral";
    formattedText = "Same price";
    ariaLabel = "No price change";
  }

  if (timeframe) {
    formattedText = `${formattedText} ${timeframe}`;
    ariaLabel = `${ariaLabel} ${timeframe}`;
  }

  return {
    cents: resolvedCents,
    formattedText,
    direction: dir,
    variant: resolvedVariant,
    ariaLabel,
  };
}
