/**
 * Custom Error Classes for Grocery List Feature
 * Provides structured error handling with specific error types
 */

export class BaseGroceryError extends Error {
  public readonly code: string;
  public readonly component: string;
  public readonly severity: 'low' | 'medium' | 'high' | 'critical';
  public readonly context: Record<string, any>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    message: string,
    code: string,
    component: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    context: Record<string, any> = {},
    retryable: boolean = false
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.component = component;
    this.severity = severity;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;

    // Ensure proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}

// === NLP and Parsing Errors ===

export class NLPParsingError extends BaseGroceryError {
  constructor(
    message: string,
    context: { query?: string; expectedFormat?: string; actualFormat?: string } = {}
  ) {
    super(
      message,
      'NLP_PARSING_ERROR',
      'nlp_processor',
      'medium',
      context,
      true
    );
  }
}

export class QueryUnderstandingError extends BaseGroceryError {
  constructor(
    message: string,
    context: { query?: string; confidence?: number; alternatives?: string[] } = {}
  ) {
    super(
      message,
      'QUERY_UNDERSTANDING_ERROR',
      'query_processor',
      'medium',
      context,
      true
    );
  }
}

export class IntentExtractionError extends BaseGroceryError {
  constructor(
    message: string,
    context: { query?: string; extractedIntents?: string[]; expectedIntent?: string } = {}
  ) {
    super(
      message,
      'INTENT_EXTRACTION_ERROR',
      'intent_extractor',
      'medium',
      context,
      true
    );
  }
}

// === Product Matching Errors ===

export class ProductMatchingError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      searchTerm?: string; 
      matchingAlgorithm?: string; 
      confidence?: number; 
      candidateCount?: number;
    } = {}
  ) {
    super(
      message,
      'PRODUCT_MATCHING_ERROR',
      'product_matcher',
      'high',
      context,
      true
    );
  }
}

export class ProductNotFoundError extends BaseGroceryError {
  constructor(
    message: string,
    context: { searchTerm?: string; category?: string; filters?: Record<string, any> } = {}
  ) {
    super(
      message,
      'PRODUCT_NOT_FOUND',
      'product_search',
      'low',
      context,
      false
    );
  }
}

export class ProductAmbiguityError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      searchTerm?: string; 
      matches?: Array<{ id: string; name: string; confidence: number }>; 
      threshold?: number;
    } = {}
  ) {
    super(
      message,
      'PRODUCT_AMBIGUITY_ERROR',
      'product_matcher',
      'medium',
      context,
      false
    );
  }
}

// === Price Fetching Errors ===

export class PriceFetchError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      productId?: string; 
      storeId?: string; 
      zipCode?: string; 
      apiEndpoint?: string;
      responseStatus?: number;
    } = {}
  ) {
    super(
      message,
      'PRICE_FETCH_ERROR',
      'price_fetcher',
      'high',
      context,
      true
    );
  }
}

export class PriceUnavailableError extends BaseGroceryError {
  constructor(
    message: string,
    context: { productId?: string; storeId?: string; reason?: string } = {}
  ) {
    super(
      message,
      'PRICE_UNAVAILABLE',
      'price_fetcher',
      'medium',
      context,
      false
    );
  }
}

export class StoreLocationError extends BaseGroceryError {
  constructor(
    message: string,
    context: { zipCode?: string; address?: string; storeId?: string } = {}
  ) {
    super(
      message,
      'STORE_LOCATION_ERROR',
      'store_locator',
      'medium',
      context,
      true
    );
  }
}

// === Deal Detection Errors ===

export class DealDetectionError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      productId?: string; 
      dealTypes?: string[]; 
      algorithms?: string[];
      confidence?: number;
    } = {}
  ) {
    super(
      message,
      'DEAL_DETECTION_ERROR',
      'deal_detector',
      'medium',
      context,
      true
    );
  }
}

