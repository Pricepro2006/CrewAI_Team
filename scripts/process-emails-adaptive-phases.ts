#!/usr/bin/env tsx

/**
 * Adaptive Three-Phase Email Processing
 * Processes emails with adaptive analysis based on chain completeness
 */

import Database from "better-sqlite3";
import chalk from "chalk";
import { Ollama } from "ollama";
import { Logger } from "../src/utils/logger.js";

const logger = new Logger("AdaptiveEmailProcessor");

const ENHANCED_DB_PATH = "./data/crewai_enhanced.db";
const BATCH_SIZE = 100; // Process 100 conversations at a time

interface EmailRecord {
  id: string;
  subject: string;
  body_content: string;
  sender_email: string;
  received_date_time: string;
  conversation_id: string;
  importance?: string;
  has_attachments?: number;
}

interface ChainAnalysis {
  isComplete: boolean;
  score: number;
  type: string;
  missingElements: string[];
}

interface ProcessingStats {
  totalConversations: number;
  processedConversations: number;
  totalEmails: number;
  processedEmails: number;
  completeChains: number;
  incompleteChains: number;
  phase3Count: number;
  errors: number;
  startTime: number;
}

class AdaptiveEmailProcessor {
  private db: Database.Database;
  private ollama: Ollama;
  private stats: ProcessingStats = {
    totalConversations: 0,
    processedConversations: 0,
    totalEmails: 0,
    processedEmails: 0,
    completeChains: 0,
    incompleteChains: 0,
    phase3Count: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    this.db = new Database(ENHANCED_DB_PATH);
    this.ollama = new Ollama({ host: "http://localhost:11434" });
  }

  async processEmails(): Promise<void> {
    console.log(chalk.cyan("\n🚀 Adaptive Three-Phase Email Processing\n"));
    console.log(chalk.yellow("Processing emails with chain-aware analysis\n"));

    // Get conversations to process
    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        MIN(subject) as first_subject,
        ROUND((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24, 1) as duration_hours
      FROM emails_enhanced
      WHERE status = 'pending' OR status IS NULL OR status = ''
      GROUP BY conversation_id
      HAVING email_count > 1
      ORDER BY email_count DESC
      LIMIT ?
    `,
      )
      .all(BATCH_SIZE) as any[];

    this.stats.totalConversations = conversations.length;

    // Count total emails
    const emailCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM emails_enhanced 
      WHERE conversation_id IN (${conversations.map(() => "?").join(",")})
    `,
      )
      .get(...conversations.map((c) => c.conversation_id)) as any;
    this.stats.totalEmails = emailCount.count;

    console.log(
      chalk.bold(
        `📊 Processing ${conversations.length} conversations with ${this.stats.totalEmails} emails\n`,
      ),
    );

    // Process each conversation
    for (const conv of conversations) {
      await this.processConversation(conv);

      // Display progress every 10 conversations
      if (this.stats.processedConversations % 10 === 0) {
        this.displayProgress();
      }
    }

    this.displayFinalStats();
    this.db.close();
  }

  private async processConversation(conv: any): Promise<void> {
    try {
      console.log(
        chalk.gray(
          `\n[${this.stats.processedConversations + 1}/${this.stats.totalConversations}] ${conv.conversation_id}`,
        ),
      );
      console.log(
        `  📊 ${conv.email_count} emails | ${conv.duration_hours}h duration`,
      );

      // Get all emails in conversation
      const emails = this.db
        .prepare(
          `
        SELECT * FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time
      `,
        )
        .all(conv.conversation_id) as EmailRecord[];

      // Analyze chain completeness
      const chainAnalysis = this.analyzeChainCompleteness(emails);
      console.log(
        `  ${chainAnalysis.isComplete ? chalk.green("✓") : chalk.yellow("⚡")} Chain: ${chainAnalysis.score}% - ${chainAnalysis.type}`,
      );

      // Process first 3 emails as sample
      const samplesToProcess = Math.min(3, emails.length);

      for (let i = 0; i < samplesToProcess; i++) {
        const email = emails[i];
        const startTime = Date.now();

        try {
          // Run adaptive analysis
          const result = await this.runAdaptiveAnalysis(
            email,
            chainAnalysis,
            emails,
          );

          // Update email record
          this.updateEmailRecord(email.id, result, chainAnalysis);

          const processingTime = Date.now() - startTime;
          console.log(
            chalk.green(
              `    ✓ Email ${i + 1}: ${processingTime}ms (${result.phases} phases)`,
            ),
          );

          this.stats.processedEmails++;
          if (result.phases === 3) {
            this.stats.phase3Count++;
          }
        } catch (error: any) {
          console.error(chalk.red(`    ❌ Email ${i + 1}: ${error.message}`));
          this.stats.errors++;
        }
      }

      // Update chain stats
      if (chainAnalysis.isComplete) {
        this.stats.completeChains++;
      } else {
        this.stats.incompleteChains++;
      }

      this.stats.processedConversations++;
    } catch (error: any) {
      console.error(chalk.red(`  ❌ Conversation error: ${error.message}`));
      this.stats.errors++;
      this.stats.processedConversations++;
    }
  }

