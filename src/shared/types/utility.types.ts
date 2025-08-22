// Utility type definitions
// Replaces 'any' usage in utility functions and helpers

// Generic utility types
export type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
export interface JSONObject {
  [key: string]: JSONValue;
}
export interface JSONArray extends Array<JSONValue> {}

// Function types
export type AsyncFunction<T extends unknown[] = unknown[], R = unknown> = (...args: T) => Promise<R>;
export type SyncFunction<T extends unknown[] = unknown[], R = unknown> = (...args: T) => R;
export type CallbackFunction<T = unknown> = (error: Error | null, result?: T) => void;

// Error handling
export interface ErrorWithCode extends Error {
  code: string;
  statusCode?: number;
  details?: JSONObject;
}

export interface ErrorContext {
  service: string;
  operation: string;
  timestamp: Date;
  metadata: JSONObject;
}

// Batch operations
export interface BatchOperation<T> {
  items: T[];
  batchSize: number;
  concurrency: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, item: T, index: number) => void;
}

export interface BatchResult<T, R> {
  successful: Array<{ item: T; result: R; index: number }>;
  failed: Array<{ item: T; error: Error; index: number }>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

// Configuration types
export interface ConfigValue {
  value: string | number | boolean;
  source: 'default' | 'env' | 'file' | 'override';
  validated: boolean;
}

export interface ConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    default?: string | number | boolean;
    validation?: (value: unknown) => boolean;
  };
}

// JWT types
export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  iss?: string;
  aud?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export interface JWTOptions {
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  expiresIn: string | number;
  issuer?: string;
  audience?: string;
}

// Cache types
export interface CacheEntry<T> {
  value: T;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  size: number;
  memoryUsage: number;
  evictions: number;
}

// Retry logic
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDuration: number;
}

// Validation types
export interface ValidationRule<T = unknown> {
  field: string;
  validator: (value: T) => boolean | string;
  message?: string;
  optional?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    value: unknown;
  }>;
}

// Event types
export interface EventPayload {
  type: string;
  data: JSONObject;
  timestamp: Date;
  source: string;
  correlationId?: string;
}

export type EventHandler<T = JSONObject> = (payload: T, metadata: EventPayload) => void | Promise<void>;

// Database types
export interface QueryOptions {
  timeout?: number;
  retries?: number;
  isolation?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
}

export interface QueryResult<T = JSONObject> {
  rows: T[];
  rowCount: number;
  command: string;
  duration: number;
}

// HTTP types
export interface HTTPResponse<T = unknown> {
  status: number;
  headers: Record<string, string>;
  data: T;
  duration: number;
}

export interface HTTPError extends Error {
  status: number;
  response?: HTTPResponse;
  config: {
    url: string;
    method: string;
    headers: Record<string, string>;
  };
}

// Microservice types
export interface ServiceConfig {
  name: string;
  version: string;
  port: number;
  host: string;
  healthcheck: {
    path: string;
    interval: number;
    timeout: number;
  };
  dependencies: string[];
}

export interface ServiceRegistry {
  services: Map<string, ServiceConfig>;
  discover(name: string): Promise<ServiceConfig | null>;
  register(config: ServiceConfig): Promise<void>;
  deregister(name: string): Promise<void>;
}

// Type guards
export function isJSONObject(value: unknown): value is JSONObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isJSONArray(value: unknown): value is JSONArray {
  return Array.isArray(value);
}

export function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && 'code' in error;
}

export function assertNonNull<T>(value: T | null | undefined, message?: string): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}