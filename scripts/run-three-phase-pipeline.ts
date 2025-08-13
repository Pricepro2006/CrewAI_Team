#!/usr/bin/env tsx
/**
 * Run Three-Phase Email Analysis Pipeline
 * Processes emails using the production-ready three-phase approach
 */

import Database from "better-sqlite3";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { EmailThreePhaseBatchProcessor } from "../src/core/processors/EmailThreePhaseBatchProcessor.js";
import { EmailAnalysisCache } from "../src/core/cache/EmailAnalysisCache.js";
import { Logger } from "../src/utils/logger.js";
import { format } from "date-fns";

const logger = new Logger("ThreePhasePipeline");

interface PipelineOptions {
  batchSize?: number;
  concurrency?: number;
  dateFilter?: {
    start: Date;
    end: Date;
  };
  emailFilter?: {
    sender?: string;
    recipient?: string;
    subject?: string;
  };
  limit?: number;
  testMode?: boolean;
}

class ThreePhasePipeline {
  private db: Database.Database;
  private analysisService: EmailThreePhaseAnalysisService;
  private batchProcessor: EmailThreePhaseBatchProcessor;
  private cache: EmailAnalysisCache;

  constructor(databasePath = "./data/crewai.db") {
    this.db = // Use connection pool instead: getDatabaseConnection().getDatabase() or executeQuery((db) => ...)databasePath);
      this.cache = new EmailAnalysisCache({ maxSize: 5000, ttl: 7200000 }); // 2 hour TTL
    this.analysisService = new EmailThreePhaseAnalysisService(databasePath);
    this.batchProcessor = new EmailThreePhaseBatchProcessor(
      this.analysisService,
      this.cache,
      {
        concurrency: 5,
        timeout: 300000, // 5 minutes per email
        useCaching: true,
        retryAttempts: 2,
      },
    );

    this.setupEventHandlers();
  }

  /**
   * Set up event handlers for monitoring
   */
  private setupEventHandlers(): void {
    // Batch progress monitoring
    this.batchProcessor.on("batch:start", ({ total }) => {
      logger.info(`Starting batch processing of ${total} emails`);
    });

    this.batchProcessor.on("batch:progress", (progress) => {
      const percentage = Math.round(progress.percentage);
      logger.info(
        `Progress: ${progress.processed}/${progress.total} (${percentage}%) | ` +
          `Success: ${progress.successful} | Failed: ${progress.failed} | ` +
          `Cache hits: ${progress.cacheHits} | Avg time: ${progress.averageTime}ms`,
      );
    });

    this.batchProcessor.on("batch:complete", (stats) => {
      logger.info("Batch processing complete:", stats);
    });

    // Individual email monitoring
    this.batchProcessor.on("email:phase:start", ({ phase, email }) => {
      logger.debug(`Starting phase ${phase} for email ${email}`);
    });

    this.batchProcessor.on("email:phase:complete", ({ phase, results }) => {
      logger.debug(
        `Phase ${phase} complete in ${results.processing_time || results.phase2_processing_time || results.phase3_processing_time}ms`,
      );
    });

    this.batchProcessor.on("email:error", ({ email, error }) => {
      logger.error(`Error processing email ${email}:`, error);
    });
  }

  /**
   * Get emails from database with filters
   */
  private getEmails(options: PipelineOptions): any[] {
    let query = `
      SELECT 
        id,
        message_id,
        subject,
        body,
        body_preview,
        sender_email,
        sender_name,
        recipient_emails,
        received_at,
        importance,
        has_attachments
      FROM emails
      WHERE 1=1
    `;

    const params: any = {};

    // Date filter
    if (options.dateFilter) {
      query += ` AND received_at BETWEEN @start AND @end`;
      params.start = options.dateFilter.start.toISOString();
      params.end = options.dateFilter.end.toISOString();
    }

    // Email filters
    if (options.emailFilter?.sender) {
      query += ` AND sender_email LIKE @sender`;
      params.sender = `%${options.emailFilter.sender}%`;
    }

    if (options.emailFilter?.recipient) {
      query += ` AND recipient_emails LIKE @recipient`;
      params.recipient = `%${options.emailFilter.recipient}%`;
    }

    if (options.emailFilter?.subject) {
      query += ` AND subject LIKE @subject`;
      params.subject = `%${options.emailFilter.subject}%`;
    }

    // Order by most recent first
    query += ` ORDER BY received_at DESC`;

    // Limit
    if (options.limit) {
      query += ` LIMIT @limit`;
      params.limit = options.limit;
    }

    const stmt = this.db.prepare(query);
    return stmt.all(params);
  }

