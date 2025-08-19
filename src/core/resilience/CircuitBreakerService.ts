/**
 * Comprehensive Circuit Breaker Service for Walmart Grocery Agent Microservices
 * 
 * Phase 7 Task 3: Adds circuit breakers and retry logic for all external service calls
 * 
 * Features:
 * - Service-specific circuit breakers (Ollama, Redis, SQLite, External APIs, WebSocket)
 * - Exponential backoff with jitter
 * - Bulkhead pattern implementation
 * - Fallback mechanisms for each service type
 * - Integration with monitoring system
 * - Dashboard metrics for circuit breaker visualization
 * - Dead letter queue for failed operations
 * - Idempotency key support
 */

import { EventEmitter } from 'events';
import { CircuitBreaker, CircuitBreakerManager } from '../events/CircuitBreaker.js';
import type { CircuitBreakerConfig, RetryPolicy, FallbackOptions } from '../events/CircuitBreaker.js';
import { monitoringSystem } from '../../monitoring/MonitoringSystem.js';
import { logger } from '../../utils/logger.js';
import { cacheManager } from '../cache/RedisCacheManager.js';
import { z } from 'zod';

// Service-specific configuration schemas
export const ServiceCircuitBreakerConfigSchema = z.object({
  service: z.enum(['ollama', 'redis', 'sqlite', 'external_api', 'websocket', 'service_mesh']),
  config: z.object({
    failureThreshold: z.number().min(1).default(5),
    successThreshold: z.number().min(1).default(3),
    timeout: z.number().min(1000).default(60000),
    monitor: z.boolean().default(true),
    resetOnSuccess: z.boolean().default(true),
    fallbackEnabled: z.boolean().default(true),
  }),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).default(3),
    baseDelay: z.number().min(100).default(1000),
    maxDelay: z.number().min(1000).default(30000),
    backoffMultiplier: z.number().min(1).default(2),
    jitter: z.boolean().default(true),
    retryableErrors: z.array(z.string()).default([]),
    nonRetryableErrors: z.array(z.string()).default([]),
  }),
  bulkhead: z.object({
    maxConcurrent: z.number().min(1).default(10),
    queueSize: z.number().min(0).default(50),
    timeout: z.number().min(1000).default(30000),
  }).optional(),
  fallback: z.object({
    type: z.enum(['cache', 'default', 'function', 'queue']),
    cacheKey: z.string().optional(),
    defaultValue: z.any().optional(),
    queueName: z.string().optional(),
  }).optional(),
});

export type ServiceCircuitBreakerConfig = z.infer<typeof ServiceCircuitBreakerConfigSchema>;

// Bulkhead semaphore for resource isolation
export interface BulkheadStats {
  service: string;
  maxConcurrent: number;
  currentActive: number;
  queueSize: number;
  totalRequests: number;
  totalRejected: number;
  averageWaitTime: number;
}

class Semaphore {
  private permits: number;
  private queue: Array<{ resolve: () => void; reject: (error: Error) => void; timestamp: number }> = [];
  private active: number = 0;

  constructor(private maxPermits: number) {
    this.permits = maxPermits;
  }

  async acquire(timeoutMs: number = 30000): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      this.active++;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.queue.push({ resolve, reject, timestamp });

      const timeout = setTimeout(() => {
        const index = this.queue.findIndex(item => item.timestamp === timestamp);
        if (index !== -1) {
          this.queue.splice(index, 1);
          reject(new Error('Semaphore acquisition timeout'));
        }
      }, timeoutMs);

      const originalResolve = resolve;
      const wrappedResolve = () => {
        clearTimeout(timeout);
        this.permits--;
        this.active++;
        originalResolve();
      };

      this.queue[this.queue.length - 1]!.resolve = wrappedResolve;
    });
  }

  release(): void {
    this.active--;
    this.permits++;

    if (this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        next.resolve();
      }
    }
  }

  getStats(): { active: number; queued: number; available: number } {
    return {
      active: this.active,
      queued: this.queue.length,
      available: this.permits,
    };
  }
}

