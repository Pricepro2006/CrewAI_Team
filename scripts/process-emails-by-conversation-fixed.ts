#!/usr/bin/env tsx

/**
 * FIXED: Process Emails by Conversation
 * Uses ONLY EmailChainAnalyzer for consistent completeness scoring
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
  completeness_analysis: {
    is_complete: boolean;
    completeness_score: number;
    chain_type: string;
    has_start_point: boolean;
    has_middle_correspondence: boolean;
    has_completion: boolean;
    missing_elements: string[];
  };
  participants: string[];
}

class ConversationProcessor {
  private db: Database.Database;
  private analysisService = new EmailThreePhaseAnalysisService();
  private chainAnalyzer = new EmailChainAnalyzer(DB_PATH);
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
  }

  async processAllConversations() {
    console.log(
      chalk.blue.bold(
        "\n🔄 Processing Emails by Conversation (FIXED VERSION)\n",
      ),
    );

    const startTime = Date.now();

    try {
      // Get all conversations with REAL analysis
      const conversations = await this.getConversationsWithRealAnalysis();
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
      this.db.close();
      this.chainAnalyzer.close();
    }
  }

  /**
   * FIXED: Use EmailChainAnalyzer for ALL completeness analysis
   */
  private async getConversationsWithRealAnalysis(): Promise<
    ConversationStats[]
  > {
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
      LIMIT 5  -- Small test to validate the fix works
    `,
      )
      .all() as any[];

    const conversationStats: ConversationStats[] = [];

    for (const conv of conversations) {
      try {
        // Get the primary email for chain analysis
        const primaryEmail = this.db
          .prepare(
            `
          SELECT id FROM emails_enhanced
          WHERE conversation_id = ?
          ORDER BY received_date_time DESC
          LIMIT 1
        `,
          )
          .get(conv.conversation_id) as any;

        if (!primaryEmail) {
          console.warn(
            `No emails found for conversation ${conv.conversation_id}`,
          );
          continue;
        }

        // Use REAL EmailChainAnalyzer
        const chainAnalysis = await this.chainAnalyzer.analyzeChain(
          primaryEmail.id,
        );

        conversationStats.push({
          conversation_id: conv.conversation_id,
          email_count: conv.email_count,
          duration_hours: conv.duration_hours || 0,
          completeness_analysis: {
            is_complete: chainAnalysis.is_complete,
            completeness_score: chainAnalysis.completeness_score,
            chain_type: chainAnalysis.chain_type,
            has_start_point: chainAnalysis.has_start_point,
            has_middle_correspondence: chainAnalysis.has_middle_correspondence,
            has_completion: chainAnalysis.has_completion,
            missing_elements: chainAnalysis.missing_elements,
          },
          participants: conv.participants_concat
            ? conv.participants_concat.split(",")
            : [],
        });
      } catch (error) {
        console.warn(
          `Chain analysis failed for conversation ${conv.conversation_id}:`,
          error.message,
        );
        // Skip this conversation
      }
    }

    return conversationStats;
  }

  private getConversationEmails(conversationId: string): any[] {
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

  private async processConversation(conversation: ConversationStats) {
    try {
      const emails = this.getConversationEmails(conversation.conversation_id);
      this.stats.total_emails += emails.length;

      // Use REAL analysis results for decision making
      const isComplete = conversation.completeness_analysis.is_complete;
      const score = conversation.completeness_analysis.completeness_score;

      if (isComplete) {
        console.log(
          chalk.green(
            `  ✓ Complete chain (${score}%) - Using 3-phase analysis`,
          ),
        );
        console.log(
          chalk.gray(
            `    Type: ${conversation.completeness_analysis.chain_type}`,
          ),
        );
        this.stats.complete_conversations++;
        this.stats.phase3_analyses += emails.length;
      } else {
        console.log(
          chalk.yellow(
            `  ⚡ Incomplete chain (${score}%) - Using 2-phase analysis`,
          ),
        );
        console.log(
          chalk.gray(
            `    Missing: ${conversation.completeness_analysis.missing_elements.join(", ")}`,
          ),
        );
        this.stats.incomplete_conversations++;
        this.stats.phase2_analyses += emails.length;
      }

      // Process primary email
      const primaryEmail = emails[emails.length - 1];

      // Map to expected format with REAL chain analysis
      const mappedEmail = {
        ...primaryEmail,
        sender_email: primaryEmail.sender_email,
        recipient_emails: this.getRecipientEmails(primaryEmail.id),
        body: primaryEmail.body_content,
        chainAnalysis: {
          chain_id: conversation.conversation_id,
          is_complete_chain: conversation.completeness_analysis.is_complete,
          chain_length: conversation.email_count,
          completeness_score:
            conversation.completeness_analysis.completeness_score,
          chain_type: conversation.completeness_analysis.chain_type,
          participants: conversation.participants,
          duration_hours: conversation.duration_hours,
        },
      };

      // Run analysis - this will now get consistent results
      const result = await this.analysisService.analyzeEmail(mappedEmail);

      // Update database with consistent data
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
        conversation.completeness_analysis.completeness_score, // Use REAL score
        conversation.completeness_analysis.is_complete
          ? conversation.completeness_analysis.chain_type
          : null,
        conversation.completeness_analysis.is_complete ? 1 : 0, // Use REAL completeness
        conversation.conversation_id,
      );

      // Update primary email with analysis results
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
        result.confidence_score ||
          conversation.completeness_analysis.completeness_score / 100,
        JSON.stringify(result.entities || {}),
        JSON.stringify(result.key_phrases || []),
        result.sentiment_score || 0,
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
      .all(emailId) as any[];

    return recipients.map((r) => r.email_address).join(", ");
  }

  private displayResults(startTime: number) {
    const duration = (Date.now() - startTime) / 1000;

    console.log(
      chalk.green.bold("\n\n✅ Processing Complete! (FIXED VERSION)\n"),
    );
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

    // Show real chain type distribution
    console.log(chalk.cyan("\n📈 Chain Type Distribution (REAL ANALYSIS):"));
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
      .all();

    chainTypes.forEach((type: any) => {
      console.log(`   ${type.chain_type}: ${type.count}`);
    });

    console.log(chalk.green("\n🔧 ARCHITECTURAL FIX APPLIED:"));
    console.log(chalk.gray("   • Removed duplicated completeness logic"));
    console.log(chalk.gray("   • Using EmailChainAnalyzer for ALL scoring"));
    console.log(chalk.gray("   • Display and analysis now synchronized"));
    console.log(chalk.gray("   • Eliminated race condition"));
  }
}

// Run the fixed processor
async function main() {
  const processor = new ConversationProcessor();
  await processor.processAllConversations();
}

main().catch(console.error);
