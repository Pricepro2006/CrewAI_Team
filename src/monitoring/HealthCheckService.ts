/**
 * Comprehensive Health Check Service for Walmart Grocery Agent Microservices
 * 
 * Phase 7 Task 1: Health monitoring for 6 microservices:
 * - walmart-api-server (port 3000)
 * - walmart-websocket (port 8080)
 * - walmart-pricing (port 3007)
 * - walmart-nlp-queue (port 3008)
 * - walmart-cache-warmer (port 3006)
 * - walmart-memory-monitor (port 3009)
 */

import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { promisify } from 'node:util';
import os from 'node:os';
import process from 'node:process';
import { logger } from '../utils/logger.js';
import { metricsCollector } from './MetricsCollector.js';
import Database from 'better-sqlite3';
import Redis from 'ioredis';
import WebSocket from 'ws';

// Types and Interfaces
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type ServiceType = 'api' | 'websocket' | 'queue' | 'cache' | 'monitor' | 'database' | 'external';

export interface ServiceConfig {
  id: string;
  name: string;
  type: ServiceType;
  host: string;
  port: number;
  healthEndpoint?: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  critical: boolean;
  timeout: number;
  retries: number;
  interval: number;
  dependencies?: string[];
  tags?: string[];
}

export interface HealthCheckResult {
  serviceId: string;
  serviceName: string;
  status: HealthStatus;
  responseTime: number;
  timestamp: Date;
  uptime?: number;
  version?: string;
  error?: string;
  checks: {
    liveness: CheckResult;
    readiness: CheckResult;
    dependencies: CheckResult[];
    resources: ResourceCheck;
  };
  metadata?: Record<string, any>;
}

export interface CheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: Record<string, any>;
  responseTime?: number;
}

export interface ResourceCheck {
  cpu: {
    usage: number;
    status: HealthStatus;
  };
  memory: {
    usage: number;
    total: number;
    percentage: number;
    status: HealthStatus;
  };
  connections?: {
    active: number;
    max: number;
    percentage: number;
    status: HealthStatus;
  };
  diskSpace?: {
    usage: number;
    total: number;
    percentage: number;
    status: HealthStatus;
  };
}

export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailure?: Date;
  nextRetry?: Date;
}

export interface AggregatedHealth {
  overall: HealthStatus;
  services: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical_down: string[];
  };
  lastCheck: Date;
  uptime: number;
  version: string;
  environment: string;
}

export interface PrometheusMetrics {
  [key: string]: {
    value: number;
    labels?: Record<string, string>;
    help?: string;
    type?: 'counter' | 'gauge' | 'histogram' | 'summary';
  };
}

// Default service configurations for Walmart microservices
const DEFAULT_SERVICES: ServiceConfig[] = [
  {
    id: 'walmart-api-server',
    name: 'Walmart API Server',
    type: 'api',
    host: 'localhost',
    port: 3000,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: true,
    timeout: 5000,
    retries: 3,
    interval: 30000,
    dependencies: ['database', 'redis'],
    tags: ['core', 'api']
  },
  {
    id: 'walmart-websocket',
    name: 'Walmart WebSocket Service',
    type: 'websocket',
    host: 'localhost',
    port: 8080,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: true,
    timeout: 5000,
    retries: 3,
    interval: 30000,
    dependencies: ['walmart-api-server'],
    tags: ['realtime', 'websocket']
  },
  {
    id: 'walmart-pricing',
    name: 'Walmart Pricing Service',
    type: 'api',
    host: 'localhost',
    port: 3007,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: true,
    timeout: 5000,
    retries: 3,
    interval: 30000,
    dependencies: ['database', 'redis'],
    tags: ['pricing', 'core']
  },
  {
    id: 'walmart-nlp-queue',
    name: 'Walmart NLP Queue Service',
    type: 'queue',
    host: 'localhost',
    port: 3008,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: false,
    timeout: 5000,
    retries: 3,
    interval: 30000,
    dependencies: ['redis', 'ollama'],
    tags: ['nlp', 'queue']
  },
  {
    id: 'walmart-cache-warmer',
    name: 'Walmart Cache Warmer',
    type: 'cache',
    host: 'localhost',
    port: 3006,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: false,
    timeout: 5000,
    retries: 2,
    interval: 60000,
    dependencies: ['redis', 'walmart-api-server'],
    tags: ['cache', 'performance']
  },
  {
    id: 'walmart-memory-monitor',
    name: 'Walmart Memory Monitor',
    type: 'monitor',
    host: 'localhost',
    port: 3009,
    healthEndpoint: '/health',
    protocol: 'http',
    critical: false,
    timeout: 5000,
    retries: 2,
    interval: 45000,
    dependencies: [],
    tags: ['monitoring', 'memory']
  }
];

