import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import {
  clubSearchResponseSchema,
  fuelPriceResponseSchema,
  stateTownsResponseSchema,
  type ClubSearchResponse,
  type PhysicalStore,
} from "./schemas.js";
import { parseFuelHasProducts } from "./normalize.js";

export const CATALOG_STORE_ID = "10201";
export const CLUB_SEARCH_URL = `https://api.bjs.com/digital/live/api/v1.2/club/search/${CATALOG_STORE_ID}`;
export const STATE_TOWNS_URL = `https://api.bjs.com/digital/live/apis/v1.0/clublocatorpage/statetowns/${CATALOG_STORE_ID}`;
export const FIND_NEAREST_URL =
  `https://api.bjs.com/digital/live/api/v1.2/findnearestclub/clubDetails?radius=5000&storeID=${CATALOG_STORE_ID}&maxClub=500`;
export const FUEL_PRICE_URL = (clubNumber: number) =>
  `https://eisapi.bjs.com/api/v1/fuelprice/clubnum/${clubNumber}`;

/** Geographic search that returns the full club set in one call (verified). */
export const ALL_CLUBS_SEARCH_BODY = {
  latitude: 39.8283,
  longitude: -98.5795,
  radius: 5000,
} as const;

const WARM_URL = "https://www.bjs.com/clubLocator";

export type BrowserSession = {
  browser: Browser | null;
  context: BrowserContext;
  page: Page;
  ownsBrowser: boolean;
};

function profileDir(): string {
  return path.join(process.cwd(), ".cache", "bjs-chrome-profile");
}

/**
 * Open a browser session that can call api.bjs.com.
 * Akamai blocks plain Node fetch and stock Playwright Chromium; a persistent
 * Chrome channel profile with automation markers disabled works.
 */
export async function openBjsBrowserSession(): Promise<BrowserSession> {
  const cdpUrl = process.env.BJS_CDP_URL?.trim();
  if (cdpUrl) {
    const browser = await chromium.connectOverCDP(cdpUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = context.pages()[0] ?? (await context.newPage());
    await warmPage(page);
    return { browser, context, page, ownsBrowser: true };
  }

  fs.mkdirSync(profileDir(), { recursive: true });

  const context = await chromium.launchPersistentContext(profileDir(), {
    channel: "chrome",
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
    ignoreDefaultArgs: ["--enable-automation"],
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36",
    locale: "en-US",
    timezoneId: "America/New_York",
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });
  await warmPage(page);
  return { browser: null, context, page, ownsBrowser: true };
}

async function warmPage(page: Page): Promise<void> {
  await page.goto(WARM_URL, { waitUntil: "domcontentloaded", timeout: 90_000 });
  const title = await page.title();
  if (/access denied/i.test(title)) {
    throw new Error(
      `Warm navigation blocked by Akamai (title="${title}"). Retry later or set BJS_CDP_URL to a real Chrome DevTools endpoint.`,
    );
  }
  // Allow sensor cookies / locator XHRs to settle.
  await page.waitForTimeout(2500);
}

export async function closeBjsBrowserSession(session: BrowserSession): Promise<void> {
  if (!session.ownsBrowser) return;
  if (session.browser) {
    await session.browser.close();
    return;
  }
  await session.context.close();
}

type PageFetchResult = {
  status: number;
  text: string;
};

async function pageFetch(
  page: Page,
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
): Promise<PageFetchResult> {
  return page.evaluate(
    async ({ url, init }) => {
      const requestInit: RequestInit = {
        method: init?.method ?? "GET",
      };
      if (init?.headers) {
        requestInit.headers = init.headers;
      }
      if (init?.body !== undefined) {
        requestInit.body = init.body;
      }
      const response = await fetch(url, requestInit);
      const text = await response.text();
      return { status: response.status, text };
    },
    { url, init },
  );
}

export async function fetchAllClubsViaSearch(page: Page): Promise<{
  stores: PhysicalStore[];
  raw: ClubSearchResponse;
  source: string;
}> {
  const result = await pageFetch(page, CLUB_SEARCH_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      referer: "https://www.bjs.com/clubLocator",
      origin: "https://www.bjs.com",
    },
    body: JSON.stringify(ALL_CLUBS_SEARCH_BODY),
  });

  if (result.status !== 200) {
    throw new Error(
      `club/search failed with HTTP ${result.status}: ${result.text.slice(0, 300)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(result.text);
  } catch {
    throw new Error(`club/search returned non-JSON: ${result.text.slice(0, 300)}`);
  }

  const parsed = clubSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`club/search schema validation failed: ${parsed.error.message}`);
  }

  const stores = parsed.data.Stores?.PhysicalStore ?? [];
  if (stores.length === 0) {
    throw new Error("club/search returned zero PhysicalStore records");
  }

  return {
    stores,
    raw: parsed.data,
    source: CLUB_SEARCH_URL,
  };
}

export async function fetchClubsFromRawFile(filePath: string): Promise<{
  stores: PhysicalStore[];
  raw: ClubSearchResponse;
  source: string;
}> {
  const text = await fs.promises.readFile(filePath, "utf8");
  const json = JSON.parse(text) as unknown;
  const parsed = clubSearchResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Raw club search schema validation failed: ${parsed.error.message}`);
  }
  const stores = parsed.data.Stores?.PhysicalStore ?? [];
  if (stores.length === 0) {
    throw new Error(`Raw club search file ${filePath} contained zero stores`);
  }
  return {
    stores,
    raw: parsed.data,
    source: `${CLUB_SEARCH_URL}#from-file:${path.basename(filePath)}`,
  };
}

