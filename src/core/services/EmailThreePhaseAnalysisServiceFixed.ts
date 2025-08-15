/**
 * Fixed Email Three-Phase Analysis Service
 * Uses only crewai_enhanced.db and updates emails_enhanced table directly
 */

import { EventEmitter } from "events";
import axios from "axios";
import Database from "better-sqlite3";
import { Logger } from "../../utils/logger.js";
import { GroceryNLPQueue } from "../../api/services/GroceryNLPQueue.js";

const logger = new Logger("EmailThreePhaseFixed");

interface EmailInput {
  id: string;
  subject: string;
  body?: string;
  body_content?: string;
  sender_email: string;
  received_at?: string;
  received_date_time?: string;
  conversation_id?: string;
  importance?: string;
  has_attachments?: number;
}

interface ChainContext {
  isComplete: boolean;
  completenessScore: number;
  chainType: string;
  conversationId?: string;
}

interface AnalysisOptions {
  chainContext?: ChainContext;
  qualityThreshold?: number;
  useHybridApproach?: boolean;
  enableQualityLogging?: boolean;
  timeout?: number;
}

interface AnalysisResult {
  workflow_state: string;
  priority: string;
  confidence: number;
  entities: {
    po_numbers: string[];
    quote_numbers: string[];
    case_numbers: string[];
    part_numbers: string[];
    dollar_amounts: string[];
    contacts: any[];
  };
  action_items: any[];
  key_phrases: string[];
  business_process: string;
  sentiment: string;
  phase3_applied?: boolean;
  quality_score: number;
  processing_time_ms: number;
}

export class EmailThreePhaseAnalysisServiceFixed extends EventEmitter {
  private db: Database.Database;
  private nlpQueue = GroceryNLPQueue.getInstance();
  private stats = {
    totalProcessed: 0,
    phase1Count: 0,
    phase2Count: 0,
    phase3Count: 0,
    jsonSuccessCount: 0,
    jsonFailureCount: 0,
    averageProcessingTime: 0,
  };

  constructor(databasePath: string = "./data/crewai_enhanced.db") {
    super();
    this.db = new Database(databasePath);
    logger.info(
      "EmailThreePhaseAnalysisServiceFixed initialized with enhanced database",
    );
  }

  async analyzeEmail(
    email: EmailInput,
    options: AnalysisOptions = {},
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    try {
      // Normalize email body field
      const emailBody = email.body || email.body_content || "";

      // Phase 1: Rule-based analysis
      this.emit("phase:start", { phase: 1, email: email.id });
      const phase1Result = this.runPhase1(email, emailBody);
      this.emit("phase:complete", { phase: 1, result: phase1Result });
      this?.stats?.phase1Count++;

      // Phase 2: LLM Enhancement
      this.emit("phase:start", { phase: 2, email: email.id });
      const phase2Result = await this.runPhase2(email, emailBody, phase1Result);
      this.emit("phase:complete", { phase: 2, result: phase2Result });
      this?.stats?.phase2Count++;

      // Phase 3: Strategic Analysis (only for complete chains)
      let finalResult = phase2Result;
      if (
        options.chainContext?.isComplete &&
        options?.chainContext?.completenessScore >= 70
      ) {
        this.emit("phase:start", { phase: 3, email: email.id });
        finalResult = await this.runPhase3(
          email,
          emailBody,
          phase2Result,
          options.chainContext,
        );
        this.emit("phase:complete", { phase: 3, result: finalResult });
        this?.stats?.phase3Count++;
      }

      // Update processing stats
      const processingTime = Date.now() - startTime;
      this?.stats?.totalProcessed++;
      this?.stats?.averageProcessingTime =
        (this?.stats?.averageProcessingTime * (this?.stats?.totalProcessed - 1) +
          processingTime) /
        this?.stats?.totalProcessed;

      // Save analysis results directly to emails_enhanced table
      await this.saveAnalysisToEnhancedTable(
        email.id,
        finalResult,
        options.chainContext,
      );

      this.emit("analysis:complete", {
        email: email.id,
        result: finalResult,
        processingTime,
        phases: finalResult.phase3_applied ? 3 : 2,
      });

      return {
        ...finalResult,
        processing_time_ms: processingTime,
      };
    } catch (error) {
      logger.error(`Analysis failed for email ${email.id}:`, error as string);
      this.emit("analysis:error", { email: email.id, error });
      throw error;
    }
  }

  private runPhase1(email: EmailInput, body: string): Partial<AnalysisResult> {
    const startTime = Date.now();

    // Extract entities using regex
    const entities = {
      po_numbers: this.extractPONumbers(body),
      quote_numbers: this.extractQuoteNumbers(body),
      case_numbers: this.extractCaseNumbers(body),
      part_numbers: this.extractPartNumbers(body),
      dollar_amounts: this.extractDollarAmounts(body),
      contacts: this.extractEmails(body),
    };

    // Determine priority based on keywords
    const priority = this.determinePriority(
      email.subject,
      body,
      email.importance,
    );

    // Extract key phrases
    const keyPhrases = this.extractKeyPhrases(email.subject);

    // Basic workflow state
    const workflowState = this.determineWorkflowState(email.subject, body);

    return {
      workflow_state: workflowState,
      priority,
      confidence: 0.6,
      entities,
      action_items: [],
      key_phrases: keyPhrases,
      business_process: "email_correspondence",
      sentiment: "neutral",
      quality_score: 6.0,
      processing_time_ms: Date.now() - startTime,
    };
  }