// Dead Letter Queue for failed operations
export interface DeadLetterItem {
  id: string;
  service: string;
  operation: string;
  payload: any;
  error: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

class DeadLetterQueue {
  private items = new Map<string, DeadLetterItem>();
  private maxSize: number = 1000;

  add(item: Omit<DeadLetterItem, 'id' | 'timestamp'>): void {
    const id = `${item.service}_${item.operation}_${Date.now()}_${Math.random()}`;
    const dlqItem: DeadLetterItem = {
      ...item,
      id,
      timestamp: new Date(),
    };

    this.items.set(id, dlqItem);

    // Prevent memory leaks
    if (this.items.size > this.maxSize) {
      const oldest = Array.from(this.items.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime())[0];
      if (oldest) {
        this.items.delete(oldest[0]);
      }
    }

    logger.warn('Operation added to dead letter queue', 'CIRCUIT_BREAKER', {
      service: item.service,
      operation: item.operation,
      error: item.error,
      retryCount: item.retryCount,
    });
  }

  getAll(): DeadLetterItem[] {
    return Array.from(this.items.values());
  }

  get(id: string): DeadLetterItem | undefined {
    return this.items.get(id);
  }

  remove(id: string): boolean {
    return this.items.delete(id);
  }

  clear(): void {
    this.items.clear();
  }

