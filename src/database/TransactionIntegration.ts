/**
 * Transaction Integration for Existing Services
 * 
 * Provides transaction-aware wrappers for database operations
 * in existing services without requiring major refactoring
 */

import { transactionManager } from "./TransactionManager.js";
import { retryManager } from "../core/retry/RetryManager.js";
import { checkpointManager } from "../core/recovery/CheckpointManager.js";
import { Logger } from "../utils/logger.js";
import type { TransactionContext } from "./TransactionManager.js";

const logger = new Logger("TransactionIntegration");

/**
 * Transaction-aware email analysis save
 */
export async function saveEmailAnalysisWithTransaction(
  emailId: string,
  analysisData: Record<string, unknown>,
  relatedOperations?: Array<(tx: TransactionContext) => Promise<void>>
): Promise<void> {
  return retryManager.retry(
    async () => {
      await transactionManager.executeTransaction(async (tx) => {
        // Save email analysis
        const stmt = tx.db.prepare(`
          INSERT OR REPLACE INTO email_analysis (
            email_id, analysis_data, created_at, updated_at
          ) VALUES (?, ?, datetime('now'), datetime('now'))
        `);
        
        stmt.run(emailId, JSON.stringify(analysisData));
        
        // Execute any related operations in the same transaction
        if (relatedOperations) {
          for (const operation of relatedOperations) {
            await operation(tx);
          }
        }
      });
    },
    'database'
  );
}

/**
 * Transaction-aware batch email import
 */
export async function importEmailBatchWithTransaction(
  emails: Array<{
    id: string;
    message_id: string;
    subject: string;
    body_text: string;
    [key: string]: unknown;
  }>,
  batchSize: number = 100
): Promise<void> {
  const operation = checkpointManager.createCheckpointedOperation(
    `email-import-${Date.now()}`,
    'email-batch-import',
    { interval: batchSize }
  );

  await operation.process(
    emails,
    async (email, index) => {
      await transactionManager.executeTransaction(async (tx) => {
        const emailStmt = tx.db.prepare(`
          INSERT OR IGNORE INTO emails (
            id, message_id, subject, body_text, 
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
        `);
        
        emailStmt.run(
          email.id,
          email.message_id,
          email.subject,
          email.body_text
        );
        
        // Log import for audit
        const auditStmt = tx.db.prepare(`
          INSERT INTO email_import_log (
            email_id, imported_at, batch_index
          ) VALUES (?, datetime('now'), ?)
        `);
        
        auditStmt.run(email.id, index);
      });
    }
  );
}

/**
 * Transaction-aware chain completeness update
 */
export async function updateChainCompletenessWithTransaction(
  chainId: string,
  completenessData: {
    completeness_score: number;
    is_complete: boolean;
    missing_stages?: string[];
  }
): Promise<void> {
  return transactionManager.executeTransaction(async (tx) => {
    // Update chain completeness
    const updateStmt = tx.db.prepare(`
      UPDATE email_chains 
      SET completeness_score = ?, 
          is_complete = ?,
          missing_stages = ?,
          updated_at = datetime('now')
      WHERE chain_id = ?
    `);
    
    updateStmt.run(
      completenessData.completeness_score,
      completenessData.is_complete ? 1 : 0,
      JSON.stringify(completenessData.missing_stages || []),
      chainId
    );
    
    // Update all emails in chain
    const emailUpdateStmt = tx.db.prepare(`
      UPDATE emails 
      SET chain_completeness_score = ?,
          updated_at = datetime('now')
      WHERE chain_id = ?
    `);
    
    emailUpdateStmt.run(
      completenessData.completeness_score,
      chainId
    );
  });
}

/**
 * Transaction-aware workflow state update
 */
export async function updateWorkflowStateWithTransaction(
  emailId: string,
  workflowState: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  return transactionManager.executeTransaction(async (tx) => {
    // Create savepoint for partial rollback
    const savepoint = await transactionManager.createSavepoint(tx, 'workflow_update');
    
    try {
      // Update email workflow state
      const updateStmt = tx.db.prepare(`
        UPDATE emails 
        SET workflow_state = ?,
            workflow_metadata = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `);
      
      updateStmt.run(
        workflowState,
        JSON.stringify(metadata || {}),
        emailId
      );
      
      // Log state transition
      const logStmt = tx.db.prepare(`
        INSERT INTO workflow_transitions (
          email_id, from_state, to_state, transition_at, metadata
        ) VALUES (
          ?, 
          (SELECT workflow_state FROM emails WHERE id = ?),
          ?, 
          datetime('now'),
          ?
        )
      `);
      
      logStmt.run(
        emailId,
        emailId,
        workflowState,
        JSON.stringify(metadata || {})
      );
      
      // Release savepoint on success
      await transactionManager.releaseSavepoint(tx, savepoint);
      
    } catch (error) {
      // Rollback to savepoint on error
      await transactionManager.rollbackToSavepoint(tx, savepoint);
      throw error;
    }
  });
}

