/**
 * Unified Error Handling Framework
 * Comprehensive error types and handling utilities
 */

import type { Timestamp } from "./index.js";

// =====================================================
// Base Error Types
// =====================================================

export interface BaseError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
  requestId?: string;
  userId?: string;
  stack?: string;
}

export interface ApiError extends BaseError {
  httpStatus: number;
  path?: string;
  method?: string;
  userAgent?: string;
  ipAddress?: string;
  correlationId?: string;
}

export interface ValidationError extends BaseError {
  field: string;
  value?: unknown;
  constraint: string;
  children?: ValidationError[];
}

export interface BusinessError extends BaseError {
  domain: string;
  operation: string;
  context?: Record<string, unknown>;
  recoverable: boolean;
  suggestedAction?: string;
}

export interface SystemError extends BaseError {
  service: string;
  component: string;
  severity: "low" | "medium" | "high" | "critical";
  impact: "none" | "limited" | "significant" | "severe";
  resolution?: ErrorResolution;
}

export interface DatabaseError extends BaseError {
  operation: string;
  table?: string;
  query?: string;
  constraint?: string;
  connectionId?: string;
}

export interface NetworkError extends BaseError {
  url?: string;
  method?: string;
  statusCode?: number;
  timeout?: boolean;
  retryable: boolean;
}

export interface AuthenticationError extends BaseError {
  provider?: string;
  username?: string;
  reason: "invalid_credentials" | "expired_token" | "malformed_token" | "missing_token";
}

export interface AuthorizationError extends BaseError {
  resource: string;
  action: string;
  requiredPermissions: string[];
  userPermissions: string[];
}

export interface RateLimitError extends BaseError {
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
}

export interface IntegrationError extends BaseError {
  service: string;
  endpoint?: string;
  operation: string;
  retryable: boolean;
  fallbackAvailable: boolean;
}

export interface ErrorResolution {
  strategy: "retry" | "fallback" | "manual" | "ignore";
  retryAfter?: number;
  maxRetries?: number;
  fallbackAction?: string;
  manualSteps?: string[];
}

// =====================================================
// Error Categories
// =====================================================

export type ErrorCategory =
  | "authentication"
  | "authorization"
  | "validation"
  | "business"
  | "system"
  | "network"
  | "database"
  | "external_service"
  | "rate_limit"
  | "timeout"
  | "resource"
  | "security"
  | "configuration";

// =====================================================
// Standard Error Codes
// =====================================================

