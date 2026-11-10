/**
 * Error thrown when the concurrency limiter rejects a workload due to queue pressure.
 */
export class LimiterOverloadError extends Error {
  public readonly code: "QUEUE_FULL" | "QUEUE_TIMEOUT" | "EXECUTION_TIMEOUT";

  constructor(
    message: string,
    code: "QUEUE_FULL" | "QUEUE_TIMEOUT" | "EXECUTION_TIMEOUT",
  ) {
    super(message);
    this.name = "LimiterOverloadError";
    this.code = code;
  }
}

export interface ConcurrencyLimiterOptions {
  name?: string;
  maxConcurrency?: number;
  maxQueueLength?: number;
  maxQueueWaitMs?: number;
  maxExecutionMs?: number;
}

interface QueuedItem {
  resolve: (release: () => void) => void;
  reject: (err: LimiterOverloadError) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

/**
 * Process-local concurrency limiter for admission control.
 * Used to bound concurrent database work (e.g. heavy analytics queries
 * and operational queries) to prevent exhausting Prisma's connection pool.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: QueuedItem[] = [];
  public readonly name: string;
  public readonly maxConcurrency: number;
  public readonly maxQueueLength: number;
  public readonly maxQueueWaitMs: number;
  public readonly maxExecutionMs: number;

  constructor(options: ConcurrencyLimiterOptions = {}) {
    this.name = options.name ?? "Database";
    const maxConcurrency = options.maxConcurrency ?? 1;
    const maxQueueLength = options.maxQueueLength ?? 8;
    const maxQueueWaitMs = options.maxQueueWaitMs ?? 8_000;
    const maxExecutionMs = options.maxExecutionMs ?? 10_000;

    if (maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    if (maxQueueLength < 0) {
      throw new Error("maxQueueLength must be non-negative");
    }
    if (maxQueueWaitMs <= 0) {
      throw new Error("maxQueueWaitMs must be positive");
    }
    if (maxExecutionMs <= 0) {
      throw new Error("maxExecutionMs must be positive");
    }

    this.maxConcurrency = maxConcurrency;
    this.maxQueueLength = maxQueueLength;
    this.maxQueueWaitMs = maxQueueWaitMs;
    this.maxExecutionMs = maxExecutionMs;
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
        `${this.name} queue full (limit: ${this.maxQueueLength})`,
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
            `${this.name} queue wait exceeded ${this.maxQueueWaitMs}ms`,
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
    if (this.active > 0) {
      this.active--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      if (this.maxExecutionMs > 0) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new LimiterOverloadError(
                `${this.name} execution exceeded ${this.maxExecutionMs}ms`,
                "EXECUTION_TIMEOUT",
              ),
            );
          }, this.maxExecutionMs);
        });
        return await Promise.race([fn(), timeoutPromise]);
      }
      return await fn();
    } finally {
      if (timer !== null) {
        clearTimeout(timer);
      }
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
  name: "Analytics",
  maxConcurrency: 1,
  maxQueueLength: 8,
  maxQueueWaitMs: 8_000,
  maxExecutionMs: 10_000,
});

/**
 * Global limiter for public database queries (operational routes + analytics).
 * With connection_limit=3, restricting concurrent public database queries to 2
 * guarantees that at least 1 database connection is always reserved for
 * background collection runs and persistence transactions, while preventing
 * concurrent homepage renders from exhausting the Prisma connection pool (P2024).
 */
export const publicDbLimiter = new ConcurrencyLimiter({
  name: "Database",
  maxConcurrency: 2,
  maxQueueLength: 16,
  maxQueueWaitMs: 5_000,
  maxExecutionMs: 10_000,
});

