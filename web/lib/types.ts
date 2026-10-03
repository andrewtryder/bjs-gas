export type {
  FuelPriceHistoryItem,
  NearbyStationDto,
  NearbyStationsResponse,
  StationDetailResponse,
  StationDto,
  StationFuel,
  StationHistoryResponse,
  StationsResponse,
  SystemStatusResponse,
} from "@bjs-gas/contracts";

import type { StationDto } from "@bjs-gas/contracts";

export type FuelStats = {
  fuelName: string;
  fuelSku: string;
  totalStations: number;
  stationsWithFuel: number;
  medianPrice: number | null;
  cheapestStation: {
    station: StationDto;
    price: number;
  } | null;
  mostExpensiveStation: {
    station: StationDto;
    price: number;
  } | null;
};