export class DealValidationError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      dealId?: string; 
      productId?: string; 
      validationRules?: string[];
      failedRules?: string[];
    } = {}
  ) {
    super(
      message,
      'DEAL_VALIDATION_ERROR',
      'deal_validator',
      'high',
      context,
      false
    );
  }
}

// === Database Errors ===

export class DatabaseConnectionError extends BaseGroceryError {
  constructor(
    message: string,
    context: { database?: string; operation?: string; connectionPool?: string } = {}
  ) {
    super(
      message,
      'DATABASE_CONNECTION_ERROR',
      'database',
      'critical',
      context,
      true
    );
  }
}

export class DatabaseQueryError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      query?: string; 
      table?: string; 
      operation?: string;
      duration?: number;
      parameters?: Record<string, any>;
    } = {}
  ) {
    super(
      message,
      'DATABASE_QUERY_ERROR',
      'database',
      'high',
      context,
      true
    );
  }
}

export class DataIntegrityError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      table?: string; 
      recordId?: string; 
      constraint?: string;
      expectedValue?: any;
      actualValue?: any;
    } = {}
  ) {
    super(
      message,
      'DATA_INTEGRITY_ERROR',
      'database',
      'high',
      context,
      false
    );
  }
}

// === API Integration Errors ===

export class WalmartAPIError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      endpoint?: string; 
      method?: string; 
      statusCode?: number;
      responseBody?: any;
      requestId?: string;
    } = {}
  ) {
    super(
      message,
      'WALMART_API_ERROR',
      'walmart_api',
      'high',
      context,
      true
    );
  }
}

export class RateLimitError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      service?: string; 
      limit?: number; 
      resetTime?: Date;
      currentUsage?: number;
    } = {}
  ) {
    super(
      message,
      'RATE_LIMIT_ERROR',
      'rate_limiter',
      'medium',
      context,
      true
    );
  }
}

export class AuthenticationError extends BaseGroceryError {
  constructor(
    message: string,
    context: { service?: string; tokenType?: string; expiresAt?: Date } = {}
  ) {
    super(
      message,
      'AUTHENTICATION_ERROR',
      'auth',
      'critical',
      context,
      true
    );
  }
}

// === WebSocket Errors ===

export class WebSocketConnectionError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      connectionId?: string; 
      userId?: string; 
      reason?: string;
      reconnectAttempt?: number;
    } = {}
  ) {
    super(
      message,
      'WEBSOCKET_CONNECTION_ERROR',
      'websocket',
      'high',
      context,
      true
    );
  }
}

export class WebSocketMessageError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      connectionId?: string; 
      messageType?: string; 
      messageId?: string;
      payload?: any;
    } = {}
  ) {
    super(
      message,
      'WEBSOCKET_MESSAGE_ERROR',
      'websocket',
      'medium',
      context,
      false
    );
  }
}

// === Memory and Performance Errors ===

export class MemoryLimitError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      memoryUsage?: number; 
      memoryLimit?: number; 
      operation?: string;
      heapUsed?: number;
    } = {}
  ) {
    super(
      message,
      'MEMORY_LIMIT_ERROR',
      'performance',
      'critical',
      context,
      false
    );
  }
}

export class PerformanceThresholdError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      operation?: string; 
      duration?: number; 
      threshold?: number;
      expectedDuration?: number;
    } = {}
  ) {
    super(
      message,
      'PERFORMANCE_THRESHOLD_ERROR',
      'performance',
      'medium',
      context,
      false
    );
  }
}

// === Configuration and Validation Errors ===

export class ConfigurationError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      configKey?: string; 
      expectedType?: string; 
      actualValue?: any;
      source?: string;
    } = {}
  ) {
    super(
      message,
      'CONFIGURATION_ERROR',
      'config',
      'critical',
      context,
      false
    );
  }
}

export class ValidationError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      field?: string; 
      value?: any; 
      expectedFormat?: string;
      validationRule?: string;
    } = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      'validator',
      'medium',
      context,
      false
    );
  }
}

// === Business Logic Errors ===

