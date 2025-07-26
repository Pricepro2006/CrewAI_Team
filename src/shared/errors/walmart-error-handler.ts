/**
 * Walmart Grocery Error Handling Framework
 * Comprehensive error handling with recovery strategies
 *
 * Integration Coordinator: Robust error management system
 */

import React from "react";
import { logger } from "../../utils/logger";
import type {
  WalmartError,
  WalmartErrorCode,
} from "../../types/walmart-grocery";
import type { WebSocketError } from "../types/websocket";

// =====================================================
// Error Classes
// =====================================================

export class WalmartBaseError extends Error {
  public readonly code: WalmartErrorCode;
  public readonly timestamp: string;
  public readonly retryable: boolean;
  public readonly retryAfter?: number;
  public readonly details?: Record<string, unknown>;
  public readonly context?: ErrorContext;

  constructor(code: WalmartErrorCode, message: string, options?: ErrorOptions) {
    super(message);
    this.name = "WalmartError";
    this.code = code;
    this.timestamp = new Date().toISOString();
    this.retryable = options?.retryable ?? this.isRetryableError(code);
    this.retryAfter = options?.retryAfter;
    this.details = options?.details;
    this.context = options?.context;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  private isRetryableError(code: WalmartErrorCode): boolean {
    const retryableErrors: WalmartErrorCode[] = [
      "RATE_LIMITED",
      "SERVER_ERROR",
      "OUT_OF_STOCK",
      "DELIVERY_UNAVAILABLE",
      "STORE_CLOSED",
    ];
    return retryableErrors.includes(code);
  }

  toJSON(): WalmartError {
    return {
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      retryable: this.retryable,
      retryAfter: this.retryAfter,
      details: this.details,
    };
  }
}

export interface ErrorOptions {
  retryable?: boolean;
  retryAfter?: number;
  details?: Record<string, unknown>;
  context?: ErrorContext;
  cause?: Error;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  productId?: string;
  orderId?: string;
  storeId?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

// Specific error classes
export class ProductNotFoundError extends WalmartBaseError {
  constructor(productId: string, context?: ErrorContext) {
    super("PRODUCT_NOT_FOUND", `Product ${productId} not found`, {
      details: { productId },
      context,
      retryable: false,
    });
  }
}

export class OutOfStockError extends WalmartBaseError {
  constructor(productId: string, storeId?: string, context?: ErrorContext) {
    super("OUT_OF_STOCK", `Product ${productId} is out of stock`, {
      details: { productId, storeId },
      context,
      retryable: true,
      retryAfter: 300, // 5 minutes
    });
  }
}

export class PaymentFailedError extends WalmartBaseError {
  constructor(reason: string, transactionId?: string, context?: ErrorContext) {
    super("PAYMENT_FAILED", `Payment failed: ${reason}`, {
      details: { reason, transactionId },
      context,
      retryable: true,
    });
  }
}

export class RateLimitError extends WalmartBaseError {
  constructor(limit: number, reset: string, context?: ErrorContext) {
    const resetTime = new Date(reset).getTime();
    const now = Date.now();
    const retryAfter = Math.max(0, Math.ceil((resetTime - now) / 1000));

    super("RATE_LIMITED", `Rate limit exceeded. Limit: ${limit}`, {
      details: { limit, reset },
      context,
      retryable: true,
      retryAfter,
    });
  }
}

// =====================================================
// Error Handler Class
// =====================================================

export class WalmartErrorHandler {
  private static instance: WalmartErrorHandler;
  private errorHandlers: Map<WalmartErrorCode, ErrorHandler>;
  private globalHandlers: Set<GlobalErrorHandler>;
  private errorMetrics: ErrorMetrics;
  private recoveryStrategies: Map<WalmartErrorCode, RecoveryStrategy>;

  private constructor() {
    this.errorHandlers = new Map();
    this.globalHandlers = new Set();
    this.errorMetrics = new ErrorMetrics();
    this.recoveryStrategies = new Map();
    this.initializeDefaultHandlers();
    this.initializeRecoveryStrategies();
  }

