import type { IUnitOfWork } from "./repositories/interfaces/IUnitOfWork.js";
import type { IEmailRepository } from "./repositories/interfaces/IEmailRepository.js";
import type { IEmailChainRepository } from "./repositories/interfaces/IEmailChainRepository.js";
import type { IAnalysisRepository } from "./repositories/interfaces/IAnalysisRepository.js";

// Re-export IUnitOfWork for other modules
export type { IUnitOfWork } from "./repositories/interfaces/IUnitOfWork.js";
import { EmailRepositoryImpl } from "./repositories/EmailRepositoryImpl.js";
import { EmailChainRepositoryImpl } from "./repositories/EmailChainRepositoryImpl.js";
import { AnalysisRepositoryImpl } from "./repositories/AnalysisRepositoryImpl.js";
import { executeTransaction, getConnectionPool } from "./ConnectionPool.js";
import { logger } from "../utils/logger.js";
// Use require for better-sqlite3 to avoid type issues
const Database = require("better-sqlite3");

/**
 * Unit of Work implementation for managing transactions across repositories
 */
export class UnitOfWork implements IUnitOfWork {
  private _emails: IEmailRepository;
  private _chains: IEmailChainRepository;
  private _analyses: IAnalysisRepository;
  private _transactionActive: boolean = false;
  private _transactionDb: any | null = null;

  constructor() {
    this._emails = new EmailRepositoryImpl();
    this._chains = new EmailChainRepositoryImpl();
    this._analyses = new AnalysisRepositoryImpl();
  }

  /**
   * Get email repository
   */
  get emails(): IEmailRepository {
    return this._emails;
  }

  /**
   * Get email chain repository
   */
  get chains(): IEmailChainRepository {
    return this._chains;
  }

  /**
   * Get analysis repository
   */
  get analyses(): IAnalysisRepository {
    return this._analyses;
  }

  /**
   * Begin a new transaction
   */
  async beginTransaction(): Promise<void> {
    if (this._transactionActive) {
      throw new Error("Transaction already active");
    }

    try {
      const pool = getConnectionPool();
      const connection = pool.getConnection();
      this._transactionDb = connection.getDatabase();
      this?._transactionDb?.exec("BEGIN TRANSACTION");
      this._transactionActive = true;

      logger.info("Transaction started", "UNIT_OF_WORK");
    } catch (error) {
      logger.error("Failed to begin transaction", "UNIT_OF_WORK", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Commit the current transaction
   */
  async commit(): Promise<void> {
    if (!this._transactionActive || !this._transactionDb) {
      throw new Error("No active transaction to commit");
    }

    try {
      this?._transactionDb?.exec("COMMIT");
      this._transactionActive = false;
      this._transactionDb = null;

      logger.info("Transaction committed", "UNIT_OF_WORK");
    } catch (error) {
      logger.error("Failed to commit transaction", "UNIT_OF_WORK", {
        error: error instanceof Error ? error.message : String(error),
      });

      // Attempt rollback on commit failure
      try {
        await this.rollback();
      } catch (rollbackError) {
        logger.error(
          "Failed to rollback after commit failure",
          "UNIT_OF_WORK",
          {
            error:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          },
        );
      }

      throw error;
    }
  }

  /**
   * Rollback the current transaction
   */
  async rollback(): Promise<void> {
    if (!this._transactionActive || !this._transactionDb) {
      throw new Error("No active transaction to rollback");
    }

    try {
      this?._transactionDb?.exec("ROLLBACK");
      this._transactionActive = false;
      this._transactionDb = null;

      logger.info("Transaction rolled back", "UNIT_OF_WORK");
    } catch (error) {
      logger.error("Failed to rollback transaction", "UNIT_OF_WORK", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Execute a function within a transaction
   */
  async executeInTransaction<T>(work: () => Promise<T>): Promise<T> {
    // Use the connection pool's transaction support
    return executeTransaction(async (db: any) => {
      // Execute the work function
      // The transaction will be automatically managed
      const result = await work();
      return result;
    });
  }

  /**
   * Check if a transaction is active
   */
  isTransactionActive(): boolean {
    return this._transactionActive;
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this._transactionActive) {
      try {
        await this.rollback();
      } catch (error) {
        logger.error("Failed to rollback during dispose", "UNIT_OF_WORK", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this._transactionDb = null;
    logger.info("Unit of Work disposed", "UNIT_OF_WORK");
  }
}

/**
 * Factory function to create a new Unit of Work
 */
export function createUnitOfWork(): IUnitOfWork {
  return new UnitOfWork();
}

/**
 * Execute work within a Unit of Work transaction
 */
export async function withUnitOfWork<T>(
  work: (uow: IUnitOfWork) => Promise<T>,
): Promise<T> {
  const uow = createUnitOfWork();

  try {
    const result = await uow.executeInTransaction(async () => {
      return await work(uow);
    });

    return result;
  } finally {
    await uow.dispose();
  }
}
