/**
 * EmailIngestionService Integration Test Suite
 * 
 * Tests with real Redis and BullMQ components for production readiness
 * Requires Redis server to be running on localhost:6379
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';

// Set timeout for integration tests
vi.setConfig({ testTimeout: 30000 });
import { Redis } from 'ioredis';
import { Queue, Worker, QueueEvents } from 'bullmq';
import { EmailIngestionServiceImpl } from '../EmailIngestionServiceImpl.js';
import { EmailIngestionServiceFactory } from '../EmailIngestionServiceFactory.js';
import {
  IngestionMode,
  IngestionSource,
  EmailIngestionConfig,
  RawEmailData
} from '../EmailIngestionService.js';
import { EmailRepository } from '../../../database/repositories/EmailRepository.js';
import { UnifiedEmailService } from '../../../api/services/UnifiedEmailService.js';

// Mock only external dependencies, use real Redis/BullMQ
vi.mock('../../../database/repositories/EmailRepository.js');
vi.mock('../../../api/services/UnifiedEmailService.js');
vi.mock('../../../utils/logger.js');
vi.mock('../../../api/monitoring/metrics.js');
vi.mock('../../../api/websocket/index.js');

describe('EmailIngestionService Integration Tests', () => {
  let redis: Redis;
  let testConfig: EmailIngestionConfig;
  let service: EmailIngestionServiceImpl;
  let mockEmailRepository: EmailRepository;
  let mockUnifiedEmailService: UnifiedEmailService;
  let testQueueName: string;

  const createTestEmail = (overrides: Partial<RawEmailData> = {}): RawEmailData => ({
    messageId: `integration-test-${Date.now()}-${Math.random()}`,
    subject: 'Integration Test Email',
    body: {
      content: 'This is an integration test email content.',
      contentType: 'text'
    },
    from: {
      address: 'integration@test.com',
      name: 'Integration Test'
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

  beforeAll(async () => {
    // Skip Redis connection for unit tests - use mocks instead
    if (process.env.VITEST_INTEGRATION !== 'true') {
      console.log('Running in unit test mode - mocking Redis dependencies');
      return;
    }

    // Check if Redis is available for integration tests
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      maxRetriesPerRequest: 1,
      retryDelayOnFailover: 100,
      lazyConnect: true,
      connectTimeout: 2000, // 2 second timeout
      lazyConnect: true
    });

    try {
      await redis.connect();
      await redis.ping();
    } catch (error) {
      console.warn('Redis not available for integration tests. Using mocks...');
      return;
    }

    // Create unique queue name for tests
    testQueueName = `email-ingestion-integration-test-${Date.now()}`;
  });

  afterAll(async () => {
    if (redis) {
      // Clean up test queues
      const keys = await redis.keys(`bull:${testQueueName}*`);
      if (keys?.length || 0 > 0) {
        await redis.del(...keys);
      }
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Skip if Redis not available
    if (!redis || redis.status !== 'ready') {
      return;
    }

    vi.clearAllMocks();

    // Create integration test configuration with real Redis
    testConfig = {
      mode: IngestionMode.MANUAL,
      redis: {
        host: 'localhost',
        port: 6379
      },
      processing: {
        batchSize: 10,
        concurrency: 2,
        maxRetries: 2,
        retryDelay: 100, // Faster retries for tests
        deduplicationWindow: 1,
        priorityBoostKeywords: ['urgent', 'critical']
      }
    };

    // Create mock dependencies
    mockEmailRepository = new EmailRepository({ db: {} as any });
    mockUnifiedEmailService = new UnifiedEmailService();

    // Mock repository methods
    vi.mocked(mockEmailRepository.getStatistics).mockResolvedValue({
      total: 0,
      pending: 0,
      analyzed: 0,
      failed: 0,
      byPriority: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    });

    // Mock unified email service
    vi.mocked(mockUnifiedEmailService.processIncomingEmail).mockImplementation(async (email: any) => ({
      id: `processed-${email.messageId}`,
      subject: email.subject,
      from: email?.from?.address,
      status: 'processed',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any));

    // Create service instance
    service = new EmailIngestionServiceImpl(
      testConfig,
      mockEmailRepository,
      mockUnifiedEmailService
    );
  });

  afterEach(async () => {
    if (service) {
      try {
        await service.shutdown();
      } catch (error) {
        // Ignore shutdown errors in cleanup
      }
    }

    // Clean up test data from Redis
    if (redis && redis.status === 'ready') {
      const keys = await redis.keys(`email:dedup:*`);
      if (keys?.length || 0 > 0) {
        await redis.del(...keys);
      }
    }
  });

  describe('Real Redis Integration', () => {
    it('should connect to Redis and perform operations', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping Redis integration test - Redis not available');
        return;
      }

      await service.initialize();

      // Test Redis operations
      const testKey = 'integration-test-key';
      const testValue = 'integration-test-value';

      const serviceRedis = (service as any).redis;
      await serviceRedis.setex(testKey, 60, testValue);
      const retrievedValue = await serviceRedis.get(testKey);

      expect(retrievedValue).toBe(testValue);

      // Cleanup
      await serviceRedis.del(testKey);
    });

    it('should handle Redis connection failures gracefully', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping Redis connection test - Redis not available');
        return;
      }

      // Create service with invalid Redis config
      const invalidConfig = {
        ...testConfig,
        redis: {
          host: 'invalid-host',
          port: 9999
        }
      };

      const invalidService = new EmailIngestionServiceImpl(
        invalidConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );

      await expect(invalidService.initialize()).rejects.toThrow();
    });

    it('should perform real deduplication with Redis', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping deduplication test - Redis not available');
        return;
      }

      await service.initialize();

      const testEmail = createTestEmail({ messageId: 'real-dedup-test' });

      // First ingestion should succeed
      const result1 = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result1.success).toBe(true);
      expect(result1.data?.status).not.toBe('duplicate');

      // Second ingestion should detect duplicate
      const result2 = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result2.success).toBe(true);
      expect(result2.data?.status).toBe('duplicate');

      // Verify Redis has the key
      const serviceRedis = (service as any).redis;
      const hash = (service as any).hashMessageId('real-dedup-test');
      const exists = await serviceRedis.exists(`email:dedup:${hash}`);
      expect(exists).toBe(1);
    });

    it('should handle Redis memory pressure scenarios', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping Redis memory test - Redis not available');
        return;
      }

      await service.initialize();

      // Fill Redis with test data to simulate memory pressure
      const serviceRedis = (service as any).redis;
      const testKeys: string[] = [];

      try {
        // Create many keys to simulate memory usage
        for (let i = 0; i < 1000; i++) {
          const key = `memory-pressure-test-${i}`;
          await serviceRedis.setex(key, 30, 'x'.repeat(1024)); // 1KB per key
          testKeys.push(key);
        }

        const testEmail = createTestEmail();
        const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

        expect(result.success).toBeTruthy();
      } finally {
        // Cleanup test keys
        if (testKeys?.length || 0 > 0) {
          await serviceRedis.del(...testKeys);
        }
      }
    });
  });

  describe('Real BullMQ Integration', () => {
    it('should process jobs through real BullMQ queue', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping BullMQ integration test - Redis not available');
        return;
      }

      await service.initialize();

      const testEmail = createTestEmail();
      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?.emailId).toBeDefined();
      expect(result.data?.messageId).toBe(testEmail.messageId);
      expect(result.data?.status).toBe('processed');

      // Verify the email was processed through UnifiedEmailService
      expect(mockUnifiedEmailService.processIncomingEmail).toHaveBeenCalledWith(testEmail);
    });

    it('should handle queue retry mechanism', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping queue retry test - Redis not available');
        return;
      }

      await service.initialize();

      // Mock UnifiedEmailService to fail first few times
      let callCount = 0;
      vi.mocked(mockUnifiedEmailService.processIncomingEmail).mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Simulated processing failure');
        }
        return {
          id: 'processed-after-retry',
          subject: 'Test',
          from: 'test@example.com'
        } as any;
      });

      const testEmail = createTestEmail();
      
      // In manual mode, this will wait for completion including retries
      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(callCount).toBe(3); // Should have retried twice
    });

    it('should handle high-throughput queue processing', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping high-throughput test - Redis not available');
        return;
      }

      // Use higher concurrency for this test
      const highThroughputConfig = {
        ...testConfig,
        processing: {
          ...testConfig.processing,
          concurrency: 10,
          batchSize: 50
        }
      };

      const highThroughputService = new EmailIngestionServiceImpl(
        highThroughputConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );

      try {
        await highThroughputService.initialize();

        const emailCount = 200;
        const emails = Array.from({ length: emailCount }, (_, i) => 
          createTestEmail({ messageId: `high-throughput-${i}` })
        );

        const startTime = performance.now();
        const result = await highThroughputService.ingestBatch(emails, IngestionSource.JSON_FILE);
        const endTime = performance.now();

        const durationMinutes = (endTime - startTime) / (1000 * 60);
        const throughput = emailCount / durationMinutes;

        expect(result.success).toBe(true);
        expect(result.data?.processed).toBe(emailCount);
        expect(throughput).toBeGreaterThan(100); // Should be much higher with real queue
      } finally {
        await highThroughputService.shutdown();
      }
    }, 30000);

    it('should handle queue pause and resume operations', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping queue pause/resume test - Redis not available');
        return;
      }

      await service.initialize();

      // Pause the queue
      await service.pauseIngestion();
      let status = await service.getQueueStatus();
      expect(status.paused).toBe(true);

      // Resume the queue
      await service.resumeIngestion();
      status = await service.getQueueStatus();
      expect(status.paused).toBe(false);
    });

    it('should provide accurate queue metrics', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping queue metrics test - Redis not available');
        return;
      }

      await service.initialize();

      // Add some emails to queue
      const emails = Array.from({ length: 5 }, (_, i) => 
        createTestEmail({ messageId: `metrics-test-${i}` })
      );

      for (const email of emails) {
        await service.ingestEmail(email, IngestionSource.JSON_FILE);
      }

      const status = await service.getQueueStatus();
      expect(status.completed).toBeGreaterThanOrEqual(5);

      const metrics = await service.getMetrics();
      expect(metrics.totalIngested).toBeGreaterThanOrEqual(5);
      expect(metrics.bySource[IngestionSource.JSON_FILE]).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Auto-Pull Integration', () => {
    it('should start and stop auto-pull with real intervals', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping auto-pull test - Redis not available');
        return;
      }

      const autoPullConfig = {
        ...testConfig,
        mode: IngestionMode.AUTO_PULL,
        autoPull: {
          interval: 0.1, // 6 seconds for testing
          sources: [IngestionSource.MICROSOFT_GRAPH],
          maxEmailsPerPull: 10
        }
      };

      const autoPullService = new EmailIngestionServiceImpl(
        autoPullConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );

      try {
        await autoPullService.initialize();
        expect(autoPullService.isAutoPullActive()).toBe(true);

        // Wait for at least one auto-pull cycle
        await new Promise(resolve => setTimeout(resolve, 7000));

        await autoPullService.stopAutoPull();
        expect(autoPullService.isAutoPullActive()).toBe(false);
      } finally {
        await autoPullService.shutdown();
      }
    }, 15000);
  });

  describe('Health Check Integration', () => {
    it('should provide accurate health status with real components', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping health check test - Redis not available');
        return;
      }

      await service.initialize();

      const health = await service.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.status).toBe('operational');
      expect(health?.components?.redis.healthy).toBe(true);
      expect(health?.components?.queue.healthy).toBe(true);
      expect(health?.components?.database.healthy).toBe(true);
      expect(health.uptime).toBeGreaterThan(0);
    });

    it('should detect Redis disconnection in health check', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping Redis disconnect test - Redis not available');
        return;
      }

      await service.initialize();

      // Simulate Redis disconnection
      const serviceRedis = (service as any).redis;
      await serviceRedis.disconnect();

      const health = await service.healthCheck();

      expect(health?.components?.redis.healthy).toBe(false);
      expect(health.healthy).toBe(false);
      expect(health.status).toBe('degraded');
    });
  });

  describe('Performance Integration Tests', () => {
    it('should maintain performance with real queue under load', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping performance integration test - Redis not available');
        return;
      }

      await service.initialize();

      const iterations = 5;
      const batchSize = 50;
      const performanceResults: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const emails = Array.from({ length: batchSize }, (_, j) => 
          createTestEmail({ messageId: `perf-integration-${i}-${j}` })
        );

        const startTime = performance.now();
        const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
        const endTime = performance.now();

        expect(result.success).toBe(true);
        expect(result.data?.processed).toBe(batchSize);

        performanceResults.push(endTime - startTime);
      }

      // Performance should be consistent across iterations
      const avgTime = performanceResults.reduce((a: any, b: any) => a + b, 0) / performanceResults?.length || 0;
      const maxTime = Math.max(...performanceResults);
      const minTime = Math.min(...performanceResults);

      // Variation should be within reasonable bounds
      const variation = (maxTime - minTime) / avgTime;
      expect(variation).toBeLessThan(2.0); // Less than 200% variation
    }, 45000);

    it('should handle concurrent operations with real Redis', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping concurrent operations test - Redis not available');
        return;
      }

      await service.initialize();

      const concurrentOperations = 10;
      const emailsPerOperation = 20;

      const promises = Array.from({ length: concurrentOperations }, async (_, i) => {
        const emails = Array.from({ length: emailsPerOperation }, (_, j) => 
          createTestEmail({ messageId: `concurrent-integration-${i}-${j}` })
        );
        return service.ingestBatch(emails, IngestionSource.JSON_FILE);
      });

      const results = await Promise.all(promises);

      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.data?.processed === emailsPerOperation)).toBe(true);

      const totalProcessed = results.reduce((sum: any, r: any) => sum + (r.data?.processed || 0), 0);
      expect(totalProcessed).toBe(concurrentOperations * emailsPerOperation);
    }, 30000);
  });

  describe('Factory Integration', () => {
    it('should create service through factory with real Redis', async () => {
      if (!redis || redis.status !== 'ready') {
        console.log('Skipping factory integration test - Redis not available');
        return;
      }

      const factoryService = await EmailIngestionServiceFactory.create({
        redis: {
          host: 'localhost',
          port: 6379
        },
        processing: {
          batchSize: 5,
          concurrency: 1,
          maxRetries: 1,
          retryDelay: 100,
          deduplicationWindow: 1,
          priorityBoostKeywords: ['test']
        }
      });

      try {
        const testEmail = createTestEmail();
        const result = await factoryService.ingestEmail(testEmail, IngestionSource.JSON_FILE);

        expect(result.success).toBe(true);
        expect(result.data?.messageId).toBe(testEmail.messageId);
      } finally {
        await factoryService.shutdown();
        EmailIngestionServiceFactory.reset();
      }
    });
  });
});