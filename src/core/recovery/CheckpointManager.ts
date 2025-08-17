/**
 * Checkpoint Manager for Recovery
 *
 * Provides checkpoint-based recovery for long-running operations:
 * - Periodic checkpoint creation
 * - State persistence and restoration
 * - Progress tracking
 * - Automatic recovery on failure
 */

import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "fs";
import { join, dirname } from "path";
import { Logger } from "../../utils/logger.js";
import { EventEmitter } from "events";
import Database from "better-sqlite3";
import {
  getDatabaseConnection,
  executeTransaction,
} from "../../database/ConnectionPool.js";

const logger = new Logger("CheckpointManager");

export interface CheckpointData {
  id: string;
  operationId: string;
  operationType: string;
  state: Record<string, unknown>;
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    version: string;
    resumable: boolean;
  };
}

export interface CheckpointOptions {
  interval?: number; // Checkpoint interval in items processed
  directory?: string; // Directory to store checkpoints
  maxCheckpoints?: number; // Maximum checkpoints to keep
  compress?: boolean; // Compress checkpoint data
  useDatabase?: boolean; // Store in database instead of files
}

export interface RecoveryOptions {
  validateState?: (state: CheckpointData) => boolean;
  onProgress?: (progress: CheckpointData["progress"]) => void;
  maxAge?: number; // Maximum age of checkpoint in milliseconds
}

export class CheckpointManager extends EventEmitter {
  private static instance: CheckpointManager;
  private checkpoints: Map<string, CheckpointData> = new Map();

  private readonly DEFAULT_OPTIONS: Required<CheckpointOptions> = {
    interval: 100,
    directory: "./checkpoints",
    maxCheckpoints: 10,
    compress: true,
    useDatabase: true,
  };

  private readonly CHECKPOINT_VERSION = "1.0.0";

  private constructor() {
    super();
    this.initializeCheckpointStorage();
  }

  static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  /**
   * Initialize checkpoint storage
   */
  private initializeCheckpointStorage(): void {
    // Create checkpoints directory if using file storage
    if (!this.DEFAULT_OPTIONS.useDatabase) {
      if (!existsSync(this.DEFAULT_OPTIONS.directory)) {
        mkdirSync(this.DEFAULT_OPTIONS.directory, { recursive: true });
      }
    } else {
      // Create checkpoints table if using database
      this.createCheckpointTable();
    }
  }

  /**
   * Create checkpoint table in database
   */
  private createCheckpointTable(): void {
    executeTransaction((db: any) => {
      db.prepare(
        `
        CREATE TABLE IF NOT EXISTS checkpoints (
          id TEXT PRIMARY KEY,
          operation_id TEXT NOT NULL,
          operation_type TEXT NOT NULL,
          state TEXT NOT NULL,
          progress_total INTEGER NOT NULL,
          progress_completed INTEGER NOT NULL,
          progress_failed INTEGER NOT NULL,
          progress_percentage REAL NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          version TEXT NOT NULL,
          resumable INTEGER NOT NULL,
          UNIQUE(operation_id, operation_type)
        )
      `,
      ).run();

      // Create index for faster lookups
      db.prepare(
        `
        CREATE INDEX IF NOT EXISTS idx_checkpoints_operation 
        ON checkpoints(operation_id, operation_type)
      `,
      ).run();

      return true;
    });
  }

  /**
   * Create a new checkpoint
   */
  async createCheckpoint(
    operationId: string,
    operationType: string,
    state: Record<string, unknown>,
    progress: Omit<CheckpointData["progress"], "percentage">,
    options: CheckpointOptions = {},
  ): Promise<string> {
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    const checkpointId = this.generateCheckpointId();

    const checkpoint: CheckpointData = {
      id: checkpointId,
      operationId,
      operationType,
      state,
      progress: {
        ...progress,
        percentage:
          progress.total > 0
            ? Math.round((progress.completed / progress.total) * 100 * 100) /
              100
            : 0,
      },
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: this.CHECKPOINT_VERSION,
        resumable: true,
      },
    };

    // Store checkpoint
    if (mergedOptions.useDatabase) {
      await this.saveCheckpointToDatabase(checkpoint);
    } else {
      await this.saveCheckpointToFile(checkpoint, mergedOptions);
    }

    // Keep in memory
    this.checkpoints.set(checkpointId, checkpoint);

    // Clean up old checkpoints
    await this.cleanupOldCheckpoints(operationId, operationType, mergedOptions);

    logger.info(
      `Created checkpoint ${checkpointId} for ${operationType}:${operationId}`,
      {
        progress: checkpoint.progress,
      },
    );

    this.emit("checkpoint:created", checkpoint);

