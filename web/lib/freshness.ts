/**
 * Data Freshness Model & Formatting Utility
 *
 * Collector runs periodically (hourly, fresh window is 90 minutes).
 * Thresholds:
 * - fresh: <= 2 hours (120 minutes)
 * - aging: 2 to 6 hours (120 to 360 minutes)
 * - stale: > 6 hours (> 360 minutes)
 */

export type FreshnessLevel = "fresh" | "aging" | "stale";

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
      relativeText: "Observation time unknown",
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

  if (ageMinutes <= 120) {
    level = "fresh";
    label = "Live / Current";
    badgeBg = "var(--cheaper-bg)";
    badgeColor = "var(--cheaper)";
    badgeBorder = "rgba(34, 197, 94, 0.25)";
    badgeClass = "badge-fresh";
  } else if (ageMinutes <= 360) {
    level = "aging";
    label = "Data from earlier today";
    badgeBg = "rgba(234, 179, 8, 0.1)";
    badgeColor = "#eab308";
    badgeBorder = "rgba(234, 179, 8, 0.25)";
    badgeClass = "badge-aging";
  } else {
    level = "stale";
    label = "Stale observation";
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
  return `Last observed ${days}d ago`;
}
