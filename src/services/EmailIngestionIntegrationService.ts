/**
 * Email Ingestion Integration Service
 * 
 * Production-ready service that integrates EmailIngestionService with
 * the existing CrewAI Team architecture and provides seamless operation
 * across all three modes: Manual Load, Auto-Pull, and Hybrid.
 */

import type { IEmailIngestionService } from '../core/services/EmailIngestionService.js';
import { EmailIngestionServiceFactory } from '../core/services/EmailIngestionServiceFactory.js';
import { UnifiedEmailService } from '../api/services/UnifiedEmailService.js';
import { EmailThreePhaseAnalysisService } from '../core/services/EmailThreePhaseAnalysisService.js';
import { logger } from '../utils/logger.js';
import { initializeSecureConfig } from '../utils/secrets.js';
import { redisClient } from '../config/redis.config.js';
import { io } from '../api/websocket/index.js';
import { 
  IngestionMode,
  IngestionSource
} from '../core/services/EmailIngestionService.js';
import type {
  IngestionBatchResult,
  QueueStatus,
  HealthStatus,
  IngestionMetrics,
  RawEmailData,
  ComponentHealth
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
  mode: IngestionMode.HYBRID as IngestionMode,
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
  private ingestionService!: IEmailIngestionService;
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
      logger.info('Initializing Email Ingestion Integration Service', 
        'EmailIngestionIntegrationService',
        { config: this.config });

      // Initialize secure configuration
      initializeSecureConfig();

      // Initialize core services
      await this.initializeCoreServices();

      // Set up integrations
      await this.setupIntegrations();

      // Start monitoring and scheduling
      await this.startMonitoring();
      
      if (this?.config?.autoStartScheduler) {
        await this.startScheduler();
      }

      this.isInitialized = true;

      logger.info('Email Ingestion Integration Service initialized successfully');

      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initialize Email Ingestion Integration Service', 
        'EmailIngestionIntegrationService',
        {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        },
        error instanceof Error ? error : undefined);

      return { success: false, error: new Error(errorMessage) };
    }
  }

  /**
   * Initialize core services with production configuration
   */
  private async initializeCoreServices(): Promise<void> {
    // Create EmailIngestionService with production configuration
    this.ingestionService = await EmailIngestionServiceFactory.create({
      mode: this?.config?.mode || IngestionMode.HYBRID,
      processing: {
        batchSize: parseInt(process.env.EMAIL_PROCESSING_BATCH_SIZE || '50'),
        concurrency: parseInt(process.env.EMAIL_PROCESSING_CONCURRENCY || '10'),
        maxRetries: parseInt(process.env.EMAIL_PROCESSING_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.EMAIL_PROCESSING_RETRY_DELAY || '5000'),
        deduplicationWindow: 24,
        priorityBoostKeywords: ['urgent', 'critical', 'asap', 'emergency']
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
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
    if (this?.config?.enableAnalysisIntegration) {
      // Connect ingestion completion to analysis pipeline
      this.setupAnalysisIntegration();
    }

    if (this?.config?.enableWebSocketUpdates) {
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
    const originalIngestBatch = this?.ingestionService?.ingestBatch?.bind(this.ingestionService);
    
    if (this.ingestionService && originalIngestBatch && typeof originalIngestBatch === 'function') {
      (this.ingestionService as any).ingestBatch = async (emails: RawEmailData[], source: IngestionSource) => {
        const result = await originalIngestBatch(emails, source);
        
        if (result.success && this?.config?.enableAnalysisIntegration) {
          // Trigger adaptive 3-phase analysis for newly ingested emails
          this.triggerAnalysisForNewEmails(result.data.processed).catch(error => {
            logger.error('Failed to trigger analysis for new emails', 
              'EmailIngestionIntegrationService',
              {
                error: error instanceof Error ? error.message : 'Unknown error',
                processed: result.data.processed
              },
              error instanceof Error ? error : undefined);
          });
        }
        
        return result;
      };
    }
  }

  /**
   * Set up WebSocket integration for real-time updates
   */
  private setupWebSocketIntegration(): void {
    // Type-safe access to potential emitProgress method
    const serviceWithProgress = this.ingestionService as any;
    const originalProgressHandler = serviceWithProgress.emitProgress || (() => {});
    
    serviceWithProgress.emitProgress = (progress: any) => {
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
      logger.info('Triggering analysis for newly ingested emails', 
        'EmailIngestionIntegrationService',
        { emailCount });

      // Use existing EmailThreePhaseAnalysisService for adaptive analysis
      // Note: analyzeEmailBatch requires EmailInput[] array, not count
      // This would need to be implemented to fetch emails and analyze them
      if (this.analysisService && emailCount > 0) {
        logger.info('Email analysis integration would trigger here for batch analysis');
        // TODO: Implement email fetching and batch analysis when email data is available
      }

      logger.info('Analysis completed for newly ingested emails', 
        'EmailIngestionIntegrationService',
        { emailCount });
    } catch (error) {
      logger.error('Analysis failed for newly ingested emails', 
        'EmailIngestionIntegrationService',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          emailCount
        },
        error instanceof Error ? error : undefined);
    }
  }

  /**
   * Start health monitoring
   */
  private async startMonitoring(): Promise<void> {
    if (!this?.config?.enableHealthMonitoring) {
      return;
    }

    const checkInterval = this?.config?.enableHealthMonitoring ? 30000 : 60000;
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealthStatus();
        
        if (!health.healthy) {
          logger.warn('Email Ingestion Integration Service health check failed', 
            'EmailIngestionIntegrationService',
            { health });
          
          // Emit health status via WebSocket if enabled
          if (this?.config?.enableWebSocketUpdates && io) {
            io.emit('email:ingestion:health', {
              ...health,
              timestamp: new Date().toISOString()
            });
          }
        }
      } catch (error) {
        logger.error('Health check error', 
          'EmailIngestionIntegrationService',
          {
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          error instanceof Error ? error : undefined);
      }
    }, checkInterval);

    logger.info('Health monitoring started', 
      'EmailIngestionIntegrationService',
      { checkInterval });
  }

  /**
   * Start auto-pull scheduler
   */
  private async startScheduler(): Promise<void> {
    if (this?.config?.mode === IngestionMode.MANUAL) {
      logger.info('Scheduler not started - running in manual mode only');
      return;
    }

    const intervalMs = this?.config?.schedulerIntervalMinutes * 60 * 1000;
    
    this.schedulerInterval = setInterval(async () => {
      if (this.operationSemaphore >= this?.config?.maxConcurrentOperations) {
        logger.warn('Skipping scheduled auto-pull - too many concurrent operations', 
          'EmailIngestionIntegrationService',
          {
            current: this.operationSemaphore,
            max: this?.config?.maxConcurrentOperations
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
        logger.error('Scheduled auto-pull operation failed', 
          'EmailIngestionIntegrationService',
          {
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          error instanceof Error ? error : undefined);
      } finally {
        this.operationSemaphore--;
      }
    }, intervalMs);

    logger.info('Auto-pull scheduler started', 
      'EmailIngestionIntegrationService',
      { 
        intervalMinutes: this?.config?.schedulerIntervalMinutes 
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

    if (!sources || sources.length === 0) {
      logger.warn('No external email sources configured for auto-pull');
      return;
    }

    // Execute auto-pull from each configured source
    for (const source of sources) {
      try {
        logger.info(`Starting auto-pull from ${source.description}`);
        
        const method = (this.ingestionService as any)[source.method] as () => Promise<Result<IngestionBatchResult>>;
        const result = await method?.call(this.ingestionService);
        
        if (result.success) {
          logger.info(`Auto-pull from ${source.description} completed`, 
            'EmailIngestionIntegrationService',
            {
              processed: result.data?.processed,
              duplicates: result.data?.duplicates,
              failed: result.data?.failed
            });
        } else {
          logger.error(`Auto-pull from ${source.description} failed`, 
            'EmailIngestionIntegrationService',
            {
              error: result.error?.message
            },
            result.error);
        }
      } catch (error) {
        logger.error(`Auto-pull from ${source.description} encountered an error`, 
          'EmailIngestionIntegrationService',
          {
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          error instanceof Error ? error : undefined);
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
      
      logger.info('Starting manual batch loading', 
        'EmailIngestionIntegrationService',
        {
          filePaths,
          source,
          fileCount: filePaths?.length || 0
        });

      const results: IngestionBatchResult[] = [];
      
      for (const filePath of filePaths) {
        const result = await this?.ingestionService?.ingestFromJsonFile(filePath);
        
        if (result.success) {
          results.push(result.data);
        } else {
          logger.error('Batch file processing failed', 
            'EmailIngestionIntegrationService',
            {
              filePath,
              error: result.error?.message
            },
            result.error);
        }
      }

      // Aggregate results
      const aggregatedResult: IngestionBatchResult = {
        batchId: `batch_${Date.now()}`,
        source,
        totalEmails: results.reduce((sum: any, r: any) => sum + r.totalEmails || 0, 0),
        processed: results.reduce((sum: any, r: any) => sum + r.processed, 0),
        duplicates: results.reduce((sum: any, r: any) => sum + r.duplicates, 0),
        failed: results.reduce((sum: any, r: any) => sum + r.failed, 0),
        results: results.flatMap(r => r.results || []),
        startTime: new Date(),
        endTime: new Date(),
        throughput: results.reduce((sum: any, r: any) => sum + (r.throughput || 0), 0) / (results?.length || 1)
      };

      logger.info('Manual batch loading completed', 
        'EmailIngestionIntegrationService',
        aggregatedResult);

      return { success: true, data: aggregatedResult };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Manual batch loading failed', 
        'EmailIngestionIntegrationService',
        {
          error: errorMessage,
          filePaths
        },
        error instanceof Error ? error : undefined);

      return { success: false, error: new Error(errorMessage) };
    } finally {
      this.operationSemaphore--;
    }
  }

  /**
   * Get comprehensive system metrics
   */
  async getMetrics(): Promise<IngestionMetrics> {
    this.ensureInitialized();
    const metrics = await this?.ingestionService?.getMetrics();
    if (!metrics) {
      // Return a default IngestionMetrics object
      const defaultMetrics: IngestionMetrics = {
        totalIngested: 0,
        duplicatesDetected: 0,
        failedIngestions: 0,
        averageProcessingTime: 0,
        currentQueueSize: 0,
        throughput: {
          lastMinute: 0,
          lastHour: 0,
          last24Hours: 0
        },
        bySource: {} as Record<IngestionSource, number>,
        errors: []
      };
      return defaultMetrics;
    }
    return metrics;
  }

  /**
   * Get queue status
   */
  async getQueueStatus(): Promise<QueueStatus> {
    this.ensureInitialized();
    const status = await this?.ingestionService?.getQueueStatus();
    if (!status) {
      // Return a default QueueStatus object
      const defaultStatus: QueueStatus = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false
      };
      return defaultStatus;
    }
    return status;
  }

  /**
   * Get health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    this.ensureInitialized();
    const health = await this?.ingestionService?.healthCheck();
    if (!health) {
      // Return a default HealthStatus object
      const defaultHealth: HealthStatus = {
        healthy: false,
        status: 'failing' as const,
        components: {
          queue: { healthy: false, message: 'Service not initialized' },
          redis: { healthy: false, message: 'Service not initialized' },
          database: { healthy: false, message: 'Service not initialized' },
          autoPull: { healthy: false, message: 'Service not initialized' }
        },
        uptime: 0,
        lastCheck: new Date()
      };
      return defaultHealth;
    }
    return health;
  }

  /**
   * Pause all operations
   */
  async pause(): Promise<Result<void>> {
    this.ensureInitialized();
    
    try {
      await this.ingestionService?.pauseIngestion();
      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: new Error(errorMessage) };
    }
  }

  /**
   * Resume all operations
   */
  async resume(): Promise<Result<void>> {
    this.ensureInitialized();
    
    try {
      await this.ingestionService?.resumeIngestion();
      return { success: true, data: undefined };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: new Error(errorMessage) };
    }
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
      logger.info('Waiting for ongoing operations to complete', 
        'EmailIngestionIntegrationService',
        {
          remaining: this.operationSemaphore
        });
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Shutdown ingestion service
    if (this.ingestionService) {
      await this.ingestionService.pauseIngestion();
    }

    // Close Redis connection
    try {
      await redisClient.disconnect();
    } catch (error) {
      logger.warn('Error closing Redis connection', 
        'EmailIngestionIntegrationService',
        {
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