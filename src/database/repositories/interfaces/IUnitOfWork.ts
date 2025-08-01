import { IEmailRepository } from "./IEmailRepository.js";
import { IEmailChainRepository } from "./IEmailChainRepository.js";
import { IAnalysisRepository } from "./IAnalysisRepository.js";

/**
 * Unit of Work pattern for managing transactions across repositories
 */
export interface IUnitOfWork {
  /**
   * Email repository instance
   */
  emails: IEmailRepository;

  /**
   * Email chain repository instance
   */
  chains: IEmailChainRepository;

  /**
   * Analysis repository instance
   */
  analyses: IAnalysisRepository;

  /**
   * Begin a new transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit the current transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction
   */
  rollback(): Promise<void>;

  /**
   * Execute a function within a transaction
   */
  executeInTransaction<T>(work: () => Promise<T>): Promise<T>;

  /**
   * Check if a transaction is active
   */
  isTransactionActive(): boolean;

  /**
   * Dispose of resources
   */
  dispose(): Promise<void>;
}
