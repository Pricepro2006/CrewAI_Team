/**
 * Comprehensive Health Checker for Microservices
 * 
 * Features:
 * - HTTP/HTTPS/WebSocket health checks
 * - Custom health check endpoints
 * - Configurable intervals and timeouts
 * - Circuit breaker integration
 * - Health metrics collection
 * - Batch health checking
 * - Recovery detection
 */

import axios, { AxiosError } from 'axios';
import WebSocket from 'ws';
import { ServiceMetadata, serviceRegistry } from './ServiceRegistry.js';
import { CircuitBreakerFactory } from '../../core/resilience/CircuitBreaker.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { EventEmitter } from 'events';

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  expectedStatus?: number | number[];
  expectedBody?: string | RegExp;
  headers?: Record<string, string>;
  method: 'GET' | 'POST' | 'HEAD';
  body?: string;
  followRedirects?: boolean;
}

export interface HealthCheckResult {
  serviceId: string;
  serviceName: string;
  healthy: boolean;
  responseTime: number;
  status?: number;
  error?: string;
  timestamp: Date;
  consecutive_failures: number;
  consecutive_successes: number;
}

export interface HealthMetrics {
  serviceId: string;
  total_checks: number;
  successful_checks: number;
  failed_checks: number;
  avg_response_time: number;
  uptime_percentage: number;
  last_check: Date;
  last_success: Date;
  last_failure?: Date;
}

export class HealthChecker extends EventEmitter {
  private static instance: HealthChecker | null = null;
  private healthCheckIntervals = new Map<string, NodeJS.Timeout>();
  private healthHistory = new Map<string, HealthCheckResult[]>();
  private healthMetrics = new Map<string, HealthMetrics>();
  private consecutiveFailures = new Map<string, number>();
  private consecutiveSuccesses = new Map<string, number>();
  private readonly MAX_HISTORY_LENGTH = 100;
  private readonly DEFAULT_CONFIG: HealthCheckConfig = {
    interval: 30000, // 30 seconds
    timeout: 5000, // 5 seconds
    retries: 3,
    expectedStatus: [200, 204],
    method: 'GET',
    followRedirects: true,
  };

  private constructor() {
    super();
    this.setupServiceRegistryListeners();
  }

