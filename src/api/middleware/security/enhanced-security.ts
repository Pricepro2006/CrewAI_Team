/**
 * Enhanced Security Middleware for tRPC
 * Comprehensive SQL injection protection and advanced security measures
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "../../trpc/context";
import { logger } from "../../../utils/logger";
import { 
  SqlInjectionProtection, 
  SqlInjectionError, 
  DatabaseInputSchemas,
  createSqlInjectionProtection 
} from "../../../database/security/SqlInjectionProtection";

// Create SQL injection protection instance for middleware
const sqlSecurity = createSqlInjectionProtection({
  enableStrictValidation: true,
  enableQueryLogging: process.env.NODE_ENV === 'development',
  enableBlacklist: true,
  maxQueryLength: 5000, // Smaller limit for API inputs
  maxParameterCount: 50
});

/**
 * Enhanced sanitization schemas with SQL injection protection
 */
export const enhancedSanitizationSchemas = {
  // Basic types with enhanced validation
  string: z.string().max(1000).trim(),
  
  // SQL-safe string with comprehensive validation
  sqlSafe: DatabaseInputSchemas.shortText
    .refine((val) => {
      try {
        sqlSecurity.validateQueryParameters([val]);
        return true;
      } catch (error) {
        return false;
      }
    }, "Potentially unsafe SQL content detected"),
  
  // HTML-safe string with encoding
  htmlSafe: z.string()
    .transform(str => str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
    ),
  
  // Database input schemas
  email: DatabaseInputSchemas.email,
  uuid: DatabaseInputSchemas.id,
  url: z.string().url().max(2048),
  
  // Enhanced search query validation
  searchQuery: DatabaseInputSchemas.searchQuery,
  
  // Column and table name validation
  columnName: DatabaseInputSchemas.columnName,
  tableName: DatabaseInputSchemas.tableName,
  
  // Numeric validation
  positiveInteger: DatabaseInputSchemas.positiveInteger,
  currency: DatabaseInputSchemas.currency,
  
  // Enum validation
  userRole: DatabaseInputSchemas.userRole,
  userStatus: DatabaseInputSchemas.userStatus,
  emailStatus: DatabaseInputSchemas.emailStatus,
  emailPriority: DatabaseInputSchemas.emailPriority,
  dealStatus: DatabaseInputSchemas.dealStatus,
  taskStatus: DatabaseInputSchemas.taskStatus,
  
  // JSON field validation
  jsonField: DatabaseInputSchemas.jsonField
};

/**
 * Create enhanced input validation middleware with SQL injection protection
 */
export function createEnhancedInputValidation<T extends z.ZodTypeAny>(schema: T) {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
  }) => {
    const { ctx, next, input } = opts;

    try {
      // First, perform SQL injection validation on string inputs
      if (input && typeof input === 'object') {
        validateInputForSqlInjection(input, ctx);
      }
      
      // Then validate with Zod schema
      const validatedInput = await schema.parseAsync(input);

      // Update context with validated input and continue
      ctx.validatedInput = validatedInput;
      return next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn("Input Validation Failed", "SECURITY", {
          userId: ctx.user?.id,
          requestId: ctx.requestId,
          errors: error.errors,
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid input",
          cause: error.errors,
        });
      }
      
      if (error instanceof SqlInjectionError) {
        logger.error("SQL Injection Attempt in tRPC Input", "SECURITY", {
          userId: ctx.user?.id,
          requestId: ctx.requestId,
          error: error.message,
          suspiciousInput: error.suspiciousInput
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid input detected",
        });
      }

      throw error;
    }
  };
}

/**
 * Validate input object for SQL injection attempts
 */
