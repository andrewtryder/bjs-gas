import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { isClosedConnectionError, persistFuelObservations } from "../src/persist.js";
import type { CollectionRunInput, FuelObservation } from "../src/fuel/types.js";

describe("isClosedConnectionError classifier", () => {
  it("recognizes structured Prisma P1017 error code", () => {
    const error = { code: "P1017", message: "Server has closed the connection. Please try again." };
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("recognizes structured Prisma initialization errorCode P1017", () => {
    const error = { errorCode: "P1017", message: "Server has closed the connection." };
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("recognizes driverAdapterError with ConnectionClosed kind", () => {
    const error = {
      meta: {
        driverAdapterError: {
          cause: {
            kind: "ConnectionClosed",
            message: "Connection closed unexpectedly",
          },
        },
      },
    };
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("recognizes narrow string fallback 'Server has closed the connection'", () => {
    const error = new Error("Server has closed the connection");
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("recognizes narrow string fallback 'Connection terminated unexpectedly'", () => {
    const error = new Error("Connection terminated unexpectedly");
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("recognizes closed connection message inside cause", () => {
    const error = new Error("Outer error", {
      cause: new Error("Server has closed the connection"),
    });
    expect(isClosedConnectionError(error)).toBe(true);
  });

  it("rejects P2024 pool timeout even if message mentions connection", () => {
    const error = {
      code: "P2024",
      message: "Timed out fetching a new connection from the connection pool",
    };
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("rejects P2028 transaction timeout / API error", () => {
    const error = {
      code: "P2028",
      message: "Transaction API error: Transaction already closed",
    };
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("rejects statement_timeout errors", () => {
    const error = new Error(
      "Raw query failed. Code: 57014. Message: ERROR: canceling statement due to statement timeout",
    );
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("rejects generic query errors (e.g. P2010)", () => {
    const error = { code: "P2010", message: "Raw query failed. Table does not exist" };
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("fails closed on non-P1017 Prisma error even if message mentions closed connection (P1000)", () => {
    const error = {
      code: "P1000",
      message: "Authentication failed against database server: Server has closed the connection",
    };
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("fails closed on non-P1017 Prisma error even if message mentions closed connection (P2010)", () => {
    const error = {
      code: "P2010",
      message: "Raw query failed: Server has closed the connection",
    };
    expect(isClosedConnectionError(error)).toBe(false);
  });

  it("rejects non-object, null, or undefined errors", () => {
    expect(isClosedConnectionError(null)).toBe(false);
    expect(isClosedConnectionError(undefined)).toBe(false);
    expect(isClosedConnectionError("Server has closed the connection")).toBe(false);
    expect(isClosedConnectionError(42)).toBe(false);
  });
});

describe("persistFuelObservations transaction acquisition resilience", () => {
  const sampleObservations: FuelObservation[] = [
    {
      clubNumber: 101,
      fuelSku: "1",
      fuelName: "Regular",
      price: "3.299",
      sourcePriceAtLocal: null,
      observedAt: "2026-10-02T22:00:00.000Z",
    },
  ];

  const sampleRun: CollectionRunInput = {
    startedAt: "2026-10-02T22:00:00.000Z",
    finishedAt: "2026-10-02T22:00:05.000Z",
    durationMs: 5000,
    clubsConfigured: 214,
    clubsSucceeded: 208,
    clubsEmptyFuels: 6,
    clubsHardFailed: 0,
    fuelObservations: 511,
    degraded: false,
    failures: [],
  };

  function createMockPrisma(options: {
    transactionImpl?: (
      cb: (tx: any) => Promise<unknown>,
      txOptions?: { maxWait?: number; timeout?: number },
    ) => Promise<unknown>;
    queryImpl?: (query: unknown) => Promise<unknown>;
  } = {}) {
    const rawQueryFn = vi.fn(async (query: unknown) => {
      if (options.queryImpl) return await options.queryImpl(query);
      return [
        {
          observations_received: 1n,
          history_rows_inserted: 1n,
          current_rows_upserted: 1n,
          run_rows_inserted: 1n,
          run_finished_at: "2026-10-02T22:00:05.000Z",
          run_duration_ms: 5000,
        },
      ];
    });

    const executeRawFn = vi.fn(async () => 1);

    const txClient = {
      $executeRaw: executeRawFn,
      $queryRaw: rawQueryFn,
    };

    const transactionFn = vi.fn(
      async (cb: (tx: any) => Promise<unknown>, txOptions?: { maxWait?: number; timeout?: number }) => {
        if (options.transactionImpl) {
          return await options.transactionImpl(cb, txOptions);
        }
        return await cb(txClient);
      },
    );

    const prisma = {
      ...txClient,
      $transaction: transactionFn,
    } as unknown as PrismaClient;

    return { prisma, txClient, transactionFn, rawQueryFn, executeRawFn };
  }

  it("1. first acquisition fails pre-callback with closed-connection; second succeeds", async () => {
    let transactionCalls = 0;
    let callbackInvocations = 0;

    const { prisma, transactionFn, rawQueryFn } = createMockPrisma({
      transactionImpl: async (cb, _txOptions) => {
        transactionCalls++;
        if (transactionCalls === 1) {
          const err = new Error("Server has closed the connection.");
          (err as { code?: string }).code = "P1017";
          throw err;
        }
        callbackInvocations++;
        return await cb({
          $executeRaw: vi.fn(async () => 1),
          $queryRaw: rawQueryFn,
        });
      },
    });

    const stats = await persistFuelObservations(prisma, sampleObservations, sampleRun);

    // Invariant: $transaction called exactly twice
    expect(transactionFn).toHaveBeenCalledTimes(2);
    // Invariant: callback entered exactly once
    expect(callbackInvocations).toBe(1);
    // Invariant: bulk query executes exactly once
    expect(rawQueryFn).toHaveBeenCalledTimes(1);
    // Invariant: returned stats are correct
    expect(stats.observationsReceived).toBe(1);
    expect(stats.currentRowsUpserted).toBe(1);
    expect(stats.historyRowsInserted).toBe(1);
  });

  it("2. two consecutive pre-callback closed-connection failures propagate without infinite loop", async () => {
    let transactionCalls = 0;

    const { prisma, transactionFn, rawQueryFn } = createMockPrisma({
      transactionImpl: async (_cb) => {
        transactionCalls++;
        const err = new Error("Server has closed the connection.");
        (err as { code?: string }).code = "P1017";
        throw err;
      },
    });

    await expect(
      persistFuelObservations(prisma, sampleObservations, sampleRun),
    ).rejects.toThrow("Server has closed the connection.");

    // Invariant: exactly two transaction attempts (attempt 1 and attempt 2), no 3rd attempt
    expect(transactionCalls).toBe(2);
    expect(transactionFn).toHaveBeenCalledTimes(2);
    // Callback and SQL were never executed
    expect(rawQueryFn).not.toHaveBeenCalled();
  });

  it("3. generic pre-callback database error does NOT retry", async () => {
    let transactionCalls = 0;

    const { prisma, transactionFn, rawQueryFn } = createMockPrisma({
      transactionImpl: async (_cb) => {
        transactionCalls++;
        const err = new Error("Authentication failed");
        (err as { code?: string }).code = "P1000";
        throw err;
      },
    });

    await expect(
      persistFuelObservations(prisma, sampleObservations, sampleRun),
    ).rejects.toThrow("Authentication failed");

    // Invariant: no retry on generic pre-callback error
    expect(transactionCalls).toBe(1);
    expect(transactionFn).toHaveBeenCalledTimes(1);
    expect(rawQueryFn).not.toHaveBeenCalled();
  });

  it("4. P2024 pre-callback pool timeout does NOT retry", async () => {
    let transactionCalls = 0;

    const { prisma, transactionFn, rawQueryFn } = createMockPrisma({
      transactionImpl: async (_cb) => {
        transactionCalls++;
        const err = new Error("Timed out fetching a new connection from the connection pool");
        (err as { code?: string }).code = "P2024";
        throw err;
      },
    });

    await expect(
      persistFuelObservations(prisma, sampleObservations, sampleRun),
    ).rejects.toThrow("Timed out fetching a new connection from the connection pool");

    // Invariant: P2024 is excluded from retry
    expect(transactionCalls).toBe(1);
    expect(transactionFn).toHaveBeenCalledTimes(1);
    expect(rawQueryFn).not.toHaveBeenCalled();
  });

  it("5. CRITICAL COMMIT-AMBIGUITY TEST: closed-connection error AFTER callback begins does NOT retry", async () => {
    let transactionCalls = 0;
    let callbackCalls = 0;

    const { prisma, transactionFn } = createMockPrisma({
      transactionImpl: async (cb) => {
        transactionCalls++;
        // The transaction acquisition succeeds and starts the callback
        return await cb({
          $executeRaw: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => {
            callbackCalls++;
            // During SQL execution inside the callback, connection drops
            const err = new Error("Server has closed the connection.");
            (err as { code?: string }).code = "P1017";
            throw err;
          }),
        });
      },
    });

    await expect(
      persistFuelObservations(prisma, sampleObservations, sampleRun),
    ).rejects.toThrow("Server has closed the connection.");

    // Invariant: $transaction must NOT be retried because callback was entered
    expect(transactionCalls).toBe(1);
    expect(transactionFn).toHaveBeenCalledTimes(1);
    expect(callbackCalls).toBe(1);
  });

  it("6. existing statement_timeout behavior inside transaction still works and does not retry", async () => {
    let transactionCalls = 0;

    const { prisma, transactionFn } = createMockPrisma({
      transactionImpl: async (cb) => {
        transactionCalls++;
        return await cb({
          $executeRaw: vi.fn(async () => 1),
          $queryRaw: vi.fn(async () => {
            const err = new Error(
              "Raw query failed. Code: 57014. Message: ERROR: canceling statement due to statement timeout",
            );
            (err as { code?: string }).code = "P2010";
            throw err;
          }),
        });
      },
    });

    await expect(
      persistFuelObservations(prisma, sampleObservations, sampleRun),
    ).rejects.toThrow("canceling statement due to statement timeout");

    expect(transactionCalls).toBe(1);
    expect(transactionFn).toHaveBeenCalledTimes(1);
  });

  it("7. existing persistence watchdog covers both attempts and terminates on hang", async () => {
    const onWatchdogTimeout = vi.fn();
    const terminateProcess = vi.fn();

    let transactionCalls = 0;
    const hungPrisma = {
      $transaction: vi.fn(async () => {
        transactionCalls++;
        if (transactionCalls === 1) {
          const err = new Error("Server has closed the connection.");
          (err as { code?: string }).code = "P1017";
          throw err;
        }
        // Attempt 2 hangs indefinitely
        await new Promise(() => {});
      }),
    } as unknown as PrismaClient;

    await expect(
      persistFuelObservations(hungPrisma, sampleObservations, sampleRun, {
        statementTimeoutMs: 15,
        maxWaitMs: 15,
        transactionTimeoutMs: 20,
        watchdogTimeoutMs: 60,
        onWatchdogTimeout,
        terminateProcess,
      }),
    ).rejects.toMatchObject({ code: "PERSIST_WATCHDOG_TIMEOUT" });

    expect(transactionCalls).toBe(2);
    expect(onWatchdogTimeout).toHaveBeenCalled();
    expect(terminateProcess).toHaveBeenCalledWith(1);
  });

  it("8. retry-success guarantees exactly one single bulk persistence statement", async () => {
    let transactionAttempts = 0;
    const queryStatements: unknown[] = [];

    const { prisma, rawQueryFn } = createMockPrisma({
      transactionImpl: async (cb) => {
        transactionAttempts++;
        if (transactionAttempts === 1) {
          const err = new Error("Connection terminated unexpectedly");
          throw err;
        }
        return await cb({
          $executeRaw: vi.fn(async () => 1),
          $queryRaw: vi.fn(async (query: unknown) => {
            queryStatements.push(query);
            return rawQueryFn(query);
          }),
        });
      },
    });

    const stats = await persistFuelObservations(prisma, sampleObservations, sampleRun);

    expect(transactionAttempts).toBe(2);
    expect(queryStatements).toHaveLength(1);
    expect(rawQueryFn).toHaveBeenCalledTimes(1);
    expect(stats.databaseQueries).toBe(1);
  });
});
