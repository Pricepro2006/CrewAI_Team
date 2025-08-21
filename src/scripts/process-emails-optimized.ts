#!/usr/bin/env node
/**
 * Optimized Email Processing Script
 * Achieves 60+ emails/minute throughput
 */

import { program } from "commander";
import { performance } from "perf_hooks";
import { logger } from "../utils/logger";
import { executeQuery } from "../database/ConnectionPool";
import { OllamaOptimizer } from "../core/services/OllamaOptimizer";
import { OptimizedEmailProcessor } from "../core/services/OptimizedEmailProcessor";
import { redisService } from "../core/cache/RedisService";

interface ProcessingOptions {
  mode: "speed" | "balanced" | "quality";
  batchSize: number;
  limit?: number;
  fromDate?: string;
  priority?: string;
  dryRun: boolean;
  monitor: boolean;
}

class OptimizedEmailProcessingScript {
  private optimizer: OllamaOptimizer;
  private processor: OptimizedEmailProcessor;
  private monitorInterval?: NodeJS.Timeout;

  constructor() {
    // Initialize with optimized settings
    this.optimizer = new OllamaOptimizer("http://localhost:8081", {
      maxConcurrentInference: 25,
      queueConcurrency: 20,
      enableBatching: true,
      maxBatchSize: 10,
      enableGPU: true,
      preloadModels: ["llama3.2:3b", "qwen3:0.6b"],
      modelKeepAlive: 300
    });

    this.processor = new OptimizedEmailProcessor(this.optimizer);
  }

