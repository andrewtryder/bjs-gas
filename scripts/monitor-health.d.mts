export const DEFAULT_API_URL: string;
export const FALLBACK_MAX_STALENESS_MINUTES: number;
export const MIN_FRESH_STATION_RATIO: number;
export const TRANSIENT_REQUEST_ATTEMPTS: number;
export const TRANSIENT_RETRY_DELAYS_MS: number[];

export interface HealthCheckOptions {
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  now?: number;
}

export interface HealthCheckResult {
  ok: boolean;
  alert?: {
    event: string;
    status: string;
    apiUrl: string;
    failureCount: number;
    failures: string[];
    timestamp: string;
  };
  output?: {
    event: string;
    status: string;
    apiUrl: string;
    revision: string;
    healthy?: boolean;
    freshStationRatio?: number;
    freshWindowMinutes?: number;
    lastCollectionStartedAt?: string;
    transientRetries: number;
    timestamp: string;
  };
}

export function checkHealth(apiUrl?: string, options?: HealthCheckOptions): Promise<HealthCheckResult>;