function validateInputForSqlInjection(input: any, ctx: Context): void {
  function validateValue(value: any, path: string = ''): void {
    if (typeof value === 'string') {
      try {
        sqlSecurity.validateQueryParameters([value]);
      } catch (error) {
        if (error instanceof SqlInjectionError) {
          throw new SqlInjectionError(
            `SQL injection attempt detected in input${path ? ` at ${path}` : ''}`,
            value
          );
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        validateValue(item, `${path}[${index}]`);
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => {
        // Validate the key itself
        if (typeof key === 'string') {
          try {
            sqlSecurity.validateQueryParameters([key]);
          } catch (error) {
            if (error instanceof SqlInjectionError) {
              throw new SqlInjectionError(
                `SQL injection attempt detected in input key${path ? ` at ${path}` : ''}: ${key}`,
                key
              );
            }
          }
        }
        
        // Validate the value
        validateValue(val, path ? `${path}.${key}` : key);
      });
    }
  }

  validateValue(input);
}

/**
 * Create comprehensive database input validation middleware
 */
export function createDatabaseInputValidation() {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
  }) => {
    const { ctx, next, input } = opts;

    try {
      // Validate input for SQL injection
      if (input && typeof input === 'object') {
        validateInputForSqlInjection(input, ctx);
      }
      
      // Additional database-specific validations
      if (input && typeof input === 'object') {
        validateDatabaseSpecificInput(input, ctx);
      }

      return next();
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        logger.error("Database Input Validation Failed", "SECURITY", {
          userId: ctx.user?.id,
          requestId: ctx.requestId,
          error: error.message,
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid database input",
        });
      }
      throw error;
    }
  };
}

/**
 * Validate database-specific input patterns
 */
function validateDatabaseSpecificInput(input: any, ctx: Context): void {
  function validateDatabaseValue(value: any, path: string = ''): void {
    if (typeof value === 'string') {
      // Check for common database attack patterns
      const suspiciousPatterns = [
        /union\s+select/i,
        /insert\s+into/i,
        /delete\s+from/i,
        /drop\s+table/i,
        /exec\s+/i,
        /xp_cmdshell/i,
        /sp_executesql/i,
        /information_schema/i,
        /sqlite_master/i
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
          throw new SqlInjectionError(
            `Suspicious database pattern detected${path ? ` at ${path}` : ''}`,
            value
          );
        }
      }
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        validateDatabaseValue(item, `${path}[${index}]`);
      });
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => {
        validateDatabaseValue(val, path ? `${path}.${key}` : key);
      });
    }
  }

  validateDatabaseValue(input);
}

/**
 * Create enhanced request size limit middleware with DoS protection
 */
export function createEnhancedRequestSizeLimit(maxSizeBytes: number) {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
  }) => {
    const { ctx, next, input } = opts;

    // Estimate input size
    const inputSize = JSON.stringify(input).length;

    if (inputSize > maxSizeBytes) {
      logger.warn("Request Size Limit Exceeded", "SECURITY", {
        userId: ctx.user?.id,
        requestId: ctx.requestId,
        size: inputSize,
        limit: maxSizeBytes,
      });

      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Request size exceeds limit",
      });
    }

    // Additional validation for deeply nested objects (potential DoS)
    if (input && typeof input === 'object') {
      const depth = getObjectDepth(input);
      if (depth > 10) { // Reasonable nesting limit
        logger.warn("Excessive Object Nesting Detected", "SECURITY", {
          userId: ctx.user?.id,
          requestId: ctx.requestId,
          depth,
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Request structure too complex",
        });
      }
    }

    return next();
  };
}

/**
 * Calculate object nesting depth
 */
function getObjectDepth(obj: any): number {
  if (obj === null || typeof obj !== 'object') {
    return 0;
  }
  
  if (Array.isArray(obj)) {
    return 1 + Math.max(0, ...obj.map(getObjectDepth));
  }
  
  return 1 + Math.max(0, ...Object.values(obj).map(getObjectDepth));
}

/**
 * Create enhanced security audit middleware
 */
