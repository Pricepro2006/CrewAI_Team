#!/usr/bin/env tsx

/**
 * Test email analysis on a small subset
 */

import { getDatabaseManager } from "../src/database/DatabaseManager.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import chalk from "chalk";

async function testEmailAnalysis() {
  console.log(chalk.blue.bold("\n🧪 Testing Email Analysis Pipeline\n"));

  const dbManager = getDatabaseManager();
  const db = dbManager.getSQLiteDatabase();
  const threePhaseService = new EmailThreePhaseAnalysisService();

  try {
    // Get a few sample emails
    const emails = db
      .prepare(
        `
      SELECT * FROM emails 
      WHERE status IS NULL OR status = 'pending'
      LIMIT 5
    `,
      )
      .all() as any[];

    console.log(chalk.cyan(`Found ${emails.length} emails to test\n`));

    if (emails.length === 0) {
      console.log(
        chalk.yellow("No pending emails found. Getting any 5 emails..."),
      );
      const anyEmails = db
        .prepare(
          `
        SELECT * FROM emails 
        LIMIT 5
      `,
        )
        .all() as any[];
      emails.push(...anyEmails);
    }

    // Test each email
    for (const email of emails) {
      console.log(
        chalk.yellow(`\nAnalyzing email: ${email.subject || "No subject"}`),
      );
      console.log(chalk.gray(`ID: ${email.id}`));
      console.log(
        chalk.gray(
          `From: ${email.sender_email || email.sender_name || "Unknown"}`,
        ),
      );

      try {
        const startTime = Date.now();

        // Run phase 1 only (fast)
        const analysis = await threePhaseService.analyzeEmail(email, {
          forceAllPhases: false,
          includeWorkflowAnalysis: false,
        });

        const duration = (Date.now() - startTime) / 1000;

        console.log(
          chalk.green(`✓ Analysis complete in ${duration.toFixed(1)}s`),
        );
        console.log(
          chalk.white(`  Priority: ${analysis.priority || "medium"}`),
        );
        console.log(
          chalk.white(
            `  Confidence: ${(analysis.confidence * 100).toFixed(0)}%`,
          ),
        );

        if (analysis.phase1Results?.entities) {
          const entities = analysis.phase1Results.entities;
          if (Object.keys(entities).length > 0) {
            console.log(chalk.white(`  Entities found:`));
            Object.entries(entities).forEach(([type, values]) => {
              if (Array.isArray(values) && values.length > 0) {
                console.log(chalk.gray(`    - ${type}: ${values.join(", ")}`));
              }
            });
          }
        }
      } catch (error) {
        console.log(chalk.red(`✗ Analysis failed: ${error.message}`));
      }
    }

    console.log(chalk.green.bold("\n✨ Test complete!\n"));
  } catch (error) {
    console.error(chalk.red("\n❌ Test failed:"), error);
    throw error;
  }
}

// Run the test
testEmailAnalysis().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});
