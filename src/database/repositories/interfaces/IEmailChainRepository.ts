import { IRepository } from "./IRepository.js";
import {
  EmailChain,
  ChainType,
  ChainCompleteness,
} from "../../../types/ChainTypes.js";

/**
 * Email chain repository interface
 */
export interface IEmailChainRepository extends IRepository<EmailChain, string> {
  /**
   * Find complete chains
   */
  findCompleteChains(limit?: number): Promise<EmailChain[]>;

  /**
   * Find incomplete chains
   */
  findIncompleteChains(limit?: number): Promise<EmailChain[]>;

  /**
   * Find chains by type
   */
  findByType(type: ChainType): Promise<EmailChain[]>;

  /**
   * Find chains by completeness score range
   */
  findByCompletenessRange(
    minScore: number,
    maxScore: number,
  ): Promise<EmailChain[]>;

  /**
   * Update chain completeness
   */
  updateCompleteness(
    chainId: string,
    completeness: ChainCompleteness,
  ): Promise<void>;

  /**
   * Add email to chain
   */
  addEmailToChain(chainId: string, emailId: string): Promise<void>;

  /**
   * Remove email from chain
   */
  removeEmailFromChain(chainId: string, emailId: string): Promise<void>;

  /**
   * Get chain statistics
   */
  getChainStatistics(): Promise<{
    total: number;
    complete: number;
    incomplete: number;
    byType: Record<ChainType, number>;
    avgCompleteness: number;
    avgEmailCount: number;
  }>;

  /**
   * Find chains with minimum email count
   */
  findByMinEmailCount(minCount: number): Promise<EmailChain[]>;

  /**
   * Find chains by duration range (in hours)
   */
  findByDurationRange(
    minHours: number,
    maxHours: number,
  ): Promise<EmailChain[]>;

  /**
   * Create or update chain
   */
  upsert(chain: EmailChain): Promise<EmailChain>;

  /**
   * Get chain email IDs
   */
  getChainEmailIds(chainId: string): Promise<string[]>;

  /**
   * Find chains that need reanalysis
   */
  findChainsNeedingReanalysis(lastAnalyzedBefore: Date): Promise<EmailChain[]>;
}
