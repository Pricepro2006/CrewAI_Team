#!/usr/bin/env tsx

/**
 * Process Emails Without Conversation IDs
 *
 * This script processes emails that were imported without conversation/thread IDs
 * by using the EmailChainAnalyzer's subject-based chain detection, then running
 * the adaptive three-phase analysis pipeline.
 */

import { DatabaseManager } from "../src/database/DatabaseManager.js";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { Logger } from "../src/utils/logger.js";
import { CheckpointManager } from "../src/core/recovery/CheckpointManager.js";
import { RetryManager } from "../src/core/retry/RetryManager.js";
import { TransactionManager } from "../src/database/TransactionManager.js";
import { MemorySafeBatchProcessor } from "../src/core/processors/MemorySafeBatchProcessor.js";
import { mapEmailColumnsForAnalysis } from "./map-email-columns.js";
import chalk from "chalk";
import * as fs from "fs/promises";
import path from "path";

const logger = new Logger("PROCESS_EMAILS_WITHOUT_IDS");

class EmailProcessorWithoutIds {
  private db = DatabaseManager.getInstance().getDatabase();
  private chainAnalyzer = new EmailChainAnalyzer();
  private analysisService = new EmailThreePhaseAnalysisService();
  private checkpointManager = new CheckpointManager();
  private retryManager = new RetryManager();
  private transactionManager = new TransactionManager();
  private memoryProcessor = new MemorySafeBatchProcessor({
    batchSize: 100,
    memoryThresholdMB: 500,
    gcInterval: 50,
  });

  private stats = {
    total_emails: 0,
    processed_emails: 0,
    unique_chains: 0,
    complete_chains: 0,
    incomplete_chains: 0,
    failed_emails: 0,
    phase3_analyses: 0,
    phase2_only_analyses: 0,
    errors: [] as string[],
  };

