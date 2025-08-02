#!/usr/bin/env tsx

/**
 * Test single email processing
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai.db");

async function main() {
  console.log(chalk.blue.bold("\n🧪 Testing Single Email Processing\n"));

  const db = new Database(DB_PATH);

  try {
    // Get one email
    const email = db
      .prepare("SELECT * FROM emails WHERE status = 'pending' LIMIT 1")
      .get();

    if (!email) {
      console.log(chalk.yellow("No pending emails found"));
      return;
    }

    console.log(chalk.cyan("Email details:"));
    console.log(`  ID: ${email.id}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  From: ${email.from_address}`);
    console.log(`  To: ${email.to_addresses}`);
    console.log(`  Status: ${email.status}`);
    console.log(`  Conversation ID: ${email.conversation_id}`);
    console.log(`  Thread ID: ${email.thread_id}`);

    // Test basic processing
    console.log(chalk.yellow("\nTesting EmailChainAnalyzer..."));

    try {
      const { EmailChainAnalyzer } = await import(
        "../src/core/services/EmailChainAnalyzer.js"
      );
      const analyzer = new EmailChainAnalyzer();
      const result = await analyzer.analyzeChain(email.id);

      console.log(chalk.green("✓ Chain analysis successful"));
      console.log(`  Chain ID: ${result.chain_id}`);
      console.log(`  Chain length: ${result.chain_length}`);
      console.log(`  Completeness: ${result.completeness_score}%`);
      console.log(`  Is complete: ${result.is_complete}`);
    } catch (error) {
      console.error(chalk.red("✗ Chain analysis failed:"), error.message);
    }

    // Test three-phase analysis
    console.log(chalk.yellow("\nTesting EmailThreePhaseAnalysisService..."));

    try {
      const { EmailThreePhaseAnalysisService } = await import(
        "../src/core/services/EmailThreePhaseAnalysisService.js"
      );
      const { mapEmailColumnsForAnalysis } = await import(
        "./map-email-columns.js"
      );

      const service = new EmailThreePhaseAnalysisService();
      const mappedEmail = mapEmailColumnsForAnalysis(email);

      console.log(chalk.gray("Mapped email for analysis..."));
      const result = await service.analyzeEmail(mappedEmail);

      console.log(chalk.green("✓ Three-phase analysis successful"));
      console.log(`  Priority: ${result.priority}`);
      console.log(`  Category: ${result.category}`);
      console.log(`  Workflow state: ${result.workflow_state}`);
    } catch (error) {
      console.error(chalk.red("✗ Three-phase analysis failed:"), error.message);
      console.error(error.stack);
    }
  } catch (error) {
    console.error(chalk.red("Fatal error:"), error);
  } finally {
    db.close();
  }
}

main().catch(console.error);
