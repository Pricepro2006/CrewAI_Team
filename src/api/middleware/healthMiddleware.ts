/**
 * Health Check Middleware for Walmart Grocery Agent API
 * 
 * Provides middleware functions for health monitoring endpoints
 * Integrates with the comprehensive HealthCheckService
 */

import type { Request, Response, NextFunction } from 'express';
import { healthCheckService } from '../../monitoring/HealthCheckService.js';
import type { HealthStatus } from '../../monitoring/HealthCheckService.js';
import { logger } from '../../utils/logger.js';
import { performance } from 'perf_hooks';

// Extend Request type to include health context
declare global {
  namespace Express {
    interface Request {
      healthContext?: {
        startTime: number;
        serviceId?: string;
        checkType?: 'liveness' | 'readiness' | 'aggregate';
      };
    }
  }
}

/**
 * Middleware to add health context to requests
 */
export function healthContext(serviceId: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    req.healthContext = {
      startTime: performance.now(),
      serviceId,
      checkType: 'liveness'
    };
    next();
  };
}

/**
 * Basic liveness probe - service is running
 */
export function livenessProbe(serviceId: string) {
  return async (req: Request, res: Response) => {
    try {
      const startTime = performance.now();
      
      // Basic liveness check - service process is alive
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const responseTime = performance.now() - startTime;

      const response = {
        status: 'healthy' as HealthStatus,
        service: serviceId,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        version: process.env.npm_package_version || '1.0.0',
        responseTime: Math.round(responseTime),
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024)
        },
        pid: process.pid,
        nodeVersion: process.version
      };

      res.status(200).json(response);
      
      logger.debug('Liveness probe completed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        responseTime,
        uptime
      });

    } catch (error) {
      logger.error('Liveness probe failed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        status: 'unhealthy',
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Liveness probe failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Readiness probe - service is ready to accept traffic
 */
export function readinessProbe(serviceId: string, readinessChecks?: (() => Promise<boolean>)[]) {
  return async (req: Request, res: Response) => {
    try {
      const startTime = performance.now();
      let ready = true;
      const checkResults: Array<{ check: string; ready: boolean; error?: string }> = [];

      // Run custom readiness checks
      if (readinessChecks && readinessChecks.length > 0) {
        for (let i = 0; i < readinessChecks.length; i++) {
          try {
            const checkFn = readinessChecks[i];
            if (!checkFn) {
              checkResults.push({
                check: `readiness_check_${i + 1}`,
                ready: false,
                error: 'Check function is undefined'
              });
              ready = false;
              continue;
            }
            const checkReady = await checkFn();
            checkResults.push({
              check: `readiness_check_${i + 1}`,
              ready: checkReady
            });
            ready = ready && checkReady;
          } catch (error) {
            checkResults.push({
              check: `readiness_check_${i + 1}`,
              ready: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            ready = false;
          }
        }
      }

      // Get comprehensive health check from service
      const healthResult = healthCheckService.getServiceHealth(serviceId);
      if (healthResult) {
        ready = ready && (healthResult.status === 'healthy' || healthResult.status === 'degraded');
      }

      const responseTime = performance.now() - startTime;
      const status = ready ? 'healthy' : 'unhealthy';
      const httpStatus = ready ? 200 : 503;

      const response = {
        status,
        ready,
        service: serviceId,
        timestamp: new Date().toISOString(),
        responseTime: Math.round(responseTime),
        checks: checkResults,
        healthCheck: healthResult ? {
          status: healthResult.status,
          lastCheck: healthResult.timestamp,
          dependencies: healthResult.checks.dependencies.map(dep => ({
            name: dep.name,
            status: dep.status
          }))
        } : null
      };

      res.status(httpStatus).json(response);

      logger.debug('Readiness probe completed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        ready,
        responseTime,
        checksPerformed: checkResults.length
      });

    } catch (error) {
      logger.error('Readiness probe failed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        status: 'unhealthy',
        ready: false,
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Readiness probe failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Comprehensive health endpoint with dependency checks
 */
export function healthEndpoint(serviceId: string) {
  return async (req: Request, res: Response) => {
    try {
      const startTime = performance.now();

      // Get or trigger comprehensive health check
      let healthResult = healthCheckService.getServiceHealth(serviceId);
      
      if (!healthResult) {
        // Trigger health check if not available
        healthResult = await healthCheckService.checkServiceNow(serviceId);
      }

      if (!healthResult) {
        throw new Error('Health check not available for service');
      }

      const responseTime = performance.now() - startTime;
      
      // Determine HTTP status code
      const httpStatus = 
        healthResult.status === 'healthy' ? 200 :
        healthResult.status === 'degraded' ? 200 :
        503;

      const response = {
        status: healthResult.status,
        service: healthResult.serviceName,
        serviceId: healthResult.serviceId,
        timestamp: healthResult.timestamp.toISOString(),
        uptime: healthResult.uptime,
        version: healthResult.version,
        responseTime: Math.round(responseTime),
        checks: {
          liveness: {
            status: healthResult.checks.liveness.status,
            responseTime: healthResult.checks.liveness.responseTime
          },
          readiness: {
            status: healthResult.checks.readiness.status,
            message: healthResult.checks.readiness.message
          },
          dependencies: healthResult.checks.dependencies.map(dep => ({
            name: dep.name,
            status: dep.status,
            message: dep.message,
            responseTime: dep.responseTime
          })),
          resources: {
            cpu: {
              usage: healthResult.checks.resources.cpu.usage,
              status: healthResult.checks.resources.cpu.status
            },
            memory: {
              usage: Math.round((healthResult.checks.resources.memory.usage || 0) / 1024 / 1024),
              total: Math.round((healthResult.checks.resources.memory.total || 0) / 1024 / 1024),
              percentage: healthResult.checks.resources.memory.percentage,
              status: healthResult.checks.resources.memory.status
            },
            connections: healthResult.checks.resources.connections ? {
              active: healthResult.checks.resources.connections.active,
              max: healthResult.checks.resources.connections.max,
              percentage: healthResult.checks.resources.connections.percentage,
              status: healthResult.checks.resources.connections.status
            } : undefined
          }
        },
        metadata: healthResult.metadata,
        error: healthResult.error
      };

      res.status(httpStatus).json(response);

      logger.debug('Health endpoint completed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        status: healthResult.status,
        responseTime: Math.round(responseTime)
      });

    } catch (error) {
      logger.error('Health endpoint failed', 'HEALTH_MIDDLEWARE', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'unhealthy',
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Health endpoint error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Aggregated health endpoint for API gateway
 */
export function aggregatedHealthEndpoint() {
  return async (req: Request, res: Response) => {
    try {
      const startTime = performance.now();
      
      const aggregatedHealth = healthCheckService.getAggregatedHealth();
      const responseTime = performance.now() - startTime;

      // Determine HTTP status
      const httpStatus =
        aggregatedHealth.overall === 'healthy' ? 200 :
        aggregatedHealth.overall === 'degraded' ? 200 :
        aggregatedHealth.summary.critical_down.length > 0 ? 503 :
        200; // Non-critical services down

      const response = {
        status: aggregatedHealth.overall,
        timestamp: aggregatedHealth.lastCheck.toISOString(),
        uptime: Math.floor(aggregatedHealth.uptime / 1000),
        version: aggregatedHealth.version,
        environment: aggregatedHealth.environment,
        responseTime: Math.round(responseTime),
        summary: aggregatedHealth.summary,
        services: aggregatedHealth.services.map(service => ({
          id: service.serviceId,
          name: service.serviceName,
          status: service.status,
          responseTime: service.responseTime,
          lastCheck: service.timestamp.toISOString(),
          type: service.metadata?.type,
          critical: service.metadata?.critical,
          tags: service.metadata?.tags
        })),
        criticalServices: aggregatedHealth.summary.critical_down,
        healthyServices: aggregatedHealth.summary.healthy,
        degradedServices: aggregatedHealth.summary.degraded,
        unhealthyServices: aggregatedHealth.summary.unhealthy,
        totalServices: aggregatedHealth.summary.total
      };

      res.status(httpStatus).json(response);

      logger.debug('Aggregated health endpoint completed', 'HEALTH_MIDDLEWARE', {
        overallStatus: aggregatedHealth.overall,
        totalServices: aggregatedHealth.summary.total,
        criticalDown: aggregatedHealth.summary.critical_down.length,
        responseTime: Math.round(responseTime)
      });

    } catch (error) {
      logger.error('Aggregated health endpoint failed', 'HEALTH_MIDDLEWARE', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Aggregated health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Prometheus metrics endpoint
 */
export function metricsEndpoint() {
  return async (req: Request, res: Response) => {
    try {
      const metrics = healthCheckService.getPrometheusMetrics();
      
      // Convert to Prometheus format
      let prometheusText = '';
      
      Object.entries(metrics).forEach(([name, metric]) => {
        if (metric.help) {
          prometheusText += `# HELP ${name} ${metric.help}\n`;
        }
        if (metric.type) {
          prometheusText += `# TYPE ${name} ${metric.type}\n`;
        }
        
        const labels = metric.labels 
          ? Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')
          : '';
        
        prometheusText += `${name}${labels ? `{${labels}}` : ''} ${metric.value}\n`;
      });

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusText);

      logger.debug('Metrics endpoint completed', 'HEALTH_MIDDLEWARE', {
        metricsCount: Object.keys(metrics).length
      });

    } catch (error) {
      logger.error('Metrics endpoint failed', 'HEALTH_MIDDLEWARE', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).send('# Metrics collection failed\n');
    }
  };
}

/**
 * Circuit breaker status endpoint
 */
export function circuitBreakerEndpoint() {
  return (req: Request, res: Response) => {
    try {
      const circuitBreakers = healthCheckService.getCircuitBreakerStates();
      
      const response = {
        timestamp: new Date().toISOString(),
        circuitBreakers: Array.from(circuitBreakers.entries()).map(([serviceId, state]) => ({
          serviceId,
          state: state.state,
          failures: state.failures,
          lastFailure: state.lastFailure?.toISOString(),
          nextRetry: state.nextRetry?.toISOString()
        }))
      };

      res.json(response);

      logger.debug('Circuit breaker endpoint completed', 'HEALTH_MIDDLEWARE', {
        breakerCount: circuitBreakers.size
      });

    } catch (error) {
      logger.error('Circuit breaker endpoint failed', 'HEALTH_MIDDLEWARE', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Circuit breaker status failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Service configuration endpoint
 */
export function serviceConfigEndpoint() {
  return (req: Request, res: Response) => {
    try {
      const configs = healthCheckService.getServiceConfigurations();
      
      const response = {
        timestamp: new Date().toISOString(),
        services: configs.map(config => ({
          id: config.id,
          name: config.name,
          type: config.type,
          endpoint: `${config.protocol}://${config.host}:${config.port}${config.healthEndpoint || '/health'}`,
          critical: config.critical,
          interval: config.interval,
          timeout: config.timeout,
          retries: config.retries,
          dependencies: config.dependencies,
          tags: config.tags
        }))
      };

      res.json(response);

      logger.debug('Service config endpoint completed', 'HEALTH_MIDDLEWARE', {
        serviceCount: configs.length
      });

    } catch (error) {
      logger.error('Service config endpoint failed', 'HEALTH_MIDDLEWARE', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Service configuration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}

/**
 * Manual health check trigger endpoint
 */
export function triggerHealthCheckEndpoint() {
  return async (req: Request, res: Response) => {
    try {
      const { serviceId, serviceIds } = req.body;
      
      let results;
      if (serviceId) {
        // Single service check
        const result = await healthCheckService.checkServiceNow(serviceId);
        results = result ? [result] : [];
      } else if (serviceIds && Array.isArray(serviceIds)) {
        // Multiple service check
        results = await healthCheckService.checkServicesNow(serviceIds);
      } else {
        // Check all services
        const configs = healthCheckService.getServiceConfigurations();
        const allServiceIds = configs.map(c => c.id);
        results = await healthCheckService.checkServicesNow(allServiceIds);
      }

      const response = {
        timestamp: new Date().toISOString(),
        message: 'Health checks triggered',
        results: results.map(result => ({
          serviceId: result.serviceId,
          serviceName: result.serviceName,
          status: result.status,
          responseTime: result.responseTime,
          timestamp: result.timestamp.toISOString()
        }))
      };

      res.json(response);

      logger.info('Manual health checks triggered', 'HEALTH_MIDDLEWARE', {
        serviceCount: results.length,
        requestedService: serviceId,
        requestedServices: serviceIds
      });

    } catch (error) {
      logger.error('Manual health check failed', 'HEALTH_MIDDLEWARE', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Manual health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}