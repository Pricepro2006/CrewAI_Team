/**
 * Database Security Module
 * Comprehensive SQL injection protection and security utilities
 */

// Core security components
export {
  SqlInjectionProtection,
  SqlInjectionError,
  DatabaseInputSchemas,
  createSqlInjectionProtection,
  type SqlSecurityConfig,
} from "./SqlInjectionProtection.js";

// Import for internal use
import {
  SqlInjectionProtection,
  SqlInjectionError,
  createSqlInjectionProtection,
} from "./SqlInjectionProtection.js";

import {
  DatabaseErrorHandler,
  type DatabaseError,
} from "./DatabaseErrorHandler.js";

export {
  DatabaseErrorHandler,
  DatabaseSecurityError,
  withDatabaseErrorHandling,
  createDatabaseErrorMiddleware,
  databaseErrorHandler,
  type DatabaseError,
} from "./DatabaseErrorHandler.js";

// Security configuration
export interface DatabaseSecurityConfig {
  sqlInjection: {
    enabled: boolean;
    strictValidation: boolean;
    enableBlacklist: boolean;
    enableQueryLogging: boolean;
    maxQueryLength: number;
    maxParameterCount: number;
  };
  errorHandling: {
    exposeSensitiveErrors: boolean;
    logLevel: "error" | "warn" | "info" | "debug";
    includeStackTrace: boolean;
  };
  validation: {
    enforceInputValidation: boolean;
    maxInputSize: number;
    maxNestingDepth: number;
  };
  monitoring: {
    enabled: boolean;
    alertThreshold: number;
    logSecurityEvents: boolean;
  };
}

/**
 * Default security configuration
 */
export const DEFAULT_SECURITY_CONFIG: DatabaseSecurityConfig = {
  sqlInjection: {
    enabled: true,
    strictValidation: true,
    enableBlacklist: true,
    enableQueryLogging: process.env.NODE_ENV === "development",
    maxQueryLength: 10000,
    maxParameterCount: 100,
  },
  errorHandling: {
    exposeSensitiveErrors: false,
    logLevel: "error",
    includeStackTrace: process.env.NODE_ENV === "development",
  },
  validation: {
    enforceInputValidation: true,
    maxInputSize: 1024 * 1024, // 1MB
    maxNestingDepth: 10,
  },
  monitoring: {
    enabled: true,
    alertThreshold: 5, // Alert after 5 security violations
    logSecurityEvents: true,
  },
};

/**
 * Security violation counter
 */
class SecurityViolationCounter {
  private violations = new Map<
    string,
    { count: number; lastViolation: Date }
  >();

  increment(type: string, identifier: string = "global"): number {
    const key = `${type}:${identifier}`;
    const current = this?.violations?.get(key) || {
      count: 0,
      lastViolation: new Date(),
    };
    current.count++;
    current.lastViolation = new Date();
    this?.violations?.set(key, current);
    return current.count;
  }

  getCount(type: string, identifier: string = "global"): number {
    const key = `${type}:${identifier}`;
    return this?.violations?.get(key)?.count || 0;
  }

  reset(type?: string, identifier?: string): void {
    if (type && identifier) {
      this?.violations?.delete(`${type}:${identifier}`);
    } else if (type) {
      // Reset all violations of this type
      const keys = Array.from(this?.violations?.keys() || []);
      for (const key of keys) {
        if (key.startsWith(`${type}:`)) {
          this?.violations?.delete(key);
        }
      }
    } else {
      this?.violations?.clear();
    }
  }

  getStatistics(): Record<string, { count: number; lastViolation: Date }> {
    return Object.fromEntries(this.violations);
  }
}

/**
 * Database Security Manager
 */
export class DatabaseSecurityManager {
  private config: DatabaseSecurityConfig;
  private sqlSecurity: SqlInjectionProtection;
  private violationCounter: SecurityViolationCounter;

  constructor(config: Partial<DatabaseSecurityConfig> = {}) {
    this.config = { ...DEFAULT_SECURITY_CONFIG, ...config };
    this.sqlSecurity = createSqlInjectionProtection({
      enableStrictValidation: this?.config?.sqlInjection.strictValidation,
      enableQueryLogging: this?.config?.sqlInjection.enableQueryLogging,
      enableBlacklist: this?.config?.sqlInjection.enableBlacklist,
      maxQueryLength: this?.config?.sqlInjection.maxQueryLength,
      maxParameterCount: this?.config?.sqlInjection.maxParameterCount,
    });
    this.violationCounter = new SecurityViolationCounter();
  }

