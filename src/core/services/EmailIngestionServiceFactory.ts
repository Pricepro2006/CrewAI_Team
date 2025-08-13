/**
 * EmailIngestionServiceFactory - Factory for creating and configuring EmailIngestionService instances
 * 
 * Provides environment-based configuration and dependency injection
 */

import { 
  EmailIngestionServiceImpl 
} from './EmailIngestionServiceImpl.js';
import {
  EmailIngestionConfig,
  IngestionMode,
  IngestionSource,
  IEmailIngestionService
} from './EmailIngestionService.js';
import { EmailRepository } from '../../database/repositories/EmailRepository.js';
import { UnifiedEmailService } from '../../api/services/UnifiedEmailService.js';
import { getDatabaseConnection } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';

export class EmailIngestionServiceFactory {
  private static instance: IEmailIngestionService | null = null;

  /**
   * Create EmailIngestionService with default configuration
   */
  static async create(overrides?: Partial<EmailIngestionConfig>): Promise<IEmailIngestionService> {
    const config = this.createDefaultConfig(overrides);
    
    // Initialize dependencies
    const db = getDatabaseConnection();
    const emailRepository = new EmailRepository({ db });
    const unifiedEmailService = new UnifiedEmailService();
    
    // Create service instance
    const service = new EmailIngestionServiceImpl(
      config,
      emailRepository,
      unifiedEmailService
    );
    
    await service.initialize();
    
    logger.info('EmailIngestionService created and initialized', 'EMAIL_INGESTION_FACTORY', {
      mode: config.mode,
      concurrency: config.processing.concurrency,
      batchSize: config.processing.batchSize
    });
    
    return service;
  }

  /**
   * Get or create singleton instance
   */
  static async getInstance(overrides?: Partial<EmailIngestionConfig>): Promise<IEmailIngestionService> {
    if (!this.instance) {
      this.instance = await this.create(overrides);
    }
    return this.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Create default configuration from environment variables
   */
  private static createDefaultConfig(overrides?: Partial<EmailIngestionConfig>): EmailIngestionConfig {
    const defaultConfig: EmailIngestionConfig = {
      mode: this.getIngestionMode(),
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
      },
      processing: {
        batchSize: parseInt(process.env.EMAIL_BATCH_SIZE || '50'),
        concurrency: parseInt(process.env.EMAIL_CONCURRENCY || '10'),
        maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000'),
        deduplicationWindow: parseInt(process.env.EMAIL_DEDUP_WINDOW_HOURS || '24'),
        priorityBoostKeywords: this.getPriorityKeywords()
      }
    };

    // Add auto-pull configuration if enabled
    if (defaultConfig.mode === IngestionMode.AUTO_PULL || defaultConfig.mode === IngestionMode.HYBRID) {
      defaultConfig.autoPull = {
        interval: parseInt(process.env.EMAIL_AUTOPULL_INTERVAL_MINUTES || '15'),
        sources: this.getAutoPullSources(),
        maxEmailsPerPull: parseInt(process.env.EMAIL_AUTOPULL_MAX_EMAILS || '1000')
      };
    }

    // Apply overrides
    return this.deepMerge(defaultConfig, overrides || {});
  }

  /**
   * Get ingestion mode from environment
   */
  private static getIngestionMode(): IngestionMode {
    const mode = process.env.EMAIL_INGESTION_MODE?.toLowerCase();
    
    switch (mode) {
      case 'manual':
        return IngestionMode.MANUAL;
      case 'auto_pull':
      case 'auto-pull':
        return IngestionMode.AUTO_PULL;
      case 'hybrid':
        return IngestionMode.HYBRID;
      default:
        logger.warn('Invalid or missing EMAIL_INGESTION_MODE, defaulting to MANUAL', 'EMAIL_INGESTION_FACTORY', {
          provided: mode
        });
        return IngestionMode.MANUAL;
    }
  }

