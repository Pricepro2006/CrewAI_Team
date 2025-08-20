/**
 * Enhanced API Types - Comprehensive type definitions to eliminate 'any' usage
 * This file provides strongly typed interfaces for all API operations
 */

import type { Request, Response, NextFunction } from 'express';
import type { WebSocket } from 'ws';
import type { ZodSchema } from 'zod';
import type { TokenUsage, Timestamp, ApiResponse, PaginationRequest, PaginationResponse } from './index.js';

// =====================================================
// Enhanced Request/Response Types
// =====================================================

// Generic authenticated request
export interface AuthenticatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = Record<string, string>
> extends Request<TParams, unknown, TBody, TQuery> {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  sessionId?: string;
  csrfToken?: string;
  requestId: string;
}

// Enhanced response with typing
export interface TypedResponse<TData = unknown> extends Response {
  json(data: ApiResponse<TData>): this;
}

// Middleware with proper typing
export interface TypedMiddleware<
  TReq = AuthenticatedRequest,
  TRes = TypedResponse
> {
  (req: TReq, res: TRes, next: NextFunction): void | Promise<void>;
}

// =====================================================
// Database Query Types
// =====================================================

export interface DatabaseRow {
  [key: string]: string | number | boolean | null | Date;
}

export interface QueryResult<T extends DatabaseRow = DatabaseRow> {
  rows: T[];
  rowCount: number;
  affectedRows?: number;
}

export interface QueryParameters {
  [key: string]: string | number | boolean | null | Date | string[] | number[];
}

export interface PreparedStatement {
  query: string;
  parameters: QueryParameters;
}

// =====================================================
// WebSocket Types
// =====================================================

export interface WebSocketMessage<TData = unknown> {
  type: string;
  data: TData;
  timestamp: Timestamp;
  id?: string;
  correlationId?: string;
}

export interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  userId?: string;
  subscriptions: Set<string>;
  lastActivity: Timestamp;
  metadata: Record<string, unknown>;
}

export interface WebSocketHandler<TData = unknown> {
  (connection: WebSocketConnection, message: WebSocketMessage<TData>): Promise<void>;
}

// =====================================================
// Email System Types
// =====================================================

export interface EmailRecord {
  id: string;
  subject: string;
  body: string;
  sender: string;
  recipient: string;
  timestamp: Timestamp;
  phase_1_results?: string; // JSON string
  phase_2_results?: string; // JSON string
  phase_3_results?: string; // JSON string
  chain_id?: string;
  is_complete_chain?: boolean;
  metadata?: Record<string, unknown>;
}

