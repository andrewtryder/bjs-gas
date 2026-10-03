import type { StationDto, StationFuel } from "../types";
import { formatPrice } from "../stats";

/**
 * Deterministically identifies the primary/regular gasoline fuel item from a station's fuels array.
 * Priority:
 * 1. Exact SKU '1' (standard BJ's Unleaded SKU)
 * 2. Name containing 'unleaded' or 'regular' (case-insensitive)
 * 3. First available fuel in array
 */
export function getPrimaryFuel(fuels: StationFuel[] | null | undefined): StationFuel | null {
  if (!fuels || fuels.length === 0) return null;

  // 1. Look for canonical SKU 1
  const sku1 = fuels.find((f) => f.sku === "1");
  if (sku1) return sku1;

  // 2. Look for name matches (unleaded or regular)
  const nameMatch = fuels.find((f) => {
    const lower = f.name.toLowerCase();
    return lower.includes("unleaded") || lower.includes("regular");
  });
  if (nameMatch) return nameMatch;

  // 3. Fallback to first fuel
  return fuels[0] ?? null;
}

/**
 * Resolves the display price for a station given an optional target fuel SKU.
 * If fuelSku is 'ALL' or omitted, uses the primary/regular fuel.
 */
export function getStationPrice(
  station: StationDto,
  targetFuelSku?: string,
): {
  fuel: StationFuel | null;
  priceNumeric: number | null;
  priceFormatted: string;
  isAvailable: boolean;
} {
  let matchedFuel: StationFuel | null = null;

  if (targetFuelSku && targetFuelSku !== "ALL") {
    matchedFuel = station.fuels.find((f: StationFuel) => f.sku === targetFuelSku) || null;
  } else {
    matchedFuel = getPrimaryFuel(station.fuels);
  }

  if (!matchedFuel) {
    return {
      fuel: null,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }

  const numeric = Number.parseFloat(matchedFuel.price);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      fuel: matchedFuel,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }

  return {
    fuel: matchedFuel,
    priceNumeric: numeric,
    priceFormatted: formatPrice(numeric),
    isAvailable: true,
  };
}

/**
 * Normalizes a fuel's public display label for UI controls and badges.
 * Standardizes "Unleaded" or "Regular Unleaded" to "Regular" while preserving other names (e.g. Premium, Diesel).
 */
export function formatFuelDisplayName(rawName: string): string {
  const lower = rawName.toLowerCase().trim();
  if (lower === "unleaded" || lower === "regular unleaded" || lower === "regular") {
    return "Regular";
  }
  if (lower === "premium unleaded" || lower === "premium") {
    return "Premium";
  }
  if (lower === "diesel") {
    return "Diesel";
  }
  return rawName;
}

/**
 * Extracts distinct fuel types found across all stations.
 */
export function getAvailableFuels(
  stations: StationDto[],
): Array<{ sku: string; name: string; count: number }> {
  const map = new Map<string, { sku: string; name: string; count: number }>();
  for (const s of stations) {
    for (const f of s.fuels) {
      const existing = map.get(f.sku);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(f.sku, { sku: f.sku, name: formatFuelDisplayName(f.name), count: 1 });
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    // Sort SKU 1 first, then 3, 4, etc.
    const numA = Number.parseInt(a.sku, 10);
    const numB = Number.parseInt(b.sku, 10);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return a.sku.localeCompare(b.sku);
  });
}

export interface CanonicalFuelPriceItem {
  fuel: StationFuel | null;
  priceNumeric: number | null;
  priceFormatted: string;
  isAvailable: boolean;
}

export interface CanonicalFuelPrices {
  regular: CanonicalFuelPriceItem;
  premium: CanonicalFuelPriceItem;
  diesel: CanonicalFuelPriceItem;
}

