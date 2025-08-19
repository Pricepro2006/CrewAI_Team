/**
 * Shared Types System - Integration Coordinator
 * Comprehensive TypeScript interfaces for all system components
 * This is the single source of truth for all data models across the system
 */

// Core System Types
export * from "./core.js";
export * from "./api.js";
export * from "./database.js";
// Export websocket types except conflicting ones
export * from "./websocket.js";
export * from "./agents.js";
export * from "./monitoring.js";
export * from "./validation.js";
export * from "./email.js";
export * from "./orchestration.js";
export * from "./rag.js";
export * from "./auth.js";
// Export error types with renamed ErrorContext
export {
  type BaseError,
  type ApiError,
  type ValidationError,
  type BusinessError,
  type SystemError,
  type DatabaseError,
  type NetworkError,
  type AuthenticationError,
  type AuthorizationError,
  type RateLimitError,
  type IntegrationError,
  type ExtendedErrorContext,
  type ErrorRecoveryStrategy,
  type ErrorAggregator,
  type ErrorRetryPolicy,
  type ErrorNotificationConfig,
  type ErrorAnalytics,
  type ErrorMonitoring,
  type ErrorReportingService,
  type ErrorHandlingMiddleware,
  type GlobalErrorHandler
} from "./errors.js";
export * from "./events.js";

// Re-export common utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object | undefined
    ? DeepRequired<Required<T[P]>>
    : T[P];
};

// Type guards and validation utilities
export function isString(value: unknown): value is string {
  return typeof value === "string";
}

export function isNumber(value: unknown): value is number {
  return typeof value === "number" && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Timestamp utilities
export type Timestamp = string; // ISO 8601 string

// Forward declaration for missing ApiError
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Timestamp;
  httpStatus: number;
  path?: string;
  method?: string;
}
export type UnixTimestamp = number;

export interface TimestampedEntity {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Generic pagination types
export interface PaginationRequest {
  page: number;
  pageSize: number;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Generic filter types
export interface BaseFilter {
  search?: string;
  dateRange?: {
    start: Timestamp;
    end: Timestamp;
  };
}

// Generic response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Timestamp;
  version: string;
  cached?: boolean;
  processingTime?: number;
  rateLimitRemaining?: number;
}

// Configuration types
export interface EnvironmentConfig {
  NODE_ENV: "development" | "production" | "test" | "staging";
  LOG_LEVEL: "debug" | "info" | "warn" | "error";
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string[];
}

// Health check types
export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Timestamp;
  services: Record<string, ServiceHealth>;
  metadata?: {
    version: string;
    uptime: number;
    memory: MemoryInfo;
    cpu: number;
  };
}

export interface ServiceHealth {
  status: "healthy" | "degraded" | "unhealthy" | "unknown";
  responseTime?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}