  private async runPhase2(
    email: EmailInput,
    body: string,
    phase1Result: Partial<AnalysisResult>,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    const prompt = `Analyze this business email and enhance the initial analysis.

Email Details:
Subject: ${email.subject}
From: ${email.sender_email}
Body: ${body.substring(0, 1000)}...

Initial Analysis:
- Workflow State: ${phase1Result.workflow_state}
- Priority: ${phase1Result.priority}
- Entities Found: ${JSON.stringify(phase1Result.entities)}

Enhance this analysis by providing:
{
  "workflow_state": "pending/in_progress/completed/blocked",
  "priority": "critical/high/medium/low",
  "business_process": "quote_request/order_processing/support_ticket/inquiry/other",
  "action_items": [{"task": "description", "owner": "role", "deadline": "timeframe"}],
  "sentiment": "positive/neutral/negative/urgent",
  "confidence": 0.0 to 1.0,
  "key_insights": ["insight1", "insight2"]
}

Respond ONLY with valid JSON.`;

    try {
      const responseData = await this?.nlpQueue?.enqueue(
        async () => {
          const response = await axios.post(
            "http://localhost:11434/api/generate",
            {
              model: "llama3.2:3b",
              prompt,
              stream: false,
              format: "json", // Force JSON output
              options: {
                temperature: 0.2,
                num_predict: 500,
              },
            },
            {
              timeout: 30000,
            },
          );
          return response?.data?.response;
        },
        "normal", // priority
        30000, // timeout
        `phase2-llama-${email.id}`, // query for deduplication
        { emailId: email.id, phase: 2, model: "llama3.2:3b" } // metadata
      );

      const enhancement = JSON.parse(responseData);
      this?.stats.jsonSuccessCount++;

      // Merge with phase 1 results
      return {
        workflow_state:
          enhancement.workflow_state ||
          phase1Result.workflow_state ||
          "pending",
        priority: enhancement.priority || phase1Result.priority || "medium",
        confidence: enhancement.confidence || 0.75,
        entities: phase1Result.entities || {},
        action_items: enhancement.action_items || [],
        key_phrases: [
          ...(phase1Result.key_phrases || []),
          ...(enhancement.key_insights || []),
        ],
        business_process:
          enhancement.business_process || "email_correspondence",
        sentiment: enhancement.sentiment || "neutral",
        quality_score: 7.5,
        processing_time_ms: Date.now() - startTime,
      } as AnalysisResult;
    } catch (error) {
      logger.warn("Phase 2 enhancement failed, using phase 1 results:", error);
      this?.stats.jsonFailureCount++;

      return {
        ...phase1Result,
        confidence: 0.6,
        quality_score: 6.0,
        processing_time_ms: Date.now() - startTime,
      } as AnalysisResult;
    }
  }

