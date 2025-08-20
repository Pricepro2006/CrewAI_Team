import { EventEmitter } from 'events';
import { z } from 'zod';

// Circuit breaker schemas and types
export const CircuitBreakerConfigSchema = z.object({
  failureThreshold: z.number().min(1).default(5), // Number of failures before opening
  successThreshold: z.number().min(1).default(3), // Number of successes to close
  timeout: z.number().min(1000).default(60000), // Time to wait before trying again (ms)
  monitor: z.boolean().default(true), // Enable monitoring
  resetOnSuccess: z.boolean().default(true), // Reset failure count on success
  fallbackEnabled: z.boolean().default(true) // Enable fallback mechanism
});

export const CircuitBreakerStateSchema = z.object({
  state: z.enum(['closed', 'open', 'half-open']),
  failureCount: z.number().min(0).default(0),
  successCount: z.number().min(0).default(0),
  lastFailureTime: z.number().optional(),
  lastSuccessTime: z.number().optional(),
  nextAttemptTime: z.number().optional()
});

export const RetryPolicySchema = z.object({
  maxAttempts: z.number().min(1).default(3),
  baseDelay: z.number().min(100).default(1000), // Base delay in ms
  maxDelay: z.number().min(1000).default(30000), // Max delay in ms
  backoffMultiplier: z.number().min(1).default(2), // Exponential backoff multiplier
  jitter: z.boolean().default(true), // Add randomization to delays
  retryableErrors: z.array(z.string()).default([]), // Error types that should be retried
  nonRetryableErrors: z.array(z.string()).default([]) // Error types that should not be retried
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfigSchema>;
export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

export interface CircuitBreakerStats {
  state: CircuitBreakerState['state'];
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
  uptime: number;
  lastError?: string;
}

export interface FallbackOptions<T = any> {
  fallbackValue?: T;
  fallbackFunction?: () => Promise<T>;
  useCache?: boolean;
  cacheKey?: string;
}

/**
 * CircuitBreaker - Implements circuit breaker pattern for resilient event processing
 * 
 * Features:
 * - Three states: closed, open, half-open
 * - Configurable failure and success thresholds
 * - Automatic retry with exponential backoff
 * - Fallback mechanisms
 * - Performance monitoring and metrics
 * - Integration with event monitoring system
 */
export class CircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private retryPolicy: RetryPolicy;
  private stats: CircuitBreakerStats;
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();
  private responseTimes: number[] = [];

  constructor(
    config: Partial<CircuitBreakerConfig> = {},
    retryPolicy: Partial<RetryPolicy> = {}
  ) {
    super();
    
    this.config = CircuitBreakerConfigSchema.parse(config);
    this.retryPolicy = RetryPolicySchema.parse(retryPolicy);
    
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0
    };
    
    this.stats = {
      state: 'closed',
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      uptime: Date.now()
    };

    this.setupCleanup();
  }

  private setupCleanup(): void {
    // Clean up cache periodically
    setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000); // Every 5 minutes

    // Clean up response times buffer
    setInterval(() => {
      if (this.responseTimes.length > 1000) {
        this.responseTimes = this.responseTimes.slice(-500);
      }
    }, 60 * 1000); // Every minute
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(
    fn: () => Promise<T>,
    fallbackOptions?: FallbackOptions<T>
  ): Promise<T> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Check circuit state
      if (this.state.state === 'open') {
        if (this.shouldAttemptReset()) {
          this.state.state = 'half-open';
          this.emit('state_changed', { 
            from: 'open', 
            to: 'half-open',
            reason: 'timeout_reached' 
          });
        } else {
          this.stats.rejectedRequests++;
          return await this.handleRejection(fallbackOptions);
        }
      }

      // Execute function with retry logic
      const result = await this.executeWithRetry(fn, startTime);
      
      // Record success
      this.recordSuccess(Date.now() - startTime);
      return result;

    } catch (error) {
      // Record failure
      this.recordFailure(error as Error, Date.now() - startTime);
      
      // Try fallback if available
      if (fallbackOptions) {
        try {
          return await this.executeFallback(fallbackOptions);
        } catch (fallbackError) {
          this.emit('fallback_failed', { 
            originalError: error, 
            fallbackError 
          });
        }
      }
      
      throw error;
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    startTime: number,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const errorObj = error as Error;
      
      if (attempt >= this.retryPolicy.maxAttempts || 
          !this.shouldRetry(errorObj)) {
        throw error;
      }

      const delay = this.calculateDelay(attempt);
      
      this.emit('retry_attempt', {
        attempt,
        maxAttempts: this.retryPolicy.maxAttempts,
        delay,
        error: errorObj.message
      });

      await this.sleep(delay);
      return this.executeWithRetry(fn, startTime, attempt + 1);
    }
  }

  /**
   * Record successful execution
   */
  private recordSuccess(responseTime: number): void {
    this.responseTimes.push(responseTime);
    this.stats.successfulRequests++;
    this.stats.averageResponseTime = this.calculateAverageResponseTime();

    if (this.config.resetOnSuccess) {
      this.state.failureCount = 0;
    }

    this.state.successCount++;
    this.state.lastSuccessTime = Date.now();

    // Transition from half-open to closed if success threshold reached
    if (this.state.state === 'half-open' && 
        this.state.successCount >= this.config.successThreshold) {
      this.state.state = 'closed';
      this.state.successCount = 0;
      this.emit('state_changed', { 
        from: 'half-open', 
        to: 'closed',
        reason: 'success_threshold_reached' 
      });
    }

    this.stats.state = this.state.state;
    
    if (this.config.monitor) {
      this.emit('success_recorded', {
        responseTime,
        state: this.state.state,
        successCount: this.state.successCount
      });
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(error: Error, responseTime: number): void {
    this.responseTimes.push(responseTime);
    this.stats.failedRequests++;
    this.stats.averageResponseTime = this.calculateAverageResponseTime();
    this.stats.lastError = error.message;

    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    this.state.successCount = 0; // Reset success count on failure

    // Transition to open if failure threshold reached
    if ((this.state.state === 'closed' || this.state.state === 'half-open') &&
        this.state.failureCount >= this.config.failureThreshold) {
      const previousState = this.state.state;
      this.state.state = 'open';
      this.state.nextAttemptTime = Date.now() + this.config.timeout;
      
      this.emit('state_changed', { 
        from: previousState, 
        to: 'open',
        reason: 'failure_threshold_reached' 
      });
    }

    this.stats.state = this.state.state;
    
    if (this.config.monitor) {
      this.emit('failure_recorded', {
        error: error.message,
        responseTime,
        state: this.state.state,
        failureCount: this.state.failureCount
      });
    }
  }

  /**
   * Handle rejection when circuit is open
   */
  private async handleRejection<T>(fallbackOptions?: FallbackOptions<T>): Promise<T> {
    this.emit('request_rejected', { 
      state: this.state.state,
      nextAttemptTime: this.state.nextAttemptTime 
    });

    if (fallbackOptions) {
      return await this.executeFallback(fallbackOptions);
    }

    throw new Error(
      `Circuit breaker is ${this.state.state}. Next attempt at ${new Date(this.state.nextAttemptTime!).toISOString()}`
    );
  }

  /**
   * Execute fallback mechanism
   */
  private async executeFallback<T>(options: FallbackOptions<T>): Promise<T> {
    // Try cache first if enabled
    if (options.useCache && options.cacheKey) {
      const cached = this.getCachedValue<T>(options.cacheKey);
      if (cached !== null) {
        this.emit('fallback_cache_hit', { cacheKey: options.cacheKey });
        return cached as T;
      }
    }

    // Try fallback function
    if (options.fallbackFunction) {
      this.emit('fallback_executed', { type: 'function' });
      return await options.fallbackFunction();
    }

    // Return fallback value
    if (options.fallbackValue !== undefined) {
      this.emit('fallback_executed', { type: 'value' });
      return options.fallbackValue;
    }

    throw new Error('No fallback mechanism available');
  }

  /**
   * Check if circuit breaker should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    return this.state.nextAttemptTime !== undefined && 
           Date.now() >= this.state.nextAttemptTime;
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(error: Error): boolean {
    const errorType = error?.constructor?.name;
    const errorMessage = error?.message?.toLowerCase();

    // Check non-retryable errors first
    if ((this.retryPolicy.nonRetryableErrors?.length || 0) > 0) {
      const isNonRetryable = this.retryPolicy.nonRetryableErrors.some(pattern =>
        errorType.includes(pattern) || errorMessage.includes(pattern.toLowerCase())
      );
      if (isNonRetryable) return false;
    }

    // Check retryable errors
    if ((this.retryPolicy.retryableErrors?.length || 0) > 0) {
      return this.retryPolicy.retryableErrors.some(pattern =>
        errorType.includes(pattern) || errorMessage.includes(pattern.toLowerCase())
      );
    }

    // Default retry logic for common transient errors
    const transientErrors = [
      'timeout', 'connection', 'network', 'unavailable', 
      '502', '503', '504', 'econnreset', 'enotfound'
    ];

    return transientErrors.some(pattern => 
      errorMessage.includes(pattern)
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateDelay(attempt: number): number {
    let delay = this.retryPolicy.baseDelay * 
                Math.pow(this.retryPolicy.backoffMultiplier, attempt - 1);
    
    delay = Math.min(delay, this.retryPolicy.maxDelay);
    
    if (this.retryPolicy.jitter) {
      delay = delay + (Math.random() * delay * 0.1); // Add 10% jitter
    }
    
    return Math.floor(delay);
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;
    
    const sum = this.responseTimes.reduce((total: any, time: any) => total + time, 0);
    return Math.round(sum / this.responseTimes.length);
  }

  /**
   * Cache management
   */
  public setCachedValue<T>(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  public getCachedValue<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value as T | null;
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Utility methods
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public API methods

  /**
   * Get current circuit breaker state
   */
  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  /**
   * Get circuit breaker statistics
   */
  public getStats(): CircuitBreakerStats {
    return { 
      ...this.stats,
      uptime: Date.now() - this.stats.uptime
    };
  }

  /**
   * Get health status
   */
  public getHealth(): {
    isHealthy: boolean;
    state: CircuitBreakerState['state'];
    errorRate: number;
    avgResponseTime: number;
    message?: string;
  } {
    const errorRate = this.stats.totalRequests > 0 
      ? this.stats.failedRequests / this.stats.totalRequests 
      : 0;
    
    const isHealthy = this.state.state === 'closed' && errorRate < 0.1;
    
    let message;
    if (this.state.state === 'open') {
      message = `Circuit open until ${new Date(this.state.nextAttemptTime!).toISOString()}`;
    } else if (errorRate > 0.1) {
      message = `High error rate: ${Math.round(errorRate * 100)}%`;
    }

    return {
      isHealthy,
      state: this.state.state,
      errorRate,
      avgResponseTime: this.stats.averageResponseTime,
      message
    };
  }

  /**
   * Manually reset circuit breaker
   */
  public reset(): void {
    const previousState = this.state.state;
    
    this.state = {
      state: 'closed',
      failureCount: 0,
      successCount: 0,
      lastFailureTime: undefined,
      lastSuccessTime: undefined,
      nextAttemptTime: undefined
    };

    this.stats.state = 'closed';

    this.emit('manual_reset', { previousState });
    
    if (previousState !== 'closed') {
      this.emit('state_changed', { 
        from: previousState, 
        to: 'closed',
        reason: 'manual_reset' 
      });
    }
  }

  /**
   * Force circuit breaker to open state
   */
  public forceOpen(): void {
    const previousState = this.state.state;
    
    this.state.state = 'open';
    this.state.nextAttemptTime = Date.now() + this.config.timeout;
    this.stats.state = 'open';

    this.emit('forced_open', { previousState });
    
    if (previousState !== 'open') {
      this.emit('state_changed', { 
        from: previousState, 
        to: 'open',
        reason: 'forced_open' 
      });
    }
  }

  /**
   * Update circuit breaker configuration
   */
  public updateConfig(config: Partial<CircuitBreakerConfig>): void {
    const oldConfig = { ...this.config };
    this.config = CircuitBreakerConfigSchema.parse({ ...this.config, ...config });
    
    this.emit('config_updated', { 
      oldConfig, 
      newConfig: this.config 
    });
  }

  /**
   * Update retry policy
   */
  public updateRetryPolicy(policy: Partial<RetryPolicy>): void {
    const oldPolicy = { ...this.retryPolicy };
    this.retryPolicy = RetryPolicySchema.parse({ ...this.retryPolicy, ...policy });
    
    this.emit('retry_policy_updated', { 
      oldPolicy, 
      newPolicy: this.retryPolicy 
    });
  }

  /**
   * Clear all statistics
   */
  public clearStats(): void {
    this.stats = {
      state: this.state.state,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
      averageResponseTime: 0,
      uptime: Date.now()
    };
    
    this.responseTimes = [];
    this.emit('stats_cleared');
  }
}

/**
 * CircuitBreakerManager - Manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private breakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig;
  private defaultRetryPolicy: RetryPolicy;

  constructor(
    defaultConfig: Partial<CircuitBreakerConfig> = {},
    defaultRetryPolicy: Partial<RetryPolicy> = {}
  ) {
    this.defaultConfig = CircuitBreakerConfigSchema.parse(defaultConfig);
    this.defaultRetryPolicy = RetryPolicySchema.parse(defaultRetryPolicy);
  }

  /**
   * Get or create a circuit breaker
   */
  public getCircuitBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
    retryPolicy?: Partial<RetryPolicy>
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const breaker = new CircuitBreaker(
        { ...this.defaultConfig, ...config },
        { ...this.defaultRetryPolicy, ...retryPolicy }
      );
      
      this.breakers.set(name, breaker);
    }
    
    return this.breakers.get(name)!;
  }

  /**
   * Execute function with named circuit breaker
   */
  public async execute<T>(
    breakerName: string,
    fn: () => Promise<T>,
    fallbackOptions?: FallbackOptions<T>,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const breaker = this.getCircuitBreaker(breakerName, config);
    return breaker.execute(fn, fallbackOptions);
  }

  /**
   * Get all circuit breaker stats
   */
  public getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    
    return stats;
  }

  /**
   * Get overall health status
   */
  public getOverallHealth(): {
    healthy: number;
    unhealthy: number;
    total: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
  } {
    let healthy = 0;
    let unhealthy = 0;
    
    for (const breaker of this.breakers.values()) {
      if (breaker.getHealth().isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }
    
    const total = this.breakers.size;
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (unhealthy > 0) {
      status = unhealthy === total ? 'unhealthy' : 'degraded';
    }
    
    return { healthy, unhealthy, total, status };
  }

  /**
   * Remove circuit breaker
   */
  public removeCircuitBreaker(name: string): boolean {
    return this.breakers.delete(name);
  }

  /**
   * Reset all circuit breakers
   */
  public resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}