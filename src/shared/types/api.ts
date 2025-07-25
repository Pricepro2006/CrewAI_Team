/**
 * API Types and Interfaces
 * Comprehensive type definitions for all API endpoints and contracts
 */

import type { z } from 'zod';
import type { Timestamp, PaginationRequest, PaginationResponse, ApiResponse } from './index';
import type { Message, Conversation, Task, Document, TokenUsage } from './core';
import type { ApiError } from './errors';

// =====================================================
// Common API Types
// =====================================================

export interface ApiContext {
  requestId: string;
  timestamp: Timestamp;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  ipAddress?: string;
  route: string;
  method: string;
  version: string;
}

export interface ApiMetrics {
  requestCount: number;
  responseTime: number;
  errorRate: number;
  cacheHitRate: number;
  throughput: number;
  activeConnections: number;
}

// =====================================================
// Request/Response Types
// =====================================================

export interface CreateRequest<T> {
  data: T;
  options?: CreateOptions;
}

export interface UpdateRequest<T> {
  id: string;
  data: Partial<T>;
  options?: UpdateOptions;
}

export interface DeleteRequest {
  id: string;
  options?: DeleteOptions;
}

export interface GetRequest {
  id: string;
  options?: GetOptions;
}

export interface ListRequest extends PaginationRequest {
  filters?: Record<string, unknown>;
  includes?: string[];
  exclude?: string[];
}

export interface BulkRequest<T> {
  items: T[];
  options?: BulkOptions;
}

export interface SearchRequest extends PaginationRequest {
  query: string;
  filters?: SearchFilters;
  facets?: string[];
  highlight?: boolean;
  options?: SearchOptions;
}

// =====================================================
// Request Options
// =====================================================

export interface CreateOptions {
  returnFields?: string[];
  validate?: boolean;
  skipDuplicateCheck?: boolean;
  metadata?: Record<string, unknown>;
}

export interface UpdateOptions {
  returnFields?: string[];
  validate?: boolean;
  ifMatch?: string; // ETag for optimistic concurrency
  metadata?: Record<string, unknown>;
}

export interface DeleteOptions {
  force?: boolean; // Hard delete vs soft delete
  cascade?: boolean; // Delete related records
  ifMatch?: string; // ETag for optimistic concurrency
}

export interface GetOptions {
  include?: string[]; // Related resources to include
  fields?: string[]; // Specific fields to return
  version?: string; // Specific version to return
}

export interface BulkOptions {
  continueOnError?: boolean;
  batchSize?: number;
  parallel?: boolean;
  validate?: boolean;
}

export interface SearchOptions {
  fuzzy?: boolean;
  boost?: Record<string, number>;
  minimumShouldMatch?: number;
  timeout?: number;
}

export interface SearchFilters {
  dateRange?: {
    field: string;
    start: Timestamp;
    end: Timestamp;
  };
  terms?: Record<string, string | string[]>;
  range?: Record<string, {
    min?: number;
    max?: number;
  }>;
  exists?: string[];
  missing?: string[];
}

// =====================================================
// Validation Schemas
// =====================================================

export interface ValidationSchema<T = unknown> {
  input?: z.ZodSchema<T>;
  output?: z.ZodSchema<T>;
  params?: z.ZodSchema<Record<string, string>>;
  query?: z.ZodSchema<Record<string, unknown>>;
  headers?: z.ZodSchema<Record<string, string>>;
}

export interface EndpointDefinition<
  TInput = unknown,
  TOutput = unknown,
  TParams = Record<string, string>,
  TQuery = Record<string, unknown>
> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  schema: ValidationSchema<TInput>;
  responses: Record<string, ResponseDefinition<TOutput>>;
  security?: SecurityRequirement[];
  rateLimit?: RateLimitDefinition;
  cache?: CacheDefinition;
  middleware?: string[];
}

export interface ResponseDefinition<T = unknown> {
  description: string;
  schema?: z.ZodSchema<T>;
  examples?: Record<string, T>;
  headers?: Record<string, HeaderDefinition>;
}

export interface HeaderDefinition {
  description: string;
  schema: z.ZodSchema<string>;
  required?: boolean;
}

export interface SecurityRequirement {
  type: 'bearer' | 'apiKey' | 'oauth2' | 'basic';
  scheme?: string;
  bearerFormat?: string;
  in?: 'header' | 'query' | 'cookie';
  name?: string;
  scopes?: string[];
}

export interface RateLimitDefinition {
  requests: number;
  windowMs: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: string;
}

export interface CacheDefinition {
  ttl: number;
  vary?: string[];
  tags?: string[];
  invalidateOn?: string[];
}

// =====================================================
// API Router Types
// =====================================================

export interface RouterConfig {
  prefix?: string;
  middleware?: string[];
  rateLimit?: RateLimitDefinition;
  cors?: CorsOptions;
  security?: SecurityRequirement[];
  validation?: ValidationConfig;
}

export interface CorsOptions {
  origins: string[] | string | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
}

export interface ValidationConfig {
  validateInput: boolean;
  validateOutput: boolean;
  sanitizeInput: boolean;
  stripUnknown: boolean;
  abortEarly: boolean;
}

// =====================================================
// Specific API Contracts
// =====================================================

// Chat API
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
  stream?: boolean;
  options?: ChatOptions;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  logitBias?: Record<string, number>;
  user?: string;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | ToolChoice;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolChoice {
  type: 'function';
  function: {
    name: string;
  };
}