export class HealthCheckService extends EventEmitter {
  private static instance: HealthCheckService;
  private services = new Map<string, ServiceConfig>();
  private healthResults = new Map<string, HealthCheckResult>();
  private circuitBreakers = new Map<string, CircuitBreakerState>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private startTime = Date.now();
  private version = '1.0.0';
  private environment = process.env.NODE_ENV || 'development';
  
  // Dependency connections
  private database?: Database.Database;
  private redisClient?: Redis;
  private ollamaHealth?: boolean;

  // Thresholds
  private readonly CPU_THRESHOLD_WARNING = 70;
  private readonly CPU_THRESHOLD_CRITICAL = 90;
  private readonly MEMORY_THRESHOLD_WARNING = 80;
  private readonly MEMORY_THRESHOLD_CRITICAL = 95;
  private readonly DISK_THRESHOLD_WARNING = 85;
  private readonly DISK_THRESHOLD_CRITICAL = 95;

  private constructor() {
    super();
    this.initializeDefaultServices();
    this.setupDependencies();
    this.setupGracefulShutdown();
  }

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Initialize default Walmart microservices
   */
  private initializeDefaultServices(): void {
    DEFAULT_SERVICES.forEach(service => {
      this?.services?.set(service.id, service);
      this?.circuitBreakers?.set(service.id, {
        state: 'closed',
        failures: 0
      });
    });
    
    logger.info('Initialized health check services', 'HEALTH_CHECK', {
      serviceCount: this?.services?.size,
      services: Array.from(this?.services?.keys())
    });
  }

  /**
   * Setup external dependencies
   */
  private async setupDependencies(): Promise<void> {
    try {
      // SQLite Database
      const dbPath = process.env.DATABASE_PATH || './data/grocery.db';
      this.database = new Database(dbPath, { readonly: true });
      
      // Redis
      if (process.env.REDIS_HOST) {
        this.redisClient = new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          lazyConnect: true,
          retryDelayOnFailover: 100,
          maxRetriesPerRequest: 3
        });
      }

