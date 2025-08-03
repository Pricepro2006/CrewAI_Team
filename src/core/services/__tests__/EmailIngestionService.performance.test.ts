/**
 * EmailIngestionService Performance Test Suite
 * 
 * Comprehensive performance benchmarks and stress tests
 * Validates 60+ emails/minute requirement and scalability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmailIngestionServiceImpl } from '../EmailIngestionServiceImpl.js';
import {
  IngestionMode,
  IngestionSource,
  EmailIngestionConfig,
  RawEmailData
} from '../EmailIngestionService.js';
import { EmailRepository } from '../../../database/repositories/EmailRepository.js';
import { UnifiedEmailService } from '../../../api/services/UnifiedEmailService.js';

// Mock dependencies for consistent performance testing
vi.mock('../../../database/repositories/EmailRepository.js');
vi.mock('../../../api/services/UnifiedEmailService.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../api/monitoring/metrics.js');
vi.mock('../../../api/websocket/index.js');

// Mock Redis and BullMQ for performance tests
vi.mock('ioredis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    exists: vi.fn().mockResolvedValue(0),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG')
  }))
}));

vi.mock('bullmq', () => {
  const createMockJob = (data = {}) => ({
    id: `perf-job-${Date.now()}-${Math.random()}`,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    waitUntilFinished: vi.fn().mockResolvedValue({
      emailId: 'processed-email-id',
      messageId: data.email?.messageId || 'test-message',
      status: 'processed',
      processingTime: Math.random() * 50 + 10 // 10-60ms processing time
    }),
    attemptsMade: 0
  });

  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockImplementation((name, data) => Promise.resolve(createMockJob(data))),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      getWaitingCount: vi.fn().mockResolvedValue(0),
      getActiveCount: vi.fn().mockResolvedValue(0),
      getCompletedCount: vi.fn().mockResolvedValue(0),
      getFailedCount: vi.fn().mockResolvedValue(0),
      getDelayedCount: vi.fn().mockResolvedValue(0),
      isPaused: vi.fn().mockResolvedValue(false),
      getFailed: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined)
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

interface PerformanceMetrics {
  totalTime: number;
  avgTimePerEmail: number;
  throughputPerMinute: number;
  memoryUsed: number;
  peakMemory: number;
  gcCollections?: number;
}

interface BenchmarkResult {
  name: string;
  emailCount: number;
  metrics: PerformanceMetrics;
  success: boolean;
  errors?: string[];
}

describe('EmailIngestionService Performance Tests', () => {
  let service: EmailIngestionServiceImpl;
  let mockEmailRepository: EmailRepository;
  let mockUnifiedEmailService: UnifiedEmailService;
  let testConfig: EmailIngestionConfig;
  let benchmarkResults: BenchmarkResult[] = [];

  const createTestEmail = (overrides: Partial<RawEmailData> = {}): RawEmailData => ({
    messageId: `perf-test-${Date.now()}-${Math.random()}`,
    subject: 'Performance Test Email',
    body: {
      content: 'This is a performance test email with standard content length for realistic testing.',
      contentType: 'text'
    },
    from: {
      address: 'perf@test.com',
      name: 'Performance Test'
    },
    to: [
      {
        address: 'recipient@test.com',
        name: 'Test Recipient'
      }
    ],
    receivedDateTime: new Date().toISOString(),
    hasAttachments: false,
    importance: 'normal',
    ...overrides
  });

  const createLargeEmail = (overrides: Partial<RawEmailData> = {}): RawEmailData => ({
    ...createTestEmail(),
    subject: 'Large Performance Test Email with Extended Subject Line for Testing Performance Impact',
    body: {
      content: 'Large email content: ' + 'x'.repeat(10240), // 10KB content
      contentType: 'html'
    },
    hasAttachments: true,
    attachments: [
      {
        id: 'attachment-1',
        name: 'large-document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024 // 1MB
      }
    ],
    ...overrides
  });

  const measurePerformance = async <T>(
    name: string,
    emailCount: number,
    operation: () => Promise<T>
  ): Promise<BenchmarkResult> => {
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory.heapUsed;
    const startTime = performance.now();
    
    // Monitor memory during operation
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > peakMemory) {
        peakMemory = current;
      }
    }, 100);

    try {
      await operation();
      
      const endTime = performance.now();
      const finalMemory = process.memoryUsage();
      
      clearInterval(memoryMonitor);
      
      const totalTime = endTime - startTime;
      const avgTimePerEmail = totalTime / emailCount;
      const throughputPerMinute = (emailCount / totalTime) * 60000;
      
      const result: BenchmarkResult = {
        name,
        emailCount,
        metrics: {
          totalTime,
          avgTimePerEmail,
          throughputPerMinute,
          memoryUsed: finalMemory.heapUsed - initialMemory.heapUsed,
          peakMemory: peakMemory - initialMemory.heapUsed
        },
        success: true
      };
      
      benchmarkResults.push(result);
      return result;
    } catch (error) {
      clearInterval(memoryMonitor);
      
      const result: BenchmarkResult = {
        name,
        emailCount,
        metrics: {
          totalTime: 0,
          avgTimePerEmail: 0,
          throughputPerMinute: 0,
          memoryUsed: 0,
          peakMemory: 0
        },
        success: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
      
      benchmarkResults.push(result);
      return result;
    }
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    testConfig = {
      mode: IngestionMode.MANUAL,
      redis: {
        host: 'localhost',
        port: 6379
      },
      processing: {
        batchSize: 50,
        concurrency: 4,
        maxRetries: 2,
        retryDelay: 100,
        deduplicationWindow: 1,
        priorityBoostKeywords: ['urgent', 'critical']
      }
    };

    mockEmailRepository = new EmailRepository({ db: {} as any });
    mockUnifiedEmailService = new UnifiedEmailService();

    // Mock repository methods with realistic delays
    vi.mocked(mockEmailRepository.getStatistics).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 1)); // 1ms delay
      return {
        total: 0,
        pending: 0,
        analyzed: 0,
        failed: 0,
        byPriority: { critical: 0, high: 0, medium: 0, low: 0 }
      };
    });

    // Mock unified email service with realistic processing time
    vi.mocked(mockUnifiedEmailService.processIncomingEmail).mockImplementation(async (email) => {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5)); // 5-25ms delay
      return {
        id: `processed-${email.messageId}`,
        subject: email.subject,
        from: email.from.address
      } as any;
    });

    service = new EmailIngestionServiceImpl(
      testConfig,
      mockEmailRepository,
      mockUnifiedEmailService
    );

    await service.initialize();
  });

  afterEach(async () => {
    if (service) {
      await service.shutdown();
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Throughput Benchmarks', () => {
    it('should meet 60+ emails/minute requirement - Small Batch', async () => {
      const emailCount = 100;
      const emails = Array.from({ length: emailCount }, (_, i) => 
        createTestEmail({ messageId: `throughput-small-${i}` })
      );

      const result = await measurePerformance(
        'Small Batch Throughput',
        emailCount,
        async () => {
          const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
          expect(batchResult.success).toBe(true);
          expect(batchResult.data?.processed).toBe(emailCount);
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.throughputPerMinute).toBeGreaterThan(60);
      expect(result.metrics.avgTimePerEmail).toBeLessThan(1000); // Less than 1 second per email
    }, 30000);

    it('should meet 60+ emails/minute requirement - Large Batch', async () => {
      const emailCount = 500;
      const emails = Array.from({ length: emailCount }, (_, i) => 
        createTestEmail({ messageId: `throughput-large-${i}` })
      );

      const result = await measurePerformance(
        'Large Batch Throughput',
        emailCount,
        async () => {
          const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
          expect(batchResult.success).toBe(true);
          expect(batchResult.data?.processed).toBe(emailCount);
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.throughputPerMinute).toBeGreaterThan(60);
      expect(result.metrics.avgTimePerEmail).toBeLessThan(500); // Less than 500ms per email
    }, 60000);

    it('should handle high-concurrency processing', async () => {
      const emailCount = 200;
      const concurrentBatches = 8;
      const batchSize = Math.ceil(emailCount / concurrentBatches);

      const result = await measurePerformance(
        'High Concurrency Processing',
        emailCount,
        async () => {
          const batches = Array.from({ length: concurrentBatches }, (_, batchIndex) => 
            Array.from({ length: batchSize }, (_, emailIndex) => 
              createTestEmail({ messageId: `concurrent-${batchIndex}-${emailIndex}` })
            )
          );

          const promises = batches.map(batch => 
            service.ingestBatch(batch, IngestionSource.JSON_FILE)
          );

          const results = await Promise.all(promises);
          expect(results.every(r => r.success)).toBe(true);
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.throughputPerMinute).toBeGreaterThan(100); // Should be higher with concurrency
    }, 45000);
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with email count', async () => {
      const testSizes = [50, 100, 200, 400];
      const results: BenchmarkResult[] = [];

      for (const emailCount of testSizes) {
        const emails = Array.from({ length: emailCount }, (_, i) => 
          createTestEmail({ messageId: `scale-test-${emailCount}-${i}` })
        );

        const result = await measurePerformance(
          `Scalability Test - ${emailCount} emails`,
          emailCount,
          async () => {
            const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
            expect(batchResult.success).toBe(true);
          }
        );

        results.push(result);
        expect(result.success).toBe(true);

        // Force garbage collection between tests
        if (global.gc) {
          global.gc();
        }
      }

      // Check that throughput remains consistent across different scales
      const throughputs = results.map(r => r.metrics.throughputPerMinute);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const maxVariation = Math.max(...throughputs.map(t => Math.abs(t - avgThroughput))) / avgThroughput;

      expect(maxVariation).toBeLessThan(0.5); // Less than 50% variation
    }, 120000);

    it('should handle memory efficiently with large email volumes', async () => {
      const iterations = 20;
      const batchSize = 100;
      const memoryUsageOverTime: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const emails = Array.from({ length: batchSize }, (_, j) => 
          createTestEmail({ messageId: `memory-efficient-${i}-${j}` })
        );

        const initialMemory = process.memoryUsage().heapUsed;
        
        const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
        expect(batchResult.success).toBe(true);

        const finalMemory = process.memoryUsage().heapUsed;
        memoryUsageOverTime.push(finalMemory - initialMemory);

        // Periodic garbage collection
        if (i % 5 === 0 && global.gc) {
          global.gc();
        }
      }

      // Memory usage should not continuously increase
      const firstHalfAvg = memoryUsageOverTime.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
      const secondHalfAvg = memoryUsageOverTime.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const memoryGrowthRatio = secondHalfAvg / firstHalfAvg;

      expect(memoryGrowthRatio).toBeLessThan(2.0); // Memory usage should not double
    }, 90000);
  });

  describe('Stress Tests', () => {
    it('should handle maximum configuration limits', async () => {
      const stressConfig = {
        ...testConfig,
        processing: {
          batchSize: 1000,
          concurrency: 10,
          maxRetries: 3,
          retryDelay: 50,
          deduplicationWindow: 24,
          priorityBoostKeywords: ['urgent', 'critical', 'emergency', 'asap']
        }
      };

      const stressService = new EmailIngestionServiceImpl(
        stressConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );

      try {
        await stressService.initialize();

        const emailCount = 2000;
        const emails = Array.from({ length: emailCount }, (_, i) => 
          createTestEmail({ messageId: `stress-test-${i}` })
        );

        const result = await measurePerformance(
          'Maximum Configuration Stress Test',
          emailCount,
          async () => {
            const batchResult = await stressService.ingestBatch(emails, IngestionSource.JSON_FILE);
            expect(batchResult.success).toBe(true);
            expect(batchResult.data?.processed).toBe(emailCount);
          }
        );

        expect(result.success).toBe(true);
        expect(result.metrics.throughputPerMinute).toBeGreaterThan(60);
      } finally {
        await stressService.shutdown();
      }
    }, 120000);

    it('should handle mixed email sizes efficiently', async () => {
      const emailCount = 300;
      const emails: RawEmailData[] = [];

      // Mix of small, medium, and large emails
      for (let i = 0; i < emailCount; i++) {
        if (i % 3 === 0) {
          emails.push(createLargeEmail({ messageId: `mixed-large-${i}` }));
        } else if (i % 3 === 1) {
          emails.push(createTestEmail({
            messageId: `mixed-medium-${i}`,
            body: {
              content: 'Medium content: ' + 'x'.repeat(1024), // 1KB
              contentType: 'text'
            }
          }));
        } else {
          emails.push(createTestEmail({ messageId: `mixed-small-${i}` }));
        }
      }

      const result = await measurePerformance(
        'Mixed Email Sizes Test',
        emailCount,
        async () => {
          const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
          expect(batchResult.success).toBe(true);
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.throughputPerMinute).toBeGreaterThan(30); // Lower due to large emails
    }, 90000);

    it('should maintain performance under continuous load', async () => {
      const cycles = 15;
      const emailsPerCycle = 50;
      const performanceOverTime: number[] = [];

      for (let cycle = 0; cycle < cycles; cycle++) {
        const emails = Array.from({ length: emailsPerCycle }, (_, i) => 
          createTestEmail({ messageId: `continuous-${cycle}-${i}` })
        );

        const startTime = performance.now();
        const batchResult = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
        const endTime = performance.now();

        expect(batchResult.success).toBe(true);
        
        const cycleTime = endTime - startTime;
        performanceOverTime.push(cycleTime);

        // Brief pause between cycles
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Performance should remain consistent
      const avgTime = performanceOverTime.reduce((a, b) => a + b, 0) / performanceOverTime.length;
      const maxVariation = Math.max(...performanceOverTime.map(t => Math.abs(t - avgTime))) / avgTime;

      expect(maxVariation).toBeLessThan(1.0); // Less than 100% variation
    }, 120000);
  });

  describe('Latency Tests', () => {
    it('should maintain low latency for single email ingestion', async () => {
      const iterations = 100;
      const latencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const email = createTestEmail({ messageId: `latency-test-${i}` });
        
        const startTime = performance.now();
        const result = await service.ingestEmail(email, IngestionSource.JSON_FILE);
        const endTime = performance.now();

        expect(result.success).toBe(true);
        latencies.push(endTime - startTime);
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
      const p99Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)];

      expect(avgLatency).toBeLessThan(100); // Less than 100ms average
      expect(p95Latency).toBeLessThan(200); // Less than 200ms for 95th percentile
      expect(p99Latency).toBeLessThan(500); // Less than 500ms for 99th percentile
    }, 60000);

    it('should handle priority queue efficiently', async () => {
      const emailCount = 200;
      const emails: RawEmailData[] = [];

      // Create emails with different priorities
      for (let i = 0; i < emailCount; i++) {
        const importance = i % 4 === 0 ? 'high' : 
                         i % 4 === 1 ? 'low' : 'normal';
        const subject = i % 10 === 0 ? 'URGENT Critical Issue' : `Test Email ${i}`;
        
        emails.push(createTestEmail({
          messageId: `priority-test-${i}`,
          importance: importance as any,
          subject
        }));
      }

      const result = await measurePerformance(
        'Priority Queue Test',
        emailCount,
        async () => {
          // Process all emails individually to test priority handling
          const promises = emails.map(email => 
            service.ingestEmail(email, IngestionSource.JSON_FILE)
          );
          const results = await Promise.all(promises);
          expect(results.every(r => r.success)).toBe(true);
        }
      );

      expect(result.success).toBe(true);
      expect(result.metrics.throughputPerMinute).toBeGreaterThan(60);
    }, 90000);
  });

  afterAll(() => {
    // Print benchmark summary
    console.log('\n=== EmailIngestionService Performance Benchmark Summary ===');
    console.log('Requirement: 60+ emails/minute throughput\n');
    
    benchmarkResults.forEach(result => {
      console.log(`${result.name}:`);
      console.log(`  Emails: ${result.emailCount}`);
      console.log(`  Success: ${result.success}`);
      if (result.success) {
        console.log(`  Total Time: ${result.metrics.totalTime.toFixed(2)}ms`);
        console.log(`  Avg Time/Email: ${result.metrics.avgTimePerEmail.toFixed(2)}ms`);
        console.log(`  Throughput: ${result.metrics.throughputPerMinute.toFixed(2)} emails/min`);
        console.log(`  Memory Used: ${(result.metrics.memoryUsed / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  Peak Memory: ${(result.metrics.peakMemory / 1024 / 1024).toFixed(2)}MB`);
        console.log(`  ✅ Meets Requirement: ${result.metrics.throughputPerMinute > 60 ? 'YES' : 'NO'}`);
      } else {
        console.log(`  ❌ Errors: ${result.errors?.join(', ')}`);
      }
      console.log('');
    });

    const successfulTests = benchmarkResults.filter(r => r.success);
    const avgThroughput = successfulTests.reduce((sum, r) => sum + r.metrics.throughputPerMinute, 0) / successfulTests.length;
    
    console.log(`Overall Average Throughput: ${avgThroughput.toFixed(2)} emails/min`);
    console.log(`Tests Passed: ${successfulTests.length}/${benchmarkResults.length}`);
    console.log(`Requirement Met: ${avgThroughput > 60 ? '✅ YES' : '❌ NO'}`);
    console.log('=============================================================\n');
  });
});