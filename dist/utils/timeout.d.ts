/**
 * Timeout utilities for managing async operations
 */
export declare class TimeoutError extends Error {
    readonly duration: number;
    constructor(message: string, duration: number);
}
/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Optional error message
 * @returns Promise that rejects with TimeoutError if timeout is exceeded
 */
export declare function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T>;
/**
 * Creates a configurable timeout wrapper function
 * @param defaultTimeout Default timeout in milliseconds
 * @returns Function that wraps promises with timeout
 */
export declare function createTimeoutWrapper(defaultTimeout: number): <T>(promise: Promise<T>, options?: {
    timeout?: number;
    errorMessage?: string;
}) => Promise<T>;
/**
 * Retry with exponential backoff and timeout
 */
export declare function retryWithTimeout<T>(fn: () => Promise<T>, options?: {
    maxRetries?: number;
    timeoutMs?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (error: Error, attempt: number) => void;
}): Promise<T>;
/**
 * Create a timeout promise that can be cancelled
 */
export declare class CancellableTimeout {
    private readonly duration;
    private timeoutId?;
    private rejectFn?;
    constructor(duration: number);
    start(errorMessage?: string): Promise<never>;
    cancel(): void;
}
/**
 * Default timeout values for different operations
 */
export declare const DEFAULT_TIMEOUTS: {
    readonly QUERY_PROCESSING: 30000;
    readonly AGENT_EXECUTION: 120000;
    readonly TOOL_EXECUTION: 180000;
    readonly LLM_GENERATION: 180000;
    readonly PLAN_CREATION: 20000;
    readonly TOTAL_EXECUTION: 300000;
    readonly API_REQUEST: 10000;
    readonly DATABASE_QUERY: 5000;
};
//# sourceMappingURL=timeout.d.ts.map