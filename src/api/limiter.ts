/**
 * Error thrown when the concurrency limiter rejects a workload due to queue pressure.
 */
export class LimiterOverloadError extends Error {
  public readonly code: "QUEUE_FULL" | "QUEUE_TIMEOUT";

  constructor(message: string, code: "QUEUE_FULL" | "QUEUE_TIMEOUT") {
    super(message);
    this.name = "LimiterOverloadError";
    this.code = code;
  }
}

export interface ConcurrencyLimiterOptions {
  maxConcurrency?: number;
  maxQueueLength?: number;
  maxQueueWaitMs?: number;
}

interface QueuedItem {
  resolve: (release: () => void) => void;
  reject: (err: LimiterOverloadError) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Process-local concurrency limiter for admission control.
 * Used to bound concurrent database work (e.g. heavy analytics queries)
 * to prevent exhausting Prisma's connection pool.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: QueuedItem[] = [];
  public readonly maxConcurrency: number;
  public readonly maxQueueLength: number;
  public readonly maxQueueWaitMs: number;

  constructor(options: ConcurrencyLimiterOptions = {}) {
    const maxConcurrency = options.maxConcurrency ?? 1;
    const maxQueueLength = options.maxQueueLength ?? 8;
    const maxQueueWaitMs = options.maxQueueWaitMs ?? 8_000;

    if (maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    if (maxQueueLength < 0) {
      throw new Error("maxQueueLength must be non-negative");
    }
    if (maxQueueWaitMs <= 0) {
      throw new Error("maxQueueWaitMs must be positive");
    }

    this.maxConcurrency = maxConcurrency;
    this.maxQueueLength = maxQueueLength;
    this.maxQueueWaitMs = maxQueueWaitMs;
  }

  get activeCount(): number {
    return this.active;
  }

  get waitingCount(): number {
    return this.queue.length;
  }

  private createReleaseFn(): () => void {
    let released = false;
    return () => {
      if (!released) {
        released = true;
        this.release();
      }
    };
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return this.createReleaseFn();
    }

    if (this.queue.length >= this.maxQueueLength) {
      throw new LimiterOverloadError(
        `Analytics queue full (limit: ${this.maxQueueLength})`,
        "QUEUE_FULL",
      );
    }

    return new Promise<() => void>((resolve, reject) => {
      const item: QueuedItem = {
        resolve,
        reject,
        timeoutId: null,
      };

      item.timeoutId = setTimeout(() => {
        // Remove item from queue if still present
        const idx = this.queue.indexOf(item);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(
          new LimiterOverloadError(
            `Analytics queue wait exceeded ${this.maxQueueWaitMs}ms`,
            "QUEUE_TIMEOUT",
          ),
        );
      }, this.maxQueueWaitMs);

      this.queue.push(item);
    });
  }

  private release(): void {
    while (this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (next.timeoutId !== null) {
        clearTimeout(next.timeoutId);
      }
      next.resolve(this.createReleaseFn());
      return;
    }
    this.active--;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Singleton limiter for analytics endpoints.
 * With connection_limit=3, restricting analytics to max 1 concurrency
 * ensures analytics workloads cannot monopolize the pool, while allowing
 * up to 8 queued queries with an 8-second timeout before failing fast.
 */
export const analyticsLimiter = new ConcurrencyLimiter({
  maxConcurrency: 1,
  maxQueueLength: 8,
  maxQueueWaitMs: 8_000,
});
