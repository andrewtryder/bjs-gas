export interface SmokeTestOptions {
  apiUrl: string;
  webUrl: string;
  expectedRevision?: string;
  allowUnhealthyStatus?: boolean;
  fetchFn?: typeof fetch;
  sleepFn?: (ms: number) => Promise<void>;
}

export interface SmokeTestResult {
  ok: boolean;
  failures: string[];
  revision: string | null;
  dirty: boolean | null;
  stationCount: number;
  healthy: boolean | null;
}

export function runSmokeTest(options: SmokeTestOptions): Promise<SmokeTestResult>;
