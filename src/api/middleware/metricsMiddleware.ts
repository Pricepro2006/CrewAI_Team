/**
 * Metrics Middleware - Automatically tracks API metrics
 * Records response times, status codes, and request patterns
 */

import type { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';
import { metricsCollectionService } from '../../monitoring/MetricsCollectionService.js';
import { v4 as uuidv4 } from 'uuid';

interface MetricsRequest extends Request {
  metricsStartTime?: number;
  correlationId?: string;
}

/**
 * Middleware to track API metrics
 */
export function metricsMiddleware(req: MetricsRequest, res: Response, next: NextFunction): void {
  // Skip metrics endpoint to avoid recursion
  if (req.path === '/metrics' || req.path.startsWith('/metrics/')) {
    return next();
  }
  
  // Start timing
  req.metricsStartTime = performance.now();
  
  // Generate correlation ID for distributed tracing
  req.correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  
  // Add correlation ID to response headers
  res.setHeader('X-Correlation-Id', req.correlationId);
  
  // Override res.end to capture metrics
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: (() => void)): Response {
    // Calculate duration
    const duration = req.metricsStartTime ? performance.now() - req.metricsStartTime : 0;
    
    // Record API metric
    const method = req.method;
    const endpoint = req.route?.path || req.path;
    const status = res.statusCode;
    
    metricsCollectionService.recordAPIMetric(method, endpoint, status, duration);
    
    // Record trace if correlation ID exists
    if (req.correlationId) {
      metricsCollectionService.recordTrace(
        req.correlationId,
        'api',
        endpoint,
        duration
      );
    }
    
    // Call original end with proper parameter handling
    if (typeof encoding === 'function') {
      return originalEnd.call(res, chunk, encoding);
    } else {
      return originalEnd.call(res, chunk, encoding, cb);
    }
  };
  
  next();
}

/**
 * Middleware to track database query metrics
 * Should be used to wrap database operations
 */
export function databaseMetricsWrapper<T>(
  queryType: string,
  table: string,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  
  return operation()
    .then(result => {
      const duration = performance.now() - startTime;
      metricsCollectionService.recordDatabaseMetric(queryType, table, duration, true);
      return result;
    })
    .catch(error => {
      const duration = performance.now() - startTime;
      metricsCollectionService.recordDatabaseMetric(queryType, table, duration, false);
      throw error;
    });
}

/**
 * Middleware to track WebSocket metrics
 */
export function websocketMetricsMiddleware(ws: any): void {
  // Track connection
  metricsCollectionService.recordWebSocketMetric('connect', {
    timestamp: Date.now()
  });
  
  // Track messages
  ws.on('message', (data: any) => {
    metricsCollectionService.recordWebSocketMetric('message', {
      direction: 'inbound',
      messageType: data.type || 'unknown',
      size: JSON.stringify(data).length
    });
  });
  
  // Track sending
  const originalSend = ws.send;
  ws.send = function(data: any, ...args: any[]) {
    metricsCollectionService.recordWebSocketMetric('message', {
      direction: 'outbound',
      messageType: data.type || 'unknown',
      size: JSON.stringify(data).length
    });
    return originalSend.apply(ws, [data, ...args]);
  };
  
  // Track errors
  ws.on('error', (error: Error) => {
    metricsCollectionService.recordWebSocketMetric('error', {
      error: error.message
    });
  });
  
  // Track disconnection
  ws.on('close', () => {
    metricsCollectionService.recordWebSocketMetric('disconnect', {
      timestamp: Date.now()
    });
  });
}

/**
 * Create a traced function wrapper
 * Automatically tracks execution time and errors
 */
export function traced<T extends (...args: any[]) => any>(
  serviceName: string,
  functionName: string,
  fn: T
): T {
  return (async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    const correlationId = (args[0]?.correlationId || 
                          args[0]?.headers?.['x-correlation-id'] || 
                          uuidv4()) as string;
    const startTime = performance.now();
    
    try {
      const result = await fn(...args);
      const duration = performance.now() - startTime;
      
      metricsCollectionService.recordTrace(
        correlationId,
        serviceName,
        functionName,
        duration
      );
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      metricsCollectionService.recordTrace(
        correlationId,
        serviceName,
        `${functionName}_error`,
        duration
      );
      
      throw error;
    }
  }) as T;
}

/**
 * Create a cached function wrapper with metrics
 * Tracks cache hit/miss rates
 */
export function cachedWithMetrics<T extends (...args: any[]) => any>(
  cacheType: string,
  fn: T,
  cache: Map<string, any>,
  keyGenerator: (...args: Parameters<T>) => string
): T {
  return (async function(...args: Parameters<T>): Promise<ReturnType<T>> {
    const key = keyGenerator(...args);
    const startTime = performance.now();
    
    // Check cache
    if (cache.has(key)) {
      const duration = performance.now() - startTime;
      metricsCollectionService.recordAPIMetric('CACHE_HIT', cacheType, 200, duration);
      return cache.get(key) as ReturnType<T>;
    }
    
    // Cache miss - execute function
    try {
      const result = await fn.apply(this, args);
      cache.set(key, result);
      
      const duration = performance.now() - startTime;
      metricsCollectionService.recordAPIMetric('CACHE_MISS', cacheType, 200, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      metricsCollectionService.recordAPIMetric('CACHE_ERROR', cacheType, 500, duration);
      throw error;
    }
  }) as T;
}