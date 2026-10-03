import { describe, expect, it } from "vitest";
import type {
  NationalSummaryResponse,
  StationDto,
  SystemStatusResponse,
} from "@bjs-gas/contracts";
import type { NationalSummaryResult } from "../src/analytics/queries.js";
import type { StationDto as ApiStationDto } from "../src/api/stations.js";
import type { StatusPayload } from "../src/api/status.js";
import type {
  StationDto as WebStationDto,
  SystemStatusResponse as WebSystemStatusResponse,
} from "../web/lib/types.js";

const station: StationDto = {
  clubNumber: 1,
  clubId: "1",
  name: "Example",
  storeType: "Warehouse",
  address1: "1 Main Street",
  address2: null,
  address: "1 Main Street",
  city: "Exampletown",
  state: "MA",
  postalCode: "00000",
  latitude: 42,
  longitude: -71,
  fuels: [
    {
      sku: "1",
      name: "Unleaded",
      price: "3.000",
      sourcePriceAtLocal: null,
      observedAt: "2026-10-03T10:45:39.573Z",
    },
  ],
};

const status: SystemStatusResponse = {
  ok: true,
  healthy: true,
  unhealthyReasons: [],
  lastAttemptedCollection: null,
  lastSuccessfulCollection: null,
  lastCollection: null,
  collectionLock: {
    inProgress: false,
    startedAt: null,
    ageMs: null,
    ageSeconds: null,
    overExpectedDuration: false,
    stale: false,
  },
  freshness: {
    latestObservedAt: null,
    oldestObservedAt: null,
    currentPriceRows: 0,
    stationsObservedRecently: 0,
    freshStationRatio: 0,
    freshWindowMinutes: 180,
  },
  configuredGasClubs: 0,
};

describe("shared HTTP contracts", () => {
  it("keeps station DTO shims structurally compatible", () => {
    const apiStation: ApiStationDto = station;
    const webStation: WebStationDto = apiStation;

    expect(webStation).toEqual(station);
  });

  it("keeps the complete status payload available to both API and web", () => {
    const apiStatus: StatusPayload = status;
    const webStatus: WebSystemStatusResponse = apiStatus;

    expect(webStatus.lastAttemptedCollection).toBeNull();
    expect(webStatus.freshness.freshStationRatio).toBe(0);
  });

  it("keeps analytics result aliases compatible with the public contract", () => {
    const summary: NationalSummaryResponse = {
      generatedAt: "2026-10-03T10:45:43.487Z",
      fuel: { sku: "1", name: "Unleaded" },
      stationCount: 1,
      medianPrice: "3.000",
      min: { price: "3.000", station: { clubNumber: 1, name: "Example", city: "Exampletown", state: "MA" } },
      max: { price: "3.000", station: { clubNumber: 1, name: "Example", city: "Exampletown", state: "MA" } },
    };
    const apiSummary: NationalSummaryResult = summary;

    expect(apiSummary.fuel.sku).toBe("1");
  });
});
