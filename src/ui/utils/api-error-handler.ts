/**
 * API Error Handler - Provides graceful degradation for missing endpoints
 */

import { logger } from "../../utils/logger.js";

export interface APIError {
  message: string;
  code?: string | number;
  status?: number;
  endpoint?: string;
}

export interface ErrorHandlerOptions {
  fallbackData?: any;
  logLevel?: 'error' | 'warn' | 'info';
  showToUser?: boolean;
  retryable?: boolean;
}

/**
 * Categorizes API errors and provides appropriate handling
 */
export function categorizeAPIError(error: any): {
  category: 'missing_endpoint' | 'permission_denied' | 'network_error' | 'server_error' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
} {
  const message = error?.message?.toLowerCase() || '';
  const status = error?.status || error?.code;

  // Missing endpoint (404, or specific error messages)
  if (status === 404 || message.includes('not found') || message.includes('no such endpoint')) {
    return {
      category: 'missing_endpoint',
      severity: 'low',
      retryable: false
    };
  }

  // Permission denied (401, 403, or authorization errors)
  if (status === 401 || status === 403 || 
      message.includes('unauthorized') || 
      message.includes('forbidden') || 
      message.includes('permission') ||
      message.includes('admin access required')) {
    return {
      category: 'permission_denied',
      severity: 'medium',
      retryable: false
    };
  }

  // Network errors (connection issues, timeouts)
  if (message.includes('network') || 
      message.includes('timeout') || 
      message.includes('connection') ||
      message.includes('fetch')) {
    return {
      category: 'network_error',
      severity: 'medium',
      retryable: true
    };
  }

  // Server errors (5xx)
  if (status >= 500 && status < 600) {
    return {
      category: 'server_error',
      severity: 'high',
      retryable: true
    };
  }

  // Unknown error
  return {
    category: 'unknown',
    severity: 'medium',
    retryable: false
  };
}

/**
 * Provides user-friendly error messages
 */
export function getUserFriendlyErrorMessage(error: any, endpoint?: string): string {
  const { category } = categorizeAPIError(error);

  switch (category) {
    case 'missing_endpoint':
      return `This feature is not yet available. ${endpoint ? `(${endpoint})` : ''}`;
    
    case 'permission_denied':
      return 'You do not have permission to access this feature. Please contact an administrator.';
    
    case 'network_error':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    
    case 'server_error':
      return 'The server is experiencing issues. Please try again in a few moments.';
    
    default:
      return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
  }
}

/**
 * Creates appropriate fallback data based on the endpoint
 */
export function createFallbackData(endpoint: string): any {
  const endpointLower = endpoint.toLowerCase();

  if (endpointLower.includes('health') || endpointLower.includes('status')) {
    return {
      status: 'unknown',
      message: 'Health check unavailable',
      services: {
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      }
    };
  }

  if (endpointLower.includes('agent')) {
    return {
      agents: [],
      totalAgents: 0,
      activeAgents: 0
    };
  }

  if (endpointLower.includes('chat') || endpointLower.includes('conversation')) {
    return {
      totalMessages: 0,
      totalConversations: 0,
      recentConversations: []
    };
  }

  if (endpointLower.includes('rag') || endpointLower.includes('document')) {
    return {
      totalDocuments: 0,
      documentCount: 0,
      totalChunks: 0,
      chunksCount: 0
    };
  }

  if (endpointLower.includes('email')) {
    return {
      data: null,
      summary: {
        totalEmailsAnalyzed: 0,
        totalBusinessValue: 0,
        uniqueCustomerCount: 0,
        uniquePOCount: 0,
        uniqueQuoteCount: 0,
        highPriorityRate: 0,
        avgConfidenceScore: 0
      },
      workflowDistribution: [],
      priorityDistribution: [],
      topCustomers: [],
      entityExtracts: {
        recentHighValueItems: [],
        poNumbers: [],
        quoteNumbers: []
      }
    };
  }

  if (endpointLower.includes('metrics') || endpointLower.includes('monitoring')) {
    return {
      metrics: {},
      system: {
        cpu: { usage: 0, loadAverage: {} },
        memory: { usage: 0, used: 0, total: 0 },
        process: { pid: null, uptime: 0, memory: {} }
      }
    };
  }

  // Generic fallback
  return {
    data: null,
    error: 'Service unavailable',
    fallback: true
  };
}

/**
 * Main error handler function
 */
export function handleAPIError(
  error: any, 
  endpoint: string, 
  options: ErrorHandlerOptions = {}
): {
  shouldShowError: boolean;
  userMessage: string;
  fallbackData: any;
  logEntry: {
    level: 'error' | 'warn' | 'info';
    message: string;
    context: any;
  };
} {
  const {
    fallbackData: customFallbackData,
    logLevel = 'warn',
    showToUser = true,
    retryable
  } = options;

  const errorInfo = categorizeAPIError(error);
  const userMessage = getUserFriendlyErrorMessage(error, endpoint);
  const fallbackData = customFallbackData || createFallbackData(endpoint);

  // Determine if we should show this error to the user
  const shouldShowError = showToUser && errorInfo.severity !== 'low';

  // Create log entry
  const logEntry = {
    level: errorInfo.severity === 'critical' ? 'error' as const : logLevel,
    message: `API Error on ${endpoint}: ${error.message}`,
    context: {
      endpoint,
      category: errorInfo.category,
      severity: errorInfo.severity,
      retryable: errorInfo.retryable,
      status: error?.status,
      code: error?.code,
      originalError: error
    }
  };

  // Log the error
  logger[logEntry.level](logEntry.message, 'API_ERROR_HANDLER', logEntry.context);

  return {
    shouldShowError,
    userMessage,
    fallbackData,
    logEntry
  };
}

/**
 * Hook-friendly error handler that can be used in React Query error callbacks
 */
export function createQueryErrorHandler(endpoint: string, options?: ErrorHandlerOptions) {
  return (error: any) => {
    return handleAPIError(error, endpoint, options);
  };
}

/**
 * Creates a safe query configuration with error handling
 */
export function createSafeQueryConfig(endpoint: string, options?: ErrorHandlerOptions) {
  return {
    retry: (failureCount: number, error: any) => {
      const errorInfo = categorizeAPIError(error);
      
      // Don't retry if not retryable or if we've already tried multiple times
      if (!errorInfo.retryable || failureCount >= 2) {
        return false;
      }
      
      return true;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 30000, // 30 seconds
    cacheTime: 300000, // 5 minutes
    onError: (error: any) => {
      const result = handleAPIError(error, endpoint, options);
      
      // You could dispatch to a global error state here if needed
      if (result.shouldShowError) {
        // Could show toast notification here
        console.warn(`User-facing error: ${result.userMessage}`);
      }
      
      return result.fallbackData;
    }
  };
}