export const DEFAULT_DB_STATEMENT_TIMEOUT_MS = 30_000;
export const DEFAULT_DB_TRANSACTION_TIMEOUT_MS = 35_000;
export const DEFAULT_DB_MAX_WAIT_MS = 15_000;
export const DEFAULT_WATCHDOG_SAFETY_MARGIN_MS = 10_000;
export const DEFAULT_PERSIST_WATCHDOG_TIMEOUT_MS =
  DEFAULT_DB_MAX_WAIT_MS + DEFAULT_DB_TRANSACTION_TIMEOUT_MS + DEFAULT_WATCHDOG_SAFETY_MARGIN_MS;

export type PersistOptions = {
  statementTimeoutMs?: number | undefined;
  transactionTimeoutMs?: number | undefined;
  maxWaitMs?: number | undefined;
  watchdogTimeoutMs?: number | undefined;
  onWatchdogTimeout?: ((fatalError: Error) => void) | undefined;
  terminateProcess?: ((code: number) => void) | undefined;
  _testSleepSeconds?: number | undefined;
};

export function resolvePersistWatchdogTimeoutMs(options?: PersistOptions): number {
  if (options?.watchdogTimeoutMs !== undefined) return options.watchdogTimeoutMs;
  const maxWaitMs = options?.maxWaitMs ?? DEFAULT_DB_MAX_WAIT_MS;
  const transactionTimeoutMs = options?.transactionTimeoutMs ?? DEFAULT_DB_TRANSACTION_TIMEOUT_MS;
  return maxWaitMs + transactionTimeoutMs + DEFAULT_WATCHDOG_SAFETY_MARGIN_MS;
}