      logger.info('Health check dependencies initialized', 'HEALTH_CHECK');
    } catch (error) {
      logger.error('Failed to initialize dependencies', 'HEALTH_CHECK', { error });
    }
  }

  /**
   * Register a new service for health monitoring
   */
  public registerService(config: ServiceConfig): void {
    this?.services?.set(config.id, config);
    this?.circuitBreakers?.set(config.id, {
      state: 'closed',
      failures: 0
    });
    
    logger.info('Service registered for health monitoring', 'HEALTH_CHECK', {
      serviceId: config.id,
      serviceName: config.name
    });
    
    this.emit('service:registered', config);
  }

  /**
   * Unregister a service
   */
  public unregisterService(serviceId: string): void {
    const config = this?.services?.get(serviceId);
    if (config) {
      this.stopHealthCheck(serviceId);
      this?.services?.delete(serviceId);
      this?.healthResults?.delete(serviceId);
      this?.circuitBreakers?.delete(serviceId);
      
      logger.info('Service unregistered', 'HEALTH_CHECK', { serviceId });
      this.emit('service:unregistered', serviceId);
    }
  }

  /**
   * Start health monitoring for all services
   */
  public startHealthMonitoring(): void {
    this?.services?.forEach((config: any) => {
      this.startServiceHealthCheck(config);
    });
    
    logger.info('Health monitoring started', 'HEALTH_CHECK', {
      serviceCount: this?.services?.size
    });
    
    this.emit('monitoring:started');
  }

  /**
   * Start health monitoring for a specific service
   */
  public startServiceHealthCheck(config: ServiceConfig): void {
    this.stopHealthCheck(config.id); // Stop existing if any
    
    // Perform initial check
    this.performHealthCheck(config).catch(error => {
      logger.error('Initial health check failed', 'HEALTH_CHECK', {
        serviceId: config.id,
        error: error.message
      });
    });
    
    // Schedule periodic checks
    const interval = setInterval(() => {
      this.performHealthCheck(config).catch(error => {
        logger.error('Periodic health check failed', 'HEALTH_CHECK', {
          serviceId: config.id,
          error: error.message
        });
      });
    }, config.interval);
    
    this?.intervals?.set(config.id, interval);
    
    logger.info('Health monitoring started for service', 'HEALTH_CHECK', {
      serviceId: config.id,
      interval: config.interval
    });
  }

  /**
   * Stop health monitoring for a service
   */
  public stopHealthCheck(serviceId: string): void {
    const interval = this?.intervals?.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this?.intervals?.delete(serviceId);
      
      logger.info('Health monitoring stopped for service', 'HEALTH_CHECK', {
        serviceId
      });
    }
  }

  /**
   * Stop all health monitoring
   */
  public stopAllHealthChecks(): void {
    this?.intervals?.forEach((interval, serviceId) => {
      clearInterval(interval);
    });
    this?.intervals?.clear();
    
    logger.info('All health monitoring stopped', 'HEALTH_CHECK');
    this.emit('monitoring:stopped');
  }

  /**
   * Perform comprehensive health check for a service
   */
  public async performHealthCheck(config: ServiceConfig): Promise<HealthCheckResult> {
    const startTime = performance.now();
    const timestamp = new Date();
    const circuitBreaker = this?.circuitBreakers?.get(config.id)!;

    // Check circuit breaker
    if (circuitBreaker.state === 'open') {
      if (circuitBreaker.nextRetry && new Date() < circuitBreaker.nextRetry) {
        return this.createFailedResult(config, 'Circuit breaker open', startTime, timestamp);
      } else {
        circuitBreaker.state = 'half-open';
      }
    }

    try {
      // Perform all health checks
      const [liveness, readiness, dependencies, resources] = await Promise.allSettled([
        this.checkLiveness(config),
        this.checkReadiness(config),
        this.checkDependencies(config),
        this.checkResources(config)
      ]);

      const livenessResult = liveness.status === 'fulfilled' ? liveness.value : 
        { name: 'liveness', status: 'unhealthy' as HealthStatus, message: 'Liveness check failed' };
      
      const readinessResult = readiness.status === 'fulfilled' ? readiness.value :
        { name: 'readiness', status: 'unhealthy' as HealthStatus, message: 'Readiness check failed' };
      
      const dependencyResults = dependencies.status === 'fulfilled' ? dependencies.value : [];
      const resourceResult = resources.status === 'fulfilled' ? resources.value :
        { cpu: { usage: 0, status: 'unhealthy' as HealthStatus }, memory: { usage: 0, total: 0, percentage: 0, status: 'unhealthy' as HealthStatus } };

      // Determine overall status
      const overallStatus = this.determineOverallStatus(livenessResult, readinessResult, dependencyResults, resourceResult);
      
      const responseTime = performance.now() - startTime;
      
      const result: HealthCheckResult = {
        serviceId: config.id,
        serviceName: config.name,
        status: overallStatus,
        responseTime,
        timestamp,
        uptime: Date.now() - this.startTime,
        version: this.version,
        checks: {
          liveness: livenessResult,
          readiness: readinessResult,
          dependencies: dependencyResults,
          resources: resourceResult
        },
        metadata: {
          type: config.type,
          critical: config.critical,
          tags: config.tags,
          endpoint: `${config.protocol}://${config.host}:${config.port}${config.healthEndpoint || '/health'}`
        }
      };

      // Update circuit breaker
      if (overallStatus === 'healthy') {
        circuitBreaker.state = 'closed';
        circuitBreaker.failures = 0;
        delete circuitBreaker.lastFailure;
        delete circuitBreaker.nextRetry;
      } else if (overallStatus === 'unhealthy') {
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = timestamp;
        
        if (circuitBreaker.failures >= config.retries) {
          circuitBreaker.state = 'open';
          circuitBreaker.nextRetry = new Date(Date.now() + 30000); // 30s backoff
        }
      }

      // Store result
      this?.healthResults?.set(config.id, result);

      // Record metrics
      this.recordMetrics(result);

      // Emit events
      this.emit('health:check', result);
      
      if (this?.healthResults?.has(config.id)) {
        const previous = this?.healthResults?.get(config.id)!;
        if (previous.status !== result.status) {
          this.emit('health:status-changed', {
            serviceId: config.id,
            from: previous.status,
            to: result.status,
            result
          });
        }
      }

      // Critical service alerts
      if (config.critical && overallStatus === 'unhealthy') {
        this.emit('health:critical-failure', result);
      }

      return result;

    } catch (error) {
      circuitBreaker.failures++;
      circuitBreaker.lastFailure = timestamp;
      
      const result = this.createFailedResult(
        config, 
        error instanceof Error ? error.message : 'Unknown error',
        startTime,
        timestamp
      );
      
      this?.healthResults?.set(config.id, result);
      this.recordMetrics(result);
      this.emit('health:error', result);
      
      return result;
    }
  }

  /**
   * Check service liveness (basic connectivity)
   */
  private async checkLiveness(config: ServiceConfig): Promise<CheckResult> {
    const startTime = performance.now();
    
    try {
      const url = `${config.protocol}://${config.host}:${config.port}${config.healthEndpoint || '/health'}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const responseTime = performance.now() - startTime;
        
        if (!response.ok && !(response.status >= 200 && response.status < 300)) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return {
          name: 'liveness',
          status: 'healthy',
          responseTime,
          details: {
            statusCode: response.status,
            endpoint: url
          }
        };
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        name: 'liveness',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Connection failed',
        responseTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check service readiness (ready to accept traffic)
   */
  private async checkReadiness(config: ServiceConfig): Promise<CheckResult> {
    const startTime = performance.now();
    
    try {
      const url = `${config.protocol}://${config.host}:${config.port}/ready`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const responseTime = performance.now() - startTime;
        
        // If /ready endpoint doesn't exist, fallback to liveness
        if (response.status === 404) {
          return {
            name: 'readiness',
            status: 'healthy',
            message: 'Ready endpoint not implemented, using liveness',
            responseTime
          };
        }
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        // Check if service reports ready
        const isReady = data?.ready !== false;
        
        return {
          name: 'readiness',
          status: isReady ? 'healthy' : 'degraded',
          message: isReady ? 'Service ready' : 'Service not ready',
          responseTime,
          details: data
        };
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'readiness',
        status: 'unhealthy',
        message: 'Service not ready',
        responseTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * Check service dependencies
   */
  private async checkDependencies(config: ServiceConfig): Promise<CheckResult[]> {
    if (!config.dependencies || config?.dependencies?.length === 0) {
      return [];
    }

    const results: CheckResult[] = [];
    
    for (const dep of config.dependencies) {
      const startTime = performance.now();
      let result: CheckResult;
      
      try {
        switch (dep) {
          case 'database':
            result = await this.checkDatabase();
            break;
          case 'redis':
            result = await this.checkRedis();
            break;
          case 'ollama':
            result = await this.checkOllama();
            break;
          default:
            // Check other services
            const depService = this?.services?.get(dep);
            if (depService) {
              const depResult = this?.healthResults?.get(dep);
              result = {
                name: dep,
                status: depResult?.status || 'unhealthy',
                message: depResult ? 'Dependency service status' : 'Dependency not monitored',
                responseTime: performance.now() - startTime,
                details: depResult ? { lastCheck: depResult.timestamp } : undefined
              };
            } else {
              result = {
                name: dep,
                status: 'unhealthy',
                message: 'Unknown dependency',
                responseTime: performance.now() - startTime
              };
            }
        }
        
        results.push(result);
        
      } catch (error) {
        results.push({
          name: dep,
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Dependency check failed',
          responseTime: performance.now() - startTime
        });
      }
    }
    
    return results;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<CheckResult> {
    const startTime = performance.now();
    
    try {
      if (!this.database) {
        const dbPath = process.env.DATABASE_PATH || './data/grocery.db';
        this.database = new Database(dbPath, { readonly: true });
      }
      
      // Simple query to test connectivity
      const result = this?.database?.prepare('SELECT 1 as test').get();
      const responseTime = performance.now() - startTime;
      
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection successful',
        responseTime,
        details: { result, type: 'sqlite' }
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        name: 'database',
        status: 'unhealthy',
        message: 'Database connection failed',
        responseTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  private async checkRedis(): Promise<CheckResult> {
    const startTime = performance.now();
    
    try {
      if (!this.redisClient) {
        return {
          name: 'redis',
          status: 'degraded',
          message: 'Redis not configured',
          responseTime: performance.now() - startTime
        };
      }
      
      await this?.redisClient?.ping();
      const responseTime = performance.now() - startTime;
      
      // Get additional Redis info
      const info = await this?.redisClient?.info('server');
      
      return {
        name: 'redis',
        status: 'healthy',
        message: 'Redis connection successful',
        responseTime,
        details: {
          connected: true,
          version: info.match(/redis_version:([^\r\n]+)/)?.[1] || 'unknown'
        }
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        name: 'redis',
        status: 'unhealthy',
        message: 'Redis connection failed',
        responseTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check Ollama service
   */
  private async checkOllama(): Promise<CheckResult> {
    const startTime = performance.now();
    
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(`${ollamaUrl}/api/tags`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const responseTime = performance.now() - startTime;
        
        return {
          name: 'ollama',
          status: 'healthy',
          message: 'Ollama service available',
          responseTime,
          details: {
            models: data?.models?.length || 0,
            endpoint: ollamaUrl
          }
        };
      } finally {
        clearTimeout(timeoutId);
      }
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        name: 'ollama',
        status: 'unhealthy',
        message: 'Ollama service unavailable',
        responseTime,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Check system resources
   */
  private async checkResources(config: ServiceConfig): Promise<ResourceCheck> {
    try {
      // CPU Usage
      const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
      const cpuStatus: HealthStatus = 
        cpuUsage > this.CPU_THRESHOLD_CRITICAL ? 'unhealthy' :
        cpuUsage > this.CPU_THRESHOLD_WARNING ? 'degraded' : 'healthy';

      // Memory Usage
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercentage = (usedMem / totalMem) * 100;
      const memStatus: HealthStatus = 
        memPercentage > this.MEMORY_THRESHOLD_CRITICAL ? 'unhealthy' :
        memPercentage > this.MEMORY_THRESHOLD_WARNING ? 'degraded' : 'healthy';

      const resourceCheck: ResourceCheck = {
        cpu: {
          usage: Number(cpuUsage.toFixed(2)),
          status: cpuStatus
        },
        memory: {
          usage: usedMem,
          total: totalMem,
          percentage: Number(memPercentage.toFixed(2)),
          status: memStatus
        }
      };

      // Additional checks for specific service types
      if (config.type === 'api' || config.type === 'websocket') {
        // Check active connections (mock data for now)
        const maxConnections = 1000;
        const activeConnections = Math.floor(Math.random() * 100);
        const connPercentage = (activeConnections / maxConnections) * 100;
        
        resourceCheck.connections = {
          active: activeConnections,
          max: maxConnections,
          percentage: Number(connPercentage.toFixed(2)),
          status: connPercentage > 80 ? 'degraded' : 'healthy'
        };
      }

      return resourceCheck;
      
    } catch (error) {
      return {
        cpu: { usage: 0, status: 'unhealthy' },
        memory: { usage: 0, total: 0, percentage: 0, status: 'unhealthy' }
      };
    }
  }

  /**
   * Determine overall service status
   */
  private determineOverallStatus(
    liveness: CheckResult,
    readiness: CheckResult,
    dependencies: CheckResult[],
    resources: ResourceCheck
  ): HealthStatus {
    // Critical checks
    if (liveness.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Check for any unhealthy dependencies
    const hasUnhealthyDeps = dependencies.some(dep => dep.status === 'unhealthy');
    if (hasUnhealthyDeps) {
      return 'unhealthy';
    }

    // Check resources
    if (resources?.cpu?.status === 'unhealthy' || resources?.memory?.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Check for degraded state
    const hasDegradedStates = [
      readiness.status === 'degraded',
      resources?.cpu?.status === 'degraded',
      resources?.memory?.status === 'degraded',
      dependencies.some(dep => dep.status === 'degraded')
    ].some(Boolean);

    if (hasDegradedStates) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Create failed result
   */
  private createFailedResult(
    config: ServiceConfig,
    error: string,
    startTime: number,
    timestamp: Date
  ): HealthCheckResult {
    const responseTime = performance.now() - startTime;
    
    return {
      serviceId: config.id,
      serviceName: config.name,
      status: 'unhealthy',
      responseTime,
      timestamp,
      error,
      checks: {
        liveness: {
          name: 'liveness',
          status: 'unhealthy',
          message: error
        },
        readiness: {
          name: 'readiness',
          status: 'unhealthy',
          message: 'Service not ready due to liveness failure'
        },
        dependencies: [],
        resources: {
          cpu: { usage: 0, status: 'unhealthy' },
          memory: { usage: 0, total: 0, percentage: 0, status: 'unhealthy' }
        }
      },
      metadata: {
        type: config.type,
        critical: config.critical,
        circuitBreakerState: this?.circuitBreakers?.get(config.id)?.state
      }
    };
  }

  /**
   * Get health status for a specific service
   */
  public getServiceHealth(serviceId: string): HealthCheckResult | null {
    return this?.healthResults?.get(serviceId) || null;
  }

  /**
   * Get aggregated health status for all services
   */
  public getAggregatedHealth(): AggregatedHealth {
    const services = Array.from(this?.healthResults?.values());
    const healthyCount = services?.filter(s => s.status === 'healthy').length;
    const degradedCount = services?.filter(s => s.status === 'degraded').length;
    const unhealthyCount = services?.filter(s => s.status === 'unhealthy').length;
    
    const criticalDown = services
      .filter(s => s.status === 'unhealthy')
      .map(s => s.serviceId)
      .filter(id => this?.services?.get(id)?.critical);

    // Determine overall status
    let overall: HealthStatus = 'healthy';
    if (criticalDown?.length || 0 > 0) {
      overall = 'unhealthy';
    } else if (unhealthyCount > 0 || degradedCount > 0) {
      overall = degradedCount > unhealthyCount ? 'degraded' : 'unhealthy';
    }

    return {
      overall,
      services,
      summary: {
        total: services?.length || 0,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        critical_down: criticalDown
      },
      lastCheck: new Date(),
      uptime: Date.now() - this.startTime,
      version: this.version,
      environment: this.environment
    };
  }

  /**
   * Get circuit breaker states
   */
  public getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
    return new Map(this.circuitBreakers);
  }

  /**
   * Generate Prometheus-compatible metrics
   */
  public getPrometheusMetrics(): PrometheusMetrics {
    const metrics: PrometheusMetrics = {};
    
    // Service health metrics
    this?.healthResults?.forEach((result, serviceId) => {
      const labels = { 
        service: serviceId, 
        type: this?.services?.get(serviceId)?.type || 'unknown' 
      };
      
      metrics[`health_status`] = {
        value: result.status === 'healthy' ? 1 : result.status === 'degraded' ? 0.5 : 0,
        labels,
        help: 'Service health status (1=healthy, 0.5=degraded, 0=unhealthy)',
        type: 'gauge'
      };
      
      metrics[`health_response_time_ms`] = {
        value: result.responseTime,
        labels,
        help: 'Health check response time in milliseconds',
        type: 'histogram'
      };
      
      metrics[`health_uptime_seconds`] = {
        value: (result.uptime || 0) / 1000,
        labels,
        help: 'Service uptime in seconds',
        type: 'gauge'
      };
    });

    // Circuit breaker metrics
    this?.circuitBreakers?.forEach((state, serviceId) => {
      metrics[`circuit_breaker_state`] = {
        value: state.state === 'closed' ? 0 : state.state === 'half-open' ? 1 : 2,
        labels: { service: serviceId },
        help: 'Circuit breaker state (0=closed, 1=half-open, 2=open)',
        type: 'gauge'
      };
      
      metrics[`circuit_breaker_failures`] = {
        value: state.failures,
        labels: { service: serviceId },
        help: 'Circuit breaker failure count',
        type: 'counter'
      };
    });

    // Overall system metrics
    const aggregated = this.getAggregatedHealth();
    metrics[`system_health_status`] = {
      value: aggregated.overall === 'healthy' ? 1 : aggregated.overall === 'degraded' ? 0.5 : 0,
      help: 'Overall system health status',
      type: 'gauge'
    };
    
    metrics[`services_total`] = {
      value: aggregated?.summary?.total,
      help: 'Total number of monitored services',
      type: 'gauge'
    };

    return metrics;
  }

  /**
   * Record metrics for a health check result
   */
  private recordMetrics(result: HealthCheckResult): void {
    try {
      const labels = {
        service: result.serviceId,
        status: result.status,
        type: this?.services?.get(result.serviceId)?.type || 'unknown'
      };

      metricsCollector.histogram('health_check_duration_ms', result.responseTime, labels);
      metricsCollector.gauge(`health_check_status`, result.status === 'healthy' ? 1 : 0, labels);
      metricsCollector.increment('health_check_total', labels);
      
      // Resource metrics
      if (result?.checks?.resources.cpu) {
        metricsCollector.gauge('health_cpu_usage_percent', result?.checks?.resources.cpu.usage, labels);
      }
      if (result?.checks?.resources.memory) {
        metricsCollector.gauge('health_memory_usage_percent', result?.checks?.resources.memory.percentage, labels);
      }
      
    } catch (error) {
      logger.error('Failed to record health check metrics', 'HEALTH_CHECK', { error });
    }
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      logger.info('Shutting down health check service', 'HEALTH_CHECK');
      
      this.stopAllHealthChecks();
      
      // Close dependencies
      try {
        if (this.database) {
          this?.database?.close();
        }
        if (this.redisClient) {
          await this?.redisClient?.quit();
        }
      } catch (error) {
        logger.error('Error during health check shutdown', 'HEALTH_CHECK', { error });
      }
      
      this.removeAllListeners();
      this.emit('service:shutdown');
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    process.once('SIGUSR2', shutdown); // nodemon restart
  }

  /**
   * Manual health check for a specific service
   */
  public async checkServiceNow(serviceId: string): Promise<HealthCheckResult | null> {
    const config = this?.services?.get(serviceId);
    if (!config) {
      return null;
    }
    
    return this.performHealthCheck(config);
  }

  /**
   * Batch health check for multiple services
   */
  public async checkServicesNow(serviceIds: string[]): Promise<HealthCheckResult[]> {
    const promises = serviceIds?.map(id => this.checkServiceNow(id));
    const results = await Promise.allSettled(promises);
    
    return results
      .filter((result: any): result is PromiseFulfilledResult<HealthCheckResult> => 
        result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
  }

  /**
   * Get service configurations
   */
  public getServiceConfigurations(): ServiceConfig[] {
    return Array.from(this?.services?.values());
  }

  /**
   * Update service configuration
   */
  public updateServiceConfig(serviceId: string, updates: Partial<ServiceConfig>): void {
    const current = this?.services?.get(serviceId);
    if (current) {
      const updated = { ...current, ...updates };
      this?.services?.set(serviceId, updated);
      
      // Restart health check with new config
      this.stopHealthCheck(serviceId);
      this.startServiceHealthCheck(updated);
      
      logger.info('Service configuration updated', 'HEALTH_CHECK', {
        serviceId,
        updates
      });
    }
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();

// Auto-start health monitoring
process.nextTick(() => {
  healthCheckService.startHealthMonitoring();
});