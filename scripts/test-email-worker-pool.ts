#!/usr/bin/env tsx

/**
 * Test Email Worker Pool with TypeScript Loading
 * 
 * Verifies that the EmailProcessingWorkerPool can successfully spawn
 * TypeScript workers and process jobs.
 */

import { EmailProcessingWorkerPool } from "../src/core/workers/EmailProcessingWorkerPool.js";
import { Logger } from "../src/utils/logger.js";
import Redis from "ioredis";
import type { EmailProcessingJob } from "../src/core/workers/EmailProcessingWorkerPool.js";

const logger = new Logger("WorkerPoolTest");

async function createTestJob(id: number): Promise<EmailProcessingJob> {
  return {
    id: `test-job-${id}`,
    conversationId: `test-conversation-${id}`,
    emails: [
      {
        id: `email-${id}-1`,
        subject: `Test Email ${id}`,
        body: `This is a test email body for job ${id}`,
        sender_email: `sender${id}@test.com`,
        received_at: new Date().toISOString(),
        conversation_id: `test-conversation-${id}`
      }
    ],
    priority: "medium",
    options: {
      skipCache: true,
      timeout: 30000
    }
  };
}

async function main() {
  logger.info("Starting Email Worker Pool Test");
  logger.info("==============================");
  
  // Create Redis connection
  const redis = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: 3
  });
  
  // Test Redis connection
  try {
    await redis.ping();
    logger.info("✅ Redis connection successful");
  } catch (error) {
    logger.error("❌ Redis connection failed:", error);
    logger.info("Make sure Redis is running: docker run -d -p 6379:6379 redis:alpine");
    process.exit(1);
  }
  
  // Create worker pool
  const pool = new EmailProcessingWorkerPool({
    minWorkers: 2,
    maxWorkers: 4,
    idleTimeout: 60000,
    maxJobsPerWorker: 10,
    workerScriptPath: "./src/core/workers/EmailProcessingWorker.ts",
    redisConnection: redis,
    enableAutoScaling: true,
    scaleUpThreshold: 5,
    scaleDownThreshold: 1,
    maxMemoryPerWorker: 256,
    enableMetrics: true
  });
  
  // Listen to pool events
  pool.on("initialized", (data) => {
    logger.info("✅ Worker pool initialized", data);
  });
  
  pool.on("workerCreated", (data) => {
    logger.info("👷 Worker created", data);
  });
  
  pool.on("workerError", (data) => {
    logger.error("❌ Worker error", data);
  });
  
  pool.on("jobComplete", (data) => {
    logger.info("✅ Job completed", data);
  });
  
  pool.on("jobFailed", (data) => {
    logger.error("❌ Job failed", data);
  });
  
  pool.on("metrics", (metrics) => {
    logger.debug("📊 Pool metrics", metrics);
  });
  
  // Wait for initialization
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Create and add test jobs
    logger.info("\nAdding test jobs to queue...");
    const jobs: EmailProcessingJob[] = [];
    
    for (let i = 1; i <= 5; i++) {
      jobs.push(await createTestJob(i));
    }
    
    await pool.addJobs(jobs);
    logger.info(`Added ${jobs.length} jobs to the queue`);
    
    // Wait for processing
    logger.info("\nWaiting for job processing...");
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get final metrics
    const metrics = pool.getPoolMetrics();
    logger.info("\nFinal Pool Metrics:");
    logger.info("==================");
    logger.info(`Active Workers: ${metrics.activeWorkers}`);
    logger.info(`Idle Workers: ${metrics.idleWorkers}`);
    logger.info(`Total Processed: ${metrics.totalProcessed}`);
    logger.info(`Total Failed: ${metrics.totalFailed}`);
    logger.info(`Average Processing Time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
    logger.info(`Throughput: ${metrics.throughput.toFixed(2)} jobs/min`);
    
    // Get worker metrics
    const workerMetrics = pool.getWorkerMetrics();
    logger.info("\nWorker Metrics:");
    logger.info("==============");
    workerMetrics.forEach(wm => {
      logger.info(`Worker ${wm.workerId}:`);
      logger.info(`  - Processed: ${wm.processedJobs}`);
      logger.info(`  - Failed: ${wm.failedJobs}`);
      logger.info(`  - Avg Time: ${wm.averageProcessingTime.toFixed(2)}ms`);
      logger.info(`  - Memory: ${(wm.currentMemoryUsage / 1024 / 1024).toFixed(2)}MB`);
    });
    
  } catch (error) {
    logger.error("Test failed:", error);
  } finally {
    // Cleanup
    logger.info("\nShutting down worker pool...");
    await pool.shutdown();
    await redis.quit();
    logger.info("✅ Test completed");
  }
}

// Run the test
main().catch((error) => {
  logger.error("Fatal error:", error);
  process.exit(1);
});