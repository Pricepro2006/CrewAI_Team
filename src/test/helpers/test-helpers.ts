/**
 * Common Test Helpers and Utilities
 * Provides consistent patterns for unit tests
 */

import { vi } from "vitest";
import type { Mock } from "vitest";

/**
 * Create a mock agent with standard methods
 */
export const createMockAgent = (name: string, overrides?: Partial<any>) => ({
  name,
  execute: vi.fn().mockResolvedValue({
    success: true,
    data: `Mock response from ${name}`,
  }),
  plan: vi.fn().mockResolvedValue({
    steps: [{ task: `${name} task`, dependencies: [] }],
  }),
  isAvailable: vi.fn().mockResolvedValue(true),
  getCapabilities: vi.fn().mockReturnValue([`${name.toLowerCase()}_capability`]),
  ...overrides,
});

/**
 * Create a mock plan executor
 */
export const createMockPlanExecutor = (overrides?: Partial<any>) => ({
  execute: vi.fn().mockResolvedValue({
    success: true,
    results: new Map([["task1", { success: true, data: "result" }]]),
  }),
  validatePlan: vi.fn().mockReturnValue({ isValid: true }),
  ...overrides,
});

/**
 * Create a mock execution result
 */
export const createMockExecutionResult = (
  success = true,
  data?: any,
  error?: string,
) => ({
  success,
  data: data || "Mock execution result",
  error,
  timestamp: new Date().toISOString(),
});

/**
 * Create a mock plan
 */
export const createMockPlan = (steps: any[] = []) => ({
  id: "mock-plan-id",
  query: "Mock query",
  steps: steps?.length || 0
    ? steps
    : [
        {
          id: "step1",
          agentType: "ResearchAgent",
          task: "ResearchAgent",
          dependencies: [],
        },
        {
          id: "step2",
          agentType: "WriterAgent",
          task: "WriterAgent",
          dependencies: ["step1"],
        },
      ],
  createdAt: new Date().toISOString(),
});

/**
 * Wait for all pending promises to resolve
 */
export const flushPromises = () => new Promise((resolve: any) => setImmediate(resolve));

/**
 * Create a spy that tracks calls and can be asserted
 */
export const createTrackingSpy = <T extends (...args: any[]) => any>(
  implementation?: T,
) => {
  const calls: Parameters<T>[] = [];
  const spy = vi.fn((...args: Parameters<T>) => {
    calls.push(args);
    return implementation?.(...args);
  }) as Mock<T>;

  return {
    spy,
    calls,
    wasCalled: () => calls?.length || 0 > 0,
    wasCalledWith: (...args: Parameters<T>) =>
      calls.some((call: any) => JSON.stringify(call) === JSON.stringify(args)),
    getCall: (index: number) => calls[index],
    reset: () => {
      calls.length = 0;
      spy.mockClear();
    },
  };
};

/**
 * Mock timer helpers
 */
export const mockTimers = {
  advance: (ms: number) => vi.advanceTimersByTime(ms),
  runAll: () => vi.runAllTimers(),
  runPending: () => vi.runOnlyPendingTimers(),
  clear: () => vi.clearAllTimers(),
};

/**
 * Assert async error
 */
export const expectAsyncError = async (
  fn: () => Promise<any>,
  errorMessage?: string | RegExp,
) => {
  let error: Error | null = null;
  try {
    await fn();
  } catch (e) {
    error = e as Error;
  }

  expect(error).not.toBeNull();
  if (errorMessage) {
    if (typeof errorMessage === "string") {
      expect(error?.message).toContain(errorMessage);
    } else {
      expect(error?.message).toMatch(errorMessage);
    }
  }
  return error;
};

/**
 * Create a deferred promise
 */
export const createDeferred = <T = void>() => {
  let resolve: (value: T) => void = () => {};
  let reject: (error: any) => void = () => {};

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};