  public static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  /**
   * Start health checking for a service
   */
  async startHealthCheck(
    service: ServiceMetadata,
    config?: Partial<HealthCheckConfig>
  ): Promise<boolean> {
    try {
      const finalConfig: HealthCheckConfig = { ...this.DEFAULT_CONFIG, ...config };
      
      // Stop existing health check if any
      await this.stopHealthCheck(service.id);

      // Initialize metrics
      this.initializeMetrics(service.id);

      // Determine health check URL
      const healthUrl = this.getHealthCheckUrl(service);
      if (!healthUrl) {
        logger.warn('No health check endpoint available for service', 'HEALTH_CHECKER', {
          serviceId: service.id,
          serviceName: service.name,
        });
        return false;
      }

      // Start periodic health checks
      const interval = setInterval(async () => {
        await this.performHealthCheck(service, healthUrl, finalConfig);
      }, finalConfig.interval);

      this?.healthCheckIntervals?.set(service.id, interval);

      // Perform initial health check
      await this.performHealthCheck(service, healthUrl, finalConfig);

      logger.info('Health checking started', 'HEALTH_CHECKER', {
        serviceId: service.id,
        serviceName: service.name,
        healthUrl,
        interval: finalConfig.interval,
      });

      return true;
    } catch (error) {
      logger.error('Failed to start health check', 'HEALTH_CHECKER', {
        serviceId: service.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Stop health checking for a service
   */
  async stopHealthCheck(serviceId: string): Promise<void> {
    const interval = this?.healthCheckIntervals?.get(serviceId);
    if (interval) {
      clearInterval(interval);
      this?.healthCheckIntervals?.delete(serviceId);
      
      logger.info('Health checking stopped', 'HEALTH_CHECKER', { serviceId });
    }
  }

  /**
   * Perform a single health check
   */
  async performHealthCheck(
    service: ServiceMetadata,
    healthUrl: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < config.retries) {
      attempt++;
      
      try {
        const result = await this.executeHealthCheck(service, healthUrl, config);
        
        if (result.healthy) {
          await this.handleHealthSuccess(service.id, result);
          return result;
        } else {
          lastError = result.error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      // Wait between retries
      if (attempt < config.retries) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // All retries failed
    const failureResult: HealthCheckResult = {
      serviceId: service.id,
      serviceName: service.name,
      healthy: false,
      responseTime: Date.now() - startTime,
      error: lastError || 'Health check failed after all retries',
      timestamp: new Date(),
      consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
      consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
    };

    await this.handleHealthFailure(service.id, failureResult);
    return failureResult;
  }

  /**
   * Execute the actual health check request
   */
  private async executeHealthCheck(
    service: ServiceMetadata,
    healthUrl: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      if (service.protocol === 'ws' || service.protocol === 'wss') {
        return await this.performWebSocketHealthCheck(service, healthUrl, config);
      } else {
        return await this.performHttpHealthCheck(service, healthUrl, config);
      }
    } catch (error) {
      return {
        serviceId: service.id,
        serviceName: service.name,
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
        consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
      };
    }
  }

  /**
   * Perform HTTP/HTTPS health check
   */
  private async performHttpHealthCheck(
    service: ServiceMetadata,
    healthUrl: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    try {
      const response = await axios({
        url: healthUrl,
        method: config.method,
        timeout: config.timeout,
        headers: config.headers,
        data: config.body,
        maxRedirects: config.followRedirects ? 5 : 0,
        validateStatus: () => true, // Don't throw on any status
      });

      const responseTime = Date.now() - startTime;
      const expectedStatuses = Array.isArray(config.expectedStatus) 
        ? config.expectedStatus 
        : [config.expectedStatus!];

      const isStatusValid = expectedStatuses.includes(response.status);
      const isBodyValid = config.expectedBody 
        ? this.validateResponseBody(response.data, config.expectedBody)
        : true;

      const healthy = isStatusValid && isBodyValid;

      return {
        serviceId: service.id,
        serviceName: service.name,
        healthy,
        responseTime,
        status: response.status,
        timestamp: new Date(),
        consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
        consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
        error: healthy ? undefined : `Status: ${response.status}, Body validation failed: ${!isBodyValid}`,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      let errorMessage = 'Unknown error';
      let status: number | undefined;

      if (error instanceof AxiosError) {
        errorMessage = error.message;
        status = error.response?.status;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      return {
        serviceId: service.id,
        serviceName: service.name,
        healthy: false,
        responseTime,
        status,
        error: errorMessage,
        timestamp: new Date(),
        consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
        consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
      };
    }
  }

  /**
   * Perform WebSocket health check
   */
  private async performWebSocketHealthCheck(
    service: ServiceMetadata,
    healthUrl: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();

    return new Promise((resolve: any) => {
      const ws = new WebSocket(healthUrl);
      let isResolved = false;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          ws.terminate();
          resolve({
            serviceId: service.id,
            serviceName: service.name,
            healthy: false,
            responseTime: Date.now() - startTime,
            error: 'WebSocket health check timeout',
            timestamp: new Date(),
            consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
            consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
          });
        }
      }, config.timeout);

      ws.on('open', () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          ws.close();
          resolve({
            serviceId: service.id,
            serviceName: service.name,
            healthy: true,
            responseTime: Date.now() - startTime,
            timestamp: new Date(),
            consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
            consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
          });
        }
      });

      ws.on('error', (error: any) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve({
            serviceId: service.id,
            serviceName: service.name,
            healthy: false,
            responseTime: Date.now() - startTime,
            error: error.message,
            timestamp: new Date(),
            consecutive_failures: this?.consecutiveFailures?.get(service.id) || 0,
            consecutive_successes: this?.consecutiveSuccesses?.get(service.id) || 0,
          });
        }
      });
    });
  }

  /**
   * Validate response body against expected pattern
   */
  private validateResponseBody(responseData: any, expected: string | RegExp): boolean {
    const responseStr = typeof responseData === 'string' ? responseData : JSON.stringify(responseData);
    
    if (typeof expected === 'string') {
      return responseStr.includes(expected);
    } else {
      return expected.test(responseStr);
    }
  }

