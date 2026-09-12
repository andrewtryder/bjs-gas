import type { PrismaClient } from "@prisma/client";
import { haversineDistanceMiles } from "../analytics/haversine.js";

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
  /** Convenience combined address for clients that prefer a single string. */
  address: string;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  fuels: StationFuel[];
};

function formatPrice(value: { toFixed: (n: number) => string } | string | number): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toFixed(3);
  return value.toFixed(3);
}

function toStationDto(club: {
  clubNumber: number;
  clubId: string;
  name: string;
  storeType: string | null;
  address1: string;
  address2: string | null;
  city: string;
  state: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  currentPrices: Array<{
    fuelSku: string;
    fuelName: string;
    price: { toFixed: (n: number) => string } | string | number;
    sourcePriceAtLocal: string | null;
    observedAt: Date;
  }>;
}): StationDto {
  return {
    clubNumber: club.clubNumber,
    clubId: club.clubId,
    name: club.name,
    storeType: club.storeType,
    address1: club.address1,
    address2: club.address2,
    address: [club.address1, club.address2].filter(Boolean).join(", "),
    city: club.city,
    state: club.state,
    postalCode: club.postalCode,
    latitude: club.latitude,
    longitude: club.longitude,
    fuels: club.currentPrices.map((p) => ({
      sku: p.fuelSku,
      name: p.fuelName,
      price: formatPrice(p.price),
      sourcePriceAtLocal: p.sourcePriceAtLocal,
      observedAt: p.observedAt.toISOString(),
    })),
  };
}

export async function listStationsWithPrices(prisma: PrismaClient): Promise<{
  generatedAt: string;
  stations: StationDto[];
}> {
  const clubs = await prisma.club.findMany({
    where: { hasGas: true },
    orderBy: { clubNumber: "asc" },
    include: {
      currentPrices: {
        orderBy: { fuelSku: "asc" },
      },
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    stations: clubs.map(toStationDto),
  };
}

export async function getStationWithPrices(
  prisma: PrismaClient,
  clubNumber: number,
): Promise<StationDto | null> {
  const club = await prisma.club.findUnique({
    where: { clubNumber },
    include: {
      currentPrices: { orderBy: { fuelSku: "asc" } },
    },
  });
  if (!club) return null;
  return toStationDto(club);
}

export async function getStationHistory(
  prisma: PrismaClient,
  clubNumber: number,
  options: { limit?: number } = {},
): Promise<
  Array<{
    fuelSku: string;
    fuelName: string;
    price: string;
    sourcePriceAtLocal: string | null;
    observedAt: string;
  }>
> {
  const limit = Math.min(Math.max(options.limit ?? 100, 1), 500);
  const rows = await prisma.fuelPriceHistory.findMany({
    where: { clubNumber },
    orderBy: { observedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    fuelSku: r.fuelSku,
    fuelName: r.fuelName,
    price: formatPrice(r.price),
    sourcePriceAtLocal: r.sourcePriceAtLocal,
    observedAt: r.observedAt.toISOString(),
  }));
}

export type NearbyStationDto = StationDto & {
  distanceMiles: number;
  distanceFormatted: string;
  regularPrice: string | null;
  priceDeltaVsTarget: string | null;
  priceDeltaFormatted: string | null;
};

export async function getNearbyStations(
  prisma: PrismaClient,
  clubNumber: number,
  options: { limit?: number | undefined; maxMiles?: number | undefined } = {},
): Promise<{
  targetStation: StationDto;
  nearby: NearbyStationDto[];
} | null> {
  const target = await prisma.club.findUnique({
    where: { clubNumber },
    include: {
      currentPrices: { orderBy: { fuelSku: "asc" } },
    },
  });

  if (!target) return null;
  const targetStation = toStationDto(target);

  if (targetStation.latitude == null || targetStation.longitude == null) {
    return { targetStation, nearby: [] };
  }

  const limit = Math.min(Math.max(options.limit ?? 5, 1), 50);
  const maxMiles = options.maxMiles;

  // Single bounded query fetching all gas stations with coordinates
  const candidates = await prisma.club.findMany({
    where: {
      hasGas: true,
      clubNumber: { not: clubNumber },
      latitude: { not: null },
      longitude: { not: null },
    },
    include: {
      currentPrices: { orderBy: { fuelSku: "asc" } },
    },
  });

  const targetRegularFuel = targetStation.fuels.find((f) => f.sku === "1");
  const targetRegularNum = targetRegularFuel ? Number.parseFloat(targetRegularFuel.price) : null;

  const resultsWithDistance: NearbyStationDto[] = [];

  for (const candidate of candidates) {
    const dist = haversineDistanceMiles(
      targetStation.latitude,
      targetStation.longitude,
      candidate.latitude,
      candidate.longitude,
    );

    if (dist == null) continue;
    if (maxMiles != null && dist > maxMiles) continue;

    const stationDto = toStationDto(candidate);
    const candidateRegularFuel = stationDto.fuels.find((f) => f.sku === "1");
    const candidateRegularNum = candidateRegularFuel
      ? Number.parseFloat(candidateRegularFuel.price)
      : null;

    let priceDeltaVsTarget: string | null = null;
    let priceDeltaFormatted: string | null = null;

    if (targetRegularNum != null && candidateRegularNum != null) {
      const diff = candidateRegularNum - targetRegularNum;
      priceDeltaVsTarget = (diff >= 0 ? "+" : "") + diff.toFixed(3);
      if (Math.abs(diff) < 0.0005) {
        priceDeltaFormatted = "Same price";
      } else if (diff < 0) {
        priceDeltaFormatted = `$${Math.abs(diff).toFixed(3)} cheaper`;
      } else {
        priceDeltaFormatted = `$${diff.toFixed(3)} more expensive`;
      }
    }

    resultsWithDistance.push({
      ...stationDto,
      distanceMiles: Number(dist.toFixed(1)),
      distanceFormatted: `${dist.toFixed(1)} miles`,
      regularPrice: candidateRegularFuel ? candidateRegularFuel.price : null,
      priceDeltaVsTarget,
      priceDeltaFormatted,
    });
  }

  resultsWithDistance.sort((a, b) => a.distanceMiles - b.distanceMiles);

  return {
    targetStation,
    nearby: resultsWithDistance.slice(0, limit),
  };
}