export async function fetchStateTownClubIds(page: Page): Promise<string[]> {
  const result = await pageFetch(page, STATE_TOWNS_URL, {
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      referer: "https://www.bjs.com/clubLocator",
    },
  });

  if (result.status !== 200) {
    throw new Error(
      `statetowns failed with HTTP ${result.status}: ${result.text.slice(0, 300)}`,
    );
  }

  const json = JSON.parse(result.text) as unknown;
  const parsed = stateTownsResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`statetowns schema validation failed: ${parsed.error.message}`);
  }

  const ids: string[] = [];
  for (const state of parsed.data.clubLocatorStateTownList) {
    for (const town of state.Towns) {
      const clubId = town.split("|")[0];
      if (clubId) ids.push(clubId);
    }
  }
  return ids;
}

export type FuelProbeResult =
  | { kind: "has_products" }
  | { kind: "empty_products" }
  | { kind: "error"; reason: string; retryable: boolean };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return Math.floor(ms * (0.7 + Math.random() * 0.6));
}

export async function probeFuelPrice(
  clubNumber: number,
  options: { maxAttempts?: number } = {},
): Promise<FuelProbeResult> {
  const maxAttempts = options.maxAttempts ?? 4;
  let attempt = 0;
  let lastError = "unknown";

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(FUEL_PRICE_URL(clubNumber), {
        headers: { accept: "application/json" },
      });

      if (response.status === 429 || response.status >= 500) {
        lastError = `HTTP ${response.status}`;
        if (attempt < maxAttempts) {
          await sleep(jitter(400 * 2 ** (attempt - 1)));
          continue;
        }
        return { kind: "error", reason: lastError, retryable: true };
      }

      if (response.status >= 400) {
        return {
          kind: "error",
          reason: `HTTP ${response.status}`,
          retryable: false,
        };
      }

      const json: unknown = await response.json();
      const parsed = fuelPriceResponseSchema.safeParse(json);
      if (!parsed.success) {
        return {
          kind: "error",
          reason: `schema: ${parsed.error.message}`,
          retryable: false,
        };
      }

      try {
        const hasProducts = parseFuelHasProducts(parsed.data);
        return hasProducts ? { kind: "has_products" } : { kind: "empty_products" };
      } catch (error) {
        return {
          kind: "error",
          reason: error instanceof Error ? error.message : String(error),
          retryable: false,
        };
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt < maxAttempts) {
        await sleep(jitter(400 * 2 ** (attempt - 1)));
        continue;
      }
      return { kind: "error", reason: lastError, retryable: true };
    }
  }

  return { kind: "error", reason: lastError, retryable: true };
}

export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await worker(item, index);
    }
  }

  const runners = Array.from({ length: Math.max(1, concurrency) }, () => run());
  await Promise.all(runners);
  return results;
}
