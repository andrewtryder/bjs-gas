import type { StyleSpecification } from "maplibre-gl";

/**
 * Isolated basemap style configuration for MapLibre GL.
 * Uses CARTO Positron raster basemap tiles: free, high-DPI (@2x), no API key required,
 * clean neutral aesthetics that maximize gas price marker contrast.
 */
export const MAP_CONFIG = {
  // Centered roughly over eastern US covering BJ's geographic footprint (Maine down to Florida & Ohio)
  defaultCenter: [-78.5, 38.0] as [number, number],
  defaultZoom: 5.5,
  minZoom: 3,
  maxZoom: 18,
  style: {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      "carto-positron": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
          "https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png",
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
  } as StyleSpecification,
};
