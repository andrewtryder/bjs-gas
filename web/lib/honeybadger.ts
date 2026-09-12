import Honeybadger from "@honeybadger-io/js";
import { shouldReportNotice, type NoticeLike } from "./honeybadger-filter";
import {
  getAppEnvironment,
  getAppRevision,
  getHoneybadgerApiKey,
} from "./config";

let isInitialized = false;

export interface HoneybadgerInitOptions {
  apiKey?: string | null;
  forceEnable?: boolean;
}

/**
 * Initialize Honeybadger client for browser and Node/SSR runtimes.
 *
 * Configures:
 * - ignoreBrowserExtensionErrors: true (Mandatory)
 * - maxErrors: 20 (Rate-limit client error cascades)
 * - beforeNotify: custom noise & browser extension filter
 * - environment: production (suppressed in test/development unless forced)
 */
export function initHoneybadger(options: HoneybadgerInitOptions = {}) {
  const apiKey = options.apiKey || getHoneybadgerApiKey();
  const environment = getAppEnvironment();
  const revision = getAppRevision();

  const isTestOrDev =
    environment === "development" ||
    environment === "test" ||
    process.env.NODE_ENV === "test";

  const shouldReport =
    options.forceEnable || (!isTestOrDev && Boolean(apiKey));

  if (!isInitialized) {
    Honeybadger.configure({
      apiKey: apiKey || "unconfigured",
      environment,
      revision,
      reportData: shouldReport,
      ignoreBrowserExtensionErrors: true,
      maxErrors: 20,
    } as any);

    Honeybadger.beforeNotify((notice: any) => {
      return shouldReportNotice(notice as NoticeLike);
    });

    isInitialized = true;
  } else if (options.apiKey || options.forceEnable !== undefined) {
    Honeybadger.configure({
      ...(apiKey ? { apiKey } : {}),
      ...(options.forceEnable !== undefined
        ? { reportData: options.forceEnable }
        : {}),
    } as any);
  }

  return Honeybadger;
}

/**
 * Report an unexpected error to Honeybadger with sanitized context.
 *
 * Excludes sensitive data (PII, credentials, cookies, headers, query params).
 */
export function reportErrorToHoneybadger(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    // Avoid double-reporting or reporting expected Next.js 404 navigation
    if (
      error instanceof Error &&
      (error.message.includes("NEXT_NOT_FOUND") ||
        error.name === "NotFoundError")
    ) {
      return;
    }

    const hb = initHoneybadger();

    // Whitelist only safe debugging context
    const safeContext: Record<string, unknown> = {};
    if (context && typeof context === "object") {
      const allowedKeys = [
        "route",
        "clubNumber",
        "state",
        "stateCode",
        "fuel",
        "fuelSku",
        "digest",
        "runtime",
        "statusCode",
        "method",
      ];
      for (const [k, v] of Object.entries(context)) {
        if (allowedKeys.includes(k) && v !== undefined && v !== null) {
          safeContext[k] = v;
        }
      }
    }

    if (error instanceof Error) {
      hb.notify(error, { context: safeContext });
    } else {
      hb.notify(String(error), { context: safeContext });
    }
  } catch (notifyErr) {
    // Graceful degradation: never crash application if reporting itself errors
    console.error("Failed to report error to Honeybadger:", notifyErr);
  }
}

export { Honeybadger };
