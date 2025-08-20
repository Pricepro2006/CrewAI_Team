/**
 * Core Module Types - Type Definitions for Core System Components
 * Comprehensive TypeScript interfaces for events, agents, services, and RAG system
 */

import { z } from 'zod';
import type { Timestamp, TimestampedEntity } from './index.js';

// ===== EVENT SYSTEM TYPES =====

export interface EventData {
  [key: string]: unknown;
}

export interface EventMetadata {
  [key: string]: unknown;
  source?: string;
  correlationId?: string;
  version?: string;
  tags?: string[];
}

export interface BaseEvent {
  id: string;
  type: string;
  data: EventData;
  metadata: EventMetadata;
  timestamp: Timestamp;
  aggregateId?: string;
  version?: number;
}

export interface EventContext {
  [key: string]: unknown;
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  source?: string;
}

export interface EventHandler<T = EventData> {
  (event: BaseEvent & { data: T }): Promise<void> | void;
}

export interface EventSubscription {
  id: string;
  eventType: string;
  handler: EventHandler;
  filter?: EventFilter;
  metadata?: EventMetadata;
}

export interface EventFilter {
  [key: string]: unknown;
  aggregateId?: string;
  source?: string;
  tags?: string[];
}

export interface AggregateData {
  [key: string]: unknown;
  version: number;
  events: BaseEvent[];
}

export interface EventStoreRecord {
  id: string;
  type: string;
  data: EventData;
  metadata: EventMetadata;
  aggregateId: string;
  version: number;
  timestamp: Timestamp;
}

// ===== EVENT MONITORING TYPES =====

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  config: AlertConfig;
  metadata?: EventMetadata;
}

export interface AlertCondition {
  type: 'threshold' | 'rate' | 'pattern' | 'anomaly';
  field: string;
  operator: '>' | '<' | '=' | '>=' | '<=' | '!=';
  value: number | string;
  window?: string; // e.g., '5m', '1h'
}

export interface AlertConfig {
  [key: string]: unknown;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
  threshold?: number;
  window?: string;
}

export interface MetricsSnapshot {
  overview: EventOverview;
  throughput: ThroughputMetrics;
  latency: LatencyMetrics;
  errors: ErrorMetrics;
  alerts: AlertMetrics;
}

export interface EventOverview {
  totalEvents: number;
  uniqueTypes: number;
  activeSubscriptions: number;
  averageLatency: number;
}

export interface ThroughputMetrics {
  eventsPerSecond: number;
  peakThroughput: number;
  averageThroughput: number;
}

export interface LatencyMetrics {
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  maxLatency: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
}

export interface AlertMetrics {
  activeAlerts: number;
  resolvedAlerts: number;
  alertsByRule: Record<string, number>;
}

// ===== AGENT SYSTEM TYPES =====

export interface AgentCapabilities {
  canProcess: string[];
  canGenerate: string[];
  tools: string[];
  maxContextSize?: number;
  supportsBatch?: boolean;
}

export interface AgentMetadata {
  [key: string]: unknown;
  version: string;
  author?: string;
  description?: string;
  tags?: string[];
  lastUpdated?: Timestamp;
}

export interface AgentConfig {
  [key: string]: unknown;
  maxRetries?: number;
  timeout?: number;
  rateLimits?: RateLimit[];
  fallbackAgent?: string;
}

export interface RateLimit {
  window: string;
  maxRequests: number;
  scope: 'global' | 'user' | 'agent';
}

export interface AgentRequest {
  id: string;
  agentId: string;
  task: string;
  context: AgentContext;
  priority?: number;
  timeout?: number;
  metadata?: AgentMetadata;
}

export interface AgentResponse {
  id: string;
  requestId: string;
  agentId: string;
  result: AgentResult;
  metadata: ResponseMetadata;
  processingTime: number;
  success: boolean;
}

export interface AgentContext {
  [key: string]: unknown;
  userId?: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
  availableTools?: string[];
  constraints?: Record<string, unknown>;
}