  /**
   * Handle successful health check
   */
  private async handleHealthSuccess(serviceId: string, result: HealthCheckResult): Promise<void> {
    // Update consecutive counters
    this?.consecutiveFailures?.set(serviceId, 0);
    const successes = this?.consecutiveSuccesses?.get(serviceId) || 0;
    this?.consecutiveSuccesses?.set(serviceId, successes + 1);

    // Update metrics
    this.updateMetrics(serviceId, result, true);

    // Store in history
    this.addToHistory(serviceId, result);

    // Update service registry health status
    await serviceRegistry.updateHealthStatus(serviceId, 'healthy');

    // Emit success event
    this.emit('health:success', result);

    // Record metrics
    metrics.increment('health_checker.success', {
      service_id: serviceId,
      service_name: result.serviceName,
    });
    metrics.histogram('health_checker.response_time', result.responseTime, {
      service_id: serviceId,
    });
  }

  /**
   * Handle failed health check
   */
  private async handleHealthFailure(serviceId: string, result: HealthCheckResult): Promise<void> {
    // Update consecutive counters
    this?.consecutiveSuccesses?.set(serviceId, 0);
    const failures = this?.consecutiveFailures?.get(serviceId) || 0;
    this?.consecutiveFailures?.set(serviceId, failures + 1);

    // Update metrics
    this.updateMetrics(serviceId, result, false);

    // Store in history
    this.addToHistory(serviceId, result);

    // Update service registry health status
    await serviceRegistry.updateHealthStatus(serviceId, 'unhealthy');

    // Emit failure event
    this.emit('health:failure', result);

    // Record metrics
    metrics.increment('health_checker.failure', {
      service_id: serviceId,
      service_name: result.serviceName,
    });
    metrics.histogram('health_checker.response_time', result.responseTime, {
      service_id: serviceId,
    });

    logger.warn('Service health check failed', 'HEALTH_CHECKER', {
      serviceId,
      serviceName: result.serviceName,
      consecutiveFailures: failures + 1,
      error: result.error,
    });
  }

  /**
   * Get health check URL for a service
   */
  private getHealthCheckUrl(service: ServiceMetadata): string | null {
    if (service.health_endpoint) {
      return `${service.protocol}://${service.host}:${service.port}${service.health_endpoint}`;
    }

    // Default health endpoints to try
    const defaultEndpoints = ['/health', '/healthz', '/ping', '/status'];
    
    // Return the first default endpoint
    return `${service.protocol}://${service.host}:${service.port}${defaultEndpoints[0]}`;
  }

  /**
   * Initialize metrics for a service
   */
  private initializeMetrics(serviceId: string): void {
    if (!this?.healthMetrics?.has(serviceId)) {
      this?.healthMetrics?.set(serviceId, {
        serviceId,
        total_checks: 0,
        successful_checks: 0,
        failed_checks: 0,
        avg_response_time: 0,
        uptime_percentage: 0,
        last_check: new Date(),
        last_success: new Date(),
      });
    }
  }

  /**
   * Update health metrics
   */
  private updateMetrics(serviceId: string, result: HealthCheckResult, success: boolean): void {
    const metrics = this?.healthMetrics?.get(serviceId);
    if (!metrics) return;

    metrics.total_checks++;
    metrics.last_check = result.timestamp;

    if (success) {
      metrics.successful_checks++;
      metrics.last_success = result.timestamp;
    } else {
      metrics.failed_checks++;
      metrics.last_failure = result.timestamp;
    }

    // Update average response time
    const totalResponseTime = (metrics.avg_response_time * (metrics.total_checks - 1)) + result.responseTime;
    metrics.avg_response_time = totalResponseTime / metrics.total_checks;

    // Update uptime percentage
    metrics.uptime_percentage = (metrics.successful_checks / metrics.total_checks) * 100;

    this?.healthMetrics?.set(serviceId, metrics);
  }

  /**
   * Add result to history
   */
  private addToHistory(serviceId: string, result: HealthCheckResult): void {
    const history = this?.healthHistory?.get(serviceId) || [];
    history.push(result);

    if (history?.length || 0 > this.MAX_HISTORY_LENGTH) {
      history.shift();
    }

    this?.healthHistory?.set(serviceId, history);
  }

