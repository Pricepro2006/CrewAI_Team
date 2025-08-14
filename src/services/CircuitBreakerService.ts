import { EventEmitter } from 'events';

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

interface CircuitOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  errorThresholdPercentage?: number;
}

interface CircuitStats {
  requests: number;
  failures: number;
  successes: number;
  rejections: number;
  fallbacks: number;
  latency: number[];
  averageLatency: number;
  errorRate: number;
  state: CircuitState;
}

/**
 * Circuit implementation for a single service
 */
class Circuit {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private nextAttempt?: number;
  private stats: CircuitStats = {
    requests: 0,
    failures: 0,
    successes: 0,
    rejections: 0,
    fallbacks: 0,
    latency: [],
    averageLatency: 0,
    errorRate: 0,
    state: CircuitState.CLOSED
  };
  
  constructor(
    public name: string,
    private options: Required<CircuitOptions>,
    private emitter: EventEmitter
  ) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    this.stats.requests++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt!) {
        this.stats.rejections++;
        
        if (fallback) {
          this.stats.fallbacks++;
          try {
            return await fallback();
          } catch (fallbackError) {
            throw new Error(`Circuit breaker is OPEN for ${this.name} and fallback failed`);
          }
        }
        
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
      
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      this.emitter.emit('state-change', { name: this.name, from: CircuitState.OPEN, to: CircuitState.HALF_OPEN });
      console.log(`🔄 Circuit ${this.name} entering HALF_OPEN state`);
    }

    const startTime = Date.now();
    
    try {
      // Execute with timeout
      const result = await Promise.race([
        fn(),
        new Promise<T>((_, reject) => 
          setTimeout(() => reject(new Error('Circuit breaker timeout')), this.options.timeout)
        )
      ]);
      
      const latency = Date.now() - startTime;
      this.onSuccess(latency);
      return result;
      
    } catch (error) {
      const latency = Date.now() - startTime;
      this.onFailure(latency);
      
      // Try fallback if circuit is now open
      if (fallback && this.state === CircuitState.OPEN) {
        this.stats.fallbacks++;
        try {
          return await fallback();
        } catch (fallbackError) {
          throw error; // Throw original error if fallback fails
        }
      }
      
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(latency: number): void {
    this.failures = 0;
    this.stats.successes++;
    this.updateLatency(latency);
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.options.successThreshold) {
        const previousState = this.state;
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.emitter.emit('state-change', { name: this.name, from: previousState, to: CircuitState.CLOSED });
        console.log(`✅ Circuit ${this.name} is now CLOSED (recovered)`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(latency: number): void {
    this.failures++;
    this.stats.failures++;
    this.successes = 0;
    this.updateLatency(latency);
    
    // Check if we should open the circuit
    if (this.state !== CircuitState.OPEN && this.failures >= this.options.failureThreshold) {
      const previousState = this.state;
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.resetTimeout;
      this.emitter.emit('state-change', { name: this.name, from: previousState, to: CircuitState.OPEN });
      console.warn(`⚠️ Circuit breaker opened for ${this.name} (${this.failures} failures)`);
    }
  }

  /**
   * Update latency statistics
   */
  private updateLatency(latency: number): void {
    this.stats.latency.push(latency);
    
    // Keep only last 100 measurements
    if (this.stats.latency.length > 100) {
      this.stats.latency.shift();
    }
    
    // Update average
    if (this.stats.latency.length > 0) {
      const sum = this.stats.latency.reduce((a, b) => a + b, 0);
      this.stats.averageLatency = sum / this.stats.latency.length;
    }
    
    // Update error rate
    this.stats.errorRate = this.stats.requests > 0 
      ? (this.stats.failures / this.stats.requests) * 100 
      : 0;
    
    this.stats.state = this.state;
  }

  /**
   * Get circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  getStats(): CircuitStats {
    return { ...this.stats };
  }

  /**
   * Reset circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = undefined;
    this.emitter.emit('reset', { name: this.name });
    console.log(`🔄 Circuit ${this.name} has been reset`);
  }
}

/**
 * Circuit Breaker Service
 * Prevents cascade failures by stopping requests to failing services
 */
export class CircuitBreakerService extends EventEmitter {
  private static instance: CircuitBreakerService;
  private circuits = new Map<string, Circuit>();
  private defaultOptions: Required<CircuitOptions> = {
    failureThreshold: 5,       // Open after 5 failures
    successThreshold: 2,        // Close after 2 successes in half-open
    timeout: 3000,             // 3 second timeout
    resetTimeout: 30000,       // Try again after 30 seconds
    volumeThreshold: 10,       // Minimum requests before considering error rate
    errorThresholdPercentage: 50  // Open if error rate > 50%
  };

  private constructor() {
    super();
    this.initializeDefaultCircuits();
  }

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  /**
   * Initialize circuits for common services
   */
  private initializeDefaultCircuits(): void {
    // Ollama LLM service
    this.register('ollama', { 
      timeout: 10000,           // 10 second timeout for LLM
      failureThreshold: 3,      // Open after 3 failures
      resetTimeout: 60000       // Try again after 1 minute
    });

    // Walmart API
    this.register('walmart-api', { 
      timeout: 5000,            // 5 second timeout
      failureThreshold: 5,      // Open after 5 failures
      resetTimeout: 30000       // Try again after 30 seconds
    });

    // Database
    this.register('database', { 
      timeout: 2000,            // 2 second timeout
      failureThreshold: 10,     // Open after 10 failures
      resetTimeout: 10000       // Try again after 10 seconds
    });

    // External APIs
    this.register('external-api', {
      timeout: 8000,            // 8 second timeout
      failureThreshold: 4,      // Open after 4 failures
      resetTimeout: 45000       // Try again after 45 seconds
    });

    // Cache service
    this.register('cache', {
      timeout: 500,             // 500ms timeout
      failureThreshold: 20,     // Open after 20 failures
      resetTimeout: 5000        // Try again after 5 seconds
    });

    console.log('✅ Circuit breaker service initialized with default circuits');
  }

  /**
   * Register a new circuit
   */
  register(name: string, options: CircuitOptions = {}): void {
    if (this.circuits.has(name)) {
      console.warn(`Circuit ${name} already registered, updating options`);
    }

    const circuit = new Circuit(
      name,
      { ...this.defaultOptions, ...options },
      this
    );
    
    this.circuits.set(name, circuit);
    this.emit('circuit-registered', { name, options });
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(
    name: string,
    fn: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    let circuit = this.circuits.get(name);
    
    if (!circuit) {
      // Auto-register circuit with default options
      this.register(name);
      circuit = this.circuits.get(name)!;
    }
    
    return circuit.execute(fn, fallback);
  }

  /**
   * Execute with automatic retry logic
   */
  async executeWithRetry<T>(
    name: string,
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      fallback?: () => T | Promise<T>;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, fallback } = options;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(name, fn, fallback);
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        console.log(`🔄 Retrying ${name} (attempt ${attempt + 1}/${maxRetries})`);
      }
    }
    
    throw new Error(`All retry attempts failed for ${name}`);
  }

  /**
   * Get circuit state
   */
  getCircuitState(name: string): CircuitState | undefined {
    return this.circuits.get(name)?.getState();
  }

  /**
   * Get circuit statistics
   */
  getCircuitStats(name: string): CircuitStats | undefined {
    return this.circuits.get(name)?.getStats();
  }

  /**
   * Get all circuit statistics
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    
    for (const [name, circuit] of this.circuits) {
      stats[name] = circuit.getStats();
    }
    
    return stats;
  }

  /**
   * Check if a circuit is healthy
   */
  isHealthy(name: string): boolean {
    const state = this.getCircuitState(name);
    return state === CircuitState.CLOSED;
  }

  /**
   * Get health status of all circuits
   */
  getHealthStatus(): {
    healthy: string[];
    degraded: string[];
    unhealthy: string[];
    overall: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const healthy: string[] = [];
    const degraded: string[] = [];
    const unhealthy: string[] = [];
    
    for (const [name, circuit] of this.circuits) {
      const state = circuit.getState();
      
      switch (state) {
        case CircuitState.CLOSED:
          healthy.push(name);
          break;
        case CircuitState.HALF_OPEN:
          degraded.push(name);
          break;
        case CircuitState.OPEN:
          unhealthy.push(name);
          break;
      }
    }
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthy.length > 0) {
      overall = 'unhealthy';
    } else if (degraded.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }
    
    return { healthy, degraded, unhealthy, overall };
  }

  /**
   * Reset specific circuit
   */
  reset(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.reset();
      this.emit('circuit-reset', { name });
    }
  }

  /**
   * Reset all circuits
   */
  resetAll(): void {
    for (const circuit of this.circuits.values()) {
      circuit.reset();
    }
    this.emit('all-circuits-reset');
    console.log('🔄 All circuits have been reset');
  }

  /**
   * Remove a circuit
   */
  remove(name: string): void {
    if (this.circuits.delete(name)) {
      this.emit('circuit-removed', { name });
    }
  }

  /**
   * Shutdown service
   */
  shutdown(): void {
    this.resetAll();
    this.circuits.clear();
    this.removeAllListeners();
    console.log('Circuit breaker service shut down');
  }
}

// Export singleton instance
export const circuitBreaker = CircuitBreakerService.getInstance();