  /**
   * Get auto-pull sources from environment
   */
  private static getAutoPullSources(): IngestionSource[] {
    const sourcesEnv = process.env.EMAIL_AUTOPULL_SOURCES;
    if (!sourcesEnv) {
      return [IngestionSource.MICROSOFT_GRAPH]; // Default
    }

    const sources: IngestionSource[] = [];
    const sourceStrings = sourcesEnv.split(',').map(s => s.trim().toLowerCase());

    for (const sourceString of sourceStrings) {
      switch (sourceString) {
        case 'microsoft_graph':
        case 'microsoft-graph':
        case 'graph':
          sources.push(IngestionSource.MICROSOFT_GRAPH);
          break;
        case 'gmail_api':
        case 'gmail-api':
        case 'gmail':
          sources.push(IngestionSource.GMAIL_API);
          break;
        case 'webhook':
          sources.push(IngestionSource.WEBHOOK);
          break;
        default:
          logger.warn('Unknown auto-pull source ignored', 'EMAIL_INGESTION_FACTORY', {
            source: sourceString
          });
      }
    }

    return sources.length > 0 ? sources : [IngestionSource.MICROSOFT_GRAPH];
  }

  /**
   * Get priority boost keywords from environment
   */
  private static getPriorityKeywords(): string[] {
    const keywordsEnv = process.env.EMAIL_PRIORITY_KEYWORDS;
    if (!keywordsEnv) {
      return [
        'urgent',
        'critical',
        'emergency',
        'asap',
        'immediately',
        'escalation',
        'complaint',
        'cancel order',
        'refund',
        'high priority',
        'time sensitive'
      ];
    }

    return keywordsEnv.split(',').map(k => k.trim()).filter(k => k.length > 0);
  }

  /**
   * Deep merge configuration objects
   */
  private static deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (this.isObject(sourceValue) && this.isObject(targetValue)) {
          result[key] = this.deepMerge(targetValue, sourceValue);
        } else if (sourceValue !== undefined) {
          result[key] = sourceValue;
        }
      }
    }

    return result;
  }

  /**
   * Check if value is a plain object
   */
  private static isObject(value: any): value is Record<string, any> {
    return value !== null && 
           typeof value === 'object' && 
           !Array.isArray(value) && 
           !(value instanceof Date);
  }
}

/**
 * Configuration presets for common scenarios
 */
export class EmailIngestionConfigPresets {
  /**
   * High-throughput configuration for production
   */
  static getHighThroughputConfig(): Partial<EmailIngestionConfig> {
    return {
      processing: {
        batchSize: 100,
        concurrency: 20,
        maxRetries: 5,
        retryDelay: 2000,
        deduplicationWindow: 48,
        priorityBoostKeywords: [
          'urgent', 'critical', 'emergency', 'asap', 'immediately',
          'escalation', 'complaint', 'cancel order', 'refund',
          'high priority', 'time sensitive', 'sla breach'
        ]
      }
    };
  }

  /**
   * Development configuration with lower resource usage
   */
  static getDevelopmentConfig(): Partial<EmailIngestionConfig> {
    return {
      processing: {
        batchSize: 10,
        concurrency: 3,
        maxRetries: 2,
        retryDelay: 1000,
        deduplicationWindow: 4,
        priorityBoostKeywords: ['test', 'urgent', 'critical']
      }
    };
  }

  /**
   * Testing configuration with minimal resources
   */
  static getTestConfig(): Partial<EmailIngestionConfig> {
    return {
      processing: {
        batchSize: 5,
        concurrency: 1,
        maxRetries: 1,
        retryDelay: 500,
        deduplicationWindow: 1,
        priorityBoostKeywords: ['test']
      }
    };
  }

  /**
   * Auto-pull configuration for continuous operation
   */
  static getAutoPullConfig(): Partial<EmailIngestionConfig> {
    return {
      mode: IngestionMode.AUTO_PULL,
      autoPull: {
        interval: 10, // Every 10 minutes
        sources: [IngestionSource.MICROSOFT_GRAPH, IngestionSource.GMAIL_API],
        maxEmailsPerPull: 500
      },
      processing: {
        batchSize: 50,
        concurrency: 15,
        maxRetries: 3,
        retryDelay: 3000,
        deduplicationWindow: 72,
        priorityBoostKeywords: [
          'urgent', 'critical', 'emergency', 'asap', 'immediately'
        ]
      }
    };
  }