function resolveFuelPriceItem(fuel: StationFuel | null): CanonicalFuelPriceItem {
  if (!fuel) {
    return {
      fuel: null,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }
  const numeric = Number.parseFloat(fuel.price);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      fuel,
      priceNumeric: null,
      priceFormatted: "—",
      isAvailable: false,
    };
  }
  return {
    fuel,
    priceNumeric: numeric,
    priceFormatted: formatPrice(numeric),
    isAvailable: true,
  };
}

/**
 * Pure extraction helper returning canonical display fuel prices for a station:
 * regular, premium, and diesel.
 *
 * Uses SKU and normalized display name matching to ensure predictable scanning columns.
 */
export function getCanonicalFuelPrices(station: StationDto): CanonicalFuelPrices {
  const fuels = station.fuels || [];

  const regularFuel =
    fuels.find((f) => f.sku === "1") ||
    fuels.find((f) => {
      const lower = f.name.toLowerCase();
      return (lower.includes("unleaded") || lower.includes("regular")) && !lower.includes("premium");
    }) ||
    null;

  const premiumFuel =
    fuels.find((f) => f.sku === "3") ||
    fuels.find((f) => formatFuelDisplayName(f.name) === "Premium") ||
    fuels.find((f) => f.name.toLowerCase().includes("premium")) ||
    null;

  const dieselFuel =
    fuels.find((f) => f.sku === "4") ||
    fuels.find((f) => formatFuelDisplayName(f.name) === "Diesel") ||
    fuels.find((f) => f.name.toLowerCase().includes("diesel")) ||
    null;

  return {
    regular: resolveFuelPriceItem(regularFuel),
    premium: resolveFuelPriceItem(premiumFuel),
    diesel: resolveFuelPriceItem(dieselFuel),
  };
}

export interface MobileSecondaryFuelItem {
  label: string;
  price: string;
}

export interface MobileStationRowData {
  primaryFuelLabel: string;
  primaryPriceFormatted: string;
  secondaryFuels: MobileSecondaryFuelItem[];
}

/**
 * Pure helper for mobile ledger row layout.
 * Selects primary display fuel and secondary fuel pills based on selected filter fuel SKU.
 */
export function getMobileStationRowData(
  station: StationDto,
  selectedFuelSku: string = "ALL",
): MobileStationRowData {
  const prices = getCanonicalFuelPrices(station);
  const target = selectedFuelSku.trim().toLowerCase();

  // If Diesel is specifically selected
  if (target === "4" || target === "diesel") {
    const secondary: MobileSecondaryFuelItem[] = [];
    if (prices.regular.isAvailable) secondary.push({ label: "Regular", price: prices.regular.priceFormatted });
    if (prices.premium.isAvailable) secondary.push({ label: "Premium", price: prices.premium.priceFormatted });
    return {
      primaryFuelLabel: "Diesel",
      primaryPriceFormatted: prices.diesel.priceFormatted,
      secondaryFuels: secondary,
    };
  }

  // If Premium is specifically selected
  if (target === "3" || target === "premium") {
    const secondary: MobileSecondaryFuelItem[] = [];
    if (prices.regular.isAvailable) secondary.push({ label: "Regular", price: prices.regular.priceFormatted });
    if (prices.diesel.isAvailable) secondary.push({ label: "Diesel", price: prices.diesel.priceFormatted });
    return {
      primaryFuelLabel: "Premium",
      primaryPriceFormatted: prices.premium.priceFormatted,
      secondaryFuels: secondary,
    };
  }

  // Default: Regular is primary
  const secondary: MobileSecondaryFuelItem[] = [];
  if (prices.premium.isAvailable) secondary.push({ label: "Premium", price: prices.premium.priceFormatted });
  if (prices.diesel.isAvailable) secondary.push({ label: "Diesel", price: prices.diesel.priceFormatted });
  return {
    primaryFuelLabel: "Regular",
    primaryPriceFormatted: prices.regular.priceFormatted,
    secondaryFuels: secondary,
  };
}
