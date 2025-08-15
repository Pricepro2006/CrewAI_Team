/**
 * Express Health Routes for Walmart Grocery Agent Microservices
 * 
 * REST API endpoints for services that don't use tRPC
 * Can be imported and used by any Express-based microservice
 */

import express from 'express';
import type { Router as RouterType } from 'express';
import {
  createHealthRouter,
  createAggregatedHealthRouter
} from '../middleware/healthMiddleware.js';
import { healthCheckService } from '../../monitoring/HealthCheckService.js';
import { logger } from '../../utils/logger.js';

const { Router } = express;

/**
 * Create standard health endpoints for a specific service
 * Usage: app.use('/health', createServiceHealthRoutes('walmart-api-server'))
 */
export function createServiceHealthRoutes(serviceId: string, serviceName?: string): RouterType {
  const router = Router();

  // Liveness probe - GET /health/live
  router.get('/live', async (req, res) => {
    try {
      const startTime = Date.now();
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;

      const response = {
        status: 'healthy',
        service: serviceId,
        serviceName: serviceName || serviceId,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        version: process.env.npm_package_version || '1.0.0',
        responseTime,
        memory: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        pid: process.pid
      };

      res.status(200).json(response);

      logger.debug('Liveness probe completed', 'HEALTH_EXPRESS', {
        serviceId,
        responseTime
      });

    } catch (error) {
      logger.error('Liveness probe failed', 'HEALTH_EXPRESS', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        status: 'unhealthy',
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Liveness probe failed'
      });
    }
  });

  // Readiness probe - GET /health/ready
  router.get('/ready', async (req, res) => {
    try {
      const startTime = Date.now();
      
      // Get comprehensive health check
      const healthResult = healthCheckService.getServiceHealth(serviceId);
      const ready = healthResult ? 
        (healthResult.status === 'healthy' || healthResult.status === 'degraded') : 
        true; // Default to ready if no health check available

      const responseTime = Date.now() - startTime;
      const httpStatus = ready ? 200 : 503;

      const response = {
        status: ready ? 'healthy' : 'unhealthy',
        ready,
        service: serviceId,
        serviceName: serviceName || serviceId,
        timestamp: new Date().toISOString(),
        responseTime,
        healthCheck: healthResult ? {
          status: healthResult.status,
          lastCheck: healthResult.timestamp.toISOString(),
          error: healthResult.error
        } : null
      };

      res.status(httpStatus).json(response);

      logger.debug('Readiness probe completed', 'HEALTH_EXPRESS', {
        serviceId,
        ready,
        responseTime
      });

    } catch (error) {
      logger.error('Readiness probe failed', 'HEALTH_EXPRESS', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        status: 'unhealthy',
        ready: false,
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Readiness probe failed'
      });
    }
  });

  // Comprehensive health check - GET /health
  router.get('/', async (req, res): Promise<void> => {
    try {
      const startTime = Date.now();

      // Get or trigger comprehensive health check
      let healthResult = healthCheckService.getServiceHealth(serviceId);
      
      if (!healthResult) {
        healthResult = await healthCheckService.checkServiceNow(serviceId);
      }

      if (!healthResult) {
        res.status(503).json({
          status: 'unhealthy',
          service: serviceId,
          timestamp: new Date().toISOString(),
          error: 'Health check not available'
        });
        return;
      }

      const responseTime = Date.now() - startTime;
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
        responseTime,
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
            message: dep.message
          })),
          resources: {
            cpu: {
              usage: healthResult.checks.resources.cpu.usage,
              status: healthResult.checks.resources.cpu.status
            },
            memory: {
              usage: Math.round((healthResult.checks.resources.memory.usage || 0) / 1024 / 1024),
              percentage: healthResult.checks.resources.memory.percentage,
              status: healthResult.checks.resources.memory.status
            }
          }
        },
        error: healthResult.error
      };

      res.status(httpStatus).json(response);

      logger.debug('Health check completed', 'HEALTH_EXPRESS', {
        serviceId,
        status: healthResult.status,
        responseTime
      });

    } catch (error) {
      logger.error('Health check failed', 'HEALTH_EXPRESS', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'unhealthy',
        service: serviceId,
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Detailed health info - GET /health/detailed
  router.get('/detailed', async (req, res): Promise<void> => {
    try {
      const healthResult = await healthCheckService.checkServiceNow(serviceId);
      
      if (!healthResult) {
        res.status(503).json({
          error: 'Health check not available',
          serviceId,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const detailedResponse = {
        ...healthResult,
        timestamp: healthResult.timestamp.toISOString(),
        checks: {
          liveness: {
            ...healthResult.checks.liveness,
            details: healthResult.checks.liveness.details
          },
          readiness: {
            ...healthResult.checks.readiness,
            details: healthResult.checks.readiness.details
          },
          dependencies: healthResult.checks.dependencies.map(dep => ({
            ...dep,
            details: dep.details
          })),
          resources: {
            cpu: healthResult.checks.resources.cpu,
            memory: {
              usage: Math.round((healthResult.checks.resources.memory.usage || 0) / 1024 / 1024),
              total: Math.round((healthResult.checks.resources.memory.total || 0) / 1024 / 1024),
              percentage: healthResult.checks.resources.memory.percentage,
              status: healthResult.checks.resources.memory.status
            },
            connections: healthResult.checks.resources.connections,
            diskSpace: healthResult.checks.resources.diskSpace
          }
        }
      };

      res.json(detailedResponse);

    } catch (error) {
      logger.error('Detailed health check failed', 'HEALTH_EXPRESS', {
        serviceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Detailed health check failed',
        serviceId,
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  return router;
}

/**
 * Create aggregated health routes for API gateway
 * Usage: app.use('/health', createAggregatedHealthRoutes())
 */
export function createAggregatedHealthRoutes(): RouterType {
  const router = Router();

  // Aggregated system health - GET /health
  router.get('/', async (req, res) => {
    try {
      const startTime = Date.now();
      const aggregatedHealth = healthCheckService.getAggregatedHealth();
      const responseTime = Date.now() - startTime;

      const httpStatus =
        aggregatedHealth.overall === 'healthy' ? 200 :
        aggregatedHealth.overall === 'degraded' ? 200 :
        aggregatedHealth.summary.critical_down.length > 0 ? 503 :
        200;

      const response = {
        status: aggregatedHealth.overall,
        timestamp: aggregatedHealth.lastCheck.toISOString(),
        uptime: Math.floor(aggregatedHealth.uptime / 1000),
        version: aggregatedHealth.version,
        environment: aggregatedHealth.environment,
        responseTime,
        summary: aggregatedHealth.summary,
        services: aggregatedHealth.services.map(service => ({
          id: service.serviceId,
          name: service.serviceName,
          status: service.status,
          responseTime: service.responseTime,
          lastCheck: service.timestamp.toISOString(),
          type: service.metadata?.type,
          critical: service.metadata?.critical
        })),
        criticalServices: aggregatedHealth.summary.critical_down
      };

      res.status(httpStatus).json(response);

    } catch (error) {
      logger.error('Aggregated health check failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Aggregated health check failed'
      });
    }
  });

  // Individual services status - GET /health/services
  router.get('/services', async (req, res) => {
    try {
      const services = healthCheckService.getServiceConfigurations();
      const healthResults = services.map(service => 
        healthCheckService.getServiceHealth(service.id)
      );

      const response = {
        timestamp: new Date().toISOString(),
        services: services.map((service, index) => ({
          id: service.id,
          name: service.name,
          type: service.type,
          critical: service.critical,
          endpoint: `${service.protocol}://${service.host}:${service.port}${service.healthEndpoint || '/health'}`,
          health: healthResults[index] ? {
            status: healthResults[index]!.status,
            responseTime: healthResults[index]!.responseTime,
            lastCheck: healthResults[index]!.timestamp.toISOString(),
            uptime: healthResults[index]!.uptime,
            error: healthResults[index]!.error
          } : null
        }))
      };

      res.json(response);

    } catch (error) {
      logger.error('Services health check failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Services health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Prometheus metrics - GET /health/metrics
  router.get('/metrics', (req, res) => {
    try {
      const metrics = healthCheckService.getPrometheusMetrics();
      
      // Convert to Prometheus text format
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

    } catch (error) {
      logger.error('Metrics endpoint failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).send('# Metrics collection failed\n');
    }
  });

  // Circuit breaker status - GET /health/circuit-breakers
  router.get('/circuit-breakers', (req, res) => {
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

    } catch (error) {
      logger.error('Circuit breaker endpoint failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Circuit breaker status failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Trigger manual health checks - POST /health/check
  router.post('/check', async (req, res) => {
    try {
      const { serviceId, serviceIds } = req.body;
      
      let results;
      if (serviceId) {
        const result = await healthCheckService.checkServiceNow(serviceId);
        results = result ? [result] : [];
      } else if (serviceIds && Array.isArray(serviceIds)) {
        results = await healthCheckService.checkServicesNow(serviceIds);
      } else {
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
          timestamp: result.timestamp.toISOString(),
          error: result.error
        }))
      };

      res.json(response);

    } catch (error) {
      logger.error('Manual health check failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Manual health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Service dependencies - GET /health/dependencies
  router.get('/dependencies', (req, res) => {
    try {
      const services = healthCheckService.getServiceConfigurations();
      
      const dependencyGraph = services.map(service => ({
        id: service.id,
        name: service.name,
        type: service.type,
        dependencies: service.dependencies || [],
        dependents: services
          .filter(s => s.dependencies?.includes(service.id))
          .map(s => s.id),
        health: healthCheckService.getServiceHealth(service.id)?.status || 'unknown'
      }));

      res.json({
        timestamp: new Date().toISOString(),
        services: dependencyGraph
      });

    } catch (error) {
      logger.error('Dependencies check failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Dependencies check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Service configurations - GET /health/config
  router.get('/config', (req, res) => {
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

    } catch (error) {
      logger.error('Service config endpoint failed', 'HEALTH_EXPRESS', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Service configuration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}

// Export convenience functions for common microservices
export const walmartApiServerHealth = () => createServiceHealthRoutes('walmart-api-server', 'Walmart API Server');
export const walmartWebSocketHealth = () => createServiceHealthRoutes('walmart-websocket', 'Walmart WebSocket Service');
export const walmartPricingHealth = () => createServiceHealthRoutes('walmart-pricing', 'Walmart Pricing Service');
export const walmartNLPQueueHealth = () => createServiceHealthRoutes('walmart-nlp-queue', 'Walmart NLP Queue Service');
export const walmartCacheWarmerHealth = () => createServiceHealthRoutes('walmart-cache-warmer', 'Walmart Cache Warmer');
export const walmartMemoryMonitorHealth = () => createServiceHealthRoutes('walmart-memory-monitor', 'Walmart Memory Monitor');