  private analyzeChainCompleteness(emails: EmailRecord[]): ChainAnalysis {
    const subjects = emails.map((e) => e.subject.toLowerCase());
    const bodies = emails.map((e) => (e.body_content || "").toLowerCase());

    let score = 0;
    let type = "unknown";
    const missingElements: string[] = [];

    // Detect chain type
    const allText = [...subjects, ...bodies].join(" ");
    if (
      allText.includes("quote") &&
      (allText.includes("request") || allText.includes("pricing"))
    ) {
      type = "quote_request";
    } else if (
      allText.includes("order") ||
      allText.includes("po ") ||
      allText.includes("purchase")
    ) {
      type = "order_processing";
    } else if (
      allText.includes("support") ||
      allText.includes("issue") ||
      allText.includes("problem")
    ) {
      type = "support_ticket";
    } else if (allText.includes("meeting") || allText.includes("schedule")) {
      type = "scheduling";
    }

    // Check for workflow stages
    const hasStart = subjects.some(
      (s) =>
        s.includes("request") ||
        s.includes("inquiry") ||
        s.includes("quote") ||
        s.includes("need") ||
        s.includes("looking for"),
    );
    if (!hasStart) missingElements.push("Initial request");

    const hasMiddle = subjects.some(
      (s) =>
        s.includes("re:") ||
        s.includes("fw:") ||
        s.includes("update") ||
        s.includes("follow"),
    );
    if (!hasMiddle) missingElements.push("Progress updates");

    const hasEnd = subjects.some(
      (s) =>
        s.includes("complete") ||
        s.includes("closed") ||
        s.includes("resolved") ||
        s.includes("thank you") ||
        s.includes("delivered") ||
        s.includes("approved"),
    );
    if (!hasEnd) missingElements.push("Resolution");

    // Calculate score
    if (hasStart) score += 35;
    if (hasMiddle) score += 30;
    if (hasEnd) score += 35;

    // Bonus for length
    if (emails.length >= 3) score += 10;
    if (emails.length >= 5 && hasMiddle) score += 10;

    score = Math.min(100, score);

    return {
      isComplete: score >= 70,
      score,
      type,
      missingElements,
    };
  }

  private async runAdaptiveAnalysis(
    email: EmailRecord,
    chainAnalysis: ChainAnalysis,
    allEmails: EmailRecord[],
  ): Promise<any> {
    // Phase 1: Always run rule-based analysis
    const phase1Result = this.runPhase1Analysis(email);

    // Phase 2: LLM Enhancement
    const phase2Result = await this.runPhase2Analysis(email, phase1Result);

    // Phase 3: Strategic Analysis (only for complete chains)
    if (chainAnalysis.isComplete && chainAnalysis.score >= 70) {
      const phase3Result = await this.runPhase3Analysis(
        email,
        phase2Result,
        allEmails,
      );
      return { ...phase3Result, phases: 3 };
    }

    return { ...phase2Result, phases: 2 };
  }

  private runPhase1Analysis(email: EmailRecord): any {
    // Extract entities
    const entities = {
      po_numbers: this.extractPONumbers(email.body_content || ""),
      quote_numbers: this.extractQuoteNumbers(email.body_content || ""),
      dollar_amounts: this.extractDollarAmounts(email.body_content || ""),
    };

    // Determine priority
    const priority =
      email.importance === "high" ||
      email.subject.toLowerCase().includes("urgent")
        ? "high"
        : "medium";

    return {
      workflow_state: "pending",
      priority,
      entities,
      confidence: 0.6,
    };
  }

