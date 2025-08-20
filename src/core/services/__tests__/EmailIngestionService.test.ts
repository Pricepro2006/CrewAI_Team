/**
 * EmailIngestionService Test Suite
 * 
 * Comprehensive tests for email ingestion service functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { EmailIngestionServiceImpl } from '../EmailIngestionServiceImpl';
import { EmailIngestionServiceFactory, EmailIngestionConfigPresets } from '../EmailIngestionServiceFactory';
import {
  IngestionMode,
  IngestionSource,
  EmailIngestionConfig,
  RawEmailData
} from '../EmailIngestionService';
import { EmailRepository } from '../../../database/repositories/EmailRepository';
import { UnifiedEmailService } from '../../../api/services/UnifiedEmailService';

// Mock crypto for uuid
vi.mock('crypto', async (importOriginal: any) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: actual
  };
});

// Mock fs for database connection
vi.mock('fs', async (importOriginal: any) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    default: actual,
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn().mockImplementation((path: any) => {
      if (path.includes('emails.json')) {
        return JSON.stringify([
          { messageId: 'email-1', subject: 'Test 1' },
          { messageId: 'email-2', subject: 'Test 2' }
        ]);
      }
      throw new Error('File not found');
    })
  };
});

// Mock fs/promises for async file operations
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockImplementation(async (path: any) => {
    if (path.includes('emails.json')) {
      return JSON.stringify([
        {
          messageId: 'email-1',
          subject: 'Test Email 1',
          body: { content: 'Test content 1', contentType: 'text' },
          from: { address: 'sender1@example.com', name: 'Sender 1' },
          to: [{ address: 'recipient@example.com', name: 'Recipient' }],
          receivedDateTime: new Date().toISOString(),
          hasAttachments: false,
          importance: 'normal'
        },
        {
          messageId: 'email-2',
          subject: 'Test Email 2',
          body: { content: 'Test content 2', contentType: 'text' },
          from: { address: 'sender2@example.com', name: 'Sender 2' },
          to: [{ address: 'recipient@example.com', name: 'Recipient' }],
          receivedDateTime: new Date().toISOString(),
          hasAttachments: false,
          importance: 'normal'
        }
      ]);
    }
    throw new Error('File not found');
  })
}));

// Mock dependencies
vi.mock('../../../database/repositories/EmailRepository', () => ({
  EmailRepository: vi.fn().mockImplementation(() => ({
    getStatistics: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    markFailed: vi.fn()
  }))
}));

vi.mock('../../../api/services/UnifiedEmailService', () => ({
  UnifiedEmailService: vi.fn().mockImplementation(() => ({
    processIncomingEmail: vi.fn()
  }))
}));

vi.mock('../../../utils/logger');
vi.mock('../../../api/monitoring/metrics');
vi.mock('../../../api/websocket/index');

// Mock database connection
vi.mock('../../../database/connection', () => ({
  getDatabaseConnection: vi.fn().mockReturnValue({
    prepare: vi.fn().mockReturnValue({
      run: vi.fn(),
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn()
    }),
    exec: vi.fn(),
    close: vi.fn()
  })
}));

// Mock Redis
vi.mock('ioredis', () => {
  return {
    Redis: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(0),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      keys: vi.fn().mockResolvedValue([]),
      ping: vi.fn().mockResolvedValue('PONG')
    }))
  };
});

// Mock BullMQ
const mockJobResults = new Map();

vi.mock('bullmq', () => {
  const createMockJob = (data = {}) => ({
    id: `test-job-${Date.now()}`,
    data,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    waitUntilFinished: vi.fn().mockImplementation(async () => {
      const jobId = data.email?.messageId || 'default';
      return mockJobResults.get(jobId) || {
        emailId: 'processed-email-id',
        messageId: data.email?.messageId || 'test-message',
        status: 'processed',
        processingTime: 100
      };
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

describe('EmailIngestionService', () => {
  let service: EmailIngestionServiceImpl;
  let mockEmailRepository: EmailRepository;
  let mockUnifiedEmailService: UnifiedEmailService;
  let testConfig: EmailIngestionConfig;

  const createTestEmail = (overrides: Partial<RawEmailData> = {}): RawEmailData => ({
    messageId: `test-message-${Date.now()}`,
    subject: 'Test Email Subject',
    body: {
      content: 'This is a test email body content.',
      contentType: 'text'
    },
    from: {
      address: 'sender@example.com',
      name: 'Test Sender'
    },
    to: [
      {
        address: 'recipient@example.com',
        name: 'Test Recipient'
      }
    ],
    receivedDateTime: new Date().toISOString(),
    hasAttachments: false,
    importance: 'normal',
    ...overrides
  });

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockJobResults.clear();

    // Create test configuration
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
        retryDelay: 1000,
        deduplicationWindow: 1,
        priorityBoostKeywords: ['urgent', 'critical']
      }
    };

    // Create mock dependencies
    mockEmailRepository = new EmailRepository({ db: {} as any });
    mockUnifiedEmailService = new UnifiedEmailService();

    // Mock repository methods
    mockEmailRepository?.getStatistics?.mockResolvedValue({
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
    mockUnifiedEmailService?.processIncomingEmail?.mockResolvedValue({
      id: 'processed-email-id',
      subject: 'Test Email',
      from: 'sender@example.com'
    } as any);

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
        // Ignore shutdown errors in tests
      }
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      await expect(service.initialize()).resolves?.not?.toThrow();
    });

    it('should validate required configuration', () => {
      const invalidConfig = { ...testConfig };
      delete (invalidConfig as any).redis;

      expect(() => new EmailIngestionServiceImpl(
        invalidConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      )).toThrow();
    });
  });

  describe('Single Email Ingestion', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should ingest a single email successfully', async () => {
      const testEmail = createTestEmail();
      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(testEmail.messageId);
      expect(result.data?.length).toBe('processed');
    });

    it('should detect duplicate emails', async () => {
      const testEmail = createTestEmail();
      
      // Mock Redis to return duplicate
      const mockRedis = vi.mocked(service as any).redis;
      mockRedis?.exists?.mockResolvedValueOnce(1);

      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe('duplicate');
    });

    it('should handle processing errors gracefully', async () => {
      const testEmail = createTestEmail();
      
      // Mock the queue to throw an error
      const mockQueue = (service as any).ingestionQueue;
      mockQueue?.add?.mockRejectedValueOnce(new Error('Processing failed'));

      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Processing failed');
    });

    it('should calculate priority correctly', async () => {
      // Test high importance email
      const highImportanceEmail = createTestEmail({
        importance: 'high',
        subject: 'URGENT: Critical Issue'
      });

      const result = await service.ingestEmail(highImportanceEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBe(true);

      // Test normal importance email
      const normalEmail = createTestEmail();
      const normalResult = await service.ingestEmail(normalEmail, IngestionSource.JSON_FILE);
      expect(normalResult.success).toBe(true);
    });
  });

  describe('Batch Email Ingestion', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should ingest multiple emails in batch', async () => {
      const emails = [
        createTestEmail({ messageId: 'email-1' }),
        createTestEmail({ messageId: 'email-2' }),
        createTestEmail({ messageId: 'email-3' })
      ];

      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?).toHaveLength(3);
      expect(result.data?).toHaveLength(3);
      expect(result.data?).toHaveLength(0);
      expect(result.data?).toHaveLength(0);
    });

    it('should handle mixed success/failure in batch', async () => {
      const emails = [
        createTestEmail({ messageId: 'email-1' }),
        createTestEmail({ messageId: 'email-2' }),
        createTestEmail({ messageId: 'email-3' })
      ];

      // Mock the queue to fail for the second email
      const mockQueue = (service as any).ingestionQueue;
      let callCount = 0;
      
      mockQueue?.add?.mockImplementation(async (name, data) => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Processing failed');
        }
        // Create a new mock job for successful cases
        const mockJob = {
          id: `test-job-${Date.now()}-${callCount}`,
          data,
          updateProgress: vi.fn().mockResolvedValue(undefined),
          waitUntilFinished: vi.fn().mockResolvedValue({
            emailId: 'processed-email-id',
            messageId: data.email?.messageId || 'test-message',
            status: 'processed',
            processingTime: 100
          }),
          attemptsMade: 0
        };
        return mockJob;
      });

      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?).toHaveLength(3);
      expect(result.data?).toHaveLength(2);
      expect(result.data?).toHaveLength(1);
    });

    it('should calculate throughput correctly', async () => {
      const emails = [
        createTestEmail({ messageId: 'email-1' }),
        createTestEmail({ messageId: 'email-2' })
      ];

      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);

      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
      expect(typeof result.data?.length).toBe('number');
    });
  });

  describe('JSON File Ingestion', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle valid JSON file', async () => {
      const mockReadFile = vi.fn().mockResolvedValue(JSON.stringify([
        createTestEmail({ messageId: 'file-email-1' }),
        createTestEmail({ messageId: 'file-email-2' })
      ]));

      // Mock fs.readFile
      vi.doMock('fs/promises', () => ({
        readFile: mockReadFile
      }));

      const result = await service.ingestFromJsonFile('/path/to/emails.json');

      expect(result.success).toBe(true);
      expect(result.data?).toHaveLength(2);
    });

    it('should handle invalid JSON file', async () => {
      const mockReadFile = vi.fn().mockResolvedValue('invalid json');

      vi.doMock('fs/promises', () => ({
        readFile: mockReadFile
      }));

      const result = await service.ingestFromJsonFile('/path/to/invalid.json');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should pause and resume ingestion', async () => {
      await expect(service.pauseIngestion()).resolves?.not?.toThrow();
      await expect(service.resumeIngestion()).resolves?.not?.toThrow();
    });

    it('should get queue status', async () => {
      const status = await service.getQueueStatus();

      expect(status).toHaveProperty('waiting');
      expect(status).toHaveProperty('active');
      expect(status).toHaveProperty('completed');
      expect(status).toHaveProperty('failed');
      expect(status).toHaveProperty('delayed');
      expect(status).toHaveProperty('paused');
    });

    it('should retry failed jobs', async () => {
      const retriedCount = await service.retryFailedJobs(10);
      expect(typeof retriedCount).toBe('number');
      expect(retriedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Deduplication', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should detect duplicates correctly', async () => {
      const messageId = 'test-message-123';
      
      // First check should return false (not duplicate)
      const firstCheck = await service.checkDuplicate(messageId);
      expect(firstCheck).toBe(false);

      // Mock Redis to return exists = 1 for subsequent checks
      const mockRedis = vi.mocked(service as any).redis;
      mockRedis?.exists?.mockResolvedValue(1);

      // Second check should return true (duplicate)
      const secondCheck = await service.checkDuplicate(messageId);
      expect(secondCheck).toBe(true);
    });

    it('should clear deduplication cache', async () => {
      await expect(service.clearDeduplicationCache()).resolves?.not?.toThrow();
    });
  });

  describe('Auto-Pull Management', () => {
    let autoPullService: EmailIngestionServiceImpl;

    beforeEach(() => {
      const autoPullConfig = {
        ...testConfig,
        mode: IngestionMode.AUTO_PULL,
        autoPull: {
          interval: 1, // 1 minute for testing
          sources: [IngestionSource.MICROSOFT_GRAPH],
          maxEmailsPerPull: 100
        }
      };

      autoPullService = new EmailIngestionServiceImpl(
        autoPullConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );
    });

    afterEach(async () => {
      if (autoPullService) {
        await autoPullService.shutdown();
      }
    });

    it('should start auto-pull successfully', async () => {
      // Initialize without auto-starting
      const manualStartConfig = {
        ...testConfig,
        mode: IngestionMode.MANUAL
      };
      const manualService = new EmailIngestionServiceImpl(
        manualStartConfig,
        mockEmailRepository,
        mockUnifiedEmailService
      );
      
      await manualService.initialize();
      
      // Now change to auto-pull mode and start
      (manualService as any).config.mode = IngestionMode.AUTO_PULL;
      (manualService as any).config.autoPull = {
        interval: 1,
        sources: [IngestionSource.MICROSOFT_GRAPH],
        maxEmailsPerPull: 100
      };
      
      await expect(manualService.startAutoPull()).resolves?.not?.toThrow();
      expect(manualService.isAutoPullActive()).toBe(true);
      
      await manualService.shutdown();
    });

    it('should stop auto-pull successfully', async () => {
      await autoPullService.initialize();
      // Auto-pull should already be started
      expect(autoPullService.isAutoPullActive()).toBe(true);
      
      await expect(autoPullService.stopAutoPull()).resolves?.not?.toThrow();
      expect(autoPullService.isAutoPullActive()).toBe(false);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should provide metrics', async () => {
      const metrics = await service.getMetrics();

      expect(metrics).toHaveProperty('totalIngested');
      expect(metrics).toHaveProperty('duplicatesDetected');
      expect(metrics).toHaveProperty('failedIngestions');
      expect(metrics).toHaveProperty('averageProcessingTime');
      expect(metrics).toHaveProperty('currentQueueSize');
      expect(metrics).toHaveProperty('throughput');
      expect(metrics).toHaveProperty('bySource');
      expect(metrics).toHaveProperty('errors');
    });

    it('should provide recent errors', async () => {
      const errors = await service.getRecentErrors(10);
      expect(Array.isArray(errors)).toBe(true);
    });

    it('should perform health check', async () => {
      const health = await service.healthCheck();

      expect(health).toHaveProperty('healthy');
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('components');
      expect(health).toHaveProperty('uptime');
      expect(health).toHaveProperty('lastCheck');

      expect(health.components).toHaveProperty('queue');
      expect(health.components).toHaveProperty('redis');
      expect(health.components).toHaveProperty('database');
      expect(health.components).toHaveProperty('autoPull');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Mock Redis to throw connection error
      const mockRedis = vi.mocked(service as any).redis;
      mockRedis?.ping?.mockRejectedValueOnce(new Error('Redis connection failed'));

      const health = await service.healthCheck();
      expect(health?.components?.redis.healthy).toBe(false);
    });

    it('should handle database connection failures gracefully', async () => {
      // Mock repository to throw error
      vi.mocked(mockEmailRepository.getStatistics).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const health = await service.healthCheck();
      expect(health?.components?.database.healthy).toBe(false);
    });

    it('should handle queue overflow scenarios', async () => {
      const mockQueue = (service as any).ingestionQueue;
      mockQueue?.getWaitingCount?.mockResolvedValue(50000); // High queue count
      mockQueue?.getFailedCount?.mockResolvedValue(5000); // High failure count

      const health = await service.healthCheck();
      expect(health?.components?.queue.healthy).toBe(false);
      expect(health.status).toBe('degraded');
    });

    it('should handle network timeout errors', async () => {
      const testEmail = createTestEmail();
      
      // Mock network timeout
      const mockQueue = (service as any).ingestionQueue;
      mockQueue?.add?.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ETIMEDOUT');
    });

    it('should handle malformed email data', async () => {
      const malformedEmail = {
        messageId: '', // Empty message ID
        subject: null, // Null subject
        body: undefined, // Undefined body
        from: 'invalid-email-format', // Invalid email format
        to: [], // Empty recipients
        receivedDateTime: 'invalid-date', // Invalid date
        hasAttachments: 'not-boolean' // Wrong type
      } as any;

      const result = await service.ingestEmail(malformedEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBe(false);
    });

    it('should handle Redis memory pressure', async () => {
      const mockRedis = vi.mocked(service as any).redis;
      mockRedis?.setex?.mockRejectedValueOnce(new Error('OOM command not allowed when used memory > maxmemory'));

      const testEmail = createTestEmail();
      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      
      // Should still try to process but handle Redis errors gracefully
      expect(result.success).toBe(false);
      expect(result.error).toContain('OOM');
    });

    it('should handle worker crash scenarios', async () => {
      const mockWorker = (service as any).worker;
      mockWorker?.close?.mockRejectedValueOnce(new Error('Worker crashed unexpectedly'));

      // Should handle shutdown gracefully even with worker errors
      await expect(service.shutdown()).resolves?.not?.toThrow();
    });

    it('should handle concurrent duplicate detection race conditions', async () => {
      const testEmail = createTestEmail({ messageId: 'race-condition-test' });
      const mockRedis = vi.mocked(service as any).redis;
      
      // Simulate race condition where exists check passes but setex fails
      mockRedis?.exists?.mockResolvedValueOnce(0);
      mockRedis?.setex?.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBe(false);
    });

    it('should handle extremely large email content', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB content
      const largeEmail = createTestEmail({
        body: {
          content: largeContent,
          contentType: 'text'
        }
      });

      const result = await service.ingestEmail(largeEmail, IngestionSource.JSON_FILE);
      // Should handle large content gracefully
      expect(result).toBeDefined();
    });
  });

  describe('Performance and Stress Tests', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should meet 60+ emails/minute throughput requirement', async () => {
      const emailCount = 120; // 2 minutes worth at target rate
      const emails = Array.from({ length: emailCount }, (_, i) => 
        createTestEmail({ messageId: `perf-test-${i}` })
      );

      const startTime = performance.now();
      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
      const endTime = performance.now();

      const durationMinutes = (endTime - startTime) / (1000 * 60);
      const actualThroughput = emailCount / durationMinutes;

      expect(result.success).toBe(true);
      expect(actualThroughput).toBeGreaterThan(60); // Must exceed 60 emails/minute
      expect(result.data?.length).toBeGreaterThan(60);
    }, 30000); // 30 second timeout for performance test

    it('should handle concurrent batch processing', async () => {
      const batchSize = 50;
      const concurrentBatches = 4;
      
      const batches = Array.from({ length: concurrentBatches }, (_, batchIndex) => 
        Array.from({ length: batchSize }, (_, emailIndex) => 
          createTestEmail({ messageId: `concurrent-${batchIndex}-${emailIndex}` })
        )
      );

      const startTime = performance.now();
      const promises = batches?.map(batch => 
        service.ingestBatch(batch, IngestionSource.JSON_FILE)
      );
      
      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalEmails = batchSize * concurrentBatches;
      const durationMinutes = (endTime - startTime) / (1000 * 60);
      const throughput = totalEmails / durationMinutes;

      expect(results.every(r => r.success)).toBe(true);
      expect(throughput).toBeGreaterThan(60);
    }, 45000);

    it('should handle large batch sizes efficiently', async () => {
      const largeBatchSize = 1000;
      const emails = Array.from({ length: largeBatchSize }, (_, i) => 
        createTestEmail({ messageId: `large-batch-${i}` })
      );

      const startTime = performance.now();
      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const averageTimePerEmail = processingTime / largeBatchSize;

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(largeBatchSize);
      expect(averageTimePerEmail).toBeLessThan(100); // Less than 100ms per email
    }, 60000);

    it('should maintain performance under memory pressure', async () => {
      const iterations = 10;
      const batchSize = 100;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const emails = Array.from({ length: batchSize }, (_, j) => 
          createTestEmail({ 
            messageId: `memory-test-${i}-${j}`,
            body: {
              content: 'x'.repeat(1024 * 10), // 10KB per email
              contentType: 'text'
            }
          })
        );

        const startTime = performance.now();
        const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
        const endTime = performance.now();

        expect(result.success).toBe(true);
        results.push(endTime - startTime);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Performance should remain consistent (within 50% variance)
      const avgTime = results.reduce((a: any, b: any) => a + b, 0) / results?.length || 0;
      const maxVariance = avgTime * 0.5;
      
      expect(results.every(time => Math.abs(time - avgTime) < maxVariance)).toBe(true);
    }, 120000);

    it('should handle rapid consecutive single email ingestion', async () => {
      const emailCount = 500;
      const promises: Promise<any>[] = [];

      const startTime = performance.now();
      
      for (let i = 0; i < emailCount; i++) {
        const email = createTestEmail({ messageId: `rapid-${i}` });
        promises.push(service.ingestEmail(email, IngestionSource.JSON_FILE));
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const durationMinutes = (endTime - startTime) / (1000 * 60);
      const throughput = emailCount / durationMinutes;

      expect(results.every(r => r.success)).toBe(true);
      expect(throughput).toBeGreaterThan(60);
    }, 60000);
  });

  describe('Edge Cases and Boundary Conditions', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle empty batch ingestion', async () => {
      const result = await service.ingestBatch([], IngestionSource.JSON_FILE);
      
      expect(result.success).toBe(true);
      expect(result.data?).toHaveLength(0);
      expect(result.data?).toHaveLength(0);
    });

    it('should handle batch with all duplicates', async () => {
      const emails = [
        createTestEmail({ messageId: 'duplicate-test' }),
        createTestEmail({ messageId: 'duplicate-test' }), // Same ID
        createTestEmail({ messageId: 'duplicate-test' })  // Same ID
      ];

      const result = await service.ingestBatch(emails, IngestionSource.JSON_FILE);
      
      expect(result.success).toBe(true);
      expect(result.data?.length).toBeGreaterThan(0);
    });

    it('should handle emails with maximum field lengths', async () => {
      const maxLengthEmail = createTestEmail({
        messageId: 'x'.repeat(255), // Max message ID length
        subject: 'x'.repeat(998), // Max subject length (Outlook limit)
        body: {
          content: 'x'.repeat(1024 * 1024), // 1MB content
          contentType: 'html'
        }
      });

      const result = await service.ingestEmail(maxLengthEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBeDefined(); // Should handle gracefully
    });

    it('should handle emails with special characters and encoding', async () => {
      const specialEmail = createTestEmail({
        messageId: 'special-chars-测试-🚀-α',
        subject: '特殊字符测试 Special Characters Test 🚀 αβγ',
        body: {
          content: 'Content with émojis 🎉, unicode ™, and speciàl chars',
          contentType: 'text'
        },
        from: {
          address: 'test-émojis@exämple.com',
          name: 'Tëst Üser 🚀'
        }
      });

      const result = await service.ingestEmail(specialEmail, IngestionSource.JSON_FILE);
      expect(result.success).toBeTruthy();
    });

    it('should handle priority calculation edge cases', async () => {
      const testCases = [
        { importance: 'high', subject: 'URGENT CRITICAL EMERGENCY' }, // Max boost
        { importance: 'low', subject: 'routine update' }, // Min priority
        { importance: undefined, subject: 'normal email' }, // Undefined importance
        { importance: 'high', subject: '', hasAttachments: true } // High + attachments
      ];

      for (const testCase of testCases) {
        const email = createTestEmail(testCase as any);
        const result = await service.ingestEmail(email, IngestionSource.JSON_FILE);
        expect(result.success).toBeTruthy();
      }
    });

    it('should handle deduplication window edge cases', async () => {
      // Test deduplication at window boundaries
      const testEmail = createTestEmail({ messageId: 'dedup-boundary-test' });
      
      // First ingestion
      const result1 = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result1.success).toBe(true);
      expect(result1.data?.length).not.toBe('duplicate');

      // Immediate duplicate
      const result2 = await service.ingestEmail(testEmail, IngestionSource.JSON_FILE);
      expect(result2.success).toBe(true);
      expect(result2.data?.length).toBe('duplicate');
    });

    it('should handle configuration validation edge cases', async () => {
      const invalidConfigs = [
        { ...testConfig, processing: { ...testConfig.processing, batchSize: 0 } },
        { ...testConfig, processing: { ...testConfig.processing, concurrency: -1 } },
        { ...testConfig, processing: { ...testConfig.processing, maxRetries: 100 } },
        { ...testConfig, redis: { ...testConfig.redis, port: -1 } }
      ];

      for (const config of invalidConfigs) {
        expect(() => new EmailIngestionServiceImpl(
          config,
          mockEmailRepository,
          mockUnifiedEmailService
        )).toThrow();
      }
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should properly clean up resources on shutdown', async () => {
      const mockRedis = vi.mocked(service as any).redis;
      const mockQueue = (service as any).ingestionQueue;
      const mockWorker = (service as any).worker;

      await service.shutdown();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    it('should handle connection cleanup on errors', async () => {
      const mockRedis = vi.mocked(service as any).redis;
      mockRedis?.quit?.mockRejectedValueOnce(new Error('Connection already closed'));

      // Should not throw even if cleanup fails
      await expect(service.shutdown()).rejects.toThrow();
    });

    it('should prevent memory leaks in long-running operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        const emails = Array.from({ length: 10 }, (_, j) => 
          createTestEmail({ messageId: `memory-leak-test-${i}-${j}` })
        );
        
        await service.ingestBatch(emails, IngestionSource.JSON_FILE);
        
        // Periodic cleanup
        if (i % 20 === 0 && global.gc) {
          global.gc();
        }
      }

      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePerIteration = memoryIncrease / iterations;

      // Memory increase should be reasonable (less than 1KB per iteration)
      expect(memoryIncreasePerIteration).toBeLessThan(1024);
    }, 60000);
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await expect(service.shutdown()).resolves?.not?.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      await service.initialize();
      await service.shutdown();
      await expect(service.shutdown()).resolves?.not?.toThrow();
    });
  });
});

describe('EmailIngestionServiceFactory', () => {
  afterEach(() => {
    EmailIngestionServiceFactory.reset();
  });

  it('should create service with default configuration', async () => {
    const service = await EmailIngestionServiceFactory.create();
    expect(service).toBeDefined();
    await service.shutdown();
  });

  it('should create service with overrides', async () => {
    const overrides = {
      processing: {
        batchSize: 25,
        concurrency: 5,
        maxRetries: 4,
        retryDelay: 2000,
        deduplicationWindow: 12,
        priorityBoostKeywords: ['test', 'urgent']
      }
    };

    const service = await EmailIngestionServiceFactory.create(overrides);
    expect(service).toBeDefined();
    await service.shutdown();
  });

  it('should provide singleton instance', async () => {
    const instance1 = await EmailIngestionServiceFactory.getInstance();
    const instance2 = await EmailIngestionServiceFactory.getInstance();
    
    expect(instance1).toBe(instance2);
    await instance1.shutdown();
  });
});

describe('EmailIngestionConfigPresets', () => {
  it('should provide high throughput configuration', () => {
    const config = EmailIngestionConfigPresets.getHighThroughputConfig();
    expect(config.processing?.length).toBeGreaterThan(50);
    expect(config.processing?.length).toBeGreaterThan(10);
  });

  it('should provide development configuration', () => {
    const config = EmailIngestionConfigPresets.getDevelopmentConfig();
    expect(config.processing?.length).toBeLessThan(20);
    expect(config.processing?.length).toBeLessThan(10);
  });

  it('should provide test configuration', () => {
    const config = EmailIngestionConfigPresets.getTestConfig();
    expect(config.processing?.length).toBeLessThan(10);
    expect(config.processing?.length).toBeLessThan(5);
  });

  it('should provide auto-pull configuration', () => {
    const config = EmailIngestionConfigPresets.getAutoPullConfig();
    expect(config.mode).toBe(IngestionMode.AUTO_PULL);
    expect(config.autoPull).toBeDefined();
  });

  it('should provide hybrid configuration', () => {
    const config = EmailIngestionConfigPresets.getHybridConfig();
    expect(config.mode).toBe(IngestionMode.HYBRID);
    expect(config.autoPull).toBeDefined();
  });
});