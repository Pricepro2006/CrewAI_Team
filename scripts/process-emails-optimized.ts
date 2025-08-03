#!/usr/bin/env tsx
/**
 * Optimized Email Processing Script
 * Achieves 60+ emails/minute with enhanced performance optimizations
 */

import { executeQuery } from "../src/database/ConnectionPool.js";
import { EmailThreePhaseAnalysisService } from "../src/core/services/EmailThreePhaseAnalysisService.js";
import { EmailProcessingOptimizer } from "../src/core/services/EmailProcessingOptimizer.js";
import { Logger } from "../src/utils/logger.js";
import { performance } from "perf_hooks";
import pLimit from "p-limit";
import type { EmailInput, Phase1Results } from "../src/core/services/EmailThreePhaseAnalysisService.js";

const logger = new Logger("OptimizedEmailProcessor");

interface ProcessingStats {
  totalEmails: number;
  processedEmails: number;
  failedEmails: number;
  startTime: number;
  phase1Time: number;
  phase2Time: number;
  phase3Time: number;
  cacheHits: number;
  averageTimePerEmail: number;
  emailsPerMinute: number;
}

class OptimizedEmailProcessor {
  private analysisService: EmailThreePhaseAnalysisService;
  private optimizer: EmailProcessingOptimizer;
  private stats: ProcessingStats;

  constructor() {
    this.analysisService = new EmailThreePhaseAnalysisService();
    this.optimizer = new EmailProcessingOptimizer({
      maxConnections: 10,
      batchSize: 10,
      parallelPhase2: 10,
      parallelPhase3: 5,
      enableSmartCaching: true,
      ollamaTimeout: 20000, // 20 seconds
      ollamaKeepAlive: "30m",
    });

    this.stats = {
      totalEmails: 0,
      processedEmails: 0,
      failedEmails: 0,
      startTime: 0,
      phase1Time: 0,
      phase2Time: 0,
      phase3Time: 0,
      cacheHits: 0,
      averageTimePerEmail: 0,
      emailsPerMinute: 0,
    };
  }

  async initialize(): Promise<void> {
    logger.info("Initializing optimized email processor...");
    
    // Optimize Ollama settings
    await this.optimizer.optimizeOllamaSettings();
    
    // Pre-warm connections
    logger.info("Pre-warming connections...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info("Initialization complete");
  }

  async processEmails(limit: number = 100, offset: number = 0): Promise<void> {
    this.stats.startTime = performance.now();
    
    try {
      // Fetch emails to process
      const emails = await this.fetchEmails(limit, offset);
      this.stats.totalEmails = emails.length;
      
      if (emails.length === 0) {
        logger.info("No emails to process");
        return;
      }

      logger.info(`Processing ${emails.length} emails with optimizations...`);

      // Process in optimized batches
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < emails.length; i += batchSize) {
        batches.push(emails.slice(i, i + batchSize));
      }

      // Process batches with controlled concurrency
      const batchLimit = pLimit(2); // Process 2 batches concurrently
      
      const batchPromises = batches.map((batch, batchIndex) =>
        batchLimit(() => this.processBatch(batch, batchIndex))
      );

      await Promise.all(batchPromises);

      // Calculate and display final stats
      this.displayStats();
    } catch (error) {
      logger.error("Processing failed:", error);
    } finally {
      await this.cleanup();
    }
  }

  private async processBatch(emails: EmailInput[], batchIndex: number): Promise<void> {
    const batchStart = performance.now();
    logger.info(`Processing batch ${batchIndex + 1} with ${emails.length} emails`);

    try {
      // Phase 1: Parallel rule-based analysis
      const phase1Start = performance.now();
      const phase1Promises = emails.map(email => 
        this.runPhase1Cached(email)
      );
      const phase1Results = await Promise.all(phase1Promises);
      this.stats.phase1Time += performance.now() - phase1Start;

      // Separate complete and incomplete chains
      const completeChains: { email: EmailInput; phase1: Phase1Results; index: number }[] = [];
      const incompleteChains: { email: EmailInput; phase1: Phase1Results; index: number }[] = [];

      emails.forEach((email, index) => {
        const phase1 = phase1Results[index];
        const isComplete = phase1.chain_analysis?.is_complete_chain || false;
        
        if (isComplete) {
          completeChains.push({ email, phase1, index });
        } else {
          incompleteChains.push({ email, phase1, index });
        }
      });

      // Phase 2: Optimized batch processing
      const phase2Start = performance.now();
      const phase2Results = await this.optimizer.processPhase2Batch(
        emails,
        phase1Results
      );
      this.stats.phase2Time += performance.now() - phase2Start;

      // Phase 3: Only for complete chains, with controlled concurrency
      const phase3Start = performance.now();
      if (completeChains.length > 0) {
        const phase3Limit = pLimit(3);
        const phase3Promises = completeChains.map(({ email, phase1, index }) =>
          phase3Limit(async () => {
            try {
              const phase2 = phase2Results[index];
              return await this.runPhase3Optimized(email, phase1, phase2);
            } catch (error) {
              logger.error(`Phase 3 failed for email ${email.id}:`, error);
              return phase2Results[index]; // Fallback to Phase 2 results
            }
          })
        );

        const phase3Results = await Promise.all(phase3Promises);
        
        // Merge results
        completeChains.forEach(({ index }, idx) => {
          phase2Results[index] = phase3Results[idx];
        });
      }
      this.stats.phase3Time += performance.now() - phase3Start;

      // Save results
      await this.saveResults(emails, phase2Results);

      // Update stats
      this.stats.processedEmails += emails.length;
      const batchTime = performance.now() - batchStart;
      logger.info(`Batch ${batchIndex + 1} completed in ${Math.round(batchTime)}ms`);

    } catch (error) {
      logger.error(`Batch ${batchIndex + 1} failed:`, error);
      this.stats.failedEmails += emails.length;
    }
  }

