import { logger } from '../logger';

export interface AsyncErrorOptions {
  fallbackValue?: any;
  retries?: number;
  retryDelay?: number;
  onError?: (error: Error) => void;
  context?: string;
  critical?: boolean;
}

/**
 * Wraps an async function with error handling, retries, and logging
 */
export function withAsyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: AsyncErrorOptions = {}
): T {
  const {
    fallbackValue,
    retries = 0,
    retryDelay = 1000,
    onError,
    context = fn.name || 'anonymous',
    critical = false,
  } = options;

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await fn(...args);
        
        // If we had retries and succeeded, log it
        if (attempt > 0) {
          logger.info(`${context}: Succeeded after ${attempt} retries`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.error(`${context}: Error on attempt ${attempt + 1}/${retries + 1}`, {
          error: lastError.message,
          stack: lastError.stack,
          args: args.length > 0 ? args : undefined,
          attempt,
        });
        
        // Call custom error handler if provided
        if (onError) {
          try {
            onError(lastError);
          } catch (handlerError) {
            logger.error(`${context}: Error handler threw`, handlerError);
          }
        }
        
        // If this was the last attempt, handle based on criticality
        if (attempt === retries) {
          if (critical) {
            throw lastError;
          } else if (fallbackValue !== undefined) {
            logger.warn(`${context}: Returning fallback value after all retries failed`);
            return fallbackValue;
          } else {
            throw lastError;
          }
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
      }
    }
    
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error(`${context}: Unexpected error state`);
  }) as T;
}

/**
 * Execute an async operation with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError = 'Operation timed out'
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutError)), timeoutMs);
  });
  
  return Promise.race([promise, timeout]);
}

/**
 * Circuit breaker pattern for external service calls
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly halfOpenRetries: number = 3
  ) {}
  
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => T | Promise<T>
  ): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.timeout) {
        this.state = 'half-open';
        this.failureCount = 0;
      } else if (fallback) {
        logger.warn('Circuit breaker is open, using fallback');
        return fallback();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }
    
    try {
      const result = await operation();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
        logger.info('Circuit breaker reset to closed state');
      }
      
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.threshold) {
        this.state = 'open';
        logger.error('Circuit breaker opened due to failures', {
          threshold: this.threshold,
          failures: this.failureCount,
        });
      }
      
      if (fallback && this.state === 'open') {
        return fallback();
      }
      
      throw error;
    }
  }
  
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
  
  getState(): string {
    return this.state;
  }
}

/**
 * Graceful shutdown handler
 */
export class GracefulShutdown {
  private shutdownHandlers: Array<() => Promise<void>> = [];
  private isShuttingDown = false;
  
  register(handler: () => Promise<void>): void {
    this.shutdownHandlers.push(handler);
  }
  
  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }
    
    this.isShuttingDown = true;
    logger.info(`Graceful shutdown initiated by ${signal}`);
    
    const timeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(1);
    }, 30000); // 30 seconds timeout
    
    try {
      await Promise.all(
        this.shutdownHandlers.map(handler =>
          handler().catch(error =>
            logger.error('Error during shutdown handler', error)
          )
        )
      );
      
      clearTimeout(timeout);
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      clearTimeout(timeout);
      logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  }
  
  setupSignalHandlers(): void {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      this.shutdown('unhandledRejection');
    });
  }
}