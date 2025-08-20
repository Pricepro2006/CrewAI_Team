/**
 * Circuit Breaker Service for External API Protection
 * Prevents cascading failures and provides graceful degradation
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

export enum CircuitState {
  CLOSED = 'closed',   // Normal operation
  OPEN = 'open',       // Failing, reject requests
  HALF_OPEN = 'half-open' // Testing recovery
}

export interface CircuitBreakerOptions {
  threshold?: number;          // Error threshold to open circuit
  timeout?: number;            // Time before trying half-open
  volumeThreshold?: number;    // Minimum requests before opening
  errorThresholdPercentage?: number; // Error percentage to open
  resetTimeout?: number;       // Time to reset statistics
  fallback?: () => Promise<any>; // Fallback function
}

export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  fallbacks: number;
  lastFailure?: Date;
  lastSuccess?: Date;
  nextAttempt?: Date;
  errorRate: number;
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private rejections = 0;
  private fallbacks = 0;
  private requests: Array<{ timestamp: number; success: boolean }> = [];
  private lastFailure?: Date;
  private lastSuccess?: Date;
  private nextAttempt?: Date;
  private resetTimer?: NodeJS.Timeout;
  private halfOpenTimer?: NodeJS.Timeout;

  constructor(
    private name: string,
    private options: CircuitBreakerOptions = {}
  ) {
    super();
    
    // Set defaults
    this.options = {
      threshold: options.threshold || 5,
      timeout: options.timeout || 60000, // 1 minute
      volumeThreshold: options.volumeThreshold || 10,
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      resetTimeout: options.resetTimeout || 120000, // 2 minutes
      fallback: options.fallback
    };

    this.startResetTimer();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check circuit state
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        return this.handleOpen();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    return this.nextAttempt ? Date.now() >= this.nextAttempt.getTime() : false;
  }

  private transitionToHalfOpen(): void {
    logger.info(`Circuit breaker ${this.name} transitioning to half-open`, "CIRCUIT_BREAKER");
    this.state = CircuitState.HALF_OPEN;
    this.emit('stateChange', { name: this.name, state: CircuitState.HALF_OPEN });
  }

  private transitionToOpen(): void {
    logger.warn(`Circuit breaker ${this.name} opened due to failures`, "CIRCUIT_BREAKER");
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.options.timeout!);
    this.emit('stateChange', { name: this.name, state: CircuitState.OPEN });

    // Set timer to try half-open
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
    }
    this.halfOpenTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.options.timeout!);
  }

  private transitionToClosed(): void {
    logger.info(`Circuit breaker ${this.name} closed, operating normally`, "CIRCUIT_BREAKER");
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.nextAttempt = undefined;
    this.emit('stateChange', { name: this.name, state: CircuitState.CLOSED });
  }

  private async handleOpen<T>(): Promise<T> {
    this.rejections++;
    this.emit('rejection', { name: this.name });

    if (this.options?.fallback) {
      try {
        this.fallbacks++;
        const result = await this.options.fallback();
        this.emit('fallback', { name: this.name });
        return result;
      } catch (fallbackError) {
        logger.error(`Fallback failed for ${this.name}`, "CIRCUIT_BREAKER", { error: fallbackError });
        throw new Error(`Circuit breaker ${this.name} is open and fallback failed`);
      }
    }

    throw new Error(`Circuit breaker ${this.name} is open`);
  }

  private onSuccess(): void {
    this.successes++;
    this.lastSuccess = new Date();
    this.recordRequest(true);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }

    this.emit('success', { name: this.name });
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailure = new Date();
    this.recordRequest(false);

    logger.warn(`Circuit breaker ${this.name} recorded failure`, "CIRCUIT_BREAKER", {
      failures: this.failures,
      threshold: this.options?.threshold,
      error: error?.message
    });

    this.emit('failure', { name: this.name, error });

    // Check if we should open the circuit
    if (this.shouldOpen()) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  private shouldOpen(): boolean {
    // Check absolute threshold
    if (this.failures >= this.options.threshold!) {
      return true;
    }

    // Check percentage threshold with volume threshold
    const totalRequests = this.requests?.length;
    if (totalRequests >= this.options.volumeThreshold!) {
      const recentFailures = this.requests?.filter(r => !r.success).length;
      const errorRate = (recentFailures / totalRequests) * 100;
      return errorRate >= this.options.errorThresholdPercentage!;
    }

    return false;
  }

  private recordRequest(success: boolean): void {
    const now = Date.now();
    this.requests?.push({ timestamp: now, success });

    // Keep only recent requests (last 60 seconds)
    const cutoff = now - 60000;
    this.requests = this.requests?.filter(r => r.timestamp > cutoff);
  }

  private startResetTimer(): void {
    this.resetTimer = setInterval(() => {
      this.resetStatistics();
    }, this.options.resetTimeout!);
  }

  private resetStatistics(): void {
    const now = Date.now();
    const cutoff = now - this.options.resetTimeout!;
    
    // Keep only recent requests
    this.requests = this.requests?.filter(r => r.timestamp > cutoff);
    
    // Reset counters if circuit is closed and stable
    if (this.state === CircuitState.CLOSED && this.requests?.length === 0) {
      this.failures = 0;
      this.successes = 0;
      this.rejections = 0;
      this.fallbacks = 0;
    }
  }

  getStats(): CircuitStats {
    const totalRequests = this.requests?.length;
    const recentFailures = this.requests?.filter(r => !r.success).length;
    const errorRate = totalRequests > 0 ? (recentFailures / totalRequests) * 100 : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      rejections: this.rejections,
      fallbacks: this.fallbacks,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      nextAttempt: this.nextAttempt,
      errorRate
    };
  }

  reset(): void {
    this.transitionToClosed();
    this.failures = 0;
    this.successes = 0;
    this.rejections = 0;
    this.fallbacks = 0;
    this.requests = [];
    this.lastFailure = undefined;
    this.lastSuccess = undefined;
    this.nextAttempt = undefined;
  }

  dispose(): void {
    if (this.resetTimer) {
      clearInterval(this.resetTimer);
    }
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
    }
    this.removeAllListeners();
  }
}

// Circuit Breaker Manager for centralized management
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers = new Map<string, CircuitBreaker>();

  static getInstance(): CircuitBreakerManager {
    if (!this.instance) {
      this.instance = new CircuitBreakerManager();
    }
    return this.instance;
  }

  create(name: string, options: CircuitBreakerOptions = {}): CircuitBreaker {
    if (this.breakers?.has(name)) {
      return this.breakers?.get(name)!;
    }

    const breaker = new CircuitBreaker(name, options);
    this.breakers?.set(name, breaker);

    // Log state changes
    breaker.on('stateChange', ({ name, state }) => {
      logger.info(`Circuit breaker ${name} state changed to ${state}`, "CIRCUIT_MANAGER");
    });

    return breaker;
  }

  get(name: string): CircuitBreaker | undefined {
    return this.breakers?.get(name);
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  getStats(): Map<string, CircuitStats> {
    const stats = new Map<string, CircuitStats>();
    for (const [name, breaker] of this.breakers) {
      stats.set(name, breaker.getStats());
    }
    return stats;
  }

  reset(name: string): void {
    const breaker = this.breakers?.get(name);
    if (breaker) {
      breaker.reset();
    }
  }

  resetAll(): void {
    for (const breaker of this.breakers?.values()) {
      breaker.reset();
    }
  }

  dispose(): void {
    for (const breaker of this.breakers?.values()) {
      breaker.dispose();
    }
    this.breakers?.clear();
  }
}

// Export singleton instance
export const circuitBreakerManager = CircuitBreakerManager.getInstance();

// Pre-configured circuit breakers for common services
export const ollamaBreaker = circuitBreakerManager.create('ollama', {
  threshold: 3,
  timeout: 30000,
  errorThresholdPercentage: 60,
  fallback: async () => {
    // Return cached or default response
    return { response: 'Service temporarily unavailable', cached: true };
  }
});

export const walmartApiBreaker = circuitBreakerManager.create('walmart-api', {
  threshold: 5,
  timeout: 60000,
  errorThresholdPercentage: 50,
  fallback: async () => {
    // Return cached prices or estimates
    return { prices: [], cached: true, message: 'Using cached data' };
  }
});

export const redisBreaker = circuitBreakerManager.create('redis', {
  threshold: 10,
  timeout: 10000,
  errorThresholdPercentage: 70,
  fallback: async () => {
    // Fall back to in-memory cache
    return null;
  }
});