export const ERROR_CODES = {
  // Authentication errors (1000-1099)
  INVALID_CREDENTIALS: "1001",
  EXPIRED_TOKEN: "1002",
  INVALID_TOKEN: "1003",
  TOKEN_REQUIRED: "1004",
  AUTHENTICATION_FAILED: "1005",
  SESSION_EXPIRED: "1006",
  ACCOUNT_LOCKED: "1007",
  ACCOUNT_DISABLED: "1008",
  MFA_REQUIRED: "1009",

  // Authorization errors (1100-1199)
  INSUFFICIENT_PERMISSIONS: "1101",
  ACCESS_DENIED: "1102",
  RESOURCE_FORBIDDEN: "1103",
  OPERATION_NOT_ALLOWED: "1104",
  ROLE_REQUIRED: "1105",
  SCOPE_INSUFFICIENT: "1106",

  // Validation errors (1200-1299)
  INVALID_INPUT: "1201",
  MISSING_REQUIRED_FIELD: "1202",
  INVALID_FORMAT: "1203",
  VALUE_OUT_OF_RANGE: "1204",
  INVALID_LENGTH: "1205",
  INVALID_TYPE: "1206",
  CONSTRAINT_VIOLATION: "1207",
  DUPLICATE_VALUE: "1208",

  // Business logic errors (1300-1399)
  BUSINESS_RULE_VIOLATION: "1301",
  WORKFLOW_ERROR: "1302",
  STATE_TRANSITION_ERROR: "1303",
  OPERATION_NOT_SUPPORTED: "1304",
  PRECONDITION_FAILED: "1305",
  CONFLICT: "1306",
  QUOTA_EXCEEDED: "1307",
  FEATURE_DISABLED: "1308",

  // System errors (1400-1499)
  INTERNAL_ERROR: "1401",
  SERVICE_UNAVAILABLE: "1402",
  CONFIGURATION_ERROR: "1403",
  INITIALIZATION_ERROR: "1404",
  SHUTDOWN_ERROR: "1405",
  MEMORY_ERROR: "1406",
  DISK_FULL: "1407",
  RESOURCE_EXHAUSTED: "1408",

  // Network errors (1500-1599)
  CONNECTION_ERROR: "1501",
  TIMEOUT: "1502",
  DNS_ERROR: "1503",
  SSL_ERROR: "1504",
  PROXY_ERROR: "1505",
  NETWORK_UNREACHABLE: "1506",
  CONNECTION_REFUSED: "1507",

  // Database errors (1600-1699)
  DATABASE_ERROR: "1601",
  CONNECTION_POOL_EXHAUSTED: "1602",
  DEADLOCK: "1603",
  CONSTRAINT_VIOLATION_DB: "1604",
  MIGRATION_ERROR: "1605",
  BACKUP_ERROR: "1606",
  CORRUPTION_ERROR: "1607",
  SCHEMA_ERROR: "1608",

  // External service errors (1700-1799)
  EXTERNAL_SERVICE_ERROR: "1701",
  API_QUOTA_EXCEEDED: "1702",
  UPSTREAM_TIMEOUT: "1703",
  UPSTREAM_UNAVAILABLE: "1704",
  INTEGRATION_ERROR: "1705",
  WEBHOOK_ERROR: "1706",
  PAYMENT_ERROR: "1707",

  // Rate limiting errors (1800-1899)
  RATE_LIMIT_EXCEEDED: "1801",
  TOO_MANY_REQUESTS: "1802",
  BURST_LIMIT_EXCEEDED: "1803",
  DAILY_LIMIT_EXCEEDED: "1804",
  CONCURRENT_LIMIT_EXCEEDED: "1805",

  // Resource errors (1900-1999)
  RESOURCE_NOT_FOUND: "1901",
  RESOURCE_ALREADY_EXISTS: "1902",
  RESOURCE_LOCKED: "1903",
  RESOURCE_CORRUPTED: "1904",
  RESOURCE_TOO_LARGE: "1905",
  RESOURCE_EXPIRED: "1906",

  // Security errors (2000-2099)
  SECURITY_VIOLATION: "2001",
  SUSPICIOUS_ACTIVITY: "2002",
  MALICIOUS_REQUEST: "2003",
  CONTENT_BLOCKED: "2004",
  ENCRYPTION_ERROR: "2005",
  SIGNATURE_INVALID: "2006",
  CSRF_TOKEN_INVALID: "2007",
  XSS_ATTEMPT: "2008",
  SQL_INJECTION_ATTEMPT: "2009",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// =====================================================
// Error Context Types
// =====================================================

export interface ExtendedErrorContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  operation?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  breadcrumbs?: ErrorBreadcrumb[];
}

export interface ErrorBreadcrumb {
  timestamp: Timestamp;
  category: string;
  message: string;
  level: "debug" | "info" | "warn" | "error";
  data?: Record<string, unknown>;
}

// =====================================================
// Error Handling Strategies
// =====================================================

export interface ErrorHandler {
  name: string;
  canHandle: (error: BaseError) => boolean;
  handle: (error: BaseError, context: ExtendedErrorContext) => Promise<ErrorResult>;
  priority: number;
}

export interface ErrorResult {
  handled: boolean;
  retry?: boolean;
  retryAfter?: number;
  fallback?: unknown;
  escalate?: boolean;
  notify?: boolean;
  log?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition: (error: BaseError, attempt: number) => boolean;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  monitoringPeriodMs: number;
  expectedSuccessRate: number;
  slowRequestThreshold: number;
}

