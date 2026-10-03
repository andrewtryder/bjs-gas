import type { StationDto, StationFuel } from "../types";
import { getStationPrice } from "./fuels";

export interface StationGeoJsonProperties {
  clubNumber: number;
  clubId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  priceFormatted: string;
  priceNumeric: number | null;
  fuelName: string;
  fuelSku: string;
  hasPrice: boolean;
  observedAt: string | null;
}

export interface StationGeoJsonFeature {
  type: "Feature";
  geometry: {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
  };
  properties: StationGeoJsonProperties;
}

export interface StationGeoJsonCollection {
  type: "FeatureCollection";
  features: StationGeoJsonFeature[];
}

/**
 * Converts stations to a GeoJSON FeatureCollection for MapLibre GL.
 * Strictly validates coordinates: lat must be between -90 and 90, lng between -180 and 180.
 * Any missing or invalid coordinates are safely omitted.
 */
export function stationsToGeoJson(
  stations: StationDto[],
  targetFuelSku?: string,
): StationGeoJsonCollection {
  const features: StationGeoJsonFeature[] = [];

  for (const s of stations) {
    const lat = s.latitude;
    const lng = s.longitude;

    if (
      lat === null ||
      lat === undefined ||
      lng === null ||
      lng === undefined ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      continue;
    }

    const priceInfo = getStationPrice(s, targetFuelSku);

    // Get latest observation timestamp for this station
    const latestObs =
      s.fuels.length > 0
        ? s.fuels.reduce((latest: string, f: StationFuel) =>
            new Date(f.observedAt) > new Date(latest) ? f.observedAt : latest,
          s.fuels[0]!.observedAt)
        : null;

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
      properties: {
        clubNumber: s.clubNumber,
        clubId: s.clubId,
        name: s.name,
        address: s.address,
        city: s.city,
        state: s.state,
        postalCode: s.postalCode,
        priceFormatted: priceInfo.priceFormatted,
        priceNumeric: priceInfo.priceNumeric,
        fuelName: priceInfo.fuel?.name || "Fuel",
        fuelSku: priceInfo.fuel?.sku || "",
        hasPrice: priceInfo.isAvailable,
        observedAt: latestObs,
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}