    return checkpointId;
  }

  /**
   * Update an existing checkpoint
   */
  async updateCheckpoint(
    checkpointId: string,
    updates: {
      state?: Record<string, unknown>;
      progress?: Partial<CheckpointData["progress"]>;
    },
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    // Update checkpoint data
    if (updates.state) {
      checkpoint.state = { ...checkpoint.state, ...updates.state };
    }

    if (updates.progress) {
      checkpoint.progress = { ...checkpoint.progress, ...updates.progress };
      if (checkpoint?.progress?.total > 0) {
        checkpoint?.progress?.percentage =
          Math.round(
            (checkpoint?.progress?.completed / checkpoint?.progress?.total) *
              100 *
              100,
          ) / 100;
      }
    }

    checkpoint?.metadata?.updatedAt = new Date();

    // Persist updates
    if (this.DEFAULT_OPTIONS.useDatabase) {
      await this.saveCheckpointToDatabase(checkpoint);
    } else {
      await this.saveCheckpointToFile(checkpoint, this.DEFAULT_OPTIONS);
    }

    this.emit("checkpoint:updated", checkpoint);
  }

  /**
   * Recover from the latest checkpoint
   */
  async recover(
    operationId: string,
    operationType: string,
    options: RecoveryOptions = {},
  ): Promise<CheckpointData | null> {
    logger.info(`Attempting recovery for ${operationType}:${operationId}`);

    // Load checkpoint
    const checkpoint = this.DEFAULT_OPTIONS.useDatabase
      ? await this.loadCheckpointFromDatabase(operationId, operationType)
      : await this.loadCheckpointFromFile(operationId, operationType);

    if (!checkpoint) {
      logger.info("No checkpoint found for recovery");
      return null;
    }

    // Check checkpoint age
    if (options.maxAge) {
      const age = Date.now() - checkpoint?.metadata?.updatedAt.getTime();
      if (age > options.maxAge) {
        logger.warn(`Checkpoint is too old (${age}ms > ${options.maxAge}ms)`);
        return null;
      }
    }

    // Validate state
    if (options.validateState && !options.validateState(checkpoint)) {
      logger.warn("Checkpoint state validation failed");
      return null;
    }

    // Check if resumable
    if (!checkpoint?.metadata?.resumable) {
      logger.warn("Checkpoint is marked as non-resumable");
      return null;
    }

    logger.info(`Successfully recovered checkpoint ${checkpoint.id}`, {
      progress: checkpoint.progress,
    });

    this.emit("checkpoint:recovered", checkpoint);

    // Report progress
    if (options.onProgress) {
      options.onProgress(checkpoint.progress);
    }

    return checkpoint;
  }

  /**
   * Mark a checkpoint as complete
   */
  async completeCheckpoint(checkpointId: string): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    checkpoint?.metadata?.resumable = false;
    checkpoint?.progress?.percentage = 100;
    checkpoint?.metadata?.updatedAt = new Date();

    // Remove from active checkpoints
    this.checkpoints.delete(checkpointId);

    // Delete from storage
    if (this.DEFAULT_OPTIONS.useDatabase) {
      await this.deleteCheckpointFromDatabase(checkpointId);
    } else {
      await this.deleteCheckpointFile(checkpointId);
    }

    logger.info(`Completed and removed checkpoint ${checkpointId}`);
    this.emit("checkpoint:completed", checkpoint);
  }

  /**
   * Get all checkpoints for an operation
   */
  async getCheckpoints(
    operationId?: string,
    operationType?: string,
  ): Promise<CheckpointData[]> {
    if (this.DEFAULT_OPTIONS.useDatabase) {
      return this.getCheckpointsFromDatabase(operationId, operationType);
    } else {
      return this.getCheckpointsFromFiles(operationId, operationType);
    }
  }

  /**
   * Delete all checkpoints for an operation
   */
  async clearCheckpoints(
    operationId: string,
    operationType: string,
  ): Promise<void> {
    const checkpoints = await this.getCheckpoints(operationId, operationType);

    for (const checkpoint of checkpoints) {
      this.checkpoints.delete(checkpoint.id);

      if (this.DEFAULT_OPTIONS.useDatabase) {
        await this.deleteCheckpointFromDatabase(checkpoint.id);
      } else {
        await this.deleteCheckpointFile(checkpoint.id);
      }
    }

    logger.info(
      `Cleared ${checkpoints?.length || 0} checkpoints for ${operationType}:${operationId}`,
    );
  }

  /**
   * Create a checkpoint-aware operation wrapper
   */
  createCheckpointedOperation<T>(
    operationId: string,
    operationType: string,
    options: CheckpointOptions = {},
  ) {
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options };
    let itemsProcessed = 0;
    let lastCheckpointAt = 0;

    return {
      /**
       * Process items with automatic checkpointing
       */
      async process(
        items: T[],
        processor: (
          item: T,
          index: number,
          checkpoint?: CheckpointData,
        ) => Promise<void>,
        initialState: Record<string, unknown> = {},
      ): Promise<void> {
        // Try to recover from checkpoint
        const checkpoint = await checkpointManager.recover(
          operationId,
          operationType,
        );

        let startIndex = 0;
        let state = initialState;
        let completed = 0;
        let failed = 0;

        if (checkpoint) {
          startIndex = checkpoint?.progress?.completed;
          state = checkpoint.state;
          completed = checkpoint?.progress?.completed;
          failed = checkpoint?.progress?.failed;
          logger.info(`Resuming from checkpoint at index ${startIndex}`);
        }

        // Process items
        for (let i = startIndex; i < items?.length || 0; i++) {
          try {
            await processor(items[i], i, checkpoint || undefined);
            completed++;
            itemsProcessed++;

            // Create checkpoint if needed
            if (itemsProcessed - lastCheckpointAt >= mergedOptions.interval) {
              await checkpointManager.createCheckpoint(
                operationId,
                operationType,
                state,
                { total: items?.length || 0, completed, failed },
                mergedOptions,
              );
              lastCheckpointAt = itemsProcessed;
            }
          } catch (error) {
            failed++;
            logger.error(`Error processing item ${i}:`, error as string);

            // Update checkpoint with failure
            if (checkpoint) {
              await checkpointManager.updateCheckpoint(checkpoint.id, {
                progress: { failed },
              });
            }

            throw error;
          }
        }

        // Mark as complete
        if (checkpoint) {
          await this.completeCheckpoint(checkpoint.id);
        }
      },

      /**
       * Update checkpoint state
       */
      async updateState(updates: Record<string, unknown>): Promise<void> {
        const checkpoints = await this.getCheckpoints(
          operationId,
          operationType,
        );
        if (checkpoints?.length || 0 > 0) {
          const latest = checkpoints[0];
          await this.updateCheckpoint(latest.id, { state: updates });
        }
      },
    };
  }

  /**
   * Database operations
   */
  private async saveCheckpointToDatabase(
    checkpoint: CheckpointData,
  ): Promise<void> {
    await executeTransaction((db: any) => {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO checkpoints (
          id, operation_id, operation_type, state,
          progress_total, progress_completed, progress_failed, progress_percentage,
          created_at, updated_at, version, resumable
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        checkpoint.id,
        checkpoint.operationId,
        checkpoint.operationType,
        JSON.stringify(checkpoint.state),
        checkpoint?.progress?.total,
        checkpoint?.progress?.completed,
        checkpoint?.progress?.failed,
        checkpoint?.progress?.percentage,
        checkpoint?.metadata?.createdAt.toISOString(),
        checkpoint?.metadata?.updatedAt.toISOString(),
        checkpoint?.metadata?.version,
        checkpoint?.metadata?.resumable ? 1 : 0,
      );

      return true;
    });
  }

  private async loadCheckpointFromDatabase(
    operationId: string,
    operationType: string,
  ): Promise<CheckpointData | null> {
    const result = await executeTransaction((db: any) => {
      const stmt = db.prepare(`
        SELECT * FROM checkpoints 
        WHERE operation_id = ? AND operation_type = ? AND resumable = 1
        ORDER BY updated_at DESC
        LIMIT 1
      `);

      return stmt.get(operationId, operationType);
    });

    if (!result) return null;

    return this.parseCheckpointRow(result);
  }

  private async getCheckpointsFromDatabase(
    operationId?: string,
    operationType?: string,
  ): Promise<CheckpointData[]> {
    const results = await executeTransaction((db: any) => {
      let query = "SELECT * FROM checkpoints WHERE 1=1";
      const params: unknown[] = [];

      if (operationId) {
        query += " AND operation_id = ?";
        params.push(operationId);
      }

      if (operationType) {
        query += " AND operation_type = ?";
        params.push(operationType);
      }

      query += " ORDER BY updated_at DESC";

      const stmt = db.prepare(query);
      return stmt.all(...params);
    });

    return results?.map((row: any) => this.parseCheckpointRow(row));
  }

  private async deleteCheckpointFromDatabase(
    checkpointId: string,
  ): Promise<void> {
    await executeTransaction((db: any) => {
      const stmt = db.prepare("DELETE FROM checkpoints WHERE id = ?");
      stmt.run(checkpointId);
      return true;
    });
  }

  private parseCheckpointRow(row: any): CheckpointData {
    return {
      id: row.id,
      operationId: row.operation_id,
      operationType: row.operation_type,
      state: JSON.parse(row.state),
      progress: {
        total: row.progress_total,
        completed: row.progress_completed,
        failed: row.progress_failed,
        percentage: row.progress_percentage,
      },
      metadata: {
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        version: row.version,
        resumable: row.resumable === 1,
      },
    };
  }

  /**
   * File operations
   */
  private async saveCheckpointToFile(
    checkpoint: CheckpointData,
    options: Required<CheckpointOptions>,
  ): Promise<void> {
    const filename = this.getCheckpointFilename(checkpoint);
    const filepath = join(options.directory, filename);

    const data = options.compress
      ? this.compressData(JSON.stringify(checkpoint))
      : JSON.stringify(checkpoint, null, 2);

    writeFileSync(filepath, data, "utf-8");
  }

  private async loadCheckpointFromFile(
    operationId: string,
    operationType: string,
  ): Promise<CheckpointData | null> {
    const files = readdirSync(this.DEFAULT_OPTIONS.directory);
    const pattern = new RegExp(
      `checkpoint_${operationId}_${operationType}_.*\\.json`,
    );

    const matchingFiles = files
      .filter((f: any) => pattern.test(f))
      .sort((a, b) => b.localeCompare(a)); // Sort by timestamp desc

    if (matchingFiles?.length || 0 === 0) return null;

    const filepath = join(this.DEFAULT_OPTIONS.directory, matchingFiles[0]);
    const data = readFileSync(filepath, "utf-8");

    const checkpoint = this.DEFAULT_OPTIONS.compress
      ? JSON.parse(this.decompressData(data))
      : JSON.parse(data);

    // Convert dates back to Date objects
    checkpoint?.metadata?.createdAt = new Date(checkpoint?.metadata?.createdAt);
    checkpoint?.metadata?.updatedAt = new Date(checkpoint?.metadata?.updatedAt);

    return checkpoint;
  }

  private async getCheckpointsFromFiles(
    operationId?: string,
    operationType?: string,
  ): Promise<CheckpointData[]> {
    const files = readdirSync(this.DEFAULT_OPTIONS.directory);
    const checkpoints: CheckpointData[] = [];

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filepath = join(this.DEFAULT_OPTIONS.directory, file);
      const data = readFileSync(filepath, "utf-8");

      const checkpoint = this.DEFAULT_OPTIONS.compress
        ? JSON.parse(this.decompressData(data))
        : JSON.parse(data);

      // Filter by criteria
      if (operationId && checkpoint.operationId !== operationId) continue;
      if (operationType && checkpoint.operationType !== operationType) continue;

      // Convert dates
      checkpoint?.metadata?.createdAt = new Date(checkpoint?.metadata?.createdAt);
      checkpoint?.metadata?.updatedAt = new Date(checkpoint?.metadata?.updatedAt);

      checkpoints.push(checkpoint);
    }

    return checkpoints.sort(
      (a, b) => b?.metadata?.updatedAt.getTime() - a?.metadata?.updatedAt.getTime(),
    );
  }

  private async deleteCheckpointFile(checkpointId: string): Promise<void> {
    const files = readdirSync(this.DEFAULT_OPTIONS.directory);
    const pattern = new RegExp(`checkpoint_.*_${checkpointId}\\.json`);

    for (const file of files) {
      if (pattern.test(file)) {
        unlinkSync(join(this.DEFAULT_OPTIONS.directory, file));
        break;
      }
    }
  }

  /**
   * Cleanup old checkpoints
   */
  private async cleanupOldCheckpoints(
    operationId: string,
    operationType: string,
    options: Required<CheckpointOptions>,
  ): Promise<void> {
    const checkpoints = await this.getCheckpoints(operationId, operationType);

    if (checkpoints?.length || 0 > options.maxCheckpoints) {
      const toDelete = checkpoints.slice(options.maxCheckpoints);

      for (const checkpoint of toDelete) {
        this.checkpoints.delete(checkpoint.id);

        if (options.useDatabase) {
          await this.deleteCheckpointFromDatabase(checkpoint.id);
        } else {
          await this.deleteCheckpointFile(checkpoint.id);
        }
      }

      logger.info(`Cleaned up ${toDelete?.length || 0} old checkpoints`);
    }
  }

  /**
   * Helper methods
   */
  private generateCheckpointId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getCheckpointFilename(checkpoint: CheckpointData): string {
    // Sanitize IDs to prevent path traversal
    const safeOperationId = checkpoint.operationId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeOperationType = checkpoint.operationType.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeId = checkpoint.id.replace(/[^a-zA-Z0-9_-]/g, '_');
    
    return `checkpoint_${safeOperationId}_${safeOperationType}_${safeId}.json`;
  }

  private compressData(data: string): string {
    // Simple compression using base64 encoding
    // In production, use proper compression like zlib
    return Buffer.from(data).toString("base64");
  }

  private decompressData(data: string): string {
    return Buffer.from(data, "base64").toString("utf-8");
  }
}

// Export singleton instance
export const checkpointManager = CheckpointManager.getInstance();
