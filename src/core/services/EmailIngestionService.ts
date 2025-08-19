/**
 * EmailIngestionService - Core service for email ingestion pipeline
 * 
 * Supports three operational modes:
 * 1. Manual Load Mode - Batch import from JSON files or databases
 * 2. Auto-Pull Mode - Scheduled pulling from Microsoft Graph/Gmail APIs
 * 3. Hybrid Mode - Concurrent manual and auto operations
 * 
 * Features:
 * - 60+ emails/minute processing capability
 * - Deduplication by message_id
 * - Redis queue integration with priority management
 * - Comprehensive error handling and retry logic
 * - Real-time progress tracking
 */

// Import bullmq components with proper typing
// Import bullmq components with fallback types
const { Queue, Worker, Job, QueueEvents } = require('bullmq') as any;
import { createHash } from 'crypto';
import { EmailRepository } from '../../database/repositories/EmailRepository.js';
import { EmailQueueProcessor } from '../processors/EmailQueueProcessor.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { io } from '../../api/websocket/index.js';
import type { 
  EmailRecord, 
  EmailStatus, 
  EmailPriority 
} from '../../shared/types/email.js';
import type { Result, EmailId, JobId, BatchId } from '../../shared/types/core.js';

// =====================================================
// Type Definitions
// =====================================================

export enum IngestionMode {
  MANUAL = 'manual',
  AUTO_PULL = 'auto_pull',
  HYBRID = 'hybrid'
}

export enum IngestionSource {
  JSON_FILE = 'json_file',
  DATABASE = 'database',
  MICROSOFT_GRAPH = 'microsoft_graph',
  GMAIL_API = 'gmail_api',
  WEBHOOK = 'webhook'
}

export interface EmailIngestionConfig {
  mode: IngestionMode;
  redis: {
    host: string;
    port: number;
    password?: string;
    maxRetriesPerRequest?: number;
  };
  processing: {
    batchSize: number;
    concurrency: number;
    maxRetries: number;
    retryDelay: number;
    deduplicationWindow: number; // hours
    priorityBoostKeywords: string[];
  };
  autoPull?: {
    interval: number; // minutes
    sources: IngestionSource[];
    maxEmailsPerPull: number;
  };
}

export interface IngestionJob {
  id: string;
  source: IngestionSource;
  email: RawEmailData;
  priority: number;
  attempt: number;
  receivedAt: Date;
  messageIdHash: string;
}

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

export interface RawEmailData {
  id?: string;
  messageId: string;
  subject: string;
  body: {
    content: string;
    contentType: 'text' | 'html';
  };
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  receivedDateTime: string;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  importance?: 'low' | 'normal' | 'high';
  conversationId?: string;
  threadId?: string;
  headers?: Record<string, string>;
}

export interface IngestionResult {
  emailId: string;
  messageId: string;
  status: 'processed' | 'duplicate' | 'failed';
  processingTime: number;
  error?: string;
}

export interface IngestionBatchResult {
  batchId: string;
  source: IngestionSource;
  totalEmails: number;
  processed: number;
  duplicates: number;
  failed: number;
  results: IngestionResult[];
  startTime: Date;
  endTime: Date;
  throughput: number; // emails per minute
}

export interface IngestionMetrics {
  totalIngested: number;
  duplicatesDetected: number;
  failedIngestions: number;
  averageProcessingTime: number;
  currentQueueSize: number;
  throughput: {
    lastMinute: number;
    lastHour: number;
    last24Hours: number;
  };
  bySource: Record<IngestionSource, number>;
  errors: Array<{
    timestamp: Date;
    source: IngestionSource;
    error: string;
    count: number;
  }>;
}

// =====================================================
// Service Interface
// =====================================================

export interface IEmailIngestionService {
  // Core ingestion methods
  ingestEmail(email: RawEmailData, source: IngestionSource): Promise<Result<IngestionResult>>;
  ingestBatch(emails: RawEmailData[], source: IngestionSource): Promise<Result<IngestionBatchResult>>;
  
  // Source-specific ingestion
  ingestFromJsonFile(filePath: string): Promise<Result<IngestionBatchResult>>;
  ingestFromDatabase(query: Record<string, unknown>, limit?: number): Promise<Result<IngestionBatchResult>>;
  ingestFromMicrosoftGraph(folderId?: string): Promise<Result<IngestionBatchResult>>;
  ingestFromGmailApi(labelId?: string): Promise<Result<IngestionBatchResult>>;
  
