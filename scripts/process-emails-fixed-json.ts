#!/usr/bin/env tsx

/**
 * Fixed Email Processing with Proper JSON and Three-Phase Analysis
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Ollama } from "ollama";
import { Logger } from "../src/utils/logger.js";
import { createHash } from "crypto";

const logger = new Logger("EmailProcessorFixed");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const ANALYSIS_DB_PATH = "./data/crewai.db";

interface EmailData {
  id: string;
  subject: string;
  body: string;
  sender_email: string;
  received_at: string;
  importance: string;
  has_attachments: number;
}

interface ChainAnalysis {
  isComplete: boolean;
  completenessScore: number;
  chainType: string;
  missingElements: string[];
}

interface AnalysisResult {
  workflow_state: string;
  priority: string;
  confidence: number;
  entities: any[];
  action_items: any[];
  sentiment: string;
  key_phrases: string[];
  business_process: string;
}

class FixedEmailProcessor {
  private enhancedDb: Database.Database;
  private analysisDb: Database.Database;
  private ollama: Ollama;
  private stats = {
    total: 0,
    processed: 0,
    completeChains: 0,
    incompleteChains: 0,
    phase3Count: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.enhancedDb = new Database(ENHANCED_DB_PATH, { readonly: true });
    this.analysisDb = new Database(ANALYSIS_DB_PATH);
    this.ollama = new Ollama({ host: "http://localhost:11434" });
    this.ensureAnalysisTable();
  }

  private ensureAnalysisTable() {
    // Create analysis results table if it doesn't exist
    this.analysisDb.exec(`
      CREATE TABLE IF NOT EXISTS email_analysis (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        subject TEXT,
        workflow_state TEXT,
        priority TEXT,
        confidence REAL,
        chain_complete INTEGER,
        chain_score REAL,
        chain_type TEXT,
        entities TEXT,
        action_items TEXT,
        key_phrases TEXT,
        sentiment TEXT,
        business_process TEXT,
        phase3_applied INTEGER,
        quality_score REAL,
        processing_time_ms INTEGER,
        analyzed_at TEXT
      )
    `);
  }

  async processConversations(): Promise<void> {
    console.log(
      chalk.cyan("\n🚀 Fixed Email Processing with Three-Phase Analysis\n"),
    );

    // Get multi-email conversations
    const conversations = this.enhancedDb
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject,
        ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours
      FROM emails_enhanced
      GROUP BY conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
      LIMIT 50
    `,
      )
      .all() as any[];

    this.stats.total = conversations.length;
    console.log(`Processing top ${conversations.length} conversations...\n`);

    for (const conv of conversations) {
      await this.processConversation(conv);
    }

    this.displayFinalStats();
    this.cleanup();
  }

  private async processConversation(conv: any): Promise<void> {
    try {
      console.log(
        chalk.gray(
          `\n[${this.stats.processed + 1}/${this.stats.total}] Processing ${conv.conversation_id}`,
        ),
      );
      console.log(
        `  Emails: ${conv.email_count} | Duration: ${conv.duration_hours}h`,
      );

      // Get emails in conversation
      const emails = this.enhancedDb
        .prepare(
          `
        SELECT 
          id, subject, body_content as body, sender_email,
          received_date_time as received_at, importance, has_attachments
        FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id) as EmailData[];

      // Phase 1: Rule-based chain analysis
      const chainAnalysis = this.analyzeChainCompleteness(emails);
      console.log(
        `  ${chainAnalysis.isComplete ? chalk.green("✓") : chalk.yellow("⚡")} Chain: ${chainAnalysis.completenessScore}% - Type: ${chainAnalysis.chainType}`,
      );

      // Process first 3 emails as sample
      const samplesToProcess = Math.min(3, emails.length);
      for (let i = 0; i < samplesToProcess; i++) {
        const email = emails[i];
        const startTime = Date.now();

        // Phase 1: Rule-based analysis
        const phase1Result = this.phase1Analysis(email);

        // Phase 2: LLM Enhancement
        const phase2Result = await this.phase2Analysis(email, phase1Result);

        // Phase 3: Strategic Analysis (only for complete chains)
        let finalResult = phase2Result;
        if (chainAnalysis.isComplete && chainAnalysis.completenessScore >= 70) {
          finalResult = await this.phase3Analysis(email, phase2Result, emails);
          this.stats.phase3Count++;
        }

        const processingTime = Date.now() - startTime;

        // Save results
        this.saveAnalysisResult(email, finalResult, {
          conversationId: conv.conversation_id,
          chainAnalysis,
          processingTime,
          phase3Applied: chainAnalysis.isComplete,
        });

        console.log(
          chalk.dim(
            `    ✓ Email ${i + 1}: ${email.subject.substring(0, 40)}... (${processingTime}ms)`,
          ),
        );
      }

      if (chainAnalysis.isComplete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processed++;
    } catch (error: any) {
      console.error(chalk.red(`  ❌ Error: ${error.message}`));
      this.stats.errors++;
      this.stats.processed++;
    }
  }

  private analyzeChainCompleteness(emails: EmailData[]): ChainAnalysis {
    const subjects = emails.map((e) => e.subject.toLowerCase());
    const bodies = emails.map((e) => (e.body || "").toLowerCase());

    // Check for workflow indicators
    const hasStart = subjects.some(
      (s) =>
        s.includes("request") ||
        s.includes("inquiry") ||
        s.includes("quote") ||
        s.includes("need") ||
        s.includes("looking for"),
    );

    const hasMiddle = subjects.some(
      (s) =>
        s.includes("re:") ||
        s.includes("fw:") ||
        s.includes("update") ||
        s.includes("follow"),
    );

    const hasEnd = subjects.some(
      (s) =>
        s.includes("complete") ||
        s.includes("closed") ||
        s.includes("resolved") ||
        s.includes("thank you") ||
        s.includes("delivered") ||
        s.includes("received"),
    );

    // Determine chain type
    let chainType = "unknown";
    if (subjects.some((s) => s.includes("quote"))) chainType = "quote_request";
    else if (subjects.some((s) => s.includes("order") || s.includes("po")))
      chainType = "order_processing";
    else if (subjects.some((s) => s.includes("support") || s.includes("issue")))
      chainType = "support_ticket";
    else if (
      subjects.some((s) => s.includes("meeting") || s.includes("schedule"))
    )
      chainType = "scheduling";

    // Calculate score
    let score = 0;
    if (hasStart) score += 35;
    if (hasMiddle) score += 30;
    if (hasEnd) score += 35;

    // Bonus for clear workflow progression
    if (emails.length >= 3) score += 10;
    if (emails.length >= 5) score += 10;

    const missingElements = [];
    if (!hasStart) missingElements.push("Initial request");
    if (!hasMiddle) missingElements.push("Progress updates");
    if (!hasEnd) missingElements.push("Resolution confirmation");

    return {
      isComplete: score >= 70,
      completenessScore: Math.min(100, score),
      chainType,
      missingElements,
    };
  }

  private phase1Analysis(email: EmailData): AnalysisResult {
    // Simple rule-based analysis
    const priority =
      email.importance === "high" ||
      email.subject.toLowerCase().includes("urgent")
        ? "high"
        : "medium";

    const entities = [];
    // Extract email addresses as entities
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    const foundEmails = email.body.match(emailRegex) || [];
    foundEmails.forEach((e) => entities.push({ type: "email", value: e }));

    return {
      workflow_state: "pending",
      priority,
      confidence: 0.6,
      entities,
      action_items: [],
      sentiment: "neutral",
      key_phrases: email.subject.split(" ").filter((w) => w.length > 4),
      business_process: "email_correspondence",
    };
  }

  private async phase2Analysis(
    email: EmailData,
    phase1Result: AnalysisResult,
  ): Promise<AnalysisResult> {
    try {
      const prompt = `Analyze this email and enhance the analysis with specific business insights.

Email:
Subject: ${email.subject}
From: ${email.sender_email}
Body: ${email.body.substring(0, 500)}...

Current Analysis:
- Priority: ${phase1Result.priority}
- Workflow State: ${phase1Result.workflow_state}

Enhance this analysis by providing:
1. workflow_state: "pending", "in_progress", "completed", or "blocked"
2. refined_priority: "high", "medium", or "low" based on content urgency
3. key_entities: Important names, companies, products mentioned
4. action_items: Specific tasks that need to be done
5. business_process: Type of business workflow (quote_request, order_processing, support_ticket, etc.)

Respond in JSON format.`;

      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json", // Force JSON output
        options: {
          temperature: 0.3,
          max_tokens: 300,
        },
      });

      // Parse and merge with phase1
      const enhancement = JSON.parse(response.response);

      return {
        ...phase1Result,
        workflow_state:
          enhancement.workflow_state || phase1Result.workflow_state,
        priority: enhancement.refined_priority || phase1Result.priority,
        confidence: 0.75,
        entities: [
          ...phase1Result.entities,
          ...(enhancement.key_entities || []),
        ],
        action_items: enhancement.action_items || [],
        business_process:
          enhancement.business_process || phase1Result.business_process,
      };
    } catch (error) {
      logger.warn("Phase 2 enhancement failed, using phase 1 results");
      return phase1Result;
    }
  }

  private async phase3Analysis(
    email: EmailData,
    phase2Result: AnalysisResult,
    allEmails: EmailData[],
  ): Promise<AnalysisResult> {
    try {
      // For complete chains, do strategic analysis
      const conversationSummary = allEmails
        .slice(0, 5)
        .map((e) => `${e.sender_email}: ${e.subject}`)
        .join("\n");

      const prompt = `Perform strategic analysis of this email within its complete conversation context.

Email being analyzed:
Subject: ${email.subject}
From: ${email.sender_email}

Conversation Context:
${conversationSummary}

Provide strategic insights:
1. workflow_impact: How this email advances the business workflow
2. strategic_priority: Adjusted priority based on full context
3. next_steps: Recommended actions based on conversation flow
4. completion_indicators: Signs that this workflow is nearing completion

Respond in JSON format.`;

      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json", // Force JSON output for Phase 3
        options: {
          temperature: 0.4,
          max_tokens: 400,
        },
      });

      const strategic = JSON.parse(response.response);

      return {
        ...phase2Result,
        confidence: 0.9,
        workflow_state: strategic.completion_indicators?.includes("complete")
          ? "completed"
          : phase2Result.workflow_state,
        priority: strategic.strategic_priority || phase2Result.priority,
        action_items: [
          ...phase2Result.action_items,
          ...(strategic.next_steps || []),
        ],
      };
    } catch (error) {
      logger.warn("Phase 3 strategic analysis failed, using phase 2 results");
      return phase2Result;
    }
  }

  private saveAnalysisResult(
    email: EmailData,
    result: AnalysisResult,
    metadata: any,
  ): void {
    const stmt = this.analysisDb.prepare(`
      INSERT OR REPLACE INTO email_analysis (
        id, conversation_id, subject, workflow_state, priority,
        confidence, chain_complete, chain_score, chain_type,
        entities, action_items, key_phrases, sentiment,
        business_process, phase3_applied, quality_score,
        processing_time_ms, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      email.id,
      metadata.conversationId,
      email.subject,
      result.workflow_state,
      result.priority,
      result.confidence,
      metadata.chainAnalysis.isComplete ? 1 : 0,
      metadata.chainAnalysis.completenessScore,
      metadata.chainAnalysis.chainType,
      JSON.stringify(result.entities),
      JSON.stringify(result.action_items),
      JSON.stringify(result.key_phrases),
      result.sentiment,
      result.business_process,
      metadata.phase3Applied ? 1 : 0,
      result.confidence * 10, // Convert to 0-10 scale
      metadata.processingTime,
      new Date().toISOString(),
    );
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000;

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(`  Total conversations: ${this.stats.total}`);
    console.log(`  Processed: ${this.stats.processed}`);
    console.log(
      `  Complete chains: ${this.stats.completeChains} (Phase 3 applied)`,
    );
    console.log(
      `  Incomplete chains: ${this.stats.incompleteChains} (Phase 1+2 only)`,
    );
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Total time: ${totalTime.toFixed(1)}s`);
    console.log(
      `  Avg time per conversation: ${(totalTime / this.stats.processed).toFixed(1)}s`,
    );

    // Show sample results
    const samples = this.analysisDb
      .prepare(
        `
      SELECT subject, workflow_state, priority, chain_type, quality_score
      FROM email_analysis
      ORDER BY analyzed_at DESC
      LIMIT 5
    `,
      )
      .all() as any[];

    console.log(chalk.cyan("\n📊 Sample Results:"));
    samples.forEach((s) => {
      console.log(`  ${s.subject.substring(0, 50)}...`);
      console.log(
        `    State: ${s.workflow_state} | Priority: ${s.priority} | Type: ${s.chain_type} | Quality: ${s.quality_score}/10`,
      );
    });
  }

  private cleanup(): void {
    this.enhancedDb.close();
    this.analysisDb.close();
  }
}

// Run the processor
async function main() {
  const processor = new FixedEmailProcessor();
  await processor.processConversations();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