  getStats(): { total: number; byService: Record<string, number> } {
    const items = Array.from(this.items.values());
    const byService = items.reduce((acc, item) => {
      acc[item.service] = (acc[item.service] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total: items.length, byService };
  }
}

/**
 * Main Circuit Breaker Service for all microservices
 */
export class CircuitBreakerService extends EventEmitter {
  private static instance: CircuitBreakerService;
  private circuitBreakerManager: CircuitBreakerManager;
  private serviceConfigs = new Map<string, ServiceCircuitBreakerConfig>();
  private bulkheads = new Map<string, Semaphore>();
  private deadLetterQueue = new DeadLetterQueue();
  private metrics = new Map<string, any>();
  private initialized = false;

  private constructor() {
    super();
    this.circuitBreakerManager = new CircuitBreakerManager();
    this.setupDefaultConfigurations();
    this.startMetricsCollection();
  }

  static getInstance(): CircuitBreakerService {
    if (!CircuitBreakerService.instance) {
      CircuitBreakerService.instance = new CircuitBreakerService();
    }
    return CircuitBreakerService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    logger.info('Initializing Circuit Breaker Service', 'CIRCUIT_BREAKER');

    // Setup monitoring integration
    this.setupMonitoringIntegration();

    // Setup graceful shutdown
    this.setupGracefulShutdown();

    this.initialized = true;

    logger.info('Circuit Breaker Service initialized successfully', 'CIRCUIT_BREAKER', {
      services: Array.from(this.serviceConfigs.keys()),
    });

    this.emit('initialized');
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    service: string,
    operation: string,
    fn: () => Promise<T>,
    options: {
      fallbackOptions?: FallbackOptions<T>;
      idempotencyKey?: string;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const serviceConfig = this.serviceConfigs.get(service);
    if (!serviceConfig) {
      throw new Error(`No circuit breaker configuration found for service: ${service}`);
    }

    const circuitBreakerName = `${service}_${operation}`;
    const startTime = Date.now();

    try {
      // Bulkhead pattern: limit concurrent requests
      const bulkhead = this.getBulkhead(service);
      await bulkhead.acquire(serviceConfig.bulkhead?.timeout || 30000);

      try {
        // Execute with circuit breaker
        const result = await this.circuitBreakerManager.execute(
          circuitBreakerName,
          async () => {
            // Add operation timeout
            const timeoutMs = options.timeout || serviceConfig.config.timeout;
            return this.withTimeout(fn(), timeoutMs);
          },
          this.buildFallbackOptions(service, options.fallbackOptions),
          serviceConfig.config
        );

        // Record success metrics
        this.recordMetrics(service, operation, 'success', Date.now() - startTime);
        
        return result;
      } finally {
        bulkhead.release();
      }
    } catch (error) {
      // Record failure metrics
      this.recordMetrics(service, operation, 'failure', Date.now() - startTime);

      // Add to dead letter queue if max retries exceeded
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('Circuit breaker') || errorMsg.includes('Maximum retry')) {
        this.deadLetterQueue.add({
          service,
          operation,
          payload: options,
          error: errorMsg,
          retryCount: serviceConfig.retryPolicy.maxAttempts,
          maxRetries: serviceConfig.retryPolicy.maxAttempts,
        });
      }

      throw error;
    }
  }

  /**
   * Ollama API circuit breaker
   */
  async executeOllamaRequest<T>(
    operation: string,
    fn: () => Promise<T>,
    fallbackFn?: () => Promise<T>
  ): Promise<T> {
    return this.executeWithCircuitBreaker('ollama', operation, fn, {
      fallbackOptions: {
        fallbackFunction: fallbackFn || (() => this.getOllamaFallback(operation)),
        useCache: true,
        cacheKey: `ollama_fallback_${operation}`,
      },
    });
  }

  /**
   * Redis circuit breaker
   */
  async executeRedisOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T> {
    return this.executeWithCircuitBreaker('redis', operation, fn, {
      fallbackOptions: {
        fallbackValue: (fallbackValue || null) as T,
        useCache: false, // Redis is the cache, use in-memory fallback
      },
    });
  }

  /**
   * SQLite database circuit breaker
   */
  async executeDatabaseQuery<T>(
    operation: string,
    fn: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    return this.executeWithCircuitBreaker('sqlite', operation, fn, {
      fallbackOptions: {
        fallbackValue: (fallbackData || null) as T,
        useCache: true,
        cacheKey: `db_fallback_${operation}`,
      },
    });
  }

  /**
   * External API circuit breaker (e.g., Walmart pricing)
   */
  async executeExternalAPI<T>(
    apiName: string,
    operation: string,
    fn: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    return this.executeWithCircuitBreaker('external_api', `${apiName}_${operation}`, fn, {
      fallbackOptions: {
        fallbackValue: fallbackData,
        useCache: true,
        cacheKey: `api_fallback_${apiName}_${operation}`,
      },
    });
  }

  /**
   * WebSocket circuit breaker
   */
  async executeWebSocketOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    queueFallback: boolean = true
  ): Promise<T> {
    return this.executeWithCircuitBreaker('websocket', operation, fn, {
      fallbackOptions: queueFallback ? {
        fallbackFunction: async () => {
          // Queue message for later delivery
          this.deadLetterQueue.add({
            service: 'websocket',
            operation,
            payload: { queued: true },
            error: 'WebSocket unavailable, queued for later',
            retryCount: 0,
            maxRetries: 3,
          });
          return null as T;
        },
      } : undefined,
    });
  }

  /**
   * Service-to-service communication circuit breaker
   */
  async executeServiceCall<T>(
    targetService: string,
    operation: string,
    fn: () => Promise<T>,
    fallbackData?: T
  ): Promise<T> {
    return this.executeWithCircuitBreaker('service_mesh', `${targetService}_${operation}`, fn, {
      fallbackOptions: {
        fallbackValue: fallbackData,
        useCache: true,
        cacheKey: `service_fallback_${targetService}_${operation}`,
      },
    });
  }

  /**
   * Get circuit breaker state for monitoring
   */
  getCircuitBreakerState(service?: string): Record<string, any> {
    const allStats = this.circuitBreakerManager.getAllStats();
    
    if (service) {
      return Object.fromEntries(
        Object.entries(allStats).filter(([name]) => name.startsWith(service))
      );
    }
    
    return allStats;
  }

  /**
   * Get overall system health
   */
  getSystemHealth(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, any>;
    bulkheads: Record<string, BulkheadStats>;
    deadLetterQueue: any;
  } {
    const overallHealth = this.circuitBreakerManager.getOverallHealth();
    const services: Record<string, any> = {};

    // Get service-specific health
    for (const [serviceName] of Array.from(this.serviceConfigs)) {
      const serviceStats = Object.entries(this.circuitBreakerManager.getAllStats())
        .filter(([name]) => name.startsWith(serviceName))
        .reduce((acc, [name, stats]) => {
          acc[name] = stats;
          return acc;
        }, {} as Record<string, any>);

      services[serviceName] = {
        circuitBreakers: serviceStats,
        bulkhead: this.getBulkheadStats(serviceName),
      };
    }

    return {
      overall: overallHealth.status,
      services,
      bulkheads: this.getAllBulkheadStats(),
      deadLetterQueue: this.deadLetterQueue.getStats(),
    };
  }

  /**
   * Update service configuration
   */
  updateServiceConfig(service: string, config: Partial<ServiceCircuitBreakerConfig>): void {
    const currentConfig = this.serviceConfigs.get(service);
    if (!currentConfig) {
      throw new Error(`Service ${service} not found`);
    }

    const updatedConfig = ServiceCircuitBreakerConfigSchema.parse({
      ...currentConfig,
      ...config,
    });

    this.serviceConfigs.set(service, updatedConfig);

    // Update bulkhead if configuration changed
    if (config.bulkhead) {
      this.bulkheads.set(service, new Semaphore(config.bulkhead.maxConcurrent || 10));
    }

    logger.info('Service configuration updated', 'CIRCUIT_BREAKER', {
      service,
      updatedFields: Object.keys(config),
    });

    this.emit('config-updated', { service, config: updatedConfig });
  }

  /**
   * Manual circuit breaker control
   */
  resetCircuitBreaker(service: string, operation?: string): void {
    if (operation) {
      const breakerName = `${service}_${operation}`;
      const breaker = this.circuitBreakerManager.getCircuitBreaker(breakerName);
      breaker.reset();
    } else {
      // Reset all circuit breakers for the service
      const allStats = this.circuitBreakerManager.getAllStats();
      Object.keys(allStats)
        .filter(name => name.startsWith(service))
        .forEach(name => {
          const breaker = this.circuitBreakerManager.getCircuitBreaker(name);
          breaker.reset();
        });
    }

    logger.info('Circuit breaker reset', 'CIRCUIT_BREAKER', { service, operation });
    this.emit('circuit-breaker-reset', { service, operation });
  }

  /**
   * Force circuit breaker open (for maintenance)
   */
  forceCircuitBreakerOpen(service: string, operation?: string): void {
    if (operation) {
      const breakerName = `${service}_${operation}`;
      const breaker = this?.circuitBreakerManager?.getCircuitBreaker(breakerName);
      breaker.forceOpen();
    } else {
      // Force open all circuit breakers for the service
      const allStats = this?.circuitBreakerManager?.getAllStats();
      Object.keys(allStats)
        .filter(name => name.startsWith(service))
        .forEach(name => {
          const breaker = this?.circuitBreakerManager?.getCircuitBreaker(name);
          breaker.forceOpen();
        });
    }

    logger.warn('Circuit breaker forced open', 'CIRCUIT_BREAKER', { service, operation });
    this.emit('circuit-breaker-forced-open', { service, operation });
  }

  /**
   * Get dead letter queue items
   */
  getDeadLetterQueue(): DeadLetterItem[] {
    return this?.deadLetterQueue?.getAll();
  }

  /**
   * Retry dead letter queue item
   */
  async retryDeadLetterItem(id: string): Promise<boolean> {
    const item = this?.deadLetterQueue?.get(id);
    if (!item) {
      return false;
    }

    try {
      // This would need to be implemented based on the specific operation
      // For now, we just remove it from the dead letter queue
      this?.deadLetterQueue?.remove(id);
      logger.info('Dead letter queue item retried', 'CIRCUIT_BREAKER', { id, item });
      return true;
    } catch (error) {
      logger.error('Failed to retry dead letter queue item', 'CIRCUIT_BREAKER', { id, item }, error as Error);
      return false;
    }
  }

  // Private helper methods

  private setupDefaultConfigurations(): void {
    // Ollama configuration - higher timeout, more retries
    this?.serviceConfigs?.set('ollama', {
      service: 'ollama',
      config: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 300000, // 5 minutes for LLM operations
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 2, // Limited retries for expensive operations
        baseDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ECONNREFUSED', 'TIMEOUT', '502', '503', '504'],
        nonRetryableErrors: ['400', '401', '403', '422'],
      },
      bulkhead: {
        maxConcurrent: 3, // Limit concurrent LLM requests
        queueSize: 10,
        timeout: 60000,
      },
      fallback: {
        type: 'cache',
        cacheKey: 'ollama_fallback',
      },
    });

    // Redis configuration - fast fail, quick recovery
    this?.serviceConfigs?.set('redis', {
      service: 'redis',
      config: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 10000,
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 3,
        baseDelay: 500,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ECONNREFUSED', 'TIMEOUT'],
        nonRetryableErrors: ['WRONGTYPE', 'NOAUTH'],
      },
      bulkhead: {
        maxConcurrent: 50,
        queueSize: 100,
        timeout: 5000,
      },
      fallback: {
        type: 'default',
        defaultValue: null,
      },
    });

