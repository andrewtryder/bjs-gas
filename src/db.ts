import { PrismaClient } from "@prisma/client";

let client: PrismaClient | null = null;

export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
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
