/**
 * Database Type Definitions
 * Comprehensive type system for database operations and results
 */

import { z } from 'zod';
import type Database from 'better-sqlite3';

// ============================================================================
// Core Database Types
// ============================================================================

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: boolean;
  memory?: boolean;
}

/**
 * Database query result from better-sqlite3
 */
export interface DatabaseRow {
  [key: string]: any;
}

/**
 * Typed database result with row count
 */
export interface DatabaseResult<T = DatabaseRow> {
  rows: T[];
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Database statement result
 */
export interface StatementResult {
  changes: number;
  lastInsertRowid: number | bigint;
}

/**
 * Prepared statement type
 */
export type PreparedStatement<T = any> = Database.Statement<T>;

// ============================================================================
// Query Result Types
// ============================================================================

/**
 * Email query result
 */
export interface EmailQueryResult {
  id: string;
  message_id?: string;
  thread_id?: string;
  subject: string;
  sender_email: string;
  sender_name?: string;
  recipient_emails?: string;
  date: string;
  body_text?: string;
  body_html?: string;
  has_attachments?: boolean | number;
  attachment_count?: number;
  labels?: string;
  folder?: string;
  is_read?: boolean | number;
  is_important?: boolean | number;
  priority?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // For additional fields
}

/**
 * Walmart product query result
 */
export interface WalmartProductQueryResult {
  id?: number;
  product_id: string;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  original_price?: number;
  savings?: number;
  in_stock?: boolean | number;
  stock_level?: number;
  rating?: number;
  review_count?: number;
  image_url?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

/**
 * Deal query result
 */
export interface DealQueryResult {
  id?: string;
  deal_base: string;
  customer_name?: string;
  product_id?: string;
  product_name?: string;
  quantity?: number;
  price?: number;
  end_date?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

/**
 * Workflow task query result
 */
export interface WorkflowTaskQueryResult {
  task_id: string;
  email_id?: string;
  workflow_category?: string;
  workflow_state?: string;
  task_status?: string;
  title?: string;
  description?: string;
  priority?: string;
  current_owner?: string;
  owner_email?: string;
  dollar_value?: number;
  sla_deadline?: string;
  created_at?: string;
  updated_at?: string;
  completion_date?: string;
  po_numbers?: string; // JSON string
  quote_numbers?: string; // JSON string
  customers?: string; // JSON string
  [key: string]: any;
}

// ============================================================================
// Aggregate Result Types
// ============================================================================

/**
 * Count result
 */
export interface CountResult {
  count: number;
}

/**
 * Sum result
 */
export interface SumResult {
  sum: number | null;
}

/**
 * Average result
 */
export interface AvgResult {
  avg: number | null;
}

/**
 * Min/Max result
 */
export interface MinMaxResult {
  min: any;
  max: any;
}

/**
 * Combined aggregate result
 */
export interface AggregateResult {
  count?: number;
  sum?: number | null;
  avg?: number | null;
  min?: any;
  max?: any;
}

// ============================================================================
// Transaction Types
// ============================================================================

/**
 * Database transaction interface
 */
export interface DatabaseTransaction {
  prepare<T = any>(sql: string): PreparedStatement<T>;
  exec(sql: string): void;
  pragma(sql: string, simple?: boolean): any;
  backup(destination: string): Promise<void>;
  close(): void;
  inTransaction: boolean;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  immediate?: boolean;
  exclusive?: boolean;
}

// ============================================================================
// Migration Types
// ============================================================================

/**
 * Database migration
 */
export interface Migration {
  id: number;
  name: string;
  up: string;
  down?: string;
  timestamp?: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
  id: number;
  name: string;
  applied_at: string;
  success: boolean;
  error?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a database row
 */
export function isDatabaseRow(value: unknown): value is DatabaseRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if value is a database result
 */
export function isDatabaseResult<T = DatabaseRow>(value: unknown): value is DatabaseResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rows' in value &&
    Array.isArray((value as any).rows) &&
    'changes' in value &&
    'lastInsertRowid' in value
  );
}

/**
 * Check if value is a count result
 */
export function isCountResult(value: unknown): value is CountResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'count' in value &&
    typeof (value as any).count === 'number'
  );
}

/**
 * Check if value is an aggregate result
 */
export function isAggregateResult(value: unknown): value is AggregateResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as any;
  return (
    'count' in v ||
    'sum' in v ||
    'avg' in v ||
    'min' in v ||
    'max' in v
  );
}

// ============================================================================
// Null Handling Utilities
// ============================================================================

/**
 * Convert SQLite boolean (0/1) to JavaScript boolean
 */
export function toBoolean(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  return value === 1 || value === '1' || value === 'true';
}

/**
 * Convert JavaScript boolean to SQLite boolean (0/1)
 */
export function fromBoolean(value: boolean | undefined | null): number {
  return value ? 1 : 0;
}

/**
 * Parse JSON field safely
 */
export function parseJsonField<T = any>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Stringify JSON field safely
 */
export function stringifyJsonField(value: any): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

// ============================================================================
// Query Builder Types
// ============================================================================

/**
 * Query parameters
 */
export type QueryParams = Record<string, any>;

/**
 * Query options
 */
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Database error with context
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly query?: string,
    public readonly params?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }
}

// ============================================================================
// Schema Validation
// ============================================================================

/**
 * Email schema for validation
 */
export const EmailSchema = z.object({
  id: z.string(),
  message_id: z.string().optional(),
  thread_id: z.string().optional(),
  subject: z.string(),
  sender_email: z.string().email(),
  sender_name: z.string().optional(),
  recipient_emails: z.string().optional(),
  date: z.string(),
  body_text: z.string().optional(),
  body_html: z.string().optional(),
  has_attachments: z.union([z.boolean(), z.number()]).transform(toBoolean),
  attachment_count: z.number().optional(),
  labels: z.string().optional(),
  folder: z.string().optional(),
  is_read: z.union([z.boolean(), z.number()]).transform(toBoolean),
  is_important: z.union([z.boolean(), z.number()]).transform(toBoolean),
  priority: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional()
});

/**
 * Validate and transform database row
 */
export function validateRow<T>(
  schema: z.ZodSchema<T>,
  row: unknown
): T | null {
  try {
    return schema.parse(row);
  } catch {
    return null;
  }
}

// ============================================================================
// Export Types
// ============================================================================

export type {
  Database as DatabaseInstance,
  Statement as DatabaseStatement,
  Transaction as DatabaseTransactionType
} from 'better-sqlite3';