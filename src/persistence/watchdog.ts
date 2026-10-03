export type WatchdogHandle = {
  promise: Promise<never>;
  cancel: () => void;
};

export function createWatchdog(
  watchdogTimeoutMs: number,
  statementTimeoutMs: number,
  transactionTimeoutMs: number,
  options: {
    onWatchdogTimeout?: ((fatalError: Error) => void) | undefined;
    terminateProcess?: ((code: number) => void) | undefined;
  } = {},
): WatchdogHandle {
  const terminate = options.terminateProcess ?? ((code: number) => process.exit(code));
  let timer: ReturnType<typeof setTimeout> | undefined;

  const promise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const fatalError = new Error(
        `Persist watchdog expired after ${watchdogTimeoutMs}ms: Prisma persistence did not settle within statement/transaction timeouts`,
      );
      (fatalError as { code?: string }).code = "PERSIST_WATCHDOG_TIMEOUT";
      console.error(
        JSON.stringify({
          event: "collector_persistence_watchdog_timeout",
          message:
            "Prisma persistence failed to settle within watchdog timeout; terminating process to prevent lock overlap and close hanging sockets",
          watchdogTimeoutMs,
          statementTimeoutMs,
          transactionTimeoutMs,
        }),
      );
      try {
        options.onWatchdogTimeout?.(fatalError);
      } catch (hookError) {
        console.error(
          JSON.stringify({
            event: "collector_persistence_watchdog_hook_error",
            error: hookError instanceof Error ? hookError.message : String(hookError),
          }),
        );
      } finally {
        terminate(1);
      }
      reject(fatalError);
    }, watchdogTimeoutMs);
  });

  return {
    promise,
    cancel: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    },
  };
}
