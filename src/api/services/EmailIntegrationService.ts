/**
 * EmailIntegrationService - Bridge between EmailIngestionService and EmailStorageService
 * 
 * This service coordinates data flow between the ingestion pipeline and storage layer,
 * ensuring proper data transformation and real-time updates to the frontend.
 */

import { EmailIngestionServiceImpl } from '../../core/services/EmailIngestionServiceImpl.js';
import { EmailStorageService } from './EmailStorageService.js';
import { EmailThreePhaseAnalysisService } from '../../core/services/EmailThreePhaseAnalysisService.js';
import crypto from 'crypto';
import { EmailRepository } from '../../database/repositories/EmailRepository.js';
import { UnifiedEmailService } from './UnifiedEmailService.js';
import { logger } from '../../utils/logger.js';
import { databaseManager } from '../../core/database/DatabaseManager.js';
import Database from 'better-sqlite3';
import type { 
  EmailRecord, 
  EmailPriority
} from '../../shared/types/email.js';
import type { 
  RawEmailData, 
  IngestionMode,
  EmailIngestionConfig,
  IngestionBatchResult
} from '../../core/services/EmailIngestionService.js';
import { IngestionSource } from '../../core/services/EmailIngestionService.js';
import type { Phase1Results, Phase2Results, Phase3Results } from '../../core/services/EmailThreePhaseAnalysisService.js';
import type { EmailEntity, EmailRecipient } from '../../types/common.types.js';

// Input data types for different ingestion sources
export type JsonEmailData = Array<{
  id?: string;
  messageId?: string;
  subject: string;
  from: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  to?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
  }>;
  body?: {
    content?: string;
    contentType?: string;
  };
  receivedDateTime?: string;
  hasAttachments?: boolean;
  isRead?: boolean;
}>;

export interface DatabaseEmailCriteria {
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  status?: string[];
  keywords?: string[];
}

export interface ApiEmailConfig {
  endpoint: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  authConfig?: {
    type: 'bearer' | 'basic' | 'apikey';
    credentials: Record<string, string>;
  };
}

export type IngestionDataInput = JsonEmailData | DatabaseEmailCriteria | ApiEmailConfig;

// Entity extraction types
export interface ExtractedEntities {
  po_numbers?: (string | number)[];
  quote_numbers?: (string | number)[];
  part_numbers?: (string | number)[];
  companies?: (string | number)[];
  [key: string]: (string | number)[] | undefined;
}

// Action item types
export type ActionItemSource = string | {
  task?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
  deadline?: string;
  assignee?: string;
  owner?: string;
  revenue_impact?: string;
};

export interface MappedActionItem {
  type: 'task' | 'followup' | 'escalation';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
  assignee?: string;
  slaHours?: number;
  slaStatus?: 'on-track' | 'at-risk' | 'overdue';
  estimatedCompletion?: string;
}

// Define IngestionProgress interface
export interface IngestionProgress {
  processed: number;
  failed: number;
  total: number;
  currentBatch?: number;
  startTime: Date;
  estimatedCompletion?: Date;
}

// Extended Phase types to avoid module conflicts
interface ExtendedPhase1Results extends Phase1Results {
  summary?: string;
  intent?: string;
  workflow?: string;
  urgency?: string;
  confidence?: number;
}

interface ExtendedPhase2Results extends Phase2Results {
  summary?: string;
  intent?: string;
  workflow?: string;
  urgency?: string;
  action_summary?: string;
}

interface ExtendedPhase3Results extends Phase3Results {
  contextual_summary?: string;
}

// Analysis result type that combines all phases
interface AnalysisResult {
  phase1Analysis?: ExtendedPhase1Results;
  phase2Analysis?: ExtendedPhase2Results;
  phase3Analysis?: ExtendedPhase3Results;
  processingTime: {
    phase1?: number;
    phase2?: number;
    phase3?: number;
    total: number;
  };
  llmUsed?: string;
}