  private async runPhase2Analysis(
    email: EmailRecord,
    phase1Result: any,
  ): Promise<any> {
    const prompt = `Analyze this business email and provide insights.

Email:
Subject: ${email.subject}
From: ${email.sender_email}
Body: ${(email.body_content || "").substring(0, 500)}...

Current Analysis:
- Priority: ${phase1Result.priority}
- Entities: ${JSON.stringify(phase1Result.entities)}

Enhance with:
{
  "workflow_state": "pending/in_progress/completed/blocked",
  "priority": "critical/high/medium/low",
  "business_process": "quote_request/order_processing/support/other",
  "action_items": ["specific actions needed"],
  "confidence": 0.0 to 1.0
}`;

    try {
      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.2,
          max_tokens: 400,
        },
      });

      const enhancement = JSON.parse(response.response);

      return {
        ...phase1Result,
        ...enhancement,
        confidence: enhancement.confidence || 0.75,
      };
    } catch (error) {
      logger.warn("Phase 2 failed, using phase 1 results");
      return phase1Result;
    }
  }

  private async runPhase3Analysis(
    email: EmailRecord,
    phase2Result: any,
    allEmails: EmailRecord[],
  ): Promise<any> {
    const conversationSummary = allEmails
      .slice(0, 5)
      .map((e) => `${e.sender_email}: ${e.subject}`)
      .join("\n");

    const prompt = `Strategic analysis for complete email chain.

Current Email: ${email.subject}
Chain Context:
${conversationSummary}

Current Analysis: ${JSON.stringify(phase2Result)}

Provide strategic insights:
{
  "strategic_priority": "critical/high/medium/low",
  "workflow_impact": "impact description",
  "predicted_next_steps": ["next step 1", "next step 2"],
  "completion_likelihood": 0.0 to 1.0
}`;

    try {
      const response = await this.ollama.generate({
        model: "llama3.2:3b",
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.3,
          max_tokens: 300,
        },
      });

      const strategic = JSON.parse(response.response);

      return {
        ...phase2Result,
        priority: strategic.strategic_priority || phase2Result.priority,
        strategic_insights: strategic,
      };
    } catch (error) {
      logger.warn("Phase 3 failed, using phase 2 results");
      return phase2Result;
    }
  }

  private updateEmailRecord(
    emailId: string,
    result: any,
    chainAnalysis: ChainAnalysis,
  ): void {
    const stmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        workflow_state = ?,
        priority = ?,
        confidence_score = ?,
        analyzed_at = ?,
        chain_completeness_score = ?,
        chain_type = ?,
        is_chain_complete = ?,
        extracted_entities = ?,
        status = 'analyzed',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      result.workflow_state || "pending",
      result.priority || "medium",
      result.confidence || 0.5,
      new Date().toISOString(),
      chainAnalysis.score,
      chainAnalysis.type,
      chainAnalysis.isComplete ? 1 : 0,
      JSON.stringify(result.entities || {}),
      emailId,
    );
  }

  private extractPONumbers(text: string): string[] {
    const matches = text.match(/\bPO\s*#?\s*(\d{7,12})\b/gi) || [];
    return matches.map((m) => m.replace(/\D/g, ""));
  }

  private extractQuoteNumbers(text: string): string[] {
    const matches = text.match(/\bquote\s*#?\s*(\d{5,10})\b/gi) || [];
    return matches.map((m) => m.replace(/\D/g, ""));
  }

  private extractDollarAmounts(text: string): string[] {
    return text.match(/\$[\d,]+(?:\.\d{2})?/g) || [];
  }

  private displayProgress(): void {
    const elapsed = (Date.now() - this.stats.startTime) / 1000 / 60;
    const rate = this.stats.processedConversations / elapsed;

    console.log(
      chalk.cyan(
        `\n📊 Progress: ${this.stats.processedConversations}/${this.stats.totalConversations}`,
      ),
    );
    console.log(
      `  Complete chains: ${this.stats.completeChains} | Phase 3: ${this.stats.phase3Count}`,
    );
    console.log(`  Rate: ${rate.toFixed(1)} conv/min`);
  }

  private displayFinalStats(): void {
    const totalTime = (Date.now() - this.stats.startTime) / 1000 / 60;

    console.log(chalk.green("\n\n✅ Processing Complete!\n"));
    console.log(chalk.cyan("📊 Final Statistics:"));
    console.log(
      `  Conversations: ${this.stats.processedConversations}/${this.stats.totalConversations}`,
    );
    console.log(
      `  Emails: ${this.stats.processedEmails}/${this.stats.totalEmails}`,
    );
    console.log(
      `  Complete chains (3-phase): ${this.stats.completeChains} (${((this.stats.completeChains / this.stats.processedConversations) * 100).toFixed(1)}%)`,
    );
    console.log(
      `  Incomplete chains (2-phase): ${this.stats.incompleteChains}`,
    );
    console.log(`  Phase 3 analyses: ${this.stats.phase3Count}`);
    console.log(`  Errors: ${this.stats.errors}`);
    console.log(`  Time: ${totalTime.toFixed(1)} minutes`);
    console.log(
      `  Rate: ${(this.stats.processedEmails / totalTime).toFixed(1)} emails/min`,
    );

    // Show sample results
    const samples = this.db
      .prepare(
        `
      SELECT subject, workflow_state, priority, chain_type, chain_completeness_score
      FROM emails_enhanced
      WHERE analyzed_at IS NOT NULL
      ORDER BY analyzed_at DESC
      LIMIT 5
    `,
      )
      .all() as any[];

    console.log(chalk.cyan("\n📊 Sample Results:"));
    samples.forEach((s) => {
      console.log(`  ${s.subject.substring(0, 50)}...`);
      console.log(
        `    State: ${s.workflow_state} | Priority: ${s.priority} | Type: ${s.chain_type} | Score: ${s.chain_completeness_score}%`,
      );
    });

    console.log(
      chalk.yellow(
        "\n🎉 The fans should be running! Processing emails with proper JSON! 🌪️",
      ),
    );
  }
}

// Run the processor
async function main() {
  const processor = new AdaptiveEmailProcessor();
  await processor.processEmails();
}

main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});
