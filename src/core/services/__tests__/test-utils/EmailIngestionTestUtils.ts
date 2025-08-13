/**
 * EmailIngestionService Test Utilities
 * 
 * Comprehensive utilities for testing EmailIngestionService
 * Provides factories, mocks, and test helpers
 */

import { vi } from 'vitest';
import { 
  RawEmailData, 
  IngestionSource, 
  EmailIngestionConfig, 
  IngestionMode 
} from '../../EmailIngestionService.js';
import { EmailRepository } from '../../../../database/repositories/EmailRepository.js';
import { UnifiedEmailService } from '../../../../api/services/UnifiedEmailService.js';

// =====================================================
// Test Data Factories
// =====================================================

export class EmailTestDataFactory {
  private static emailCounter = 0;

  static createBasicEmail(overrides: Partial<RawEmailData> = {}): RawEmailData {
    const id = ++this.emailCounter;
    return {
      messageId: `test-message-${id}-${Date.now()}`,
      subject: `Test Email Subject ${id}`,
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
    };
  }

  static createLargeEmail(overrides: Partial<RawEmailData> = {}): RawEmailData {
    return this.createBasicEmail({
      subject: 'Large Test Email with Extended Subject Line for Performance Testing',
      body: {
        content: 'Large email content: ' + 'x'.repeat(50000), // 50KB content
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
  }

  static createHighPriorityEmail(overrides: Partial<RawEmailData> = {}): RawEmailData {
    return this.createBasicEmail({
      importance: 'high',
      subject: 'URGENT CRITICAL EMERGENCY - High Priority Test Email',
      ...overrides
    });
  }

  static createEmailWithSpecialChars(overrides: Partial<RawEmailData> = {}): RawEmailData {
    return this.createBasicEmail({
      messageId: 'special-chars-测试-🚀-α',
      subject: '特殊字符测试 Special Characters Test 🚀 αβγ',
      body: {
        content: 'Content with émojis 🎉, unicode ™, and speciàl chars',
        contentType: 'text'
      },
      from: {
        address: 'test-émojis@exämple.com',
        name: 'Tëst Üser 🚀'
      },
      ...overrides
    });
  }

  static createMalformedEmail(): any {
    return {
      messageId: '', // Empty message ID
      subject: null, // Null subject
      body: undefined, // Undefined body
      from: 'invalid-email-format', // Invalid email format
      to: [], // Empty recipients
      receivedDateTime: 'invalid-date', // Invalid date
      hasAttachments: 'not-boolean' // Wrong type
    };
  }

  static createEmailBatch(count: number, overrides: Partial<RawEmailData> = {}): RawEmailData[] {
    return Array.from({ length: count }, (_, i) => 
      this.createBasicEmail({
        messageId: `batch-email-${i}-${Date.now()}`,
        subject: `Batch Email ${i + 1}`,
        ...overrides
      })
    );
  }

  static createMixedPriorityBatch(count: number): RawEmailData[] {
    return Array.from({ length: count }, (_, i) => {
      const importance = i % 3 === 0 ? 'high' : 
                        i % 3 === 1 ? 'low' : 'normal';
      const subject = i % 5 === 0 ? 'URGENT Critical Issue' : `Email ${i + 1}`;
      
      return this.createBasicEmail({
        messageId: `mixed-priority-${i}-${Date.now()}`,
        importance: importance as any,
        subject
      });
    });
  }

  static createDuplicateEmails(messageId: string, count: number): RawEmailData[] {
    return Array.from({ length: count }, () => 
      this.createBasicEmail({ messageId })
    );
  }
}

// =====================================================
// Configuration Factories
// =====================================================

export class ConfigTestFactory {
  static createDefaultConfig(): EmailIngestionConfig {
    return {
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
  }

  static createHighThroughputConfig(): EmailIngestionConfig {
    return {
      ...this.createDefaultConfig(),
      processing: {
        batchSize: 100,
        concurrency: 10,
        maxRetries: 3,
        retryDelay: 500,
        deduplicationWindow: 24,
        priorityBoostKeywords: ['urgent', 'critical', 'emergency', 'asap']
      }
    };
  }

  static createAutoPullConfig(): EmailIngestionConfig {
    return {
      ...this.createDefaultConfig(),
      mode: IngestionMode.AUTO_PULL,
      autoPull: {
        interval: 1, // 1 minute
        sources: [IngestionSource.MICROSOFT_GRAPH],
        maxEmailsPerPull: 100
      }
    };
  }

  static createHybridConfig(): EmailIngestionConfig {
    return {
      ...this.createDefaultConfig(),
      mode: IngestionMode.HYBRID,
      autoPull: {
        interval: 5, // 5 minutes
        sources: [IngestionSource.MICROSOFT_GRAPH, IngestionSource.GMAIL_API],
        maxEmailsPerPull: 200
      }
    };
  }

  static createInvalidConfigs(): EmailIngestionConfig[] {
    const base = this.createDefaultConfig();
    return [
      { ...base, processing: { ...base.processing, batchSize: 0 } },
      { ...base, processing: { ...base.processing, concurrency: -1 } },
      { ...base, processing: { ...base.processing, maxRetries: 100 } },
      { ...base, redis: { ...base.redis, port: -1 } },
      { ...base, redis: { ...base.redis, host: '' } }
    ];
  }
}

// =====================================================
// Mock Factories
// =====================================================

export class MockFactory {
  static createMockEmailRepository(): EmailRepository {
    const mock = new EmailRepository({ db: {} as any });
    
    // Default implementations
    vi.mocked(mock.getStatistics).mockResolvedValue({
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

    vi.mocked(mock.findOne).mockResolvedValue(null);
    vi.mocked(mock.create).mockResolvedValue({
      id: 'mock-email-id',
      messageId: 'mock-message-id',
      subject: 'Mock Email',
      status: 'pending'
    } as any);

    return mock;
  }

  static createMockUnifiedEmailService(): UnifiedEmailService {
    const mock = new UnifiedEmailService();
    
    vi.mocked(mock.processIncomingEmail).mockImplementation(async (email) => ({
      id: `processed-${email.messageId}`,
      subject: email.subject,
      from: email.from.address,
      status: 'processed',
      createdAt: new Date(),
      updatedAt: new Date()
    } as any));

    return mock;
  }

  static createFailingUnifiedEmailService(failureRate = 0.3): UnifiedEmailService {
    const mock = new UnifiedEmailService();
    
    vi.mocked(mock.processIncomingEmail).mockImplementation(async (email) => {
      if (Math.random() < failureRate) {
        throw new Error('Simulated processing failure');
      }
      
      return {
        id: `processed-${email.messageId}`,
        subject: email.subject,
        from: email.from.address
      } as any;
    });

    return mock;
  }

  static createSlowUnifiedEmailService(delayMs = 100): UnifiedEmailService {
    const mock = new UnifiedEmailService();
    
    vi.mocked(mock.processIncomingEmail).mockImplementation(async (email) => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
      return {
        id: `processed-${email.messageId}`,
        subject: email.subject,
        from: email.from.address
      } as any;
    });

    return mock;
  }
}

// =====================================================
// Performance Test Utilities
// =====================================================

export interface PerformanceMetrics {
  totalTime: number;
  avgTimePerOperation: number;
  throughputPerMinute: number;
  memoryUsed: number;
  peakMemory: number;
}

export class PerformanceTestUtils {
  static async measurePerformance<T>(
    operation: () => Promise<T>,
    operationCount: number = 1
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory.heapUsed;
    
    const memoryMonitor = setInterval(() => {
      const current = process.memoryUsage().heapUsed;
      if (current > peakMemory) {
        peakMemory = current;
      }
    }, 10);

    const startTime = performance.now();
    const result = await operation();
    const endTime = performance.now();
    
    clearInterval(memoryMonitor);
    
    const finalMemory = process.memoryUsage();
    const totalTime = endTime - startTime;
    
    return {
      result,
      metrics: {
        totalTime,
        avgTimePerOperation: totalTime / operationCount,
        throughputPerMinute: (operationCount / totalTime) * 60000,
        memoryUsed: finalMemory.heapUsed - initialMemory.heapUsed,
        peakMemory: peakMemory - initialMemory.heapUsed
      }
    };
  }

  static expectThroughputRequirement(
    metrics: PerformanceMetrics, 
    minimumThroughput: number = 60
  ): void {
    expect(metrics.throughputPerMinute).toBeGreaterThan(minimumThroughput);
  }

  static expectLatencyRequirement(
    metrics: PerformanceMetrics, 
    maxLatencyMs: number = 1000
  ): void {
    expect(metrics.avgTimePerOperation).toBeLessThan(maxLatencyMs);
  }

  static expectMemoryEfficiency(
    metrics: PerformanceMetrics, 
    maxMemoryPerOpMB: number = 1
  ): void {
    const memoryPerOpMB = metrics.memoryUsed / (1024 * 1024);
    expect(memoryPerOpMB).toBeLessThan(maxMemoryPerOpMB);
  }
}

// =====================================================
// Test Assertion Helpers
// =====================================================

export class TestAssertions {
  static expectSuccessfulIngestion(result: any): void {
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.messageId).toBeDefined();
    expect(result.data.status).toMatch(/^(processed|duplicate)$/);
  }

  static expectFailedIngestion(result: any, errorMessage?: string): void {
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    if (errorMessage) {
      expect(result.error).toContain(errorMessage);
    }
  }

  static expectBatchResult(
    result: any, 
    expectedTotal: number, 
    expectedProcessed?: number
  ): void {
    expect(result.success).toBe(true);
    expect(result.data.totalEmails).toBe(expectedTotal);
    expect(result.data.processed + result.data.duplicates + result.data.failed).toBe(expectedTotal);
    
    if (expectedProcessed !== undefined) {
      expect(result.data.processed).toBe(expectedProcessed);
    }
  }

  static expectHealthyService(health: any): void {
    expect(health.healthy).toBe(true);
    expect(health.status).toBe('operational');
    expect(health.components.redis.healthy).toBe(true);
    expect(health.components.queue.healthy).toBe(true);
    expect(health.components.database.healthy).toBe(true);
  }

  static expectDegradedService(health: any): void {
    expect(health.healthy).toBe(false);
    expect(health.status).toMatch(/^(degraded|failing)$/);
  }
}

// =====================================================
// Test Environment Utilities
// =====================================================

export class TestEnvironmentUtils {
  static setupTestEnvironment(): void {
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error';
    process.env.DISABLE_EXTERNAL_APIS = 'true';
  }

  static cleanupTestEnvironment(): void {
    // Clean up any test-specific environment variables
    delete process.env.DISABLE_EXTERNAL_APIS;
  }

  static forceGarbageCollection(): void {
    if (global.gc) {
      global.gc();
    }
  }

  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeoutMs: number = 5000,
    intervalMs: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    throw new Error(`Condition not met within ${timeoutMs}ms timeout`);
  }
}

// =====================================================
// Export all utilities
// =====================================================

export {
  EmailTestDataFactory,
  ConfigTestFactory,
  MockFactory,
  PerformanceTestUtils,
  TestAssertions,
  TestEnvironmentUtils
};