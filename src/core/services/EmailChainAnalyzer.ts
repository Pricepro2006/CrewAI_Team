/**
 * Email Chain Analyzer
 * Detects and analyzes email chain completeness for workflow intelligence
 */

import Database from "better-sqlite3";
import { Logger } from "../../utils/logger.js";
import {
  getDatabaseConnection,
  executeQuery,
  executeTransaction,
  type DatabaseConnection,
} from "../../database/ConnectionPool.js";

const logger = new Logger("EmailChainAnalyzer");

interface EmailChainNode {
  id: string;
  message_id: string;
  subject: string;
  sender_email: string;
  recipient_emails: string;
  received_at: string;
  workflow_state: string;
  in_reply_to?: string;
  references?: string;
  thread_id?: string;
}

interface ChainAnalysis {
  chain_id: string;
  is_complete: boolean;
  chain_length: number;
  has_start_point: boolean;
  has_middle_correspondence: boolean;
  has_completion: boolean;
  workflow_states: string[];
  participants: string[];
  duration_hours: number;
  key_entities: {
    quote_numbers: string[];
    po_numbers: string[];
    case_numbers: string[];
  };
  chain_type:
    | "quote_request"
    | "order_processing"
    | "support_ticket"
    | "general_inquiry"
    | "unknown";
  completeness_score: number; // 0-100
  missing_elements: string[];
}

export class EmailChainAnalyzer {
  private databasePath: string;

  constructor(databasePath: string = "./data/crewai.db") {
    this.databasePath = databasePath;
  }

  /**
   * Analyze email chain completeness
   */
  async analyzeChain(emailId: string): Promise<ChainAnalysis> {
    logger.debug(`Analyzing chain for email ${emailId}`);

    // Get the email and its chain
    const email = this.getEmail(emailId);
    if (!email) {
      throw new Error(`Email ${emailId} not found`);
    }

    // Get all related emails in the chain
    const chainEmails = this.getEmailChain(email);
    logger.debug(`Found ${chainEmails.length} emails in chain`);

    // Analyze chain structure
    const analysis = this.analyzeChainStructure(chainEmails);

    return analysis;
  }

  /**
   * Batch analyze multiple emails and group by chains
   */
  async analyzeMultipleChains(
    emailIds: string[],
  ): Promise<Map<string, ChainAnalysis>> {
    const chainMap = new Map<string, ChainAnalysis>();
    const processedChains = new Set<string>();

    for (const emailId of emailIds) {
      try {
        const analysis = await this.analyzeChain(emailId);

        // Skip if we've already processed this chain
        if (processedChains.has(analysis.chain_id)) {
          continue;
        }

        chainMap.set(analysis.chain_id, analysis);
        processedChains.add(analysis.chain_id);
      } catch (error) {
        logger.error(`Error analyzing chain for ${emailId}:`, error);
      }
    }

    return chainMap;
  }

