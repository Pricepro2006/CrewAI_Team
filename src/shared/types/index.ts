/**
 * Shared Types System - Integration Coordinator
 * Comprehensive TypeScript interfaces for all system components
 * This is the single source of truth for all data models across the system
 */

// Core System Types
export * from './core';
export * from './database';
export * from './websocket';
export * from './monitoring';
export * from './email';
export * from './orchestration';
export * from './rag';
export * from './auth';
export * from './events';

// Selective exports to avoid conflicts
export type {
  // API Types with renamed conflicting ones
  TaskProgress as ApiTaskProgress,
  TaskLog as ApiTaskLog,
  TaskError as ApiTaskError,
  AgentResult,
  AgentStep
} from './api';

export type {
  // Agent Types with renamed conflicting ones  
  TaskProgress as AgentTaskProgress,
  TaskLog as AgentTaskLog,
  TaskError as AgentTaskError
} from './agents';

export type {
  // Validation Types with renamed conflicting ones
  ValidationError as ValidationErrorType
} from './validation';

export type {
  // Error Types
  BaseError,
  SystemError,
  BusinessError,
  ValidationError as ErrorValidationError,
  ApiError,
  ErrorCode,
  ErrorCategory,
  ErrorContext,
  ErrorHandler,
  ErrorReport
} from './errors';

// Re-export common utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object | undefined ? DeepRequired<Required<T[P]>> : T[P];
};

// Type guards and validation utilities
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

// Timestamp utilities
export type Timestamp = string; // ISO 8601 string
export type UnixTimestamp = number;

export interface TimestampedEntity {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Generic pagination types
export interface PaginationRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
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
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: string;
    httpStatus?: number;
  };
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
  NODE_ENV: 'development' | 'production' | 'test' | 'staging';
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  PORT: number;
  DATABASE_URL?: string;
  CORS_ORIGINS: string[];
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
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
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  responseTime?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
}