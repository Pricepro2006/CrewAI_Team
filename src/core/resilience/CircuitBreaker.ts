import { logger } from "../../utils/logger.js";
import { EventEmitter } from "events";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
  halfOpenMaxAttempts?: number;
  onStateChange?: (oldState: CircuitState, newState: CircuitState) => void;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
  totalRequests: number;
  failureRate: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  private halfOpenAttempts: number = 0;
  private monitoringWindowStart: Date = new Date();
  private requestsInWindow: number = 0;
  private failuresInWindow: number = 0;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions,
  ) {
    super();
    this.resetMonitoringWindow();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if monitoring window has expired
    this.checkMonitoringWindow();

    switch (this.state) {
      case CircuitState.OPEN:
        return this.handleOpenState();

      case CircuitState.HALF_OPEN:
        return this.handleHalfOpenState(fn);

      case CircuitState.CLOSED:
        return this.handleClosedState(fn);

      default:
        throw new Error(`Unknown circuit state: ${this.state}`);
    }
  }

  /**
   * Handle execution when circuit is OPEN
   */
  private async handleOpenState<T>(): Promise<T> {
    const now = new Date();

    if (this.nextRetryTime && now >= this.nextRetryTime) {
      this.transitionTo(CircuitState.HALF_OPEN);
      logger.info(
        "Circuit breaker entering half-open state",
        "CIRCUIT_BREAKER",
        {
          name: this.name,
          nextRetryTime: this.nextRetryTime,
        },
      );
    } else {
      const waitTime = this.nextRetryTime
        ? Math.ceil((this.nextRetryTime.getTime() - now.getTime()) / 1000)
        : 0;

      throw new Error(
        `Circuit breaker is OPEN for ${this.name}. Retry in ${waitTime} seconds.`,
      );
    }

    // Should not reach here, but TypeScript needs this
    throw new Error("Circuit breaker state error");
  }

  /**
   * Handle execution when circuit is HALF_OPEN
   */
  private async handleHalfOpenState<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.onSuccess();

      // Check if we've had enough successful attempts
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= (this.options.halfOpenMaxAttempts || 3)) {
        this.transitionTo(CircuitState.CLOSED);
        logger.info("Circuit breaker recovered and closed", "CIRCUIT_BREAKER", {
          name: this.name,
          attempts: this.halfOpenAttempts,
        });
      }

      return result;
    } catch (error) {
      this.onFailure(error);
      this.transitionTo(CircuitState.OPEN);
      logger.warn(
        "Circuit breaker reopened after half-open failure",
        "CIRCUIT_BREAKER",
        {
          name: this.name,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      );
      throw error;
    }
  }

  /**
   * Handle execution when circuit is CLOSED
   */
  private async handleClosedState<T>(fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);

      // Check if we should open the circuit
      const failureRate = this.calculateFailureRate();
      if (this.failures >= this.options.failureThreshold || failureRate > 0.5) {
        this.transitionTo(CircuitState.OPEN);
        logger.error(
          "Circuit breaker opened due to failures",
          "CIRCUIT_BREAKER",
          {
            name: this.name,
            failures: this.failures,
            failureRate,
            threshold: this.options.failureThreshold,
          },
        );
      }

      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.requestsInWindow++;
    this.emit("success");
  }

  /**
   * Record a failed execution
   */
  private onFailure(error: unknown): void {
    this.failures++;
    this.failuresInWindow++;
    this.requestsInWindow++;
    this.lastFailureTime = new Date();

    this.emit("failure", error);

    logger.debug("Circuit breaker failure recorded", "CIRCUIT_BREAKER", {
      name: this.name,
      failures: this.failures,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.OPEN) {
      this.nextRetryTime = new Date(Date.now() + this.options.resetTimeout);
      this.halfOpenAttempts = 0;
    } else if (newState === CircuitState.CLOSED) {
      this.reset();
    } else if (newState === CircuitState.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }

    this.emit("stateChange", oldState, newState);

    if (this.options.onStateChange) {
      this.options.onStateChange(oldState, newState);
    }

    logger.info("Circuit breaker state changed", "CIRCUIT_BREAKER", {
      name: this.name,
      oldState,
      newState,
    });
  }

  /**
   * Check and reset monitoring window if needed
   */
  private checkMonitoringWindow(): void {
    const now = new Date();
    const windowAge = now.getTime() - this.monitoringWindowStart.getTime();

    if (windowAge >= this.options.monitoringPeriod) {
      this.resetMonitoringWindow();
    }
  }

  /**
   * Reset the monitoring window
   */
  private resetMonitoringWindow(): void {
    this.monitoringWindowStart = new Date();
    this.requestsInWindow = 0;
    this.failuresInWindow = 0;
  }

  /**
   * Calculate failure rate in current window
   */
  private calculateFailureRate(): number {
    if (this.requestsInWindow === 0) return 0;
    return this.failuresInWindow / this.requestsInWindow;
  }

  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
    this.halfOpenAttempts = 0;
  }

  /**
   * Force the circuit to open
   */
  forceOpen(): void {
    this.transitionTo(CircuitState.OPEN);
  }

  /**
   * Force the circuit to close
   */
  forceClose(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    const totalRequests = this.successes + this.failures;
    const failureRate = totalRequests > 0 ? this.failures / totalRequests : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      totalRequests,
      failureRate,
    };
  }

  /**
   * Get circuit breaker name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Check if circuit is currently allowing requests
   */
  isAvailable(): boolean {
    if (
      this.state === CircuitState.CLOSED ||
      this.state === CircuitState.HALF_OPEN
    ) {
      return true;
    }

    if (this.state === CircuitState.OPEN && this.nextRetryTime) {
      return new Date() >= this.nextRetryTime;
    }

    return false;
  }
}

/**
 * Circuit breaker factory for creating named instances
 */
export class CircuitBreakerFactory {
  private static instances = new Map<string, CircuitBreaker>();
  private static defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 60000, // 1 minute
    halfOpenMaxAttempts: 3,
  };

  /**
   * Get or create a circuit breaker instance
   */
  static getInstance(
    name: string,
    options?: Partial<CircuitBreakerOptions>,
  ): CircuitBreaker {
    if (!this.instances.has(name)) {
      const finalOptions = { ...this.defaultOptions, ...options };
      this.instances.set(name, new CircuitBreaker(name, finalOptions));
    }

    return this.instances.get(name)!;
  }

  /**
   * Get all circuit breakers
   */
  static getAllInstances(): Map<string, CircuitBreaker> {
    return new Map(this.instances);
  }

  /**
   * Get statistics for all circuit breakers
   */
  static getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    this.instances.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });

    return stats;
  }

  /**
   * Reset a specific circuit breaker
   */
  static reset(name: string): void {
    const breaker = this.instances.get(name);
    if (breaker) {
      breaker.forceClose();
    }
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    this.instances.forEach((breaker) => {
      breaker.forceClose();
    });
  }
}
