import { z } from "zod";

export const fuelItemSchema = z
  .object({
    name: z.string().min(1),
    sku: z.union([z.string(), z.number()]).transform((v) => String(v)),
    price: z.number().finite(),
    priceDateTime: z.string().optional().nullable(),
  })
  .passthrough();

export const fuelEnvelopeSchema = z
  .object({
    response: z
      .object({
        fuelPriceResponse: z
          .object({
            data: z.array(fuelItemSchema).default([]),
          })
          .passthrough()
          .optional(),
        statusCode: z.number().optional(),
        statusMsg: z.string().optional(),
        transactionDateTime: z.string().optional(),
      })
      .passthrough(),
  })
  .passthrough();

export type FuelItem = z.infer<typeof fuelItemSchema>;

export type FuelObservation = {
  clubNumber: number;
  fuelSku: string;
  fuelName: string;
  /** Exact decimal string with 3 fractional digits, e.g. "3.919" */
  price: string;
  sourcePriceAtLocal: string | null;
  observedAt: string;
};

export type ClubFailure = {
  clubNumber: number;
  status?: number | undefined;
  attempts: number;
  error: string;
};

export type CollectionResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  clubsConfigured: number;
  clubsAttempted: number;
  clubsSucceeded: number;
  clubsFailed: number;
  /** Configured gas clubs that returned HTTP-success envelopes with empty data[]. */
  clubsEmptyFuels: number;
  fuelObservations: number;
  historyChanges: number;
  databaseQueries: number;
  degraded: boolean;
  failures: ClubFailure[];
};

export type PersistStats = {
  observationsReceived: number;
  currentRowsUpserted: number;
  historyRowsInserted: number;
  databaseQueries: number;
};

/** Summary written into CollectionRun in the same bulk SQL as prices. */
export type CollectionRunInput = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  clubsConfigured: number;
  clubsSucceeded: number;
  clubsEmptyFuels: number;
  clubsHardFailed: number;
  fuelObservations: number;
  degraded: boolean;
  failures: ClubFailure[];
};

/** Normalize a BJ's float price into an exact 3-decimal string. */
export function normalizePrice(price: number): string {
  if (!Number.isFinite(price)) {
    throw new Error(`Invalid price: ${price}`);
  }
  // Avoid IEEE compare pitfalls by formatting via integer mills.
  const mills = Math.round(price * 1000);
  const negative = mills < 0;
  const abs = Math.abs(mills);
  const whole = Math.floor(abs / 1000);
  const frac = String(abs % 1000).padStart(3, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

const LOCAL_DT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

export function normalizeSourcePriceAtLocal(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Accept with or without fractional seconds; store without timezone and without fraction.
  const base = trimmed.includes(".") ? trimmed.slice(0, trimmed.indexOf(".")) : trimmed;
  if (!LOCAL_DT_RE.test(base)) {
    // Keep validated-ish raw local string if close; otherwise null.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 19);
    }
    return null;
  }
  return base;
}

export function observationsFromFuelResponse(
  clubNumber: number,
  payload: unknown,
  observedAt: string,
): FuelObservation[] {
  const parsed = fuelEnvelopeSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(`Malformed fuel response: ${parsed.error.message}`);
  }
  const data = parsed.data.response.fuelPriceResponse?.data ?? [];
  if (data.length === 0) {
    throw new Error("Empty fuel array");
  }
  return data.map((item) => ({
    clubNumber,
    fuelSku: item.sku,
    fuelName: item.name,
    price: normalizePrice(item.price),
    sourcePriceAtLocal: normalizeSourcePriceAtLocal(item.priceDateTime),
    observedAt,
  }));
}

/** Last-write-wins by clubNumber+fuelSku for deterministic bulk payloads. */
export function dedupeObservations(observations: FuelObservation[]): FuelObservation[] {
  const map = new Map<string, FuelObservation>();
  for (const obs of observations) {
    map.set(`${obs.clubNumber}|${obs.fuelSku}`, obs);
  }
  return [...map.values()].sort((a, b) =>
    a.clubNumber === b.clubNumber
      ? a.fuelSku.localeCompare(b.fuelSku)
      : a.clubNumber - b.clubNumber,
  );
}
