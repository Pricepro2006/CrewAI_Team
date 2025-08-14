/**
 * Circuit Breaker API Router
 * 
 * Provides REST endpoints for circuit breaker monitoring, control, and management
 */

import express from 'express';
import { circuitBreakerService } from '../../core/resilience/CircuitBreakerService.js';
import { logger } from '../../utils/logger.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { z } from 'zod';

const router = express.Router();

// Request validation schemas
const ServiceOperationSchema = z.object({
  service: z.string().min(1),
  operation: z.string().min(1).optional(),
});

const ConfigUpdateSchema = z.object({
  config: z.object({
    failureThreshold: z.number().min(1).optional(),
    successThreshold: z.number().min(1).optional(),
    timeout: z.number().min(1000).optional(),
    monitor: z.boolean().optional(),
    resetOnSuccess: z.boolean().optional(),
    fallbackEnabled: z.boolean().optional(),
  }).optional(),
  retryPolicy: z.object({
    maxAttempts: z.number().min(1).optional(),
    baseDelay: z.number().min(100).optional(),
    maxDelay: z.number().min(1000).optional(),
    backoffMultiplier: z.number().min(1).optional(),
    jitter: z.boolean().optional(),
  }).optional(),
  bulkhead: z.object({
    maxConcurrent: z.number().min(1).optional(),
    queueSize: z.number().min(0).optional(),
    timeout: z.number().min(1000).optional(),
  }).optional(),
});

