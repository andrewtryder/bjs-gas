import type { FuelStats, StationDto } from "./types";

export function formatPrice(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const num = typeof value === "number" ? value : Number.parseFloat(value);
  if (!Number.isFinite(num)) return "—";
  return `$${num.toFixed(3)}`;
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return (
      d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      }) + " UTC"
    );
  } catch {
    return isoString;
  }
}

export function calculateFuelStats(stations: StationDto[]): FuelStats | null {
  if (!stations || stations.length === 0) return null;

  // Count occurrences of each fuel across stations
  const fuelCounts = new Map<string, { sku: string; name: string; count: number }>();
  for (const station of stations) {
    for (const fuel of station.fuels) {
      const key = `${fuel.sku}|${fuel.name}`;
      const existing = fuelCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        fuelCounts.set(key, { sku: fuel.sku, name: fuel.name, count: 1 });
      }
    }
  }

  if (fuelCounts.size === 0) return null;

  // Pick the target fuel:
  // 1. Look for standard/regular fuel (e.g. name matching 'regular' or 'unleaded', or SKU '1')
  // 2. Fall back to the most common fuel across all stations
  let targetFuel: { sku: string; name: string; count: number } | null = null;

  for (const info of fuelCounts.values()) {
    const lowerName = info.name.toLowerCase();
    if (lowerName.includes("regular") || lowerName.includes("unleaded") || info.sku === "1") {
      if (!targetFuel || info.count > targetFuel.count) {
        targetFuel = info;
      }
    }
  }

  if (!targetFuel) {
    // Fall back to most common
    for (const info of fuelCounts.values()) {
      if (!targetFuel || info.count > targetFuel.count) {
        targetFuel = info;
      }
    }
  }

  if (!targetFuel) return null;

  // Gather prices for target fuel
  const entries: Array<{ station: StationDto; price: number }> = [];
  for (const station of stations) {
    const fuel = station.fuels.find((f) => f.sku === targetFuel!.sku || f.name === targetFuel!.name);
    if (fuel) {
      const p = Number.parseFloat(fuel.price);
      if (Number.isFinite(p) && p > 0) {
        entries.push({ station, price: p });
      }
    }
  }

  if (entries.length === 0) {
    return {
      fuelName: targetFuel.name,
      fuelSku: targetFuel.sku,
      totalStations: stations.length,
      stationsWithFuel: 0,
      medianPrice: null,
      cheapestStation: null,
      mostExpensiveStation: null,
    };
  }

  // Sort prices ascending
  entries.sort((a, b) => a.price - b.price);

  // Median
  const mid = Math.floor(entries.length / 2);
  const medianPrice =
    entries.length % 2 === 1
      ? entries[mid]!.price
      : (entries[mid - 1]!.price + entries[mid]!.price) / 2;

  const cheapestStation = entries[0]!;
  const mostExpensiveStation = entries[entries.length - 1]!;

  return {
    fuelName: targetFuel.name,
    fuelSku: targetFuel.sku,
    totalStations: stations.length,
    stationsWithFuel: entries.length,
    medianPrice,
    cheapestStation,
    mostExpensiveStation,
  };
}