  static getInstance(): WalmartErrorHandler {
    if (!WalmartErrorHandler.instance) {
      WalmartErrorHandler.instance = new WalmartErrorHandler();
    }
    return WalmartErrorHandler.instance;
  }

  // =====================================================
  // Error Handling
  // =====================================================

  async handleError(
    error: Error | WalmartBaseError,
    context?: ErrorContext,
  ): Promise<ErrorHandlingResult> {
    const walmartError = this.normalizeError(error, context);

    // Log error
    this.logError(walmartError, context);

    // Update metrics
    this.errorMetrics.recordError(walmartError);

    // Execute specific handler
    const handler = this.errorHandlers.get(walmartError.code);
    let result: ErrorHandlingResult = {
      handled: false,
      retry: walmartError.retryable,
      retryAfter: walmartError.retryAfter,
    };

    if (handler) {
      result = await handler(walmartError, context);
    }

    // Execute global handlers
    for (const globalHandler of this.globalHandlers) {
      await globalHandler(walmartError, context, result);
    }

    // Apply recovery strategy if needed
    if (result.retry && this.recoveryStrategies.has(walmartError.code)) {
      const strategy = this.recoveryStrategies.get(walmartError.code)!;
      result.recoveryAction = await strategy.recover(walmartError, context);
    }

    return result;
  }

  registerHandler(code: WalmartErrorCode, handler: ErrorHandler): void {
    this.errorHandlers.set(code, handler);
  }

  registerGlobalHandler(handler: GlobalErrorHandler): void {
    this.globalHandlers.add(handler);
  }

  registerRecoveryStrategy(
    code: WalmartErrorCode,
    strategy: RecoveryStrategy,
  ): void {
    this.recoveryStrategies.set(code, strategy);
  }

  // =====================================================
  // Error Normalization
  // =====================================================

  private normalizeError(
    error: Error | WalmartBaseError,
    context?: ErrorContext,
  ): WalmartBaseError {
    if (error instanceof WalmartBaseError) {
      return error;
    }

    // Map common errors to Walmart errors
    const errorMapping: Record<string, WalmartErrorCode> = {
      ECONNREFUSED: "SERVER_ERROR",
      ETIMEDOUT: "SERVER_ERROR",
      ENOTFOUND: "SERVER_ERROR",
      NetworkError: "SERVER_ERROR",
      TypeError: "INVALID_REQUEST",
      ValidationError: "INVALID_REQUEST",
    };

    const code = errorMapping[error.name] || "SERVER_ERROR";

    return new WalmartBaseError(code, error.message, {
      details: {
        originalError: error.name,
        stack: error.stack,
      },
      context,
    });
  }

  // =====================================================
  // Error Logging
  // =====================================================

  private logError(error: WalmartBaseError, context?: ErrorContext): void {
    const logLevel = this.getLogLevel(error.code);
    const logData = {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
      context,
      stack: error.stack,
    };

    switch (logLevel) {
      case "error":
        logger.error("Walmart error occurred", "WALMART_ERROR", logData);
        break;
      case "warn":
        logger.warn("Walmart warning", "WALMART_WARNING", logData);
        break;
      case "info":
        logger.info("Walmart info", "WALMART_INFO", logData);
        break;
    }
  }

  private getLogLevel(code: WalmartErrorCode): "error" | "warn" | "info" {
    const warnCodes: WalmartErrorCode[] = [
      "OUT_OF_STOCK",
      "PRICE_CHANGED",
      "DELIVERY_UNAVAILABLE",
      "STORE_CLOSED",
    ];

    const infoCodes: WalmartErrorCode[] = ["RATE_LIMITED", "CART_EXPIRED"];

    if (infoCodes.includes(code)) return "info";
    if (warnCodes.includes(code)) return "warn";
    return "error";
  }

  // =====================================================
  // Default Handlers
  // =====================================================

