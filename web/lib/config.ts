import webService from "../src/service.js";

/**
 * Safely retrieve the CARTO API Key.
 *
 * Checks:
 * 1. Prisma Composer service input (production Compute)
 * 2. process.env.CARTO_API_KEY (local .env / build)
 * 3. process.env.NEXT_PUBLIC_CARTO_API_KEY (optional fallback)
 *
 * Returns null if absent or empty. Never throws.
 */
export function getCartoApiKey(): string | null {
  try {
    const input = webService.input() as Record<string, any> | undefined;
    if (input?.cartoApiKey) {
      const val =
        typeof input.cartoApiKey.expose === "function"
          ? input.cartoApiKey.expose()
          : String(input.cartoApiKey);
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }
  } catch {
    // Outside Composer runtime (e.g. Next dev or build)
  }

  const envKey =
    process.env.CARTO_API_KEY || process.env.NEXT_PUBLIC_CARTO_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return null;
}

/**
 * Safely retrieve the Honeybadger Project Reporting API Key.
 *
 * Checks:
 * 1. Prisma Composer service input (production Compute)
 * 2. process.env.HONEYBADGER_API_KEY (local .env / build)
 * 3. process.env.NEXT_PUBLIC_HONEYBADGER_API_KEY (optional fallback)
 *
 * Returns null if absent or empty. Never throws.
 */
export function getHoneybadgerApiKey(): string | null {
  try {
    const input = webService.input() as Record<string, any> | undefined;
    if (input?.honeybadgerApiKey) {
      const val =
        typeof input.honeybadgerApiKey.expose === "function"
          ? input.honeybadgerApiKey.expose()
          : String(input.honeybadgerApiKey);
      if (val && val.trim().length > 0) {
        return val.trim();
      }
    }
  } catch {
    // Outside Composer runtime
  }

  const envKey =
    process.env.HONEYBADGER_API_KEY ||
    process.env.NEXT_PUBLIC_HONEYBADGER_API_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }

  return null;
}

/**
 * Determines the current runtime environment name for Honeybadger.
 * Defaults to "production" in production Compute, or respects NODE_ENV.
 */
export function getAppEnvironment(): string {
  return process.env.NODE_ENV === "production" ? "production" : "development";
}

/**
 * Resolves current deployment git commit revision if available.
 */
export function getAppRevision(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_COMMIT_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.GIT_COMMIT_SHA ||
    undefined
  );
}

/**
 * Checks if Honeybadger reporting is enabled.
 * Only enabled in production with a valid API key, unless forced for testing.
 */
export function isHoneybadgerEnabled(forceEnable = false): boolean {
  if (
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.JEST_WORKER_ID) ||
    Boolean(process.env.PLAYWRIGHT_TEST)
  ) {
    return false;
  }
  if (forceEnable) return true;
  const env = getAppEnvironment();
  if (env === "development" || env === "test") {
    return false;
  }
  const key = getHoneybadgerApiKey();
  return Boolean(key && key.length > 0);
}
