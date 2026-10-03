export type FuelDescriptor = {
  sku: string;
  name: string;
};

export type NationalSummaryStation = {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
};

export type NationalSummaryResponse = {
  generatedAt: string;
  fuel: FuelDescriptor;
  stationCount: number;
  medianPrice: string | null;
  min: { price: string; station: NationalSummaryStation } | null;
  max: { price: string; station: NationalSummaryStation } | null;
};

export type TrendPoint = {
  date: string;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
  stationCount: number;
};

export type NationalTrendsResponse = {
  generatedAt: string;
  fuel: FuelDescriptor;
  days: number;
  state?: string | undefined;
  points: TrendPoint[];
};

export type StateSummaryItem = {
  state: string;
  stationCount: number;
  medianPrice: string;
  minPrice: string;
  maxPrice: string;
};

export type StateSummariesResponse = {
  generatedAt: string;
  fuel: FuelDescriptor;
  states: StateSummaryItem[];
};

export type PriceMoverItem = {
  clubNumber: number;
  name: string;
  city: string;
  state: string;
  fuel: FuelDescriptor;
  startingPrice: string;
  currentPrice: string;
  absoluteChange: string;
  percentageChange: string;
  startObservedAt: string;
  currentObservedAt: string;
};

export type PriceMoversResponse = {
  generatedAt: string;
  fuel: FuelDescriptor;
  days: number;
  increases: PriceMoverItem[];
  decreases: PriceMoverItem[];
};