export interface EmailAnalysisResult {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  entities: EmailEntity[];
  intent: string;
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface EmailEntity {
  type: 'person' | 'organization' | 'location' | 'product' | 'date' | 'other';
  value: string;
  confidence: number;
  position: {
    start: number;
    end: number;
  };
}

export interface EmailProcessingRequest {
  emailIds: string[];
  phase: 1 | 2 | 3;
  options: {
    skipExisting?: boolean;
    batchSize?: number;
    priority?: 'low' | 'medium' | 'high';
  };
}

export interface EmailProcessingResponse {
  processedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: ProcessingError[];
  results: EmailAnalysisResult[];
}

export interface ProcessingError {
  emailId: string;
  error: string;
  stack?: string;
  timestamp: Timestamp;
}

// =====================================================
// Walmart System Types
// =====================================================

export interface WalmartProduct {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl?: string;
  description?: string;
  category: string;
  inStock: boolean;
  walmartId: string;
  upc?: string;
  metadata: Record<string, unknown>;
}

export interface WalmartOrder {
  id: string;
  orderNumber: string;
  orderDate: Timestamp;
  total: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: WalmartOrderItem[];
  shippingAddress?: Address;
  metadata: Record<string, unknown>;
}

export interface WalmartOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface WalmartSearchRequest {
  query: string;
  filters?: {
    category?: string;
    priceRange?: {
      min: number;
      max: number;
    };
    inStockOnly?: boolean;
  };
  sort?: 'relevance' | 'price_low' | 'price_high' | 'rating';
  pagination: PaginationRequest;
}

export interface WalmartSearchResponse extends PaginationResponse<WalmartProduct> {
  facets: SearchFacet[];
  suggestions: string[];
}

export interface SearchFacet {
  name: string;
  values: FacetValue[];
}

export interface FacetValue {
  value: string;
  count: number;
  selected: boolean;
}

// =====================================================
// Agent System Types
// =====================================================

export interface AgentExecutionRequest {
  agentType: 'research' | 'data_analysis' | 'code' | 'writer' | 'tool_executor' | 'email_analysis';
  task: string;
  context: {
    documents?: DocumentReference[];
    previousResults?: ExecutionResult[];
    constraints?: ExecutionConstraints;
  };
  options: {
    timeout?: number;
    maxRetries?: number;
    streaming?: boolean;
  };
}

export interface DocumentReference {
  id: string;
  title: string;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface ExecutionResult {
  agentType: string;
  result: unknown;
  confidence: number;
  reasoning: string;
  usage: TokenUsage;
  timestamp: Timestamp;
}

export interface ExecutionConstraints {
  maxTokens?: number;
  maxSteps?: number;
  allowedTools?: string[];
  timeLimit?: number;
}

export interface AgentStatus {
  id: string;
  type: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: string;
  lastActivity: Timestamp;
  metrics: {
    totalTasks: number;
    successRate: number;
    averageResponseTime: number;
  };
}

// =====================================================
// RAG System Types
// =====================================================

export interface RAGQueryRequest {
  query: string;
  options: {
    topK?: number;
    threshold?: number;
    includeMetadata?: boolean;
    rerank?: boolean;
  };
  filters: {
    sources?: string[];
    documentTypes?: string[];
    dateRange?: {
      start: Timestamp;
      end: Timestamp;
    };
  };
}

export interface RAGQueryResponse {
  results: RAGResult[];
  totalCount: number;
  query: string;
  processingTime: number;
}

export interface RAGResult {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    title: string;
    timestamp: Timestamp;
    documentType: string;
    chunkIndex?: number;
  };
}

// =====================================================
// Monitoring and Metrics Types
// =====================================================

export interface MetricsSnapshot {
  timestamp: Timestamp;
  system: {
    memory: MemoryMetrics;
    cpu: CPUMetrics;
    disk: DiskMetrics;
  };
  application: {
    requestCount: number;
    errorRate: number;
    responseTime: ResponseTimeMetrics;
    activeConnections: number;
  };
  services: Record<string, ServiceMetrics>;
}

export interface MemoryMetrics {
  used: number;
  total: number;
  percentage: number;
  heap: {
    used: number;
    total: number;
  };
}

export interface CPUMetrics {
  usage: number;
  loadAverage: number[];
  cores: number;
}

export interface DiskMetrics {
  used: number;
  total: number;
  percentage: number;
}

export interface ResponseTimeMetrics {
  mean: number;
  median: number;
  p95: number;
  p99: number;
}

export interface ServiceMetrics {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  throughput: number;
  lastCheck: Timestamp;
}

// =====================================================
// Task Management Types
// =====================================================

export interface TaskDefinition {
  id: string;
  type: 'agent_execution' | 'data_processing' | 'email_analysis' | 'walmart_scraping';
  priority: 'low' | 'medium' | 'high' | 'critical';
  payload: unknown;
  options: {
    retryCount?: number;
    maxRetries?: number;
    delay?: number;
    timeout?: number;
  };
  metadata: Record<string, unknown>;
}

export interface TaskResult {
  taskId: string;
  status: 'completed' | 'failed' | 'timeout' | 'cancelled';
  result?: unknown;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
  startTime: Timestamp;
  endTime: Timestamp;
  duration: number;
}

// =====================================================
// Security Types
// =====================================================

export interface SecurityContext {
  userId?: string;
  sessionId?: string;
  permissions: string[];
  roles: string[];
  ipAddress: string;
  userAgent: string;
  timestamp: Timestamp;
}

export interface AuthToken {
  type: 'bearer' | 'api_key';
  value: string;
  expiresAt?: Timestamp;
  permissions: string[];
  metadata: Record<string, unknown>;
}

export interface CSRFToken {
  value: string;
  expiresAt: Timestamp;
  sessionId: string;
}

// =====================================================
// Configuration Types
// =====================================================

export interface APIConfiguration {
  port: number;
  host: string;
  cors: {
    origins: string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
    skipSuccessfulRequests: boolean;
  };
  security: {
    enableCSRF: boolean;
    enableHelmet: boolean;
    trustProxy: boolean;
  };
  database: {
    url: string;
    poolSize: number;
    timeout: number;
  };
  redis: {
    url: string;
    keyPrefix: string;
    retryDelay: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    format: 'json' | 'text';
  };
}

// =====================================================
// Error Types
// =====================================================

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: Timestamp;
  requestId?: string;
  userId?: string;
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  value?: unknown;
  constraint?: string;
}

