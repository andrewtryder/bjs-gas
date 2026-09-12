/**
 * Honeybadger Noise & Extension Filtering Logic
 *
 * Requirements:
 * 1. User browser extensions/plugins must NOT trigger incidents:
 *    - chrome-extension://
 *    - moz-extension://
 *    - safari-extension://
 *    - safari-web-extension://
 *    - extension://
 * 2. First-party policy:
 *    - Preserve errors when the stack contains a meaningful first-party frame:
 *      (site origin, /_next/ assets, application bundles).
 *    - Drop notices where the actionable stack is exclusively extension URLs,
 *      injected extension scripts, or third-party user scripts.
 *    - Do NOT suppress errors if MapLibre, Recharts, React, or npm deps appear.
 *    - Do NOT suppress application errors just because an extension appears deeper in stack.
 * 3. Ignore expected control flow (NEXT_NOT_FOUND, 404s).
 */

export interface StackFrameLike {
  file?: string;
  method?: string;
  number?: number;
  column?: number;
}

export interface NoticeLike {
  name?: string;
  message?: string;
  stack?: string;
  backtrace?: StackFrameLike[];
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

const EXTENSION_SCHEMES = [
  "chrome-extension://",
  "moz-extension://",
  "safari-extension://",
  "safari-web-extension://",
  "extension://",
];

export function isExtensionUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  return EXTENSION_SCHEMES.some((scheme) => url.startsWith(scheme));
}

export function isContentScript(url?: string): boolean {
  if (!url || typeof url !== "string") return false;
  return url.includes("content-script") || url.includes("contentscript");
}

export function shouldReportNotice(notice?: NoticeLike | null): boolean {
  if (!notice) return false;

  // 1. Filter expected control flow (404s, Next.js notFound())
  if (
    notice.message?.includes("NEXT_NOT_FOUND") ||
    notice.name === "NotFoundError" ||
    notice.context?.statusCode === 404 ||
    notice.context?.status === 404
  ) {
    return false;
  }

  // 2. Inspect structured backtrace frames if available
  const backtrace = notice.backtrace;
  if (Array.isArray(backtrace) && backtrace.length > 0) {
    const topFrame = backtrace[0];
    // If top actionable frame is an extension scheme, drop it
    if (topFrame?.file && (isExtensionUrl(topFrame.file) || isContentScript(topFrame.file))) {
      return false;
    }

    // If ALL frames are from extensions or injected scripts, drop it
    const nonExtensionFrames = backtrace.filter(
      (f) => f.file && !isExtensionUrl(f.file) && !isContentScript(f.file),
    );
    if (nonExtensionFrames.length === 0) {
      return false;
    }
  }

  // 3. Inspect raw stack trace string if present
  if (notice.stack && typeof notice.stack === "string") {
    const lines = notice.stack.split("\n").map((l) => l.trim()).filter(Boolean);
    const frameLines = lines.filter((l) => l.startsWith("at ") || l.includes("@"));

    if (frameLines.length > 0) {
      const topFrameLine = frameLines[0];
      // If the top frame originates from a browser extension scheme, ignore it
      if (topFrameLine && EXTENSION_SCHEMES.some((s) => topFrameLine.includes(s))) {
        return false;
      }

      // If every frame in the stack is an extension URL, ignore it
      const hasAnyNonExtension = frameLines.some(
        (l) => !EXTENSION_SCHEMES.some((s) => l.includes(s)) && !isContentScript(l),
      );
      if (!hasAnyNonExtension) {
        return false;
      }
    }
  }

  return true;
}
