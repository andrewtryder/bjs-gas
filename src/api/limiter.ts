/**
 * Process-local concurrency limiter for admission control.
 * Used to bound concurrent database work (e.g. heavy analytics queries)
 * to prevent exhausting Prisma's connection pool.
 */
export class ConcurrencyLimiter {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  public readonly maxConcurrency: number;

  constructor(maxConcurrency: number = 1) {
    if (maxConcurrency < 1) {
      throw new Error("maxConcurrency must be at least 1");
    }
    this.maxConcurrency = maxConcurrency;
  }

  get activeCount(): number {
    return this.active;
  }

  get waitingCount(): number {
    return this.queue.length;
  }

  async acquire(): Promise<() => void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          this.release();
        }
      };
    }

    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        let released = false;
        resolve(() => {
          if (!released) {
            released = true;
            this.release();
          }
        });
      });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
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
 * guarantees at least 2 connections remain free for operational endpoints
 * (/status, /stations) and collector persistence.
 */
export const analyticsLimiter = new ConcurrencyLimiter(1);
