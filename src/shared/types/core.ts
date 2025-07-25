/**
 * Core System Types
 * Fundamental data structures used throughout the application
 */

// Define base types locally to avoid circular imports
export type Timestamp = string; // ISO 8601 string

export interface TimestampedEntity {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Import database configs to avoid duplication
import type { 
  DatabaseConfig, 
  PoolConfig, 
  MigrationConfig, 
  BackupConfig,
  LoggingConfig,
  EncryptionConfig
} from './database';

// =====================================================
// Base Entity Types
// =====================================================

export interface BaseEntity extends TimestampedEntity {
  id: string;
}

export interface BaseEntityWithMetadata extends BaseEntity {
  metadata?: Record<string, unknown>;
  tags?: string[];
  version?: number;
}

// =====================================================
// Core Business Types
// =====================================================

export interface Document extends BaseEntity {
  title: string;
  content: string;
  contentType: 'text/plain' | 'text/markdown' | 'text/html' | 'application/json';
  sourceId?: string;
  author?: string;
  url?: string;
  size?: number;
  checksum?: string;
  language?: string;
  chunks?: DocumentChunk[];
  metadata: DocumentMetadata;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  tokens?: number;
  embedding?: number[];
  metadata?: ChunkMetadata;
}

export interface DocumentMetadata {
  sourceId: string;
  title?: string;
  author?: string;
  description?: string;
  keywords?: string[];
  category?: string;
  confidenceScore?: number;
  processingVersion?: string;
  extractedEntities?: EntityExtraction[];
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: unknown;
}

export interface ChunkMetadata {
  headings?: string[];
  pageNumber?: number;
  sectionTitle?: string;
  relevanceScore?: number;
  semanticDensity?: number;
  [key: string]: unknown;
}

export interface EntityExtraction {
  type: 'person' | 'organization' | 'location' | 'date' | 'product' | 'custom';
  value: string;
  confidence: number;
  startPosition: number;
  endPosition: number;
  metadata?: Record<string, unknown>;
}

// =====================================================
// Message and Conversation Types
// =====================================================

export interface Message extends BaseEntity {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | MessageContent;
  conversationId?: string;
  parentMessageId?: string;
  threadId?: string;
  userId?: string;
  metadata?: MessageMetadata;
}

export interface MessageContent {
  text?: string;
  html?: string;
  markdown?: string;
  attachments?: MessageAttachment[];
  embeds?: MessageEmbed[];
  mentions?: string[];
}

export interface MessageAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageEmbed {
  type: 'image' | 'video' | 'link' | 'file' | 'code';
  url: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageMetadata {
  sentiment?: 'positive' | 'negative' | 'neutral';
  confidence?: number;
  language?: string;
  topics?: string[];
  entities?: EntityExtraction[];
  intent?: string;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  requiresAction?: boolean;
  actionType?: string;
  estimatedResponseTime?: number;
  processingTime?: number;
  tokenCount?: number;
  modelUsed?: string;
}

export interface Conversation extends BaseEntity {
  title?: string;
  participantIds: string[];
  messages: Message[];
  status: 'active' | 'archived' | 'closed';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  category?: string;
  lastActivityAt: Timestamp;
  metadata?: ConversationMetadata;
}

export interface ConversationMetadata {
  source: 'web' | 'api' | 'webhook' | 'import' | 'system';
  channel?: string;
  assignedTo?: string;
  labels?: string[];
  customFields?: Record<string, unknown>;
  analytics?: {
    messageCount: number;
    averageResponseTime: number;
    sentimentScore: number;
    satisfactionRating?: number;
  };
}

// =====================================================
// Task and Workflow Types
// =====================================================

export interface Task extends BaseEntity {
  type: 'agent' | 'tool' | 'composite' | 'human';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description?: string;
  input?: unknown;
  output?: unknown;
  error?: TaskError;
  parentTaskId?: string;
  dependencies?: string[];
  assignedTo?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  metadata?: TaskMetadata;
}

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
  details?: Record<string, unknown>;
  isRecoverable: boolean;
  retryAfter?: number;
}

export interface TaskMetadata {
  agentType?: string;
  toolName?: string;
  modelUsed?: string;
  tokenUsage?: TokenUsage;
  contextSize?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkCalls?: number;
  cacheHits?: number;
  cacheMisses?: number;
  customData?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// =====================================================
// Configuration Types
// =====================================================

export interface SystemConfig {
  version: string;
  environment: 'development' | 'staging' | 'production';
  features: FeatureFlags;
  limits: SystemLimits;
  services: ServiceConfiguration;
  security: SecurityConfiguration;
}

export interface FeatureFlags {
  [key: string]: boolean | FeatureFlag;
}

export interface FeatureFlag {
  enabled: boolean;
  rolloutPercentage?: number;
  conditions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface SystemLimits {
  maxConcurrentTasks: number;
  maxMessageLength: number;
  maxFileSize: number;
  maxConversationLength: number;
  requestTimeout: number;
  rateLimits: RateLimits;
}

export interface RateLimits {
  requests: RateLimit;
  uploads: RateLimit;
  websocket: RateLimit;
  api: Record<string, RateLimit>;
}

export interface RateLimit {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface ServiceConfiguration {
  database: DatabaseConfig;
  llm: LLMConfig;
  vectorStore: VectorStoreConfig;
  cache: CacheConfig;
  websocket: WebSocketConfig;
  monitoring: MonitoringConfig;
}

// DatabaseConfig, PoolConfig, MigrationConfig, BackupConfig are imported from './database'

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'huggingface';
  baseUrl?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  retries?: number;
  cache?: boolean;
}

export interface VectorStoreConfig {
  type: 'chromadb' | 'pinecone' | 'weaviate' | 'qdrant';
  url?: string;
  apiKey?: string;
  collection: string;
  dimension: number;
  indexName?: string;
  namespace?: string;
  metadata?: Record<string, unknown>;
}

export interface CacheConfig {
  provider: 'redis' | 'memory' | 'file';
  url?: string;
  ttl: number;
  maxSize?: number;
  compression?: boolean;
}

export interface WebSocketConfig {
  port?: number;
  path: string;
  cors: string[];
  heartbeat: number;
  maxConnections: number;
  messageQueue: QueueConfig;
}

export interface QueueConfig {
  type: 'memory' | 'redis' | 'sqs' | 'rabbitmq';
  url?: string;
  maxSize: number;
  strategy: 'fifo' | 'lifo' | 'priority';
  retryPolicy: RetryPolicy;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface MonitoringConfig {
  metrics: MetricsConfig;
  logging: LoggingConfig;
  tracing: TracingConfig;
  alerts: AlertConfig[];
}

export interface MetricsConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  aggregation: string[];
  exports: MetricExport[];
}

export interface MetricExport {
  type: 'prometheus' | 'statsd' | 'datadog' | 'cloudwatch';
  endpoint?: string;
  apiKey?: string;
  tags?: Record<string, string>;
}

// LoggingConfig is imported from './database'

export interface LogOutput {
  type: 'console' | 'file' | 'elasticsearch' | 'cloudwatch';
  path?: string;
  maxSize?: string;
  maxFiles?: number;
  endpoint?: string;
}

export interface SamplingConfig {
  enabled: boolean;
  rate: number;
  rules: SamplingRule[];
}

export interface SamplingRule {
  level: string;
  rate: number;
  conditions?: Record<string, unknown>;
}

export interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  endpoint?: string;
  sampleRate: number;
  headers?: Record<string, string>;
}

export interface AlertConfig {
  name: string;
  condition: string;
  threshold: number;
  duration: number;
  channels: string[];
  metadata?: Record<string, unknown>;
}

export interface SecurityConfiguration {
  authentication: AuthConfig;
  authorization: AuthzConfig;
  encryption: EncryptionConfig;
  cors: CorsConfig;
  csrf: CsrfConfig;
  rateLimit: RateLimitConfig;
}

export interface AuthConfig {
  jwt: JwtConfig;
  session: SessionConfig;
  oauth?: OAuthConfig[];
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
  issuer: string;
  audience: string;
  algorithm: string;
}

export interface SessionConfig {
  secret: string;
  maxAge: number;
  secure: boolean;
  sameSite: boolean | 'strict' | 'lax' | 'none';
  store?: SessionStoreConfig;
}

export interface SessionStoreConfig {
  type: 'memory' | 'redis' | 'database';
  url?: string;
  prefix?: string;
}

export interface OAuthConfig {
  provider: 'google' | 'github' | 'microsoft' | 'custom';
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
  scopes: string[];
}

export interface AuthzConfig {
  rbac: RbacConfig;
  permissions: PermissionConfig[];
}

export interface RbacConfig {
  roles: RoleConfig[];
  inheritance: boolean;
  caching: boolean;
}

export interface RoleConfig {
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
}

export interface PermissionConfig {
  name: string;
  description: string;
  resource: string;
  actions: string[];
}

// EncryptionConfig is imported from './database'

export interface SecretConfig {
  name: string;
  provider: 'env' | 'file' | 'vault' | 'aws' | 'azure';
  path?: string;
  key?: string;
}

export interface CorsConfig {
  origins: string[] | boolean;
  methods: string[];
  headers: string[];
  credentials: boolean;
  maxAge?: number;
}

export interface CsrfConfig {
  enabled: boolean;
  secret?: string;
  cookie: CookieConfig;
  ignoredMethods?: string[];
}

export interface CookieConfig {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: boolean | 'strict' | 'lax' | 'none';
  maxAge?: number;
}

export interface RateLimitConfig {
  global: RateLimit;
  perUser: RateLimit;
  perIP: RateLimit;
  endpoints: Record<string, RateLimit>;
}