export interface AgentResult {
  [key: string]: unknown;
  content?: string;
  data?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  nextActions?: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Timestamp;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  [key: string]: unknown;
  tokens?: number;
  model?: string;
  temperature?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  result?: ToolCallResult;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime?: number;
}

export interface ResponseMetadata {
  [key: string]: unknown;
  requestId?: string;
  timestamp: Timestamp;
  version?: string;
  cached?: boolean;
  processingTime?: number;
}

// ===== RAG SYSTEM TYPES =====

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  embedding?: number[];
  score?: number;
}

export interface ChunkMetadata {
  [key: string]: unknown;
  sourceId: string;
  sourceType: string;
  chunkIndex: number;
  totalChunks: number;
  title?: string;
  author?: string;
  tags?: string[];
  timestamp?: Timestamp;
}

export interface RetrievalQuery {
  query: string;
  filters?: RetrievalFilters;
  limit?: number;
  threshold?: number;
  includeMetadata?: boolean;
}

export interface RetrievalFilters {
  [key: string]: unknown;
  sourceType?: string;
  tags?: string[];
  dateRange?: DateRange;
  author?: string;
}

export interface DateRange {
  start: Timestamp;
  end: Timestamp;
}

export interface RetrievalResult {
  chunks: DocumentChunk[];
  totalCount: number;
  query: string;
  processingTime: number;
  metadata?: RetrievalMetadata;
}

export interface RetrievalMetadata {
  [key: string]: unknown;
  model?: string;
  strategy?: string;
  reranked?: boolean;
  cached?: boolean;
}

export interface EmbeddingRequest {
  texts: string[];
  model?: string;
  metadata?: EmbeddingMetadata;
}

export interface EmbeddingMetadata {
  [key: string]: unknown;
  batchSize?: number;
  normalize?: boolean;
  dimensions?: number;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  processingTime: number;
  metadata?: EmbeddingMetadata;
}

// ===== SERVICE TYPES =====

export interface ServiceConfig {
  [key: string]: unknown;
  name: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
  healthCheck?: HealthCheckConfig;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  endpoint?: string;
}

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  lastCheck: Timestamp;
  metadata?: ServiceMetadata;
}

export interface ServiceMetadata {
  [key: string]: unknown;
  version?: string;
  dependencies?: Record<string, ServiceStatus>;
  metrics?: ServiceMetrics;
}

export interface ServiceMetrics {
  [key: string]: unknown;
  requestCount?: number;
  errorCount?: number;
  averageResponseTime?: number;
  throughput?: number;
}

// ===== LLM PROVIDER TYPES =====