  /**
   * Get email by ID
   */
  private getEmail(emailId: string): EmailChainNode | null {
    return executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT 
          id,
          message_id,
          subject,
          sender_email,
          recipient_emails,
          received_at,
          in_reply_to,
          references,
          thread_id,
          body
        FROM emails 
        WHERE id = ?
      `);

      const email = stmt.get(emailId) as any;
      if (!email) return null;

      // Detect workflow state from content
      email.workflow_state = this.detectWorkflowState(
        email.subject + " " + (email.body || ""),
      );

      return email;
    });
  }

  /**
   * Get all emails in a chain
   */
  private getEmailChain(email: EmailChainNode): EmailChainNode[] {
    return executeQuery((db) => {
      const chainEmails: EmailChainNode[] = [];
      const processedIds = new Set<string>();

      // Use thread_id if available
      if (email.thread_id) {
        const stmt = db.prepare(`
          SELECT * FROM emails 
          WHERE thread_id = ? 
          ORDER BY received_at ASC
        `);

        const threads = stmt.all(email.thread_id) as any[];
        threads.forEach((e) => {
          e.workflow_state = this.detectWorkflowState(
            e.subject + " " + (e.body || ""),
          );
          chainEmails.push(e);
          processedIds.add(e.id);
        });
      }

      // Use subject matching for chains without thread_id
      if (chainEmails.length <= 1) {
        // Clean subject for matching
        const baseSubject = this.cleanSubject(email.subject);

        const stmt = db.prepare(`
          SELECT * FROM emails 
          WHERE (
            subject LIKE ? OR 
            subject LIKE ? OR 
            subject LIKE ? OR
            subject LIKE ?
          )
          AND (
            sender_email IN (SELECT value FROM json_each(?)) OR
            recipient_emails LIKE ? OR
            recipient_emails LIKE ?
          )
          ORDER BY received_at ASC
        `);

        const participants = this.extractParticipants([email]);
        const results = stmt.all(
          `%${baseSubject}%`,
          `RE: %${baseSubject}%`,
          `Re: %${baseSubject}%`,
          `FW: %${baseSubject}%`,
          JSON.stringify(participants),
          `%${email.sender_email}%`,
          `%${email.recipient_emails.split(",")[0]}%`,
        ) as any[];

        results.forEach((e) => {
          if (!processedIds.has(e.id)) {
            e.workflow_state = this.detectWorkflowState(
              e.subject + " " + (e.body || ""),
            );
            chainEmails.push(e);
            processedIds.add(e.id);
          }
        });
      }

      // Sort by date
      chainEmails.sort(
        (a, b) =>
          new Date(a.received_at).getTime() - new Date(b.received_at).getTime(),
      );

      return chainEmails;
    });
  }

  /**
   * Analyze chain structure for completeness
   */
  private analyzeChainStructure(emails: EmailChainNode[]): ChainAnalysis {
    if (emails.length === 0) {
      return this.createEmptyAnalysis();
    }

    // Extract key information
    const workflowStates = emails.map((e) => e.workflow_state);
    const participants = this.extractParticipants(emails);
    const entities = this.extractChainEntities(emails);
    const chainType = this.detectChainType(emails);

    // Calculate duration
    const firstEmail = emails[0];
    const lastEmail = emails[emails.length - 1];
    const durationMs =
      new Date(lastEmail.received_at).getTime() -
      new Date(firstEmail.received_at).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Analyze completeness
    const hasStartPoint =
      workflowStates.includes("START_POINT") ||
      workflowStates.includes("QUOTE_PROCESSING") ||
      workflowStates.includes("ORDER_MANAGEMENT");

    const hasMiddle =
      workflowStates.includes("IN_PROGRESS") || emails.length > 2;

    const hasCompletion =
      workflowStates.includes("COMPLETION") ||
      workflowStates.includes("RESOLVED") ||
      this.detectCompletionSignals(emails);

    // Calculate completeness score
    const { score, missingElements } = this.calculateCompletenessScore({
      hasStartPoint,
      hasMiddle,
      hasCompletion,
      emails,
      chainType,
    });

    // Determine if chain is complete enough for full analysis
    const isComplete = score >= 70; // 70% threshold for completeness

    return {
      chain_id: this.generateChainId(emails),
      is_complete: isComplete,
      chain_length: emails.length,
      has_start_point: hasStartPoint,
      has_middle_correspondence: hasMiddle,
      has_completion: hasCompletion,
      workflow_states: [...new Set(workflowStates)],
      participants: participants,
      duration_hours: Math.round(durationHours * 10) / 10,
      key_entities: entities,
      chain_type: chainType,
      completeness_score: score,
      missing_elements: missingElements,
    };
  }

  /**
   * Detect workflow state from content
   */
  private detectWorkflowState(content: string): string {
    const lowerContent = content.toLowerCase();

    if (
      lowerContent.includes("resolved") ||
      lowerContent.includes("completed") ||
      lowerContent.includes("closed") ||
      lowerContent.includes("shipped") ||
      lowerContent.includes("delivered")
    ) {
      return "COMPLETION";
    }

    if (
      lowerContent.includes("update") ||
      lowerContent.includes("status") ||
      lowerContent.includes("working on") ||
      lowerContent.includes("in progress")
    ) {
      return "IN_PROGRESS";
    }

    if (
      lowerContent.includes("quote") ||
      lowerContent.includes("pricing") ||
      lowerContent.includes("cost")
    ) {
      return "QUOTE_PROCESSING";
    }

    if (lowerContent.includes("order") || lowerContent.includes("purchase")) {
      return "ORDER_MANAGEMENT";
    }

    return "START_POINT";
  }

  /**
   * Clean subject line for matching
   */
  private cleanSubject(subject: string): string {
    return subject
      .replace(/^(RE:|Re:|FW:|Fw:|Fwd:)\s*/gi, "")
      .replace(/^\[.*?\]\s*/, "") // Remove [tags]
      .trim();
  }

  /**
   * Extract all participants from chain
   */
  private extractParticipants(emails: EmailChainNode[]): string[] {
    const participants = new Set<string>();

    emails.forEach((email) => {
      participants.add(email.sender_email.toLowerCase());

      const recipients = email.recipient_emails.split(/[,;]/);
      recipients.forEach((r) => {
        const cleaned = r.trim().toLowerCase();
        if (cleaned) participants.add(cleaned);
      });
    });

    return Array.from(participants);
  }

  /**
   * Extract key entities from chain
   */
  private extractChainEntities(
    emails: EmailChainNode[],
  ): ChainAnalysis["key_entities"] {
    const entities = {
      quote_numbers: new Set<string>(),
      po_numbers: new Set<string>(),
      case_numbers: new Set<string>(),
    };

    emails.forEach((email) => {
      const content = (
        email.subject + " " + (email as any).body || ""
      ).toLowerCase();

      // Extract quote numbers
      const quoteMatches =
        content.match(/\b(?:quote|q)\s*#?\s*(\d{6,10})\b/gi) || [];
      quoteMatches.forEach((m) => {
        const num = m.match(/\d{6,10}/);
        if (num) entities.quote_numbers.add(num[0]);
      });

      // Extract PO numbers
      const poMatches =
        content.match(
          /\b(?:po|p\.o\.|purchase\s*order)\s*#?\s*(\d{7,12})\b/gi,
        ) || [];
      poMatches.forEach((m) => {
        const num = m.match(/\d{7,12}/);
        if (num) entities.po_numbers.add(num[0]);
      });

      // Extract case numbers
      const caseMatches =
        content.match(/\b(?:case|ticket|sr|inc)\s*#?\s*(\d{6,10})\b/gi) || [];
      caseMatches.forEach((m) => {
        const num = m.match(/\d{6,10}/);
        if (num) entities.case_numbers.add(num[0]);
      });
    });

    return {
      quote_numbers: Array.from(entities.quote_numbers),
      po_numbers: Array.from(entities.po_numbers),
      case_numbers: Array.from(entities.case_numbers),
    };
  }

  /**
   * Detect chain type based on content
   */
  private detectChainType(
    emails: EmailChainNode[],
  ): ChainAnalysis["chain_type"] {
    const allContent = emails
      .map((e) => (e.subject + " " + (e as any).body || "").toLowerCase())
      .join(" ");

    if (allContent.includes("quote") || allContent.includes("pricing")) {
      return "quote_request";
    }

    if (allContent.includes("order") || allContent.includes("purchase")) {
      return "order_processing";
    }

    if (
      allContent.includes("ticket") ||
      allContent.includes("case") ||
      allContent.includes("issue") ||
      allContent.includes("problem")
    ) {
      return "support_ticket";
    }

    if (allContent.includes("inquiry") || allContent.includes("question")) {
      return "general_inquiry";
    }

    return "unknown";
  }

  /**
   * Detect completion signals in emails
   */
  private detectCompletionSignals(emails: EmailChainNode[]): boolean {
    const lastEmail = emails[emails.length - 1];
    const lastContent = (
      lastEmail.subject + " " + (lastEmail as any).body || ""
    ).toLowerCase();

    const completionPhrases = [
      "thank you for your business",
      "order has been completed",
      "quote has been sent",
      "issue has been resolved",
      "closing this ticket",
      "marking as complete",
      "delivered successfully",
      "invoice attached",
      "hope this helps",
      "let me know if you need anything else",
    ];

    return completionPhrases.some((phrase) => lastContent.includes(phrase));
  }

  /**
   * Calculate completeness score
   */
  private calculateCompletenessScore(params: {
    hasStartPoint: boolean;
    hasMiddle: boolean;
    hasCompletion: boolean;
    emails: EmailChainNode[];
    chainType: ChainAnalysis["chain_type"];
  }): { score: number; missingElements: string[] } {
    let score = 0;
    const missingElements: string[] = [];

    // Base scoring
    if (params.hasStartPoint) {
      score += 30;
    } else {
      missingElements.push("Initial request/start point");
    }

    if (params.hasMiddle) {
      score += 30;
    } else {
      missingElements.push("Middle correspondence/updates");
    }

    if (params.hasCompletion) {
      score += 40;
    } else {
      missingElements.push("Completion/resolution confirmation");
    }

    // Bonus points for chain characteristics
    if (params.emails.length >= 3) {
      score += 10; // Good chain length
    }

    if (params.emails.length >= 5) {
      score += 5; // Comprehensive chain
    }

    // Deductions
    if (params.emails.length === 1) {
      score -= 20; // Single email, not really a chain
      missingElements.push("Multiple emails for context");
    }

    // Type-specific requirements
    switch (params.chainType) {
      case "quote_request":
        const hasQuoteNumber = params.emails.some((e) =>
          (e.subject + " " + (e as any).body || "").match(
            /quote\s*#?\s*\d{6,10}/i,
          ),
        );
        if (!hasQuoteNumber) {
          score -= 10;
          missingElements.push("Quote number reference");
        }
        break;

      case "order_processing":
        const hasPONumber = params.emails.some((e) =>
          (e.subject + " " + (e as any).body || "").match(
            /po\s*#?\s*\d{7,12}/i,
          ),
        );
        if (!hasPONumber) {
          score -= 10;
          missingElements.push("PO number reference");
        }
        break;
    }

    // Cap score at 100
    score = Math.min(100, Math.max(0, score));

    return { score, missingElements };
  }

  /**
   * Generate unique chain ID
   */
  private generateChainId(emails: EmailChainNode[]): string {
    if (emails.length === 0) return "empty_chain";

    // Use thread_id if available
    if (emails[0].thread_id) {
      return emails[0].thread_id;
    }

    // Generate from subject and participants
    const subject = this.cleanSubject(emails[0].subject);
    const participants = this.extractParticipants(emails).sort().join(",");

    return `chain_${this.hashString(subject + participants)}`;
  }

  /**
   * Simple hash function for chain ID
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Create empty analysis object
   */
  private createEmptyAnalysis(): ChainAnalysis {
    return {
      chain_id: "unknown",
      is_complete: false,
      chain_length: 0,
      has_start_point: false,
      has_middle_correspondence: false,
      has_completion: false,
      workflow_states: [],
      participants: [],
      duration_hours: 0,
      key_entities: {
        quote_numbers: [],
        po_numbers: [],
        case_numbers: [],
      },
      chain_type: "unknown",
      completeness_score: 0,
      missing_elements: ["No emails found"],
    };
  }

  /**
   * Get statistics for all chains in database
   */
  async getChainStatistics(): Promise<{
    total_chains: number;
    complete_chains: number;
    incomplete_chains: number;
    average_chain_length: number;
    chain_type_distribution: Record<string, number>;
  }> {
    // Get all emails
    const emailIds = await executeQuery((db) => {
      const stmt = db.prepare(`
        SELECT id FROM emails 
        ORDER BY received_at DESC 
        LIMIT 10000
      `);

      const emails = stmt.all() as any[];
      return emails.map((e) => e.id);
    });

    // Analyze chains
    const chains = await this.analyzeMultipleChains(emailIds);

    // Calculate statistics
    const stats = {
      total_chains: chains.size,
      complete_chains: 0,
      incomplete_chains: 0,
      average_chain_length: 0,
      chain_type_distribution: {} as Record<string, number>,
    };

    let totalLength = 0;

    chains.forEach((chain) => {
      if (chain.is_complete) {
        stats.complete_chains++;
      } else {
        stats.incomplete_chains++;
      }

      totalLength += chain.chain_length;

      // Count chain types
      stats.chain_type_distribution[chain.chain_type] =
        (stats.chain_type_distribution[chain.chain_type] || 0) + 1;
    });

    stats.average_chain_length =
      chains.size > 0 ? Math.round((totalLength / chains.size) * 10) / 10 : 0;

    return stats;
  }

  /**
   * Connection cleanup handled by connection pool
   */
  close(): void {
    // Connection pool handles cleanup automatically
  }
}
