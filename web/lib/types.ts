export type StationFuel = {
  sku: string;
  name: string;
  price: string;
  sourcePriceAtLocal: string | null;
  observedAt: string;
};

export type StationDto = {
  clubNumber: number;
  clubId: string;
  name: string;
  storeType: string | null;
  address1: string;
  address2: string | null;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  fuels: StationFuel[];
};

export type StationsResponse = {
  generatedAt: string;
  stations: StationDto[];
};

export type StationDetailResponse = {
  generatedAt: string;
  station: StationDto;
};

export type FuelPriceHistoryItem = {
  fuelSku: string;
  fuelName: string;
  price: string;
  sourcePriceAtLocal: string | null;
  observedAt: string;
};

export type StationHistoryResponse = {
  clubNumber: number;
  history: FuelPriceHistoryItem[];
};

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

export type NearbyStationDto = StationDto & {
  distanceMiles: number;
  distanceFormatted: string;
  regularPrice: string | null;
  priceDeltaVsTarget: string | null;
  priceDeltaFormatted: string | null;
};

export type NearbyStationsResponse = {
  generatedAt: string;
  clubNumber: number;
  station: StationDto;
  nearby: NearbyStationDto[];
};

export type SystemStatusResponse = {
  ok: true;
  healthy: boolean;
  unhealthyReasons: string[];
  lastCollection: {
    startedAt: string;
    finishedAt: string;
    durationMs: number;
    clubsConfigured: number;
    clubsSucceeded: number;
    clubsEmptyFuels: number;
    clubsHardFailed: number;
    clubsFailed: number;
    fuelObservations: number;
    historyChanges: number;
    databaseQueries: number;
    degraded: boolean;
  } | null;
  freshness: {
    latestObservedAt: string | null;
    oldestObservedAt: string | null;
    currentPriceRows: number;
    stationsObservedRecently: number;
    freshWindowMinutes: number;
  };
  configuredGasClubs: number;
};