export interface LLMRequest {
  model: string;
  messages: LLMMessage[];
  options?: LLMOptions;
  stream?: boolean;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface LLMOptions {
  [key: string]: unknown;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
}

export interface LLMResponse {
  id: string;
  model: string;
  choices: LLMChoice[];
  usage?: LLMUsage;
  metadata?: LLMMetadata;
}

export interface LLMChoice {
  index: number;
  message: LLMMessage;
  finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMMetadata {
  [key: string]: unknown;
  provider?: string;
  model?: string;
  processingTime?: number;
  cached?: boolean;
}

// ===== ZOD SCHEMAS FOR RUNTIME VALIDATION =====

export const EventDataSchema = z.record(z.unknown());
export const EventMetadataSchema = z.record(z.unknown()).default({});
export const EventContextSchema = z.record(z.unknown());
export const AgentContextSchema = z.record(z.unknown());
export const AgentResultSchema = z.record(z.unknown());
export const ServiceConfigSchema = z.record(z.unknown());
export const ChunkMetadataSchema = z.record(z.unknown());
export const RetrievalFiltersSchema = z.record(z.unknown());
export const EmbeddingMetadataSchema = z.record(z.unknown());
export const AlertConfigSchema = z.record(z.unknown());

// ===== TYPE GUARDS =====

export function isEventData(value: unknown): value is EventData {
  return typeof value === 'object' && value !== null;
}

export function isEventMetadata(value: unknown): value is EventMetadata {
  return typeof value === 'object' && value !== null;
}

export function isAgentContext(value: unknown): value is AgentContext {
  return typeof value === 'object' && value !== null;
}

export function isAgentResult(value: unknown): value is AgentResult {
  return typeof value === 'object' && value !== null;
}

export function isServiceConfig(value: unknown): value is ServiceConfig {
  return typeof value === 'object' && value !== null && 
         'name' in value && 'version' in value && 'enabled' in value;
}

export function isChunkMetadata(value: unknown): value is ChunkMetadata {
  return typeof value === 'object' && value !== null && 
         'sourceId' in value && 'sourceType' in value && 'chunkIndex' in value;
}

// ===== EMAIL ANALYSIS TYPES =====

export interface EmailWithChainAnalysis {
  chainAnalysis?: {
    chain_id: string;
    is_complete_chain: boolean;
    chain_length: number;
    completeness_score: number;
    chain_type: string;
    missing_elements: string[];
  };
}

export interface Phase2DataWithFallback {
  __directFallback?: boolean;
}

export interface RegexPattern {
  pattern: RegExp;
  description?: string;
}

export interface AxiosValidateStatus {
  validateStatus: (status: number) => boolean;
}

export interface ActionItem {
  task: string;
  owner: string;
  deadline?: string;
  revenue_impact?: string;
}

export interface DollarAmount {
  value: string;
  parsed: number;
}

export interface EntityExtractionResult {
  [key: string]: string[] | undefined;
  dollar_amounts?: string[];
  po_numbers?: string[];
  quote_numbers?: string[];
  case_numbers?: string[];
  part_numbers?: string[];
  dates?: string[];
  contacts?: string[];
}

export interface DatabaseRecord {
  [key: string]: unknown;
  id?: string;
  subject?: string;
  body?: string;
  sender_email?: string;
}

export interface FieldValidationFunction {
  (field: unknown): boolean;
}

export interface ParsingMetrics {
  successfulExtractions: number;
  failedExtractions: number;
  averageConfidence: number;
  processingTime: number;
}

// ===== DATABASE CALLBACK TYPES =====

export interface DatabaseCallback<T = unknown> {
  (db: DatabaseConnection): T | Promise<T>;
}

export interface DatabaseConnection {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => void;
  close: () => void;
}

export interface PreparedStatement {
  run: (...params: unknown[]) => StatementResult;
  get: (...params: unknown[]) => DatabaseRecord | undefined;
  all: (...params: unknown[]) => DatabaseRecord[];
  finalize: () => void;
}

export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

// ===== UTILITY FUNCTIONS =====

export function createEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createAgentRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createDocumentChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function sanitizeMetadata(metadata: unknown): EventMetadata {
  if (typeof metadata === 'object' && metadata !== null) {
    return metadata as EventMetadata;
  }
  return {};
}

// ===== TYPE ASSERTION HELPERS =====

export function isEmailWithChainAnalysis(email: unknown): email is EmailWithChainAnalysis {
  return typeof email === 'object' && email !== null && 'chainAnalysis' in email;
}

export function isPhase2DataWithFallback(data: unknown): data is Phase2DataWithFallback {
  return typeof data === 'object' && data !== null && '__directFallback' in data;
}

export function isDatabaseRecord(record: unknown): record is DatabaseRecord {
  return typeof record === 'object' && record !== null;
}

// ===== WORKER TYPES =====

export interface BatchPrompt {
  id: string;
  emailId: string;
  prompt: string;
}

export interface WorkerOptions {
  model: string;
  temperature: number;
  timeout: number;
  maxRetries: number;
}

export interface PatternMatch {
  match: string;
  index: number;
}

export interface PhaseResults {
  emailId: string;
  phase: number;
  results: unknown;
  processingTime: number;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
  name?: string;
}

export interface PatternDetectionResult {
  patterns: string[];
  confidence: number;
}