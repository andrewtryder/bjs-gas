"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Configure MapLibre GL v6 worker URL to static local worker script
if (typeof window !== "undefined") {
  if (typeof (maplibregl as any).setWorkerUrl === "function") {
    (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs");
  } else if (maplibregl.config) {
    maplibregl.config.WORKER_URL = "/maplibre-gl-worker.mjs";
  }
}

import { MAP_CONFIG, MAP_THEME_TOKENS, getMapStyle } from "../lib/map-config";
import type {
  StationDto,
} from "../lib/types";
import {
  type StationGeoJsonCollection,
  type StationGeoJsonProperties,
  formatMapPopupData,
} from "../lib/discovery";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface InteractiveMapProps {
  stationsGeoJson: StationGeoJsonCollection;
  selectedStation: StationDto | null;
  onSelectStation: (station: StationDto | null) => void;
  stations: StationDto[];
  selectedFuel?: string;
  collisionKeys?: Set<string>;
  cartoApiKey?: string | null;
}

export default function InteractiveMap({
  stationsGeoJson,
  selectedStation,
  onSelectStation,
  stations,
  selectedFuel = "ALL",
  collisionKeys,
  cartoApiKey,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const suppressNextSelectionCameraRef = useRef(false);
  const selectedStationRef = useRef(selectedStation);
  const stationsRef = useRef(stations);
  const onSelectStationRef = useRef(onSelectStation);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    selectedStationRef.current = selectedStation;
  }, [selectedStation]);

  useEffect(() => {
    stationsRef.current = stations;
  }, [stations]);

  useEffect(() => {
    onSelectStationRef.current = onSelectStation;
  }, [onSelectStation]);

  const showStationPopup = useCallback(
    (
      coords: [number, number],
      props: StationGeoJsonProperties,
      station: StationDto | null,
    ) => {
      if (!mapRef.current) return;

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      const popupData = station
        ? formatMapPopupData(station, selectedFuel, collisionKeys)
        : {
            title: props.city ? `${props.city}, ${props.state} · #${props.clubNumber}` : `#${props.clubNumber}`,
            clubNumber: Number(props.clubNumber),
            primaryPriceFormatted: props.priceFormatted,
            primaryFuelName: props.fuelName || "Regular",
            secondaryFuels: [],
            freshnessText: null,
          };

      let secondaryFuelsHtml = "";
      if (popupData.secondaryFuels.length > 0) {
        secondaryFuelsHtml = `
          <div class="map-popup-secondary-fuels">
            ${popupData.secondaryFuels
              .map(
                (f) => `
              <span class="map-popup-secondary-item">
                <span class="map-popup-sec-name">${escapeHtml(f.name)}</span>
                <span class="map-popup-sec-price tabular-nums">${escapeHtml(f.price)}</span>
              </span>
            `,
              )
              .join("")}
          </div>
        `;
      }

      const html = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <h4 class="map-popup-title">${escapeHtml(popupData.title)}</h4>
          </div>
          <div class="map-popup-price-row">
            <span class="map-popup-primary-price tabular-nums">${escapeHtml(popupData.primaryPriceFormatted)}</span>
            <span class="map-popup-primary-fuel">${escapeHtml(popupData.primaryFuelName)}</span>
          </div>
          ${secondaryFuelsHtml}
          ${popupData.freshnessText ? `<div class="map-popup-freshness">${escapeHtml(popupData.freshnessText)}</div>` : ""}
          <div class="map-popup-footer">
            <a href="/stations/${popupData.clubNumber}" class="map-popup-link">
              View club details &rarr;
            </a>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({
        offset: 14,
        closeButton: true,
        closeOnClick: false,
        className: "map-custom-popup",
      })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(mapRef.current);

      popupRef.current = popup;
    },
    [selectedFuel, collisionKeys],
  );

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (typeof (maplibregl as any).setWorkerUrl === "function") {
      (maplibregl as any).setWorkerUrl("/maplibre-gl-worker.mjs");
    } else if (maplibregl.config) {
      maplibregl.config.WORKER_URL = "/maplibre-gl-worker.mjs";
    }

    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: getMapStyle(cartoApiKey),
        center: MAP_CONFIG.defaultCenter,
        zoom: MAP_CONFIG.defaultZoom,
        minZoom: MAP_CONFIG.minZoom,
        maxZoom: MAP_CONFIG.maxZoom,
      });
    } catch (err) {
      console.warn("map_initialization_failed", err);
      setMapError(
        "Interactive map could not be initialized in this browser. You can still view all station prices and details in the list below.",
      );
      return;
    }

    map.on("error", () => {
      // Graceful degradation log: never expose API key or query string in logs
      console.warn("carto_map_load_failed");
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right",
    );

    map.on("load", () => {
      map.addSource("stations", {
        type: "geojson",
        data: stationsGeoJson,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 40,
      });

      // Clusters circles
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stations",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": [
            "step",
            ["get", "point_count"],
            MAP_THEME_TOKENS.accent,
            5,
            MAP_THEME_TOKENS.accentHover,
            15,
            MAP_THEME_TOKENS.textPrimary,
          ],
          "circle-radius": [
            "step",
            ["get", "point_count"],
            18,
            5,
            24,
            15,
            30,
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": MAP_THEME_TOKENS.surface,
        },
      });

      // Clusters count text
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "stations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font": ["Noto Sans Regular"],
          "text-size": 13,
        },
        paint: {
          "text-color": MAP_THEME_TOKENS.surface,
        },
      });

      // Selected station highlight ring (DS-4 Section 24)
      map.addLayer({
        id: "selected-station-ring",
        type: "circle",
        source: "stations",
        filter: ["==", ["get", "clubNumber"], selectedStation ? selectedStation.clubNumber : -1],
        paint: {
          "circle-color": "transparent",
          "circle-radius": 14,
          "circle-stroke-width": 3,
          "circle-stroke-color": MAP_THEME_TOKENS.accent,
        },
      });

      // Individual station circles
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": MAP_THEME_TOKENS.accent,
          "circle-radius": 8,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": MAP_THEME_TOKENS.surface,
        },
      });

      // Individual station price badges
      map.addLayer({
        id: "unclustered-label",
        type: "symbol",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "text-field": ["get", "priceFormatted"],
          "text-font": ["Noto Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": MAP_THEME_TOKENS.textPrimary,
          "text-halo-color": MAP_THEME_TOKENS.surface,
          "text-halo-width": 2,
        },
      });

      // Click on cluster -> zoom in
      map.on(
        "click",
        "clusters",
        (
          e: maplibregl.MapMouseEvent & {
            features?: maplibregl.MapGeoJSONFeature[];
          },
        ) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("stations") as GeoJSONSource;

        const onExpansion = (zoom: number) => {
          const geometry = features[0]?.geometry;
          if (geometry && geometry.type === "Point") {
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom: Math.min(zoom, 14),
            });
          }
        };

        const res = (source as any).getClusterExpansionZoom(
          clusterId,
          (err: any, zoom: number) => {
            if (!err && Number.isFinite(zoom)) {
              onExpansion(zoom);
            }
          },
        );

        if (res && typeof res.then === "function") {
          res
            .then((zoom: number) => {
              if (Number.isFinite(zoom)) onExpansion(zoom);
            })
            .catch(() => {});
        }
      });

      // Click on station marker or label -> open popup & select station
      const handleStationClick = (
        e: maplibregl.MapMouseEvent & {
          features?: maplibregl.MapGeoJSONFeature[];
        },
      ) => {
        const feature = e.features?.[0];
        if (!feature || feature.geometry.type !== "Point") return;

        const coords = (
          feature.geometry.coordinates as [number, number]
        ).slice() as [number, number];
        const props = feature.properties as unknown as StationGeoJsonProperties;
        const station =
          stationsRef.current.find((s) => s.clubNumber === Number(props.clubNumber)) ||
          null;

        const isAlreadySelected =
          station && selectedStationRef.current?.clubNumber === station.clubNumber;
        if (!isAlreadySelected) {
          suppressNextSelectionCameraRef.current = true;
        }

        onSelectStationRef.current(station);
        showStationPopup(coords, props, station);
      };

      map.on("click", "unclustered-point", handleStationClick);
      map.on("click", "unclustered-label", handleStationClick);

      // Pointer cursor handlers
      const setPointer = () => {
        map.getCanvas().style.cursor = "pointer";
      };
      const resetCursor = () => {
        map.getCanvas().style.cursor = "";
      };

      map.on("mouseenter", "clusters", setPointer);
      map.on("mouseleave", "clusters", resetCursor);
      map.on("mouseenter", "unclustered-point", setPointer);
      map.on("mouseleave", "unclustered-point", resetCursor);
      map.on("mouseenter", "unclustered-label", setPointer);
      map.on("mouseleave", "unclustered-label", resetCursor);

      setMapLoaded(true);
    });

    // Window and container resize observers (DS-4 Section 20)
    const resizeObserver =
      typeof ResizeObserver !== "undefined" && containerRef.current
        ? new ResizeObserver(() => {
            if (mapRef.current) {
              mapRef.current.resize();
            }
          })
        : null;

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);

    mapRef.current = map;

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [cartoApiKey]);

  // Update source data when stationsGeoJson updates
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource("stations") as
      | GeoJSONSource
      | undefined;
    if (source) {
      source.setData(stationsGeoJson);
    }
  }, [stationsGeoJson, mapLoaded]);

  // React to selectedStation changes (highlight ring, fly-to, and popup)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (!selectedStation) {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current.getLayer("selected-station-ring")) {
        mapRef.current.setFilter("selected-station-ring", ["==", ["get", "clubNumber"], -1]);
      }
      return;
    }

    if (mapRef.current.getLayer("selected-station-ring")) {
      mapRef.current.setFilter("selected-station-ring", [
        "==",
        ["get", "clubNumber"],
        selectedStation.clubNumber,
      ]);
    }

    if (suppressNextSelectionCameraRef.current) {
      suppressNextSelectionCameraRef.current = false;
      return;
    }

    const { latitude: lat, longitude: lng } = selectedStation;
    if (
      lat !== null &&
      lng !== null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      mapRef.current.easeTo({
        center: [lng, lat],
        zoom: Math.max(mapRef.current.getZoom(), 12),
        duration: 800,
        essential: true,
      });

      const feature = stationsGeoJson.features.find(
        (f) => f.properties.clubNumber === selectedStation.clubNumber,
      );
      if (feature) {
        showStationPopup([lng, lat], feature.properties, selectedStation);
      }
    }
  }, [selectedStation, mapLoaded, stationsGeoJson, showStationPopup]);

  const fitAllStations = () => {
    if (!mapRef.current || stationsGeoJson.features.length === 0) return;

    const bounds = new maplibregl.LngLatBounds();
    for (const f of stationsGeoJson.features) {
      bounds.extend(f.geometry.coordinates);
    }

    mapRef.current.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 13,
      duration: 1000,
    });
  };

  if (mapError) {
    return (
      <div className="map-container-wrapper">
        <div className="map-loading-placeholder">
          <p
            style={{
              color: "var(--color-text-muted)",
              padding: "1.5rem",
              textAlign: "center",
              maxWidth: "420px",
              lineHeight: 1.5,
            }}
          >
            {mapError}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container-wrapper">
      <div ref={containerRef} className="map-element" />
      <div className="map-overlay-controls">
        <button
          type="button"
          onClick={fitAllStations}
          className="map-control-btn"
          title="Fit map to all visible stations"
        >
          Fit All Stations
        </button>
      </div>
    </div>
  );
}