export class EmailIntegrationService {
  private static instance: EmailIntegrationService;
  private emailIngestion: EmailIngestionServiceImpl;
  private emailStorage: EmailStorageService;
  private analysisService: EmailThreePhaseAnalysisService;
  private emailRepository: EmailRepository;
  private unifiedEmailService: UnifiedEmailService;
  private isProcessing: boolean = false;

  private constructor() {
    this.emailStorage = new EmailStorageService();
    // Use a fallback approach to get database connection
    let db: any;
    try {
      if (typeof databaseManager?.getConnection === 'function') {
        db = databaseManager.getConnection('main');
      } else {
        // Fallback to creating a direct database connection
        db = new Database('./data/crewai_enhanced.db');
      }
    } catch (error) {
      // Final fallback
      try {
        db = new Database('./data/crewai_enhanced.db');
      } catch (fallbackError) {
        logger.error('Failed to initialize database connection', 'EMAIL_INTEGRATION', { error: fallbackError });
        throw new Error('Could not initialize database connection');
      }
    }
    this.emailRepository = new EmailRepository({ db });
    this.unifiedEmailService = new UnifiedEmailService(this.emailRepository);
    
    const config: EmailIngestionConfig = {
      mode: IngestionMode.MANUAL,
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      processing: {
        batchSize: 50,
        concurrency: 5,
        maxRetries: 3,
        retryDelay: 1000,
        deduplicationWindow: 24,
        priorityBoostKeywords: ['urgent', 'critical', 'asap', 'emergency']
      }
    };
    
    this.emailIngestion = new EmailIngestionServiceImpl(
      config,
      this.emailRepository,
      this.unifiedEmailService
    );
    
    this.analysisService = new EmailThreePhaseAnalysisService();

    // Initialize the ingestion service
    this.emailIngestion.initialize().catch(error => {
      logger.error('Failed to initialize email ingestion service', 'EMAIL_INTEGRATION', { error });
    });

    // Set up event listeners
    this.setupEventListeners();
  }

  public static getInstance(): EmailIntegrationService {
    if (!EmailIntegrationService.instance) {
      EmailIntegrationService.instance = new EmailIntegrationService();
    }
    return EmailIntegrationService.instance;
  }

  private setupEventListeners(): void {
    // TODO: EmailIngestionServiceImpl needs to extend EventEmitter
    // // Listen for ingestion completion events
    // this?.emailIngestion?.on('email:processed', async (result: any) => {
    //   try {
    //     // The processed email is already stored, just log the event
    //     logger.info('Email processed event received', 'EMAIL_INTEGRATION', {
    //       emailId: result.emailId
    //     });
    //   } catch (error) {
    //     logger.error('Failed to handle email processed event', 'EMAIL_INTEGRATION', { error });
    //   }
    // });

    // // Listen for batch completion
    // this?.emailIngestion?.on('batch:completed', async (progress: IngestionProgress) => {
    //   logger.info('Batch processing completed', 'EMAIL_INTEGRATION', {
    //     processed: progress.processed,
    //     failed: progress.failed,
    //     total: progress.total
    //   });
    // });
  }

