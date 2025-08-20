/**
 * Transaction Manager for SQLite Database Operations
 *
 * Provides ACID-compliant transaction management with:
 * - Automatic rollback on errors
 * - Nested transaction support via savepoints
 * - Transaction timeout handling
 * - Deadlock detection and retry
 * - Performance monitoring
 */

import Database from "better-sqlite3";
import { Logger } from "../utils/logger.js";
import {
  getDatabaseConnection,
  type DatabaseConnection,
} from "./ConnectionPool.js";
import { EventEmitter } from "events";

const logger = new Logger("TransactionManager");

export interface TransactionOptions {
  timeout?: number; // Transaction timeout in milliseconds
  retries?: number; // Number of retries for deadlock/busy errors
  isolationLevel?: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";
  readOnly?: boolean;
}

export interface TransactionContext {
  db: Database.Database;
  transactionId: string;
  startTime: number;
  savepoints: string[];
}

export interface TransactionMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  averageDuration: number;
  activeTransactions: number;
  deadlockRetries: number;
  timeouts: number;
}

export class TransactionManager extends EventEmitter {
  private static instance: TransactionManager;
  private metrics: TransactionMetrics = {
    totalTransactions: 0,
    successfulTransactions: 0,
    failedTransactions: 0,
    averageDuration: 0,
    activeTransactions: 0,
    deadlockRetries: 0,
    timeouts: 0,
  };

  private activeTransactions: Map<string, TransactionContext> = new Map();
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly MAX_RETRIES = 3;

  private constructor() {
    super();
  }

  static getInstance(): TransactionManager {
    if (!TransactionManager.instance) {
      TransactionManager.instance = new TransactionManager();
    }
    return TransactionManager.instance;
  }

