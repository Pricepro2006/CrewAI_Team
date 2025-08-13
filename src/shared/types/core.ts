/**
 * Core type definitions for the CrewAI Team project
 *
 * This file contains fundamental types used across the application,
 * including the Result type pattern for error handling.
 */

/**
 * Generic Result type for consistent error handling across the application.
 *
 * @template T - The type of successful result data
 * @template E - The type of error (defaults to Error)
 */
export type Result<T, E = Error> =
  | { success: true; data: T; error?: never }
  | { success: false; error: E; data?: never };

/**
 * Simple Result type with string error messages
 */
export type SimpleResult<T> = Result<T, string>;

/**
 * Async Result type for promise-based operations
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Optional value type for nullable results
 */
export type Maybe<T> = T | null | undefined;

/**
 * Brand type for creating nominal types
 */
export type Brand<T, B> = T & { readonly __brand: B };

/**
 * Common ID types using branded strings for type safety
 */
export type EmailId = Brand<string, "EmailId">;
export type JobId = Brand<string, "JobId">;
export type BatchId = Brand<string, "BatchId">;
export type ConversationId = Brand<string, "ConversationId">;
export type UserId = Brand<string, "UserId">;

/**
 * Utility type for creating partial objects with required fields
 */
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>;

/**
 * Utility type for making specific fields optional
 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Utility type for making specific fields required
 */
export type Required<T, K extends keyof T> = T & { [P in K]-?: T[P] };

/**
 * Common configuration interface
 */
export interface BaseConfig {
  environment: "development" | "production" | "test";
  version: string;
  debug: boolean;
}

/**
 * Common timestamp interface
 */
export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Common entity interface
 */
export interface BaseEntity extends Timestamps {
  id: string;
}

/**
 * Pagination interface
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated result interface
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

/**
 * Sort order enumeration
 */
export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

/**
 * Generic sort interface
 */
export interface Sort {
  field: string;
  order: SortOrder;
}

/**
 * Common filter interface
 */
export interface BaseFilter {
  limit?: number;
  offset?: number;
  sort?: Sort[];
}

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
}

/**
 * Health check result
 */
export interface HealthCheck {
  status: HealthStatus;
  message?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * Application metadata
 */
export interface AppMetadata {
  name: string;
  version: string;
  environment: string;
  buildDate: Date;
  commitHash?: string;
}

/**
 * Error context for enhanced error reporting
 */
export interface ErrorContext {
  component: string;
  operation: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Enhanced error interface
 */
export interface AppError extends Error {
  code: string;
  context?: ErrorContext;
  retryable: boolean;
  severity: "low" | "medium" | "high" | "critical";
}

/**
 * Additional core types to satisfy imports
 */
export type Timestamp = string; // ISO 8601 string

export interface TimestampedEntity {
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Timestamp;
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  tokens?: TokenUsage;
  model?: string;
  temperature?: number;
  source?: string;
}

export interface Task extends TimestampedEntity {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  priority: "low" | "medium" | "high" | "critical";
  assignedTo?: string;
  tags?: string[];
}

export interface Conversation extends TimestampedEntity {
  id: ConversationId;
  title: string;
  participants: UserId[];
  messages: Message[];
  metadata?: Record<string, unknown>;
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number;
  retries: number;
  timeout: number;
}
