import { describe, expect, it } from "vitest";
import {
  isContentScript,
  isExtensionUrl,
  shouldReportNotice,
  type NoticeLike,
} from "../web/lib/honeybadger-filter.js";
import {
  getCartoApiKey,
  getHoneybadgerApiKey,
  isHoneybadgerEnabled,
} from "../web/lib/config.js";

describe("Honeybadger noise & browser-extension filtering", () => {
  it("detects browser extension URLs accurately", () => {
    expect(
      isExtensionUrl(
        "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js",
      ),
    ).toBe(true);
    expect(
      isExtensionUrl(
        "moz-extension://b4b53ef5-728f-4cf6-9218-bc1c272bc634/content.js",
      ),
    ).toBe(true);
    expect(
      isExtensionUrl("safari-extension://com.example.extension/script.js"),
    ).toBe(true);
    expect(
      isExtensionUrl("safari-web-extension://com.example.extension/script.js"),
    ).toBe(true);
    expect(isExtensionUrl("https://example.com/_next/static/chunks/app.js")).toBe(
      false,
    );
    expect(isExtensionUrl(undefined)).toBe(false);
  });

  it("detects content script patterns", () => {
    expect(isContentScript("https://foo.com/content-script.js")).toBe(true);
    expect(isContentScript("https://foo.com/contentscript.bundle.js")).toBe(
      true,
    );
    expect(isContentScript("https://foo.com/_next/static/main.js")).toBe(false);
    expect(isContentScript(undefined)).toBe(false);
  });

  it("filters notices where top frame is chrome-extension://", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Extension injected failure",
      backtrace: [
        {
          file: "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js",
          number: 12,
          method: "injectHook",
        },
        {
          file: "https://bjsgas.prisma.build/_next/static/chunks/app.js",
          number: 40,
          method: "handleClick",
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("filters notices where top frame is moz-extension://", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Firefox extension failure",
      backtrace: [
        {
          file: "moz-extension://b4b53ef5-728f-4cf6-9218-bc1c272bc634/content.js",
          number: 5,
        },
        {
          file: "https://bjsgas.prisma.build/_next/static/chunks/main.js",
          number: 100,
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("filters notices where top frame is safari-extension://", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Safari extension error",
      backtrace: [
        {
          file: "safari-extension://com.apple.foo/bar.js",
          number: 1,
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("filters notices where top frame is safari-web-extension://", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Safari web extension error",
      backtrace: [
        {
          file: "safari-web-extension://com.apple.foo/bar.js",
          number: 1,
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("filters notices via raw stack string when top line is an extension URL", () => {
    const notice: NoticeLike = {
      name: "TypeError",
      message: "Cannot read properties of undefined",
      stack: `TypeError: Cannot read properties of undefined
    at chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js:12:34
    at https://bjsgas.prisma.build/_next/static/chunks/app.js:56:78`,
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("filters notices whose stack is entirely browser extension frames", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Extension background leak",
      backtrace: [
        { file: "chrome-extension://aaa/script1.js" },
        { file: "chrome-extension://aaa/script2.js" },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(false);
  });

  it("reports genuine first-party errors with /_next/ stack frames", () => {
    const notice: NoticeLike = {
      name: "TypeError",
      message: "Cannot read property 'price' of undefined",
      backtrace: [
        {
          file: "https://bjsgas.prisma.build/_next/static/chunks/app/stations/[clubNumber]/page.js",
          number: 42,
          method: "StationDetails",
        },
        {
          file: "https://bjsgas.prisma.build/_next/static/chunks/main.js",
          number: 120,
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(true);
  });

  it("preserves application errors even if an extension frame is deeper in the stack", () => {
    const notice: NoticeLike = {
      name: "Error",
      message: "Station rendering failed",
      backtrace: [
        {
          file: "https://bjsgas.prisma.build/_next/static/chunks/app.js",
          number: 88,
          method: "renderStationCard",
        },
        {
          file: "chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn/inpage.js",
          number: 15,
          method: "eventListenerProxy",
        },
      ],
    };
    expect(shouldReportNotice(notice)).toBe(true);
  });

  it("filters expected NEXT_NOT_FOUND and 404 control flow", () => {
    const notFoundNotice: NoticeLike = {
      name: "Error",
      message: "NEXT_NOT_FOUND",
      backtrace: [{ file: "https://bjsgas.prisma.build/_next/static/chunks/app.js" }],
    };
    expect(shouldReportNotice(notFoundNotice)).toBe(false);

    const status404Notice: NoticeLike = {
      name: "NotFoundError",
      message: "Station not found",
      context: { statusCode: 404 },
    };
    expect(shouldReportNotice(status404Notice)).toBe(false);
  });

  it("returns false for null or undefined notice", () => {
    expect(shouldReportNotice(null)).toBe(false);
    expect(shouldReportNotice(undefined)).toBe(false);
  });
});

describe("Environment and config helpers", () => {
  it("provides safe fallback when CARTO key is absent", () => {
    const originalEnv = process.env.CARTO_API_KEY;
    const originalPublicEnv = process.env.NEXT_PUBLIC_CARTO_API_KEY;
    try {
      delete process.env.CARTO_API_KEY;
      delete process.env.NEXT_PUBLIC_CARTO_API_KEY;
      const key = getCartoApiKey();
      expect(key).toBeNull();
    } finally {
      if (originalEnv) process.env.CARTO_API_KEY = originalEnv;
      if (originalPublicEnv)
        process.env.NEXT_PUBLIC_CARTO_API_KEY = originalPublicEnv;
    }
  });

  it("disables Honeybadger reporting safely when key is absent", () => {
    const originalEnv = process.env.HONEYBADGER_API_KEY;
    const originalPublicEnv = process.env.NEXT_PUBLIC_HONEYBADGER_API_KEY;
    try {
      delete process.env.HONEYBADGER_API_KEY;
      delete process.env.NEXT_PUBLIC_HONEYBADGER_API_KEY;
      expect(getHoneybadgerApiKey()).toBeNull();
      expect(isHoneybadgerEnabled(false)).toBe(false);
    } finally {
      if (originalEnv) process.env.HONEYBADGER_API_KEY = originalEnv;
      if (originalPublicEnv)
        process.env.NEXT_PUBLIC_HONEYBADGER_API_KEY = originalPublicEnv;
    }
  });

  it("does not send Honeybadger events in test environment even with dummy key", () => {
    expect(process.env.NODE_ENV).toBe("test");
    expect(isHoneybadgerEnabled(false)).toBe(false);
  });

  it("suppresses reportApiError during testing without throwing", async () => {
    const { reportApiError, isTestingEnvironment } = await import("../src/honeybadger.js");
    expect(isTestingEnvironment()).toBe(true);
    // Calling reportApiError with an error in tests must be a safe no-op
    expect(() => {
      reportApiError(new Error("simulated test error that must not go to honeybadger"), {
        route: "/test",
        statusCode: 500,
      });
    }).not.toThrow();
  });

  it("suppresses reportErrorToHoneybadger during testing without throwing", async () => {
    const webHbModule = "../web/lib/honeybadger";
    const { reportErrorToHoneybadger, isTestingEnvironment } = await import(webHbModule);
    expect(isTestingEnvironment()).toBe(true);
    // Calling reportErrorToHoneybadger with an error in tests must be a safe no-op
    expect(() => {
      reportErrorToHoneybadger(new Error("simulated web test error that must not go to honeybadger"), {
        route: "/",
      });
    }).not.toThrow();
  });
});

describe("CARTO basemap style configuration", () => {
  it("generates unauthenticated vector style URL when API key is omitted", async () => {
    const { getMapStyle } = await import("../web/lib/map-config.js");
    const style = getMapStyle();
    expect(style).toBe(
      "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    );
    expect(style).not.toContain("?key=");
  });

  it("appends encoded key when provided", async () => {
    const { getMapStyle } = await import("../web/lib/map-config.js");
    const style = getMapStyle("test-carto-key-123");
    expect(style).toBe(
      "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=test-carto-key-123",
    );
  });
});