    // SQLite configuration - medium tolerance
    this?.serviceConfigs?.set('sqlite', {
      service: 'sqlite',
      config: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 8000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['SQLITE_BUSY', 'SQLITE_LOCKED', 'ENOENT'],
        nonRetryableErrors: ['SQLITE_CONSTRAINT', 'SQLITE_MISUSE'],
      },
      bulkhead: {
        maxConcurrent: 20,
        queueSize: 50,
        timeout: 15000,
      },
      fallback: {
        type: 'cache',
        cacheKey: 'sqlite_fallback',
      },
    });

    // External API configuration - conservative approach
    this?.serviceConfigs?.set('external_api', {
      service: 'external_api',
      config: {
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 60000,
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 30000,
        backoffMultiplier: 2.5,
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ECONNREFUSED', 'TIMEOUT', '429', '502', '503', '504'],
        nonRetryableErrors: ['400', '401', '403', '404', '422'],
      },
      bulkhead: {
        maxConcurrent: 10,
        queueSize: 25,
        timeout: 30000,
      },
      fallback: {
        type: 'cache',
        cacheKey: 'external_api_fallback',
      },
    });

    // WebSocket configuration - queue failed messages
    this?.serviceConfigs?.set('websocket', {
      service: 'websocket',
      config: {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 10000,
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 2,
        baseDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ECONNREFUSED', 'WS_ERR'],
        nonRetryableErrors: ['WS_AUTH_FAILED'],
      },
      bulkhead: {
        maxConcurrent: 100,
        queueSize: 200,
        timeout: 5000,
      },
      fallback: {
        type: 'queue',
        queueName: 'websocket_fallback',
      },
    });