/**
 * GET /api/circuit-breaker/health
 * Get overall system health including all circuit breakers and bulkheads
 */
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const systemHealth = circuitBreakerService.getSystemHealth();
    
    logger.debug('Circuit breaker health requested', 'CIRCUIT_BREAKER_API', {
      overall: systemHealth.overall,
      servicesCount: Object.keys(systemHealth.services).length,
    });

    res.json(systemHealth);
  } catch (error) {
    logger.error('Failed to get system health', 'CIRCUIT_BREAKER_API', {}, error as Error);
    res.status(500).json({
      error: 'Failed to retrieve system health',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * GET /api/circuit-breaker/state/:service?/:operation?
 * Get circuit breaker state for specific service or operation
 */
router.get('/state/:service?/:operation?', asyncHandler(async (req, res) => {
  try {
    const { service, operation } = req.params;
    
    let state;
    if (service && operation) {
      // Get specific circuit breaker state
      const circuitBreakerName = `${service}_${operation}`;
      state = circuitBreakerService.getCircuitBreakerState(service)[circuitBreakerName];
      
      if (!state) {
        res.status(404).json({
          error: 'Circuit breaker not found',
          service,
          operation,
        });
        return;
      }
    } else if (service) {
      // Get all circuit breakers for service
      state = circuitBreakerService.getCircuitBreakerState(service);
    } else {
      // Get all circuit breakers
      state = circuitBreakerService.getCircuitBreakerState();
    }

    res.json(state);
  } catch (error) {
    logger.error('Failed to get circuit breaker state', 'CIRCUIT_BREAKER_API', {
      service: req.params.service,
      operation: req.params.operation,
    }, error as Error);
    
    res.status(500).json({
      error: 'Failed to retrieve circuit breaker state',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * POST /api/circuit-breaker/reset/:service/:operation?
 * Reset circuit breaker to closed state
 */
router.post('/reset/:service/:operation?', asyncHandler(async (req, res) => {
  try {
    const { service, operation } = req.params;
    
    if (!service) {
      res.status(400).json({
        error: 'Service parameter is required',
      });
      return;
    }

    circuitBreakerService.resetCircuitBreaker(service, operation);
    
    logger.info('Circuit breaker reset via API', 'CIRCUIT_BREAKER_API', {
      service,
      operation,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Circuit breaker reset for ${service}${operation ? `/${operation}` : ''}`,
      service,
      operation,
    });
  } catch (error) {
    logger.error('Failed to reset circuit breaker', 'CIRCUIT_BREAKER_API', {
      service: req.params.service,
      operation: req.params.operation,
    }, error as Error);
    
    res.status(500).json({
      error: 'Failed to reset circuit breaker',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * POST /api/circuit-breaker/force-open/:service/:operation?
 * Force circuit breaker to open state (maintenance mode)
 */
router.post('/force-open/:service/:operation?', asyncHandler(async (req, res) => {
  try {
    const { service, operation } = req.params;
    
    if (!service) {
      res.status(400).json({
        error: 'Service parameter is required',
      });
      return;
    }

    circuitBreakerService.forceCircuitBreakerOpen(service, operation);
    
    logger.warn('Circuit breaker forced open via API', 'CIRCUIT_BREAKER_API', {
      service,
      operation,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Circuit breaker forced open for ${service}${operation ? `/${operation}` : ''}`,
      service,
      operation,
      warning: 'Service is now in maintenance mode',
    });
  } catch (error) {
    logger.error('Failed to force circuit breaker open', 'CIRCUIT_BREAKER_API', {
      service: req.params.service,
      operation: req.params.operation,
    }, error as Error);
    
    res.status(500).json({
      error: 'Failed to force circuit breaker open',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * GET /api/circuit-breaker/dead-letter-queue
 * Get all items in the dead letter queue
 */
router.get('/dead-letter-queue', asyncHandler(async (req, res) => {
  try {
    const items = circuitBreakerService.getDeadLetterQueue();
    
    res.json(items);
  } catch (error) {
    logger.error('Failed to get dead letter queue', 'CIRCUIT_BREAKER_API', {}, error as Error);
    
    res.status(500).json({
      error: 'Failed to retrieve dead letter queue',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * POST /api/circuit-breaker/retry/:itemId
 * Retry a specific dead letter queue item
 */
router.post('/retry/:itemId', asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;
    
    if (!itemId) {
      res.status(400).json({
        error: 'Item ID parameter is required',
      });
      return;
    }

    const success = await circuitBreakerService.retryDeadLetterItem(itemId);
    
    if (success) {
      logger.info('Dead letter queue item retried via API', 'CIRCUIT_BREAKER_API', {
        itemId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      });

      res.json({
        success: true,
        message: `Item ${itemId} retried successfully`,
        itemId,
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Item not found or retry failed',
        itemId,
      });
    }
  } catch (error) {
    logger.error('Failed to retry dead letter queue item', 'CIRCUIT_BREAKER_API', {
      itemId: req.params.itemId,
    }, error as Error);
    
    res.status(500).json({
      error: 'Failed to retry dead letter queue item',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * PUT /api/circuit-breaker/config/:service
 * Update configuration for a service's circuit breakers
 */
router.put('/config/:service', asyncHandler(async (req, res) => {
  try {
    const { service } = req.params;
    
    if (!service) {
      res.status(400).json({
        error: 'Service parameter is required',
      });
      return;
    }

    const validatedConfig = ConfigUpdateSchema.parse(req.body);
    
    // Build configuration with proper types
    const updatePayload: any = {
      service: service as any
    };
    
    if (validatedConfig.config) {
      updatePayload.config = validatedConfig.config;
    }
    if (validatedConfig.retryPolicy) {
      updatePayload.retryPolicy = validatedConfig.retryPolicy;
    }
    if (validatedConfig.bulkhead) {
      updatePayload.bulkhead = validatedConfig.bulkhead;
    }
    
    circuitBreakerService.updateServiceConfig(service, updatePayload);
    
    logger.info('Circuit breaker configuration updated via API', 'CIRCUIT_BREAKER_API', {
      service,
      updatedFields: Object.keys(validatedConfig),
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Configuration updated for ${service}`,
      service,
      updatedConfig: validatedConfig,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: 'Invalid configuration',
        details: error.errors,
      });
      return;
    }

    logger.error('Failed to update circuit breaker configuration', 'CIRCUIT_BREAKER_API', {
      service: req.params.service,
    }, error as Error);
    
    res.status(500).json({
      error: 'Failed to update configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * GET /api/circuit-breaker/metrics
 * Get aggregated circuit breaker metrics for monitoring
 */
router.get('/metrics', asyncHandler(async (req, res) => {
  try {
    const systemHealth = circuitBreakerService.getSystemHealth();
    
    // Transform data for metrics format
    const metrics = {
      timestamp: new Date().toISOString(),
      overall_health: systemHealth.overall,
      services: Object.entries(systemHealth.services).map(([serviceName, serviceData]) => ({
        service: serviceName,
        circuit_breakers: Object.entries(serviceData.circuitBreakers).map(([name, cb]: [string, any]) => ({
          name: name.replace(`${serviceName}_`, ''),
          state: cb.state,
          total_requests: cb.totalRequests,
          successful_requests: cb.successfulRequests,
          failed_requests: cb.failedRequests,
          rejected_requests: cb.rejectedRequests,
          success_rate: cb.totalRequests > 0 ? (cb.successfulRequests / cb.totalRequests) * 100 : 0,
          error_rate: cb.totalRequests > 0 ? (cb.failedRequests / cb.totalRequests) * 100 : 0,
          avg_response_time: cb.averageResponseTime,
          uptime: cb.uptime,
        })),
        bulkhead: {
          max_concurrent: serviceData.bulkhead.maxConcurrent,
          current_active: serviceData.bulkhead.currentActive,
          queue_size: serviceData.bulkhead.queueSize,
          utilization: (serviceData.bulkhead.currentActive / serviceData.bulkhead.maxConcurrent) * 100,
        },
      })),
      dead_letter_queue: systemHealth.deadLetterQueue,
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Failed to get circuit breaker metrics', 'CIRCUIT_BREAKER_API', {}, error as Error);
    
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}));

/**
 * POST /api/circuit-breaker/test/:service/:operation
 * Test endpoint to simulate circuit breaker behavior (development only)
 */
if (process.env.NODE_ENV === 'development') {
  router.post('/test/:service/:operation', asyncHandler(async (req, res) => {
    try {
      const { service, operation } = req.params;
      const { shouldFail = false, delay = 0 } = req.body;
      
      const result = await circuitBreakerService.executeWithCircuitBreaker(
        service as any,
        operation as any,
        async () => {
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          if (shouldFail) {
            throw new Error('Simulated failure for testing');
          }
          
          return { message: 'Test successful', timestamp: new Date().toISOString() };
        },
        {
          fallbackOptions: {
            fallbackValue: { message: 'Fallback response', timestamp: new Date().toISOString() },
          },
        }
      );

      res.json({
        success: true,
        result,
        service,
        operation,
        testConfig: { shouldFail, delay },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        service: req.params.service,
        operation: req.params.operation,
      });
    }
  }));
}

/**
 * Error handling middleware specific to circuit breaker routes
 */
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Circuit breaker API error', 'CIRCUIT_BREAKER_API', {
    path: req.path,
    method: req.method,
    params: req.params,
    body: req.body,
  }, error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: 'Internal server error in circuit breaker API',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
});

export default router;