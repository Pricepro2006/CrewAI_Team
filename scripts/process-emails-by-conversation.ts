#!/usr/bin/env tsx

/**
 * Process Emails by Conversation
 * Uses Microsoft's conversationId for chain detection
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

interface ConversationStats {
  conversation_id: string;
  email_count: number;
  duration_hours: number;
  has_start: boolean;
  has_middle: boolean;
  has_completion: boolean;
  completeness_score: number;
  chain_type: string;
  missing_elements: string[];
  participants: string[];
}

interface DatabaseConversation {
  conversation_id: string;
  email_count: number;
  duration_hours: number;
  start_time: string;
  end_time: string;
  participants_concat: string;
}

interface DatabaseEmail {
  id: string;
  conversation_id: string;
  sender_email: string;
  body_content: string;
  received_date_time: string;
  [key: string]: unknown;
}

interface DatabaseRecipient {
  email_address: string;
}

interface DatabaseChainType {
  chain_type: string;
  count: number;
}

interface DatabaseScoreDistribution {
  chain_completeness_score: number;
  count: number;
}

class ConversationProcessor {
  private db: Database.Database;
  private analysisService = new EmailThreePhaseAnalysisService(DB_PATH);
  private chainAnalyzer: EmailChainAnalyzer;
  private stats = {
    total_conversations: 0,
    complete_conversations: 0,
    incomplete_conversations: 0,
    total_emails: 0,
    phase3_analyses: 0,
    phase2_analyses: 0,
    errors: 0,
  };

  constructor() {
    this.db = new Database(DB_PATH);
    this.chainAnalyzer = new EmailChainAnalyzer(DB_PATH);
  }

  async processAllConversations() {
    console.log(chalk.blue.bold("\n🔄 Processing Emails by Conversation\n"));

    const startTime = Date.now();

    try {
      // Get all conversations
      const conversations = await this.getConversations();
      this.stats.total_conversations = conversations.length;

      console.log(
        chalk.cyan(`Found ${conversations.length} conversations to process\n`),
      );

      // Process each conversation
      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];
        console.log(
          chalk.yellow(
            `\n[${i + 1}/${conversations.length}] Processing conversation ${conversation.conversation_id}`,
          ),
        );
        console.log(
          chalk.gray(
            `  Emails: ${conversation.email_count} | Duration: ${conversation.duration_hours.toFixed(1)}h`,
          ),
        );

        await this.processConversation(conversation);

        // Progress update
        if ((i + 1) % 10 === 0) {
          const progress = (((i + 1) / conversations.length) * 100).toFixed(1);
          console.log(
            chalk.green(
              `\n✅ Progress: ${progress}% | Complete: ${this.stats.complete_conversations} | Incomplete: ${this.stats.incomplete_conversations}`,
            ),
          );
        }
      }

      this.displayResults(startTime);
    } catch (error) {
      console.error(chalk.red("Fatal error:"), error);
      throw error;
    } finally {
      // Don't close db here since displayResults needs it
      this.chainAnalyzer.close();
    }
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }

  private async getConversations(): Promise<ConversationStats[]> {
    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        CAST((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24 AS REAL) as duration_hours,
        MIN(received_date_time) as start_time,
        MAX(received_date_time) as end_time,
        GROUP_CONCAT(DISTINCT sender_email) as participants_concat
      FROM emails_enhanced
      WHERE conversation_id IS NOT NULL
      GROUP BY conversation_id
      ORDER BY email_count DESC
      LIMIT 50  -- Small test to validate the fix works
    `,
      )
      .all() as DatabaseConversation[];

    // Process conversations with proper async handling
    const processedConversations = [];

    for (const conv of conversations) {
      const analysis = await this.analyzeConversationCompleteness(
        conv.conversation_id,
      );

      processedConversations.push({
        conversation_id: conv.conversation_id,
        email_count: conv.email_count,
        duration_hours: conv.duration_hours || 0,
        has_start: analysis.has_start,
        has_middle: analysis.has_middle,
        has_completion: analysis.has_completion,
        completeness_score: analysis.completeness_score,
        chain_type: analysis.chain_type,
        missing_elements: analysis.missing_elements,
        participants: conv.participants_concat
          ? conv.participants_concat.split(",")
          : [],
      });
    }

    return processedConversations;
  }

  private getConversationEmails(conversationId: string): DatabaseEmail[] {
    return this.db
      .prepare(
        `
      SELECT * FROM emails_enhanced
      WHERE conversation_id = ?
      ORDER BY received_date_time ASC
    `,
      )
      .all(conversationId);
  }

  /**
   * FIXED: Use EmailChainAnalyzer for consistent completeness analysis
   */
  private async analyzeConversationCompleteness(
    conversationId: string,
  ): Promise<{
    has_start: boolean;
    has_middle: boolean;
    has_completion: boolean;
    completeness_score: number;
    chain_type: string;
    missing_elements: string[];
  }> {
    try {
      // Get primary email for this conversation
      const primaryEmail = this.db
        .prepare(
          `
        SELECT id FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time DESC
        LIMIT 1
      `,
        )
        .get(conversationId) as DatabaseEmail | undefined;

      if (!primaryEmail) {
        return {
          has_start: false,
          has_middle: false,
          has_completion: false,
          completeness_score: 0,
          chain_type: "unknown",
          missing_elements: ["No emails found"],
        };
      }

      // Use REAL EmailChainAnalyzer
      const analysis = await this.chainAnalyzer.analyzeChain(primaryEmail.id);

      return {
        has_start: analysis.has_start_point,
        has_middle: analysis.has_middle_correspondence,
        has_completion: analysis.has_completion,
        completeness_score: analysis.completeness_score,
        chain_type: analysis.chain_type,
        missing_elements: analysis.missing_elements,
      };
    } catch (error) {
      console.warn(
        `Chain analysis failed for conversation ${conversationId}:`,
        error.message,
      );
      return {
        has_start: false,
        has_middle: false,
        has_completion: false,
        completeness_score: 0,
        chain_type: "unknown",
        missing_elements: ["Analysis failed"],
      };
    }
  }

  private async processConversation(conversation: ConversationStats) {
    try {
      const emails = this.getConversationEmails(conversation.conversation_id);
      this.stats.total_emails += emails.length;

      // Determine if we should use full analysis
      const useFullAnalysis = conversation.completeness_score >= 70;

      if (useFullAnalysis) {
        console.log(
          chalk.green(
            `  ✓ Complete chain (${conversation.completeness_score}%) - Using 3-phase analysis`,
          ),
        );
        console.log(
          chalk.gray(
            `    Type: ${conversation.chain_type} | Missing: ${conversation.missing_elements.length > 0 ? conversation.missing_elements.join(", ") : "None"}`,
          ),
        );
        this.stats.complete_conversations++;
        this.stats.phase3_analyses += emails.length;
      } else {
        console.log(
          chalk.yellow(
            `  ⚡ Incomplete chain (${conversation.completeness_score}%) - Using 2-phase analysis`,
          ),
        );
        console.log(
          chalk.gray(
            `    Missing: ${conversation.missing_elements.join(", ")}`,
          ),
        );
        this.stats.incomplete_conversations++;
        this.stats.phase2_analyses += emails.length;
      }

      // Process primary email (most recent) through analysis pipeline
      const primaryEmail = emails[emails.length - 1];

      // Map to expected format
      const mappedEmail = {
        id: primaryEmail.id,
        subject: (primaryEmail as any).subject || "No Subject",
        body: primaryEmail.body_content,
        sender_email: primaryEmail.sender_email,
        recipient_emails: this.getRecipientEmails(primaryEmail.id),
        received_at: primaryEmail.received_date_time,
        has_attachments: (primaryEmail as any).has_attachments || false,
        chainAnalysis: {
          chain_id: conversation.conversation_id,
          is_complete: conversation.completeness_score >= 70,
          chain_length: conversation.email_count,
          completeness_score: conversation.completeness_score,
          chain_type: conversation.chain_type,
          participants: conversation.participants,
          duration_hours: conversation.duration_hours,
        },
      };

      // Run analysis
      const result = await this.analysisService.analyzeEmail(mappedEmail);

      // Update all emails in conversation
      const updateStmt = this.db.prepare(`
        UPDATE emails_enhanced SET
          status = 'analyzed',
          workflow_state = ?,
          chain_id = ?,
          chain_completeness_score = ?,
          chain_type = ?,
          is_chain_complete = ?,
          analyzed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE conversation_id = ?
      `);

      updateStmt.run(
        result.workflow_state || "ANALYZED",
        conversation.conversation_id,
        conversation.completeness_score,
        conversation.completeness_score >= 70 ? conversation.chain_type : null, // Only assign type to complete chains
        conversation.completeness_score >= 70 ? 1 : 0,
        conversation.conversation_id,
      );

      // Update primary email with full analysis results
      const updatePrimaryStmt = this.db.prepare(`
        UPDATE emails_enhanced SET
          priority = ?,
          confidence_score = ?,
          extracted_entities = ?,
          key_phrases = ?,
          sentiment_score = ?
        WHERE id = ?
      `);

      updatePrimaryStmt.run(
        result.priority || "normal",
        result.confidence || conversation.completeness_score / 100,
        JSON.stringify(result.entities || {}),
        JSON.stringify(result.key_phrases || []),
        0, // sentiment_score placeholder
        primaryEmail.id,
      );
    } catch (error) {
      console.error(
        chalk.red(`  ✗ Error processing conversation:`),
        error.message,
      );
      this.stats.errors++;
    }
  }

  private getRecipientEmails(emailId: string): string {
    const recipients = this.db
      .prepare(
        `
      SELECT email_address FROM email_recipients
      WHERE email_id = ? AND recipient_type = 'to'
    `,
      )
      .all(emailId) as DatabaseRecipient[];

    return recipients.map((r) => r.email_address).join(", ");
  }

  private displayResults(startTime: number) {
    const duration = (Date.now() - startTime) / 1000;

    console.log(chalk.green.bold("\n\n✅ Processing Complete!\n"));
    console.log(chalk.white("📊 Results:"));
    console.log(
      chalk.white(
        `   • Total conversations: ${this.stats.total_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Complete conversations: ${this.stats.complete_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Incomplete conversations: ${this.stats.incomplete_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Total emails processed: ${this.stats.total_emails.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • 3-phase analyses: ${this.stats.phase3_analyses.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • 2-phase analyses: ${this.stats.phase2_analyses.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(`   • Errors: ${this.stats.errors.toLocaleString()}`),
    );
    console.log(chalk.white(`   • Processing time: ${duration.toFixed(1)}s`));
    console.log(
      chalk.white(
        `   • Avg time per conversation: ${(duration / this.stats.total_conversations).toFixed(2)}s`,
      ),
    );

    // CRITICAL: Validate scoring distribution to prevent binary pathology
    this.validateScoringDistribution();

    // Show chain type distribution
    console.log(chalk.cyan("\n📈 Chain Type Distribution:"));
    const chainTypes = this.db
      .prepare(
        `
      SELECT chain_type, COUNT(DISTINCT conversation_id) as count
      FROM emails_enhanced
      WHERE chain_type IS NOT NULL
      GROUP BY chain_type
      ORDER BY count DESC
    `,
      )
      .all() as DatabaseChainType[];

    chainTypes.forEach((type: DatabaseChainType) => {
      console.log(`   ${type.chain_type}: ${type.count}`);
    });
  }

  private validateScoringDistribution() {
    console.log(
      chalk.yellow("\n🔍 Validating Scoring Distribution (Critical Check):"),
    );

    const scoreDistribution = this.db
      .prepare(
        `
      SELECT 
        chain_completeness_score,
        COUNT(*) as count
      FROM emails_enhanced
      WHERE chain_completeness_score IS NOT NULL
      GROUP BY chain_completeness_score
      ORDER BY chain_completeness_score
    `,
      )
      .all() as DatabaseScoreDistribution[];

    // Check for binary pathology (50% at 0%, 50% at 100%)
    const scoreMap = new Map<number, number>();
    let totalConversations = 0;

    scoreDistribution.forEach((row) => {
      scoreMap.set(row.chain_completeness_score, row.count);
      totalConversations += row.count;
    });

    const zeroPercent = scoreMap.get(0) || 0;
    const hundredPercent = scoreMap.get(100) || 0;
    const intermediateScores = scoreDistribution.filter(
      (row) =>
        row.chain_completeness_score > 0 && row.chain_completeness_score < 100,
    ).length;

    console.log(
      chalk.white(
        `   • 0% scores: ${zeroPercent} (${((zeroPercent / totalConversations) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `   • 100% scores: ${hundredPercent} (${((hundredPercent / totalConversations) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `   • Intermediate scores (1-99%): ${intermediateScores} unique values`,
      ),
    );

    // CRITICAL VALIDATION: Flag binary pathology
    const binaryPercentage =
      (zeroPercent + hundredPercent) / totalConversations;

    if (binaryPercentage > 0.8) {
      // More than 80% binary scores
      console.log(
        chalk.red.bold("\n🚨 CRITICAL: Binary scoring pathology detected!"),
      );
      console.log(
        chalk.red(
          `   ${(binaryPercentage * 100).toFixed(1)}% of scores are exactly 0% or 100%`,
        ),
      );
      console.log(
        chalk.red(
          "   This indicates the scoring algorithm is not working properly.",
        ),
      );
    } else if (intermediateScores < 5) {
      console.log(
        chalk.yellow.bold(
          "\n⚠️ WARNING: Very few intermediate scores detected",
        ),
      );
      console.log(
        chalk.yellow(
          `   Only ${intermediateScores} unique intermediate scores found`,
        ),
      );
      console.log(
        chalk.yellow(
          "   Consider reviewing the scoring algorithm for more granularity",
        ),
      );
    } else {
      console.log(
        chalk.green.bold("\n✅ PASS: Healthy scoring distribution detected"),
      );
      console.log(
        chalk.green(`   ${intermediateScores} intermediate score values found`),
      );
      console.log(
        chalk.green(
          `   Binary scores: ${(binaryPercentage * 100).toFixed(1)}% (acceptable)`,
        ),
      );
    }

    // Show sample of score distribution
    console.log(chalk.cyan("\n📊 Score Distribution Sample:"));
    const sampleScores = scoreDistribution.slice(0, 10);
    sampleScores.forEach((row) => {
      console.log(
        `   ${row.chain_completeness_score}%: ${row.count} conversations`,
      );
    });

    if (scoreDistribution.length > 10) {
      console.log(
        `   ... and ${scoreDistribution.length - 10} more score values`,
      );
    }
  }
}

// Run the processor
async function main() {
  const processor = new ConversationProcessor();
  try {
    await processor.processAllConversations();
  } finally {
    processor.close();
  }
}

main().catch(console.error);
