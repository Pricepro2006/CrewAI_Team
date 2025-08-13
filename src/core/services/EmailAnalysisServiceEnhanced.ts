/**
 * Enhanced Email Analysis Service
 * Works directly with the enhanced database schema
 * Implements Phase 1 (rule-based) and Phase 2 (LLM) analysis
 */

import Database from "better-sqlite3";
import axios from "axios";
import { Logger } from "../../utils/logger.js";
import { LLMRateLimiter } from "./LLMRateLimiter.js";
import { GroceryNLPQueue } from "../../api/services/GroceryNLPQueue.js";

const logger = new Logger("EmailAnalysisServiceEnhanced");

interface EmailInput {
  id: string;
  subject: string;
  body_content: string;
  body_preview?: string;
  sender_email: string;
  received_date_time: string;
  conversation_id?: string;
  chainAnalysis?: {
    is_complete_chain: boolean;
    completeness_score: number;
    chain_type: string;
  };
}

interface AnalysisResult {
  workflow_state: string;
  priority: string;
  confidence: number;
  entities: Record<string, any>;
  strategic_insights?: {
    opportunity: string;
    risk: string;
    relationship: string;
  };
  phase_completed: 1 | 2;
}

export class EmailAnalysisServiceEnhanced {
  private db: Database.Database;
  private rateLimiter = new LLMRateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  private nlpQueue = GroceryNLPQueue.getInstance();

  constructor(dbPath: string = "./data/crewai_enhanced.db") {
    this.db = new Database(dbPath);
    this.db.pragma("foreign_keys = OFF"); // Disable for now to avoid issues
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
  }

  /**
   * Analyze email with Phase 1 and optionally Phase 2
   */
  async analyzeEmail(
    email: EmailInput,
    options: { runPhase2?: boolean } = { runPhase2: true }
  ): Promise<AnalysisResult> {
    try {
      // Phase 1: Rule-based analysis
      const phase1Result = this.runPhase1(email);

      if (!options.runPhase2) {
        return phase1Result;
      }

      // Phase 2: LLM enhancement
      const phase2Result = await this.runPhase2(email, phase1Result);
      return phase2Result;
    } catch (error) {
      logger.error("Email analysis failed:", error);
      // Return Phase 1 results as fallback
      return this.runPhase1(email);
    }
  }

  /**
   * Phase 1: Rule-based analysis
   */
  private runPhase1(email: EmailInput): AnalysisResult {
    const subject = email.subject.toLowerCase();
    const body = (email.body_content || email.body_preview || "").toLowerCase();
    const combined = subject + " " + body;

    // Extract entities
    const entities = this.extractEntities(email);

    // Determine workflow state
    let workflow_state = "pending";
    if (
      combined.includes("complete") ||
      combined.includes("resolved") ||
      combined.includes("closed") ||
      combined.includes("delivered")
    ) {
      workflow_state = "completed";
    } else if (
      combined.includes("in progress") ||
      combined.includes("working on") ||
      combined.includes("processing") ||
      subject.includes("re:") ||
      subject.includes("fw:")
    ) {
      workflow_state = "in_progress";
    }

    // Determine priority
    let priority = "medium";
    if (
      combined.includes("urgent") ||
      combined.includes("critical") ||
      combined.includes("asap") ||
      combined.includes("immediately") ||
      combined.includes("emergency")
    ) {
      priority = "critical";
    } else if (
      combined.includes("high priority") ||
      combined.includes("important") ||
      combined.includes("priority")
    ) {
      priority = "high";
    } else if (
      combined.includes("low priority") ||
      combined.includes("when possible") ||
      combined.includes("no rush")
    ) {
      priority = "low";
    }

    return {
      workflow_state,
      priority,
      confidence: 0.7,
      entities,
      phase_completed: 1,
    };
  }

  /**
   * Phase 2: LLM-enhanced analysis
   */
  private async runPhase2(
    email: EmailInput,
    phase1Result: AnalysisResult
  ): Promise<AnalysisResult> {
    try {
      // Check rate limit
      const rateLimitResult = await this.rateLimiter.checkAndConsume(
        "email-analysis",
        "llama3.2:3b",
        0.001
      );

      if (!rateLimitResult.allowed) {
        logger.warn("Rate limit exceeded, using Phase 1 results");
        return phase1Result;
      }

      // Build prompt
      const prompt = this.buildPhase2Prompt(email, phase1Result);

      // Call Ollama through NLP queue to prevent bottlenecks
      const llmResponse = await this.nlpQueue.enqueue(
        async () => {
          const response = await axios.post(
            "http://localhost:11434/api/generate",
            {
              model: "llama3.2:3b",
              prompt,
              stream: false,
              options: {
                temperature: 0.3,
                num_predict: 500,
                stop: ["\n\n", "```"],
              },
            },
            {
              timeout: 30000,
              validateStatus: (status) => status < 500,
            }
          );

          if (response.status !== 200) {
            throw new Error(`LLM request failed with status ${response.status}`);
          }

          return response.data.response;
        },
        "normal", // priority
        30000, // timeout
        `email-analysis-phase2-${email.id}`, // query for deduplication
        { emailId: email.id, phase: 2 } // metadata
      );
      const enhancedResult = this.parsePhase2Response(llmResponse, phase1Result);

      return {
        ...enhancedResult,
        phase_completed: 2,
      };
    } catch (error) {
      logger.error("Phase 2 failed:", error);
      return phase1Result;
    }
  }

