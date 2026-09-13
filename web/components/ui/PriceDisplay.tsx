import React from "react";
import { formatPrice } from "../../lib/stats";
import { normalizeFuelDisplayName } from "../../lib/fuels";

export type PriceDisplaySize = "hero" | "primary" | "secondary" | "inline";
export type PriceDisplayColor = "default" | "positive" | "danger" | "accent";

export interface PriceDisplayProps {
  price: number | string | null | undefined;
  fuelName?: string;
  size?: PriceDisplaySize;
  color?: PriceDisplayColor;
  labelPosition?: "bottom" | "side" | "none";
  className?: string;
  ariaLabel?: string;
}

export default function PriceDisplay({
  price,
  fuelName,
  size = "primary",
  color = "default",
  labelPosition = "bottom",
  className = "",
  ariaLabel,
}: PriceDisplayProps) {
  const formatted = formatPrice(price);
  const normalizedFuel = fuelName ? normalizeFuelDisplayName(fuelName) : null;

  const sizeClass =
    size === "hero"
      ? "price-display-hero"
      : size === "secondary"
      ? "price-display-secondary"
      : size === "inline"
      ? "price-display-inline"
      : "price-display-primary";

  const colorStyle =
    color === "positive"
      ? { color: "var(--color-positive)" }
      : color === "danger"
      ? { color: "var(--color-danger)" }
      : color === "accent"
      ? { color: "var(--color-accent)" }
      : undefined;

  const accessibleLabel =
    ariaLabel ||
    (normalizedFuel ? `${formatted} for ${normalizedFuel}` : formatted);

  // If labelPosition is "bottom" and fuel is present, stack vertically
  if (normalizedFuel && labelPosition === "bottom") {
    return (
      <div className={`price-display-stacked ${className}`.trim()} aria-label={accessibleLabel}>
        <span className={`price-display ${sizeClass}`} style={colorStyle}>
          {formatted}
        </span>
        <span className="price-display-label">{normalizedFuel}</span>
      </div>
    );
  }

  return (
    <span className={`price-display ${sizeClass} ${className}`.trim()} style={colorStyle} aria-label={accessibleLabel}>
      <span>{formatted}</span>
      {normalizedFuel && labelPosition === "side" && (
        <span className="price-display-label">{normalizedFuel}</span>
      )}
    </span>
  );
}
