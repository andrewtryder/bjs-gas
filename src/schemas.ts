import { z } from "zod";

export const storeAttributeSchema = z
  .object({
    name: z.string().optional(),
    displayName: z.string().optional(),
    value: z.string().optional(),
    displayValue: z.string().optional(),
  })
  .passthrough();

export const physicalStoreSchema = z
  .object({
    storeName: z.string(),
    uniqueID: z.union([z.string(), z.number()]).optional(),
    city: z.string().optional(),
    stateOrProvinceName: z.string().optional(),
    postalCode: z.string().optional(),
    addressLine: z.array(z.string()).optional(),
    latitude: z.union([z.string(), z.number()]).optional(),
    longitude: z.union([z.string(), z.number()]).optional(),
    telephone1: z.string().optional(),
    Description: z
      .array(
        z
          .object({
            displayStoreName: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    Attribute: z.array(storeAttributeSchema).optional(),
  })
  .passthrough();

export const clubSearchResponseSchema = z
  .object({
    Stores: z
      .object({
        PhysicalStore: z.array(physicalStoreSchema).default([]),
      })
      .optional(),
    message: z.string().optional(),
  })
  .passthrough();

export const stateTownsResponseSchema = z
  .object({
    clubLocatorStateTownList: z
      .array(
        z
          .object({
            StateName: z.string(),
            StateCode: z.string(),
            Towns: z.array(z.string()),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

export type PhysicalStore = z.infer<typeof physicalStoreSchema>;
export type ClubSearchResponse = z.infer<typeof clubSearchResponseSchema>;
