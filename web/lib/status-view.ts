import { formatAgeAgo, formatRelativeTime, getFreshnessInfo } from "./freshness.js";

export type StatusLevel = "healthy" | "degraded" | "stale";

export interface StatusHeroData {
  level: StatusLevel;
  heading: string;
  description: string;
  badgeLabel: string;
}

export function resolveStatusHero(
  status: { healthy?: boolean } | null,
  fetchError: string | null,
  latestObservedAt?: string | null,
): StatusHeroData {
  if (fetchError) {
    return {
      level: "stale",
      heading: "Some prices may be delayed",
      description: "The latest update time is unavailable right now.",
      badgeLabel: "Delayed",
    };
  }

  const age = formatAgeAgo(latestObservedAt);
  const uiLevel = getFreshnessInfo(latestObservedAt).level;

  if (status?.healthy === true) {
    const timeText = latestObservedAt ? formatRelativeTime(latestObservedAt) : "recently";
    return {
      level: "healthy",
      heading: "Prices are up to date",
      description: age ? `Prices updated ${age}.` : `Latest price check completed ${timeText}.`,
      badgeLabel: "Up to date",
    };
  }

  const delayedLevel: StatusLevel = uiLevel === "stale" ? "stale" : "degraded";
  return {
    level: delayedLevel,
    heading: "Some prices may be delayed",
    description: age ? `Latest price update: ${age}` : "Some station prices have not updated on schedule.",
    badgeLabel: "Some delays",
  };
}

export function formatCollectionDuration(durationMs?: number | null): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs <= 0) {
    return "—";
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}
