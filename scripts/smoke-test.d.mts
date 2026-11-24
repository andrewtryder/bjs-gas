export interface SmokeTestOptions {
  apiUrl: string;
  webUrl: string;
  expectedRevision?: string;
  allowUnhealthyStatus?: boolean;
  refreshIfStale?: boolean;
  collectorSecret?: string;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
  collectTimeoutMs?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface SmokeTestResult {
  ok: boolean;
  availabilityOk: boolean;
  failures: string[];
  revision: string | null;
  dirty: boolean | null;
  stationCount: number;
  healthy: boolean | null;
  refreshTriggered: boolean;
  refreshStatus: string;
}

export function runSmokeTest(options: SmokeTestOptions): Promise<SmokeTestResult>;