// =====================================================
// Health Check Types
// =====================================================

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  timestamp: Timestamp;
  details?: Record<string, unknown>;
  error?: string;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  timestamp: Timestamp;
  uptime: number;
}

// =====================================================
// Enhanced Database Types
// =====================================================

// Better-sqlite3 database types
export interface DatabaseConnection {
  prepare: (sql: string) => DatabaseStatement;
  exec: (sql: string) => void;
  close: () => void;
  transaction: <T>(fn: () => T) => T;
}

export interface DatabaseStatement {
  run: (...params: (string | number | boolean | null)[]) => DatabaseRunResult;
  get: (...params: (string | number | boolean | null)[]) => DatabaseRow | undefined;
  all: (...params: (string | number | boolean | null)[]) => DatabaseRow[];
  iterate: (...params: (string | number | boolean | null)[]) => IterableIterator<DatabaseRow>;
}

export interface DatabaseRunResult {
  changes: number;
  lastInsertRowid: number;
}

// Lazy loader type
export interface LazyLoader<T> {
  get: () => Promise<T>;
  clear: () => void;
  isLoaded: () => boolean;
}

// Email-specific database row types
export interface EmailDatabaseRow extends DatabaseRow {
  id: string;
  sender_email: string;
  sender_name?: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body: string;
  received_date_time: string;
  conversation_id?: string;
  thread_id?: string;
  chain_id?: string;
  phase_1_results?: string; // JSON string
  phase_2_results?: string; // JSON string
  phase_3_results?: string; // JSON string
  is_complete_chain?: boolean;
  message_id?: string;
  message_type?: string;
  importance?: string;
  has_attachments?: boolean;
  folder_path?: string;
  internet_message_id?: string;
  in_reply_to?: string;
  references?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowPatternRow extends DatabaseRow {
  id: string;
  pattern_type: string;
  pattern_value: string;
  confidence: number;
  description?: string;
  category?: string;
}

export interface ChainAnalysisRow extends DatabaseRow {
  conversation_id: string;
  chain_length: number;
  first_email: string;
  last_email: string;
  participant_count: number;
  is_complete?: boolean;
}

// =====================================================
// Type Guards
// =====================================================

export function isAuthenticatedRequest(req: Request): req is AuthenticatedRequest {
  return 'user' in req && typeof req.user === 'object';
}

export function isDatabaseRow(obj: unknown): obj is DatabaseRow {
  return typeof obj === 'object' && obj !== null;
}

export function isWebSocketMessage<T = unknown>(obj: unknown): obj is WebSocketMessage<T> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    'data' in obj &&
    typeof (obj as WebSocketMessage).type === 'string'
  );
}

export function isEmailRecord(obj: unknown): obj is EmailRecord {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'subject' in obj &&
    'body' in obj &&
    typeof (obj as EmailRecord).id === 'string'
  );
}