export function createEnhancedSecurityAuditMiddleware() {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    path: string;
    type: string;
    input: unknown;
  }) => {
    const { ctx, next, path, type, input } = opts;
    const startTime = Date.now();

    // Enhanced request logging with security context
    const securityContext = {
      path,
      type,
      userId: ctx.user?.id,
      userRole: ctx.user?.role,
      requestId: ctx.requestId,
      hasInput: !!input,
      ip: ctx.req?.ip,
      userAgent: ctx.req?.headers?.['user-agent'],
      inputSize: input ? JSON.stringify(input).length : 0,
      timestamp: new Date().toISOString()
    };

    logger.debug("tRPC Security Audit - Request Start", "SECURITY_AUDIT", securityContext);

    try {
      const result = await next();
      
      const duration = Date.now() - startTime;
      
      // Log successful requests with performance metrics
      logger.debug("tRPC Security Audit - Request Success", "SECURITY_AUDIT", {
        ...securityContext,
        duration,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Enhanced error logging with security implications
      const errorContext = {
        ...securityContext,
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: error instanceof TRPCError ? error.code : undefined,
        isSqlInjectionAttempt: error instanceof SqlInjectionError,
        isSecurityError: error instanceof SqlInjectionError || 
                        (error instanceof TRPCError && 
                         ['UNAUTHORIZED', 'FORBIDDEN', 'TOO_MANY_REQUESTS'].includes(error.code))
      };
      
      if (errorContext.isSecurityError) {
        logger.error("tRPC Security Audit - Security Violation", "SECURITY_AUDIT", errorContext);
      } else {
        logger.warn("tRPC Security Audit - Request Failed", "SECURITY_AUDIT", errorContext);
      }

      throw error;
    }
  };
}

/**
 * Create enhanced authentication middleware with security logging
 */
export function createEnhancedAuthMiddleware() {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
  }) => {
    const { ctx, next } = opts;

    // Check if user is authenticated
    if (!ctx.user || ctx.user.username === "guest") {
      logger.warn("Unauthenticated Access Attempt", "SECURITY", {
        ip: ctx.req?.ip,
        userAgent: ctx.req?.headers?.['user-agent'],
        requestId: ctx.requestId
      });
      
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    // Check if user is active
    if (!ctx.user.is_active) {
      logger.warn("Inactive User Access Attempt", "SECURITY", {
        userId: ctx.user.id,
        username: ctx.user.username,
        requestId: ctx.requestId
      });
      
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Account is inactive",
      });
    }

    // Update last activity
    ctx.user.lastActivity = new Date();

    return next();
  };
}

/**
 * Create comprehensive security middleware stack
 */
export function createSecurityMiddlewareStack(options: {
  enableRateLimit?: boolean;
  enableCSRF?: boolean;
  enableSqlInjectionProtection?: boolean;
  enableInputValidation?: boolean;
  maxRequestSize?: number;
  allowedRoles?: string[];
} = {}) {
  const middlewares = [];
  
  // Enhanced security audit (always enabled)
  middlewares.push(createEnhancedSecurityAuditMiddleware());
  
  // Enhanced request size limit with DoS protection
  if (options.maxRequestSize) {
    middlewares.push(createEnhancedRequestSizeLimit(options.maxRequestSize));
  }
  
  // SQL injection protection (enabled by default)
  if (options.enableSqlInjectionProtection !== false) {
    middlewares.push(createDatabaseInputValidation());
  }
  
  return middlewares;
}

/**
 * Create security test middleware to verify protection
 */
export function createSecurityTestMiddleware() {
  return async (opts: {
    ctx: Context;
    next: () => Promise<any>;
    input: unknown;
  }) => {
    const { ctx, next, input } = opts;

    // Run security tests on input
    if (input && typeof input === 'object') {
      try {
        validateInputForSqlInjection(input, ctx);
        validateDatabaseSpecificInput(input, ctx);
      } catch (error) {
        if (error instanceof SqlInjectionError) {
          logger.error("Security Test Failed - SQL Injection Detected", "SECURITY_TEST", {
            userId: ctx.user?.id,
            requestId: ctx.requestId,
            error: error.message,
            suspiciousInput: error.suspiciousInput
          });
          throw error;
        }
      }
    }

    return next();
  };
}

// Export SQL injection protection utilities
export {
  SqlInjectionProtection,
  SqlInjectionError,
  DatabaseInputSchemas,
  createSqlInjectionProtection
} from '../../../database/security/SqlInjectionProtection';