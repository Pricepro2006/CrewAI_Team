/**
 * Client-side type definitions
 * Comprehensive types for React components, hooks, and client services
 * Used to eliminate 'any' types throughout the client codebase
 */

import type { 
  PaginationRequest, 
  PaginatedResult, 
  TimestampedEntity,
  ApiResponse 
} from "./api.js";

// ============================================================================
// DATABASE CONNECTION & QUERY TYPES
// ============================================================================

/**
 * Better SQLite3 database instance type
 */
export interface DatabaseInstance {
  prepare: (sql: string) => PreparedStatement;
  exec: (sql: string) => void;
  close: () => void;
  readonly open: boolean;
  readonly inTransaction: boolean;
  pragma: (pragma: string, options?: unknown) => unknown;
  transaction: <T>(fn: () => T) => T;
  backup: (destination: string) => Promise<void>;
}

/**
 * Prepared statement type for better-sqlite3
 */
export interface PreparedStatement {
  run: (...params: unknown[]) => RunResult;
  get: (...params: unknown[]) => Record<string, unknown> | undefined;
  all: (...params: unknown[]) => Record<string, unknown>[];
  iterate: (...params: unknown[]) => IterableIterator<Record<string, unknown>>;
  pluck: (toggle?: boolean) => PreparedStatement;
  expand: (toggle?: boolean) => PreparedStatement;
  raw: (toggle?: boolean) => PreparedStatement;
  columns: () => ColumnDefinition[];
  bind: (...params: unknown[]) => PreparedStatement;
}

/**
 * Result of running a prepared statement
 */
export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Column definition from better-sqlite3
 */
export interface ColumnDefinition {
  name: string;
  column: string | null;
  database: string | null;
  table: string | null;
  type: string | null;
}

/**
 * Database query parameters type
 */
export type QueryParameters = Record<string, string | number | boolean | null>;

/**
 * Database row type with unknown values
 */
export type DatabaseRow = Record<string, unknown>;

// ============================================================================
// REACT HOOK TYPES
// ============================================================================

/**
 * Generic hook state for async operations
 */
export interface AsyncHookState<TData> {
  data: TData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook options for data fetching
 */
export interface HookOptions {
  enabled?: boolean;
  refetchInterval?: number;
  retryCount?: number;
  cacheTime?: number;
}

/**
 * Audit trail change record
 */
export interface AuditChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Audit event details
 */
export interface AuditEventDetails {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: AuditChange[];
  metadata?: Record<string, unknown>;
}

/**
 * Performance monitoring data
 */
export interface PerformanceMetrics {
  timestamp: string;
  duration: number;
  memory: number;
  cpu: number;
  requests: number;
  errors: number;
  warnings: number;
}

// ============================================================================
// FORM AND INPUT TYPES
// ============================================================================

/**
 * Generic form field configuration
 */
export interface FormField<TValue = unknown> {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'checkbox' | 'textarea';
  value: TValue;
  placeholder?: string;
  required?: boolean;
  validation?: ValidationRule[];
  options?: SelectOption[];
}

/**
 * Select option type
 */
export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

/**
 * Validation rule
 */
export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: unknown;
  message: string;
}

/**
 * Form validation errors
 */
export type FormErrors = Record<string, string[]>;

// ============================================================================
// CHART AND VISUALIZATION TYPES
// ============================================================================

/**
 * Chart data point
 */
export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
  color?: string;
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  type: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
  data: ChartDataPoint[];
  options?: Record<string, unknown>;
  width?: number;
  height?: number;
}

/**
 * Timeline event for workflow charts
 */
export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  type: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
}

// ============================================================================
// TABLE AND LIST TYPES
// ============================================================================

/**
 * Table column definition
 */
export interface TableColumn<TData = Record<string, unknown>> {
  key: keyof TData;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  render?: (value: unknown, row: TData) => React.ReactNode;
}

/**
 * Table sorting configuration
 */
export interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

/**
 * Filter configuration
 */
export interface FilterConfig {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte';
  value: unknown;
}

// ============================================================================
// FILE AND EXPORT TYPES
// ============================================================================

/**
 * Export format options
 */
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf';

/**
 * Export configuration
 */
export interface ExportConfig {
  format: ExportFormat;
  filename: string;
  columns?: string[];
  filters?: FilterConfig[];
  includeHeaders?: boolean;
}

/**
 * File upload progress
 */
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ============================================================================
// API CLIENT TYPES
// ============================================================================

/**
 * HTTP request configuration
 */
export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  timeout?: number;
}

/**
 * API client response
 */
export interface ClientResponse<TData = unknown> {
  data: TData;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Walmart API product data
 */
export interface WalmartProduct {
  id: string;
  name: string;
  price: number;
  description?: string;
  imageUrl?: string;
  category?: string;
  brand?: string;
  rating?: number;
  reviews?: number;
  inStock: boolean;
}

/**
 * Search results for Walmart products
 */
export interface WalmartSearchResult {
  query: string;
  products: WalmartProduct[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// WEBSOCKET AND REAL-TIME TYPES
// ============================================================================

/**
 * WebSocket connection state
 */
export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  error: Error | null;
  lastMessage: unknown;
  send: (message: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Real-time message
 */
export interface RealtimeMessage<TPayload = unknown> {
  type: string;
  payload: TPayload;
  timestamp: string;
  id?: string;
}

// ============================================================================
// EMAIL SYSTEM TYPES
// ============================================================================

/**
 * Email processing status
 */
export type EmailProcessingStatus = 
  | 'pending'
  | 'processing'
  | 'analyzed'
  | 'completed'
  | 'failed'
  | 'skipped';

/**
 * Email analysis phase results
 */
export interface EmailAnalysisResults {
  phase1?: Record<string, unknown>;
  phase2?: Record<string, unknown>;
  phase3?: Record<string, unknown>;
  confidence?: number;
  errors?: string[];
}

// ============================================================================
// ERROR AND LOADING STATES
// ============================================================================

/**
 * Generic error state
 */
export interface ErrorState {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

/**
 * Loading state with progress
 */
export interface LoadingState {
  loading: boolean;
  progress?: number;
  message?: string;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for database row
 */
export function isDatabaseRow(value: unknown): value is DatabaseRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for error state
 */
export function isErrorState(value: unknown): value is ErrorState {
  return typeof value === 'object' && 
         value !== null && 
         'message' in value && 
         typeof (value as ErrorState).message === 'string';
}

/**
 * Type guard for API response
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return typeof value === 'object' && 
         value !== null && 
         'success' in value && 
         'data' in value;
}