import Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import {
  AppError,
  DatabaseError,
  ErrorCode,
  withAsyncErrorHandler,
  CircuitBreaker,
} from "../utils/error-handling/index.js";

/**
 * Database-specific error codes
 */
export enum DatabaseErrorCode {
  CONNECTION_FAILED = "DB_CONNECTION_FAILED",
  QUERY_FAILED = "DB_QUERY_FAILED",
  TRANSACTION_FAILED = "DB_TRANSACTION_FAILED",
  CONSTRAINT_VIOLATION = "DB_CONSTRAINT_VIOLATION",
  DEADLOCK = "DB_DEADLOCK",
  TIMEOUT = "DB_TIMEOUT",
  DISK_FULL = "DB_DISK_FULL",
  CORRUPTED = "DB_CORRUPTED",
}

/**
 * Type guard for Error objects
 */
function isError(value: unknown): value is Error {
  return (
    value instanceof Error ||
    (typeof value === "object" &&
      value !== null &&
      "message" in value &&
      typeof (value as Record<string, unknown>).message === "string")
  );
}

/**
 * Safe error message extraction
 */
function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (isError(error)) return error.message;
  return String(error);
}

/**
 * Safe error details extraction
 */
function getErrorDetails(error: unknown): Record<string, unknown> {
  if (isError(error)) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { rawError: String(error) };
}

/**
 * Maps SQLite error codes to our error types
 */
function mapDatabaseError(error: unknown): AppError {
  if (!(error instanceof Error)) {
    return DatabaseError("Unknown database error", {
      originalError: getErrorDetails(error),
    });
  }

  const message = error?.message?.toLowerCase();

  // Connection errors
  if (message.includes("enoent") || message.includes("no such file")) {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      "Database file not found",
      500,
      {
        code: DatabaseErrorCode.CONNECTION_FAILED,
        originalError: error.message,
      },
    );
  }

  // Permission errors
  if (message.includes("eacces") || message.includes("permission denied")) {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      "Database access denied",
      500,
      {
        code: DatabaseErrorCode.CONNECTION_FAILED,
        originalError: error.message,
      },
    );
  }

  // Constraint violations
  if (message.includes("constraint") || message.includes("unique")) {
    return new AppError(
      ErrorCode.CONFLICT,
      "Database constraint violation",
      409,
      {
        code: DatabaseErrorCode.CONSTRAINT_VIOLATION,
        originalError: error.message,
      },
    );
  }

  // Disk space
  if (message.includes("disk") || message.includes("space")) {
    return new AppError(ErrorCode.DISK_FULL, "Insufficient disk space", 507, {
      code: DatabaseErrorCode.DISK_FULL,
      originalError: error.message,
    });
  }

  // Database locked/busy
  if (message.includes("locked") || message.includes("busy")) {
    return new AppError(
      ErrorCode.SERVICE_UNAVAILABLE,
      "Database is busy",
      503,
      { code: DatabaseErrorCode.DEADLOCK, originalError: error.message },
    );
  }

  // Corruption
  if (message.includes("corrupt") || message.includes("malformed")) {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      "Database corruption detected",
      500,
      { code: DatabaseErrorCode.CORRUPTED, originalError: error.message },
      false, // Not operational - requires manual intervention
    );
  }

  // Default database error
  return DatabaseError(error.message, { originalError: error.message });
}

/**
 * Wraps a database operation with error handling and retry logic
 */
export function withDatabaseErrorHandling<
  T extends (...args: unknown[]) => unknown,
>(
  operation: T,
  options: {
    retries?: number;
    retryDelay?: number;
    context?: string;
  } = {},
): T {
  return withAsyncErrorHandler(operation, {
    retries: options.retries ?? 3,
    retryDelay: options.retryDelay ?? 500,
    context: options.context ?? operation.name,
    onError: (error: any) => {
      // Convert to database-specific error
      throw mapDatabaseError(error);
    },
  });
}

/**
 * Transaction wrapper with automatic rollback on error
 */
export function withTransaction<T>(
  db: Database.Database,
  operation: (trx: Database.Transaction) => T,
  options: {
    immediate?: boolean;
    exclusive?: boolean;
  } = {},
): T {
  const { immediate, exclusive } = options;

  try {
    if (exclusive) {
      const transaction = db.transaction(operation).exclusive();
      return transaction();
    } else if (immediate) {
      const transaction = db.transaction(operation).immediate();
      return transaction();
    } else {
      const transaction = db.transaction(operation).deferred();
      return transaction();
    }
  } catch (error) {
    logger.error("Transaction failed", "DB_TRANSACTION", {
      error: getErrorMessage(error),
    });
    throw mapDatabaseError(error);
  }
}

/**
 * Safe query execution with timeout and error handling
 */
