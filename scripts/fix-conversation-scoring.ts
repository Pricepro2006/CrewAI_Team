#!/usr/bin/env tsx

/**
 * Fix Conversation Scoring - Update database with corrected completeness scores
 * This script fixes the binary pathology by applying the improved scoring algorithm
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

interface ConversationData {
  conversation_id: string;
  email_count: number;
  duration_hours: number;
  emails: any[];
}

class ScoringFixer {
  private db: Database.Database;
  private stats = {
    total_conversations: 0,
    updated_conversations: 0,
    errors: 0,
    scoreDistribution: new Map<number, number>(),
  };

  constructor() {
    this.db = new Database(DB_PATH);
  }

  async fixAllConversations() {
    console.log(
      chalk.blue.bold("\n🔧 Fixing Conversation Completeness Scoring\n"),
    );

    const startTime = Date.now();

    try {
      // Get all conversations
      const conversations = this.getConversations();
      this.stats.total_conversations = conversations.length;

      console.log(
        chalk.cyan(`Found ${conversations.length} conversations to update\n`),
      );

      // Process each conversation
      for (let i = 0; i < conversations.length; i++) {
        const conversation = conversations[i];

        try {
          const analysis = this.calculateFixedCompleteness(conversation.emails);

          // Update database with new scores
          this.updateConversationScores(conversation.conversation_id, analysis);

          this.stats.updated_conversations++;
          this.stats.scoreDistribution.set(
            analysis.completeness_score,
            (this.stats.scoreDistribution.get(analysis.completeness_score) ||
              0) + 1,
          );

          // Progress update
          if ((i + 1) % 1000 === 0) {
            const progress = (((i + 1) / conversations.length) * 100).toFixed(
              1,
            );
            console.log(
              chalk.green(
                `✅ Progress: ${progress}% | Updated: ${this.stats.updated_conversations}`,
              ),
            );
          }
        } catch (error) {
          console.error(
            chalk.red(
              `Error processing conversation ${conversation.conversation_id}:`,
            ),
            error.message,
          );
          this.stats.errors++;
        }
      }

      this.displayResults(startTime);
    } catch (error) {
      console.error(chalk.red("Fatal error:"), error);
      throw error;
    } finally {
      this.db.close();
    }
  }

  private getConversations(): ConversationData[] {
    console.log(chalk.yellow("📊 Loading conversations from database..."));

    const conversations = this.db
      .prepare(
        `
      SELECT 
        conversation_id,
        COUNT(*) as email_count,
        CAST((julianday(MAX(received_date_time)) - julianday(MIN(received_date_time))) * 24 AS REAL) as duration_hours
      FROM emails_enhanced
      WHERE conversation_id IS NOT NULL
      GROUP BY conversation_id
      ORDER BY email_count DESC
    `,
      )
      .all() as any[];

    const conversationData: ConversationData[] = [];

    for (const conv of conversations) {
      const emails = this.db
        .prepare(
          `
        SELECT * FROM emails_enhanced
        WHERE conversation_id = ?
        ORDER BY received_date_time ASC
      `,
        )
        .all(conv.conversation_id);

      conversationData.push({
        conversation_id: conv.conversation_id,
        email_count: conv.email_count,
        duration_hours: conv.duration_hours || 0,
        emails: emails,
      });
    }

    return conversationData;
  }

  private calculateFixedCompleteness(emails: any[]): {
    has_start: boolean;
    has_middle: boolean;
    has_completion: boolean;
    completeness_score: number;
  } {
    if (emails.length === 0) {
      return {
        has_start: false,
        has_middle: false,
        has_completion: false,
        completeness_score: 0,
      };
    }

    // Single email should never score 100% and gets variable scoring based on content
    if (emails.length === 1) {
      const singleEmailContent =
        emails[0].subject + " " + (emails[0].body_content || "");
      let singleScore = 15; // Base for single email

      if (
        /request|inquiry|please|could you|can you|need|quote|order/i.test(
          singleEmailContent,
        )
      ) {
        singleScore += 10; // Has request elements
      }
      if (
        /completed|resolved|closed|done|shipped|delivered|thank you|finished/i.test(
          singleEmailContent,
        )
      ) {
        singleScore += 15; // Self-contained completion
      }
      if (singleEmailContent.length > 500) {
        singleScore += 5; // Substantial content
      }

      return {
        has_start: true,
        has_middle: false,
        has_completion: false,
        completeness_score: Math.min(35, singleScore),
      };
    }

    // Analyze email content for workflow states with more gradual scoring
    const hasStart = emails.some((e) =>
      /request|inquiry|please|could you|can you|need|quote|order/i.test(
        (e.subject || "") + " " + (e.body_content || ""),
      ),
    );

    const hasMiddle =
      emails.length >= 3 ||
      emails.some((e) =>
        /update|status|working on|in progress|following up|processing/i.test(
          (e.subject || "") + " " + (e.body_content || ""),
        ),
      );

    const hasCompletion = emails.some((e) =>
      /completed|resolved|closed|done|shipped|delivered|thank you|finished/i.test(
        (e.subject || "") + " " + (e.body_content || ""),
      ),
    );

    // Calculate completeness score with more gradual progression
    let score = 10; // Base score for having any emails

    if (hasStart) score += 25;
    if (hasMiddle) score += 25;
    if (hasCompletion) score += 30;

    // Email count bonuses (gradual)
    if (emails.length >= 2) score += 5;
    if (emails.length >= 3) score += 5;
    if (emails.length >= 5) score += 5;
    if (emails.length >= 7) score += 5;

    // Duration bonus (if calculable)
    const duration = this.calculateConversationDuration(emails);
    if (duration > 0) {
      if (duration > 1) score += 3; // > 1 hour
      if (duration > 24) score += 3; // > 1 day
      if (duration > 168) score += 4; // > 1 week
    }

    // Participant diversity bonus
    const uniqueParticipants = new Set(emails.map((e) => e.sender_email)).size;
    if (uniqueParticipants >= 2) score += 5;
    if (uniqueParticipants >= 3) score += 5;

    // Ensure we never hit exactly 0% or 100% unless truly warranted
    score = Math.max(15, Math.min(95, score));

    // Only allow 100% for truly complete workflows
    if (
      hasStart &&
      hasMiddle &&
      hasCompletion &&
      emails.length >= 5 &&
      uniqueParticipants >= 2
    ) {
      score = 100;
    }

    return {
      has_start: hasStart,
      has_middle: hasMiddle,
      has_completion: hasCompletion,
      completeness_score: score,
    };
  }

  private calculateConversationDuration(emails: any[]): number {
    if (emails.length < 2) return 0;

    const firstDate = new Date(emails[0].received_date_time);
    const lastDate = new Date(emails[emails.length - 1].received_date_time);

    return (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60); // hours
  }

  private updateConversationScores(conversationId: string, analysis: any) {
    const updateStmt = this.db.prepare(`
      UPDATE emails_enhanced SET
        chain_completeness_score = ?,
        is_chain_complete = ?,
        workflow_state = 'ANALYZED',
        updated_at = CURRENT_TIMESTAMP
      WHERE conversation_id = ?
    `);

    updateStmt.run(
      analysis.completeness_score,
      analysis.completeness_score >= 70 ? 1 : 0,
      conversationId,
    );
  }

  private displayResults(startTime: number) {
    const duration = (Date.now() - startTime) / 1000;

    console.log(chalk.green.bold("\n\n✅ Scoring Fix Complete!\n"));
    console.log(chalk.white("📊 Results:"));
    console.log(
      chalk.white(
        `   • Total conversations: ${this.stats.total_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Updated conversations: ${this.stats.updated_conversations.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(`   • Errors: ${this.stats.errors.toLocaleString()}`),
    );
    console.log(chalk.white(`   • Processing time: ${duration.toFixed(1)}s`));
    console.log(
      chalk.white(
        `   • Avg time per conversation: ${(duration / this.stats.total_conversations).toFixed(3)}s`,
      ),
    );

    // Validate the fixed scoring distribution
    this.validateScoringDistribution();
  }

  private validateScoringDistribution() {
    console.log(chalk.yellow("\n🔍 Validating Fixed Scoring Distribution:"));

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
      .all() as any[];

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
        chalk.red.bold("\n🚨 CRITICAL: Binary scoring pathology still exists!"),
      );
      console.log(
        chalk.red(
          `   ${(binaryPercentage * 100).toFixed(1)}% of scores are exactly 0% or 100%`,
        ),
      );
      console.log(chalk.red("   The fix did not work properly."));
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
      console.log(chalk.green.bold("\n✅ SUCCESS: Binary pathology FIXED!"));
      console.log(
        chalk.green(`   ${intermediateScores} intermediate score values found`),
      );
      console.log(
        chalk.green(
          `   Binary scores: ${(binaryPercentage * 100).toFixed(1)}% (healthy)`,
        ),
      );
    }

    // Show sample of score distribution
    console.log(chalk.cyan("\n📊 Score Distribution Sample:"));
    const sampleScores = scoreDistribution.slice(0, 15);
    sampleScores.forEach((row, i) => {
      if (
        i < 10 ||
        row.chain_completeness_score === 0 ||
        row.chain_completeness_score === 100
      ) {
        console.log(
          `   ${row.chain_completeness_score}%: ${row.count} conversations`,
        );
      }
    });

    if (scoreDistribution.length > 15) {
      console.log(
        `   ... and ${scoreDistribution.length - 15} more score values`,
      );
    }
  }
}

// Run the fixer
async function main() {
  const fixer = new ScoringFixer();
  await fixer.fixAllConversations();
}

main().catch(console.error);
