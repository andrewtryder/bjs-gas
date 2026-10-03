import type { PrismaClient } from "@prisma/client";

/**
 * Idempotent bulk upsert of clubs.
 * Never DELETEs clubs omitted from the payload — discovery absence must not
 * remove registry rows or flip hasGas via eisapi/sitemap.
 */
export async function importClubsBulk(
  prisma: PrismaClient,
  clubs: Array<{
    clubNumber: number;
    clubId: string;
    name: string;
    address1: string;
    address2: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    phone: string | null;
    hasGas: boolean;
    storeType: string | null;
    gasClassification: { source: string; signals: string[] } | null;
    services: string[];
    clubUrl: string | null;
    source: string | null;
  }>,
): Promise<{ upserted: number }> {
  if (clubs.length === 0) return { upserted: 0 };

  const payload = clubs.map((c) => ({
    club_number: c.clubNumber,
    club_id: c.clubId,
    name: c.name,
    address1: c.address1,
    address2: c.address2,
    city: c.city,
    state: c.state,
    postal_code: c.postalCode,
    latitude: c.latitude,
    longitude: c.longitude,
    phone: c.phone,
    has_gas: c.hasGas,
    store_type: c.storeType,
    gas_classification: c.gasClassification,
    services: c.services,
    club_url: c.clubUrl,
    source: c.source,
  }));

  const result = await prisma.$executeRaw`
    INSERT INTO "Club" (
      "clubNumber", "clubId", "name", "address1", "address2", "city", "state", "postalCode",
      "latitude", "longitude", "phone", "hasGas", "storeType", "gasClassification",
      "services", "clubUrl", "source", "createdAt", "updatedAt"
    )
    SELECT
      club_number,
      club_id,
      name,
      address1,
      NULLIF(address2, ''),
      city,
      state,
      postal_code,
      latitude,
      longitude,
      NULLIF(phone, ''),
      has_gas,
      NULLIF(store_type, ''),
      gas_classification,
      COALESCE(
        (SELECT array_agg(elem) FROM jsonb_array_elements_text(COALESCE(services, '[]'::jsonb)) AS elem),
        ARRAY[]::text[]
      ),
      NULLIF(club_url, ''),
      NULLIF(source, ''),
      NOW(),
      NOW()
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb)
      AS x(
        club_number int,
        club_id text,
        name text,
        address1 text,
        address2 text,
        city text,
        state text,
        postal_code text,
        latitude double precision,
        longitude double precision,
        phone text,
        has_gas boolean,
        store_type text,
        gas_classification jsonb,
        services jsonb,
        club_url text,
        source text
      )
    ON CONFLICT ("clubNumber") DO UPDATE SET
      "clubId" = EXCLUDED."clubId",
      "name" = EXCLUDED."name",
      "address1" = EXCLUDED."address1",
      "address2" = EXCLUDED."address2",
      "city" = EXCLUDED."city",
      "state" = EXCLUDED."state",
      "postalCode" = EXCLUDED."postalCode",
      "latitude" = EXCLUDED."latitude",
      "longitude" = EXCLUDED."longitude",
      "phone" = EXCLUDED."phone",
      "hasGas" = EXCLUDED."hasGas",
      "storeType" = EXCLUDED."storeType",
      "gasClassification" = EXCLUDED."gasClassification",
      "services" = EXCLUDED."services",
      "clubUrl" = EXCLUDED."clubUrl",
      "source" = EXCLUDED."source",
      "updatedAt" = NOW()
  `;

  return { upserted: typeof result === "number" ? result : clubs.length };
}
