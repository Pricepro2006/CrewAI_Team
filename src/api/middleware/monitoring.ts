import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../../monitoring/MetricsCollector';
import { errorTracker } from '../../monitoring/ErrorTracker';
import { performanceMonitor } from '../../monitoring/PerformanceMonitor';
import { logger } from '../../utils/logger';

// Generate request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Request tracking middleware
export function requestTracking(req: Request, res: Response, next: NextFunction): void {
  // Generate and attach request ID
  const requestId = generateRequestId();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Start performance tracking
  const performanceName = `api_${req.method.toLowerCase()}_${req.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
  performanceMonitor.mark(performanceName);

  // Track request start
  const startTime = Date.now();
  const startCpuUsage = process.cpuUsage();
  const startMemory = process.memoryUsage();

  // Log request
  logger.info('API request started', 'REQUEST_TRACKING', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(body: any) {
    res.locals.responseBody = body;
    return originalJson.call(this, body);
  };

  // Track response
  res.on('finish', () => {
    const endTime = Date.now();
    const duration = endTime - startTime;
    const endCpuUsage = process.cpuUsage(startCpuUsage);
    const endMemory = process.memoryUsage();

    // Record performance metrics
    performanceMonitor.measure(performanceName, {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode
    });

    // Record request metrics
    metricsCollector.increment('http_requests_total', 1, {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString()
    });

    metricsCollector.histogram('http_request_duration_ms', duration, {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode.toString()
    });

    metricsCollector.histogram('http_request_cpu_us', endCpuUsage.user + endCpuUsage.system, {
      method: req.method,
      route: req.route?.path || req.path
    });

    metricsCollector.histogram('http_request_memory_delta_bytes', 
      endMemory.heapUsed - startMemory.heapUsed, {
      method: req.method,
      route: req.route?.path || req.path
    });

    // Log completion
    logger.info('API request completed', 'REQUEST_TRACKING', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      cpuUsage: {
        user: endCpuUsage.user / 1000, // Convert to ms
        system: endCpuUsage.system / 1000
      },
      memoryDelta: {
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external
      }
    });

    // Track errors
    if (res.statusCode >= 400) {
      const errorContext = {
        requestId,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('user-agent'),
        ip: req.ip,
        userId: (req as any).user?.id
      };

      let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (res.statusCode >= 500) severity = 'high';
      else if (res.statusCode === 401 || res.statusCode === 403) severity = 'medium';

      const errorMessage = res.locals.responseBody?.error || 
                          res.locals.responseBody?.message || 
                          'Unknown error';

      errorTracker.trackError(
        new Error(`HTTP ${res.statusCode}: ${errorMessage}`),
        errorContext,
        severity,
        true,
        [`http-${res.statusCode}`, req.method.toLowerCase()]
      );
    }
  });

  next();
}

// Error handling middleware
export function errorTracking(err: Error, req: Request, res: Response, next: NextFunction): void {
  const requestId = req.id || generateRequestId();
  
  // Track error
  const errorId = errorTracker.trackError(
    err,
    {
      requestId,
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      userId: (req as any).user?.id
    },
    'high',
    false,
    ['unhandled', 'middleware']
  );

  // Log error
  logger.error('Unhandled middleware error', 'ERROR_TRACKING', {
    errorId,
    requestId,
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Send error response
  res.status(500).json({
    error: 'Internal server error',
    errorId,
    requestId,
    timestamp: new Date().toISOString()
  });
}

// Performance monitoring for specific operations
export function monitorOperation(operationName: string) {
  return function(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const fullOperationName = `${operationName}_${propertyKey}`;
      return performanceMonitor.trackAsync(
        fullOperationName,
        () => originalMethod.apply(this, args),
        { class: target.constructor.name, method: propertyKey }
      );
    };

    return descriptor;
  };
}

// Request size tracking
export function requestSizeTracking(req: Request, res: Response, next: NextFunction): void {
  // Track request size
  const contentLength = req.get('content-length');
  if (contentLength) {
    metricsCollector.histogram('http_request_size_bytes', parseInt(contentLength), {
      method: req.method,
      route: req.route?.path || req.path
    });
  }

  // Track response size
  const originalSend = res.send;
  res.send = function(data: any) {
    if (data) {
      const size = Buffer.byteLength(JSON.stringify(data));
      metricsCollector.histogram('http_response_size_bytes', size, {
        method: req.method,
        route: req.route?.path || req.path,
        status: res.statusCode.toString()
      });
    }
    return originalSend.call(this, data);
  };

  next();
}

// Rate limit tracking
export function rateLimitTracking(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (res.statusCode === 429) {
      metricsCollector.increment('rate_limit_exceeded_total', 1, {
        method: req.method,
        route: req.route?.path || req.path,
        ip: req.ip
      });

      errorTracker.trackError(
        new Error('Rate limit exceeded'),
        {
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('user-agent'),
          userId: (req as any).user?.id
        },
        'low',
        true,
        ['rate-limit', 'security']
      );
    }
  });

  next();
}

// Authentication tracking
export function authTracking(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    if (req.path.includes('/auth') || req.path.includes('/login')) {
      const success = res.statusCode < 400;
      
      metricsCollector.increment('auth_attempts_total', 1, {
        endpoint: req.path,
        success: success.toString()
      });

      if (!success && res.statusCode === 401) {
        metricsCollector.increment('auth_failures_total', 1, {
          endpoint: req.path,
          ip: req.ip
        });

        errorTracker.trackError(
          new Error('Authentication failed'),
          {
            endpoint: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent')
          },
          'medium',
          true,
          ['auth', 'security']
        );
      }
    }
  });

  next();
}

// Database query tracking
export function trackDatabaseQuery(queryName: string, operation: string) {
  const timer = metricsCollector.startTimer('database_query_duration_ms', {
    query: queryName,
    operation
  });

  return {
    success: () => {
      timer();
      metricsCollector.increment('database_queries_total', 1, {
        query: queryName,
        operation,
        status: 'success'
      });
    },
    error: (error: Error) => {
      timer();
      metricsCollector.increment('database_queries_total', 1, {
        query: queryName,
        operation,
        status: 'error'
      });
      metricsCollector.increment('database_errors_total', 1, {
        query: queryName,
        operation,
        error: error.name
      });
    }
  };
}

// WebSocket tracking
export function trackWebSocketConnection(connected: boolean, clientId?: string): void {
  if (connected) {
    metricsCollector.increment('websocket_connections_total');
    metricsCollector.gauge('websocket_connections_active', 1, { action: 'increment' });
  } else {
    metricsCollector.increment('websocket_disconnections_total');
    metricsCollector.gauge('websocket_connections_active', -1, { action: 'decrement' });
  }
}

export function trackWebSocketMessage(direction: 'inbound' | 'outbound', event: string, size: number): void {
  metricsCollector.increment('websocket_messages_total', 1, {
    direction,
    event
  });
  metricsCollector.histogram('websocket_message_size_bytes', size, {
    direction,
    event
  });
}

// Ollama tracking
export function trackOllamaRequest(model: string, operation: string) {
  const timer = metricsCollector.startTimer('ollama_request_duration_ms', {
    model,
    operation
  });

  return {
    success: (tokensUsed?: number) => {
      timer();
      metricsCollector.increment('ollama_requests_total', 1, {
        model,
        operation,
        status: 'success'
      });
      if (tokensUsed) {
        metricsCollector.histogram('ollama_tokens_used', tokensUsed, {
          model,
          operation
        });
      }
    },
    error: (error: Error) => {
      timer();
      metricsCollector.increment('ollama_requests_total', 1, {
        model,
        operation,
        status: 'error'
      });
      metricsCollector.increment('ollama_errors_total', 1, {
        model,
        operation,
        error: error.name
      });
    }
  };
}