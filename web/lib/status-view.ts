import { formatRelativeTime } from "./freshness.js";

export type StatusLevel = "healthy" | "degraded" | "stale";

export interface StatusHeroData {
  level: StatusLevel;
  heading: string;
  description: string;
  badgeLabel: string;
}

export function resolveStatusHero(
  status: { healthy?: boolean; unhealthyReasons?: string[] } | null,
  fetchError: string | null,
  latestObservedAt?: string | null
): StatusHeroData {
  if (fetchError) {
    return {
      level: "stale",
      heading: "Price updates are delayed",
      description:
        "Unable to reach data status service. Station pages continue serving recently cached prices.",
      badgeLabel: "Delayed",
    };
  }

  const isHealthy = status?.healthy === true;

  if (isHealthy) {
    const timeText = latestObservedAt ? formatRelativeTime(latestObservedAt) : "recently";
    return {
      level: "healthy",
      heading: "Prices are up to date",
      description: `Latest price check completed ${timeText}.`,
      badgeLabel: "Up to date",
    };
  }

  return {
    level: "degraded",
    heading: "Some prices may be delayed",
    description:
      status?.unhealthyReasons && status.unhealthyReasons.length > 0
        ? status.unhealthyReasons.join(", ")
        : "Some station prices have not updated on schedule.",
    badgeLabel: "Some delays",
  };
}

export function formatCollectionDuration(durationMs?: number | null): string {
  if (durationMs === null || durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) {
    return "—";
  }
  return `${(durationMs / 1000).toFixed(1)}s`;
}