  /**
   * Process and store email data that's already been analyzed
   */
  public async storeAnalyzedEmail(
    email: RawEmailData,
    analysisResult: AnalysisResult
  ): Promise<void> {
    try {
      // Transform and store in the format expected by EmailStorageService
      await this?.emailStorage?.createEmail({
        messageId: email.messageId,
        emailAlias: email.to[0]?.address || 'unknown@email.com',
        requestedBy: email?.from?.name || email?.from?.address,
        subject: email.subject,
        summary: analysisResult.phase1Analysis?.summary || email?.body?.content.substring(0, 200),
        status: this.mapPriorityToStatus(analysisResult.phase1Analysis?.priority || 'medium'),
        statusText: analysisResult.phase1Analysis?.intent || 'Email received',
        workflowState: this.mapWorkflowState(analysisResult),
        workflowType: analysisResult.phase1Analysis?.workflow || 'general',
        priority: this.mapPriority(analysisResult.phase1Analysis?.priority || 'medium'),
        receivedDate: email.receivedDateTime ? new Date(email.receivedDateTime) : new Date(),
        entities: this.extractEntities(analysisResult)
      });

      // Store the full analysis
      await this?.emailStorage?.storeEmailAnalysis(email.messageId, {
        quick: {
          workflow: {
            primary: analysisResult.phase1Analysis?.workflow || 'unknown',
            secondary: []
          },
          priority: this.mapPriority(analysisResult.phase1Analysis?.priority || 'medium'),
          intent: analysisResult.phase1Analysis?.intent || '',
          urgency: analysisResult.phase1Analysis?.urgency || 'normal',
          confidence: analysisResult.phase1Analysis?.confidence || 0,
          suggestedState: 'New'
        },
        deep: {
          detailedWorkflow: {
            primary: analysisResult.phase2Analysis?.workflow || analysisResult.phase1Analysis?.workflow || 'unknown',
            confidence: analysisResult.phase2Analysis?.confidence || 0
          },
          entities: this.mapEntities(analysisResult),
          actionItems: this.mapActionItems(analysisResult),
          workflowState: {
            current: 'New',
            suggestedNext: 'In Review'
          },
          businessImpact: {
            customerSatisfaction: 'medium'
          },
          contextualSummary: analysisResult.phase3Analysis?.contextual_summary || ''
        },
        actionSummary: analysisResult.phase2Analysis?.action_summary || '',
        processingMetadata: {
          stage1Time: analysisResult?.processingTime?.phase1 || 0,
          stage2Time: analysisResult?.processingTime?.phase2 || 0,
          totalTime: analysisResult?.processingTime?.total || 0,
          models: {
            stage1: 'rule-based',
            stage2: analysisResult.llmUsed || 'none'
          }
        }
      });

    } catch (error) {
      logger.error('Failed to store analyzed email', 'EMAIL_INTEGRATION', {
        messageId: email.messageId,
        error
      });
      throw error;
    }
  }

