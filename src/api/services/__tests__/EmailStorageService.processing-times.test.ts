import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import { EmailStorageService } from '../EmailStorageService.js';
import { EmailAnalysisResult, ProcessingMetadata } from '../EmailStorageService.js';
import { logger } from '../../../utils/logger.js';

// Mock logger to prevent console output during tests
jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('EmailStorageService - Processing Time Validation', () => {
  let service: EmailStorageService;
  let testDb: Database.Database;
  const testDbPath = ':memory:'; // Use in-memory database for tests

  beforeEach(() => {
    // Create a new instance with in-memory database
    service = new EmailStorageService(testDbPath, false);
    testDb = (service as any).db;
  });

  afterEach(() => {
    // Clean up
    service.close();
    jest.clearAllMocks();
  });

  describe('validateProcessingTimes', () => {
    it('should accept valid positive processing times', () => {
      const validMetadata: ProcessingMetadata = {
        stage1Time: 100,
        stage2Time: 200,
        totalTime: 300,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(validMetadata);

      expect(result).toEqual(validMetadata);
      expect(logger.warn).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should correct negative stage1Time', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: -100,
        stage2Time: 200,
        totalTime: 300,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(metadata);

      expect(result.stage1Time).toBe(100); // Absolute value
      expect(result.stage2Time).toBe(200);
      expect(result.totalTime).toBe(300);
      expect(logger.warn).toHaveBeenCalledWith(
        'Negative stage1Time detected',
        'EMAIL_STORAGE',
        expect.objectContaining({
          original: -100,
          corrected: 100
        })
      );
    });

    it('should correct negative stage2Time', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: 100,
        stage2Time: -200,
        totalTime: 300,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(metadata);

      expect(result.stage1Time).toBe(100);
      expect(result.stage2Time).toBe(200); // Absolute value
      expect(result.totalTime).toBe(300);
      expect(logger.warn).toHaveBeenCalledWith(
        'Negative stage2Time detected',
        'EMAIL_STORAGE',
        expect.objectContaining({
          original: -200,
          corrected: 200
        })
      );
    });

    it('should correct negative totalTime and ensure it is at least sum of stages', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: 100,
        stage2Time: 200,
        totalTime: -50,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(metadata);

      expect(result.stage1Time).toBe(100);
      expect(result.stage2Time).toBe(200);
      expect(result.totalTime).toBe(300); // Sum of stages
      expect(logger.warn).toHaveBeenCalledWith(
        'Negative totalTime detected',
        'EMAIL_STORAGE',
        expect.any(Object)
      );
    });

    it('should correct all negative values', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: -100,
        stage2Time: -200,
        totalTime: -300,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(metadata);

      expect(result.stage1Time).toBe(100);
      expect(result.stage2Time).toBe(200);
      expect(result.totalTime).toBe(300); // Sum of corrected stages
      expect(logger.warn).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        'Processing time validation issues detected',
        'EMAIL_STORAGE',
        expect.objectContaining({
          issues: expect.arrayContaining([
            'stage1Time was negative: -100ms',
            'stage2Time was negative: -200ms',
            'totalTime was negative: -300ms'
          ])
        })
      );
    });

    it('should ensure totalTime is at least the sum of stage times', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: 100,
        stage2Time: 200,
        totalTime: 250, // Less than sum (300)
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      const result = (service as any).validateProcessingTimes(metadata);

      expect(result.totalTime).toBe(300); // Corrected to sum of stages
      expect(logger.warn).toHaveBeenCalledWith(
        'Total time less than sum of stages',
        'EMAIL_STORAGE',
        expect.objectContaining({
          totalTime: 250,
          minExpected: 300
        })
      );
    });

    it('should track processing time anomalies', () => {
      const metadata: ProcessingMetadata = {
        stage1Time: -100,
        stage2Time: 200,
        totalTime: 300,
        models: {
          stage1: 'test-model-1',
          stage2: 'test-model-2'
        }
      };

      (service as any).validateProcessingTimes(metadata);

      // Check if anomaly tracking table was created
      const tableExists = testDb.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='processing_time_anomalies'"
      ).get();
      
      expect(tableExists).toBeTruthy();

      // Check if anomaly was recorded
      const anomaly = testDb.prepare(
        'SELECT * FROM processing_time_anomalies WHERE type = ?'
      ).get('negative_values') as any;

      expect(anomaly).toBeTruthy();
      expect(JSON.parse(anomaly.issues)).toContain('stage1Time was negative: -100ms');
    });
  });

  describe('storeEmail with processing time validation', () => {
    it('should store email with validated processing times', async () => {
      const mockEmail = {
        id: 'test-email-id',
        graphId: 'graph-123',
        subject: 'Test Email',
        from: {
          emailAddress: {
            name: 'Test Sender',
            address: 'sender@test.com'
          }
        },
        receivedDateTime: new Date().toISOString(),
        isRead: false,
        hasAttachments: false,
        bodyPreview: 'Test preview',
        body: 'Test body'
      };

      const mockAnalysis: EmailAnalysisResult = {
        quick: {
          workflow: { primary: 'test-workflow' },
          priority: 'Medium',
          intent: 'test-intent',
          urgency: 'normal',
          confidence: 0.9,
          suggestedState: 'new'
        },
        deep: {
          detailedWorkflow: {
            primary: 'test-workflow',
            confidence: 0.9
          },
          entities: {
            poNumbers: [],
            quoteNumbers: [],
            caseNumbers: [],
            partNumbers: [],
            orderReferences: [],
            contacts: []
          },
          actionItems: [],
          workflowState: {
            current: 'new',
            suggestedNext: 'in-progress'
          },
          businessImpact: {
            customerSatisfaction: 'medium'
          },
          contextualSummary: 'Test summary'
        },
        actionSummary: 'Test action',
        processingMetadata: {
          stage1Time: -100, // Negative value to test validation
          stage2Time: 200,
          totalTime: 300,
          models: {
            stage1: 'test-model-1',
            stage2: 'test-model-2'
          }
        }
      };

      await service.storeEmail(mockEmail as any, mockAnalysis);

      // Verify the email was stored
      const storedAnalysis = testDb.prepare(
        'SELECT * FROM email_analysis WHERE email_id = ?'
      ).get('test-email-id') as any;

      expect(storedAnalysis).toBeTruthy();
      expect(storedAnalysis.quick_processing_time).toBe(100); // Corrected value
      expect(storedAnalysis.deep_processing_time).toBe(200);
      expect(storedAnalysis.total_processing_time).toBe(300);
    });
  });

  describe('Database triggers for processing time validation', () => {
    it('should prevent insertion of negative processing times after migration', async () => {
      // Run the migration to add triggers
      const { up } = await import('../../../database/migrations/006_fix_negative_processing_times.js');
      up(testDb);

      // Try to insert a record with negative processing time
      const insertStmt = testDb.prepare(`
        INSERT INTO email_analysis (
          id, email_id, quick_processing_time, deep_processing_time, total_processing_time
        ) VALUES (?, ?, ?, ?, ?)
      `);

      expect(() => {
        insertStmt.run('test-id', 'test-email', -100, 200, 300);
      }).toThrow('Processing time cannot be negative');
    });

    it('should prevent update to negative processing times after migration', async () => {
      // Run the migration to add triggers
      const { up } = await import('../../../database/migrations/006_fix_negative_processing_times.js');
      up(testDb);

      // First insert a valid record
      testDb.prepare(`
        INSERT INTO email_analysis (
          id, email_id, quick_processing_time, deep_processing_time, total_processing_time
        ) VALUES (?, ?, ?, ?, ?)
      `).run('test-id', 'test-email', 100, 200, 300);

      // Try to update with negative value
      const updateStmt = testDb.prepare(`
        UPDATE email_analysis SET quick_processing_time = ? WHERE id = ?
      `);

      expect(() => {
        updateStmt.run(-50, 'test-id');
      }).toThrow('Processing time cannot be negative');
    });
  });
});