export interface ChatResponse {
  id: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
  model: string;
  systemFingerprint?: string;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  delta?: ChatMessage; // For streaming responses
}

// TokenUsage is defined in core.ts to avoid duplication

// Agent API
export interface AgentRequest {
  task: string;
  context?: AgentContext;
  options?: AgentOptions;
}

export interface AgentContext {
  conversationId?: string;
  userId?: string;
  sessionId?: string;
  previousResults?: unknown[];
  documents?: Document[];
  tools?: string[];
  constraints?: AgentConstraints;
}

export interface AgentOptions {
  timeout?: number;
  maxRetries?: number;
  priority?: 'low' | 'medium' | 'high';
  async?: boolean;
  callbacks?: AgentCallbacks;
}

export interface AgentConstraints {
  maxSteps?: number;
  maxTokens?: number;
  allowedTools?: string[];
  forbiddenActions?: string[];
  timeLimit?: number;
  budgetLimit?: number;
}

export interface AgentCallbacks {
  onProgress?: (step: AgentStep) => void;
  onComplete?: (result: AgentResult) => void;
  onError?: (error: ApiError) => void;
  onToolCall?: (tool: string, params: unknown) => void;
}

export interface AgentStep {
  stepId: string;
  type: 'thinking' | 'tool_call' | 'response';
  content: string;
  tool?: string;
  parameters?: unknown;
  result?: unknown;
  timestamp: Timestamp;
}

export interface AgentResult {
  success: boolean;
  result?: unknown;
  steps: AgentStep[];
  usage: TokenUsage;
  metadata: AgentMetadata;
}

export interface AgentMetadata {
  agentType: string;
  model: string;
  totalSteps: number;
  executionTime: number;
  toolsCalled: string[];
  confidence?: number;
  reasoning?: string;
}

// Task API
export interface CreateTaskRequest {
  type: 'agent' | 'tool' | 'composite' | 'human';
  title: string;
  description?: string;
  input?: unknown;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  dependencies?: string[];
  deadline?: Timestamp;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface TaskResponse extends Task {
  progress?: TaskProgress;
  logs?: TaskLog[];
  children?: Task[];
  parent?: Task;
}

export interface TaskProgress {
  percentage: number;
  currentStep: string;
  totalSteps: number;
  estimatedCompletion: Timestamp;
}

export interface TaskLog {
  timestamp: Timestamp;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, unknown>;
}

// RAG API
export interface RAGRequest {
  query: string;
  options?: RAGOptions;
  filters?: RAGFilters;
}

export interface RAGOptions {
  topK?: number;
  threshold?: number;
  rerank?: boolean;
  includeMetadata?: boolean;
  contextWindow?: number;
  temperature?: number;
}

export interface RAGFilters {
  sources?: string[];
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  confidence: number;
  reasoning?: string;
  usage: TokenUsage;
}

export interface RAGSource {
  id: string;
  title: string;
  content: string;
  relevanceScore: number;
  source: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

// Document API
export interface CreateDocumentRequest {
  title: string;
  content: string;
  contentType: 'text/plain' | 'text/markdown' | 'text/html' | 'application/json';
  source?: string;
  url?: string;
  author?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DocumentResponse extends Document {
  chunks?: DocumentChunkResponse[];
  similar?: DocumentSimilarity[];
}

export interface DocumentChunkResponse {
  id: string;
  documentId: string;
  content: string;
  index: number;
  startOffset: number;
  endOffset: number;
  tokens?: number;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

export interface DocumentSimilarity {
  documentId: string;
  title: string;
  score: number;
  explanation?: string;
}

// Upload API
export interface UploadRequest {
  file: File | Buffer;
  filename: string;
  contentType: string;
  metadata?: Record<string, unknown>;
}

export interface UploadResponse {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, unknown>;
}

// Analytics API
export interface AnalyticsRequest {
  metric: string;
  dimensions?: string[];
  filters?: Record<string, unknown>;
  dateRange: {
    start: Timestamp;
    end: Timestamp;
  };
  granularity?: 'hour' | 'day' | 'week' | 'month';
}

export interface AnalyticsResponse {
  metric: string;
  data: AnalyticsDataPoint[];
  total?: number;
  aggregations?: Record<string, number>;
}

export interface AnalyticsDataPoint {
  timestamp: Timestamp;
  value: number;
  dimensions?: Record<string, string | number>;
}

// Export/Import API
export interface ExportRequest {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  type: 'conversations' | 'tasks' | 'documents' | 'analytics';
  filters?: Record<string, unknown>;
  options?: ExportOptions;
}

export interface ExportOptions {
  fields?: string[];
  includeMetadata?: boolean;
  compression?: boolean;
  password?: string;
}

export interface ExportResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  expiresAt: Timestamp;
  size?: number;
  recordCount?: number;
}

export interface ImportRequest {
  format: 'json' | 'csv' | 'xlsx';
  type: 'conversations' | 'tasks' | 'documents';
  file: File | Buffer;
  options?: ImportOptions;
}

export interface ImportOptions {
  skipValidation?: boolean;
  updateExisting?: boolean;
  batchSize?: number;
  mapping?: Record<string, string>;
}

export interface ImportResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processed: number;
  total: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export interface ImportError {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}

export interface ImportWarning {
  row: number;
  field: string;
  message: string;
  value?: unknown;
}