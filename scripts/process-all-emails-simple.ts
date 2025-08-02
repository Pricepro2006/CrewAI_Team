#!/usr/bin/env tsx

/**
 * Simple Email Processing Script
 * Processes all emails in database through the adaptive three-phase analysis
 */

import Database from "better-sqlite3";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { mapEmailColumnsForAnalysis } from "./map-email-columns.js";
import chalk from "chalk";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data/crewai.db");

async function main() {
  console.log(
    chalk.blue.bold("\n🚀 Processing All Emails Through Adaptive Pipeline\n"),
  );

  const db = new Database(DB_PATH);
  const chainAnalyzer = new EmailChainAnalyzer();
  const analysisService = new EmailThreePhaseAnalysisService();

  const stats = {
    total: 0,
    processed: 0,
    complete_chains: 0,
    incomplete_chains: 0,
    errors: 0,
  };

  try {
    // Get total count
    const totalCount = db
      .prepare("SELECT COUNT(*) as count FROM emails")
      .get() as { count: number };
    stats.total = totalCount.count;

    console.log(chalk.cyan(`Total emails: ${stats.total.toLocaleString()}`));
    console.log(chalk.yellow("Processing in batches of 100...\n"));

    // Process in batches
    const batchSize = 100;
    const processedIds = new Set<string>();

    for (let offset = 0; offset < stats.total; offset += batchSize) {
      const batch = db
        .prepare(
          `
        SELECT * FROM emails 
        WHERE status = 'pending'
        ORDER BY received_time DESC
        LIMIT ? OFFSET ?
      `,
        )
        .all(batchSize, offset);

      console.log(
        chalk.cyan(
          `\nBatch ${Math.floor(offset / batchSize) + 1}: Processing ${batch.length} emails...`,
        ),
      );

      for (const dbEmail of batch) {
        if (processedIds.has(dbEmail.id)) continue;

        try {
          // Map columns for analysis
          const mappedEmail = mapEmailColumnsForAnalysis(dbEmail);

          // Analyze chain
          console.log(
            chalk.gray(`Analyzing: ${dbEmail.subject?.substring(0, 50)}...`),
          );
          const chainAnalysis = await chainAnalyzer.analyzeChain(dbEmail.id);

          // Add chain analysis to email
          mappedEmail.chainAnalysis = chainAnalysis;

          // Run adaptive analysis
          const result = await analysisService.analyzeEmail(mappedEmail);

          // Update database
          const updateStmt = db.prepare(`
            UPDATE emails SET
              status = 'analyzed',
              workflow_state = ?,
              confidence_score = ?,
              analyzed_at = CURRENT_TIMESTAMP,
              conversation_id = ?,
              thread_id = ?
            WHERE id = ?
          `);

          updateStmt.run(
            result.workflow_state || "ANALYZED",
            chainAnalysis.completeness_score / 100,
            chainAnalysis.chain_id,
            chainAnalysis.chain_id,
            dbEmail.id,
          );

          processedIds.add(dbEmail.id);
          stats.processed++;

          if (chainAnalysis.is_complete) {
            stats.complete_chains++;
          } else {
            stats.incomplete_chains++;
          }

          // Progress update
          if (stats.processed % 10 === 0) {
            const progress = ((stats.processed / stats.total) * 100).toFixed(1);
            console.log(
              chalk.green(
                `Progress: ${progress}% | Processed: ${stats.processed} | Complete chains: ${stats.complete_chains}`,
              ),
            );
          }
        } catch (error) {
          stats.errors++;
          console.error(
            chalk.red(`Error processing ${dbEmail.id}:`),
            error.message,
          );
        }
      }
    }

    // Final stats
    console.log(chalk.green.bold("\n\n✅ Processing Complete!\n"));
    console.log(chalk.white("📊 Results:"));
    console.log(
      chalk.white(`   • Total emails: ${stats.total.toLocaleString()}`),
    );
    console.log(
      chalk.white(`   • Processed: ${stats.processed.toLocaleString()}`),
    );
    console.log(
      chalk.white(
        `   • Complete chains: ${stats.complete_chains.toLocaleString()}`,
      ),
    );
    console.log(
      chalk.white(
        `   • Incomplete chains: ${stats.incomplete_chains.toLocaleString()}`,
      ),
    );
    console.log(chalk.white(`   • Errors: ${stats.errors.toLocaleString()}`));
  } catch (error) {
    console.error(chalk.red("\n❌ Fatal error:"), error);
  } finally {
    db.close();
  }
}

main().catch(console.error);
