/**
 * Retry Manager with Exponential Backoff
 *
 * Provides intelligent retry logic for operations that may fail transiently:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Operation-specific retry policies
 * - Detailed retry metrics
 */

import { Logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

const logger = new Logger("RetryManager");

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffMultiplier?: number;
  jitter?: boolean;
  timeout?: number; // operation timeout in milliseconds
  retryableErrors?: Array<new (...args: unknown[]) => Error>;
  retryIf?: (error: unknown) => boolean;
  onRetry?: (error: unknown, attempt: number) => void;
}

export interface RetryPolicy {
  name: string;
  options: RetryOptions;
}

export interface RetryMetrics {
  totalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  retriedOperations: number;
  averageAttempts: number;
  circuitBreakerTrips: number;
}

export interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time in ms before attempting to close
  monitoringPeriod: number; // Time window for failure counting
}

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export class RetryManager extends EventEmitter {
  private static instance: RetryManager;
  private policies: Map<string, RetryPolicy> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private metrics: Map<string, RetryMetrics> = new Map();

  private readonly DEFAULT_OPTIONS: Required<RetryOptions> = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    timeout: 60000,
    retryableErrors: [],
    retryIf: () => true,
    onRetry: () => {},
  };

  private readonly DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000,
    monitoringPeriod: 300000, // 5 minutes
  };

  private constructor() {
    super();
    this.initializeDefaultPolicies();
  }

  static getInstance(): RetryManager {
    if (!RetryManager.instance) {
      RetryManager.instance = new RetryManager();
    }
    return RetryManager.instance;
  }

  /**
   * Initialize default retry policies
   */
  private initializeDefaultPolicies(): void {
    // Database operations
    this.registerPolicy("database", {
      maxAttempts: 5,
      initialDelay: 100,
      maxDelay: 5000,
      retryIf: (error: any) => this.isDatabaseRetryable(error),
    });

    // LLM API calls
    this.registerPolicy("llm", {
      maxAttempts: 3,
      initialDelay: 2000,
      maxDelay: 20000,
      timeout: 120000,
      retryIf: (error: any) => this.isLLMRetryable(error),
    });

    // External API calls
    this.registerPolicy("api", {
      maxAttempts: 4,
      initialDelay: 1000,
      maxDelay: 15000,
      retryIf: (error: any) => this.isNetworkRetryable(error),
    });

    // File operations
    this.registerPolicy("file", {
      maxAttempts: 3,
      initialDelay: 500,
      maxDelay: 5000,
      retryIf: (error: any) => this.isFileRetryable(error),
    });
  }

  /**
   * Register a named retry policy
   */
  registerPolicy(name: string, options: RetryOptions): void {
    this?.policies?.set(name, {
      name,
      options: { ...this.DEFAULT_OPTIONS, ...options },
    });

    // Initialize metrics for this policy
    this?.metrics?.set(name, {
      totalAttempts: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      averageAttempts: 0,
      circuitBreakerTrips: 0,
    });
  }

  /**
   * Execute an operation with retry logic
   */
  async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions | string = {},
  ): Promise<T> {
    const retryOptions = this.resolveOptions(options);
    const policyName = typeof options === "string" ? options : "default";

    // Check circuit breaker
    if (!this.checkCircuitBreaker(policyName)) {
      throw new Error(`Circuit breaker is OPEN for policy: ${policyName}`);
    }

    const startTime = Date.now();
    let lastError: unknown;
    let attempts = 0;

    while (attempts < retryOptions.maxAttempts) {
      attempts++;
      this.updateMetrics(policyName, "attempt");

      try {
        // Execute with timeout
        const result = await this.executeWithTimeout(
          operation,
          retryOptions.timeout,
        );

        // Success
        this.handleSuccess(policyName, attempts);
        return result;
      } catch (error) {
        lastError = error;

        // Check if we should retry
        if (!this.shouldRetry(error, attempts, retryOptions)) {
          this.handleFailure(policyName, attempts, error);
          throw error;
        }

        // Calculate delay
        const delay = this.calculateDelay(attempts, retryOptions);

        logger.warn(
          `Operation failed (attempt ${attempts}/${retryOptions.maxAttempts}), ` +
            `retrying in ${delay}ms...`,
          'RETRY_MANAGER',
          { error: error instanceof Error ? error.message : String(error) },
        );

        // Call retry callback
        retryOptions.onRetry(error, attempts);

        // Wait before retry
        await this.delay(delay);
      }
    }

    // Max attempts reached
    this.handleFailure(policyName, attempts, lastError);
    throw new Error(
      `Operation failed after ${attempts} attempts. Last error: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  /**
   * Execute multiple operations with retry logic
   */
  async retryBatch<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions | string = {},
  ): Promise<T[]> {
    const results = await Promise.allSettled(
      operations?.map((op: any) => this.retry(op, options)),
    );

    const values: T[] = [];
    const errors: unknown[] = [];

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        values.push(result.value as T);
      } else {
        errors.push({
          index,
          error: result.reason,
        });
      }
    });

    if (errors?.length || 0 > 0) {
      throw new Error(
        `Batch operation failed: ${errors?.length || 0} out of ${operations?.length || 0} operations failed`,
      );
    }

    return values;
  }

  /**
   * Create a circuit breaker for a policy
   */
  enableCircuitBreaker(
    policyName: string,
    options: Partial<CircuitBreakerOptions> = {},
  ): void {
    const circuitOptions = { ...this.DEFAULT_CIRCUIT_OPTIONS, ...options };

    this?.circuitBreakers?.set(policyName, {
      state: CircuitState.CLOSED,
      failures: 0,
      lastFailureTime: 0,
      nextAttemptTime: 0,
    });

    logger.info(
      `Circuit breaker enabled for policy: ${policyName}`,
      'RETRY_MANAGER',
      circuitOptions,
    );
  }

  /**
   * Get metrics for a specific policy
   */
  getMetrics(policyName?: string): RetryMetrics | Map<string, RetryMetrics> {
    if (policyName) {
      return this?.metrics?.get(policyName) || this.createEmptyMetrics();
    }
    return new Map(this.metrics);
  }

  /**
   * Reset metrics for a policy
   */
  resetMetrics(policyName?: string): void {
    if (policyName) {
      this?.metrics?.set(policyName, this.createEmptyMetrics());
    } else {
      this?.metrics?.clear();
      this?.policies?.forEach((_, name) => {
        this?.metrics?.set(name, this.createEmptyMetrics());
      });
    }
  }

  /**
   * Check circuit breaker state
   */
  private checkCircuitBreaker(policyName: string): boolean {
    const breaker = this?.circuitBreakers?.get(policyName);
    if (!breaker) return true; // No circuit breaker configured

    const now = Date.now();

    switch (breaker.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (now >= breaker.nextAttemptTime) {
          breaker.state = CircuitState.HALF_OPEN;
          logger.info(
            `Circuit breaker transitioned to HALF_OPEN for: ${policyName}`,
          );
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return true;
    }
  }

  /**
   * Handle successful operation
   */
  private handleSuccess(policyName: string, attempts: number): void {
    const metrics = this?.metrics?.get(policyName);
    if (metrics) {
      metrics.successfulOperations++;
      if (attempts > 1) {
        metrics.retriedOperations++;
      }
      this.updateAverageAttempts(metrics, attempts);
    }

    // Reset circuit breaker if in HALF_OPEN state
    const breaker = this?.circuitBreakers?.get(policyName);
    if (breaker && breaker.state === CircuitState.HALF_OPEN) {
      breaker.state = CircuitState.CLOSED;
      breaker.failures = 0;
      logger.info(`Circuit breaker closed for: ${policyName}`);
    }

    this.emit("retry:success", { policyName, attempts });
  }

  /**
   * Handle failed operation
   */
  private handleFailure(
    policyName: string,
    attempts: number,
    error: unknown,
  ): void {
    const metrics = this?.metrics?.get(policyName);
    if (metrics) {
      metrics.failedOperations++;
      this.updateAverageAttempts(metrics, attempts);
    }

    // Update circuit breaker
    const breaker = this?.circuitBreakers?.get(policyName);
    if (breaker) {
      breaker.failures++;
      breaker.lastFailureTime = Date.now();

      if (breaker.state === CircuitState.HALF_OPEN) {
        // Failed in HALF_OPEN state, go back to OPEN
        breaker.state = CircuitState.OPEN;
        breaker.nextAttemptTime =
          Date.now() + this?.DEFAULT_CIRCUIT_OPTIONS?.resetTimeout;

        if (metrics) {
          metrics.circuitBreakerTrips++;
        }

        logger.warn(`Circuit breaker opened for: ${policyName}`);
      } else if (
        breaker.state === CircuitState.CLOSED &&
        breaker.failures >= this?.DEFAULT_CIRCUIT_OPTIONS?.failureThreshold
      ) {
        // Too many failures, open the circuit
        breaker.state = CircuitState.OPEN;
        breaker.nextAttemptTime =
          Date.now() + this?.DEFAULT_CIRCUIT_OPTIONS?.resetTimeout;

        if (metrics) {
          metrics.circuitBreakerTrips++;
        }

        logger.warn(
          `Circuit breaker opened for: ${policyName} (threshold reached)`,
        );
      }
    }

    this.emit("retry:failure", { policyName, attempts, error });
  }

  /**
   * Resolve retry options
   */
  private resolveOptions(
    options: RetryOptions | string,
  ): Required<RetryOptions> {
    if (typeof options === "string") {
      const policy = this?.policies?.get(options);
      return policy ? { ...this.DEFAULT_OPTIONS, ...policy.options } : { ...this.DEFAULT_OPTIONS };
    }

    return { ...this.DEFAULT_OPTIONS, ...options } as Required<RetryOptions>;
  }

  /**
   * Check if operation should be retried
   */
  private shouldRetry(
    error: unknown,
    attempts: number,
    options: Required<RetryOptions>,
  ): boolean {
    if (attempts >= options.maxAttempts) {
      return false;
    }

    // Check retryable errors
    if (options?.retryableErrors?.length > 0) {
      const isRetryableError = options?.retryableErrors?.some(
        (ErrorClass: any) => error instanceof ErrorClass,
      );
      if (!isRetryableError) return false;
    }

    // Check custom retry condition
    return options.retryIf(error);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(
    attempt: number,
    options: Required<RetryOptions>,
  ): number {
    let delay =
      options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);

    // Apply max delay cap
    delay = Math.min(delay, options.maxDelay);

    // Apply jitter
    if (options.jitter) {
      const jitterRange = delay * 0.3; // 30% jitter
      delay = delay + (Math.random() * jitterRange * 2 - jitterRange);
    }

    return Math.round(delay);
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out")), timeout),
      ),
    ]);
  }

  /**
   * Error type checkers
   */
  private isDatabaseRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error?.message?.toLowerCase();
      return (
        message.includes("sqlite_busy") ||
        message.includes("database is locked") ||
        message.includes("sqlite_locked") ||
        message.includes("deadlock")
      );
    }
    return false;
  }

  private isLLMRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error?.message?.toLowerCase();
      return (
        message.includes("rate limit") ||
        message.includes("timeout") ||
        message.includes("503") ||
        message.includes("429") ||
        message.includes("connection refused")
      );
    }
    return false;
  }

  private isNetworkRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error?.message?.toLowerCase();
      return (
        message.includes("econnrefused") ||
        message.includes("etimedout") ||
        message.includes("enotfound") ||
        message.includes("network") ||
        message.includes("fetch failed")
      );
    }
    return false;
  }

  private isFileRetryable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error?.message?.toLowerCase();
      return (
        message.includes("eacces") ||
        message.includes("ebusy") ||
        message.includes("emfile") ||
        message.includes("enfile")
      );
    }
    return false;
  }

  /**
   * Update metrics
   */
  private updateMetrics(policyName: string, type: "attempt"): void {
    const metrics = this?.metrics?.get(policyName);
    if (metrics && type === "attempt") {
      metrics.totalAttempts++;
    }
  }

  private updateAverageAttempts(metrics: RetryMetrics, attempts: number): void {
    const totalOperations =
      metrics.successfulOperations + metrics.failedOperations;
    const totalAttempts =
      metrics.averageAttempts * (totalOperations - 1) + attempts;
    metrics.averageAttempts = totalAttempts / totalOperations;
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): RetryMetrics {
    return {
      totalAttempts: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      averageAttempts: 0,
      circuitBreakerTrips: 0,
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve: any) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const retryManager = RetryManager.getInstance();
