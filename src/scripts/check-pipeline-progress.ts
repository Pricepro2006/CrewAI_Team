#!/usr/bin/env tsx

import { getDatabaseConnection } from "../database/connection";
import { promises as fs } from "fs";

async function checkProgress() {
  try {
    // Check database
    const db = getDatabaseConnection();
    const execution = db
      .prepare("SELECT * FROM pipeline_executions WHERE id = 7")
      .get() as any;

    console.log("\n📊 Pipeline Progress Check");
    console.log("========================");

    if (execution) {
      const startTime = new Date(execution.started_at).getTime();
      const elapsed = Date.now() - startTime;
      const hours = Math.floor(elapsed / (1000 * 60 * 60));
      const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));

      console.log(`\nExecution ID: ${execution.id}`);
      console.log(`Status: ${execution.status}`);
      console.log(`Started: ${execution.started_at}`);
      console.log(`Elapsed: ${hours}h ${minutes}m`);
      console.log(`\nDatabase Progress:`);
      console.log(`  Stage 1: ${execution.stage1_count || 0}/33,797`);
      console.log(`  Stage 2: ${execution.stage2_count || 0}/1,000`);
      console.log(`  Stage 3: ${execution.stage3_count || 0}/100`);
    }

    // Check intermediate files
    const stage2File = "stage2_intermediate_results.json";
    const stage3File = "stage3_intermediate_results.json";

    console.log("\n📁 Intermediate Files:");

    if (
      await fs
        .access(stage2File)
        .then(() => true)
        .catch(() => false)
    ) {
      const content = await fs.readFile(stage2File, "utf-8");
      const results = JSON.parse(content);
      console.log(`  Stage 2: ${results.length} emails processed`);

      // Get average quality score
      const avgScore =
        results.reduce(
          (acc: number, r: any) => acc + (r.qualityScore || 0),
          0,
        ) / results.length;
      console.log(`  Average quality: ${avgScore.toFixed(2)}/10`);
    }

    if (
      await fs
        .access(stage3File)
        .then(() => true)
        .catch(() => false)
    ) {
      const content = await fs.readFile(stage3File, "utf-8");
      const results = JSON.parse(content);
      console.log(`  Stage 3: ${results.length} emails processed`);

      // Check last processed time
      if (results.length > 0) {
        const lastResult = results[results.length - 1];
        console.log(`  Last processed: ${lastResult.emailId}`);
      }
    }

    // Estimate remaining time
    if (execution.stage3_count < 100) {
      const remainingEmails = 100 - (execution.stage3_count || 98);
      const avgTimePerEmail = 90; // ~90 seconds per email for Stage 3
      const remainingMinutes = (remainingEmails * avgTimePerEmail) / 60;

      console.log(
        `\n⏱️  Estimated time to completion: ~${remainingMinutes.toFixed(0)} minutes`,
      );
      console.log(`   (${remainingEmails} emails remaining in Stage 3)`);
    } else {
      console.log("\n✅ Pipeline appears to be complete!");
    }

    process.exit(0);
  } catch (error) {
    console.error("Error checking progress:", error);
    process.exit(1);
  }
}

checkProgress();
