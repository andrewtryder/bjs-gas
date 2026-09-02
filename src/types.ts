export type GasStatus = "yes" | "no" | "unknown";

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