  /**
   * Hybrid mode configuration for maximum flexibility
   */
  static getHybridConfig(): Partial<EmailIngestionConfig> {
    return {
      mode: IngestionMode.HYBRID,
      autoPull: {
        interval: 30, // Every 30 minutes for background pulls
        sources: [IngestionSource.MICROSOFT_GRAPH],
        maxEmailsPerPull: 200
      },
      processing: {
        batchSize: 75,
        concurrency: 12,
        maxRetries: 4,
        retryDelay: 4000,
        deduplicationWindow: 36,
        priorityBoostKeywords: [
          'urgent', 'critical', 'emergency', 'asap', 'immediately',
          'escalation', 'complaint', 'high priority'
        ]
      }
    };
  }
}

/**
 * Environment validation utilities
 */
export class EmailIngestionEnvironmentValidator {
  /**
   * Validate required environment variables
   */
  static validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check Redis configuration
    if (!process.env.REDIS_HOST && !this.isTestEnvironment()) {
      errors.push('REDIS_HOST is required for production email ingestion');
    }

    const redisPort = process.env.REDIS_PORT;
    if (redisPort && (isNaN(parseInt(redisPort)) || parseInt(redisPort) <= 0)) {
      errors.push('REDIS_PORT must be a valid positive number');
    }

    // Check processing configuration
    const batchSize = process.env.EMAIL_BATCH_SIZE;
    if (batchSize && (isNaN(parseInt(batchSize)) || parseInt(batchSize) <= 0)) {
      errors.push('EMAIL_BATCH_SIZE must be a positive number');
    }

    const concurrency = process.env.EMAIL_CONCURRENCY;
    if (concurrency && (isNaN(parseInt(concurrency)) || parseInt(concurrency) <= 0)) {
      errors.push('EMAIL_CONCURRENCY must be a positive number');
    }

    // Check auto-pull configuration if enabled
    const mode = process.env.EMAIL_INGESTION_MODE?.toLowerCase();
    if (mode === 'auto_pull' || mode === 'hybrid') {
      const interval = process.env.EMAIL_AUTOPULL_INTERVAL_MINUTES;
      if (interval && (isNaN(parseInt(interval)) || parseInt(interval) <= 0)) {
        errors.push('EMAIL_AUTOPULL_INTERVAL_MINUTES must be a positive number');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if running in test environment
   */
  private static isTestEnvironment(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  }

  /**
   * Get configuration recommendations based on environment
   */
  static getRecommendations(): string[] {
    const recommendations: string[] = [];
    const mode = process.env.EMAIL_INGESTION_MODE?.toLowerCase();

    if (!mode) {
      recommendations.push('Set EMAIL_INGESTION_MODE to define ingestion behavior (manual, auto_pull, hybrid)');
    }

    if (!process.env.EMAIL_BATCH_SIZE) {
      recommendations.push('Set EMAIL_BATCH_SIZE for optimal batching (recommended: 50-100)');
    }

    if (!process.env.EMAIL_CONCURRENCY) {
      recommendations.push('Set EMAIL_CONCURRENCY to control parallel processing (recommended: 10-20)');
    }

    if (!process.env.EMAIL_PRIORITY_KEYWORDS) {
      recommendations.push('Set EMAIL_PRIORITY_KEYWORDS to customize priority detection');
    }

    if (mode === 'auto_pull' || mode === 'hybrid') {
      if (!process.env.EMAIL_AUTOPULL_SOURCES) {
        recommendations.push('Set EMAIL_AUTOPULL_SOURCES to define auto-pull email sources');
      }
      if (!process.env.EMAIL_AUTOPULL_INTERVAL_MINUTES) {
        recommendations.push('Set EMAIL_AUTOPULL_INTERVAL_MINUTES for pull frequency (recommended: 10-30)');
      }
    }

    return recommendations;
  }
}

// Export factory as default
export { EmailIngestionServiceFactory as default };