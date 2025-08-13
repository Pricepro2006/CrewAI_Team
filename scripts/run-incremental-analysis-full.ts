#!/usr/bin/env tsx
/**
 * Full-Scale Three-Phase Incremental Analysis
 * Processes all May-July emails with intelligent phase selection
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { Worker } from "worker_threads";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  BATCH_SIZE: 100,
  MAX_WORKERS: Math.min(10, os.cpus().length - 1), // Leave 1 CPU free
  CHECKPOINT_INTERVAL: 100, // Save progress every 100 emails
  DB_PATH: "./data/crewai.db",
  PROGRESS_FILE: "./data/incremental-analysis-progress.json",
};

interface ProgressData {
  totalEmails: number;
  processedEmails: number;
  lastProcessedId: string;
  startTime: string;
  checkpoints: Array<{
    timestamp: string;
    emailsProcessed: number;
    phase1Count: number;
    phase2Count: number;
    phase3Count: number;
    avgTimePerEmail: number;
  }>;
  stats: {
    phase1Only: number;
    phase1And2: number;
    allThreePhases: number;
    totalProcessingTime: number;
    criticalCount: number;
    highValueCount: number;
    totalRevenue: number;
    errors: number;
  };
}

class IncrementalAnalysisOrchestrator {
  private db: Database.Database;
  private progress: ProgressData;

  constructor() {
    this.db = // Use connection pool instead: getDatabaseConnection().getDatabase() or executeQuery((db) => ...)CONFIG.DB_PATH);
      this.progress = this.loadProgress();
  }

  private loadProgress(): ProgressData {
    if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.PROGRESS_FILE, "utf-8"));
    }

    return {
      totalEmails: 0,
      processedEmails: 0,
      lastProcessedId: "",
      startTime: new Date().toISOString(),
      checkpoints: [],
      stats: {
        phase1Only: 0,
        phase1And2: 0,
        allThreePhases: 0,
        totalProcessingTime: 0,
        criticalCount: 0,
        highValueCount: 0,
        totalRevenue: 0,
        errors: 0,
      },
    };
  }

  private saveProgress() {
    fs.writeFileSync(
      CONFIG.PROGRESS_FILE,
      JSON.stringify(this.progress, null, 2),
    );
  }

  async run() {
    console.log("🚀 Full-Scale Three-Phase Incremental Email Analysis");
    console.log(`🔧 Configuration:`);
    console.log(`   - Batch size: ${CONFIG.BATCH_SIZE}`);
    console.log(`   - Max workers: ${CONFIG.MAX_WORKERS}`);
    console.log(`   - Checkpoint interval: ${CONFIG.CHECKPOINT_INTERVAL}\n`);

    // Get total email count
    const totalCount = this.db
      .prepare(
        `
      SELECT COUNT(*) as count 
      FROM emails 
      WHERE received_at >= '2025-05-09'
        AND received_at <= '2025-07-31'
    `,
      )
      .get() as { count: number };

    this.progress.totalEmails = totalCount.count;
    console.log(
      `📧 Total emails to process: ${this.progress.totalEmails.toLocaleString()}`,
    );

    // Resume from checkpoint if exists
    let whereClause =
      "received_at >= '2025-05-09' AND received_at <= '2025-07-31'";
    if (this.progress.lastProcessedId) {
      console.log(
        `♻️  Resuming from email ID: ${this.progress.lastProcessedId}`,
      );
      whereClause += ` AND id > '${this.progress.lastProcessedId}'`;
    }

    // Process in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = this.db
        .prepare(
          `
        SELECT * FROM emails 
        WHERE ${whereClause}
        ORDER BY id
        LIMIT ${CONFIG.BATCH_SIZE}
      `,
        )
        .all();

      if (batch.length === 0) {
        hasMore = false;
        break;
      }

      console.log(
        `\n📦 Processing batch: ${offset + 1}-${offset + batch.length}`,
      );

      // Process batch with workers
      await this.processBatch(batch);

      // Update progress
      this.progress.lastProcessedId = batch[batch.length - 1].id;
      offset += batch.length;

      // Checkpoint
      if (this.progress.processedEmails % CONFIG.CHECKPOINT_INTERVAL === 0) {
        this.checkpoint();
      }
    }

    // Final summary
    this.printFinalSummary();
    this.db.close();
  }

  private async processBatch(emails: any[]) {
    const chunkSize = Math.ceil(emails.length / CONFIG.MAX_WORKERS);
    const chunks = [];

    for (let i = 0; i < emails.length; i += chunkSize) {
      chunks.push(emails.slice(i, i + chunkSize));
    }

    // Process chunks in parallel using the incremental script
    const promises = chunks.map((chunk, index) =>
      this.processChunkWithWorker(chunk, index),
    );

    const results = await Promise.all(promises);

    // Aggregate results
    results.forEach((result) => {
      this.progress.processedEmails += result.processed;
      this.progress.stats.phase1Only += result.phase1Only;
      this.progress.stats.phase1And2 += result.phase1And2;
      this.progress.stats.allThreePhases += result.allThreePhases;
      this.progress.stats.totalProcessingTime += result.totalTime;
      this.progress.stats.criticalCount += result.critical;
      this.progress.stats.highValueCount += result.highValue;
      this.progress.stats.totalRevenue += result.revenue;
      this.progress.stats.errors += result.errors;
    });
  }

  private async processChunkWithWorker(
    chunk: any[],
    workerId: number,
  ): Promise<any> {
    // For now, process directly (in production, use actual Worker threads)
    console.log(`   Worker ${workerId}: Processing ${chunk.length} emails`);

    const results = {
      processed: 0,
      phase1Only: 0,
      phase1And2: 0,
      allThreePhases: 0,
      totalTime: 0,
      critical: 0,
      highValue: 0,
      revenue: 0,
      errors: 0,
    };

    // Import the incremental analysis functions
    const { processEmailIncremental } = await import(
      "./analyze-emails-three-phase-incremental.js"
    );

    for (const email of chunk) {
      try {
        const analysisResult = await processEmailIncremental(email, this.db);

        results.processed++;

        // Count phases used
        if (analysisResult.phase3_processing_time) {
          results.allThreePhases++;
        } else if (analysisResult.phase2_processing_time) {
          results.phase1And2++;
        } else {
          results.phase1Only++;
        }

        // Track metrics
        if (analysisResult.priority === "critical") results.critical++;
        if (analysisResult.financial_impact > 10000) results.highValue++;
        results.revenue += analysisResult.financial_impact || 0;

        const totalTime =
          analysisResult.processing_time +
          (analysisResult.phase2_processing_time || 0) +
          (analysisResult.phase3_processing_time || 0);
        results.totalTime += totalTime;
      } catch (error) {
        console.error(`   ❌ Error processing email ${email.id}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  private checkpoint() {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      emailsProcessed: this.progress.processedEmails,
      phase1Count: this.progress.stats.phase1Only,
      phase2Count: this.progress.stats.phase1And2,
      phase3Count: this.progress.stats.allThreePhases,
      avgTimePerEmail:
        this.progress.stats.totalProcessingTime /
        this.progress.processedEmails /
        1000,
    };

    this.progress.checkpoints.push(checkpoint);
    this.saveProgress();

    console.log(`\n💾 Checkpoint saved:`);
    console.log(
      `   Processed: ${checkpoint.emailsProcessed}/${this.progress.totalEmails}`,
    );
    console.log(
      `   Phase distribution: 1=${checkpoint.phase1Count}, 1+2=${checkpoint.phase2Count}, 1+2+3=${checkpoint.phase3Count}`,
    );
    console.log(`   Avg time/email: ${checkpoint.avgTimePerEmail.toFixed(1)}s`);
  }

  private printFinalSummary() {
    const totalTime =
      (Date.now() - new Date(this.progress.startTime).getTime()) / 1000;
    const avgTimePerEmail =
      this.progress.stats.totalProcessingTime /
      this.progress.processedEmails /
      1000;

    console.log("\n" + "=".repeat(70));
    console.log("INCREMENTAL ANALYSIS COMPLETE");
    console.log("=".repeat(70));
    console.log(`📊 Processing Summary:`);
    console.log(
      `   Total emails: ${this.progress.processedEmails.toLocaleString()}`,
    );
    console.log(`   Total time: ${(totalTime / 3600).toFixed(1)} hours`);
    console.log(`   Average per email: ${avgTimePerEmail.toFixed(1)}s`);

    console.log(`\n📈 Phase Distribution:`);
    console.log(
      `   Phase 1 only: ${this.progress.stats.phase1Only.toLocaleString()} (${((this.progress.stats.phase1Only / this.progress.processedEmails) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   Phase 1+2: ${this.progress.stats.phase1And2.toLocaleString()} (${((this.progress.stats.phase1And2 / this.progress.processedEmails) * 100).toFixed(1)}%)`,
    );
    console.log(
      `   All 3 phases: ${this.progress.stats.allThreePhases.toLocaleString()} (${((this.progress.stats.allThreePhases / this.progress.processedEmails) * 100).toFixed(1)}%)`,
    );

    console.log(`\n💰 Business Impact:`);
    console.log(
      `   Critical issues: ${this.progress.stats.criticalCount.toLocaleString()}`,
    );
    console.log(
      `   High-value emails: ${this.progress.stats.highValueCount.toLocaleString()}`,
    );
    console.log(
      `   Total revenue identified: $${this.progress.stats.totalRevenue.toLocaleString()}`,
    );

    console.log(`\n⚡ Performance:`);
    console.log(
      `   Emails per hour: ${Math.round(this.progress.processedEmails / (totalTime / 3600)).toLocaleString()}`,
    );
    console.log(`   Errors: ${this.progress.stats.errors}`);

    // Compare to non-incremental approach
    const nonIncrementalTime = this.progress.processedEmails * 17; // 90/10 split average
    const timeSaved =
      (nonIncrementalTime - this.progress.stats.totalProcessingTime) /
      1000 /
      3600;

    console.log(`\n🎯 Efficiency Gain:`);
    console.log(
      `   Time saved vs 90/10 approach: ${timeSaved.toFixed(1)} hours`,
    );
    console.log(
      `   Quality improvement: Each phase builds on previous insights`,
    );

    // Save final report
    const report = {
      summary: this.progress,
      timestamp: new Date().toISOString(),
      recommendations: [
        "Review critical issues immediately",
        "Follow up on high-value opportunities",
        "Use insights for dashboard population",
        "Schedule regular incremental analysis runs",
      ],
    };

    fs.writeFileSync(
      "./data/incremental-analysis-report.json",
      JSON.stringify(report, null, 2),
    );

    console.log(
      `\n✅ Full report saved to: ./data/incremental-analysis-report.json`,
    );
  }
}

// Dashboard update function
async function updateDashboardWithResults() {
  const db = new Database(CONFIG.DB_PATH);

  // Get actionable insights
  const insights = db
    .prepare(
      `
    SELECT 
      COUNT(*) as total_analyzed,
      SUM(CASE WHEN quick_priority = 'CRITICAL' THEN 1 ELSE 0 END) as critical_count,
      SUM(CASE WHEN quick_priority = 'HIGH' THEN 1 ELSE 0 END) as high_count,
      SUM(CASE WHEN business_impact_revenue > 10000 THEN 1 ELSE 0 END) as high_value_count,
      SUM(CAST(business_impact_revenue AS REAL)) as total_revenue_impact,
      COUNT(DISTINCT CASE WHEN action_summary IS NOT NULL THEN email_id END) as emails_with_actions
    FROM email_analysis
    WHERE quick_model LIKE 'incremental%'
      AND created_at > datetime('now', '-1 day')
  `,
    )
    .get() as any;

  // Get top action items
  const topActions = db
    .prepare(
      `
    SELECT 
      action_summary,
      COUNT(*) as frequency,
      SUM(CAST(business_impact_revenue AS REAL)) as revenue_impact
    FROM email_analysis
    WHERE action_summary IS NOT NULL
      AND quick_model LIKE 'incremental%'
    GROUP BY action_summary
    ORDER BY revenue_impact DESC
    LIMIT 10
  `,
    )
    .all();

  const dashboardData = {
    overview: insights,
    topActionItems: topActions,
    lastUpdated: new Date().toISOString(),
    analysisType: "three-phase-incremental",
  };

  fs.writeFileSync(
    "./data/dashboard-actionable-insights.json",
    JSON.stringify(dashboardData, null, 2),
  );

  console.log("\n📊 Dashboard data updated with actionable insights");

  db.close();
}

// Main execution
async function main() {
  const orchestrator = new IncrementalAnalysisOrchestrator();

  try {
    await orchestrator.run();
    await updateDashboardWithResults();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

// Command line interface
if (process.argv.includes("--help")) {
  console.log(`
Three-Phase Incremental Analysis Runner

Usage:
  npx tsx scripts/run-incremental-analysis-full.ts [options]

Options:
  --help          Show this help message
  --reset         Clear progress and start fresh
  --test          Run on first 100 emails only
  --workers N     Set number of parallel workers (default: ${CONFIG.MAX_WORKERS})

Example:
  npx tsx scripts/run-incremental-analysis-full.ts --workers 5
  `);
  process.exit(0);
}

if (process.argv.includes("--reset")) {
  if (fs.existsSync(CONFIG.PROGRESS_FILE)) {
    fs.unlinkSync(CONFIG.PROGRESS_FILE);
    console.log("✅ Progress file reset");
  }
}

if (process.argv.includes("--workers")) {
  const workerIndex = process.argv.indexOf("--workers");
  if (workerIndex !== -1 && process.argv[workerIndex + 1]) {
    CONFIG.MAX_WORKERS = parseInt(process.argv[workerIndex + 1]);
  }
}

main().catch(console.error);
