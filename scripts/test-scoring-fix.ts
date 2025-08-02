#!/usr/bin/env tsx

/**
 * Test Scoring Fix - Validate EmailChainAnalyzer Integration
 * Ensures no binary pathology in chain completeness scoring
 */

import Database from "better-sqlite3";
import path from "path";
import chalk from "chalk";
import { EmailChainAnalyzer } from "../src/core/services/EmailChainAnalyzer.js";

const DB_PATH = path.join(process.cwd(), "data/crewai_enhanced.db");

async function testScoringFix() {
  console.log(
    chalk.blue.bold(
      "\n🔬 Testing Scoring Fix - EmailChainAnalyzer Integration\n",
    ),
  );

  const db = new Database(DB_PATH);
  const chainAnalyzer = new EmailChainAnalyzer(DB_PATH);

  try {
    // Get a small sample of conversations to test
    const conversations = db
      .prepare(
        `
      SELECT conversation_id, COUNT(*) as email_count
      FROM emails_enhanced
      WHERE conversation_id IS NOT NULL
      GROUP BY conversation_id
      ORDER BY email_count DESC
      LIMIT 10
    `,
      )
      .all() as any[];

    console.log(
      chalk.cyan(`Testing ${conversations.length} conversations...\n`),
    );

    const scores: number[] = [];

    for (const conv of conversations) {
      try {
        // Get primary email for this conversation
        const primaryEmail = db
          .prepare(
            `
          SELECT id FROM emails_enhanced
          WHERE conversation_id = ?
          ORDER BY received_date_time DESC
          LIMIT 1
        `,
          )
          .get(conv.conversation_id) as any;

        if (!primaryEmail) continue;

        // Use EmailChainAnalyzer
        const analysis = await chainAnalyzer.analyzeChain(primaryEmail.id);

        scores.push(analysis.completeness_score);

        console.log(chalk.white(`Conversation ${conv.conversation_id}:`));
        console.log(chalk.gray(`  Score: ${analysis.completeness_score}%`));
        console.log(chalk.gray(`  Type: ${analysis.chain_type}`));
        console.log(chalk.gray(`  Complete: ${analysis.is_complete}`));
        console.log(
          chalk.gray(
            `  Missing: ${analysis.missing_elements.join(", ") || "None"}`,
          ),
        );
        console.log("");
      } catch (error) {
        console.log(chalk.red(`  Error: ${error.message}`));
      }
    }

    // Analyze score distribution
    console.log(chalk.yellow("\n📊 Score Distribution Analysis:"));

    const zeroScores = scores.filter((s) => s === 0).length;
    const hundredScores = scores.filter((s) => s === 100).length;
    const intermediateScores = scores.filter((s) => s > 0 && s < 100).length;

    console.log(
      chalk.white(
        `  • 0% scores: ${zeroScores} (${((zeroScores / scores.length) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `  • 100% scores: ${hundredScores} (${((hundredScores / scores.length) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `  • Intermediate scores: ${intermediateScores} (${((intermediateScores / scores.length) * 100).toFixed(1)}%)`,
      ),
    );
    console.log(
      chalk.white(
        `  • Average score: ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}%`,
      ),
    );

    // Show individual scores
    console.log(chalk.cyan("\n🔢 Individual Scores:"));
    console.log(chalk.white(`  [${scores.join(", ")}]`));

    // Validate fix
    const binaryPercentage = (zeroScores + hundredScores) / scores.length;

    if (binaryPercentage > 0.8) {
      console.log(
        chalk.red.bold("\n🚨 CRITICAL: Binary scoring pathology still exists!"),
      );
      console.log(
        chalk.red(
          `   ${(binaryPercentage * 100).toFixed(1)}% of scores are exactly 0% or 100%`,
        ),
      );
    } else if (intermediateScores === 0) {
      console.log(
        chalk.yellow.bold("\n⚠️ WARNING: No intermediate scores found"),
      );
    } else {
      console.log(
        chalk.green.bold("\n✅ SUCCESS: Healthy scoring distribution detected"),
      );
      console.log(
        chalk.green(`   ${intermediateScores} intermediate scores found`),
      );
      console.log(
        chalk.green(
          `   Binary scores: ${(binaryPercentage * 100).toFixed(1)}% (acceptable)`,
        ),
      );
    }
  } finally {
    chainAnalyzer.close();
    db.close();
  }
}

testScoringFix().catch(console.error);