// =====================================================
// Error Reporting and Monitoring
// =====================================================

export interface ErrorReport {
  id: string;
  error: BaseError;
  context: ExtendedErrorContext;
  environment: string;
  version: string;
  frequency: number;
  firstOccurrence: Timestamp;
  lastOccurrence: Timestamp;
  affectedUsers: number;
  severity: "low" | "medium" | "high" | "critical";
  status: "new" | "investigating" | "resolved" | "ignored";
  assignedTo?: string;
  resolution?: ErrorResolutionDetails;
}

export interface ErrorResolutionDetails {
  resolvedAt: Timestamp;
  resolvedBy: string;
  resolution: string;
  rootCause?: string;
  preventionMeasures?: string[];
  affectedSystems?: string[];
}

export interface ErrorMetrics {
  totalErrors: number;
  errorRate: number;
  errorsByCode: Record<string, number>;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsByService: Record<string, number>;
  averageResolutionTime: number;
  topErrors: ErrorSummary[];
  trends: ErrorTrend[];
}

export interface ErrorSummary {
  code: string;
  message: string;
  count: number;
  percentage: number;
  trend: "increasing" | "decreasing" | "stable";
  lastOccurrence: Timestamp;
}

export interface ErrorTrend {
  timestamp: Timestamp;
  errorCount: number;
  errorRate: number;
  category: ErrorCategory;
}

// =====================================================
// Error Notification and Alerting
// =====================================================

export interface ErrorAlert {
  id: string;
  rule: AlertRule;
  triggeredAt: Timestamp;
  resolved: boolean;
  resolvedAt?: Timestamp;
  severity: "low" | "medium" | "high" | "critical";
  summary: string;
  details: string;
  metadata: Record<string, unknown>;
}

export interface AlertRule {
  name: string;
  description: string;
  condition: AlertCondition;
  severity: "low" | "medium" | "high" | "critical";
  channels: string[];
  throttling: ThrottlingConfig;
  enabled: boolean;
}

export interface AlertCondition {
  type: "threshold" | "anomaly" | "pattern" | "composite";
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte" | "eq" | "neq";
  value: number | string;
  timeWindow: number;
  aggregation?: "sum" | "avg" | "count" | "rate";
  filters?: Record<string, unknown>;
}

export interface ThrottlingConfig {
  enabled: boolean;
  windowMs: number;
  maxAlerts: number;
  cooldownMs: number;
}

export interface ErrorNotification {
  id: string;
  alertId: string;
  channel: NotificationChannel;
  status: "pending" | "sent" | "failed" | "delivered";
  attempts: number;
  maxAttempts: number;
  nextRetry?: Timestamp;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationChannel {
  id: string;
  type: "email" | "slack" | "webhook" | "sms" | "push";
  name: string;
  configuration: NotificationChannelConfig;
  enabled: boolean;
}

export type NotificationChannelConfig =
  | EmailChannelConfig
  | SlackChannelConfig
  | WebhookChannelConfig
  | SMSChannelConfig
  | PushChannelConfig;

export interface EmailChannelConfig {
  recipients: string[];
  subject: string;
  template: string;
  attachments?: string[];
}

export interface SlackChannelConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
  mentions?: string[];
}

export interface WebhookChannelConfig {
  url: string;
  method: "POST" | "PUT";
  headers: Record<string, string>;
  timeout: number;
  retries: number;
}

export interface SMSChannelConfig {
  provider: "twilio" | "aws" | "azure";
  recipients: string[];
  template: string;
}

export interface PushChannelConfig {
  provider: "fcm" | "apns" | "web";
  tokens: string[];
  title: string;
  body: string;
  badge?: number;
  sound?: string;
}

// =====================================================
// Error Classification and Grouping
// =====================================================

