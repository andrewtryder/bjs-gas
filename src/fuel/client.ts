import { observationsFromFuelResponse, type FuelObservation } from "./types.js";

export const FUEL_URL = (clubNumber: number) =>
  `https://eisapi.bjs.com/api/v1/fuelprice/clubnum/${clubNumber}`;

export type FetchFuelOptions = {
  timeoutMs?: number;
  maxAttempts?: number;
  fetchImpl?: typeof fetch | undefined;
  feedClubNumber?: number | undefined;
  /** Collection-scoped abort; when aborted, in-flight fetch + retries stop immediately. */
  signal?: AbortSignal | undefined;
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

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : String(error);
  return name === "AbortError" || /abort/i.test(message);
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason instanceof Error ? signal.reason : new Error("aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
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

function throwIfCollectionAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  const err = new Error("collection_aborted");
  (err as Error & { code?: string }).code = "COLLECTION_ABORTED";
  throw err;
}

/**
 * Compose a per-request AbortController with an optional parent collection signal
 * and a per-request timeout. Timers and listeners are always cleaned up.
 */
export function createRequestAbort(options: {
  timeoutMs: number;
  parent?: AbortSignal | undefined;
}): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error("timeout"));
  }, options.timeoutMs);

  const onParentAbort = () => {
    controller.abort(options.parent?.reason ?? new Error("collection_aborted"));
  };

  if (options.parent) {
    if (options.parent.aborted) {
      onParentAbort();
    } else {
      options.parent.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      options.parent?.removeEventListener("abort", onParentAbort);
    },
  };
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
    throwIfCollectionAborted(options.signal);
    attempt += 1;
    const { signal, dispose } = createRequestAbort({
      timeoutMs,
      parent: options.signal,
    });
    const urlClubNumber = options.feedClubNumber ?? clubNumber;
    try {
      const response = await fetchImpl(FUEL_URL(urlClubNumber), {
        method: "GET",
        headers: { accept: "application/json" },
        signal,
      });
      lastStatus = response.status;

      if (isRetryableStatus(response.status)) {
        lastError = `HTTP ${response.status}`;
        if (attempt < maxAttempts) {
          dispose();
          throwIfCollectionAborted(options.signal);
          const retryAfter = parseRetryAfterMs(response.headers.get("retry-after"));
          await sleep(retryAfter ?? jitter(400 * 2 ** (attempt - 1)), options.signal);
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
      throwIfCollectionAborted(options.signal);
      const message = error instanceof Error ? error.message : String(error);
      lastError = isAbortError(error) || /timeout/i.test(message) ? "timeout" : message;
      if (attempt < maxAttempts) {
        await sleep(jitter(400 * 2 ** (attempt - 1)), options.signal);
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
      dispose();
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
