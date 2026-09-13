import { observationsFromFuelResponse, type FuelObservation } from "./types.js";

export const FUEL_URL = (clubNumber: number) =>
  `https://eisapi.bjs.com/api/v1/fuelprice/clubnum/${clubNumber}`;

export type FetchFuelOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch | undefined;
  feedClubNumber?: number | undefined;
};

export type FetchFuelSuccess = {
  ok: true;
  observations: FuelObservation[];
  attempts: number;
  status: number;
};

export type FetchFuelFailure = {
  ok: false;
  attempts: number;
  status?: number | undefined;
  error: string;
  retryable: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(ms: number): number {
  return Math.floor(ms * (0.7 + Math.random() * 0.6));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const asInt = Number.parseInt(header, 10);
  if (Number.isFinite(asInt)) return Math.max(0, asInt * 1000);
  const when = Date.parse(header);
  if (Number.isFinite(when)) return Math.max(0, when - Date.now());
  return null;
}

export async function fetchClubFuel(
  clubNumber: number,
  observedAt: string,
  options: FetchFuelOptions = {},
): Promise<FetchFuelSuccess | FetchFuelFailure> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxAttempts = options.maxAttempts ?? 3; // initial + 2 retries
  const fetchImpl = options.fetchImpl ?? fetch;

  let attempt = 0;
  let lastError = "unknown";
  let lastStatus: number | undefined;

  while (attempt < maxAttempts) {
    attempt += 1;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const urlClubNumber = options.feedClubNumber ?? clubNumber;
    try {
      const response = await fetchImpl(FUEL_URL(urlClubNumber), {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      lastStatus = response.status;

      if (isRetryableStatus(response.status)) {
        lastError = `HTTP ${response.status}`;
        if (attempt < maxAttempts) {
          const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
          await sleep(retryAfter ?? jitter(400 * 2 ** (attempt - 1)));
          continue;
        }
        return {
          ok: false,
          attempts: attempt,
          status: response.status,
          error: lastError,
          retryable: true,
        };
      }

      if (response.status >= 400) {
        return {
          ok: false,
          attempts: attempt,
          status: response.status,
          error: `HTTP ${response.status}`,
          retryable: false,
        };
      }

      const json: unknown = await response.json();
      try {
        const observations = observationsFromFuelResponse(clubNumber, json, observedAt);
        return { ok: true, observations, attempts: attempt, status: response.status };
      } catch (error) {
        return {
          ok: false,
          attempts: attempt,
          status: response.status,
          error: error instanceof Error ? error.message : String(error),
          retryable: false,
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      lastError = message.includes("abort") ? "timeout" : message;
      if (attempt < maxAttempts) {
        await sleep(jitter(400 * 2 ** (attempt - 1)));
        continue;
      }
      return {
        ok: false,
        attempts: attempt,
        status: lastStatus,
        error: lastError,
        retryable: true,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    ok: false,
    attempts: attempt,
    status: lastStatus,
    error: lastError,
    retryable: true,
  };
}

export async function mapPool<T, R>(
  items: readonly T[],
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

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, () => run()),
  );
  return results;
}