  /**
   * Run the three-phase pipeline
   */
  async run(options: PipelineOptions = {}): Promise<void> {
    logger.info("=".repeat(60));
    logger.info("THREE-PHASE EMAIL ANALYSIS PIPELINE");
    logger.info("=".repeat(60));

    // Set defaults
    const pipelineOptions: Required<PipelineOptions> = {
      batchSize: options.batchSize || 100,
      concurrency: options.concurrency || 5,
      dateFilter: options.dateFilter || {
        start: new Date("2025-01-01"),
        end: new Date(),
      },
      emailFilter: options.emailFilter || {},
      limit: options.limit || (options.testMode ? 20 : 1000),
      testMode: options.testMode || false,
    };

    logger.info("Pipeline configuration:", pipelineOptions);

    try {
      // Get emails
      const emails = this.getEmails(pipelineOptions);
      logger.info(`Found ${emails.length} emails to process`);

      if (emails.length === 0) {
        logger.warn("No emails found matching criteria");
        return;
      }

      // Update batch processor settings
      this.batchProcessor.updateOptions({
        concurrency: pipelineOptions.concurrency,
      });

      // Process emails
      const startTime = Date.now();
      let results;

      if (emails.length > pipelineOptions.batchSize) {
        // Process in chunks for large datasets
        results = await this.batchProcessor.processLargeBatch(
          emails,
          pipelineOptions.batchSize,
        );
      } else {
        // Process all at once for small datasets
        results = await this.batchProcessor.processBatch(emails);
      }

      const totalTime = Date.now() - startTime;

      // Generate summary report
      this.generateReport(results, totalTime, pipelineOptions);
    } catch (error) {
      logger.error("Pipeline error:", error);
      throw error;
    }
  }

  /**
   * Generate analysis report
   */
  private generateReport(
    results: any[],
    totalTime: number,
    options: Required<PipelineOptions>,
  ): void {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    const fromCache = results.filter((r) => r.fromCache);

    // Phase distribution
    const phaseDistribution = {
      phase1: 0,
      phase2: 0,
      phase3: 0,
    };

    successful.forEach((r) => {
      if (r.phasesCompleted >= 1) phaseDistribution.phase1++;
      if (r.phasesCompleted >= 2) phaseDistribution.phase2++;
      if (r.phasesCompleted >= 3) phaseDistribution.phase3++;
    });

    // Priority distribution
    const priorityDist: Record<string, number> = {};
    successful.forEach((r) => {
      const priority = r.analysis?.priority || "unknown";
      priorityDist[priority] = (priorityDist[priority] || 0) + 1;
    });

    // Workflow state distribution
    const workflowDist: Record<string, number> = {};
    successful.forEach((r) => {
      const state = r.analysis?.workflow_state || "unknown";
      workflowDist[state] = (workflowDist[state] || 0) + 1;
    });

    // Financial impact
    const totalFinancialImpact = successful.reduce(
      (sum, r) => sum + (r.analysis?.financial_impact || 0),
      0,
    );

    // Report
    console.log("\n" + "=".repeat(60));
    console.log("THREE-PHASE ANALYSIS REPORT");
    console.log("=".repeat(60));
    console.log(`Total emails processed: ${results.length}`);
    console.log(
      `Successful: ${successful.length} (${Math.round((successful.length / results.length) * 100)}%)`,
    );
    console.log(`Failed: ${failed.length}`);
    console.log(`From cache: ${fromCache.length}`);
    console.log(`Total processing time: ${(totalTime / 1000).toFixed(1)}s`);
    console.log(
      `Average time per email: ${Math.round(totalTime / results.length)}ms`,
    );
    console.log(
      `Throughput: ${(results.length / (totalTime / 1000)).toFixed(1)} emails/second`,
    );

    console.log("\nPhase Distribution:");
    console.log(`  Phase 1 completed: ${phaseDistribution.phase1}`);
    console.log(`  Phase 2 completed: ${phaseDistribution.phase2}`);
    console.log(`  Phase 3 completed: ${phaseDistribution.phase3}`);

    console.log("\nPriority Distribution:");
    Object.entries(priorityDist)
      .sort(([, a], [, b]) => b - a)
      .forEach(([priority, count]) => {
        console.log(`  ${priority}: ${count}`);
      });

    console.log("\nWorkflow State Distribution:");
    Object.entries(workflowDist)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([state, count]) => {
        console.log(`  ${state}: ${count}`);
      });

