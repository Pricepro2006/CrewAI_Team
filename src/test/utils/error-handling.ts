/**
 * Error Handling Utilities for Integration Tests
 * Provides robust error handling for Ollama connectivity and test reliability
 */

import { logger } from '../../utils/logger';

export class OllamaTestError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'OllamaTestError';
  }
}

export class TestTimeoutError extends Error {
  constructor(operation: string, timeout: number) {
    super(`Test operation '${operation}' timed out after ${timeout}ms`);
    this.name = 'TestTimeoutError';
  }
}

export class ModelNotAvailableError extends Error {
  constructor(modelName: string) {
    super(`Required model '${modelName}' is not available for testing`);
    this.name = 'ModelNotAvailableError';
  }
}

/**
 * Retry utility for flaky operations
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  operationName?: string
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        logger.warn(
          `${operationName || 'Operation'} failed on attempt ${attempt}, retrying in ${delayMs}ms:`,
          error
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // Exponential backoff
      }
    }
  }
  
  throw new OllamaTestError(
    `${operationName || 'Operation'} failed after ${maxRetries} attempts`,
    'RETRY_EXHAUSTED',
    lastError
  );
}

/**
 * Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName?: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new TestTimeoutError(operationName || 'Unknown operation', timeoutMs));
    }, timeoutMs);
  });
  
  return Promise.race([operation, timeoutPromise]);
}

/**
 * Circuit breaker for Ollama operations
 */
export class OllamaCircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private maxFailures: number = 5,
    private resetTimeoutMs: number = 30000
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = 'half-open';
      } else {
        throw new OllamaTestError(
          'Ollama circuit breaker is open - too many recent failures',
          'CIRCUIT_BREAKER_OPEN'
        );
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'closed';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'open';
    }
  }
  
  getState(): string {
    return this.state;
  }
  
  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
}

// Global circuit breaker instance
export const ollamaCircuitBreaker = new OllamaCircuitBreaker();

/**
 * Health check for Ollama service
 */
export async function checkOllamaHealth(baseUrl: string): Promise<{
  isHealthy: boolean;
  latency?: number;
  models?: string[];
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    // Check basic connectivity
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return {
        isHealthy: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    const data = await response.json();
    const latency = Date.now() - startTime;
    
    return {
      isHealthy: true,
      latency,
      models: data.models?.map((m: any) => m.name) || [],
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Validate test environment before running tests
 */
export async function validateTestEnvironment(): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  
  // Check Ollama connectivity
  const healthCheck = await checkOllamaHealth(ollamaUrl);
  if (!healthCheck.isHealthy) {
    issues.push(`Ollama service is not healthy: ${healthCheck.error}`);
    recommendations.push('Start Ollama service: ollama serve');
  } else {
    if (healthCheck.latency! > 2000) {
      issues.push(`Ollama latency is high: ${healthCheck.latency}ms`);
      recommendations.push('Consider using a faster model or optimizing Ollama configuration');
    }
    
    if (!healthCheck.models || healthCheck.models.length === 0) {
      issues.push('No models available in Ollama');
      recommendations.push('Pull required models: npm run start:ollama test-setup');
    }
  }
  
  // Check environment variables
  const requiredEnvVars = ['NODE_ENV'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
    recommendations.push('Set required environment variables');
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

/**
 * Graceful error handler for test failures
 */
export function handleTestError(error: unknown, context?: string): never {
  let errorMessage = 'Unknown test error';
  let errorCode = 'UNKNOWN_ERROR';
  
  if (error instanceof OllamaTestError) {
    errorMessage = error.message;
    errorCode = error.code;
  } else if (error instanceof TestTimeoutError) {
    errorMessage = error.message;
    errorCode = 'TIMEOUT';
  } else if (error instanceof ModelNotAvailableError) {
    errorMessage = error.message;
    errorCode = 'MODEL_UNAVAILABLE';
  } else if (error instanceof Error) {
    errorMessage = error.message;
    
    // Classify common error types
    if (error.message.includes('ECONNREFUSED')) {
      errorCode = 'CONNECTION_REFUSED';
      errorMessage = 'Cannot connect to Ollama service. Ensure Ollama is running.';
    } else if (error.message.includes('timeout')) {
      errorCode = 'TIMEOUT';
    } else if (error.message.includes('fetch')) {
      errorCode = 'NETWORK_ERROR';
    }
  }
  
  const contextMessage = context ? ` (Context: ${context})` : '';
  logger.error(`Test failed with ${errorCode}: ${errorMessage}${contextMessage}`);
  
  throw new OllamaTestError(
    `${errorMessage}${contextMessage}`,
    errorCode,
    error instanceof Error ? error : undefined
  );
}

/**
 * Setup error handling for a test suite
 */
export function setupTestErrorHandling(): void {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

/**
 * Test reporter for error analytics
 */
export class TestErrorReporter {
  private errors: Array<{
    timestamp: Date;
    error: Error;
    context?: string;
    testName?: string;
  }> = [];
  
  reportError(error: Error, context?: string, testName?: string): void {
    this.errors.push({
      timestamp: new Date(),
      error,
      context,
      testName,
    });
  }
  
  getErrorSummary(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    recentErrors: any[];
  } {
    const errorsByType: Record<string, number> = {};
    
    this.errors.forEach(({ error }) => {
      const type = error.constructor.name;
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });
    
    return {
      totalErrors: this.errors.length,
      errorsByType,
      recentErrors: this.errors.slice(-5),
    };
  }
  
  clear(): void {
    this.errors = [];
  }
}

// Global error reporter instance
export const testErrorReporter = new TestErrorReporter();