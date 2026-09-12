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

export function isTestingEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.JEST_WORKER_ID) ||
    Boolean(process.env.PLAYWRIGHT_TEST)
  );
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
  const isTest = isTestingEnvironment();
  const apiKey = isTest ? null : options.apiKey || getHoneybadgerApiKey();
  const environment = isTest ? "test" : getAppEnvironment();
  const revision = getAppRevision();

  const isTestOrDev =
    isTest ||
    environment === "development" ||
    environment === "test" ||
    process.env.NODE_ENV === "test";

  const shouldReport =
    !isTest && (options.forceEnable || (!isTestOrDev && Boolean(apiKey)));

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
      if (isTestingEnvironment()) {
        return false;
      }
      return shouldReportNotice(notice as NoticeLike);
    });

    isInitialized = true;
  } else if (options.apiKey || options.forceEnable !== undefined) {
    Honeybadger.configure({
      ...(apiKey ? { apiKey } : {}),
      ...(options.forceEnable !== undefined
        ? { reportData: options.forceEnable }
        : { reportData: shouldReport }),
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
    // Never send error reports during testing
    if (isTestingEnvironment()) {
      return;
    }

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
