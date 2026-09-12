import type { StyleSpecification } from "maplibre-gl";

/**
 * Isolated basemap style configuration for MapLibre GL.
 * Uses CARTO Positron raster basemap tiles: free, high-DPI (@2x), no API key required,
 * clean neutral aesthetics that maximize gas price marker contrast.
 */
/**
 * Builds a MapLibre StyleSpecification for CARTO Positron raster basemap tiles.
 *
 * If an API key is provided and non-empty, it appends ?api_key=... to authenticated
 * tile URLs. CARTO API key is browser-visible by design and protected primarily
 * by CARTO's allowed-referrer/website restriction.
 * If apiKey is absent or empty, falls back to standard public tiles.
 */
export function getMapStyle(apiKey?: string | null): StyleSpecification {
  const queryParam =
    apiKey && apiKey.trim().length > 0
      ? `?api_key=${encodeURIComponent(apiKey.trim())}`
      : "";

  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "carto-positron": {
        type: "raster",
        tiles: [
          `https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${queryParam}`,
          `https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${queryParam}`,
          `https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${queryParam}`,
          `https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png${queryParam}`,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
      },
    },
    layers: [
      {
        id: "carto-positron-layer",
        type: "raster",
        source: "carto-positron",
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

export const MAP_CONFIG = {
  // Centered roughly over eastern US covering BJ's geographic footprint (Maine down to Florida & Ohio)
  defaultCenter: [-78.5, 38.0] as [number, number],
  defaultZoom: 5.5,
  minZoom: 3,
  maxZoom: 18,
  style: getMapStyle(),
};

