/**
 * Service Layer Validation Schemas
 * Comprehensive type definitions and validators for service layer
 */

import { z } from 'zod';

// ============================================================================
// Error Handling Schemas
// ============================================================================

/**
 * Standard service error with proper Error type
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ServiceError';
    Object.setPrototypeOf(this, ServiceError.prototype);
  }

  static from(error: unknown): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }
    if (error instanceof Error) {
      return new ServiceError(error.message, 'UNKNOWN_ERROR', error);
    }
    return new ServiceError(String(error), 'UNKNOWN_ERROR', error);
  }
}

// ============================================================================
// BullMQ Type Fixes
// ============================================================================

/**
 * Proper BullMQ imports for v5
 */
export type { Queue, Worker, QueueEvents, Job } from 'bullmq';

// ============================================================================
// Email Service Schemas
// ============================================================================

export const EmailDataSchema = z.object({
  id: z.string().min(1),
  subject: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  date: z.string(),
  body: z.string(),
  attachments: z.array(z.any()).optional(),
  metadata: z.record(z.any()).optional()
});

export const IngestionResultSchema = z.object({
  emailId: z.string(),
  success: z.boolean(),
  duplicateOf: z.string().optional(),
  error: z.instanceof(Error).optional(),
  processingTime: z.number().min(0)
});

export const BatchResultSchema = z.object({
  batchId: z.string(),
  totalEmails: z.number().min(0),
  processed: z.number().min(0),
  duplicates: z.number().min(0),
  failed: z.number().min(0),
  results: z.array(IngestionResultSchema),
  processingTime: z.number().min(0)
});

// ============================================================================
// Service Method Type Definitions
// ============================================================================

/**
 * Standard service method signatures
 */
export interface ServiceMethods {
  // Query methods
  getById<T>(id: string): Promise<T | null>;
  getAll<T>(limit?: number): Promise<T[]>;
  find<T>(criteria: Record<string, any>): Promise<T[]>;
  
  // Mutation methods
  create<T>(data: Partial<T>): Promise<T>;
  update<T>(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
  
  // Bulk operations
  createMany<T>(items: Partial<T>[]): Promise<T[]>;
  updateMany<T>(updates: Array<{ id: string; data: Partial<T> }>): Promise<T[]>;
  deleteMany(ids: string[]): Promise<number>;
}

// ============================================================================
// Database Result Types
// ============================================================================

export const DatabaseResultSchema = z.object({
  rows: z.array(z.record(z.any())),
  rowCount: z.number().min(0),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string()
  })).optional()
});

export const AggregateResultSchema = z.object({
  count: z.number().min(0).nullable(),
  sum: z.number().nullable(),
  avg: z.number().nullable(),
  min: z.any().nullable(),
  max: z.any().nullable()
});

// ============================================================================
// Component Health Types
// ============================================================================

export const ComponentHealthSchema = z.object({
  healthy: z.boolean(),
  message: z.string().optional(),
  lastError: z.string().optional(),
  metrics: z.record(z.number()).optional(),
  timestamp: z.string().optional()
});

export type ComponentHealth = z.infer<typeof ComponentHealthSchema>;

// ============================================================================
// Queue Integration Types
// ============================================================================

export const QueueStatusSchema = z.object({
  waiting: z.number().min(0),
  active: z.number().min(0),
  completed: z.number().min(0),
  failed: z.number().min(0),
  delayed: z.number().min(0),
  paused: z.boolean()
});

export type QueueStatus = z.infer<typeof QueueStatusSchema>;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert any error to ServiceError
 */
export function toServiceError(error: unknown): ServiceError {
  return ServiceError.from(error);
}

/**
 * Create a failed Result with proper Error type
 */
export function failedResult<T>(error: unknown): { success: false; error: Error } {
  return {
    success: false,
    error: toServiceError(error)
  };
}

/**
 * Create a successful Result
 */
export function successResult<T>(data: T): { success: true; data: T } {
  return {
    success: true,
    data
  };
}

/**
 * Type guard for checking if value is an Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Type guard for database results
 */
export function isDatabaseResult(value: unknown): value is { rows: any[]; rowCount: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'rows' in value &&
    Array.isArray((value as any).rows) &&
    'rowCount' in value &&
    typeof (value as any).rowCount === 'number'
  );
}

// ============================================================================
// Service Response Types
// ============================================================================

export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
  metadata?: {
    timestamp: string;
    duration: number;
    [key: string]: any;
  };
}

export interface PaginatedServiceResponse<T> extends ServiceResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate and transform service input
 */
export function validateServiceInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { valid: true; data: T } | { valid: false; error: Error } {
  try {
    const data = schema.parse(input);
    return { valid: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        error: new ServiceError(
          'Validation failed',
          'VALIDATION_ERROR',
          error.errors
        )
      };
    }
    return {
      valid: false,
      error: toServiceError(error)
    };
  }
}