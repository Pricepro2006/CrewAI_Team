/**
 * Email-RAG Integration Service
 * Connects email processing pipeline with RAG system for enhanced semantic search and context retrieval
 */

import { RAGSystem } from "./RAGSystem.js";
import { logger } from "../../utils/logger.js";
import type { EmailRecord } from "../../shared/types/email.js";

export interface EmailIndexingStatus {
  total: number;
  indexed: number;
  failed: number;
  errors: string[];
  duration: number;
}

export interface EmailSearchResult {
  emailId: string;
  subject: string;
  snippet: string;
  score: number;
  sender?: string;
  date?: string;
  relevantChunks?: string[];
}

export class EmailRAGIntegration {
  private ragSystem: RAGSystem;
  private indexingInProgress: boolean = false;
  private lastIndexedCount: number = 0;

  constructor(ragSystem: RAGSystem) {
    this.ragSystem = ragSystem;
  }

  /**
   * Initialize the integration and prepare for email indexing
   */
  async initialize(): Promise<void> {
    try {
      await this.ragSystem.initialize();
      logger.info("Email-RAG integration initialized successfully", "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Email-RAG integration initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Index a single email into the RAG system
   */
  async indexEmail(email: EmailRecord): Promise<void> {
    try {
      await this.ragSystem.indexEmailContent(email.id, {
        subject: email.subject || 'No Subject',
        body: email.body || '',
        sender: email.sender || undefined,
        recipients: email.recipients ? [email.recipients] : undefined,
        date: email.receivedDate?.toISOString(),
        metadata: {
          messageId: email.messageId,
          emailAlias: email.emailAlias,
          status: email.status,
          workflowType: email.workflowType,
          priority: email.priority,
          hasAttachments: email.hasAttachments,
          isRead: email.isRead,
          chainId: email.chainId,
        },
      });

      logger.debug(`Indexed email: ${email.id}`, "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Failed to index email ${email.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Batch index multiple emails efficiently
   */
  async batchIndexEmails(emails: EmailRecord[]): Promise<EmailIndexingStatus> {
    if (this.indexingInProgress) {
      throw new Error("Email indexing already in progress");
    }

    this.indexingInProgress = true;
    const startTime = Date.now();

    try {
      logger.info(`Starting batch indexing of ${emails.length} emails`, "EMAIL_RAG_INTEGRATION");

      const emailData = emails.map(email => ({
        id: email.id,
        subject: email.subject || 'No Subject',
        body: email.body || '',
        sender: email.sender || undefined,
        recipients: email.recipients ? [email.recipients] : undefined,
        date: email.receivedDate?.toISOString(),
        metadata: {
          messageId: email.messageId,
          emailAlias: email.emailAlias,
          status: email.status,
          workflowType: email.workflowType,
          priority: email.priority,
          hasAttachments: email.hasAttachments,
          isRead: email.isRead,
          chainId: email.chainId,
        },
      }));

      const result = await this.ragSystem.batchIndexEmails(emailData);
      this.lastIndexedCount += result.indexed;

      const duration = Date.now() - startTime;
      
      logger.info(
        `Batch indexing completed: ${result.indexed}/${emails.length} emails indexed in ${duration}ms`,
        "EMAIL_RAG_INTEGRATION"
      );

      return {
        total: emails.length,
        indexed: result.indexed,
        failed: result.failed,
        errors: result.errors,
        duration,
      };
    } finally {
      this.indexingInProgress = false;
    }
  }

  /**
   * Search emails using semantic similarity
   */
  async searchEmails(
    query: string,
    options: {
      limit?: number;
      sender?: string;
      dateRange?: { from?: string; to?: string };
      includeBody?: boolean;
      minScore?: number;
    } = {}
  ): Promise<EmailSearchResult[]> {
    try {
      const results = await this.ragSystem.searchEmails(query, {
        limit: options.limit || 10,
        sender: options.sender,
        dateRange: options.dateRange,
        includeBody: options.includeBody || false,
      });

      // Filter by minimum score if specified
      const filteredResults = options.minScore 
        ? results.filter(result => result.score >= options.minScore!)
        : results;

      return filteredResults.map(result => ({
        emailId: result.emailId,
        subject: result.subject,
        snippet: result.snippet,
        score: result.score,
        sender: result.sender,
        date: result.date,
        relevantChunks: [], // Could be enhanced to show specific matching chunks
      }));
    } catch (error) {
      logger.error(
        `Email search failed for query "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Get email context for LLM enhancement
   */
  async getEmailContextForLLM(
    query: string,
    options: {
      limit?: number;
      focusArea?: 'subject' | 'body' | 'both';
      timeframe?: 'recent' | 'all';
    } = {}
  ): Promise<string> {
    try {
      const context = await this.ragSystem.getEmailContext(query, options);
      
      if (context) {
        logger.debug(`Retrieved email context for LLM (${context.length} chars)`, "EMAIL_RAG_INTEGRATION");
      }

      return context;
    } catch (error) {
      logger.error(
        `Failed to get email context for query "${query}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      return ""; // Return empty context rather than failing
    }
  }

  /**
   * Enhanced search that combines traditional email queries with RAG
   */
  async hybridEmailSearch(
    query: string,
    traditionalResults: EmailRecord[],
    options: {
      ragWeight?: number; // 0-1, how much to weight RAG results vs traditional
      combineLimit?: number;
    } = {}
  ): Promise<{
    combined: EmailSearchResult[];
    ragOnly: EmailSearchResult[];
    traditional: EmailRecord[];
  }> {
    const ragWeight = options.ragWeight || 0.7;
    const combineLimit = options.combineLimit || 20;

    try {
      // Get RAG results
      const ragResults = await this.searchEmails(query, { limit: combineLimit });

      // Convert traditional results to search result format
      const traditionalSearchResults: EmailSearchResult[] = traditionalResults.map((email, index) => ({
        emailId: email.id,
        subject: email.subject || 'No Subject',
        snippet: email.body?.substring(0, 300) || '',
        score: 1.0 - (index * 0.1), // Decreasing score based on position
        sender: email.sender,
        date: email.receivedDate?.toISOString(),
      }));

      // Combine and rerank results
      const allResults = new Map<string, EmailSearchResult>();

      // Add traditional results
      traditionalSearchResults.forEach(result => {
        allResults.set(result.emailId, {
          ...result,
          score: result.score * (1 - ragWeight),
        });
      });

      // Add or merge RAG results
      ragResults.forEach(result => {
        const existing = allResults.get(result.emailId);
        if (existing) {
          // Combine scores if email appears in both
          existing.score = existing.score + (result.score * ragWeight);
          existing.relevantChunks = result.relevantChunks;
        } else {
          allResults.set(result.emailId, {
            ...result,
            score: result.score * ragWeight,
          });
        }
      });

      // Sort by combined score and limit
      const combined = Array.from(allResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, combineLimit);

      logger.info(
        `Hybrid search completed: ${combined.length} combined results from ${traditionalResults.length} traditional + ${ragResults.length} RAG`,
        "EMAIL_RAG_INTEGRATION"
      );

      return {
        combined,
        ragOnly: ragResults,
        traditional: traditionalResults,
      };
    } catch (error) {
      logger.error(
        `Hybrid email search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      
      // Fallback to traditional results only
      return {
        combined: traditionalResults.map((email, index) => ({
          emailId: email.id,
          subject: email.subject || 'No Subject',
          snippet: email.body?.substring(0, 300) || '',
          score: 1.0 - (index * 0.1),
          sender: email.sender,
          date: email.receivedDate?.toISOString(),
        })),
        ragOnly: [],
        traditional: traditionalResults,
      };
    }
  }

  /**
   * Get indexing statistics
   */
  async getIndexingStats(): Promise<{
    totalDocuments: number;
    emailDocuments: number;
    indexingInProgress: boolean;
    lastIndexedCount: number;
    systemHealth: 'healthy' | 'degraded' | 'error';
  }> {
    try {
      const ragStats = await this.ragSystem.getStats();
      const healthStatus = await this.ragSystem.getHealthStatus();

      // Count email documents specifically
      const allDocs = await this.ragSystem.getAllDocuments(10000);
      const emailDocs = allDocs.filter(doc => doc.metadata.type === 'email');

      return {
        totalDocuments: ragStats.totalDocuments,
        emailDocuments: emailDocs.length,
        indexingInProgress: this.indexingInProgress,
        lastIndexedCount: this.lastIndexedCount,
        systemHealth: healthStatus.status,
      };
    } catch (error) {
      logger.error(
        `Failed to get indexing stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      
      return {
        totalDocuments: 0,
        emailDocuments: 0,
        indexingInProgress: this.indexingInProgress,
        lastIndexedCount: this.lastIndexedCount,
        systemHealth: 'error',
      };
    }
  }

  /**
   * Clear all email documents from the RAG system
   */
  async clearEmailIndex(): Promise<void> {
    try {
      // Note: This is a simplified implementation
      // A more sophisticated approach would selectively delete only email documents
      await this.ragSystem.clear();
      this.lastIndexedCount = 0;
      
      logger.info("Email index cleared", "EMAIL_RAG_INTEGRATION");
    } catch (error) {
      logger.error(
        `Failed to clear email index: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "EMAIL_RAG_INTEGRATION"
      );
      throw error;
    }
  }

  /**
   * Check if the integration is ready for operations
   */
  async isReady(): Promise<boolean> {
    try {
      const healthStatus = await this.ragSystem.getHealthStatus();
      return healthStatus.status !== 'error';
    } catch (error) {
      return false;
    }
  }
}