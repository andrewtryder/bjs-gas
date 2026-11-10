/**
 * Isolated basemap style configuration for MapLibre GL.
 * Uses CARTO Positron vector basemap style:
 * sharp vector rendering at all display densities, smooth fractional zooming,
 * and high contrast for gas price markers.
 */
export function getMapStyle(apiKey?: string | null): string {
  const queryParam =
    apiKey && apiKey.trim().length > 0
      ? `?key=${encodeURIComponent(apiKey.trim())}`
      : "";

  return `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json${queryParam}`;
}

export const MAP_CONFIG = {
  // Centered roughly over eastern US covering BJ's geographic footprint (Maine down to Florida & Ohio)
  defaultCenter: [-78.5, 38.0] as [number, number],
  defaultZoom: 5.5,
  minZoom: 3,
  maxZoom: 18,
  style: getMapStyle(),
};

export const MAP_THEME_TOKENS = {
  accent: "#2563eb",
  accentHover: "#1d4ed8",
  textPrimary: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  surface: "#ffffff",
} as const;

