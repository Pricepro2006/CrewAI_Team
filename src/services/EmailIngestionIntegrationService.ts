/**
 * Email Ingestion Integration Service
 * 
 * Production-ready service that integrates EmailIngestionService with
 * the existing CrewAI Team architecture and provides seamless operation
 * across all three modes: Manual Load, Auto-Pull, and Hybrid.
 */

import { EmailIngestionServiceImpl } from '../core/services/EmailIngestionServiceImpl.js';
import { EmailIngestionServiceFactory } from '../core/services/EmailIngestionServiceFactory.js';
import { UnifiedEmailService } from '../api/services/UnifiedEmailService.js';
import { EmailThreePhaseAnalysisService } from '../core/services/EmailThreePhaseAnalysisService.js';
import { logger } from '../utils/logger.js';
import { initializeSecureConfig } from '../utils/secrets.js';
import { redisClient } from '../config/redis.config.js';
import { io } from '../api/websocket/index.js';
import type { 
  IngestionMode,
  IngestionSource,
  IngestionBatchResult,
  QueueStatus,
  HealthStatus,
  IngestionMetrics
} from '../core/services/EmailIngestionService.js';
import type { Result } from '../shared/types/core.js';

/**
 * Integration configuration for the email ingestion system
 */
export interface EmailIngestionIntegrationConfig {
  mode: IngestionMode;
  enableWebSocketUpdates: boolean;
  enableAnalysisIntegration: boolean;
  enableHealthMonitoring: boolean;
  autoStartScheduler: boolean;
  schedulerIntervalMinutes: number;
  maxConcurrentOperations: number;
}

/**
 * Default configuration for production deployment
 */
const defaultConfig: EmailIngestionIntegrationConfig = {
  mode: IngestionMode.HYBRID,
  enableWebSocketUpdates: true,
  enableAnalysisIntegration: true,
  enableHealthMonitoring: true,
  autoStartScheduler: true,
  schedulerIntervalMinutes: 5,
  maxConcurrentOperations: 3
};

/**
 * Production-ready Email Ingestion Integration Service
 */
export class EmailIngestionIntegrationService {
  private ingestionService!: EmailIngestionServiceImpl;
  private unifiedEmailService!: UnifiedEmailService;
  private analysisService!: EmailThreePhaseAnalysisService;
  private config: EmailIngestionIntegrationConfig;
  private isInitialized = false;
  private healthCheckInterval?: NodeJS.Timeout;
  private schedulerInterval?: NodeJS.Timeout;
  private operationSemaphore = 0;

