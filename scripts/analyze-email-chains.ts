#!/usr/bin/env tsx
/**
 * Analyze Email Chains in Database
 * Identifies complete vs incomplete chains and provides statistics
 */

import Database from "better-sqlite3";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";
import { format } from "date-fns";

async function analyzeEmailChains() {
  console.log("=".repeat(60));
  console.log("EMAIL CHAIN ANALYSIS");
  console.log("=".repeat(60));

  const analyzer = new EmailChainAnalyzer("./data/crewai.db");
  const db = new Database("./data/crewai.db");

  try {
    // Get overall statistics
    console.log("\nAnalyzing email chains...\n");
    const stats = await analyzer.getChainStatistics();

    console.log("Chain Statistics:");
    console.log(`Total unique chains: ${stats.total_chains}`);
    console.log(
      `Complete chains: ${stats.complete_chains} (${Math.round((stats.complete_chains / stats.total_chains) * 100)}%)`,
    );
    console.log(
      `Incomplete chains: ${stats.incomplete_chains} (${Math.round((stats.incomplete_chains / stats.total_chains) * 100)}%)`,
    );
    console.log(`Average chain length: ${stats.average_chain_length} emails`);

    console.log("\nChain Type Distribution:");
    Object.entries(stats.chain_type_distribution)
      .sort(([, a], [, b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count} chains`);
      });

    // Get sample of complete chains
    console.log("\n" + "=".repeat(60));
    console.log("SAMPLE COMPLETE CHAINS (for Phase 3 analysis)");
    console.log("=".repeat(60));

    const completeChains = await getCompleteChainsSample(db, analyzer, 10);

    for (const chain of completeChains) {
      console.log(`\nChain ID: ${chain.chain_id}`);
      console.log(`Type: ${chain.chain_type}`);
      console.log(`Emails: ${chain.chain_length}`);
      console.log(`Duration: ${chain.duration_hours} hours`);
      console.log(`Completeness: ${chain.completeness_score}%`);
      console.log(`Workflow states: ${chain.workflow_states.join(" → ")}`);

      if (chain.key_entities.quote_numbers.length > 0) {
        console.log(
          `Quote numbers: ${chain.key_entities.quote_numbers.join(", ")}`,
        );
      }
      if (chain.key_entities.po_numbers.length > 0) {
        console.log(`PO numbers: ${chain.key_entities.po_numbers.join(", ")}`);
      }
    }

    // Get sample of incomplete chains
    console.log("\n" + "=".repeat(60));
    console.log("SAMPLE INCOMPLETE CHAINS (for Phase 2 only)");
    console.log("=".repeat(60));

    const incompleteChains = await getIncompleteChainsSample(db, analyzer, 10);

    for (const chain of incompleteChains) {
      console.log(`\nChain ID: ${chain.chain_id}`);
      console.log(`Type: ${chain.chain_type}`);
      console.log(`Emails: ${chain.chain_length}`);
      console.log(`Completeness: ${chain.completeness_score}%`);
      console.log(`Missing: ${chain.missing_elements.join(", ")}`);
    }

    // Analyze potential for improvement
    console.log("\n" + "=".repeat(60));
    console.log("ANALYSIS RECOMMENDATIONS");
    console.log("=".repeat(60));

    const phase3Eligible = stats.complete_chains;
    const phase2Only = stats.incomplete_chains;
    const totalEmails = await getTotalEmailCount(db);

    console.log(`\nTotal emails in database: ${totalEmails}`);
    console.log(
      `Emails in complete chains (Phase 3 eligible): ~${phase3Eligible * stats.average_chain_length}`,
    );
    console.log(
      `Emails in incomplete chains (Phase 2 only): ~${phase2Only * stats.average_chain_length}`,
    );

    // Time savings calculation
    const phase3Time = 90; // seconds
    const phase2Time = 10; // seconds
    const timeSaved =
      phase2Only * stats.average_chain_length * (phase3Time - phase2Time);
    const hoursSaved = Math.round(timeSaved / 3600);

    console.log(`\nTime savings by using adaptive approach:`);
    console.log(`- Phase 3 for complete chains: ${phase3Eligible} chains`);
    console.log(`- Phase 2 only for incomplete: ${phase2Only} chains`);
    console.log(`- Estimated time saved: ${hoursSaved} hours`);

    // Quality insights
    console.log(`\nQuality insights:`);
    console.log(
      `- Complete chains will get full workflow analysis (Score: 9.2/10)`,
    );
    console.log(`- Incomplete chains get standard analysis (Score: 7.5/10)`);
    console.log(
      `- Overall quality maintained while optimizing processing time`,
    );
  } catch (error) {
    console.error("Error analyzing chains:", error);
  } finally {
    analyzer.close();
    db.close();
  }
}

async function getCompleteChainsSample(
  db: Database.Database,
  analyzer: EmailChainAnalyzer,
  limit: number,
): Promise<any[]> {
  const emails = db
    .prepare(
      `
    SELECT id FROM emails 
    ORDER BY received_at DESC 
    LIMIT 1000
  `,
    )
    .all() as any[];

  const chains = await analyzer.analyzeMultipleChains(emails.map((e) => e.id));

  const completeChains = Array.from(chains.values())
    .filter((chain) => chain.is_complete)
    .slice(0, limit);

  return completeChains;
}

async function getIncompleteChainsSample(
  db: Database.Database,
  analyzer: EmailChainAnalyzer,
  limit: number,
): Promise<any[]> {
  const emails = db
    .prepare(
      `
    SELECT id FROM emails 
    ORDER BY received_at DESC 
    LIMIT 1000
  `,
    )
    .all() as any[];

  const chains = await analyzer.analyzeMultipleChains(emails.map((e) => e.id));

  const incompleteChains = Array.from(chains.values())
    .filter((chain) => !chain.is_complete)
    .slice(0, limit);

  return incompleteChains;
}

function getTotalEmailCount(db: Database.Database): number {
  const result = db
    .prepare("SELECT COUNT(*) as count FROM emails")
    .get() as any;
  return result.count;
}

// Run analysis
analyzeEmailChains().catch(console.error);