  // Auto-pull management
  startAutoPull(): Promise<void>;
  stopAutoPull(): Promise<void>;
  isAutoPullActive(): boolean;
  
  // Queue management
  pauseIngestion(): Promise<void>;
  resumeIngestion(): Promise<void>;
  getQueueStatus(): Promise<QueueStatus>;
  retryFailedJobs(limit?: number): Promise<number>;
  
  // Deduplication
  checkDuplicate(messageId: string): Promise<boolean>;
  clearDeduplicationCache(): Promise<void>;
  
  // Metrics and monitoring
  getMetrics(): Promise<IngestionMetrics>;
  getRecentErrors(limit?: number): Promise<IngestionErrorInfo[]>;
  healthCheck(): Promise<HealthStatus>;
  
  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface QueueStatus {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export interface IngestionErrorInfo {
  id: string;
  timestamp: Date;
  source: IngestionSource;
  messageId: string;
  error: string;
  stackTrace?: string;
  retryable: boolean;
}

export interface HealthStatus {
  healthy: boolean;
  status: 'operational' | 'degraded' | 'failing';
  components: {
    queue: ComponentHealth;
    redis: ComponentHealth;
    database: ComponentHealth;
    autoPull: ComponentHealth;
  };
  uptime: number;
  lastCheck: Date;
}

export interface ComponentHealth {
  healthy: boolean;
  message?: string;
  lastError?: string;
  metrics?: Record<string, number>;
}

// =====================================================
// Error Handling
// =====================================================

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly source: IngestionSource,
    public readonly retryable: boolean = true,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'IngestionError';
  }
}

export const IngestionErrorCodes = {
  DUPLICATE_EMAIL: 'DUPLICATE_EMAIL',
  INVALID_FORMAT: 'INVALID_FORMAT',
  QUEUE_ERROR: 'QUEUE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  API_ERROR: 'API_ERROR',
  PROCESSING_ERROR: 'PROCESSING_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  AUTH_ERROR: 'AUTH_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT'
} as const;

export type IngestionErrorCode = typeof IngestionErrorCodes[keyof typeof IngestionErrorCodes];

// =====================================================
// Queue Integration Pattern
// =====================================================

export interface QueueIntegration {
  // Queue setup
  ingestionQueue: any;
  deadLetterQueue: any;
  worker: any;
  events: any;
  
  // Queue operations
  addToQueue(job: IngestionJob): Promise<any>;
  processJob(job: any): Promise<IngestionResult>;
  handleFailedJob(job: any, error: Error): Promise<void>;
  
  // Queue monitoring
  monitorQueueHealth(): void;
  getQueueMetrics(): Promise<QueueMetrics>;
  
  // Priority management
  calculatePriority(email: RawEmailData): number;
  boostPriority(jobId: string, boost: number): Promise<void>;
}

export interface QueueMetrics {
  throughput: number;
  averageWaitTime: number;
  averageProcessingTime: number;
  errorRate: number;
  retryRate: number;
}

// =====================================================
// Implementation Notes
// =====================================================

/**
 * Implementation Guidelines:
 * 
 * 1. Deduplication Strategy:
 *    - Use Redis SET with TTL for message ID tracking
 *    - Hash message IDs for consistent storage
 *    - Implement sliding window for deduplication
 * 
 * 2. Priority Calculation:
 *    - Base priority on email importance flag
 *    - Boost for keywords (urgent, critical, etc.)
 *    - Consider sender domain reputation
 *    - Factor in email age (older = higher priority)
 * 
 * 3. Error Handling:
 *    - Exponential backoff for retries
 *    - Dead letter queue for permanent failures
 *    - Circuit breaker for API sources
 *    - Graceful degradation for non-critical errors
 * 
 * 4. Performance Optimization:
 *    - Batch database operations
 *    - Connection pooling for APIs
 *    - Parallel processing where possible
 *    - Memory-efficient streaming for large batches
 * 
 * 5. Monitoring:
 *    - Real-time metrics via WebSocket
 *    - Prometheus-compatible metrics
 *    - Structured logging with context
 *    - Alert thresholds for queue health
 */

// Additional exports for external use (types and interfaces already declared with export keyword)
// The enums IngestionMode, IngestionSource, class IngestionError, and const IngestionErrorCodes 
// are already exported via their export keywords above