  /**
   * Validate query and parameters
   */
  validateQuery(
    query: string,
    params: any[] = [],
    context: any = {},
  ): {
    query: string;
    params: any[];
  } {
    if (!this?.config?.sqlInjection.enabled) {
      return { query, params };
    }

    try {
      return this?.sqlSecurity?.validateQueryExecution(query, params);
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        this.recordSecurityViolation("sql_injection", context);
        throw error;
      }
      throw error;
    }
  }

  /**
   * Validate input data
   */
  validateInput(input: any, context: any = {}): any {
    if (!this?.config?.validation.enforceInputValidation) {
      return input;
    }

    // Check input size
    const inputSize = JSON.stringify(input).length;
    if (inputSize > this?.config?.validation.maxInputSize) {
      this.recordSecurityViolation("input_size_exceeded", context);
      throw new Error("Input size exceeds maximum allowed limit");
    }

    // Check nesting depth
    const depth = this.getObjectDepth(input);
    if (depth > this?.config?.validation.maxNestingDepth) {
      this.recordSecurityViolation("nesting_depth_exceeded", context);
      throw new Error("Input nesting depth exceeds maximum allowed limit");
    }

    // Validate for SQL injection in input
    try {
      this.validateInputRecursively(input);
      return input;
    } catch (error) {
      if (error instanceof SqlInjectionError) {
        this.recordSecurityViolation("input_sql_injection", context);
        throw error;
      }
      throw error;
    }
  }

  /**
   * Handle database errors securely
   */
  handleError(error: Error, context: any = {}): DatabaseError {
    return DatabaseErrorHandler.handleError(error, context);
  }

  /**
   * Get security statistics
   */
  getSecurityStatistics(): {
    violations: Record<string, { count: number; lastViolation: Date }>;
    config: DatabaseSecurityConfig;
  } {
    return {
      violations: this?.violationCounter?.getStatistics(),
      config: this.config,
    };
  }

  /**
   * Reset security violation counters
   */
  resetViolationCounters(type?: string): void {
    this?.violationCounter?.reset(type);
  }

  /**
   * Update security configuration
   */
  updateConfig(newConfig: Partial<DatabaseSecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate SQL injection protection with new config
    this.sqlSecurity = createSqlInjectionProtection({
      enableStrictValidation: this?.config?.sqlInjection.strictValidation,
      enableQueryLogging: this?.config?.sqlInjection.enableQueryLogging,
      enableBlacklist: this?.config?.sqlInjection.enableBlacklist,
      maxQueryLength: this?.config?.sqlInjection.maxQueryLength,
      maxParameterCount: this?.config?.sqlInjection.maxParameterCount,
    });
  }

  /**
   * Record security violation
   */
  private recordSecurityViolation(type: string, context: any = {}): void {
    const identifier = context.userId || "" || context.ip || "anonymous";
    const violationCount = this?.violationCounter?.increment(type, identifier);

    if (this?.config?.monitoring.logSecurityEvents) {
      import("../../utils/logger.js").then(({ logger }) => {
        logger.warn("Database Security Violation", "DATABASE_SECURITY", {
          violationType: type,
          violationCount,
          context,
          timestamp: new Date().toISOString(),
        });
      });
    }

    // Check if we need to alert
    if (violationCount >= this?.config?.monitoring.alertThreshold) {
      this.alertSecurityViolation(type, identifier, violationCount, context);
    }
  }

  /**
   * Alert on security violations
   */
  private alertSecurityViolation(
    type: string,
    identifier: string,
    count: number,
    context: any,
  ): void {
    import("../../utils/logger.js").then(({ logger }) => {
      logger.error(
        "Security Alert - Repeated Violations",
        "DATABASE_SECURITY_ALERT",
        {
          violationType: type,
          identifier,
          violationCount: count,
          threshold: this?.config?.monitoring.alertThreshold,
          context,
          timestamp: new Date().toISOString(),
        },
      );
    });

    // Here you could add additional alerting mechanisms:
    // - Send email alerts
    // - Trigger monitoring system alerts
    // - Block the user temporarily
    // - Notify security team
  }

  /**
   * Get object nesting depth
   */
  private getObjectDepth(obj: any): number {
    if (obj === null || typeof obj !== "object") {
      return 0;
    }

    if (Array.isArray(obj)) {
      return 1 + Math.max(0, ...obj?.map((item: any) => this.getObjectDepth(item)));
    }

    return (
      1 +
      Math.max(
        0,
        ...Object.values(obj).map((value: any) => this.getObjectDepth(value)),
      )
    );
  }

  /**
   * Validate input recursively for SQL injection
   */
  private validateInputRecursively(input: any): void {
    if (typeof input === "string") {
      this?.sqlSecurity?.validateQueryParameters([input]);
    } else if (Array.isArray(input)) {
      input.forEach((item: any) => this.validateInputRecursively(item));
    } else if (input && typeof input === "object") {
      Object.entries(input).forEach(([key, value]) => {
        this?.sqlSecurity?.validateQueryParameters([key]);
        this.validateInputRecursively(value);
      });
    }
  }
}

/**
 * Create singleton security manager instance
 */
let securityManager: DatabaseSecurityManager | null = null;

export function getDatabaseSecurityManager(
  config?: Partial<DatabaseSecurityConfig>,
): DatabaseSecurityManager {
  if (!securityManager) {
    securityManager = new DatabaseSecurityManager(config);
  }
  return securityManager;
}

/**
 * Initialize database security with configuration
 */
export function initializeDatabaseSecurity(
  config: Partial<DatabaseSecurityConfig> = {},
): DatabaseSecurityManager {
  securityManager = new DatabaseSecurityManager(config);
  return securityManager;
}

// Export commonly used instances
export const databaseSecurity = getDatabaseSecurityManager();
