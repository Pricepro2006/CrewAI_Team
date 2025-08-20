import * as Sentry from '@sentry/node';
// import { ProfilingIntegration } from '@sentry/profiling-node'; // Disabled - Node.js v22 compatibility
import { logger } from '../utils/logger.js';

export interface ErrorContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  traceId?: string;
  operation?: string;
  component?: string;
  dealId?: string;
  productId?: string;
  searchQuery?: string;
  priceRequest?: Record<string, any>;
}

export interface CustomMetrics {
  nlpParsingSuccess: number;
  productMatchingAccuracy: number;
  priceFetchSuccess: number;
  dealDetectionRate: number;
  userSessionDuration: number;
  webSocketConnectionStability: number;
}

export class SentryErrorTracker {
  private customMetrics: Map<string, number> = new Map();
  private criticalErrorCallbacks: Set<(error: Error, context?: ErrorContext) => void> = new Set();

  constructor() {
    this.initializeSentry();
    this.setupCustomTags();
    this.setupCustomMeasurements();
  }

  private initializeSentry(): void {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      logger.warn('Sentry DSN not configured. Error tracking will be limited.', 'SENTRY_TRACKER');
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '1.0.0',
      
      // Performance monitoring
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      // Profiling
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      
      integrations: [
        // new ProfilingIntegration(), // Disabled - Node.js v22 compatibility issue
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app: undefined }),
        new Sentry.Integrations.Postgres(),
        // new Sentry.Integrations.Winston({ winston: logger }), // Disabled - Winston integration not available in current Sentry version
      ],

      // Enhanced error filtering
      beforeSend: (event, hint) => {
        // Filter out noise
        if (this.shouldIgnoreError(hint.originalException)) {
          return null;
        }

        // Add custom context
        if (event.contexts) {
          event.contexts.grocery_agent = {
            feature: 'walmart_grocery',
            version: '1.1.0',
          };
        }

        return event;
      },

      // Custom fingerprinting for better grouping
      beforeSendTransaction(event) {
        // Add custom tags for transactions
        if (event.tags) {
          event.tags.feature = 'grocery_agent';
        }
        return event;
      },
    });

    logger.info('Sentry error tracking initialized', 'SENTRY_TRACKER', {
      environment: process.env.NODE_ENV,
      release: process.env.APP_VERSION,
    });
  }

  private shouldIgnoreError(error: any): boolean {
    if (!error) return false;

    const ignoredErrors = [
      'AbortError',
      'NetworkError',
      'TimeoutError',
      'Client disconnected',
      'Connection lost',
    ];

    return ignoredErrors.some(ignored => 
      error.name === ignored || 
      error.message?.includes(ignored)
    );
  }

  private setupCustomTags(): void {
    Sentry.setTag('service', 'grocery-agent');
    Sentry.setTag('component', 'walmart-integration');
  }

  private setupCustomMeasurements(): void {
    // Initialize custom metrics
    this.customMetrics.set('nlp_parsing_success_rate', 0);
    this.customMetrics.set('product_matching_accuracy', 0);
    this.customMetrics.set('price_fetch_success_rate', 0);
    this.customMetrics.set('deal_detection_effectiveness', 0);
    this.customMetrics.set('websocket_stability', 0);
  }

  // Main error tracking method
  captureError(
    error: Error,
    context?: ErrorContext,
    severity: 'info' | 'warning' | 'error' | 'fatal' = 'error',
    tags?: Record<string, string>
  ): string {
    return Sentry.withScope(scope => {
      // Set severity
      scope.setLevel(severity);

      // Add context
      if (context) {
        scope.setContext('error_context', {
          userId: context.userId,
          sessionId: context.sessionId,
          requestId: context.requestId,
          endpoint: context.endpoint,
          method: context.method,
          operation: context.operation,
          component: context.component,
          dealId: context.dealId,
          productId: context.productId,
          searchQuery: context.searchQuery,
        });

        // Set user context
        if (context.userId) {
          scope.setUser({ id: context.userId, ip_address: context.ip });
        }

        // Add fingerprinting for better grouping
        scope.setFingerprint([
          error.name,
          context.component || 'unknown',
          context.operation || 'unknown',
        ]);
      }

      // Add tags
      if (tags) {
        Object.entries(tags).forEach(([key, value]) => {
          scope.setTag(key, value);
        });
      }

      // Add breadcrumb
      scope.addBreadcrumb({
        message: `Error occurred in ${context?.component || 'unknown component'}`,
        category: 'error',
        level: 'error',
        data: {
          operation: context?.operation,
          endpoint: context?.endpoint,
        },
      });

      const eventId = Sentry.captureException(error);

      // Trigger critical error callbacks for immediate alerts
      if (severity === 'fatal') {
        this.criticalErrorCallbacks.forEach(callback => {
          try {
            callback(error, context);
          } catch (callbackError) {
            logger.error('Error in critical error callback', 'SENTRY_TRACKER', {
              error: callbackError,
            });
          }
        });
      }

      return eventId;
    });
  }

  // Track custom metrics
  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.customMetrics.set(name, value);

    // Send to Sentry as measurement
    Sentry.withScope(scope => {
      if (tags) {
        Object.entries(tags).forEach(([key, val]) => {
          scope.setTag(key, val);
        });
      }

      scope.setContext('custom_metrics', {
        [name]: value,
        timestamp: new Date().toISOString(),
      });

      Sentry.addBreadcrumb({
        message: `Custom metric recorded: ${name}`,
        category: 'metric',
        level: 'info',
        data: { name, value, tags },
      });
    });
  }

  // Track business metrics specific to grocery agent
  recordGroceryMetrics(metrics: Partial<CustomMetrics>): void {
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== undefined) {
        this.recordCustomMetric(`grocery_${key}`, value, { 
          component: 'grocery_agent',
          feature: 'walmart_integration' 
        });
      }
    });
  }

  // Performance monitoring
  startTransaction(name: string, operation: string, context?: ErrorContext): Sentry.Transaction {
    const transaction = Sentry.startTransaction({
      name,
      op: operation,
      tags: {
        component: context?.component || 'grocery_agent',
        endpoint: context?.endpoint,
        method: context?.method,
      },
      data: {
        userId: context?.userId,
        sessionId: context?.sessionId,
        dealId: context?.dealId,
        productId: context?.productId,
      },
    });

    return transaction;
  }

  // WebSocket monitoring
  trackWebSocketEvent(
    event: 'connect' | 'disconnect' | 'error' | 'message',
    context?: ErrorContext & { connectionId?: string; messageType?: string }
  ): void {
    Sentry.addBreadcrumb({
      message: `WebSocket ${event}`,
      category: 'websocket',
      level: event === 'error' ? 'error' : 'info',
      data: {
        event,
        connectionId: context?.connectionId,
        messageType: context?.messageType,
        userId: context?.userId,
      },
    });

    if (event === 'error') {
      this.recordCustomMetric('websocket_error_count', 1, {
        event,
        component: 'websocket',
      });
    }
  }

  // Database query monitoring
  trackDatabaseQuery(
    query: string,
    duration: number,
    success: boolean,
    context?: ErrorContext
  ): void {
    const span = Sentry.getCurrentHub().getScope()?.getTransaction()?.startChild({
      op: 'db.query',
      description: query.substring(0, 100) + '...',
      data: {
        duration,
        success,
        userId: context?.userId,
      },
    });

    if (span) {
      span.setStatus(success ? 'ok' : 'internal_error');
      span.finish();
    }

    // Track slow queries
    if (duration > 1000) {
      this.recordCustomMetric('slow_query_count', 1, {
        query_type: query.split(' ')[0]?.toLowerCase() || 'unknown',
        component: 'database',
      });
    }
  }

  // API response monitoring
  trackAPIResponse(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    context?: ErrorContext
  ): void {
    const transaction = this.startTransaction(
      `${method} ${endpoint}`,
      'http.server',
      context
    );

    transaction.setHttpStatus(statusCode);
    transaction.setData('response_time_ms', duration);
    
    if (statusCode >= 400) {
      transaction.setStatus('internal_error');
      this.recordCustomMetric('api_error_count', 1, {
        endpoint,
        method,
        status_code: statusCode.toString(),
      });
    }

    transaction.finish();
  }

  // Set user context
  setUser(userId: string, email?: string, username?: string): void {
    Sentry.setUser({
      id: userId,
      email,
      username,
    });
  }

  // Add breadcrumb for debugging
  addBreadcrumb(
    message: string,
    category: string,
    level: 'debug' | 'info' | 'warning' | 'error' = 'info',
    data?: Record<string, any>
  ): void {
    Sentry.addBreadcrumb({
      message,
      category,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  }

  // Register critical error callback
  onCriticalError(callback: (error: Error, context?: ErrorContext) => void): void {
    this.criticalErrorCallbacks.add(callback);
  }

  // Remove critical error callback
  offCriticalError(callback: (error: Error, context?: ErrorContext) => void): void {
    this.criticalErrorCallbacks.delete(callback);
  }

  // Get current metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.customMetrics);
  }

  // Flush events (useful for shutdown)
  async flush(timeout: number = 2000): Promise<boolean> {
    return Sentry.flush(timeout);
  }

  // Close Sentry client
  async close(): Promise<boolean> {
    await this.flush();
    return Sentry.close();
  }
}

// Singleton instance
export const sentryErrorTracker = new SentryErrorTracker();

// Graceful shutdown
process.once('SIGINT', async () => {
  await sentryErrorTracker.close();
});

process.once('SIGTERM', async () => {
  await sentryErrorTracker.close();
});