  /**
   * Ingest emails from various sources and process them
   */
  public async ingestEmails(source: 'json' | 'database' | 'api', data: IngestionDataInput): Promise<IngestionBatchResult> {
    try {
      this.isProcessing = true;
      
      let emails: RawEmailData[] = [];
      
      switch (source) {
        case 'json':
          emails = this.parseJsonEmails(data as JsonEmailData | string);
          break;
        case 'database':
          emails = await this.fetchDatabaseEmails(data as DatabaseEmailCriteria);
          break;
        case 'api':
          emails = await this.fetchApiEmails(data as ApiEmailConfig);
          break;
      }

      // Map source to IngestionSource enum
      const ingestionSource: IngestionSource = 
        source === 'json' ? IngestionSource.JSON_FILE :
        source === 'database' ? IngestionSource.DATABASE :
        IngestionSource.MICROSOFT_GRAPH;

      // Ingest emails through the pipeline
      const result = await this?.emailIngestion?.ingestBatch(emails, ingestionSource);
      
      // Handle Result type
      if (!result.success) {
        throw result.error;
      }
      
      return result.data;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current processing status
   */
  public getProcessingStatus() {
    return {
      isProcessing: this.isProcessing,
      queueStatus: this?.emailIngestion?.getQueueStatus(),
      storageStats: this?.emailStorage?.getDashboardStats()
    };
  }

  /**
   * Transform priority to status color
   */
  private mapPriorityToStatus(priority: string): 'red' | 'yellow' | 'green' {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'urgent':
        return 'red';
      case 'high':
      case 'medium':
        return 'yellow';
      default:
        return 'green';
    }
  }

  /**
   * Map priority string to enum
   */
  private mapPriority(priority: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (priority.toLowerCase()) {
      case 'critical':
      case 'urgent':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Map workflow state based on analysis
   */
  private mapWorkflowState(analysis: AnalysisResult): 'START_POINT' | 'IN_PROGRESS' | 'COMPLETION' {
    const workflowState = analysis.phase2Analysis?.workflow_state || analysis.phase1Analysis?.workflow_state;
    
    if (workflowState === 'COMPLETION') {
      return 'COMPLETION';
    } else if (workflowState === 'IN_PROGRESS') {
      return 'IN_PROGRESS';
    }
    return 'START_POINT';
  }

  /**
   * Extract entities from analysis result
   */
  private extractEntities(analysis: AnalysisResult): EmailEntity[] {
    const entities: EmailEntity[] = [];
    
    // Get entities from the deepest analysis available
    const entitySource: ExtractedEntities | undefined = analysis.phase3Analysis?.entities || 
                        analysis.phase2Analysis?.entities || 
                        analysis.phase1Analysis?.entities;
    
    if (entitySource) {
      // Handle PO numbers
      if (entitySource.po_numbers && Array.isArray(entitySource.po_numbers)) {
        entitySource?.po_numbers?.forEach((po: string | number) => {
          entities.push({
            id: crypto.randomUUID(),
            type: 'po_number',
            value: String(po),
            confidence: 0.9,
            extractedAt: new Date().toISOString(),
            source: 'email_integration'
          });
        });
      }
      
      // Handle quote numbers
      if (entitySource.quote_numbers && Array.isArray(entitySource.quote_numbers)) {
        entitySource?.quote_numbers?.forEach((quote: string | number) => {
          entities.push({
            id: crypto.randomUUID(),
            type: 'quote_number',
            value: String(quote),
            confidence: 0.9,
            extractedAt: new Date().toISOString(),
            source: 'email_integration'
          });
        });
      }
      
      // Handle part numbers
      if (entitySource.part_numbers && Array.isArray(entitySource.part_numbers)) {
        entitySource?.part_numbers?.forEach((part: string | number) => {
          entities.push({
            id: crypto.randomUUID(),
            type: 'part_number',
            value: String(part),
            confidence: 0.9,
            extractedAt: new Date().toISOString(),
            source: 'email_integration'
          });
        });
      }
      
      // Handle company names (phase1 uses 'companies', phase2 uses 'company_names')  
      const companies = entitySource.companies || (entitySource as ExtractedEntities & { company_names?: (string | number)[] }).company_names;
      if (companies && Array.isArray(companies)) {
        companies.forEach((company: string | number) => {
          entities.push({
            id: crypto.randomUUID(),
            type: 'customer',
            value: String(company),
            confidence: 0.9,
            extractedAt: new Date().toISOString(),
            source: 'email_integration'
          });
        });
      }
    }
    
    return entities;
  }

  /**
   * Map entities for deep analysis
   */
  private mapEntities(analysis: AnalysisResult) {
    const phase1Entities: ExtractedEntities & { quotes?: (string | number)[]; cases?: (string | number)[]; parts?: (string | number)[] } = analysis.phase1Analysis?.entities || {};
    const phase2MissedEntities: ExtractedEntities = analysis.phase2Analysis?.missed_entities || {};
    
    return {
      poNumbers: Array.isArray(phase1Entities.po_numbers) ? 
        phase1Entities?.po_numbers?.map((po: string | number) => ({ value: String(po), format: 'standard', confidence: 0.9 })) : [],
      quoteNumbers: Array.isArray(phase1Entities.quotes) ? 
        phase1Entities?.quotes?.map((q: string | number) => ({ value: String(q), type: 'quote', confidence: 0.9 })) : [],
      caseNumbers: Array.isArray(phase1Entities.cases) ?
        phase1Entities?.cases?.map((c: string | number) => ({ value: String(c), type: 'case', confidence: 0.9 })) : [],
      partNumbers: Array.isArray(phase1Entities.parts) ? 
        phase1Entities?.parts?.map((p: string | number) => ({ value: String(p), confidence: 0.9 })) : [],
      orderReferences: [],
      contacts: []
    };
  }

  /**
   * Map action items from analysis
   */
  private mapActionItems(analysis: AnalysisResult): Array<{
    type: string;
    description: string;
    priority: string;
    slaHours: number;
    slaStatus: "on-track" | "at-risk" | "overdue";
    estimatedCompletion?: string;
  }> {
    const actionItems: Array<{
      type: string;
      description: string;
      priority: string;
      slaHours: number;
      slaStatus: "on-track" | "at-risk" | "overdue";
      estimatedCompletion?: string;
    }> = [];
    
    const actionSource: ActionItemSource[] = analysis.phase3Analysis?.action_items || 
                        analysis.phase2Analysis?.action_items || [];
    
    if (actionSource && Array.isArray(actionSource)) {
      actionSource.forEach((item: ActionItemSource) => {
        actionItems.push({
          type: 'task',
          description: typeof item === 'string' ? item : (item.description || String(item)),
          priority: (typeof item === 'object' && item.priority) ? item.priority : 'medium',
          slaHours: 24,
          slaStatus: 'on-track' as const
        });
      });
    }
    
    return actionItems;
  }

  /**
   * Parse JSON email data
   */
  private parseJsonEmails(data: JsonEmailData | string): RawEmailData[] {
    let parsedData: JsonEmailData;
    if (typeof data === 'string') {
      parsedData = JSON.parse(data);
    } else {
      parsedData = data;
    }
    
    if (!Array.isArray(parsedData)) {
      parsedData = [parsedData];
    }
    
    return parsedData?.map((email: any) => ({
      messageId: email.id || email.messageId || `msg_${Date.now()}_${Math.random()}`,
      subject: email.subject || 'No Subject',
      body: {
        content: typeof email.body === 'string' ? email.body : (email.body?.content || ''),
        contentType: (email.body?.contentType || 'text') as 'text' | 'html'
      },
      from: {
        address: (email.from as any)?.emailAddress?.address || (email.from as any)?.address || 'unknown@email.com',
        name: (email.from as any)?.emailAddress?.name || (email.from as any)?.name || 'Unknown'
      },
      to: (email.to || []).map((recipient: any) => ({
        address: recipient.emailAddress?.address || recipient.address || 'unknown@email.com',
        name: recipient.emailAddress?.name || recipient.name || 'Unknown'
      })),
      cc: (email as any).cc || [],
      receivedDateTime: email.receivedDateTime || new Date((email as any).receivedAt || Date.now()).toISOString(),
      hasAttachments: email.hasAttachments || false,
      attachments: (email as any).attachments || []
    }));
  }

  /**
   * Fetch emails from database
   */
  private async fetchDatabaseEmails(criteria: DatabaseEmailCriteria): Promise<RawEmailData[]> {
    // Implementation would fetch from your database
    // For now, return empty array
    return [];
  }

  /**
   * Fetch emails from API (Microsoft Graph, Gmail, etc.)
   */
  private async fetchApiEmails(config: ApiEmailConfig): Promise<RawEmailData[]> {
    // Implementation would fetch from external APIs
    // For now, return empty array
    return [];
  }

  /**
   * Start auto-pull mode for continuous email ingestion
   */
  public async startAutoPull(interval: number = 5): Promise<void> {
    await this?.emailIngestion?.startAutoPull();
  }

  /**
   * Stop auto-pull mode
   */
  public async stopAutoPull(): Promise<void> {
    await this?.emailIngestion?.stopAutoPull();
  }

  /**
   * Clean up resources
   */
  public async shutdown(): Promise<void> {
    await this?.emailIngestion?.shutdown();
    // EmailStorageService doesn't have a shutdown method, but we could add one if needed
  }

  /**
   * Event emitter methods
   */
  public on(event: string, listener: (...args: unknown[]) => void): void {
    // TODO: Enable when EmailIngestionService extends EventEmitter
    // this?.emailIngestion?.on(event, listener);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    // TODO: Enable when EmailIngrationService extends EventEmitter
    // this?.emailIngestion?.off(event, listener);
  }

  public emit(event: string, ...args: unknown[]): boolean {
    // TODO: Enable when EmailIngestionService extends EventEmitter
    // return this?.emailIngestion?.emit(event, ...args);
    return false;
  }
}

// Export singleton instance
export const emailIntegrationService = EmailIntegrationService.getInstance();