/**
 * Wall-clock deadline enforcement for collection jobs.
 */

export function isDeadlineExceeded(deadlineAtMs: number, nowMs: number = Date.now()): boolean {
  return nowMs >= deadlineAtMs;
}

export function collectionAbortedError(reason?: unknown): Error & { code: string } {
  const message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "runCollection timed out / aborted";
  const err = new Error(message) as Error & { code: string };
  err.code = "COLLECTION_ABORTED";
  return err;
}

export function assertWithinDeadline(
  deadlineAtMs: number,
  signal?: AbortSignal,
  stage?: string,
  nowMs: number = Date.now(),
): void {
  if (signal?.aborted) {
    throw collectionAbortedError(signal.reason);
  }
  if (isDeadlineExceeded(deadlineAtMs, nowMs)) {
    const stageInfo = stage ? ` at stage '${stage}'` : "";
    throw collectionAbortedError(
      `runCollection exceeded wall-clock deadline${stageInfo} (deadlineAtMs=${deadlineAtMs}, nowMs=${nowMs})`,
    );
  }
}