  async process() {
    console.log(
      chalk.blue.bold("\n🚀 Processing Emails Without Conversation IDs\n"),
    );

    const startTime = Date.now();
    const operationId = `email-processing-${Date.now()}`;

    try {
      // Get total email count
      const totalCount = this.db
        .prepare("SELECT COUNT(*) as count FROM emails")
        .get() as { count: number };
      this.stats.total_emails = totalCount.count;

      console.log(
        chalk.cyan(
          `Total emails to process: ${this.stats.total_emails.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.yellow(
          "\nNote: Emails don't have conversation IDs, using subject-based chain detection\n",
        ),
      );

      // Process emails in batches to avoid memory issues
      const batchSize = 500;
      const processedEmails = new Set<string>();
      const processedChains = new Map<string, Set<string>>();

      for (
        let offset = 0;
        offset < this.stats.total_emails;
        offset += batchSize
      ) {
        console.log(
          chalk.cyan(
            `\n📦 Processing batch ${Math.floor(offset / batchSize) + 1}/${Math.ceil(this.stats.total_emails / batchSize)}`,
          ),
        );

        // Get batch of emails
        const emails = await this.retryManager.retry(
          () =>
            this.db
              .prepare(
                `
            SELECT * FROM emails 
            ORDER BY received_time DESC
            LIMIT ? OFFSET ?
          `,
              )
              .all(batchSize, offset),
          "database",
        );

        // Process each email
        for (const dbEmail of emails) {
          // Skip if already processed as part of a chain
          if (processedEmails.has(dbEmail.id)) {
            continue;
          }

          try {
            // Analyze email chain
            const chainAnalysis = await this.chainAnalyzer.analyzeChain(
              dbEmail.id,
            );

            // Generate a stable chain ID
            const chainId = this.generateChainId(dbEmail, chainAnalysis);

            // Check if we've already processed this chain
            if (processedChains.has(chainId)) {
              // Just mark this email as processed
              processedEmails.add(dbEmail.id);
              continue;
            }

            // Get all emails in the chain
            const chainEmails = await this.getChainEmails(
              dbEmail,
              chainAnalysis,
            );

            // Mark all emails in chain as processed
            const emailIds = new Set<string>();
            chainEmails.forEach((email) => {
              processedEmails.add(email.id);
              emailIds.add(email.id);
            });
            processedChains.set(chainId, emailIds);

            // Update stats
            this.stats.unique_chains++;
            if (chainAnalysis.is_complete) {
              this.stats.complete_chains++;
            } else {
              this.stats.incomplete_chains++;
            }

            // Process the primary email through adaptive pipeline
            const mappedEmail = mapEmailColumnsForAnalysis(dbEmail);
            mappedEmail.chainAnalysis = chainAnalysis;
            mappedEmail.chainEmails = chainEmails;

            console.log(
              chalk.gray(
                `\n🔗 Chain ${chainId.substring(0, 8)}... (${chainEmails.length} emails, ${chainAnalysis.completeness_score}% complete)`,
              ),
            );

            // Run adaptive analysis
            const result = await this.analysisService.analyzeEmail(mappedEmail);

            // Update database with results
            await this.updateEmailWithAnalysis(
              dbEmail.id,
              result,
              chainId,
              chainAnalysis,
            );

            // Update all emails in chain with chain metadata
            await this.updateChainEmails(emailIds, chainId, chainAnalysis);

            this.stats.processed_emails += emailIds.size;

            if (chainAnalysis.is_complete) {
              this.stats.phase3_analyses++;
            } else {
              this.stats.phase2_only_analyses++;
            }

            // Progress update
            if (this.stats.unique_chains % 10 === 0) {
              const progress = (
                (processedEmails.size / this.stats.total_emails) *
                100
              ).toFixed(1);
              console.log(
                chalk.green(
                  `\n✅ Progress: ${progress}% | Chains: ${this.stats.unique_chains} | Processed: ${processedEmails.size}/${this.stats.total_emails}`,
                ),
              );
            }
          } catch (error) {
            this.stats.failed_emails++;
            this.stats.errors.push(`Email ${dbEmail.id}: ${error.message}`);
            logger.error(`Failed to process email ${dbEmail.id}`, error);
          }
        }

        // Memory cleanup between batches
        if (global.gc) {
          global.gc();
        }
      }

      // Final results
      const duration = (Date.now() - startTime) / 1000;
      console.log(chalk.green.bold("\n\n✅ Processing Complete!\n"));
      console.log(chalk.white("📊 Results:"));
      console.log(
        chalk.white(
          `   • Total emails: ${this.stats.total_emails.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.white(
          `   • Processed emails: ${this.stats.processed_emails.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.white(
          `   • Unique chains: ${this.stats.unique_chains.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.white(
          `   • Complete chains (Phase 3): ${this.stats.complete_chains.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.white(
          `   • Incomplete chains (Phase 2): ${this.stats.incomplete_chains.toLocaleString()}`,
        ),
      );
      console.log(
        chalk.white(
          `   • Failed emails: ${this.stats.failed_emails.toLocaleString()}`,
        ),
      );
      console.log(chalk.white(`   • Processing time: ${duration.toFixed(1)}s`));
      console.log(
        chalk.white(
          `   • Avg time per chain: ${(duration / this.stats.unique_chains).toFixed(2)}s`,
        ),
      );

      if (this.stats.errors.length > 0) {
        console.log(
          chalk.red(`\n⚠️  Errors occurred: ${this.stats.errors.length}`),
        );
        // Save errors to file
        await fs.writeFile(
          path.join(process.cwd(), "email-processing-errors.log"),
          this.stats.errors.join("\n"),
          "utf-8",
        );
        console.log(
          chalk.yellow("Error details saved to email-processing-errors.log"),
        );
      }
    } catch (error) {
      logger.error("Failed to process emails", error);
      console.error(chalk.red("\n❌ Fatal error:"), error);
      throw error;
    }
  }

  private generateChainId(email: any, chainAnalysis: any): string {
    // Use chain_id from analysis if available
    if (chainAnalysis.chain_id && chainAnalysis.chain_id !== "unknown") {
      return chainAnalysis.chain_id;
    }

    // Generate based on subject and participants
    const cleanSubject = (email.subject || "")
      .toLowerCase()
      .replace(/^(re:|fw:|fwd:)\s*/gi, "")
      .trim();

    return `chain_${this.hashString(cleanSubject + email.from_address)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  private async getChainEmails(email: any, chainAnalysis: any): Promise<any[]> {
    // If chain analysis found related emails, fetch them
    if (chainAnalysis.chain_length > 1) {
      const cleanSubject = (email.subject || "")
        .replace(/^(re:|fw:|fwd:)\s*/gi, "")
        .trim();

      return this.db
        .prepare(
          `
        SELECT * FROM emails 
        WHERE (
          subject LIKE ? OR 
          subject LIKE ? OR 
          subject LIKE ? OR
          subject LIKE ?
        )
        AND (
          from_address = ? OR
          to_addresses LIKE ? OR
          from_address IN (
            SELECT DISTINCT from_address 
            FROM emails 
            WHERE to_addresses LIKE ?
          )
        )
        ORDER BY received_time ASC
      `,
        )
        .all(
          `%${cleanSubject}%`,
          `RE: %${cleanSubject}%`,
          `Re: %${cleanSubject}%`,
          `FW: %${cleanSubject}%`,
          email.from_address,
          `%${email.from_address}%`,
          `%${email.from_address}%`,
        );
    }

    return [email];
  }

  private async updateEmailWithAnalysis(
    emailId: string,
    analysis: any,
    chainId: string,
    chainAnalysis: any,
  ) {
    await this.transactionManager.runInTransaction(async (tx) => {
      const stmt = tx.prepare(`
        UPDATE emails SET
          status = ?,
          workflow_state = ?,
          priority = ?,
          confidence_score = ?,
          analyzed_at = CURRENT_TIMESTAMP,
          conversation_id = ?,
          thread_id = ?,
          categories = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        "analyzed",
        chainAnalysis.workflow_states?.[0] ||
          analysis.workflow_state ||
          "ANALYZED",
        analysis.priority || "normal",
        analysis.confidence_score || chainAnalysis.completeness_score / 100,
        chainId,
        chainId,
        JSON.stringify({
          chain_type: chainAnalysis.chain_type,
          entities: chainAnalysis.key_entities,
          analysis_phases: analysis.phases_completed || 2,
        }),
        emailId,
      );
    });
  }

  private async updateChainEmails(
    emailIds: Set<string>,
    chainId: string,
    chainAnalysis: any,
  ) {
    await this.transactionManager.runInTransaction(async (tx) => {
      const stmt = tx.prepare(`
        UPDATE emails SET
          conversation_id = ?,
          thread_id = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      for (const emailId of emailIds) {
        stmt.run(chainId, chainId, emailId);
      }
    });
  }
}

// Run the processor
async function main() {
  const processor = new EmailProcessorWithoutIds();
  await processor.process();
}

main().catch(console.error);