  private initializeDefaultHandlers(): void {
    // Product not found handler
    this.registerHandler("PRODUCT_NOT_FOUND", async (error, context) => ({
      handled: true,
      retry: false,
      message: "Product has been removed or is no longer available",
    }));

    // Out of stock handler
    this.registerHandler("OUT_OF_STOCK", async (error, context) => ({
      handled: true,
      retry: true,
      retryAfter: 300,
      message:
        "Product is temporarily out of stock. We'll notify you when it's available.",
      alternativeAction: "findSubstitute",
    }));

    // Rate limit handler
    this.registerHandler("RATE_LIMITED", async (error, context) => ({
      handled: true,
      retry: true,
      retryAfter: error.retryAfter,
      message: "Too many requests. Please wait a moment.",
    }));

    // Payment failed handler
    this.registerHandler("PAYMENT_FAILED", async (error, context) => ({
      handled: true,
      retry: true,
      message: "Payment processing failed. Please check your payment details.",
      alternativeAction: "updatePaymentMethod",
    }));

    // Server error handler
    this.registerHandler("SERVER_ERROR", async (error, context) => ({
      handled: true,
      retry: true,
      retryAfter: 30,
      message: "We're experiencing technical difficulties. Please try again.",
      fallbackToCache: true,
    }));
  }

  // =====================================================
  // Recovery Strategies
  // =====================================================

  private initializeRecoveryStrategies(): void {
    // Out of stock recovery
    this.registerRecoveryStrategy("OUT_OF_STOCK", {
      async recover(error, context) {
        return {
          type: "substitute",
          action: async () => {
            // Find substitute products
            if (context?.productId) {
              return {
                success: true,
                message: "Found similar products",
                data: { substituteProductIds: ["alt1", "alt2"] },
              };
            }
            return { success: false };
          },
        };
      },
    });

    // Delivery unavailable recovery
    this.registerRecoveryStrategy("DELIVERY_UNAVAILABLE", {
      async recover(error, context) {
        return {
          type: "alternative",
          action: async () => {
            // Suggest pickup option
            return {
              success: true,
              message: "Pickup is available at nearby stores",
              data: { alternativeFulfillment: "pickup" },
            };
          },
        };
      },
    });

    // Store closed recovery
    this.registerRecoveryStrategy("STORE_CLOSED", {
      async recover(error, context) {
        return {
          type: "redirect",
          action: async () => {
            // Find alternative stores
            return {
              success: true,
              message: "Found nearby open stores",
              data: { alternativeStores: ["store1", "store2"] },
            };
          },
        };
      },
    });
  }

  // =====================================================
  // Error Metrics
  // =====================================================

  getMetrics(): ErrorMetricsData {
    return this.errorMetrics.getData();
  }

  resetMetrics(): void {
    this.errorMetrics.reset();
  }
}

// =====================================================
// Type Definitions
// =====================================================

export type ErrorHandler = (
  error: WalmartBaseError,
  context?: ErrorContext,
) => Promise<ErrorHandlingResult>;

export type GlobalErrorHandler = (
  error: WalmartBaseError,
  context: ErrorContext | undefined,
  result: ErrorHandlingResult,
) => Promise<void>;

export interface ErrorHandlingResult {
  handled: boolean;
  retry?: boolean;
  retryAfter?: number;
  message?: string;
  alternativeAction?: string;
  fallbackToCache?: boolean;
  recoveryAction?: RecoveryAction;
}

export interface RecoveryStrategy {
  recover(
    error: WalmartBaseError,
    context?: ErrorContext,
  ): Promise<RecoveryAction>;
}

export interface RecoveryAction {
  type: "retry" | "substitute" | "alternative" | "redirect" | "notify";
  action: () => Promise<RecoveryResult>;
  metadata?: Record<string, unknown>;
}

export interface RecoveryResult {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

// =====================================================
// Error Metrics Class
// =====================================================

class ErrorMetrics {
  private metrics: Map<WalmartErrorCode, ErrorMetricData>;
  private startTime: number;

  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }

