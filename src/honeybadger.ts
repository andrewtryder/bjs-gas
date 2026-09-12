import Honeybadger from "@honeybadger-io/js";

let initialized = false;

export function initApiHoneybadger(apiKey?: string | null) {
  if (initialized) return Honeybadger;

  const key = apiKey || process.env.HONEYBADGER_API_KEY;
  const isProd = process.env.NODE_ENV === "production";
  const shouldSend = Boolean(key && isProd);

  Honeybadger.configure({
    apiKey: key || "unconfigured",
    environment: isProd ? "production" : "development",
    reportData: shouldSend,
  });

  initialized = true;
  return Honeybadger;
}

export function reportApiError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  try {
    const isProd = process.env.NODE_ENV === "production";
    // In test or dev without key, skip
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
