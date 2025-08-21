/**
 * Email Processing Performance Benchmark Tests
 *
 * Validates that the optimized pipeline meets performance targets.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { performance } from "perf_hooks";
import Database from "better-sqlite3";
import { Redis } from "ioredis";
import { EmailProcessingWorkerPool } from '../../core/workers/EmailProcessingWorkerPool';
import { EmailProcessingQueueService } from '../../core/services/EmailProcessingQueueService';
import { EmailProcessingMonitor } from '../../core/monitoring/EmailProcessingMonitor';
import { OllamaManager } from '../../utils/ollama-manager';
import type {
  EmailProcessingJob,
  EmailJobData,
} from '../../core/workers/EmailProcessingWorkerPool';

// Test configuration
const TEST_CONFIG = {
  SAMPLE_SIZE: 100, // Number of test emails
  WORKER_COUNT: 4,
  EXPECTED_THROUGHPUT_MIN: 50, // emails per minute
  EXPECTED_LATENCY_MAX: 2500, // milliseconds per email
  EXPECTED_SUCCESS_RATE_MIN: 95, // percentage
};

describe("Email Processing Performance Benchmarks", () => {
  let db: Database.Database;
  let redis: Redis;
  let workerPool: EmailProcessingWorkerPool;
  let queueService: EmailProcessingQueueService;
  let monitor: EmailProcessingMonitor;
  let testEmails: EmailJobData[];

  beforeAll(async () => {
    // Initialize test database
    db = new Database(":memory:");
    setupTestDatabase(db);

    // Initialize Redis
    redis = new Redis({
      host: "localhost",
      port: 6379,
      db: 15, // Use separate DB for tests
    });
    await redis.flushdb();

    // Ensure LLM server is running
    const ollamaReady = await OllamaManager.initialize(["llama3.2:3b"]);
    if (!ollamaReady) {
      throw new Error("Ollama service is required for performance tests");
    }

    // Generate test emails
    testEmails = generateTestEmails(TEST_CONFIG.SAMPLE_SIZE);

    // Initialize services
    monitor = new EmailProcessingMonitor({
      enableDashboard: false,
      enableLogging: false,
    });

    queueService = new EmailProcessingQueueService({
      redis: { host: "localhost", port: 6379, db: 15 },
      monitoring: {
        enableMetrics: true,
        enableEvents: true,
        metricsInterval: 1000,
      },
    });

    workerPool = new EmailProcessingWorkerPool({
      minWorkers: TEST_CONFIG.WORKER_COUNT,
      maxWorkers: TEST_CONFIG.WORKER_COUNT,
      workerScriptPath: "./src/core/workers/EmailProcessingWorker.ts",
      redisConnection: redis,
      enableAutoScaling: false,
      enableMetrics: true,
    });

    // Wait for initialization
    await new Promise((resolve: any) => setTimeout(resolve, 3000));
  }, 60000); // 60 second timeout for setup

  afterAll(async () => {
    await workerPool?.shutdown();
    await queueService?.shutdown();
    monitor?.stop();
    await redis.quit();
    db?.close();
  });

  it(
    "should achieve target throughput",
    async () => {
      const startTime = performance.now();
      let processedCount = 0;

      // Set up monitoring
      workerPool.on("jobComplete", ({ emailCount }) => {
        processedCount += emailCount;
        monitor.recordJobCompletion(emailCount, 1000); // Mock processing time
      });

      // Create jobs
      const jobs: EmailProcessingJob[] = createTestJobs(testEmails);

      // Add jobs to queue
      await workerPool.addJobs(jobs);

      // Wait for completion with timeout
      const timeout = 5 * 60 * 1000; // 5 minutes
      const checkInterval = 500;
      let elapsed = 0;

      while (processedCount < testEmails?.length || 0 && elapsed < timeout) {
        await new Promise((resolve: any) => setTimeout(resolve, checkInterval));
        elapsed += checkInterval;
      }

      const totalTime = performance.now() - startTime;
      const throughput = processedCount / (totalTime / 60000); // emails per minute

      console.log(`Throughput: ${throughput.toFixed(1)} emails/minute`);

      expect(throughput).toBeGreaterThanOrEqual(
        TEST_CONFIG.EXPECTED_THROUGHPUT_MIN,
      );
    },
    10 * 60 * 1000,
  ); // 10 minute timeout

  it("should maintain low latency", async () => {
    const latencies: number[] = [];

    // Process a small batch to measure latency
    const batchSize = 10;
    const batchEmails = testEmails.slice(0, batchSize);
    const jobs = createTestJobs(batchEmails);

    // Track individual job latencies
    const jobPromises = jobs?.map(async (job: any) => {
      const startTime = performance.now();
      await workerPool.addJobs([job]);

      return new Promise<number>((resolve: any) => {
        const handler = ({ conversationId }: any) => {
          if (conversationId === job.conversationId) {
            workerPool.off("jobComplete", handler);
            const latency = performance.now() - startTime;
            resolve(latency / job?.emails?.length); // Average per email
          }
        };
        workerPool.on("jobComplete", handler);
      });
    });

    const results = await Promise.all(jobPromises);
    latencies.push(...results);

    const averageLatency =
      latencies.reduce((sum: any, l: any) => sum + l, 0) / latencies?.length || 0;
    console.log(`Average latency: ${averageLatency.toFixed(0)}ms per email`);

    expect(averageLatency).toBeLessThanOrEqual(
      TEST_CONFIG.EXPECTED_LATENCY_MAX,
    );
  }, 60000);

  it("should handle concurrent processing efficiently", async () => {
    const concurrentBatches = 5;
    const emailsPerBatch = 20;

    // Create concurrent jobs
    const batches = Array.from({ length: concurrentBatches }, (_, i) => {
      const start = i * emailsPerBatch;
      const emails = testEmails.slice(start, start + emailsPerBatch);
      return createTestJobs(emails);
    });

    const startTime = performance.now();

    // Process all batches concurrently
    const results = await Promise.all(
      batches?.map((jobs: any) => processJobBatch(workerPool, jobs)),
    );

    const totalTime = performance.now() - startTime;
    const totalEmails = concurrentBatches * emailsPerBatch;
    const throughput = totalEmails / (totalTime / 60000);

    console.log(
      `Concurrent processing throughput: ${throughput.toFixed(1)} emails/minute`,
    );

    // Should maintain good throughput under concurrent load
    expect(throughput).toBeGreaterThanOrEqual(
      TEST_CONFIG.EXPECTED_THROUGHPUT_MIN * 0.8,
    );
  }, 120000);

  it("should maintain high success rate", async () => {
    const testBatch = testEmails.slice(0, 50);
    const jobs = createTestJobs(testBatch);

    let successCount = 0;
    let errorCount = 0;

    workerPool.on("jobComplete", ({ emailCount }) => {
      successCount += emailCount;
    });

    workerPool.on("jobFailed", ({ emailCount }) => {
      errorCount += emailCount || 1;
    });

    await workerPool.addJobs(jobs);

    // Wait for completion
    await new Promise((resolve: any) => {
      const interval = setInterval(() => {
        if (successCount + errorCount >= testBatch?.length || 0) {
          clearInterval(interval);
          resolve(undefined);
        }
      }, 100);
    });

    const successRate = (successCount / testBatch?.length || 0) * 100;
    console.log(`Success rate: ${successRate.toFixed(1)}%`);

    expect(successRate).toBeGreaterThanOrEqual(
      TEST_CONFIG.EXPECTED_SUCCESS_RATE_MIN,
    );
  }, 60000);

  it(
    "should scale workers effectively",
    async () => {
      // Test with different worker counts
      const workerCounts = [1, 2, 4, 8];
      const results: { workers: number; throughput: number }[] = [];

      for (const count of workerCounts) {
        // Create new pool with specific worker count
        const testPool = new EmailProcessingWorkerPool({
          minWorkers: count,
          maxWorkers: count,
          workerScriptPath: "./src/core/workers/EmailProcessingWorker.ts",
          redisConnection: redis,
          enableAutoScaling: false,
        });

        await new Promise((resolve: any) => setTimeout(resolve, 2000));

        // Measure throughput
        const throughput = await measureThroughput(
          testPool,
          testEmails.slice(0, 50),
        );
        results.push({ workers: count, throughput });

        await testPool.shutdown();
      }

      console.log("Worker scaling results:");
      results.forEach((r: any) => {
        console.log(
          `  ${r.workers} workers: ${r?.throughput?.toFixed(1)} emails/min`,
        );
      });

      // Throughput should increase with more workers (with diminishing returns)
      expect(results[1].throughput).toBeGreaterThan(
        results[0].throughput * 1.5,
      );
      expect(results[2].throughput).toBeGreaterThan(
        results[1].throughput * 1.3,
      );
    },
    5 * 60 * 1000,
  );

  it("should handle memory efficiently", async () => {
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;

    // Process a large batch
    const largeBatch = generateTestEmails(500);
    const jobs = createTestJobs(largeBatch);

    await workerPool.addJobs(jobs);

    // Monitor memory during processing
    const memoryReadings: number[] = [];
    const memoryInterval = setInterval(() => {
      memoryReadings.push(process.memoryUsage().heapUsed / 1024 / 1024);
    }, 1000);

    // Wait for completion
    await new Promise((resolve: any) => setTimeout(resolve, 60000));
    clearInterval(memoryInterval);

    const peakMemory = Math.max(...memoryReadings);
    const memoryIncrease = peakMemory - initialMemory;

    console.log(
      `Memory usage - Initial: ${initialMemory.toFixed(0)}MB, Peak: ${peakMemory.toFixed(0)}MB, Increase: ${memoryIncrease.toFixed(0)}MB`,
    );

    // Memory increase should be reasonable (less than 500MB for 500 emails)
    expect(memoryIncrease).toBeLessThan(500);
  }, 120000);

  it("should show significant improvement over sequential processing", async () => {
    const testBatch = testEmails.slice(0, 20);

    // Measure parallel processing time
    const parallelStart = performance.now();
    const parallelJobs = createTestJobs(testBatch);
    await processJobBatch(workerPool, parallelJobs);
    const parallelTime = performance.now() - parallelStart;

    // Simulate sequential processing time (20 seconds per email)
    const sequentialTime = testBatch?.length || 0 * 20000; // 20s per email

    const improvement =
      ((sequentialTime - parallelTime) / sequentialTime) * 100;
    const speedup = sequentialTime / parallelTime;

    console.log(`Performance improvement: ${improvement.toFixed(1)}%`);
    console.log(`Speedup: ${speedup.toFixed(1)}x faster`);
    console.log(
      `Parallel: ${(parallelTime / 1000).toFixed(1)}s vs Sequential: ${(sequentialTime / 1000).toFixed(1)}s`,
    );

    // Should be at least 80% faster
    expect(improvement).toBeGreaterThanOrEqual(80);
  }, 120000);
});

// Helper functions

function setupTestDatabase(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emails_enhanced (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      subject TEXT,
      body_content TEXT,
      sender_email TEXT,
      received_date_time TEXT,
      workflow_state TEXT,
      priority TEXT,
      confidence_score REAL,
      analyzed_at TEXT,
      chain_completeness_score INTEGER,
      is_chain_complete INTEGER,
      extracted_entities TEXT,
      analysis_phases INTEGER,
      status TEXT,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conversation_id ON emails_enhanced(conversation_id);
  `);
}

function generateTestEmails(count: number): EmailJobData[] {
  const emails: EmailJobData[] = [];
  const conversations = Math.ceil(count / 5); // Average 5 emails per conversation

  for (let i = 0; i < count; i++) {
    const conversationId = `conv_${Math.floor(i / 5)}`;
    emails.push({
      id: `email_${i}`,
      subject: generateSubject(i),
      body: generateBody(i),
      sender_email: `sender${i % 10}@example.com`,
      received_at: new Date(Date.now() - i * 3600000).toISOString(),
      conversation_id: conversationId,
    });
  }

  return emails;
}

function generateSubject(index: number): string {
  const subjects = [
    "Urgent: Quote Request for Enterprise Servers",
    "RE: Order #PO1234567 - Status Update",
    "High Priority: System Outage - Need Immediate Support",
    "FW: Bulk Order Inquiry - 500 Units",
    "Meeting Request: Quarterly Business Review",
  ];
  return subjects[index % subjects?.length || 0];
}

function generateBody(index: number): string {
  const bodies = [
    "We need a quote for 50 enterprise servers model HP-DL380. This is urgent as we have a deadline of next week. Please include expedited shipping options.",
    "Following up on our previous order. Can you provide the current status and expected delivery date? The PO number is #1234567890.",
    "We are experiencing a critical system failure and need immediate support. Multiple production systems are affected. Please escalate to senior support.",
    "We are interested in placing a bulk order for 500 units of product SKU-12345. Please provide volume discount pricing and delivery timeline.",
    "I would like to schedule our quarterly business review to discuss performance metrics and upcoming opportunities.",
  ];
  return bodies[index % bodies?.length || 0];
}

function createTestJobs(emails: EmailJobData[]): EmailProcessingJob[] {
  // Group emails by conversation
  const conversations = new Map<string, EmailJobData[]>();

  emails.forEach((email: any) => {
    const convId = email?.conversation_id;
    if (!conversations.has(convId)) {
      conversations.set(convId, []);
    }
    conversations.get(convId)!.push(email);
  });

  // Create jobs from conversations
  return Array.from(conversations.entries()).map(([convId, convEmails]) => ({
    id: `job_${convId}`,
    conversationId: convId,
    emails: convEmails,
    priority: "medium" as const,
    options: {
      skipCache: false,
      forceAllPhases: false,
      qualityThreshold: 6.0,
      timeout: 60000,
    },
  }));
}

async function processJobBatch(
  pool: EmailProcessingWorkerPool,
  jobs: EmailProcessingJob[],
): Promise<void> {
  return new Promise((resolve: any) => {
    let completed = 0;
    const total = jobs.reduce((sum: any, job: any) => sum + job?.emails?.length, 0);

    const handler = ({ emailCount }: any) => {
      completed += emailCount;
      if (completed >= total) {
        pool.off("jobComplete", handler);
        resolve();
      }
    };

    pool.on("jobComplete", handler);
    pool.addJobs(jobs);
  });
}

async function measureThroughput(
  pool: EmailProcessingWorkerPool,
  emails: EmailJobData[],
): Promise<number> {
  const startTime = performance.now();
  const jobs = createTestJobs(emails);

  await processJobBatch(pool, jobs);

  const totalTime = performance.now() - startTime;
  return emails?.length || 0 / (totalTime / 60000);
}
