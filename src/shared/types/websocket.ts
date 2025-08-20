/**
 * WebSocket Event Architecture
 * Comprehensive type definitions for real-time features
 */

import type { Timestamp } from "./core.js";
import type {
  Task,
  Message,
  Document,
  Conversation,
  MessageMetadata,
  MonitoringConfig,
} from "./core.js";
import type { EmailRecord } from "./email.js";
import type {
  AgentResult,
  AgentStep as ApiAgentStep,
  ApiTaskLog,
} from "./api.js";

// =====================================================
// Core WebSocket Types
// =====================================================

export interface WebSocketConnection {
  id: string;
  userId?: string;
  sessionId: string;
  channels: string[];
  metadata: ConnectionMetadata;
  connectedAt: Timestamp;
  lastActivity: Timestamp;
  status: "connecting" | "connected" | "disconnected" | "error";
}

export interface ConnectionMetadata {
  userAgent: string;
  ipAddress: string;
  origin: string;
  protocol: string;
  version: string;
  heartbeatInterval: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface WebSocketMessage<T = unknown> {
  id: string;
  type: WebSocketEventType;
  channel: string;
  data: T;
  timestamp: Timestamp;
  userId?: string;
  metadata?: WebSocketMessageMetadata;
}

export interface WebSocketMessageMetadata {
  requestId?: string;
  correlationId?: string;
  priority?: "low" | "medium" | "high" | "critical";
  ttl?: number;
  retry?: boolean;
  broadcast?: boolean;
  persistent?: boolean;
}

// =====================================================
// Event Type System
// =====================================================

export type WebSocketEventType =
  // System events
  | "system.connect"
  | "system.disconnect"
  | "system.heartbeat"
  | "system.error"
  | "system.reconnect"
  // Chat events
  | "chat?.message?.new"
  | "chat?.message?.update"
  | "chat?.message?.delete"
  | "chat?.typing?.start"
  | "chat?.typing?.stop"
  | "chat?.conversation?.create"
  | "chat?.conversation?.update"
  | "chat?.conversation?.archive"
  // Task events
  | "task.create"
  | "task.update"
  | "task.complete"
  | "task.fail"
  | "task.cancel"
  | "task.progress"
  | "task.assign"
  // Agent events
  | "agent.start"
  | "agent.step"
  | "agent?.tool?.call"
  | "agent?.tool?.response"
  | "agent.complete"
  | "agent.error"
  // Email events
  | "email.create"
  | "email.update"
  | "email.delete"
  | "email.assign"
  | "email?.status?.change"
  | "email?.batch?.process"
  // Document events
  | "document.create"
  | "document.update"
  | "document.delete"
  | "document.process"
  | "document.index"
  // System monitoring events
  | "monitoring.metric"
  | "monitoring.alert"
  | "monitoring.health"
  // Custom events
  | "custom.event";

// =====================================================
// Event Data Types
// =====================================================

export interface SystemConnectEvent {
  connectionId: string;
  userId?: string;
  sessionId: string;
  metadata: ConnectionMetadata;
}

export interface SystemDisconnectEvent {
  connectionId: string;
  userId?: string;
  reason: "client" | "server" | "timeout" | "error";
  code?: number;
  message?: string;
}

export interface SystemHeartbeatEvent {
  connectionId: string;
  timestamp: Timestamp;
  latency?: number;
}

export interface SystemErrorEvent {
  connectionId: string;
  error: WebSocketError;
  context?: Record<string, unknown>;
}

export interface SystemReconnectEvent {
  connectionId: string;
  attempt: number;
  maxAttempts: number;
  backoffMs: number;
}

export interface ChatMessageEvent {
  messageId: string;
  conversationId: string;
  message: Message;
  isEdit?: boolean;
}

export interface ChatTypingEvent {
  conversationId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}

export interface ChatConversationEvent {
  conversationId: string;
  conversation: Partial<Conversation>;
  action: "create" | "update" | "archive" | "restore";
}

export interface TaskEvent {
  taskId: string;
  task: Partial<Task>;
  action: "create" | "update" | "complete" | "fail" | "cancel" | "assign";
  previousState?: Partial<Task>;
}

export interface TaskProgressEvent {
  taskId: string;
  progress: {
    percentage: number;
    currentStep: string;
    totalSteps: number;
    estimatedCompletion?: Timestamp;
  };
  logs?: ApiTaskLog[];
}

// ApiTaskLog is imported from api.ts

export interface AgentEvent {
  agentId: string;
  taskId: string;
  action: "start" | "step" | "complete" | "error";
  data: AgentEventData;
}

export interface AgentEventData {
  step?: ApiAgentStep;
  result?: AgentResult;
  error?: WebSocketError;
  metadata?: Record<string, unknown>;
}

// AgentStep is imported from api.ts

// AgentResult is imported from './api'

export interface AgentToolEvent {
  agentId: string;
  taskId: string;
  toolName: string;
  action: "call" | "response";
  parameters?: unknown;
  result?: unknown;
  error?: WebSocketError;
  duration?: number;
}

export interface EmailEvent {
  emailId: string;
  email: Partial<EmailRecord>;
  action: "create" | "update" | "delete" | "assign" | "status_change";
  previousState?: Partial<EmailRecord>;
  userId?: string;
}

export interface EmailBatchEvent {
  batchId: string;
  status: "started" | "processing" | "completed" | "failed";
  progress: {
    processed: number;
    total: number;
    errors: number;
    warnings: number;
  };
  emails?: EmailRecord[];
  error?: WebSocketError;
}

export interface DocumentEvent {
  documentId: string;
  document: Partial<Document>;
  action: "create" | "update" | "delete" | "process" | "index";
  progress?: {
    stage: "parsing" | "chunking" | "embedding" | "indexing" | "complete";
    percentage: number;
  };
  error?: WebSocketError;
}

export interface MonitoringMetricEvent {
  metric: string;
  value: number;
  timestamp: Timestamp;
  labels?: Record<string, string>;
  unit?: string;
}

export interface MonitoringAlertEvent {
  alertId: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: Timestamp;
  resolved?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MonitoringHealthEvent {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  checks: WebSocketHealthCheck[];
  timestamp: Timestamp;
}

export interface WebSocketHealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomEvent {
  eventType: string;
  data: unknown;
  source: string;
  tags?: string[];
}

// =====================================================
// Channel and Subscription Management
// =====================================================

export interface Channel {
  name: string;
  type: "public" | "private" | "presence";
  description?: string;
  metadata?: Record<string, unknown>;
  permissions?: ChannelPermissions;
  subscribers: ChannelSubscriber[];
  createdAt: Timestamp;
  lastActivity: Timestamp;
}

export interface ChannelPermissions {
  subscribe?: string[]; // Required roles/permissions to subscribe
  publish?: string[]; // Required roles/permissions to publish
  admin?: string[]; // Required roles/permissions to admin
}

export interface ChannelSubscriber {
  connectionId: string;
  userId?: string;
  subscribedAt: Timestamp;
  lastSeen: Timestamp;
  permissions?: string[];
}

export interface SubscriptionRequest {
  channel: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionResponse {
  success: boolean;
  channel: string;
  subscribed: boolean;
  error?: WebSocketError;
  permissions?: string[];
}

export interface UnsubscriptionRequest {
  channel: string;
  userId?: string;
}

export interface PublishRequest<T = unknown> {
  channel: string;
  type: WebSocketEventType;
  data: T;
  metadata?: MessageMetadata;
}

export interface BroadcastRequest<T = unknown> {
  channels: string[];
  type: WebSocketEventType;
  data: T;
  filters?: BroadcastFilters;
  metadata?: MessageMetadata;
}

export interface BroadcastFilters {
  userIds?: string[];
  excludeUserIds?: string[];
  roles?: string[];
  excludeRoles?: string[];
  metadata?: Record<string, unknown>;
}

// =====================================================
// Error Handling
// =====================================================

export interface WebSocketError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
  timestamp: Timestamp;
  recoverable?: boolean;
  retryAfter?: number;
}

export type WebSocketErrorCode =
  | "CONNECTION_FAILED"
  | "AUTHENTICATION_FAILED"
  | "AUTHORIZATION_FAILED"
  | "INVALID_MESSAGE"
  | "CHANNEL_NOT_FOUND"
  | "SUBSCRIPTION_FAILED"
  | "PUBLISH_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "SERVER_ERROR"
  | "CLIENT_ERROR"
  | "TIMEOUT"
  | "PROTOCOL_ERROR";

// =====================================================
// Connection Management
// =====================================================

export interface ConnectionPool {
  connections: Map<string, WebSocketConnection>;
  channels: Map<string, Channel>;
  userConnections: Map<string, string[]>; // userId -> connectionIds
  metrics: ConnectionMetrics;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsPerSecond: number;
  messagesPerSecond: number;
  bytesPerSecond: number;
  errorRate: number;
  averageLatency: number;
  channelCounts: Record<string, number>;
}

export interface ConnectionConfig {
  maxConnections: number;
  maxChannelsPerConnection: number;
  maxMessageSize: number;
  heartbeatInterval: number;
  timeoutMs: number;
  reconnectPolicy: ReconnectPolicy;
  rateLimits: WebSocketRateLimits;
}

export interface ReconnectPolicy {
  enabled: boolean;
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface WebSocketRateLimits {
  connectionsPerIp: WebSocketRateLimit;
  messagesPerConnection: WebSocketRateLimit;
  subscriptionsPerConnection: WebSocketRateLimit;
  channelsPerUser: WebSocketRateLimit;
}

export interface WebSocketRateLimit {
  windowMs: number;
  maxRequests: number;
  burst?: number;
  skipSuccessful?: boolean;
}

// =====================================================
// Message Queue and Persistence
// =====================================================

export interface MessageQueue {
  messages: QueuedMessage[];
  size: number;
  maxSize: number;
  strategy: "fifo" | "lifo" | "priority";
  persistentMessages: number;
}

export interface QueuedMessage extends WebSocketMessage {
  attempts: number;
  maxAttempts: number;
  nextRetry?: Timestamp;
  persistent: boolean;
  queuedAt: Timestamp;
}

export interface MessageDeliveryStatus {
  messageId: string;
  status: "queued" | "delivered" | "failed" | "expired";
  attempts: number;
  lastAttempt?: Timestamp;
  error?: WebSocketError;
}

// =====================================================
// Event Handlers and Middleware
// =====================================================

export interface EventHandler<T = unknown> {
  eventType: WebSocketEventType;
  handler: (
    event: WebSocketMessage<T>,
    connection: WebSocketConnection,
  ) => Promise<void>;
  middleware?: EventMiddleware[];
}

export interface EventMiddleware {
  name: string;
  handler: (
    event: WebSocketMessage,
    connection: WebSocketConnection,
    next: () => Promise<void>,
  ) => Promise<void>;
}

export interface WebSocketMiddleware {
  onConnect?: (connection: WebSocketConnection) => Promise<boolean>;
  onDisconnect?: (connection: WebSocketConnection) => Promise<void>;
  onMessage?: (
    message: WebSocketMessage,
    connection: WebSocketConnection,
  ) => Promise<boolean>;
  onError?: (
    error: WebSocketError,
    connection: WebSocketConnection,
  ) => Promise<void>;
  onSubscribe?: (
    request: SubscriptionRequest,
    connection: WebSocketConnection,
  ) => Promise<boolean>;
}

// =====================================================
// Server-Sent Events (SSE) Support
// =====================================================

export interface SSEConnection {
  id: string;
  userId?: string;
  channels: string[];
  lastEventId?: string;
  connectedAt: Timestamp;
  metadata: Record<string, unknown>;
}

export interface SSEEvent {
  id: string;
  type?: string;
  data: string | object;
  retry?: number;
  comment?: string;
}

// =====================================================
// WebSocket Server Configuration
// =====================================================

export interface WebSocketServerConfig {
  port?: number;
  path: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  compression: {
    enabled: boolean;
    threshold: number;
    concurrencyLimit: number;
  };
  perMessageDeflate: {
    enabled: boolean;
    threshold: number;
    concurrencyLimit: number;
  };
  maxPayload: number;
  pingInterval: number;
  pongTimeout: number;
  connectionPool: ConnectionConfig;
  security: WebSocketSecurity;
  monitoring: MonitoringConfig;
}

export interface WebSocketSecurity {
  authentication: {
    required: boolean;
    schemes: string[];
    tokenValidation: TokenValidation;
  };
  authorization: {
    enabled: boolean;
    rules: AuthorizationRule[];
  };
  encryption: {
    enabled: boolean;
    certificates?: CertificateConfig;
  };
}

export interface TokenValidation {
  schemes: ("bearer" | "query" | "cookie")[];
  jwtSecret?: string;
  apiKeyHeader?: string;
  cookieName?: string;
  queryParam?: string;
}

export interface AuthorizationRule {
  resource: string;
  actions: string[];
  roles: string[];
  conditions?: Record<string, unknown>;
}

export interface CertificateConfig {
  keyFile: string;
  certFile: string;
  caFile?: string;
  passphrase?: string;
}

export interface WebSocketMonitoringConfig {
  metrics: {
    enabled: boolean;
    interval: number;
    retention: number;
  };
  logging: {
    enabled: boolean;
    level: "debug" | "info" | "warn" | "error";
    format: "json" | "text";
  };
  healthCheck: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}
