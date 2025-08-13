#!/usr/bin/env tsx
/**
 * Run ONLY Phase 3 (Phi-4 14B) on 20 test emails
 */

import { Stage3CriticalAnalysis } from "../src/core/pipeline/Stage3CriticalAnalysis.js";
import fs from "fs";
import path from "path";

async function runPhase3Only() {
  console.log("🚀 Running ONLY Phase 3 (Phi-4 14B) on 20 Test Emails\n");

  try {
    // Load all test emails from batch files
    const batchDir = "/home/pricepro2006/CrewAI_Team/data/email-batches";
    const testEmails: any[] = [];

    // Read all 4 test batch files (5 emails each = 20 total)
    for (let i = 1; i <= 4; i++) {
      const batchPath = path.join(batchDir, `test_emails_batch_${i}.json`);
      const emails = JSON.parse(fs.readFileSync(batchPath, "utf-8"));
      testEmails.push(...emails);
    }

    console.log(`📧 Loaded ${testEmails.length} test emails\n`);

    // Transform to format expected by Stage 3
    const formattedEmails = testEmails.map((email: any, index: number) => ({
      id: email.MessageID || `test_${index}`,
      subject: email.Subject || "",
      body: email.BodyText || "",
      sender_email: email.SenderEmail || "unknown@email.com",
    }));

    // Create Stage 3 analyzer
    const stage3 = new Stage3CriticalAnalysis();

    console.log("🔬 Running Phi-4 14B critical analysis on ALL 20 emails...\n");
    console.log("Model: doomgrave/phi-4:14b-tools-Q3_K_S\n");

    // Set progress callback
    let processedCount = 0;
    stage3.setProgressCallback(async (count: number) => {
      processedCount = count;
      console.log(
        `Progress: ${count}/20 emails processed (${((count / 20) * 100).toFixed(0)}%)`,
      );
    });

    // Process all 20 emails
    const startTime = Date.now();
    const results = await stage3.process(formattedEmails);
    const totalTime = (Date.now() - startTime) / 1000;

    console.log("\n✅ Phase 3 Analysis Complete!");
    console.log(
      `⏱️  Total time: ${totalTime.toFixed(1)}s (${(totalTime / 20).toFixed(1)}s per email)`,
    );
    console.log(`📊 Results Summary:`);
    console.log(`   - Emails processed: ${results.length}`);
    console.log(
      `   - Average quality score: ${(results.reduce((sum, r) => sum + r.qualityScore, 0) / results.length).toFixed(1)}/10`,
    );
    console.log(
      `   - Primary model used: ${results.filter((r) => !r.fallbackUsed).length} emails`,
    );
    console.log(
      `   - Fallback model used: ${results.filter((r) => r.fallbackUsed).length} emails`,
    );

    // Save results
    const outputPath = path.join(batchDir, "phase3_results.json");
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n💾 Results saved to: ${outputPath}`);
  } catch (error) {
    console.error("❌ Phase 3 failed:", error);
  }
}

// Run Phase 3 only
runPhase3Only().catch(console.error);