  async run(options: ProcessingOptions): Promise<void> {
    const startTime = performance.now();
    
    logger.info("Starting optimized email processing", JSON.stringify({
      mode: options.mode,
      batchSize: options.batchSize,
      limit: options.limit || "all"
    }));

    try {
      // Connect to Redis
      // Redis service connection handled internally

      // Update processor mode
      this?.processor?.updateMode(options.mode);

      // Start monitoring if requested
      if (options.monitor) {
        this.startMonitoring();
      }

      // Fetch emails to process
      const emails = await this.fetchEmails(options);
      
      if (emails?.length || 0 === 0) {
        logger.info("No emails to process");
        return;
      }

      logger.info(`Found ${emails?.length || 0} emails to process`);

      if (options.dryRun) {
        logger.info("DRY RUN - Not processing emails");
        this.printEmailSummary(emails);
        return;
      }

      // Set up event listeners
      this.setupEventListeners();

      // Process emails
      await this?.processor?.processEmails(emails);

      // Get final metrics
      const metrics = this?.processor?.getMetrics();
      const totalTime = (performance.now() - startTime) / 1000;

      // Print results
      this.printResults(metrics, totalTime);

    } catch (error) {
      logger.error("Processing failed:", error as string);
      process.exit(1);
    } finally {
      // Cleanup
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
      }
      await this?.optimizer?.shutdown();
      await redisService.close();
    }
  }

  private async fetchEmails(options: ProcessingOptions): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    // Add date filter
    if (options.fromDate) {
      conditions.push("received_at >= ?");
      params.push(options.fromDate);
    }

    // Add priority filter
    if (options.priority) {
      conditions.push("importance = ?");
      params.push(options.priority);
    }

    // Build query
    let query = `
      SELECT 
        e.id,
        e.message_id,
        e.subject,
        e.body,
        e.body_preview,
        e.sender_email,
        e.sender_name,
        e.recipient_emails,
        e.received_at,
        e.importance,
        e.has_attachments,
        ec.chain_id,
        ec.position_in_chain,
        ec.is_complete_chain,
        ec.completeness_score
      FROM emails e
      LEFT JOIN email_chains ec ON e.id = ec.email_id
      WHERE 1=1
    `;

    if (conditions?.length || 0 > 0) {
      query += " AND " + conditions.join(" AND ");
    }

    // Add ordering and limit
    query += " ORDER BY e.received_at DESC";
    
    if (options.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    return executeQuery((db: any) => {
      const stmt = db.prepare(query);
      return stmt.all(...params);
    });
  }

  private setupEventListeners(): void {
    this?.processor?.on("processing:start", (data: any) => {
      logger.info(`Processing started: ${data.total} emails`);
    });

    this?.processor?.on("processing:progress", (data: any) => {
      const percentage = data?.percentage?.toFixed(1);
      logger.info(`Progress: ${data.processed}/${data.total} (${percentage}%)`);
    });

    this?.processor?.on("email:complete", (data: any) => {
      logger.debug(`Email ${data.emailId} completed in ${data?.processingTime?.toFixed(0)}ms`);
    });

    this?.processor?.on("email:error", (data: any) => {
      logger.error(`Email ${data.emailId} failed:`, data.error);
    });
  }

  private startMonitoring(): void {
    logger.info("Starting performance monitoring...");
    
    this.monitorInterval = setInterval(() => {
      const metrics = this?.processor?.getMetrics();
      const ollamaMetrics = metrics?.ollamaMetrics;
      
      console.log("\n📊 Performance Monitor:");
      console.log("=======================");
      console.log(`Throughput: ${metrics?.throughput?.toFixed(2)} emails/second`);
      console.log(`Success Rate: ${((metrics.successfulEmails / metrics.processedEmails) * 100).toFixed(1)}%`);
      console.log(`Cache Hit Rate: ${((metrics.cacheHits / metrics.processedEmails) * 100).toFixed(1)}%`);
      console.log(`Average Latency: ${metrics?.averageLatency?.toFixed(0)}ms`);
      console.log(`\nPhase Times:`);
      console.log(`  Phase 1: ${metrics?.phase1AvgTime?.toFixed(0)}ms`);
      console.log(`  Phase 2: ${metrics?.phase2AvgTime?.toFixed(0)}ms`);
      console.log(`  Phase 3: ${metrics?.phase3AvgTime?.toFixed(0)}ms`);
      console.log(`\nOllama Stats:`);
      console.log(`  Queue Size: ${ollamaMetrics.queueSize}`);
      console.log(`  Pending Batches: ${ollamaMetrics.pendingBatches}`);
      console.log(`  Total Throughput: ${ollamaMetrics?.totalThroughput?.toFixed(2)} req/s`);
      
      if (ollamaMetrics?.modelMetrics?.length > 0) {
        console.log(`\nModel Performance:`);
        ollamaMetrics?.modelMetrics?.forEach((m: any) => {
          console.log(`  ${m.model}:`);
          console.log(`    Requests: ${m?.stats?.totalRequests}`);
          console.log(`    Avg Latency: ${m?.stats?.averageLatency.toFixed(0)}ms`);
          console.log(`    P95 Latency: ${m?.stats?.p95Latency.toFixed(0)}ms`);
          console.log(`    Throughput: ${m?.stats?.throughput.toFixed(2)} req/s`);
        });
      }
    }, 5000); // Every 5 seconds
  }

  private printEmailSummary(emails: any[]): void {
    console.log("\nEmail Summary:");
    console.log("=============");
    
    const priorities = emails.reduce((acc: any, email: any) => {
      const priority = email.importance || "normal";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("By Priority:");
    Object.entries(priorities).forEach(([priority, count]) => {
      console.log(`  ${priority}: ${count}`);
    });

    const complete = emails?.filter(e => e.is_complete_chain).length;
    console.log(`\nComplete chains: ${complete}/${emails?.length || 0}`);
  }

  private printResults(metrics: any, totalTime: number): void {
    console.log("\n✅ Processing Complete!");
    console.log("======================");
    console.log(`Total Emails: ${metrics.totalEmails}`);
    console.log(`Successful: ${metrics.successfulEmails}`);
    console.log(`Failed: ${metrics.failedEmails}`);
    console.log(`Cache Hits: ${metrics.cacheHits}`);
    console.log(`\nPerformance:`);
    console.log(`Total Time: ${totalTime.toFixed(2)} seconds`);
    console.log(`Throughput: ${metrics?.throughput?.toFixed(2)} emails/second`);
    console.log(`           (${(metrics.throughput * 60).toFixed(0)} emails/minute)`);
    console.log(`\nPhase Breakdown:`);
    console.log(`Phase 1 Avg: ${metrics?.phase1AvgTime?.toFixed(0)}ms`);
    console.log(`Phase 2 Avg: ${metrics?.phase2AvgTime?.toFixed(0)}ms`);
    console.log(`Phase 3 Avg: ${metrics?.phase3AvgTime?.toFixed(0)}ms`);
    
    // Check if we met the target
    const emailsPerMinute = metrics.throughput * 60;
    if (emailsPerMinute >= 60) {
      console.log("\n🎉 TARGET ACHIEVED! Processing at 60+ emails/minute!");
    } else {
      console.log(`\n⚠️  Below target. Need ${(60 - emailsPerMinute).toFixed(0)} more emails/minute`);
    }
  }
}

// CLI setup
program
  .name("process-emails-optimized")
  .description("Process emails with optimized throughput")
  .option("-m, --mode <mode>", "Processing mode: speed, balanced, quality", "balanced")
  .option("-b, --batch-size <size>", "Batch size for processing", "10")
  .option("-l, --limit <count>", "Limit number of emails to process")
  .option("-f, --from-date <date>", "Process emails from this date (YYYY-MM-DD)")
  .option("-p, --priority <level>", "Filter by priority: low, normal, high")
  .option("--dry-run", "Show what would be processed without actually processing")
  .option("--monitor", "Enable real-time performance monitoring")
  .action(async (options: any) => {
    const script = new OptimizedEmailProcessingScript();
    
    const processOptions: ProcessingOptions = {
      mode: options.mode as any,
      batchSize: parseInt(options.batchSize),
      limit: options.limit ? parseInt(options.limit) : undefined,
      fromDate: options.fromDate,
      priority: options.priority,
      dryRun: options.dryRun || false,
      monitor: options.monitor || false
    };
    
    await script.run(processOptions);
  });

// Run if called directly
if (require.main === module) {
  program.parse();
}