import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function configureDatabaseUrl(databaseUrl: string): string {
  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "10");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "20");
    }
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: configureDatabaseUrl(databaseUrl) } },
  });
}

export function getPrisma(databaseUrl?: string): PrismaClient {
  if (client) return client;
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  client = createPrismaClient(url);
  return client;
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  await client.$disconnect();
  client = null;
}