  /**
   * Extract entities from email
   */
  private extractEntities(email: EmailInput): Record<string, any> {
    const text = email.subject + " " + (email.body_content || email.body_preview || "");

    return {
      po_numbers: this.extractPattern(text, /\b(?:PO|P\.O\.|Purchase Order)[\s#:-]*(\d{4,})\b/gi),
      quote_numbers: this.extractPattern(text, /\b(?:Quote|QTE|Q)[\s#:-]*(\d{4,})\b/gi),
      case_numbers: this.extractPattern(text, /\b(?:Case|CAS|Ticket)[\s#:-]*(\d{4,})\b/gi),
      part_numbers: this.extractPattern(text, /\b[A-Z0-9]{3,}(?:#[A-Z0-9]+)?\b/g),
      order_references: this.extractPattern(text, /\b(?:Order|ORD)[\s#:-]*(\d{4,})\b/gi),
      contacts: this.extractEmails(text),
      companies: this.extractCompanies(text),
    };
  }

  private extractPattern(text: string, pattern: RegExp): string[] {
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
  }

  private extractEmails(text: string): string[] {
    const pattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return this.extractPattern(text, pattern);
  }

  private extractCompanies(text: string): string[] {
    const commonCompanies = [
      "Microsoft", "Google", "Amazon", "Apple", "IBM", "Oracle",
      "Salesforce", "SAP", "Adobe", "Intel", "Cisco", "Dell",
      "HP", "VMware", "Nvidia", "AMD", "Qualcomm", "Broadcom"
    ];
    
    const found: string[] = [];
    for (const company of commonCompanies) {
      if (text.includes(company)) {
        found.push(company);
      }
    }
    return found;
  }

  /**
   * Build Phase 2 prompt
   */
  private buildPhase2Prompt(email: EmailInput, phase1Result: AnalysisResult): string {
    return `Analyze this email and provide enhanced insights:

Subject: ${email.subject}
From: ${email.sender_email}
Initial Analysis: Workflow=${phase1Result.workflow_state}, Priority=${phase1Result.priority}

Email Body:
${(email.body_content || email.body_preview || "").substring(0, 1000)}

Please identify:
1. Any missed entities (companies, products, people)
2. Key action items
3. Business impact assessment
4. Suggested response

Format your response as a brief analysis (max 200 words).`;
  }

  /**
   * Parse Phase 2 response
   */
  private parsePhase2Response(
    llmResponse: string,
    phase1Result: AnalysisResult
  ): AnalysisResult {
    // Simple parsing - extract key insights
    const insights = {
      opportunity: "Standard processing",
      risk: "Low risk",
      relationship: "Standard relationship",
    };

    // Look for keywords to enhance the analysis
    const lowerResponse = llmResponse.toLowerCase();
    
    if (lowerResponse.includes("urgent") || lowerResponse.includes("critical")) {
      phase1Result.priority = "critical";
      insights.risk = "Time-sensitive - requires immediate attention";
    }

    if (lowerResponse.includes("opportunity") || lowerResponse.includes("potential")) {
      insights.opportunity = "Potential business opportunity identified";
    }

    if (lowerResponse.includes("risk") || lowerResponse.includes("concern")) {
      insights.risk = "Potential risk requiring attention";
    }

    return {
      ...phase1Result,
      confidence: 0.85,
      strategic_insights: insights,
    };
  }

  /**
   * Save analysis results to database
   */
  async saveAnalysis(email: EmailInput, result: AnalysisResult): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE emails_enhanced SET
          workflow_state = ?,
          priority = ?,
          confidence_score = ?,
          extracted_entities = ?,
          analyzed_at = datetime('now'),
          phase_completed = ?,
          status = 'analyzed',
          updated_at = datetime('now')
        WHERE id = ?
      `);

      stmt.run(
        result.workflow_state,
        result.priority,
        result.confidence,
        JSON.stringify(result.entities),
        result.phase_completed,
        email.id
      );
    } catch (error) {
      logger.error("Failed to save analysis:", error);
      throw error;
    }
  }

  /**
   * Process emails in batch
   */
  async processBatch(emails: EmailInput[], runPhase2: boolean = true): Promise<void> {
    const results = [];
    
    for (const email of emails) {
      try {
        const result = await this.analyzeEmail(email, { runPhase2 });
        await this.saveAnalysis(email, result);
        results.push({ email: email.id, success: true });
      } catch (error) {
        logger.error(`Failed to process email ${email.id}:`, error);
        results.push({ email: email.id, success: false, error });
      }
    }

    const successful = results.filter(r => r.success).length;
    logger.info(`Batch processing complete: ${successful}/${emails.length} successful`);
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export singleton instance
export const emailAnalysisService = new EmailAnalysisServiceEnhanced();