/**
 * Transaction-aware bulk operations
 */
export class BulkOperationManager {
  /**
   * Execute bulk updates with transaction batching
   */
  static async bulkUpdate<T extends { id: string }>(
    items: T[],
    updateFn: (item: T, tx: TransactionContext) => Promise<void>,
    options: {
      batchSize?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<{ succeeded: number; failed: number; errors: Error[] }> {
    const { batchSize = 100, continueOnError = false } = options;
    const results = { succeeded: 0, failed: 0, errors: [] as Error[] };
    
    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        await transactionManager.executeTransaction(async (tx) => {
          for (const item of batch) {
            if (continueOnError) {
              // Create savepoint for each item
              const savepoint = await transactionManager.createSavepoint(tx);
              
              try {
                await updateFn(item, tx);
                results.succeeded++;
              } catch (error) {
                await transactionManager.rollbackToSavepoint(tx, savepoint);
                results.failed++;
                results.errors.push(error as Error);
              }
            } else {
              await updateFn(item, tx);
              results.succeeded++;
            }
          }
        });
      } catch (error) {
        if (!continueOnError) {
          throw error;
        }
        // Entire batch failed
        results.failed += batch.length;
        results.errors.push(error as Error);
      }
    }
    
    return results;
  }

  /**
   * Execute bulk deletes with cascading support
   */
  static async bulkDelete(
    tableName: string,
    ids: string[],
    options: {
      cascade?: boolean;
      batchSize?: number;
    } = {}
  ): Promise<number> {
    const { cascade = false, batchSize = 100 } = options;
    let totalDeleted = 0;
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      
      const deleted = await transactionManager.executeTransaction(async (tx) => {
        if (cascade) {
          // Handle cascading deletes based on table
          await this.handleCascadingDeletes(tx, tableName, batch);
        }
        
        const placeholders = batch.map(() => '?').join(',');
        const stmt = tx.db.prepare(
          `DELETE FROM ${tableName} WHERE id IN (${placeholders})`
        );
        
        const result = stmt.run(...batch);
        return result.changes;
      });
      
      totalDeleted += deleted;
    }
    
    return totalDeleted;
  }

  /**
   * Handle cascading deletes
   */
  private static async handleCascadingDeletes(
    tx: TransactionContext,
    tableName: string,
    ids: string[]
  ): Promise<void> {
    const placeholders = ids.map(() => '?').join(',');
    
    switch (tableName) {
      case 'emails':
        // Delete related email_analysis records
        tx.db.prepare(
          `DELETE FROM email_analysis WHERE email_id IN (${placeholders})`
        ).run(...ids);
        
        // Delete related workflow_transitions
        tx.db.prepare(
          `DELETE FROM workflow_transitions WHERE email_id IN (${placeholders})`
        ).run(...ids);
        break;
        
      case 'email_chains':
        // Update emails to remove chain reference
        tx.db.prepare(
          `UPDATE emails SET chain_id = NULL WHERE chain_id IN (${placeholders})`
        ).run(...ids);
        break;
        
      // Add more cascade rules as needed
    }
  }
}

/**
 * Create a transaction-aware repository wrapper
 */
export function createTransactionalRepository<T>(
  baseRepository: T
): T & { inTransaction: (tx: TransactionContext) => T } {
  return new Proxy(baseRepository as any, {
    get(target, prop) {
      if (prop === 'inTransaction') {
        return (tx: TransactionContext) => {
          // Return a version of the repository that uses the transaction's db
          return new Proxy(target, {
            get(innerTarget, innerProp) {
              const original = innerTarget[innerProp];
              if (typeof original === 'function') {
                return (...args: unknown[]) => {
                  // Replace db with transaction db
                  const originalDb = innerTarget.db;
                  innerTarget.db = tx.db;
                  try {
                    return original.apply(innerTarget, args);
                  } finally {
                    innerTarget.db = originalDb;
                  }
                };
              }
              return original;
            }
          });
        };
      }
      
      return target[prop];
    }
  }) as T & { inTransaction: (tx: TransactionContext) => T };
}

/**
 * Monitoring and metrics for transactions
 */
export class TransactionMonitor {
  private static readonly SLOW_TRANSACTION_THRESHOLD = 1000; // 1 second
  
  static startMonitoring(): void {
    transactionManager.on('transaction:success', (data) => {
      if (data.duration > this.SLOW_TRANSACTION_THRESHOLD) {
        logger.warn(`Slow transaction detected: ${data.transactionId} took ${data.duration}ms`);
      }
    });
    
    transactionManager.on('transaction:failure', (data) => {
      logger.error(`Transaction failed: ${data.transactionId}`, data.error);
    });
    
    // Log metrics periodically
    setInterval(() => {
      const metrics = transactionManager.getMetrics();
      logger.info('Transaction metrics:', metrics);
    }, 60000); // Every minute
  }
}

// Start monitoring on import
TransactionMonitor.startMonitoring();