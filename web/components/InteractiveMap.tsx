"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { MAP_CONFIG } from "../lib/map-config";
import { formatPrice } from "../lib/stats";
import type {
  StationDto,
  StationFuel,
} from "../lib/types";
import type {
  StationGeoJsonCollection,
  StationGeoJsonProperties,
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
}

export default function InteractiveMap({
  stationsGeoJson,
  selectedStation,
  onSelectStation,
  stations,
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

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

      let fuelsHtml = "";
      if (station && station.fuels.length > 0) {
        fuelsHtml = `
          <div class="map-popup-fuels">
            ${station.fuels
              .map(
                (f: StationFuel) => `
              <div class="map-popup-fuel-item">
                <span class="map-popup-fuel-name">${escapeHtml(f.name)}</span>
                <span class="map-popup-fuel-price">${escapeHtml(formatPrice(f.price))}</span>
              </div>
            `,
              )
              .join("")}
          </div>
        `;
      } else {
        fuelsHtml = `
          <div class="map-popup-fuels">
            <div class="map-popup-fuel-item">
              <span class="map-popup-fuel-name">${escapeHtml(props.fuelName)}</span>
              <span class="map-popup-fuel-price">${escapeHtml(props.priceFormatted)}</span>
            </div>
          </div>
        `;
      }

      const html = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <h4 class="map-popup-title">${escapeHtml(props.name)}</h4>
            <span class="map-popup-club">Club #${props.clubNumber}</span>
          </div>
          <p class="map-popup-address">${escapeHtml(props.address)}, ${escapeHtml(props.city)}, ${escapeHtml(props.state)} ${escapeHtml(props.postalCode)}</p>
          ${fuelsHtml}
          <div class="map-popup-footer">
            <a href="/stations/${props.clubNumber}" class="map-popup-link">
              Station Details &amp; History &rarr;
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
    [],
  );

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_CONFIG.style,
      center: MAP_CONFIG.defaultCenter,
      zoom: MAP_CONFIG.defaultZoom,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
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
            "#2563eb",
            5,
            "#1d4ed8",
            15,
            "#0f172a",
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
          "circle-stroke-color": "#ffffff",
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
          "text-font": ["Noto Sans Regular", "Open Sans Regular"],
          "text-size": 13,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      // Individual station circles
      map.addLayer({
        id: "unclustered-point",
        type: "circle",
        source: "stations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": 8,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
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
          "text-font": ["Noto Sans Regular", "Open Sans Regular"],
          "text-size": 12,
          "text-offset": [0, 1.4],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#0f172a",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2,
        },
      });

      // Click on cluster -> zoom in
      map.on("click", "clusters", (e) => {
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
          stations.find((s) => s.clubNumber === Number(props.clubNumber)) ||
          null;

        onSelectStation(station);
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

    mapRef.current = map;

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [showStationPopup, stations, stationsGeoJson, onSelectStation]);

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

  // React to selectedStation changes (fly-to and popup)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (selectedStation) {
      const { latitude: lat, longitude: lng } = selectedStation;
      if (
        lat !== null &&
        lng !== null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        mapRef.current.flyTo({
          center: [lng, lat],
          zoom: Math.max(mapRef.current.getZoom(), 12),
          essential: true,
        });

        const feature = stationsGeoJson.features.find(
          (f) => f.properties.clubNumber === selectedStation.clubNumber,
        );
        if (feature) {
          showStationPopup([lng, lat], feature.properties, selectedStation);
        }
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
