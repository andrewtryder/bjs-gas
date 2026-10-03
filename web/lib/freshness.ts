/**
 * Public freshness bands for station timestamps and About-page copy.
 *
 * Collector cadence is ~120 minutes (boot-relative).
 * - fresh:  <= 3 hours
 * - aging:  3 to 6 hours
 * - stale:  > 6 hours
 *
 * Operator `/api/v1/status` uses FRESH_WINDOW_MINUTES (180) separately.
 */

export type FreshnessLevel = "fresh" | "aging" | "stale";

export const USER_FRESH_MAX_MINUTES = 180;
export const USER_STALE_AFTER_MINUTES = 360;

export interface FreshnessInfo {
  level: FreshnessLevel;
  label: string;
  relativeText: string;
  badgeBg: string;
  badgeColor: string;
  badgeBorder: string;
  badgeClass: string;
  ageMinutes: number;
}

export function getFreshnessInfo(
  isoTimestamp: string | null | undefined,
  now: Date = new Date(),
): FreshnessInfo {
  if (!isoTimestamp) {
    return {
      level: "stale",
      label: "Unknown",
      relativeText: "Update time unknown",
      badgeBg: "rgba(239, 68, 68, 0.1)",
      badgeColor: "var(--expensive)",
      badgeBorder: "rgba(239, 68, 68, 0.25)",
      badgeClass: "badge-stale",
      ageMinutes: Number.POSITIVE_INFINITY,
    };
  }

  const date = new Date(isoTimestamp);
  const ageMs = now.getTime() - date.getTime();
  const ageMinutes = Math.max(0, Math.floor(ageMs / 60_000));

  let level: FreshnessLevel;
  let label: string;
  let badgeBg: string;
  let badgeColor: string;
  let badgeBorder: string;
  let badgeClass: string;

  if (ageMinutes <= USER_FRESH_MAX_MINUTES) {
    level = "fresh";
    label = "Updated recently";
    badgeBg = "var(--cheaper-bg)";
    badgeColor = "var(--cheaper)";
    badgeBorder = "rgba(34, 197, 94, 0.25)";
    badgeClass = "badge-fresh";
  } else if (ageMinutes <= USER_STALE_AFTER_MINUTES) {
    level = "aging";
    label = "Aging";
    badgeBg = "rgba(234, 179, 8, 0.1)";
    badgeColor = "#eab308";
    badgeBorder = "rgba(234, 179, 8, 0.25)";
    badgeClass = "badge-aging";
  } else {
    level = "stale";
    label = "Stale";
    badgeBg = "var(--expensive-bg)";
    badgeColor = "var(--expensive)";
    badgeBorder = "rgba(239, 68, 68, 0.25)";
    badgeClass = "badge-stale";
  }

  return {
    level,
    label,
    relativeText: formatRelativeTime(ageMinutes),
    badgeBg,
    badgeColor,
    badgeBorder,
    badgeClass,
    ageMinutes,
  };
}

export function formatRelativeTime(
  timestampOrMinutes: string | number | null | undefined,
  now: Date = new Date(),
): string {
  if (timestampOrMinutes == null) return "Unknown";

  let ageMinutes: number;
  if (typeof timestampOrMinutes === "string") {
    const d = new Date(timestampOrMinutes);
    if (Number.isNaN(d.getTime())) return "Unknown";
    ageMinutes = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  } else {
    ageMinutes = timestampOrMinutes;
  }

  if (ageMinutes < 1) {
    return "Just updated";
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago`;
  }
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

/** Spoken age for About-page copy, e.g. "42 minutes ago". */
export function formatAgeAgo(
  timestampOrMinutes: string | number | null | undefined,
  now: Date = new Date(),
): string | null {
  if (timestampOrMinutes == null) return null;

  let ageMinutes: number;
  if (typeof timestampOrMinutes === "string") {
    const d = new Date(timestampOrMinutes);
    if (Number.isNaN(d.getTime())) return null;
    ageMinutes = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  } else {
    if (!Number.isFinite(timestampOrMinutes)) return null;
    ageMinutes = Math.max(0, Math.floor(timestampOrMinutes));
  }

  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) {
    return `${ageMinutes} ${ageMinutes === 1 ? "minute" : "minutes"} ago`;
  }
  const hours = Math.floor(ageMinutes / 60);
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}