  private async runPhase3(
    email: EmailInput,
    body: string,
    phase2Result: AnalysisResult,
    chainContext: ChainContext,
  ): Promise<AnalysisResult> {
    const startTime = Date.now();

    const prompt = `Perform strategic analysis of this email within its complete conversation context.

Email: ${email.subject}
Chain Type: ${chainContext.chainType}
Chain Completeness: ${chainContext.completenessScore}%
Current Analysis: ${JSON.stringify(phase2Result)}

Provide strategic insights for this COMPLETE workflow chain:
{
  "strategic_priority": "critical/high/medium/low",
  "workflow_impact": "description of impact on business workflow",
  "predicted_next_steps": ["step1", "step2"],
  "bottleneck_risks": ["risk1", "risk2"],
  "optimization_opportunities": ["opportunity1"],
  "completion_likelihood": 0.0 to 1.0
}

Respond ONLY with valid JSON.`;

    try {
      const responseData = await this?.nlpQueue?.enqueue(
        async () => {
          const response = await axios.post(
            "http://localhost:11434/api/generate",
            {
              model: "llama3.2:3b",
              prompt,
              stream: false,
              format: "json", // Force JSON output
              options: {
                temperature: 0.3,
                num_predict: 600,
              },
            },
            {
              timeout: 60000,
            },
          );
          return response?.data?.response;
        },
        "high", // priority - phase 3 strategic analysis is high priority
        60000, // timeout
        `phase3-strategic-${email.id}`, // query for deduplication
        { emailId: email.id, phase: 3, model: "llama3.2:3b", chainId: chainContext.conversationId } // metadata
      );

      const strategic = JSON.parse(responseData);
      this?.stats.jsonSuccessCount++;

      return {
        ...phase2Result,
        priority: strategic.strategic_priority || phase2Result.priority,
        phase3_applied: true,
        quality_score: 9.0,
        processing_time_ms: Date.now() - startTime,
      };
    } catch (error) {
      logger.warn("Phase 3 strategic analysis failed:", error as string);
      this?.stats.jsonFailureCount++;

      return {
        ...phase2Result,
        phase3_applied: false,
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  private async saveAnalysisToEnhancedTable(
    emailId: string,
    result: AnalysisResult,
    chainContext?: ChainContext,
  ): Promise<void> {
    const stmt = this?.db?.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = ?,
        priority = ?,
        confidence_score = ?,
        analyzed_at = ?,
        chain_completeness_score = ?,
        chain_type = ?,
        is_chain_complete = ?,
        extracted_entities = ?,
        key_phrases = ?,
        sentiment_score = ?,
        status = 'analyzed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const sentimentScore =
      result.sentiment === "positive"
        ? 0.5
        : result.sentiment === "negative"
          ? -0.5
          : result.sentiment === "urgent"
            ? -0.3
            : 0;

    stmt.run(
      result.workflow_state,
      result?.priority?.toUpperCase(),
      result.confidence,
      new Date().toISOString(),
      chainContext?.completenessScore || 0,
      chainContext?.chainType || "unknown",
      chainContext?.isComplete ? 1 : 0,
      JSON.stringify(result.entities),
      JSON.stringify(result.key_phrases),
      sentimentScore,
      emailId,
    );

    logger.debug(`Analysis saved for email ${emailId}`);
  }

  // Entity extraction methods
  private extractPONumbers(text: string): string[] {
    const patterns = [
      /\bPO\s*#?\s*(\d{7,12})\b/gi,
      /\bP\.O\.\s*(\d{7,12})\b/gi,
      /\bPurchase\s+Order\s*#?\s*(\d{7,12})\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern: any) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m: any) => results.add(m[1]));
    });

    return Array.from(results);
  }

  private extractQuoteNumbers(text: string): string[] {
    const patterns = [
      /\bquote\s*#?\s*(\d{5,10})\b/gi,
      /\bRFQ\s*#?\s*(\d{5,10})\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern: any) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m: any) => results.add(m[1]));
    });

    return Array.from(results);
  }

  private extractCaseNumbers(text: string): string[] {
    const patterns = [
      /\bcase\s*#?\s*([\w-]{5,20})\b/gi,
      /\bticket\s*#?\s*([\w-]{5,20})\b/gi,
      /\bCAS-\d{6}-\w{6}\b/gi,
    ];

    const results = new Set<string>();
    patterns.forEach((pattern: any) => {
      const matches = [...text.matchAll(pattern)];
      matches.forEach((m: any) => results.add(m[0]));
    });

    return Array.from(results);
  }

  private extractPartNumbers(text: string): string[] {
    const pattern = /\b[A-Z0-9]{5,10}(?:#[A-Z]{3})?\b/g;
    const matches = text.match(pattern) || [];
    return [...new Set(matches)];
  }

  private extractDollarAmounts(text: string): string[] {
    const pattern = /\$[\d,]+(?:\.\d{2})?/g;
    return text.match(pattern) || [];
  }

  private extractEmails(text: string): any[] {
    const pattern = /[\w.-]+@[\w.-]+\.\w+/g;
    const emails = text.match(pattern) || [];
    return emails?.map((email: any) => ({ type: "email", value: email }));
  }

  private extractKeyPhrases(subject: string): string[] {
    return subject
      .split(/\s+/)
      .filter(
        (word: any) =>
          word?.length || 0 > 4 &&
          !["from", "with", "about", "your"].includes(word.toLowerCase()),
      )
      .slice(0, 5);
  }

  private determinePriority(
    subject: string,
    body: string,
    importance?: string,
  ): string {
    const text = (subject + " " + body).toLowerCase();

    if (
      importance === "high" ||
      text.includes("urgent") ||
      text.includes("asap")
    ) {
      return "high";
    } else if (text.includes("critical") || text.includes("escalation")) {
      return "critical";
    } else if (text.includes("fyi") || text.includes("no rush")) {
      return "low";
    }

    return "medium";
  }

  private determineWorkflowState(subject: string, body: string): string {
    const text = (subject + " " + body).toLowerCase();

    if (
      text.includes("complete") ||
      text.includes("resolved") ||
      text.includes("closed")
    ) {
      return "completed";
    } else if (
      text.includes("blocked") ||
      text.includes("waiting") ||
      text.includes("hold")
    ) {
      return "blocked";
    } else if (text.includes("in progress") || text.includes("working on")) {
      return "in_progress";
    }

    return "pending";
  }

  getStats() {
    return {
      ...this.stats,
      jsonSuccessRate:
        this?.stats.jsonSuccessCount /
          (this?.stats.jsonSuccessCount + this?.stats.jsonFailureCount) || 0,
    };
  }

  async shutdown() {
    this?.db?.close();
    logger.info("EmailThreePhaseAnalysisServiceFixed shutdown complete");
  }
}
