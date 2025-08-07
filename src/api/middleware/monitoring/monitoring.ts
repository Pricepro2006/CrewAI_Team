/**
 * API Performance Monitoring Middleware
 * Tracks request/response times, errors, and performance metrics
 */

import { Request, Response, NextFunction } from 'express';
import { monitoringService } from '../../../services/MonitoringService';
import { logger } from '../../../utils/logger.js';

interface MonitoringRequest extends Request {
  _monitoringStartTime?: number;
  _monitoringId?: string;
}

export const performanceMonitoringMiddleware = (
  req: MonitoringRequest, 
  res: Response, 
  next: NextFunction
) => {
  // Start timing
  const startTime = Date.now();
  req._monitoringStartTime = startTime;
  req._monitoringId = `req_${startTime}_${Math.random().toString(36).substr(2, 9)}`;

  // Track the connection
  monitoringService.trackConnection(req._monitoringId, 'http', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress
  });

  // Override res.end to capture response data
  const originalEnd = res.end;
  const originalSend = res.send;
  const originalJson = res.json;

  let responseSize = 0;
  let responseBody: any;

  // Capture response size and body
  res.send = function(body: any) {
    responseBody = body;
    if (typeof body === 'string') {
      responseSize = Buffer.byteLength(body, 'utf8');
    } else if (Buffer.isBuffer(body)) {
      responseSize = body.length;
    } else {
      responseSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
    }
    return originalSend.call(this, body);
  };

  res.json = function(obj: any) {
    responseBody = obj;
    responseSize = Buffer.byteLength(JSON.stringify(obj), 'utf8');
    return originalJson.call(this, obj);
  };

  res.end = function(chunk?: any, encoding?: any) {
    // Calculate response time
    const responseTime = Date.now() - startTime;
    
    // Determine endpoint name (clean up dynamic segments)
    const endpoint = cleanEndpointName(req.route?.path || req.path);
    
    // Check for errors
    const isError = res.statusCode >= 400;
    const errorMessage = isError && responseBody?.error ? 
      (typeof responseBody.error === 'string' ? responseBody.error : responseBody.error.message) : 
      undefined;

    // Record API performance
    monitoringService.recordAPIPerformance(
      endpoint,
      req.method,
      responseTime,
      res.statusCode,
      errorMessage
    );

    // Record additional metrics
    monitoringService.recordMetric('http.request.size', 
      parseInt(req.headers['content-length'] as string) || 0, 
      { method: req.method, endpoint }, 
      'gauge', 
      'bytes'
    );

    monitoringService.recordMetric('http.response.size', 
      responseSize, 
      { method: req.method, endpoint, status: res.statusCode.toString() }, 
      'gauge', 
      'bytes'
    );

    // Update connection activity
    if (req._monitoringId) {
      monitoringService.updateConnectionActivity(req._monitoringId, {
        responseTime,
        statusCode: res.statusCode,
        responseSize,
        completed: true
      });

      // Disconnect the connection tracking
      monitoringService.disconnectConnection(req._monitoringId, errorMessage);
    }

    // Log performance data
    const logLevel = isError ? 'warn' : responseTime > 1000 ? 'warn' : 'info';
    logger[logLevel](`${req.method} ${endpoint} - ${res.statusCode} - ${responseTime}ms`, 'API_PERFORMANCE', {
      method: req.method,
      endpoint,
      statusCode: res.statusCode,
      responseTime,
      responseSize,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });

    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Clean endpoint names for better grouping
 * Convert dynamic segments to placeholders
 */
function cleanEndpointName(path: string): string {
  return path
    // Replace UUID patterns
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    // Replace numeric IDs
    .replace(/\/\d+/g, '/:id')
    // Replace other dynamic segments that look like :param
    .replace(/\/:[^\/]+/g, '/:param')
    // Clean up multiple slashes
    .replace(/\/+/g, '/')
    // Remove trailing slash
    .replace(/\/$/, '') || '/';
}

/**
 * Error handling middleware for monitoring
 */
export const errorMonitoringMiddleware = (
  error: Error,
  req: MonitoringRequest,
  res: Response,
  next: NextFunction
) => {
  const responseTime = req._monitoringStartTime ? 
    Date.now() - req._monitoringStartTime : 0;

  const endpoint = cleanEndpointName(req.route?.path || req.path);

  // Record the error
  monitoringService.recordAPIPerformance(
    endpoint,
    req.method,
    responseTime,
    res.statusCode || 500,
    error.message
  );

  // Create an alert for the error
  monitoringService.createAlert('error', 'medium', 
    `API Error: ${error.message}`, {
    endpoint,
    method: req.method,
    error: error.message,
    stack: error.stack,
    statusCode: res.statusCode || 500
  });

  // Update connection with error
  if (req._monitoringId) {
    monitoringService.disconnectConnection(req._monitoringId, error.message);
  }

  // Log the error
  logger.error(`API Error: ${req.method} ${endpoint}`, 'API_ERROR', {
    error: error.message,
    stack: error.stack,
    method: req.method,
    endpoint,
    statusCode: res.statusCode || 500,
    responseTime
  });

  next(error);
};

/**
 * Request rate limiting monitoring
 */
export const rateLimitMonitoringMiddleware = (windowMs: number = 60000, maxRequests: number = 100) => {
  const requestCounts = new Map<string, { count: number; window: number }>();
  
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    
    // Get or create client record
    let clientRecord = requestCounts.get(clientId);
    if (!clientRecord || clientRecord.window !== windowStart) {
      clientRecord = { count: 0, window: windowStart };
      requestCounts.set(clientId, clientRecord);
    }
    
    clientRecord.count++;
    
    // Record rate limiting metrics
    monitoringService.recordMetric('http.requests_per_window', 
      clientRecord.count, 
      { client: clientId, window: windowStart.toString() }, 
      'gauge'
    );
    
    // Check if rate limit exceeded
    if (clientRecord.count > maxRequests) {
      monitoringService.createAlert('performance', 'medium', 
        `Rate limit exceeded for client ${clientId}: ${clientRecord.count}/${maxRequests}`, {
        clientId,
        requestCount: clientRecord.count,
        maxRequests,
        windowMs
      });
      
      res.status(429).json({ 
        error: 'Too Many Requests',
        retryAfter: Math.ceil((windowStart + windowMs - now) / 1000)
      });
      return;
    }
    
    // Cleanup old windows periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      const cutoff = now - windowMs * 2;
      for (const [key, record] of requestCounts.entries()) {
        if (record.window < cutoff) {
          requestCounts.delete(key);
        }
      }
    }
    
    next();
  };
};

/**
 * Health check monitoring middleware
 */
export const healthCheckMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.path === '/health' || req.path === '/ping') {
    const healthData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };
    
    // Record health check metric
    monitoringService.recordMetric('health.check', 1, { endpoint: req.path }, 'counter');
    
    res.json(healthData);
    return;
  }
  
  next();
};

/**
 * Request size monitoring
 */
export const requestSizeMonitoringMiddleware = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] as string) || 0;
    
    // Record request size
    monitoringService.recordMetric('http.request.size', 
      contentLength, 
      { method: req.method, endpoint: req.path }, 
      'histogram', 
      'bytes'
    );
    
    // Check for oversized requests
    if (contentLength > maxSize) {
      monitoringService.createAlert('performance', 'high', 
        `Large request detected: ${Math.round(contentLength / 1024 / 1024)}MB`, {
        endpoint: req.path,
        method: req.method,
        size: contentLength,
        maxSize
      });
    }
    
    next();
  };
};