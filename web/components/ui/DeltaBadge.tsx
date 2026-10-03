import {
  resolveDeltaBadgeInfo,
  type DeltaVariant,
  type DeltaDirection,
} from "../../lib/delta";

export type { DeltaVariant, DeltaDirection };

export interface DeltaBadgeProps {
  /** Signed or unsigned change in cents. If cents < 0, treated as price drop (favorable/positive) */
  cents?: number | null;
  /** Dollar difference (e.g. -0.12 or 0.15). Used if cents is not passed */
  diffDollars?: number | null;
  /** Explicit direction override */
  direction?: DeltaDirection;
  /** Optional timeframe or context label (e.g. "over 30 days" or "this week") */
  timeframe?: string;
  /** Custom label override replacing the standard cents output */
  label?: string;
  /** Explicit semantic variant override */
  variant?: DeltaVariant;
  /** Size variant */
  size?: "sm" | "md";
  className?: string;
}

export default function DeltaBadge({
  cents,
  diffDollars,
  direction,
  timeframe,
  label,
  variant,
  size = "md",
  className = "",
}: DeltaBadgeProps) {
  const info = resolveDeltaBadgeInfo(
    { cents, diffDollars, label, direction, variant },
    timeframe
  );

  const variantClass =
    info.variant === "positive"
      ? "delta-badge-positive"
      : info.variant === "negative"
      ? "delta-badge-danger"
      : "delta-badge-neutral";

  const sizeClass = size === "sm" ? "delta-badge-sm" : "delta-badge-md";
  const combinedClass = `delta-badge ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <span className={combinedClass} aria-label={info.ariaLabel}>
      {info.formattedText}
    </span>
  );
}