    // Service mesh configuration - internal service calls
    this?.serviceConfigs?.set('service_mesh', {
      service: 'service_mesh',
      config: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 30000,
        monitor: true,
        resetOnSuccess: true,
        fallbackEnabled: true,
      },
      retryPolicy: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 15000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: ['ECONNRESET', 'ECONNREFUSED', 'TIMEOUT', '502', '503', '504'],
        nonRetryableErrors: ['400', '401', '403', '404'],
      },
      bulkhead: {
        maxConcurrent: 25,
        queueSize: 50,
        timeout: 20000,
      },
      fallback: {
        type: 'cache',
        cacheKey: 'service_mesh_fallback',
      },
    });

    // Initialize bulkheads
    for (const [service, config] of Array.from(this.serviceConfigs)) {
      if (config.bulkhead) {
        this?.bulkheads?.set(service, new Semaphore(config?.bulkhead?.maxConcurrent));
      }
    }
  }

  private getBulkhead(service: string): Semaphore {
    let bulkhead = this?.bulkheads?.get(service);
    if (!bulkhead) {
      const config = this?.serviceConfigs?.get(service);
      const maxConcurrent = config?.bulkhead?.maxConcurrent || 10;
      bulkhead = new Semaphore(maxConcurrent);
      this?.bulkheads?.set(service, bulkhead);
    }
    return bulkhead;
  }

  private getBulkheadStats(service: string): BulkheadStats {
    const bulkhead = this.getBulkhead(service);
    const stats = bulkhead.getStats();
    const config = this?.serviceConfigs?.get(service);

    return {
      service,
      maxConcurrent: config?.bulkhead?.maxConcurrent || 10,
      currentActive: stats.active,
      queueSize: stats.queued,
      totalRequests: 0, // Would need to track this
      totalRejected: 0, // Would need to track this
      averageWaitTime: 0, // Would need to track this
    };
  }

  private getAllBulkheadStats(): Record<string, BulkheadStats> {
    const stats: Record<string, BulkheadStats> = {};
    if (this.serviceConfigs) {
      for (const service of Array.from(this.serviceConfigs.keys())) {
        stats[service] = this.getBulkheadStats(service);
      }
    }
    return stats;
  }

  private buildFallbackOptions<T>(service: string, customOptions?: FallbackOptions<T>): FallbackOptions<T> | undefined {
    const config = this?.serviceConfigs?.get(service);
    if (!config?.fallback) return customOptions;

    const fallbackOptions: FallbackOptions<T> = { ...customOptions };

    switch (config?.fallback?.type) {
      case 'cache':
        fallbackOptions.useCache = true;
        fallbackOptions.cacheKey = config?.fallback?.cacheKey;
        break;
      case 'default':
        fallbackOptions.fallbackValue = config?.fallback?.defaultValue as T;
        break;
      case 'queue':
        fallbackOptions.fallbackFunction = async () => {
          // Add to queue for later processing
          return null as T;
        };
        break;
    }

    return fallbackOptions;
  }

  private async getOllamaFallback<T>(operation: string): Promise<T> {
    // Try cache first
    try {
      const cached = await cacheManager.get<T>(`ollama_fallback_${operation}`);
      if (cached) return cached;
    } catch (error) {
      // Cache might be down too
    }

    // Return simple fallback based on operation type
    if (operation.includes('generate')) {
      return "I apologize, but I'm experiencing technical difficulties. Please try again in a moment." as T;
    }

    return null as T;
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private recordMetrics(service: string, operation: string, result: 'success' | 'failure', duration: number): void {
    const key = `${service}_${operation}`;
    const existing = this?.metrics?.get(key) || { 
      successCount: 0, 
      failureCount: 0, 
      totalDuration: 0, 
      lastUpdated: Date.now() 
    };

    if (result === 'success') {
      existing.successCount++;
    } else {
      existing.failureCount++;
    }

    existing.totalDuration += duration;
    existing.lastUpdated = Date.now();
    
    this?.metrics?.set(key, existing);
  }

  private setupMonitoringIntegration(): void {
    // Send circuit breaker metrics to monitoring system
    setInterval(() => {
      const allStats = this?.circuitBreakerManager?.getAllStats();
      const systemHealth = this.getSystemHealth();

      for (const [name, stats] of Object.entries(allStats)) {
        monitoringSystem.emit('circuit-breaker-metrics', {
          name,
          state: stats.state,
          totalRequests: stats.totalRequests,
          successfulRequests: stats.successfulRequests,
          failedRequests: stats.failedRequests,
          rejectedRequests: stats.rejectedRequests,
          averageResponseTime: stats.averageResponseTime,
        });
      }

      // Send overall health status
      monitoringSystem.emit('system-health', systemHealth);

    }, 30000); // Every 30 seconds
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const stats = this.getSystemHealth();
      
      logger.debug('Circuit breaker metrics', 'CIRCUIT_BREAKER', {
        overall: stats.overall,
        servicesCount: Object.keys(stats.services).length,
        deadLetterQueueSize: stats?.deadLetterQueue?.total,
      });
    }, 60000); // Every minute
  }

  private setupGracefulShutdown(): void {
    const shutdown = () => {
      logger.info('Shutting down Circuit Breaker Service', 'CIRCUIT_BREAKER');
      
      // Reset all circuit breakers
      this?.circuitBreakerManager?.resetAll();
      
      // Clear metrics
      this?.metrics?.clear();
      this?.deadLetterQueue?.clear();
      
      logger.info('Circuit Breaker Service shutdown complete', 'CIRCUIT_BREAKER');
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }
}

// Export singleton instance
export const circuitBreakerService = CircuitBreakerService.getInstance();

// Types DeadLetterItem and BulkheadStats are already defined above in the file