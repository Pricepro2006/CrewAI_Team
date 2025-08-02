#!/usr/bin/env tsx

/**
 * Update chain types for complete email chains using improved detection
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

class ChainTypeUpdater {
  private db: Database.Database;

  constructor() {
    this.db = new Database(DB_PATH);
  }

  updateChainTypes() {
    console.log(
      chalk.blue.bold("\n🔄 Updating Chain Types for Complete Chains\n"),
    );

    // Get all complete chains
    const completeChains = this.db
      .prepare(
        `
      SELECT DISTINCT conversation_id, chain_type
      FROM emails_enhanced
      WHERE chain_completeness_score >= 70
        AND is_chain_complete = 1
    `,
      )
      .all() as any[];

    console.log(
      chalk.cyan(`Found ${completeChains.length} complete chains to update\n`),
    );

    const updateStmt = this.db.prepare(`
      UPDATE emails_enhanced
      SET chain_type = ?
      WHERE conversation_id = ?
    `);

    let updated = 0;

    for (const chain of completeChains) {
      // Get all emails in this conversation
      const emails = this.db
        .prepare(
          `
        SELECT subject, body_content
        FROM emails_enhanced
        WHERE conversation_id = ?
      `,
        )
        .all(chain.conversation_id) as any[];

      const newType = this.detectChainType(emails);

      if (newType !== chain.chain_type) {
        updateStmt.run(newType, chain.conversation_id);
        updated++;

        if (updated % 100 === 0) {
          console.log(chalk.gray(`Updated ${updated} chains...`));
        }
      }
    }

    console.log(chalk.green(`\n✅ Updated ${updated} chain types\n`));

    // Show distribution
    const distribution = this.db
      .prepare(
        `
      SELECT 
        chain_type,
        COUNT(DISTINCT conversation_id) as count,
        AVG(chain_completeness_score) as avg_score
      FROM emails_enhanced
      WHERE chain_type IS NOT NULL
        AND is_chain_complete = 1
      GROUP BY chain_type
      ORDER BY count DESC
    `,
      )
      .all() as any[];

    console.log(chalk.yellow("📊 Updated Chain Type Distribution:\n"));
    distribution.forEach((type) => {
      console.log(
        chalk.white(
          `   ${type.chain_type}: ${type.count} chains (avg: ${type.avg_score?.toFixed(1)}%)`,
        ),
      );
    });
  }

  private detectChainType(emails: any[]): string {
    const allContent = emails
      .map((e) => (e.subject + " " + e.body_content).toLowerCase())
      .join(" ");

    // More specific pattern matching for complete workflows
    if (
      (allContent.includes("quote") || allContent.includes("pricing")) &&
      (allContent.includes("approved") ||
        allContent.includes("completed") ||
        allContent.includes("delivered"))
    ) {
      return "quote_to_delivery";
    } else if (
      (allContent.includes("order") || allContent.includes("purchase")) &&
      (allContent.includes("shipped") ||
        allContent.includes("delivered") ||
        allContent.includes("received"))
    ) {
      return "order_fulfillment";
    } else if (
      (allContent.includes("support") ||
        allContent.includes("issue") ||
        allContent.includes("problem")) &&
      (allContent.includes("resolved") ||
        allContent.includes("fixed") ||
        allContent.includes("closed"))
    ) {
      return "support_resolution";
    } else if (
      (allContent.includes("return") || allContent.includes("rma")) &&
      (allContent.includes("processed") ||
        allContent.includes("completed") ||
        allContent.includes("credit"))
    ) {
      return "return_processing";
    } else if (
      allContent.includes("thank you") ||
      allContent.includes("completed") ||
      allContent.includes("resolved")
    ) {
      return "completed_workflow";
    }

    return "complete_chain_other";
  }

  close() {
    this.db.close();
  }
}

// Run the updater
const updater = new ChainTypeUpdater();
updater.updateChainTypes();
updater.close();