export function safeQuery<T = unknown>(
  db: Database.Database,
  query: string,
  params: unknown[] = [],
  options: {
    timeout?: number;
    single?: boolean;
  } = {},
): T {
  const { timeout = 5000, single = false } = options;

  try {
    // Set timeout for this query
    db.pragma(`busy_timeout = ${timeout}`);

    const stmt = db.prepare(query);
    const result = single ? stmt.get(...params) : stmt.all(...params);

    return result as T;
  } catch (error) {
    logger.error("Query execution failed", "DB_QUERY", {
      query,
      params,
      error: getErrorMessage(error),
    });

    throw mapDatabaseError(error);
  }
}

/**
 * Database health check with circuit breaker
 */
export class DatabaseHealthChecker {
  private circuitBreaker: CircuitBreaker;

  constructor(
    private db: Database.Database,
    circuitBreakerOptions?: {
      threshold?: number;
      timeout?: number;
    },
  ) {
    this.circuitBreaker = new CircuitBreaker(
      circuitBreakerOptions?.threshold ?? 5,
      circuitBreakerOptions?.timeout ?? 60000,
    );
  }

  async check(): Promise<boolean> {
    return this?.circuitBreaker?.execute(
      async () => {
        try {
          // Simple health check query
          const result = this?.db?.prepare("SELECT 1 as health").get() as Record<string, unknown>;
          return result?.health === 1;
        } catch (error) {
          throw mapDatabaseError(error);
        }
      },
      // Fallback returns false (unhealthy)
      async () => false,
    );
  }

  getCircuitState(): string {
    return this?.circuitBreaker?.getState();
  }

  reset(): void {
    this?.circuitBreaker?.reset();
  }
}

/**
 * Database connection manager with automatic reconnection
 */
export class DatabaseConnectionManager {
  private db: Database.Database | null = null;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private databasePath: string,
    private options?: Database.Options,
  ) {}

  async connect(): Promise<Database.Database> {
    try {
      if (this.db) {
        // Check if connection is still valid
        try {
          this?.db?.prepare("SELECT 1").get();
          return this.db;
        } catch {
          // Connection is dead, close it
          this.close();
        }
      }

      // Create new connection
      this.db = new Database(this.databasePath, this.options);

      // Configure for better concurrency
      this?.db?.pragma("journal_mode = WAL");
      this?.db?.pragma("synchronous = NORMAL");
      this?.db?.pragma("foreign_keys = ON");
      this?.db?.pragma("busy_timeout = 5000");

      this.connectionAttempts = 0;
      logger.info("Database connected successfully", "DB_CONNECTION");

      return this.db;
    } catch (error) {
      this.connectionAttempts++;

      if (this.connectionAttempts >= this.maxConnectionAttempts) {
        logger.error("Max connection attempts reached", "DB_CONNECTION", {
          attempts: this.connectionAttempts,
          error: getErrorMessage(error),
        });
        throw mapDatabaseError(error);
      }

      logger.warn(
        `Database connection failed, retrying in ${this.reconnectDelay}ms...`,
        "DB_CONNECTION",
        {
          attempt: this.connectionAttempts,
          error: getErrorMessage(error),
        },
      );

      // Wait before retrying
      await new Promise((resolve: any) => setTimeout(resolve, this.reconnectDelay));
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Cap at 30 seconds

      return this.connect();
    }
  }

  getConnection(): Database.Database {
    if (!this.db) {
      throw new AppError(
        ErrorCode.DATABASE_ERROR,
        "Database not connected",
        500,
        { code: DatabaseErrorCode.CONNECTION_FAILED },
      );
    }

    return this.db;
  }

  close(): void {
    if (this.db) {
      try {
        this?.db?.close();
        logger.info("Database connection closed", "DB_CONNECTION");
      } catch (error) {
        logger.error("Error closing database connection", "DB_CONNECTION", {
          error: getErrorMessage(error),
        });
      } finally {
        this.db = null;
      }
    }
  }

  isConnected(): boolean {
    if (!this.db) return false;

    try {
      this?.db?.prepare("SELECT 1").get();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Prepared statement cache with error handling
 */
export class PreparedStatementCache {
  private cache = new Map<string, Database.Statement>();

  constructor(private db: Database.Database) {}

  get<T extends Record<string, unknown> | unknown[] = Record<string, unknown>>(query: string): Database.Statement<T> {
    try {
      let stmt = this?.cache?.get(query);

      if (!stmt) {
        stmt = this?.db?.prepare(query);
        this?.cache?.set(query, stmt);
      }

      return stmt as Database.Statement<T>;
    } catch (error) {
      logger.error("Failed to prepare statement", "DB_STATEMENT", {
        query,
        error: getErrorMessage(error),
      });
      throw mapDatabaseError(error);
    }
  }

  clear(): void {
    this?.cache?.clear();
  }

  remove(query: string): void {
    this?.cache?.delete(query);
  }
}