    console.log(
      `\nTotal Financial Impact Identified: $${totalFinancialImpact.toLocaleString()}`,
    );

    // Cache statistics
    const cacheStats = this.cache.getStats();
    console.log("\nCache Statistics:");
    console.log(`  Hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Cache size: ${cacheStats.size}`);

    // Failures
    if (failed.length > 0) {
      console.log("\n" + "=".repeat(60));
      console.log("FAILED EMAILS:");
      failed.slice(0, 10).forEach((f) => {
        console.log(`  - ${f.emailId}: ${f.error}`);
      });
      if (failed.length > 10) {
        console.log(`  ... and ${failed.length - 10} more`);
      }
    }

    console.log("\n" + "=".repeat(60));
  }

  /**
   * Run analysis on specific email IDs
   */
  async analyzeSpecificEmails(emailIds: string[]): Promise<void> {
    logger.info(`Analyzing ${emailIds.length} specific emails`);

    const emails = this.db
      .prepare(
        `
      SELECT * FROM emails WHERE id IN (${emailIds.map(() => "?").join(",")})
    `,
      )
      .all(...emailIds);

    if (emails.length !== emailIds.length) {
      logger.warn(
        `Only found ${emails.length} of ${emailIds.length} requested emails`,
      );
    }

    const results = await this.batchProcessor.processBatch(emails);

    // Detailed results for specific emails
    results.forEach((r) => {
      console.log("\n" + "-".repeat(60));
      console.log(`Email: ${r.emailId}`);
      console.log(`Success: ${r.success}`);
      console.log(`Processing time: ${r.processingTime}ms`);
      console.log(`Phases completed: ${r.phasesCompleted}`);

      if (r.analysis) {
        console.log(`Priority: ${r.analysis.priority}`);
        console.log(`Workflow: ${r.analysis.workflow_state}`);
        console.log(`Financial impact: $${r.analysis.financial_impact}`);
        console.log(`Confidence: ${r.analysis.confidence}`);

        if (r.analysis.action_items?.length > 0) {
          console.log("Action items:");
          r.analysis.action_items.forEach((item: any) => {
            console.log(`  - ${item.task} (${item.owner}, ${item.deadline})`);
          });
        }

        if (r.analysis.strategic_insights) {
          console.log("Strategic insights:");
          console.log(
            `  Opportunity: ${r.analysis.strategic_insights.opportunity}`,
          );
          console.log(`  Risk: ${r.analysis.strategic_insights.risk}`);
        }
      }

      if (r.error) {
        console.log(`Error: ${r.error}`);
      }
    });
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    await this.batchProcessor.shutdown();
    this.db.close();
  }
}

// CLI interface
async function main() {
  const pipeline = new ThreePhasePipeline();

  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const testMode = args.includes("--test");
    const specificIds = args
      .find((arg) => arg.startsWith("--ids="))
      ?.split("=")[1]
      ?.split(",");
    const limit = parseInt(
      args.find((arg) => arg.startsWith("--limit="))?.split("=")[1] || "0",
    );
    const concurrency = parseInt(
      args.find((arg) => arg.startsWith("--concurrency="))?.split("=")[1] ||
        "5",
    );

    if (specificIds) {
      // Analyze specific emails
      await pipeline.analyzeSpecificEmails(specificIds);
    } else {
      // Run full pipeline
      await pipeline.run({
        testMode,
        limit: limit || (testMode ? 20 : 1000),
        concurrency,
        dateFilter: {
          start: new Date("2025-01-01"),
          end: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error("Pipeline failed:", error);
    process.exit(1);
  } finally {
    await pipeline.shutdown();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ThreePhasePipeline };