  /**
   * Get health status for a service
   */
  getHealthStatus(serviceId: string): {
    current: 'healthy' | 'unhealthy' | 'unknown';
    metrics: HealthMetrics | null;
    recent_results: HealthCheckResult[];
  } {
    const metrics = this?.healthMetrics?.get(serviceId) || null;
    const history = this?.healthHistory?.get(serviceId) || [];
    const recentResults = history.slice(-10); // Last 10 results

    let current: 'healthy' | 'unhealthy' | 'unknown' = 'unknown';
    
    if (recentResults?.length || 0 > 0) {
      const latestResult = recentResults[recentResults?.length || 0 - 1];
      current = latestResult.healthy ? 'healthy' : 'unhealthy';
    }

    return {
      current,
      metrics,
      recent_results: recentResults,
    };
  }

  /**
   * Get overall health statistics
   */
  getOverallStats(): {
    total_services: number;
    healthy_services: number;
    unhealthy_services: number;
    unknown_services: number;
    avg_response_time: number;
    overall_uptime: number;
  } {
    const allMetrics = Array.from(this?.healthMetrics?.values());
    
    if (allMetrics?.length || 0 === 0) {
      return {
        total_services: 0,
        healthy_services: 0,
        unhealthy_services: 0,
        unknown_services: 0,
        avg_response_time: 0,
        overall_uptime: 0,
      };
    }

    const healthy = allMetrics?.filter(m => {
      const recentResults = this?.healthHistory?.get(m.serviceId)?.slice(-3) || [];
      return recentResults?.length || 0 > 0 && recentResults[recentResults?.length || 0 - 1].healthy;
    });

    const unhealthy = allMetrics?.filter(m => {
      const recentResults = this?.healthHistory?.get(m.serviceId)?.slice(-3) || [];
      return recentResults?.length || 0 > 0 && !recentResults[recentResults?.length || 0 - 1].healthy;
    });

    const avgResponseTime = allMetrics.reduce((sum: any, m: any) => sum + m.avg_response_time, 0) / allMetrics?.length || 0;
    const overallUptime = allMetrics.reduce((sum: any, m: any) => sum + m.uptime_percentage, 0) / allMetrics?.length || 0;

    return {
      total_services: allMetrics?.length || 0,
      healthy_services: healthy?.length || 0,
      unhealthy_services: unhealthy?.length || 0,
      unknown_services: allMetrics?.length || 0 - healthy?.length || 0 - unhealthy?.length || 0,
      avg_response_time: avgResponseTime,
      overall_uptime: overallUptime,
    };
  }

  /**
   * Setup service registry event listeners
   */
  private setupServiceRegistryListeners(): void {
    serviceRegistry.on('service:registered', async (service: any) => {
      await this.startHealthCheck(service);
    });

    serviceRegistry.on('service:deregistered', async (serviceId: any) => {
      await this.stopHealthCheck(serviceId);
      this?.healthHistory?.delete(serviceId);
      this?.healthMetrics?.delete(serviceId);
      this?.consecutiveFailures?.delete(serviceId);
      this?.consecutiveSuccesses?.delete(serviceId);
    });
  }

  /**
   * Batch health check for multiple services
   */
  async performBatchHealthCheck(serviceIds: string[]): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    const promises = serviceIds?.map(async (serviceId: any) => {
      const service = await serviceRegistry.get(serviceId);
      if (service) {
        const healthUrl = this.getHealthCheckUrl(service);
        if (healthUrl) {
          return await this.performHealthCheck(service, healthUrl, this.DEFAULT_CONFIG);
        }
      }
      return null;
    });

    const batchResults = await Promise.allSettled(promises);
    
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      } else {
        logger.warn('Batch health check failed for service', 'HEALTH_CHECKER', {
          serviceId: serviceIds[index],
          error: result.status === 'rejected' ? result.reason : 'Service not found',
        });
      }
    });

    return results;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    // Stop all health checks
    for (const [serviceId] of this.healthCheckIntervals) {
      await this.stopHealthCheck(serviceId);
    }

    this.removeAllListeners();
    this?.healthHistory?.clear();
    this?.healthMetrics?.clear();
    this?.consecutiveFailures?.clear();
    this?.consecutiveSuccesses?.clear();

    HealthChecker.instance = null;
    logger.info('Health checker shutdown complete', 'HEALTH_CHECKER');
  }
}

// Export singleton
export const healthChecker = HealthChecker.getInstance();