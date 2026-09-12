import Honeybadger from "@honeybadger-io/js";

let initialized = false;

export function isTestingEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    Boolean(process.env.VITEST) ||
    Boolean(process.env.JEST_WORKER_ID) ||
    Boolean(process.env.PLAYWRIGHT_TEST)
  );
}

export function initApiHoneybadger(apiKey?: string | null) {
  if (initialized) return Honeybadger;

  const isTest = isTestingEnvironment();
  const key = isTest ? null : apiKey || process.env.HONEYBADGER_API_KEY;
  const isProd = process.env.NODE_ENV === "production" && !isTest;
  const shouldSend = Boolean(key && isProd);

  Honeybadger.configure({
    apiKey: key || "unconfigured",
    environment: isTest ? "test" : isProd ? "production" : "development",
    reportData: shouldSend,
  });

  if (isTest) {
    Honeybadger.beforeNotify(() => false);
  }

  initialized = true;
  return Honeybadger;
}

export function reportApiError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    // Never send error reports during testing
    if (isTestingEnvironment()) {
      return;
    }

    const isProd = process.env.NODE_ENV === "production";
    if (!isProd && !process.env.HONEYBADGER_FORCE_TEST) {
      return;
    }

    const hb = initApiHoneybadger();
    const safeContext: Record<string, unknown> = {};

    if (context && typeof context === "object") {
      const allowedKeys = [
        "route",
        "method",
        "statusCode",
        "clubNumber",
        "event",
        "durationMs",
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
    console.error("Honeybadger API notification failed:", notifyErr);
  }
}
