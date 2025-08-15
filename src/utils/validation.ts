/**
 * Enhanced Validation and Sanitization Utilities for tRPC API Optimization
 * High-performance validation with caching and optimized error handling
 */

import { z } from "zod";
import { logger } from "./logger.js";
import { TRPCError } from "@trpc/server";
// @ts-ignore - isomorphic-dompurify has complex typing
import DOMPurify from "isomorphic-dompurify";
import validator from "validator";

// Validation cache for improved performance
const validationCache = new Map<string, { isValid: boolean; error?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10000;

/**
 * Performance-optimized validation with caching
 */
export class OptimizedValidator {
  private static instance: OptimizedValidator;
  
  static getInstance(): OptimizedValidator {
    if (!OptimizedValidator.instance) {
      OptimizedValidator.instance = new OptimizedValidator();
    }
    return OptimizedValidator.instance;
  }

  /**
   * Validate with caching for repeated validations
   */
  async validateWithCache<T>(
    schema: z.ZodSchema<T>,
    data: unknown,
    cacheKey?: string
  ): Promise<{ success: true; data: T } | { success: false; error: string }> {
    // Generate cache key if not provided
    const key = cacheKey || this.generateCacheKey(schema, data);
    
    // Check cache first
    const cached = this.getCachedValidation(key);
    if (cached) {
      if (cached.isValid) {
        return { success: true, data: data as T };
      } else {
        return { success: false, error: cached.error || "Validation failed" };
      }
    }

    // Perform validation
    const result = schema.safeParse(data);
    
    if (result.success) {
      this.setCachedValidation(key, { isValid: true, timestamp: Date.now() });
      return { success: true, data: result.data };
    } else {
      const errorMessage = this.formatZodError(result.error);
      this.setCachedValidation(key, { 
        isValid: false, 
        error: errorMessage, 
        timestamp: Date.now() 
      });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Batch validation for multiple items
   */
  async batchValidate<T>(
    schema: z.ZodSchema<T>,
    items: unknown[]
  ): Promise<Array<{ success: true; data: T; index: number } | { success: false; error: string; index: number }>> {
    const results = await Promise.all(
      items.map(async (item, index) => {
        const result = await this.validateWithCache(schema, item, `batch_${index}_${Date.now()}`);
        return { ...result, index };
      })
    );

    return results;
  }

  /**
   * Fast validation for simple types (no caching overhead)
   */
  fastValidate<T>(schema: z.ZodSchema<T>, data: unknown): T {
    const result = schema.parse(data);
    return result;
  }

  private generateCacheKey(schema: z.ZodSchema, data: unknown): string {
    // Simple hash based on schema description and data
    const schemaKey = (schema as any)._def?.typeName || 'unknown';
    const dataKey = typeof data === 'object' ? JSON.stringify(data) : String(data);
    return `${schemaKey}:${this.simpleHash(dataKey)}`;
  }

  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private getCachedValidation(key: string) {
    const cached = validationCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached;
    }
    if (cached) {
      validationCache.delete(key); // Remove expired
    }
    return null;
  }

  private setCachedValidation(key: string, value: { isValid: boolean; error?: string; timestamp: number }) {
    if (validationCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entries
      const oldestKey = validationCache.keys().next().value;
      if (oldestKey !== undefined) {
        validationCache.delete(oldestKey);
      }
    }
    validationCache.set(key, value);
  }

  private formatZodError(error: z.ZodError): string {
    return error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
  }

  /**
   * Clear validation cache
   */
  clearCache(): void {
    validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: validationCache.size,
      maxSize: MAX_CACHE_SIZE,
      ttl: CACHE_TTL,
    };
  }
}

/**
 * High-performance sanitization utilities
 */
export class OptimizedSanitizer {
  /**
   * Sanitize HTML content with performance optimizations
   */
  static sanitizeHtml(content: string, options?: {
    allowTags?: string[];
    stripAll?: boolean;
  }): string {
    if (!content) return '';
    
    if (options?.stripAll) {
      return content.replace(/<[^>]*>/g, '');
    }

    const config = options?.allowTags ? {
      ALLOWED_TAGS: options.allowTags,
      ALLOWED_ATTR: [],
    } : undefined;

    return DOMPurify.sanitize(content, config);
  }

  /**
   * Sanitize and validate email addresses
   */
  static sanitizeEmail(email: string): string | null {
    if (!email || typeof email !== 'string') return null;
    
    const cleaned = email.trim().toLowerCase();
    return validator.isEmail(cleaned) ? cleaned : null;
  }

  /**
   * Sanitize URLs with validation
   */
  static sanitizeUrl(url: string): string | null {
    if (!url || typeof url !== 'string') return null;
    
    const cleaned = url.trim();
    if (validator.isURL(cleaned, { protocols: ['http', 'https'] })) {
      return cleaned;
    }
    
    return null;
  }

  /**
   * Sanitize search queries
   */
  static sanitizeSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') return '';
    
    return query
      .trim()
      .replace(/[<>'"&]/g, '') // Remove potential XSS characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 500); // Limit length
  }

  /**
   * Sanitize SQL-safe strings (for LIKE queries)
   */
  static sanitizeSqlString(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/[%_\\]/g, '\\$&') // Escape SQL wildcards
      .replace(/['"]/g, '') // Remove quotes
      .trim();
  }

  /**
   * Sanitize numeric inputs
   */
  static sanitizeNumber(input: any, options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }): number | null {
    const num = Number(input);
    
    if (isNaN(num)) return null;
    
    if (options?.integer && !Number.isInteger(num)) return null;
    
    if (options?.min !== undefined && num < options.min) return options.min;
    if (options?.max !== undefined && num > options.max) return options.max;
    
    return num;
  }

  /**
   * Batch sanitization for arrays
   */
  static batchSanitize<T>(
    items: any[],
    sanitizer: (item: any) => T | null
  ): T[] {
    return items
      .map(sanitizer)
      .filter((item): item is T => item !== null);
  }
}

/**
 * Performance-optimized validation schemas
 */
export const OptimizedSchemas = {
  // Fast string validation with caching
  fastString: z.string().min(1).max(1000).transform(val => val.trim()),
  
  // Email validation with sanitization
  email: z.string().transform(OptimizedSanitizer.sanitizeEmail).refine(val => val !== null),
  
  // URL validation with sanitization
  url: z.string().transform(OptimizedSanitizer.sanitizeUrl).refine(val => val !== null),
  
  // Search query validation
  searchQuery: z.string().transform(OptimizedSanitizer.sanitizeSearchQuery),
  
  // SQL-safe string
  sqlSafeString: z.string().transform(OptimizedSanitizer.sanitizeSqlString),
  
  // Optimized numeric inputs
  positiveNumber: z.number().min(0).finite(),
  price: z.number().min(0).max(1000000).multipleOf(0.01),
  quantity: z.number().int().min(0).max(1000000),
  
  // UUID with performance optimization
  uuid: z.string().uuid(),
  
  // Pagination parameters
  pagination: z.object({
    page: z.number().int().min(1).max(10000).default(1),
    limit: z.number().int().min(1).max(100).default(20),
  }),
  
  // Sort parameters
  sort: z.object({
    field: z.string().max(50),
    direction: z.enum(['asc', 'desc']).default('asc'),
  }),
  
  // Date range validation
  dateRange: z.object({
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
  }).refine(data => {
    if (data.start && data.end) {
      return new Date(data.start) <= new Date(data.end);
    }
    return true;
  }, "End date must be after start date"),
};

/**
 * Validation middleware for tRPC with performance optimizations
 */
export function createOptimizedValidationMiddleware() {
  const validator = OptimizedValidator.getInstance();
  
  return async ({ next, input }: { next: () => Promise<any>; input: any }) => {
    const startTime = Date.now();
    
    try {
      // Apply basic sanitization to string inputs
      if (typeof input === 'object' && input !== null) {
        input = sanitizeObjectInputs(input);
      }
      
      const result = await next();
      const validationTime = Date.now() - startTime;
      
      if (validationTime > 100) {
        logger.warn("Slow validation detected", "VALIDATION", {
          validationTime,
          inputSize: JSON.stringify(input).length,
        });
      }
      
      return result;
    } catch (error) {
      const validationTime = Date.now() - startTime;
      logger.error("Validation middleware error", "VALIDATION", {
        error,
        validationTime,
      });
      throw error;
    }
  };
}

/**
 * Sanitize object inputs recursively
 */
function sanitizeObjectInputs(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObjectInputs);
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Basic string sanitization
      sanitized[key] = value.trim().substring(0, 10000); // Prevent extremely long strings
    } else if (typeof value === 'object') {
      sanitized[key] = sanitizeObjectInputs(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Request rate limiting validation
 */
export class RequestValidator {
  private static requestCounts = new Map<string, { count: number; resetTime: number }>();
  
  /**
   * Validate request rate limits
   */
  static validateRequestRate(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean expired entries
    const entries = Array.from(this.requestCounts.entries());
    for (const [key, value] of entries) {
      if (value.resetTime < now) {
        this.requestCounts.delete(key);
      }
    }
    
    const existing = this.requestCounts.get(identifier);
    
    if (!existing) {
      this.requestCounts.set(identifier, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (existing.count >= maxRequests) {
      return false;
    }
    
    existing.count++;
    return true;
  }
  
  /**
   * Get current request count for identifier
   */
  static getRequestCount(identifier: string): number {
    const existing = this.requestCounts.get(identifier);
    return existing?.count || 0;
  }
  
  /**
   * Clear request counts
   */
  static clearCounts(): void {
    this.requestCounts.clear();
  }
}

/**
 * Error formatting for validation failures
 */
export class ValidationErrorFormatter {
  /**
   * Format validation errors for client consumption
   */
  static formatError(error: z.ZodError): {
    message: string;
    fields: Record<string, string[]>;
    code: string;
  } {
    const fields: Record<string, string[]> = {};
    
    for (const issue of error.issues) {
      const path = issue.path.join('.');
      if (!fields[path]) {
        fields[path] = [];
      }
      fields[path].push(issue.message);
    }
    
    return {
      message: "Validation failed",
      fields,
      code: "VALIDATION_ERROR",
    };
  }
  
  /**
   * Create TRPC error from validation failure
   */
  static createTRPCError(error: z.ZodError): TRPCError {
    const formatted = this.formatError(error);
    
    return new TRPCError({
      code: "BAD_REQUEST",
      message: formatted.message,
      cause: formatted,
    });
  }
}

/**
 * Performance monitoring for validation
 */
export class ValidationPerformanceMonitor {
  private static metrics = new Map<string, {
    totalValidations: number;
    averageTime: number;
    cacheHitRate: number;
    errorRate: number;
  }>();
  
  /**
   * Record validation performance metrics
   */
  static recordMetrics(
    schemaType: string,
    validationTime: number,
    success: boolean,
    fromCache: boolean
  ): void {
    const existing = this.metrics.get(schemaType) || {
      totalValidations: 0,
      averageTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
    };
    
    const newTotal = existing.totalValidations + 1;
    const newAvgTime = (existing.averageTime * existing.totalValidations + validationTime) / newTotal;
    const newCacheHitRate = (existing.cacheHitRate * existing.totalValidations + (fromCache ? 1 : 0)) / newTotal;
    const newErrorRate = (existing.errorRate * existing.totalValidations + (success ? 0 : 1)) / newTotal;
    
    this.metrics.set(schemaType, {
      totalValidations: newTotal,
      averageTime: newAvgTime,
      cacheHitRate: newCacheHitRate,
      errorRate: newErrorRate,
    });
  }
  
  /**
   * Get validation metrics
   */
  static getMetrics(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }
  
  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }
}

// Export singleton instances
export const optimizedValidator = OptimizedValidator.getInstance();
export const validationErrorFormatter = ValidationErrorFormatter;
export const validationPerformanceMonitor = ValidationPerformanceMonitor;