export class BusinessLogicError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      rule?: string; 
      expectedState?: string; 
      actualState?: string;
      userId?: string;
    } = {}
  ) {
    super(
      message,
      'BUSINESS_LOGIC_ERROR',
      'business_logic',
      'high',
      context,
      false
    );
  }
}

export class UserSessionError extends BaseGroceryError {
  constructor(
    message: string,
    context: { 
      sessionId?: string; 
      userId?: string; 
      operation?: string;
      sessionState?: string;
    } = {}
  ) {
    super(
      message,
      'USER_SESSION_ERROR',
      'session_manager',
      'medium',
      context,
      true
    );
  }
}

// === Utility Functions ===

export function isRetryableError(error: Error): boolean {
  return error instanceof BaseGroceryError && error.retryable;
}

export function getErrorSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
  return error instanceof BaseGroceryError ? error.severity : 'medium';
}

export function getErrorComponent(error: Error): string {
  return error instanceof BaseGroceryError ? error.component : 'unknown';
}

export function getErrorCode(error: Error): string {
  return error instanceof BaseGroceryError ? error.code : 'UNKNOWN_ERROR';
}

export function createErrorFromCode(
  code: string,
  message: string,
  context: Record<string, any> = {}
): BaseGroceryError {
  // Map error codes to appropriate error classes
  const errorClasses: Record<string, typeof BaseGroceryError> = {
    'NLP_PARSING_ERROR': NLPParsingError,
    'QUERY_UNDERSTANDING_ERROR': QueryUnderstandingError,
    'INTENT_EXTRACTION_ERROR': IntentExtractionError,
    'PRODUCT_MATCHING_ERROR': ProductMatchingError,
    'PRODUCT_NOT_FOUND': ProductNotFoundError,
    'PRODUCT_AMBIGUITY_ERROR': ProductAmbiguityError,
    'PRICE_FETCH_ERROR': PriceFetchError,
    'PRICE_UNAVAILABLE': PriceUnavailableError,
    'STORE_LOCATION_ERROR': StoreLocationError,
    'DEAL_DETECTION_ERROR': DealDetectionError,
    'DEAL_VALIDATION_ERROR': DealValidationError,
    'DATABASE_CONNECTION_ERROR': DatabaseConnectionError,
    'DATABASE_QUERY_ERROR': DatabaseQueryError,
    'DATA_INTEGRITY_ERROR': DataIntegrityError,
    'WALMART_API_ERROR': WalmartAPIError,
    'RATE_LIMIT_ERROR': RateLimitError,
    'AUTHENTICATION_ERROR': AuthenticationError,
    'WEBSOCKET_CONNECTION_ERROR': WebSocketConnectionError,
    'WEBSOCKET_MESSAGE_ERROR': WebSocketMessageError,
    'MEMORY_LIMIT_ERROR': MemoryLimitError,
    'PERFORMANCE_THRESHOLD_ERROR': PerformanceThresholdError,
    'CONFIGURATION_ERROR': ConfigurationError,
    'VALIDATION_ERROR': ValidationError,
    'BUSINESS_LOGIC_ERROR': BusinessLogicError,
    'USER_SESSION_ERROR': UserSessionError,
  };

  const ErrorClass = errorClasses[code] || BaseGroceryError;
  return new ErrorClass(message, context);
}

// Export all error types
export const GroceryErrorTypes = {
  BaseGroceryError,
  NLPParsingError,
  QueryUnderstandingError,
  IntentExtractionError,
  ProductMatchingError,
  ProductNotFoundError,
  ProductAmbiguityError,
  PriceFetchError,
  PriceUnavailableError,
  StoreLocationError,
  DealDetectionError,
  DealValidationError,
  DatabaseConnectionError,
  DatabaseQueryError,
  DataIntegrityError,
  WalmartAPIError,
  RateLimitError,
  AuthenticationError,
  WebSocketConnectionError,
  WebSocketMessageError,
  MemoryLimitError,
  PerformanceThresholdError,
  ConfigurationError,
  ValidationError,
  BusinessLogicError,
  UserSessionError,
};