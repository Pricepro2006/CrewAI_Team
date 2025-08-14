/**
 * Efficient Pagination Utilities for tRPC API Optimization
 * Implements both cursor-based and offset-based pagination with performance optimizations
 */

import { z } from "zod";
import { logger } from "./logger.js";

// Base pagination types
export interface PaginationMeta {
  total: number;
  page?: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages?: number;
}

export interface CursorPaginationMeta {
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  startCursor?: string;
  endCursor?: string;
  total?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface CursorPaginatedResult<T> {
  data: T[];
  meta: CursorPaginationMeta;
}

// Validation schemas
export const offsetPaginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  includeTotal: z.boolean().default(false), // Optimization: only calculate total when needed
});

export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  direction: z.enum(["forward", "backward"]).default("forward"),
  includeTotal: z.boolean().default(false),
});

// Field selection for GraphQL-like filtering
export const fieldSelectionSchema = z.object({
  fields: z.array(z.string()).optional(),
  exclude: z.array(z.string()).optional(),
  include: z.record(z.boolean()).optional(), // For nested field selection
});

export type OffsetPaginationInput = z.infer<typeof offsetPaginationSchema>;
export type CursorPaginationInput = z.infer<typeof cursorPaginationSchema>;
export type FieldSelectionInput = z.infer<typeof fieldSelectionSchema>;

/**
 * Create offset-based pagination
 * Optimized for known dataset sizes and random access
 */
export function createOffsetPagination<T>(
  data: T[],
  totalCount: number,
  input: OffsetPaginationInput
): PaginatedResult<T> {
  const { page, limit, includeTotal } = input;
  const offset = (page - 1) * limit;
  
  const meta: PaginationMeta = {
    total: includeTotal ? totalCount : data.length,
    page,
    limit,
    hasNext: offset + limit < totalCount,
    hasPrev: page > 1,
    totalPages: includeTotal ? Math.ceil(totalCount / limit) : undefined,
  };

  return {
    data: data.slice(0, limit), // Data should already be limited by query
    meta,
  };
}

/**
 * Create cursor-based pagination
 * Optimized for real-time data and better performance on large datasets
 */
export function createCursorPagination<T extends { id: string; created_at?: string }>(
  data: T[],
  input: CursorPaginationInput,
  totalCount?: number
): CursorPaginatedResult<T> {
  const { limit, includeTotal } = input;
  
  // Extract cursors from data
  const startCursor = data.length > 0 ? encodeCursor(data[0]) : undefined;
  const endCursor = data.length > 0 ? encodeCursor(data[data.length - 1]) : undefined;
  
  const meta: CursorPaginationMeta = {
    limit,
    hasNext: data.length === limit, // If we got exactly limit items, there might be more
    hasPrev: !!input.cursor, // If cursor was provided, we can go back
    startCursor,
    endCursor,
    total: includeTotal ? totalCount : undefined,
  };

  return {
    data: data.slice(0, limit),
    meta,
  };
}

/**
 * Encode cursor for cursor-based pagination
 * Uses base64 encoding of timestamp and ID for reliable ordering
 */
export function encodeCursor(item: { id: string; created_at?: string }): string {
  const timestamp = item.created_at || new Date().toISOString();
  const cursor = `${timestamp}:${item.id}`;
  return Buffer.from(cursor).toString("base64");
}

/**
 * Decode cursor for cursor-based pagination
 */
export function decodeCursor(cursor: string): { timestamp: string; id: string } {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [timestamp, id] = decoded.split(":");
    
    if (!timestamp || !id) {
      throw new Error("Invalid cursor format");
    }
    
    return { timestamp, id };
  } catch (error) {
    logger.error("Failed to decode cursor", "PAGINATION", { cursor, error });
    throw new Error("Invalid cursor");
  }
}

/**
 * Build SQL WHERE clause for cursor-based pagination
 * Optimized for database queries with proper indexing
 */
export function buildCursorWhereClause(
  cursor: string,
  direction: "forward" | "backward" = "forward",
  timestampColumn: string = "created_at",
  idColumn: string = "id"
): { whereClause: string; params: any[] } {
  const { timestamp, id } = decodeCursor(cursor);
  
  if (direction === "forward") {
    return {
      whereClause: `(${timestampColumn} > ? OR (${timestampColumn} = ? AND ${idColumn} > ?))`,
      params: [timestamp, timestamp, id],
    };
  } else {
    return {
      whereClause: `(${timestampColumn} < ? OR (${timestampColumn} = ? AND ${idColumn} < ?))`,
      params: [timestamp, timestamp, id],
    };
  }
}

/**
 * Apply field selection to filter response data
 * Implements GraphQL-like field filtering for bandwidth optimization
 */
