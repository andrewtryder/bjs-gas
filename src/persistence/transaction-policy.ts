/**
 * Detects server-closed or broken database connections where retrying
 * transaction acquisition is safe BEFORE any transaction callback work has started.
 *
 * Prefers structured Prisma error codes (e.g. P1017) and only falls back to
 * narrow, explicit error messages representing closed connection sockets.
 * Unrelated query errors, syntax errors, pool timeouts (P2024), transaction timeouts,
 * or statement_timeout are explicitly excluded.
 */
export function isClosedConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const err = error as {
    code?: unknown;
    errorCode?: unknown;
    message?: unknown;
    meta?: { driverAdapterError?: { cause?: { kind?: unknown; message?: unknown } } };
    cause?: { code?: unknown; message?: unknown };
  };

  const code =
    typeof err.code === "string"
      ? err.code
      : typeof err.errorCode === "string"
        ? err.errorCode
        : undefined;

  // Fail-closed on structured Prisma codes:
  // P1017 is the only recognized retryable closed connection code.
  // Any other Prisma code (Pxxxx) is strictly non-retryable.
  if (code === "P1017") {
    return true;
  }
  if (code?.startsWith("P")) {
    return false;
  }

  // When no structured Prisma code exists, inspect driver adapter structured cause.
  if (err.meta?.driverAdapterError?.cause?.kind === "ConnectionClosed") {
    return true;
  }

  // Check error message and cause message with narrow fallback
  const message = `${typeof err.message === "string" ? err.message : ""} ${
    typeof err.cause?.message === "string" ? err.cause.message : ""
  }`;

  // Explicit exclusions on message content
  if (
    /statement_timeout|canceling statement due to statement timeout/i.test(message) ||
    /timed out fetching a connection from the pool/i.test(message)
  ) {
    return false;
  }

  // Narrow string fallback for direct node-pg / socket drop messages
  if (
    /Server has closed the connection/i.test(message) ||
    /Connection terminated unexpectedly/i.test(message)
  ) {
    return true;
  }

  return false;
}
