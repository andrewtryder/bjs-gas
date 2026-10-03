import Link from "next/link";
import type { FreshnessLevel } from "../../lib/freshness";

export interface StatusPillProps {
  level?: FreshnessLevel;
  text: string;
  showDot?: boolean;
  cadencePrefix?: boolean;
  href?: string;
  title?: string;
  className?: string;
  ariaLabel?: string;
}

export default function StatusPill({
  level = "fresh",
  text,
  showDot = true,
  cadencePrefix = false,
  href,
  title,
  className = "",
  ariaLabel,
}: StatusPillProps) {
  const dotClass =
    level === "aging"
      ? "status-pill-dot-aging"
      : level === "stale"
      ? "status-pill-dot-stale"
      : "status-pill-dot-fresh";

  const levelLabel =
    level === "aging"
      ? "Price updates aging"
      : level === "stale"
      ? "Price updates stale"
      : "Prices up to date";

  const displayContent = (
    <>
      {showDot && <span className={`status-pill-dot ${dotClass}`} aria-hidden="true" />}
      <span className="status-pill-text">
        {cadencePrefix ? `About every 2 hours \u2022 ${text}` : text}
      </span>
    </>
  );

  const fullAriaLabel = ariaLabel || (cadencePrefix ? `Checked about every 2 hours, ${text}. Status: ${levelLabel}` : `${text}. Status: ${levelLabel}`);
  const combinedClass = `status-pill ${className}`.trim();

  if (href) {
    return (
      <Link
        href={href}
        className={combinedClass}
        title={title || levelLabel}
        aria-label={fullAriaLabel}
      >
        {displayContent}
      </Link>
    );
  }

  return (
    <span
      className={combinedClass}
      title={title || levelLabel}
      aria-label={fullAriaLabel}
    >
      {displayContent}
    </span>
  );
}