export interface ErrorClassification {
  fingerprint: string;
  group: string;
  category: ErrorCategory;
  severity: "low" | "medium" | "high" | "critical";
  tags: string[];
  similarity: number;
  metadata: ClassificationMetadata;
}

export interface ClassificationMetadata {
  stackTraceHash: string;
  messageHash: string;
  contextHash: string;
  patterns: string[];
  confidence: number;
  algorithm: string;
  version: string;
}

export interface ErrorGroup {
  id: string;
  fingerprint: string;
  title: string;
  category: ErrorCategory;
  severity: "low" | "medium" | "high" | "critical";
  count: number;
  userCount: number;
  firstSeen: Timestamp;
  lastSeen: Timestamp;
  frequency: FrequencyData;
  platforms: string[];
  versions: string[];
  tags: string[];
  status: "unresolved" | "resolved" | "ignored" | "muted";
  assignedTo?: string;
  examples: BaseError[];
}

export interface FrequencyData {
  daily: number[];
  weekly: number[];
  monthly: number[];
  total: number;
}

// =====================================================
// Error Recovery and Self-Healing
// =====================================================

export interface RecoveryAction {
  name: string;
  description: string;
  type: "automatic" | "manual" | "hybrid";
  conditions: RecoveryCondition[];
  steps: RecoveryStep[];
  rollback?: RollbackPlan;
  verification: VerificationStep[];
}

export interface RecoveryCondition {
  type:
    | "error_code"
    | "error_count"
    | "time_window"
    | "health_check"
    | "custom";
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains";
  value: unknown;
  metadata?: Record<string, unknown>;
}

export interface RecoveryStep {
  id: string;
  name: string;
  type:
    | "restart_service"
    | "clear_cache"
    | "scale_resources"
    | "circuit_breaker"
    | "fallback"
    | "custom";
  parameters: Record<string, unknown>;
  timeout: number;
  retries: number;
  continueOnFailure: boolean;
}

export interface RollbackPlan {
  enabled: boolean;
  steps: RecoveryStep[];
  triggers: RecoveryCondition[];
  timeout: number;
}

export interface VerificationStep {
  name: string;
  type: "health_check" | "smoke_test" | "metric_check" | "custom";
  parameters: Record<string, unknown>;
  expectedResult: unknown;
  timeout: number;
}

export interface RecoveryResult {
  success: boolean;
  actionName: string;
  executionTime: number;
  stepsExecuted: number;
  stepsSucceeded: number;
  stepsFailed: number;
  rollbackTriggered: boolean;
  verificationPassed: boolean;
  metadata: Record<string, unknown>;
  logs: RecoveryLog[];
}

export interface RecoveryLog {
  stepId: string;
  timestamp: Timestamp;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  data?: Record<string, unknown>;
}

// =====================================================
// Additional Error Processing Types (Required for Type Exports)
// =====================================================

export interface ErrorRecoveryStrategy {
  name: string;
  type: "automatic" | "manual" | "hybrid";
  priority: number;
  conditions: RecoveryCondition[];
  actions: RecoveryAction[];
  timeout: number;
  maxRetries: number;
  enabled: boolean;
}

export interface ErrorAggregator {
  id: string;
  name: string;
  groupingStrategy: "fingerprint" | "stack_trace" | "message" | "custom";
  aggregationWindow: number;
  maxGroupSize: number;
  similarityThreshold: number;
  customGroupingRules?: GroupingRule[];
}

export interface GroupingRule {
  field: string;
  operator: "equals" | "contains" | "regex" | "exists";
  value?: string;
  weight: number;
}

export interface ErrorRetryPolicy {
  name: string;
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffStrategy: "fixed" | "exponential" | "linear" | "custom";
  backoffMultiplier: number;
  jitterEnabled: boolean;
  retryableErrorCodes: string[];
  retryableErrorTypes: string[];
  stopRetryConditions: RetryStopCondition[];
}