  constructor(config: Partial<EmailIngestionIntegrationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the integration service with all components
   */
  async initialize(): Promise<Result<void>> {
    try {
      logger.info('Initializing Email Ingestion Integration Service', {
        config: this.config
      });

      // Initialize secure configuration
      initializeSecureConfig();

      // Initialize core services
      await this.initializeCoreServices();

      // Set up integrations
      await this.setupIntegrations();

      // Start monitoring and scheduling
      await this.startMonitoring();
      
      if (this.config.autoStartScheduler) {
        await this.startScheduler();
      }

      this.isInitialized = true;

      logger.info('Email Ingestion Integration Service initialized successfully');

      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize Email Ingestion Integration Service', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Initialize core services with production configuration
   */
  private async initializeCoreServices(): Promise<void> {
    // Create EmailIngestionService with production configuration
    this.ingestionService = await EmailIngestionServiceFactory.create({
      mode: this.config.mode,
      processing: {
        batchSize: parseInt(process.env.EMAIL_PROCESSING_BATCH_SIZE || '50'),
        concurrency: parseInt(process.env.EMAIL_PROCESSING_CONCURRENCY || '10'),
        maxRetries: parseInt(process.env.EMAIL_PROCESSING_MAX_RETRIES || '3')
      },
      deduplication: {
        enabled: true,
        windowHours: 24,
        hashFunction: 'sha256'
      },
      health: {
        checkInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
        timeoutMs: 10000
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0')
      }
    });

    // Initialize UnifiedEmailService for existing integration
    this.unifiedEmailService = new UnifiedEmailService();

    // Initialize EmailThreePhaseAnalysisService for analysis integration
    this.analysisService = new EmailThreePhaseAnalysisService();

    logger.info('Core services initialized successfully');
  }

  /**
   * Set up integrations between services
   */
  private async setupIntegrations(): Promise<void> {
    if (this.config.enableAnalysisIntegration) {
      // Connect ingestion completion to analysis pipeline
      this.setupAnalysisIntegration();
    }

    if (this.config.enableWebSocketUpdates) {
      // Connect to WebSocket for real-time updates
      this.setupWebSocketIntegration();
    }

    logger.info('Service integrations configured successfully');
  }

  /**
   * Set up analysis integration pipeline
   */
  private setupAnalysisIntegration(): void {
    // Override ingestion completion handler to trigger analysis
    const originalIngestBatch = this.ingestionService.ingestBatch.bind(this.ingestionService);
    
    this.ingestionService.ingestBatch = async (emails, source) => {
      const result = await originalIngestBatch(emails, source);
      
      if (result.success && this.config.enableAnalysisIntegration) {
        // Trigger adaptive 3-phase analysis for newly ingested emails
        this.triggerAnalysisForNewEmails(result.data.processed).catch(error => {
          logger.error('Failed to trigger analysis for new emails', {
            error: error instanceof Error ? error.message : 'Unknown error',
            processed: result.data.processed
          });
        });
      }
      
      return result;
    };
  }

  /**
   * Set up WebSocket integration for real-time updates
   */
  private setupWebSocketIntegration(): void {
    // Emit ingestion progress updates
    const originalProgressHandler = this.ingestionService['emitProgress'] || (() => {});
    
    this.ingestionService['emitProgress'] = (progress: any) => {
      originalProgressHandler.call(this.ingestionService, progress);
      
      if (io) {
        io.emit('email:ingestion:progress', {
          ...progress,
          timestamp: new Date().toISOString(),
          service: 'EmailIngestionIntegrationService'
        });
      }
    };
  }

  /**
   * Trigger adaptive 3-phase analysis for newly ingested emails
   */
  private async triggerAnalysisForNewEmails(emailCount: number): Promise<void> {
    try {
      logger.info('Triggering analysis for newly ingested emails', {
        emailCount
      });

      // Use existing EmailThreePhaseAnalysisService for adaptive analysis
      await this.analysisService.processEmailsByConversation({
        limit: emailCount,
        onlyUnprocessed: true,
        enableAdaptivePhasing: true
      });

      logger.info('Analysis completed for newly ingested emails', {
        emailCount
      });
    } catch (error) {
      logger.error('Analysis failed for newly ingested emails', {
        error: error instanceof Error ? error.message : 'Unknown error',
        emailCount
      });
    }
  }

  /**
   * Start health monitoring
   */
  private async startMonitoring(): Promise<void> {
    if (!this.config.enableHealthMonitoring) {
      return;
    }

    const checkInterval = this.config.enableHealthMonitoring ? 30000 : 60000;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        
        if (!health.healthy) {
          logger.warn('Email Ingestion Integration Service health check failed', {
            health
          });
          
          // Emit health status via WebSocket if enabled
          if (this.config.enableWebSocketUpdates && io) {
            io.emit('email:ingestion:health', {
              ...health,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        logger.error('Health check error', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, checkInterval);

    logger.info('Health monitoring started', { checkInterval });
  }

  /**
   * Start auto-pull scheduler
   */
  private async startScheduler(): Promise<void> {
    if (this.config.mode === IngestionMode.MANUAL_LOAD) {
      logger.info('Scheduler not started - running in manual mode only');
      return;
    }

    const intervalMs = this.config.schedulerIntervalMinutes * 60 * 1000;
    
    this.schedulerInterval = setInterval(async () => {
      if (this.operationSemaphore >= this.config.maxConcurrentOperations) {
        logger.warn('Skipping scheduled auto-pull - too many concurrent operations', {
          current: this.operationSemaphore,
          max: this.config.maxConcurrentOperations
        });
        return;
      }

      try {
        this.operationSemaphore++;
        
        logger.info('Starting scheduled auto-pull operation');
        
        // Execute auto-pull from configured sources
        await this.executeScheduledAutoPull();
        
        logger.info('Scheduled auto-pull operation completed');
      } catch (error) {
        logger.error('Scheduled auto-pull operation failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        this.operationSemaphore--;
      }
    }, intervalMs);

    logger.info('Auto-pull scheduler started', { 
      intervalMinutes: this.config.schedulerIntervalMinutes 
    });
  }

  /**
   * Execute scheduled auto-pull operation
   */
  private async executeScheduledAutoPull(): Promise<void> {
    const sources: Array<{ method: string; description: string }> = [];

    // Add Microsoft Graph if configured
    if (process.env.MSGRAPH_CLIENT_ID && process.env.MSGRAPH_CLIENT_SECRET) {
      sources.push({
        method: 'ingestFromMicrosoftGraph',
        description: 'Microsoft Graph'
      });
    }

    // Add Gmail if configured
    if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET) {
      sources.push({
        method: 'ingestFromGmail',
        description: 'Gmail API'
      });
    }

    if (sources.length === 0) {
      logger.warn('No external email sources configured for auto-pull');
      return;
    }

    // Execute auto-pull from each configured source
    for (const source of sources) {
      try {
        logger.info(`Starting auto-pull from ${source.description}`);
        
        const method = this.ingestionService[source.method as keyof EmailIngestionServiceImpl] as () => Promise<Result<IngestionBatchResult>>;
        const result = await method.call(this.ingestionService);
        
        if (result.success) {
          logger.info(`Auto-pull from ${source.description} completed`, {
            processed: result.data.processed,
            duplicate: result.data.duplicate,
            failed: result.data.failed
          });
        } else {
          logger.error(`Auto-pull from ${source.description} failed`, {
            error: result.error
          });
        }
      } catch (error) {
        logger.error(`Auto-pull from ${source.description} encountered an error`, {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  }

  /**
   * Manual batch loading with integration
   */
  async loadBatch(
    filePaths: string[],
    source: IngestionSource = IngestionSource.JSON_FILE
  ): Promise<Result<IngestionBatchResult>> {
    this.ensureInitialized();

    try {
      this.operationSemaphore++;
      
      logger.info('Starting manual batch loading', {
        filePaths,
        source,
        fileCount: filePaths.length
      });

      const results: IngestionBatchResult[] = [];
      
      for (const filePath of filePaths) {
        const result = await this.ingestionService.ingestFromJsonFile(filePath);
        
        if (result.success) {
          results.push(result.data);
        } else {
          logger.error('Batch file processing failed', {
            filePath,
            error: result.error
          });
        }
      }

      // Aggregate results
      const aggregatedResult: IngestionBatchResult = {
        processed: results.reduce((sum, r) => sum + r.processed, 0),
        duplicate: results.reduce((sum, r) => sum + r.duplicate, 0),
        failed: results.reduce((sum, r) => sum + r.failed, 0),
        throughput: results.reduce((sum, r) => sum + (r.throughput || 0), 0) / results.length,
        startTime: new Date(),
        endTime: new Date(),
        source,
        errors: results.flatMap(r => r.errors || [])
      };

      logger.info('Manual batch loading completed', aggregatedResult);

      return { success: true, data: aggregatedResult };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Manual batch loading failed', {
        error: errorMessage,
        filePaths
      });

      return { success: false, error: errorMessage };
    } finally {
      this.operationSemaphore--;
    }
  }

  /**
   * Get comprehensive system metrics
   */
  async getMetrics(): Promise<IngestionMetrics> {
    this.ensureInitialized();
    return await this.ingestionService.getMetrics();
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    this.ensureInitialized();
    return await this.ingestionService.getQueueStatus();
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    this.ensureInitialized();
    return await this.ingestionService.healthCheck();
  }

  /**
   * Pause all operations
   */
  async pause(): Promise<Result<void>> {
    this.ensureInitialized();
    return await this.ingestionService.pauseQueue();
  }

  /**
   * Resume all operations
   */
  async resume(): Promise<Result<void>> {
    this.ensureInitialized();
    return await this.ingestionService.resumeQueue();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down Email Ingestion Integration Service');

    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
    }

    // Wait for ongoing operations to complete
    while (this.operationSemaphore > 0) {
      logger.info('Waiting for ongoing operations to complete', {
        remaining: this.operationSemaphore
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Shutdown ingestion service
    if (this.ingestionService) {
      await this.ingestionService.pauseQueue();
    }

    // Close Redis connection
    try {
      await redisClient.disconnect();
    } catch (error) {
      logger.warn('Error closing Redis connection', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    this.isInitialized = false;
    logger.info('Email Ingestion Integration Service shutdown complete');
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('EmailIngestionIntegrationService must be initialized before use');
    }
  }
}

/**
 * Global singleton instance for application-wide use
 */
let globalIntegrationService: EmailIngestionIntegrationService | null = null;

/**
 * Get or create the global integration service instance
 */
export function getEmailIngestionIntegrationService(
  config?: Partial<EmailIngestionIntegrationConfig>
): EmailIngestionIntegrationService {
  if (!globalIntegrationService) {
    globalIntegrationService = new EmailIngestionIntegrationService(config);
  }
  
  return globalIntegrationService;
}

/**
 * Initialize the global integration service
 */
export async function initializeEmailIngestionIntegration(
  config?: Partial<EmailIngestionIntegrationConfig>
): Promise<Result<EmailIngestionIntegrationService>> {
  const service = getEmailIngestionIntegrationService(config);
  const initResult = await service.initialize();
  
  if (initResult.success) {
    return { success: true, data: service };
  } else {
    return { success: false, error: initResult.error };
  }
}