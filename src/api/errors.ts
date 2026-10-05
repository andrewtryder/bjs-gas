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

/**
 * Extracts and formats structured error details from an HTTP response,
 * preserving backend error codes (e.g. P2024, database_overloaded, etc.)
 * for diagnostic logs, Honeybadger, and user-facing error banners.
 */
export async function parseApiErrorMessage(
  res: { status: number; statusText: string; text?: () => Promise<string> },
  fallbackPrefix: string,
): Promise<string> {
  const statusInfo = `${res.status} ${res.statusText}`.trim();
  let detail = "";
  if (typeof res.text === "function") {
    try {
      const rawText = await res.text();
      if (rawText) {
        try {
          const json = JSON.parse(rawText);
          if (json && typeof json === "object") {
            const parts: string[] = [];
            if ("code" in json && json.code) parts.push(String(json.code));
            if ("error" in json && json.error) parts.push(String(json.error));
            if ("reason" in json && json.reason) parts.push(String(json.reason));
            if ("message" in json && json.message) parts.push(String(json.message));
            detail = parts.join(": ");
          }
        } catch {
          const stripped = rawText.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
          if (stripped) {
            detail = stripped.length > 120 ? `${stripped.slice(0, 117)}...` : stripped;
          }
        }
      }
    } catch {
      // Ignore response read errors
    }
  }
  const detailSuffix = detail ? ` (${detail})` : "";
  return `${fallbackPrefix}: ${statusInfo}${detailSuffix}`;
}

