import { logger } from '@/utils/logger';
import { AppError } from '@/utils/errors';
import { EventEmitter } from 'events';

// Types
interface {{ServiceName}}Config {
  // Add your configuration options here
  maxRetries?: number;
  timeout?: number;
  cacheEnabled?: boolean;
}

interface {{ServiceName}}Options {
  // Add method-specific options here
}

// Events
export interface {{ServiceName}}Events {
  'initialized': () => void;
  'error': (error: Error) => void;
  'data:updated': (data: any) => void;
  'cache:hit': (key: string) => void;
  'cache:miss': (key: string) => void;
}

/**
 * {{ServiceName}} - {{ServiceDescription}}
 * 
 * @example
 * ```typescript
 * const service = new {{ServiceName}}({
 *   maxRetries: 3,
 *   timeout: 5000,
 * });
 * 
 * await service.initialize();
 * const result = await service.process(data);
 * ```
 */
export class {{ServiceName}} extends EventEmitter {
  private static instance: {{ServiceName}} | null = null;
  private config: Required<{{ServiceName}}Config>;
  private isInitialized = false;
  private cache: Map<string, any> = new Map();
  
  constructor(config: {{ServiceName}}Config = {}) {
    super();
    
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      timeout: config.timeout ?? 30000,
      cacheEnabled: config.cacheEnabled ?? true,
    };
    
    logger.info('{{ServiceName}} created', { config: this.config });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config?: {{ServiceName}}Config): {{ServiceName}} {
    if (!{{ServiceName}}.instance) {
      {{ServiceName}}.instance = new {{ServiceName}}(config);
    }
    return {{ServiceName}}.instance;
  }
  
  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('{{ServiceName}} already initialized');
      return;
    }
    
    try {
      logger.info('Initializing {{ServiceName}}...');
      
      // Perform initialization tasks
      await this.setupConnections();
      await this.loadConfiguration();
      await this.validateEnvironment();
      
      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('{{ServiceName}} initialized successfully');
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Initialization failed');
      logger.error('Failed to initialize {{ServiceName}}', { error: err });
      this.emit('error', err);
      throw new AppError('Service initialization failed', 500, { originalError: err });
    }
  }
  
  /**
   * Main processing method
   */
  public async process(data: any, options: {{ServiceName}}Options = {}): Promise<any> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(data, options);
    
    // Check cache
    if (this.config.cacheEnabled && this.cache.has(cacheKey)) {
      logger.debug('Cache hit', { cacheKey });
      this.emit('cache:hit', cacheKey);
      return this.cache.get(cacheKey);
    }
    
    this.emit('cache:miss', cacheKey);
    
    let lastError: Error | null = null;
    
    // Retry logic
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug('Processing attempt', { attempt, maxRetries: this.config.maxRetries });
        
        const result = await this.performProcessing(data, options);
        
        // Cache result
        if (this.config.cacheEnabled) {
          this.cache.set(cacheKey, result);
        }
        
        const duration = Date.now() - startTime;
        logger.info('Processing completed', { duration, attempt });
        
        this.emit('data:updated', result);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Processing failed');
        
        logger.warn('Processing attempt failed', {
          attempt,
          error: lastError,
          willRetry: attempt < this.config.maxRetries,
        });
        
        if (attempt < this.config.maxRetries) {
          await this.delay(this.calculateBackoff(attempt));
        }
      }
    }
    
    // All retries failed
    logger.error('All processing attempts failed', { error: lastError });
    this.emit('error', lastError!);
    throw new AppError('Processing failed after all retries', 500, {
      lastError,
      attempts: this.config.maxRetries,
    });
  }
  
  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up {{ServiceName}}...');
    
    try {
      // Clear cache
      this.cache.clear();
      
      // Close connections
      await this.closeConnections();
      
      // Reset state
      this.isInitialized = false;
      
      // Clear singleton instance
      if ({{ServiceName}}.instance === this) {
        {{ServiceName}}.instance = null;
      }
      
      logger.info('{{ServiceName}} cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup', { error });
      throw error;
    }
  }
  
  /**
   * Get service status
   */
  public getStatus(): {
    initialized: boolean;
    cacheSize: number;
    uptime: number;
  } {
    return {
      initialized: this.isInitialized,
      cacheSize: this.cache.size,
      uptime: this.isInitialized ? Date.now() - this.initTime : 0,
    };
  }
  
  // Private methods
  
  private initTime = Date.now();
  
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new AppError('Service not initialized', 500);
    }
  }
  
  private async setupConnections(): Promise<void> {
    // Implement connection setup
  }
  
  private async loadConfiguration(): Promise<void> {
    // Implement configuration loading
  }
  
  private async validateEnvironment(): Promise<void> {
    // Implement environment validation
  }
  
  private async performProcessing(data: any, options: {{ServiceName}}Options): Promise<any> {
    // Implement actual processing logic
    
    // Simulate processing with timeout
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Processing timeout'));
      }, this.config.timeout);
      
      // Actual processing here
      setTimeout(() => {
        clearTimeout(timer);
        resolve({ processed: data, timestamp: Date.now() });
      }, 100);
    });
  }
  
  private async closeConnections(): Promise<void> {
    // Implement connection cleanup
  }
  
  private generateCacheKey(data: any, options: any): string {
    return `${JSON.stringify(data)}-${JSON.stringify(options)}`;
  }
  
  private calculateBackoff(attempt: number): number {
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton getter for convenience
export const get{{ServiceName}} = (config?: {{ServiceName}}Config): {{ServiceName}} => {
  return {{ServiceName}}.getInstance(config);
};