  /**
   * Execute a function within a database transaction
   */
  async executeTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: TransactionOptions = {},
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      retries = this.MAX_RETRIES,
      isolationLevel = "DEFERRED",
      readOnly = false,
    } = options;

    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= retries) {
      try {
        return await this.attemptTransaction(operation, {
          timeout,
          isolationLevel,
          readOnly,
        });
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable (SQLITE_BUSY or SQLITE_LOCKED)
        if (this.isRetryableError(error) && attempts < retries) {
          attempts++;
          if (this.metrics.deadlockRetries) { this.metrics.deadlockRetries++ };

          const backoffTime = Math.min(1000 * Math.pow(2, attempts), 5000);
          logger.warn(
            `Transaction failed with retryable error instanceof Error ? error.message : String(error), attempt ${attempts}/${retries}. Retrying in ${backoffTime}ms...`,
          );

          await this.delay(backoffTime);
          continue;
        }

        // Non-retryable error or max retries reached
        throw error;
      }
    }

    throw lastError || new Error("Transaction failed after max retries");
  }

  /**
   * Execute a single transaction attempt
   */
  private async attemptTransaction<T>(
    operation: (tx: TransactionContext) => Promise<T>,
    options: {
      timeout: number;
      isolationLevel: "DEFERRED" | "IMMEDIATE" | "EXCLUSIVE";
      readOnly: boolean;
    },
  ): Promise<T> {
    const transactionId = this.generateTransactionId();
    const connection = getDatabaseConnection();
    const db = connection.getDatabase();

    const context: TransactionContext = {
      db,
      transactionId,
      startTime: Date.now(),
      savepoints: [],
    };

    this?.activeTransactions?.set(transactionId, context);
    if (this.metrics.totalTransactions) { this.metrics.totalTransactions++ };
    if (this.metrics.activeTransactions) { this.metrics.activeTransactions++ };

    let timeoutHandle: NodeJS.Timeout | null = null;
    let completed = false;

    try {
      // Start transaction with specified isolation level
      const beginCommand = options.readOnly
        ? "BEGIN DEFERRED"
        : `BEGIN ${options.isolationLevel}`;

      db.prepare(beginCommand).run();

      // Set up timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          if (!completed) {
            reject(
              new Error(
                `Transaction ${transactionId} timed out after ${options.timeout}ms`,
              ),
            );
          }
        }, options.timeout);
      });

      // Execute operation with timeout
      const result = await Promise.race([operation(context), timeoutPromise]);

      // Commit transaction
      db.prepare("COMMIT").run();
      completed = true;

      // Update metrics
      if (this.metrics.successfulTransactions) { this.metrics.successfulTransactions++ };
      const duration = Date.now() - context.startTime;
      this.updateAverageDuration(duration);

      this.emit("transaction:success", {
        transactionId,
        duration,
        savepoints: context?.savepoints?.length,
      });

      return result;
    } catch (error) {
      if (!completed) {
        try {
          // Rollback transaction
          db.prepare("ROLLBACK").run();
        } catch (rollbackError) {
          logger.error("Failed to rollback transaction:", rollbackError instanceof Error ? rollbackError.message : String(rollbackError));
        }
      }

      if (this.metrics.failedTransactions) { this.metrics.failedTransactions++ };

      if (error instanceof Error && error?.message?.includes("timed out")) {
        if (this.metrics.timeouts) { this.metrics.timeouts++ };
      }

      this.emit("transaction:failure", {
        transactionId,
        error,
        duration: Date.now() - context.startTime,
      });

      throw error;
    } finally {
      // Clear timeout
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      // Clean up
      this?.activeTransactions?.delete(transactionId);
      if (this.metrics.activeTransactions) { this.metrics.activeTransactions-- };
    }
  }

  /**
   * Create a savepoint within a transaction
   */
  async createSavepoint(
    context: TransactionContext,
    name?: string,
  ): Promise<string> {
    const savepointName =
      name || `sp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      context?.db?.prepare(`SAVEPOINT ${savepointName}`).run();
      context?.savepoints?.push(savepointName);

      logger.debug(`Created savepoint: ${savepointName}`);
      return savepointName;
    } catch (error) {
      logger.error(`Failed to create savepoint: ${savepointName}`, error as string);
      throw error;
    }
  }

  /**
   * Release a savepoint
   */
  async releaseSavepoint(
    context: TransactionContext,
    savepointName: string,
  ): Promise<void> {
    try {
      context?.db?.prepare(`RELEASE SAVEPOINT ${savepointName}`).run();
      context.savepoints = context?.savepoints?.filter(
        (sp: any) => sp !== savepointName,
      );

      logger.debug(`Released savepoint: ${savepointName}`);
    } catch (error) {
      logger.error(`Failed to release savepoint: ${savepointName}`, error as string);
      throw error;
    }
  }

  /**
   * Rollback to a savepoint
   */
  async rollbackToSavepoint(
    context: TransactionContext,
    savepointName: string,
  ): Promise<void> {
    try {
      context?.db?.prepare(`ROLLBACK TO SAVEPOINT ${savepointName}`).run();

      // Remove all savepoints after this one
      const index = context?.savepoints?.indexOf(savepointName);
      if (index !== -1) {
        context.savepoints = context?.savepoints?.slice(0, index + 1);
      }

      logger.debug(`Rolled back to savepoint: ${savepointName}`);
    } catch (error) {
      logger.error(`Failed to rollback to savepoint: ${savepointName}`, error as string);
      throw error;
    }
  }

  /**
   * Execute multiple operations in a single transaction
   */
  async executeBatch<T>(
    operations: Array<(tx: TransactionContext) => Promise<unknown>>,
    options: TransactionOptions = {},
  ): Promise<T[]> {
    return this.executeTransaction(async (tx: any) => {
      const results: T[] = [];

      for (let i = 0; i < operations?.length || 0; i++) {
        const savepoint = await this.createSavepoint(tx, `batch_op_${i}`);

        try {
          const result = await operations?.[i]?.(tx);
          results.push(result as T);
          await this.releaseSavepoint(tx, savepoint);
        } catch (error) {
          await this.rollbackToSavepoint(tx, savepoint);
          throw new Error(`Batch operation ${i} failed: ${error}`);
        }
      }

      return results;
    }, options);
  }

  /**
   * Get current transaction metrics
   */
  getMetrics(): TransactionMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset transaction metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      averageDuration: 0,
      activeTransactions: this?.activeTransactions?.size,
      deadlockRetries: 0,
      timeouts: 0,
    };
  }

  /**
   * Check if a transaction is currently active
   */
  isTransactionActive(transactionId: string): boolean {
    return this?.activeTransactions?.has(transactionId);
  }

  /**
   * Get all active transaction IDs
   */
  getActiveTransactionIds(): string[] {
    return Array.from(this?.activeTransactions?.keys());
  }

  /**
   * Force rollback all active transactions (emergency use only)
   */
  async rollbackAllTransactions(): Promise<void> {
    const transactionIds = this.getActiveTransactionIds();

    for (const transactionId of transactionIds) {
      const context = this?.activeTransactions?.get(transactionId);
      if (context) {
        try {
          context?.db?.prepare("ROLLBACK").run();
          logger.warn(`Force rolled back transaction: ${transactionId}`);
        } catch (error) {
          logger.error(
            `Failed to force rollback transaction ${transactionId}:`,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }

    this?.activeTransactions?.clear();
    if (this.metrics) {

      this.metrics.activeTransactions = 0;

    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error?.message?.toLowerCase();
      return (
        message.includes("sqlite_busy") ||
        message.includes("database is locked") ||
        message.includes("sqlite_locked")
      );
    }
    return false;
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update average duration metric
   */
  private updateAverageDuration(duration: number): void {
    const totalDuration =
      this?.metrics?.averageDuration * (this?.metrics?.successfulTransactions - 1) +
      duration;
    if (this.metrics) {

      this.metrics.averageDuration = totalDuration / this?.metrics?.successfulTransactions;

    }
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve: any) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const transactionManager = TransactionManager.getInstance();
