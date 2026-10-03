import { z } from "zod";

/**
 * Canonical upstream BJ's fuel-price HTTP payload.
 *
 * This module describes the wire contract only. It does not include
 * persistence DTOs, collection results, health/status types, Prisma types,
 * or price-normalization policy.
 *
 * There is one item schema and one envelope schema. The item schema is the
 * usable-product contract used by the collector; probing uses the same
 * schemas rather than a looser duplicate. Consequences:
 * - malformed/incomplete product rows fail schema validation (probe error),
 *   they are not treated as successful observations or as has_products;
 * - `fuelPriceResponse` absent or `data: []` is a valid envelope (empty
 *   products). That is inconclusive for gas membership and must not be
 *   interpreted as `hasGas === false`.
 */
export const fuelPriceItemSchema = z
  .object({
    name: z.string().min(1),
    sku: z.union([z.string(), z.number()]).transform((v) => String(v)),
    price: z.number().finite(),
    priceDateTime: z.string().optional().nullable(),
  })
  .passthrough();

export const fuelPriceEnvelopeSchema = z
  .object({
    response: z
      .object({
        fuelPriceResponse: z
          .object({
            data: z.array(fuelPriceItemSchema).default([]),
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

export type FuelPriceItem = z.infer<typeof fuelPriceItemSchema>;
export type FuelPriceEnvelope = z.infer<typeof fuelPriceEnvelopeSchema>;

export function fuelProductsFromEnvelope(envelope: FuelPriceEnvelope): FuelPriceItem[] {
  return envelope.response.fuelPriceResponse?.data ?? [];
}
