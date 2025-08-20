/**
 * Timeout utilities for managing async operations
 */
export class TimeoutError extends Error {
    duration;
    constructor(message, duration) {
        super(message);
        this.duration = duration;
        this.name = "TimeoutError";
    }
}
/**
 * Wraps a promise with a timeout
 * @param promise The promise to wrap
 * @param timeoutMs Timeout in milliseconds
 * @param errorMessage Optional error message
 * @returns Promise that rejects with TimeoutError if timeout is exceeded
 */
export async function withTimeout(promise, timeoutMs, errorMessage) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new TimeoutError(errorMessage || `Operation timed out after ${timeoutMs}ms`, timeoutMs));
        }, timeoutMs);
    });
    try {
        const result = await Promise.race([promise, timeoutPromise]);
        clearTimeout(timeoutId);
        return result;
    }
    catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}
/**
 * Creates a configurable timeout wrapper function
 * @param defaultTimeout Default timeout in milliseconds
 * @returns Function that wraps promises with timeout
 */
export function createTimeoutWrapper(defaultTimeout) {
    return function (promise, options) {
        const timeout = options?.timeout || defaultTimeout;
        return withTimeout(promise, timeout, options?.errorMessage);
    };
}
/**
 * Retry with exponential backoff and timeout
 */
export async function retryWithTimeout(fn, options = {}) {
    const { maxRetries = 3, timeoutMs = 30000, baseDelay = 1000, maxDelay = 10000, onRetry, } = options;
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await withTimeout(fn(), timeoutMs, `Attempt ${attempt + 1} timed out after ${timeoutMs}ms`);
        }
        catch (error) {
            lastError = error;
            if (attempt < maxRetries - 1) {
                // Calculate delay with exponential backoff
                const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                if (onRetry) {
                    onRetry(lastError, attempt + 1);
                }
                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}
/**
 * Create a timeout promise that can be cancelled
 */
export class CancellableTimeout {
    duration;
    timeoutId;
    rejectFn;
    constructor(duration) {
        this.duration = duration;
    }
    start(errorMessage) {
        return new Promise((_, reject) => {
            this.rejectFn = reject;
            this.timeoutId = setTimeout(() => {
                reject(new TimeoutError(errorMessage || `Operation timed out after ${this.duration}ms`, this.duration));
            }, this.duration);
        });
    }
    cancel() {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = undefined;
            this.rejectFn = undefined;
        }
    }
}
/**
 * Default timeout values for different operations
 */
export const DEFAULT_TIMEOUTS = {
    QUERY_PROCESSING: 30000, // 30 seconds for query processing
    AGENT_EXECUTION: 180000, // 3 minutes for agents (must match LLM_GENERATION for synthesis)
    TOOL_EXECUTION: 180000, // 3 minutes for tool execution (increased for LLM synthesis)
    LLM_GENERATION: 180000, // 3 minutes for granite3.3:2b on CPU
    PLAN_CREATION: 20000, // 20 seconds for plan creation
    TOTAL_EXECUTION: 300000, // 5 minutes total (increased to accommodate longer synthesis)
    API_REQUEST: 10000, // 10 seconds for API requests
    DATABASE_QUERY: 5000, // 5 seconds for database queries
};