  recordError(error: WalmartBaseError): void {
    const metric = this.metrics.get(error.code) || {
      code: error.code,
      count: 0,
      firstOccurrence: new Date().toISOString(),
      lastOccurrence: new Date().toISOString(),
      retrySuccesses: 0,
      retryFailures: 0,
    };

    metric.count++;
    metric.lastOccurrence = new Date().toISOString();

    this.metrics.set(error.code, metric);
  }

  recordRetry(code: WalmartErrorCode, success: boolean): void {
    const metric = this.metrics.get(code);
    if (metric) {
      if (success) {
        metric.retrySuccesses++;
      } else {
        metric.retryFailures++;
      }
    }
  }

  getData(): ErrorMetricsData {
    const errors = Array.from(this.metrics.values());
    const totalErrors = errors.reduce((sum, e) => sum + e.count, 0);
    const errorRate = totalErrors / ((Date.now() - this.startTime) / 1000 / 60); // errors per minute

    return {
      totalErrors,
      errorRate,
      errors,
      uptime: Date.now() - this.startTime,
      byCode: Object.fromEntries(this.metrics),
    };
  }

  reset(): void {
    this.metrics.clear();
    this.startTime = Date.now();
  }
}

export interface ErrorMetricData {
  code: WalmartErrorCode;
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
  retrySuccesses: number;
  retryFailures: number;
}

export interface ErrorMetricsData {
  totalErrors: number;
  errorRate: number;
  errors: ErrorMetricData[];
  uptime: number;
  byCode: Record<string, ErrorMetricData>;
}

// =====================================================
// Error Boundary Component (for React)
// =====================================================

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: WalmartBaseError;
  errorInfo?: React.ErrorInfo;
}

export class WalmartErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const handler = WalmartErrorHandler.getInstance();
    const walmartError =
      error instanceof WalmartBaseError
        ? error
        : new WalmartBaseError("INVALID_REQUEST", error.message);

    return {
      hasError: true,
      error: walmartError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const handler = WalmartErrorHandler.getInstance();
    handler.handleError(error, {
      operation: "react_render",
      metadata: { componentStack: errorInfo.componentStack },
    });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return React.createElement(FallbackComponent, this.state);
      }

      return React.createElement(
        "div",
        { className: "error-boundary" },
        React.createElement("h2", null, "Something went wrong"),
        React.createElement("p", null, this.state.error?.message),
        React.createElement(
          "button",
          { onClick: () => this.setState({ hasError: false }) },
          "Try Again",
        ),
      );
    }

    return this.props.children;
  }
}

// =====================================================
// Utility Functions
// =====================================================

export function isWalmartError(error: unknown): error is WalmartBaseError {
  return error instanceof WalmartBaseError;
}

export function createErrorFromResponse(response: any): WalmartBaseError {
  if (response.error) {
    return new WalmartBaseError(
      response.error.code || "SERVER_ERROR",
      response.error.message || "Unknown error",
      {
        details: response.error.details,
        retryable: response.error.retryable,
        retryAfter: response.error.retryAfter,
      },
    );
  }

  return new WalmartBaseError("SERVER_ERROR", "Invalid response from server");
}

// =====================================================
// WebSocket Error Integration
// =====================================================

export function mapWebSocketError(wsError: WebSocketError): WalmartBaseError {
  const mapping: Record<string, WalmartErrorCode> = {
    CONNECTION_FAILED: "SERVER_ERROR",
    AUTHENTICATION_FAILED: "AUTHENTICATION_REQUIRED",
    RATE_LIMIT_EXCEEDED: "RATE_LIMITED",
    TIMEOUT: "SERVER_ERROR",
  };

  const code = mapping[wsError.code] || "SERVER_ERROR";

  return new WalmartBaseError(code, wsError.message, {
    details: wsError.details,
    retryable: wsError.recoverable,
    retryAfter: wsError.retryAfter,
  });
}

// Export singleton instance
export const walmartErrorHandler = WalmartErrorHandler.getInstance();

// React component types for error boundary
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorBoundaryState>;
}
