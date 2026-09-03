export type GasStatus = "yes" | "no" | "unknown";

/** Locator StoreType / derived location kind. */
export type LocationStoreType = "CLUB" | "GAS" | "DC" | "COMING_SOON" | "UNKNOWN";

export type GasClassification = {
  /** Authoritative classifier — always locator for registry records. */
  source: "locator";
  signals: string[];
};

export type BjsClub = {
  clubNumber: number;
  clubId: string;
  name: string;
  city: string;
  state: string;
  postalCode: string;
  address1: string;
  address2?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  services: string[];
  hasGas: boolean;
  gasStatus: GasStatus;
  /** Locator StoreType (or COMING_SOON / UNKNOWN when derived). */
  storeType: LocationStoreType;
  /** Operational provenance for why hasGas was set; not for public map UI. */
  gasClassification: GasClassification;
  clubUrl?: string | null;
  source: string;
};

export type DiscoverySummary = {
  generatedAt: string;
  totalClubs: number;
  gasClubs: number;
  nonGasClubs: number;
  unknownGasStatus: number;
  discoveryMethod: string;
  sourceEndpoints: string[];
};

/** Coerce older clubs.json rows missing storeType / gasClassification. */
export function coerceClub(raw: Partial<BjsClub> & {
  clubNumber: number;
  clubId: string;
  name: string;
  city: string;
  state: string;
  postalCode: string;
  address1: string;
  services: string[];
  hasGas: boolean;
  gasStatus: GasStatus;
  source: string;
}): BjsClub {
  return {
    clubNumber: raw.clubNumber,
    clubId: raw.clubId,
    name: raw.name,
    city: raw.city,
    state: raw.state,
    postalCode: raw.postalCode,
    address1: raw.address1,
    address2: raw.address2 ?? null,
    latitude: raw.latitude ?? null,
    longitude: raw.longitude ?? null,
    phone: raw.phone ?? null,
    services: raw.services ?? [],
    hasGas: raw.hasGas,
    gasStatus: raw.gasStatus,
    storeType: raw.storeType ?? "UNKNOWN",
    gasClassification: raw.gasClassification ?? { source: "locator", signals: [] },
    clubUrl: raw.clubUrl ?? null,
    source: raw.source,
  };
}