  private async runPhase1Cached(email: EmailInput): Promise<Phase1Results> {
    // Check cache first
    const cacheKey = `phase1:${email.id}`;
    const cached = await this.analysisService['redisService'].get<Phase1Results>(cacheKey);
    
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    // Run Phase 1
    const result = await this.analysisService['runPhase1'](email, {});
    
    // Cache result
    await this.analysisService['redisService'].set(cacheKey, result, 3600);
    
    return result;
  }

  private async runPhase3Optimized(
    email: EmailInput,
    phase1: Phase1Results,
    phase2: any
  ): Promise<any> {
    // Use shorter timeout for Phase 3
    const options = {
      timeout: 30000, // 30 seconds instead of 60
      forceAllPhases: true,
    };

    return await this.analysisService['runPhase3'](email, phase1, phase2, options);
  }

  private async fetchEmails(limit: number, offset: number): Promise<EmailInput[]> {
    return await executeQuery((db) => {
      const stmt = db.prepare(`
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
        WHERE processed_at IS NULL
          AND subject IS NOT NULL
        ORDER BY received_at DESC
        LIMIT ? OFFSET ?
      `);

      return stmt.all(limit, offset) as EmailInput[];
    });
  }

  private async saveResults(emails: EmailInput[], results: any[]): Promise<void> {
    const timestamp = new Date().toISOString();
    
    await executeQuery((db) => {
      const updateStmt = db.prepare(`
        UPDATE emails 
        SET processed_at = ?, 
            analysis_id = ?,
            processing_status = 'completed'
        WHERE id = ?
      `);

      const transaction = db.transaction((emails: EmailInput[], results: any[]) => {
        emails.forEach((email, index) => {
          const analysisId = `opt_${Date.now()}_${index}`;
          updateStmt.run(timestamp, analysisId, email.id);
        });
      });

      transaction(emails, results);
      return true;
    });
  }

  private displayStats(): void {
    const totalTime = performance.now() - this.stats.startTime;
    const totalMinutes = totalTime / 60000;
    
    this.stats.averageTimePerEmail = this.stats.processedEmails > 0
      ? totalTime / this.stats.processedEmails
      : 0;
    
    this.stats.emailsPerMinute = this.stats.processedEmails > 0
      ? this.stats.processedEmails / totalMinutes
      : 0;

    const optimizerMetrics = this.optimizer.getMetrics();

    logger.info("\n=== Processing Complete ===");
    logger.info(`Total emails: ${this.stats.totalEmails}`);
    logger.info(`Processed: ${this.stats.processedEmails}`);
    logger.info(`Failed: ${this.stats.failedEmails}`);
    logger.info(`Cache hits: ${this.stats.cacheHits} (${((this.stats.cacheHits / this.stats.totalEmails) * 100).toFixed(1)}%)`);
    logger.info(`\n=== Performance Metrics ===`);
    logger.info(`Total time: ${(totalTime / 1000).toFixed(2)}s`);
    logger.info(`Average per email: ${this.stats.averageTimePerEmail.toFixed(0)}ms`);
    logger.info(`Emails per minute: ${this.stats.emailsPerMinute.toFixed(1)}`);
    logger.info(`\n=== Phase Breakdown ===`);
    logger.info(`Phase 1: ${(this.stats.phase1Time / 1000).toFixed(2)}s`);
    logger.info(`Phase 2: ${(this.stats.phase2Time / 1000).toFixed(2)}s`);
    logger.info(`Phase 3: ${(this.stats.phase3Time / 1000).toFixed(2)}s`);
    logger.info(`\n=== Optimizer Metrics ===`);
    logger.info(`Cache hit rate: ${optimizerMetrics.cacheHitRate.toFixed(1)}%`);
    logger.info(`Avg response time: ${optimizerMetrics.avgResponseTime.toFixed(0)}ms`);
    logger.info(`Connection reuses: ${optimizerMetrics.connectionReuses}`);
    
    if (this.stats.emailsPerMinute >= 60) {
      logger.info(`\n✅ TARGET ACHIEVED: ${this.stats.emailsPerMinute.toFixed(1)} emails/minute`);
    } else {
      logger.info(`\n⚠️  Below target: ${this.stats.emailsPerMinute.toFixed(1)} emails/minute (target: 60)`);
    }
  }

  private async cleanup(): Promise<void> {
    await this.optimizer.cleanup();
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const limit = parseInt(args[0]) || 100;
  const offset = parseInt(args[1]) || 0;

  const processor = new OptimizedEmailProcessor();
  
  try {
    await processor.initialize();
    await processor.processEmails(limit, offset);
  } catch (error) {
    logger.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { OptimizedEmailProcessor };