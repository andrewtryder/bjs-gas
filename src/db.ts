import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { PrismaClient } from "./generated/prisma/client.js";

const DEFAULT_POOL_MAX = 10;
const DEFAULT_CONNECTION_TIMEOUT_MS = 10_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_LIFETIME_SECONDS = 1800;
const DEFAULT_STATEMENT_TIMEOUT_MS = 20_000;

let client: PrismaClient | null = null;

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildPoolConfig(
  databaseUrl: string,
  overrides: Partial<PoolConfig> = {},
): PoolConfig {
  let max = DEFAULT_POOL_MAX;
  let connectionTimeoutMillis = DEFAULT_CONNECTION_TIMEOUT_MS;
  let statementTimeout = DEFAULT_STATEMENT_TIMEOUT_MS;
  let options: string | undefined;

  try {
    const url = new URL(databaseUrl);
    max = parsePositiveInt(url.searchParams.get("connection_limit"), DEFAULT_POOL_MAX);
    const connectParam = url.searchParams.get("connect_timeout");
    if (connectParam) {
      connectionTimeoutMillis = parsePositiveInt(connectParam, 10) * 1000;
    }
    const socketParam = url.searchParams.get("socket_timeout");
    if (socketParam) {
      statementTimeout = parsePositiveInt(socketParam, 20) * 1000;
    }
    options = url.searchParams.get("options") ?? undefined;
  } catch {
    // Keep defaults for non-URL connection strings.
  }

  return {
    connectionString: databaseUrl,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis: DEFAULT_IDLE_TIMEOUT_MS,
    maxLifetimeSeconds: DEFAULT_MAX_LIFETIME_SECONDS,
    statement_timeout: statementTimeout,
    ...(options ? { options } : {}),
    ...overrides,
  };
}

export function createPrismaClient(
  databaseUrl: string,
  poolOverrides: Partial<PoolConfig> = {},
): PrismaClient {
  const adapter = new PrismaPg(buildPoolConfig(databaseUrl, poolOverrides), {
    onPoolError: (err) => {
      console.error(
        JSON.stringify({
          event: "pg_pool_idle_error",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    },
  });
  return new PrismaClient({ adapter });
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

export async function disconnectPrismaClient(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

export async function disconnectPrisma(): Promise<void> {
  if (!client) return;
  const current = client;
  client = null;
  await disconnectPrismaClient(current);
}
