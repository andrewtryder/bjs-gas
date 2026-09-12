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
