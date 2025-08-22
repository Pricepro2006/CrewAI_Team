/**
 * Monitoring Middleware Integration
 * Integrates comprehensive monitoring with tRPC and Express
 */

import { TRPCError } from '@trpc/server';
import type { Request, Response, NextFunction } from 'express';
import { sentryErrorTracker } from '../../monitoring/SentryErrorTracker.js';
import { trpcPerformanceMonitor } from '../../monitoring/TRPCPerformanceMonitor.js';
import { groceryAgentMetrics } from '../../monitoring/GroceryAgentMetrics.js';
import { alertSystem } from '../../monitoring/AlertSystem.js';
import { structuredLogger } from '../../monitoring/StructuredLogger.js';
import { 
  ProductMatchingError,
  PriceFetchError,
  NLPParsingError,
  DatabaseQueryError,
  WebSocketConnectionError,
} from '../../monitoring/ErrorTypes.js';

// Request context interface
export interface MonitoringContext {
  traceId: string;
  startTime: number;
  requestId: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ip: string;
}

// Generate unique IDs
const generateTraceId = () => `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/**
 * Express middleware for HTTP request monitoring
 */
export function createHTTPMonitoringMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const traceId = generateTraceId();
    const requestId = generateRequestId();

    // Add monitoring context to request
    (req as any).monitoringContext = {
      traceId,
      startTime,
      requestId,
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req?.connection?.remoteAddress,
    } as MonitoringContext;

    // Set Sentry context
    sentryErrorTracker.setUser(
      (req as any).user?.id || 'anonymous',
      (req as any).user?.email,
      (req as any).user?.username
    );

    sentryErrorTracker.addBreadcrumb(
      `HTTP ${req.method} ${req.path}`,
      'http',
      'info',
      {
        method: req.method,
        path: req.path,
        query: req.query,
        traceId,
        requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
      }
    );

    // Track request start
    structuredLogger.info(
      `HTTP request started: ${req.method} ${req.path}`,
      'http_server',
      {
        operation: 'http_request_start',
        traceId,
        requestId,
        userId: (req as any).user?.id,
        data: JSON.parse(JSON.stringify({
          method: req.method,
          path: req.path,
          query: req.query,
          headers: {
            'user-agent': req.get('User-Agent') || null,
            'content-type': req.get('Content-Type') || null,
          },
        })),
        tags: ['http', 'request', 'start'],
      }
    );

    // Monitor response
    const originalSend = res?.send;
    res.send = function(body) {
      const duration = Date.now() - startTime;
      const statusCode = res?.statusCode;

      // Log response
      structuredLogger.apiRequest(
        req.method,
        req.path,
        statusCode,
        duration,
        (req as any).user?.id,
        {
          traceId,
          requestId,
          data: JSON.parse(JSON.stringify({
            query: req.query,
            responseSize: Buffer.byteLength(body || ''),
          })),
        }
      );

      // Track in Sentry
      sentryErrorTracker.trackAPIResponse(
        req.path,
        req.method,
        statusCode,
        duration,
        {
          traceId,
          requestId,
          userId: (req as any).user?.id,
          sessionId: (req as any).session?.id,
        }
      );

      // Record metrics
      if (req?.path?.includes('/api/')) {
        groceryAgentMetrics.recordUserSession(
          duration,
          1, // queryCount - simplified for HTTP
          duration < 1000 && statusCode < 400, // bounced if fast and successful
          statusCode < 400, // converted if successful
          ['http_api'], // features used
          req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop'
        );
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * tRPC middleware for procedure monitoring
 */
export function createTRPCMonitoringMiddleware() {
  return trpcPerformanceMonitor.createTRPCMiddleware();
}

/**
 * Error handling middleware with monitoring integration
 */
export function createErrorMonitoringMiddleware() {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    const context = (req as any).monitoringContext as MonitoringContext;
    
    // Determine error severity based on status code or error type
    let severity: 'info' | 'warning' | 'error' | 'fatal' = 'error';
    if (res.statusCode >= 500) {
      severity = 'fatal';
    } else if (res.statusCode >= 400) {
      severity = 'warning';
    }

    // Track error
    const errorId = sentryErrorTracker.captureError(
      error,
      {
        traceId: context?.traceId,
        requestId: context?.requestId,
        userId: context?.userId,
        sessionId: context?.sessionId,
        endpoint: req.path,
        method: req.method,
        userAgent: context?.userAgent,
        ip: context?.ip,
        component: 'http_server',
        operation: 'http_request',
      },
      severity,
      {
        http_method: req.method,
        http_path: req.path,
        http_status: res?.statusCode?.toString(),
        error_type: error?.constructor?.name,
      }
    );

    // Log structured error
    structuredLogger.error(
      `HTTP request error: ${error.message}`,
      'http_server',
      {
        operation: 'http_request_error',
        traceId: context?.traceId,
        requestId: context?.requestId,
        userId: context?.userId || null,
        error: JSON.parse(JSON.stringify({ message: error.message, name: error.name, stack: error.stack })),
        data: {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          errorId,
        },
        tags: ['http', 'request', 'error'],
      }
    );

    // Create alert for server errors
    if (res.statusCode >= 500) {
      alertSystem.createAlert(
        'http_server_error',
        'error',
        `HTTP 5xx error: ${req.method} ${req.path} - ${error.message}`,
        'http_server',
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          errorId,
          userId: context?.userId,
          traceId: context?.traceId,
        }
      );
    }

    next(error);
  };
}

/**
 * WebSocket monitoring wrapper
 */
export function createWebSocketMonitoring() {
  return {
    onConnection: (connectionId: string, userId?: string) => {
      groceryAgentMetrics.recordWebSocketEvent('connect', connectionId);
      
      structuredLogger.webSocketEvent('connect', connectionId, {
        userId: userId || null,
        data: { connectionId, userId: userId || null },
      });

      sentryErrorTracker.trackWebSocketEvent('connect', {
        connectionId,
        userId,
        component: 'websocket',
      });
    },

    onDisconnect: (connectionId: string, duration: number, userId?: string) => {
      groceryAgentMetrics.recordWebSocketEvent('disconnect', connectionId, duration);
      
      structuredLogger.webSocketEvent('disconnect', connectionId, {
        userId: userId || null,
        duration,
        data: { connectionId, userId: userId || null, duration },
      });

      sentryErrorTracker.trackWebSocketEvent('disconnect', {
        connectionId,
        userId,
        component: 'websocket',
      });
    },

    onMessage: (connectionId: string, messageType: string, userId?: string) => {
      groceryAgentMetrics.recordWebSocketEvent('message_received', connectionId);
      
      structuredLogger.webSocketEvent('message', connectionId, {
        userId: userId || null,
        data: { connectionId, messageType, userId: userId || null },
      });
    },

    onError: (connectionId: string, error: Error, userId?: string) => {
      groceryAgentMetrics.recordWebSocketEvent('error', connectionId);
      
      const errorId = sentryErrorTracker.captureError(
        new WebSocketConnectionError(error.message, {
          connectionId,
          userId,
          reason: error.message,
        }),
        {
          userId,
          component: 'websocket',
          operation: 'websocket_error',
        },
        'error'
      );

      structuredLogger.error(
        `WebSocket error: ${error.message}`,
        'websocket',
        {
          operation: 'websocket_error',
          data: { connectionId, userId: userId || null, errorId },
          error: JSON.parse(JSON.stringify({ message: error.message, name: error.name, stack: error.stack })),
          tags: ['websocket', 'error'],
        }
      );
    },
  };
}

/**
 * Database query monitoring wrapper
 */
export function createDatabaseMonitoring() {
  return {
    beforeQuery: (query: string, params?: any[]) => {
      const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      return { queryId, startTime };
    },

    afterQuery: (
      queryInfo: { queryId: string; startTime: number },
      query: string,
      success: boolean,
      error?: Error,
      results?: any
    ) => {
      const duration = Date.now() - queryInfo.startTime;

      // Track in performance monitor
      sentryErrorTracker.trackDatabaseQuery(query, duration, success);

      // Log query
      structuredLogger.databaseQuery(query, duration, success, {
        data: {
          queryId: queryInfo.queryId,
          resultCount: results?.length || results?.rowCount || 0,
          error: error?.message || null,
        },
      });

      // Track error if query failed
      if (!success && error) {
        const errorId = sentryErrorTracker.captureError(
          new DatabaseQueryError(error.message, {
            query: query.substring(0, 200),
            duration,
            operation: query.split(' ')[0]?.toLowerCase(),
          }),
          {
            component: 'database',
            operation: 'db_query',
          },
          'error'
        );

        alertSystem.createAlert(
          'database_query_error',
          'error',
          `Database query failed: ${error.message}`,
          'database',
          {
            query: query.substring(0, 100),
            duration,
            errorId,
          }
        );
      }

      // Alert on slow queries
      if (duration > 5000) {
        alertSystem.createAlert(
          'slow_database_query',
          'warning',
          `Slow database query detected: ${duration}ms`,
          'database',
          {
            query: query.substring(0, 100),
            duration,
            threshold: 5000,
          }
        );
      }
    },
  };
}

/**
 * Grocery agent specific monitoring wrappers
 */
export const groceryMonitoring = {
  // NLP Processing monitoring
  nlpParsing: {
    start: (query: string, userId?: string) => {
      const startTime = Date.now();
      const traceId = generateTraceId();

      structuredLogger.info('NLP parsing started', 'nlp_processor', {
        operation: 'nlp_parse_start',
        traceId,
        userId: userId || null,
        data: { query: query.substring(0, 100) },
        tags: ['nlp', 'parsing', 'start'],
      });

      return { startTime, traceId };
    },

    complete: (
      context: { startTime: number; traceId: string },
      query: string,
      success: boolean,
      confidence: number,
      result?: any,
      error?: Error,
      userId?: string
    ) => {
      const duration = Date.now() - context.startTime;

      // Record metrics
      groceryAgentMetrics.recordNLPParsing(
        success,
        confidence,
        duration,
        query,
        error?.message
      );

      // Log completion
      structuredLogger.nlpParsing(success, query, confidence, duration, {
        traceId: context.traceId,
        userId: userId || null,
        data: { result: result || null, error: error?.message || null },
      });

      // Handle errors
      if (!success && error) {
        sentryErrorTracker.captureError(
          new NLPParsingError(error.message, {
            query,
          }),
          {
            traceId: context.traceId,
            userId,
            component: 'nlp_processor',
            operation: 'nlp_parsing',
          },
          'error'
        );
      }
    },
  },

  // Product matching monitoring
  productMatching: {
    record: (
      searchTerm: string,
      matchType: 'exact' | 'fuzzy' | 'none',
      confidence: number,
      searchTime: number,
      category?: string,
      userId?: string
    ) => {
      groceryAgentMetrics.recordProductMatching(
        matchType,
        confidence,
        searchTime,
        searchTerm,
        category
      );

      structuredLogger.productMatching(
        searchTerm,
        matchType,
        confidence,
        searchTime,
        { userId: userId || null, data: { category: category || null } }
      );

      if (matchType === 'none') {
        sentryErrorTracker.captureError(
          new ProductMatchingError('No product matches found', {
            searchTerm,
            matchingAlgorithm: 'fuzzy_search',
            confidence,
          }),
          {
            userId,
            component: 'product_matcher',
            operation: 'product_matching',
          },
          'warning'
        );
      }
    },
  },

  // Price fetching monitoring
  priceFetching: {
    record: (
      productId: string,
      success: boolean,
      responseTime: number,
      storeId?: string,
      error?: Error,
      userId?: string
    ) => {
      groceryAgentMetrics.recordPriceFetch(
        success,
        responseTime,
        productId,
        storeId,
        error?.message
      );

      structuredLogger.priceFetching(
        productId,
        success,
        responseTime,
        storeId,
        { userId: userId || null, data: { error: error?.message || null } }
      );

      if (!success && error) {
        sentryErrorTracker.captureError(
          new PriceFetchError(error.message, {
            productId,
            storeId,
            responseStatus: 500, // Assuming error status
          }),
          {
            userId,
            component: 'price_fetcher',
            operation: 'price_fetching',
          },
          'error'
        );
      }
    },
  },

  // Deal detection monitoring
  dealDetection: {
    record: (
      productId: string,
      dealsFound: number,
      detectionTime: number,
      averageSavings: number,
      userId?: string
    ) => {
      groceryAgentMetrics.recordDealDetection(
        dealsFound,
        ['discount', 'coupon'], // Simplified deal types
        detectionTime,
        averageSavings
      );

      structuredLogger.dealDetection(productId, dealsFound, detectionTime, {
        userId: userId || null,
        data: { averageSavings },
      });
    },
  },
};

// Export all monitoring middleware and utilities
export {
  generateTraceId,
  generateRequestId,
};

export default {
  http: createHTTPMonitoringMiddleware,
  trpc: createTRPCMonitoringMiddleware,
  error: createErrorMonitoringMiddleware,
  websocket: createWebSocketMonitoring,
  database: createDatabaseMonitoring,
  grocery: groceryMonitoring,
};