export const PRISMA_POOL_TIMEOUT_CODE = "P2024";

export const prismaPoolTimeoutBody = {
  error: "database_pool_timeout",
  code: PRISMA_POOL_TIMEOUT_CODE,
  message: "Database connection pool exhausted. Please retry.",
} as const;

/**
 * Detects Prisma connection-pool exhaustion (P2024).
 * This is an overload signal, not a retryable closed-connection (P1017).
 */
export function isPrismaPoolTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === PRISMA_POOL_TIMEOUT_CODE
  );
}