export function applyFieldSelection<T extends Record<string, any>>(
  data: T[],
  selection: FieldSelectionInput
): Partial<T>[] {
  if (!selection.fields && !selection.exclude && !selection.include) {
    return data; // No filtering requested
  }

  return data.map(item => {
    let result: Partial<T> = {};

    // If specific fields are requested, include only those
    if (selection.fields) {
      for (const field of selection.fields) {
        if (field in item) {
          result[field as keyof T] = item[field];
        }
      }
    } else {
      // Include all fields by default
      result = { ...item };
    }

    // Remove excluded fields
    if (selection.exclude) {
      for (const field of selection.exclude) {
        delete result[field as keyof T];
      }
    }

    // Apply nested include/exclude logic
    if (selection.include) {
      for (const [field, include] of Object.entries(selection.include)) {
        if (!include) {
          delete result[field as keyof T];
        }
      }
    }

    return result;
  });
}

/**
 * Optimize query with smart counting
 * Only performs COUNT when necessary for performance
 */
export async function optimizedCount<T>(
  queryFn: () => Promise<T[]>,
  countFn: () => Promise<number>,
  includeTotal: boolean,
  estimateThreshold: number = 1000
): Promise<{ data: T[]; total?: number }> {
  const data = await queryFn();
  
  if (!includeTotal) {
    return { data };
  }
  
  // For small datasets, use data length as optimization
  if (data.length < estimateThreshold) {
    return { data, total: data.length };
  }
  
  // For large datasets, perform actual count
  const total = await countFn();
  return { data, total };
}

/**
 * Create optimized pagination query builder
 * Generates efficient SQL with proper LIMIT and OFFSET
 */
export class PaginationQueryBuilder {
  private baseQuery: string;
  private whereConditions: string[] = [];
  private orderBy: string = "created_at DESC";
  private params: any[] = [];

  constructor(baseQuery: string) {
    this.baseQuery = baseQuery;
  }

  addWhere(condition: string, ...params: any[]): this {
    this.whereConditions.push(condition);
    this.params.push(...params);
    return this;
  }

  setOrderBy(orderBy: string): this {
    this.orderBy = orderBy;
    return this;
  }

  buildOffsetQuery(input: OffsetPaginationInput): { query: string; params: any[] } {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    let query = this.baseQuery;
    
    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(" AND ")}`;
    }
    
    query += ` ORDER BY ${this.orderBy}`;
    query += ` LIMIT ? OFFSET ?`;

    return {
      query,
      params: [...this.params, limit, offset],
    };
  }

  buildCursorQuery(input: CursorPaginationInput): { query: string; params: any[] } {
    const { cursor, limit, direction } = input;
    let query = this.baseQuery;
    let params = [...this.params];

    const conditions = [...this.whereConditions];

    if (cursor) {
      const { whereClause, params: cursorParams } = buildCursorWhereClause(cursor, direction);
      conditions.push(whereClause);
      params.push(...cursorParams);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(" AND ")}`;
    }

    // For backward pagination, reverse the order
    const orderDirection = direction === "backward" ? 
      this.orderBy.replace("DESC", "TEMP").replace("ASC", "DESC").replace("TEMP", "ASC") :
      this.orderBy;

    query += ` ORDER BY ${orderDirection}`;
    query += ` LIMIT ?`;
    params.push(limit + 1); // Get one extra to check if there are more results

    return { query, params };
  }

  buildCountQuery(): { query: string; params: any[] } {
    let query = this.baseQuery.replace(/SELECT .+ FROM/, "SELECT COUNT(*) as total FROM");
    
    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(" AND ")}`;
    }

    return {
      query,
      params: [...this.params],
    };
  }
}

/**
 * Response size optimization utilities
 */
export class ResponseOptimizer {
  /**
   * Estimate response size in bytes
   */
  static estimateSize(data: any): number {
    return Buffer.byteLength(JSON.stringify(data), 'utf8');
  }

  /**
   * Check if response should be compressed
   */
  static shouldCompress(data: any, threshold: number = 1024): boolean {
    return this.estimateSize(data) > threshold;
  }

  /**
   * Optimize large arrays by chunking
   */
  static chunkLargeArrays<T>(data: T[], maxChunkSize: number = 50): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < data.length; i += maxChunkSize) {
      chunks.push(data.slice(i, i + maxChunkSize));
    }
    return chunks;
  }

  /**
   * Remove null/undefined values to reduce payload size
   */
  static cleanPayload<T extends Record<string, any>>(data: T[]): T[] {
    return data.map(item => {
      const cleaned: Partial<T> = {};
      for (const [key, value] of Object.entries(item)) {
        if (value !== null && value !== undefined) {
          cleaned[key as keyof T] = value;
        }
      }
      return cleaned as T;
    });
  }
}

/**
 * Cache key generation for pagination results
 */
export class PaginationCacheKeyGenerator {
  static forOffsetPagination(
    baseKey: string,
    input: OffsetPaginationInput,
    filters?: Record<string, any>
  ): string {
    const filterStr = filters ? JSON.stringify(filters) : "";
    return `${baseKey}:offset:${input.page}:${input.limit}:${input.includeTotal}:${filterStr}`;
  }

  static forCursorPagination(
    baseKey: string,
    input: CursorPaginationInput,
    filters?: Record<string, any>
  ): string {
    const filterStr = filters ? JSON.stringify(filters) : "";
    const cursor = input.cursor || "start";
    return `${baseKey}:cursor:${cursor}:${input.limit}:${input.direction}:${input.includeTotal}:${filterStr}`;
  }
}