export interface RetryStopCondition {
  type: "max_attempts" | "timeout" | "error_type" | "custom";
  value: unknown;
  operator?: "eq" | "gt" | "gte" | "lt" | "lte";
}

export interface ErrorNotificationConfig {
  id: string;
  name: string;
  enabled: boolean;
  triggers: NotificationTrigger[];
  channels: string[];
  template: string;
  throttling: ThrottlingConfig;
  escalation?: EscalationConfig;
}

export interface NotificationTrigger {
  type: "error_count" | "error_rate" | "severity" | "pattern" | "custom";
  condition: AlertCondition;
  timeWindow: number;
}

export interface EscalationConfig {
  enabled: boolean;
  levels: EscalationLevel[];
  timeout: number;
}

export interface EscalationLevel {
  level: number;
  delay: number;
  channels: string[];
  conditions: AlertCondition[];
}

export interface ErrorAnalytics {
  id: string;
  name: string;
  type: "trending" | "pattern" | "anomaly" | "correlation";
  dataSource: string;
  analysisWindow: number;
  updateFrequency: number;
  thresholds: AnalyticsThreshold[];
  enabled: boolean;
}

export interface AnalyticsThreshold {
  metric: string;
  operator: "gt" | "gte" | "lt" | "lte";
  value: number;
  severity: "low" | "medium" | "high" | "critical";
}

export interface ErrorMonitoring {
  id: string;
  name: string;
  targets: MonitoringTarget[];
  metrics: MonitoringMetric[];
  alerting: AlertingConfig;
  dashboard: DashboardConfig;
  enabled: boolean;
}

export interface MonitoringTarget {
  type: "service" | "endpoint" | "component" | "custom";
  identifier: string;
  filters?: Record<string, unknown>;
}

export interface MonitoringMetric {
  name: string;
  type: "counter" | "gauge" | "histogram" | "summary";
  aggregation: "sum" | "avg" | "min" | "max" | "count";
  labels: string[];
}

export interface AlertingConfig {
  enabled: boolean;
  rules: AlertRule[];
  channels: string[];
  escalation: EscalationConfig;
}

export interface DashboardConfig {
  enabled: boolean;
  refresh: number;
  charts: ChartConfig[];
  filters: FilterConfig[];
}

export interface ChartConfig {
  type: "line" | "bar" | "pie" | "scatter";
  metric: string;
  timeRange: string;
  aggregation: string;
}

export interface FilterConfig {
  field: string;
  type: "select" | "multiselect" | "date" | "text";
  options?: string[];
}

export interface ErrorReportingService {
  id: string;
  name: string;
  type: "sentry" | "bugsnag" | "rollbar" | "custom";
  configuration: ReportingServiceConfig;
  filters: ReportingFilter[];
  enabled: boolean;
}

export interface ReportingServiceConfig {
  apiKey: string;
  projectId?: string;
  environment?: string;
  release?: string;
  customEndpoint?: string;
  rateLimit?: number;
}

export interface ReportingFilter {
  type: "include" | "exclude";
  field: string;
  operator: "equals" | "contains" | "regex";
  value: string;
}

export interface ErrorHandlingMiddleware {
  name: string;
  order: number;
  enabled: boolean;
  configuration: MiddlewareConfig;
  errorHandlers: ErrorHandler[];
}

export interface MiddlewareConfig {
  logErrors: boolean;
  reportErrors: boolean;
  transformErrors: boolean;
  customHeaders?: Record<string, string>;
  timeout?: number;
}

export interface GlobalErrorHandler {
  id: string;
  name: string;
  type: "catch_all" | "specific" | "pattern_based";
  priority: number;
  handlers: ErrorHandler[];
  fallbackHandler?: ErrorHandler;
  configuration: GlobalHandlerConfig;
}

export interface GlobalHandlerConfig {
  enableStackTrace: boolean;
  enableErrorReporting: boolean;
  enableRecovery: boolean;
  enableNotification: boolean;
  maxErrorsPerMinute: number;
  customErrorPages?: Record<string, string>;
}
