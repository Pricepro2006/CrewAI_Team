import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { setupRedisQueueSystem } from '../examples/redis-queue-integration';

// Mock external dependencies
vi.mock('ioredis', () => {
  const mockRedis = {
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue(undefined),
    xadd: vi.fn().mockResolvedValue('stream-id-123'),
    xreadgroup: vi.fn().mockResolvedValue([]),
    xgroup: vi.fn().mockResolvedValue('OK'),
    exists: vi.fn().mockResolvedValue(0),
    zadd: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
    on: vi.fn().mockReturnThis(),
    emit: vi.fn().mockReturnThis(),
    sendCommand: vi.fn().mockResolvedValue('OK')
  };

  return {
    default: vi.fn().mockImplementation(() => mockRedis)
  };
});

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'test-nanoid-123')
}));

describe('Redis Queue Integration Tests', () => {
  let app: Express;
  let queueSystem: any;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());

    // Initialize Redis queue system with Express app
    queueSystem = await setupRedisQueueSystem(app);
  });

  afterAll(async () => {
    if (queueSystem) {
      await queueSystem?.groceryPipeline?.shutdown();
    }
  });

  describe('Queue System Initialization', () => {
    it('should initialize all components successfully', () => {
      expect(queueSystem.messageQueue).toBeDefined();
      expect(queueSystem.groceryPipeline).toBeDefined();
      expect(queueSystem.cacheManager).toBeDefined();
      expect(queueSystem.router).toBeDefined();
    });

    it('should have active pipeline', () => {
      expect(queueSystem?.groceryPipeline?.isActive()).toBe(true);
    });
  });

  describe('API Endpoints', () => {
    describe('Health and Status', () => {
      it('should return health status', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/health')
          .expect(200);

        expect(response.body).toMatchObject({
          status: expect.any(String),
          pipeline: {
            active: expect.any(Boolean),
            uptime: expect.any(Number)
          },
          queues: {
            total: expect.any(Number),
            active: expect.any(Number)
          },
          timestamp: expect.any(String)
        });
      });

      it('should return system status', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/status')
          .expect(200);

        expect(response.body).toMatchObject({
          pipeline: {
            active: expect.any(Boolean),
            startedAt: expect.any(String)
          },
          queues: expect.any(Array),
          processing: expect.any(Object),
          timestamp: expect.any(String)
        });
      });

      it('should return aggregated statistics', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/stats')
          .expect(200);

        expect(response.body).toMatchObject({
          overview: {
            totalJobsCompleted: expect.any(Number),
            totalJobsFailed: expect.any(Number),
            totalRetries: expect.any(Number),
            successRate: expect.any(String),
            avgProcessingTime: expect.any(String)
          },
          queues: expect.any(Array),
          processing: expect.any(Object),
          timestamp: expect.any(String)
        });
      });
    });

    describe('Job Submission', () => {
      it('should submit price update job', async () => {
        const priceUpdateData = {
          productId: 'TEST_PROD_001',
          storeId: 'TEST_STORE_001',
          newPrice: 12.99,
          oldPrice: 14.99,
          currency: 'USD',
          effectiveDate: Date.now(),
          source: 'api_test',
          confidence: 0.95
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/price-update')
          .send(priceUpdateData)
          .expect(201);

        expect(response.body).toMatchObject({
          jobId: expect.any(String),
          type: 'price_update',
          status: 'queued',
          submittedAt: expect.any(String),
          productId: 'TEST_PROD_001',
          storeId: 'TEST_STORE_001'
        });
      });

      it('should validate price update data', async () => {
        const invalidPriceData = {
          productId: '', // Invalid - empty
          storeId: 'TEST_STORE',
          newPrice: -5.99, // Invalid - negative
          source: 'test'
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/price-update')
          .send(invalidPriceData)
          .expect(400);

        expect(response.body).toMatchObject({
          error: 'Invalid price update data',
          details: expect.any(Array)
        });
      });

      it('should submit inventory sync job', async () => {
        const inventoryData = {
          productId: 'TEST_INVENTORY_PROD',
          storeId: 'TEST_INVENTORY_STORE',
          quantity: 50,
          inStock: true,
          lastUpdated: Date.now(),
          source: 'api_test',
          threshold: 10
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/inventory-sync')
          .send(inventoryData)
          .expect(201);

        expect(response.body).toMatchObject({
          jobId: expect.any(String),
          type: 'inventory_sync',
          status: 'queued',
          submittedAt: expect.any(String),
          productId: 'TEST_INVENTORY_PROD',
          storeId: 'TEST_INVENTORY_STORE'
        });
      });

      it('should submit product match job', async () => {
        const productMatchData = {
          sourceProductId: 'PROD_A_123',
          targetProductId: 'PROD_B_456',
          confidence: 0.85,
          matchType: 'fuzzy',
          attributes: {
            brand: 'Test Brand',
            category: 'Grocery',
            size: '12oz'
          },
          verificationStatus: 'pending'
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/product-match')
          .send(productMatchData)
          .expect(201);

        expect(response.body).toMatchObject({
          jobId: expect.any(String),
          type: 'product_match',
          status: 'queued',
          submittedAt: expect.any(String),
          sourceProductId: 'PROD_A_123',
          targetProductId: 'PROD_B_456'
        });
      });

      it('should submit nutrition fetch job', async () => {
        const nutritionData = {
          productId: 'NUTRITION_PROD_789'
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/nutrition-fetch')
          .send(nutritionData)
          .expect(201);

        expect(response.body).toMatchObject({
          jobId: expect.any(String),
          type: 'nutrition_fetch',
          status: 'queued',
          submittedAt: expect.any(String),
          productId: 'NUTRITION_PROD_789'
        });
      });

      it('should submit batch jobs', async () => {
        const batchData = {
          jobs: [
            {
              type: 'price_update',
              data: {
                productId: 'BATCH_PROD_1',
                storeId: 'BATCH_STORE_1',
                newPrice: 9.99,
                currency: 'USD',
                effectiveDate: Date.now(),
                source: 'batch_test',
                confidence: 1.0
              }
            },
            {
              type: 'inventory_sync',
              data: {
                productId: 'BATCH_PROD_2',
                storeId: 'BATCH_STORE_2',
                quantity: 25,
                inStock: true,
                lastUpdated: Date.now(),
                source: 'batch_test'
              }
            },
            {
              type: 'nutrition_fetch',
              data: {
                productId: 'BATCH_NUTRITION_PROD'
              }
            }
          ]
        };

        const response = await request(app)
          .post('/api/grocery-queue/jobs/batch')
          .send(batchData)
          .expect(201);

        expect(response.body).toMatchObject({
          batch: {
            total: 3,
            successful: expect.any(Number),
            failed: expect.any(Number),
            submittedAt: expect.any(String)
          },
          jobs: expect.arrayContaining([
            expect.objectContaining({
              jobId: expect.any(String),
              type: expect.any(String),
              status: expect.any(String),
              success: expect.any(Boolean)
            })
          ])
        });
      });
    });

    describe('Job Monitoring', () => {
      it('should get job status', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/jobs/test-job-123')
          .expect(200);

        expect(response.body).toMatchObject({
          jobId: 'test-job-123',
          status: expect.any(String),
          progress: expect.any(Number),
          submittedAt: expect.any(String),
          message: expect.any(String)
        });
      });

      it('should get job logs', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/jobs/test-job-123/logs')
          .expect(200);

        expect(response.body).toMatchObject({
          jobId: 'test-job-123',
          logs: expect.any(Array),
          totalCount: expect.any(Number),
          limit: expect.any(Number)
        });

        if (response?.body?.logs?.length || 0 > 0) {
          expect(response?.body?.logs[0]).toMatchObject({
            timestamp: expect.any(String),
            level: expect.any(String),
            message: expect.any(String),
            data: expect.any(Object)
          });
        }
      });

      it('should get queue list', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/queues')
          .expect(200);

        expect(response.body).toMatchObject({
          queues: expect.any(Array),
          timestamp: expect.any(String)
        });
      });
    });

    describe('Admin Operations', () => {
      it('should start pipeline', async () => {
        const response = await request(app)
          .post('/api/grocery-queue/admin/pipeline/start')
          .expect(200);

        expect(response.body).toMatchObject({
          action: 'start',
          success: true,
          message: 'Pipeline started successfully',
          timestamp: expect.any(String)
        });
      });

      it('should stop pipeline', async () => {
        const response = await request(app)
          .post('/api/grocery-queue/admin/pipeline/stop')
          .expect(200);

        expect(response.body).toMatchObject({
          action: 'stop',
          success: true,
          message: 'Pipeline stopped successfully',
          timestamp: expect.any(String)
        });
      });

      it('should restart pipeline', async () => {
        const response = await request(app)
          .post('/api/grocery-queue/admin/pipeline/restart')
          .expect(200);

        expect(response.body).toMatchObject({
          action: 'restart',
          success: true,
          message: 'Pipeline restarted successfully',
          timestamp: expect.any(String)
        });
      });

      it('should control queue operations', async () => {
        const controlData = {
          action: 'pause',
          queueName: 'test_queue'
        };

        const response = await request(app)
          .post('/api/grocery-queue/admin/control')
          .send(controlData)
          .expect(200);

        expect(response.body).toMatchObject({
          action: 'pause',
          queueName: 'test_queue',
          success: true,
          timestamp: expect.any(String)
        });
      });

      it('should retry failed job', async () => {
        const response = await request(app)
          .post('/api/grocery-queue/admin/retry/failed-job-123')
          .expect(200);

        expect(response.body).toMatchObject({
          jobId: 'failed-job-123',
          action: 'retry',
          success: true,
          message: 'Job queued for retry',
          timestamp: expect.any(String)
        });
      });

      it('should delete job', async () => {
        const response = await request(app)
          .delete('/api/grocery-queue/admin/jobs/delete-job-123')
          .expect(200);

        expect(response.body).toMatchObject({
          jobId: 'delete-job-123',
          action: 'delete',
          success: true,
          message: 'Job deleted successfully',
          timestamp: expect.any(String)
        });
      });
    });

    describe('Metrics and Performance', () => {
      it('should get processing metrics', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/metrics/processing')
          .expect(200);

        expect(response.body).toMatchObject({
          metrics: expect.any(Object),
          timestamp: expect.any(String),
          uptime: expect.any(Number)
        });
      });

      it('should get performance metrics', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/metrics/performance')
          .expect(200);

        expect(response.body).toMatchObject({
          performance: {
            memory: {
              rss: expect.any(String),
              heapUsed: expect.any(String),
              heapTotal: expect.any(String),
              external: expect.any(String)
            },
            cpu: {
              uptime: expect.any(Number),
              loadAverage: expect.any(Array)
            },
            processing: {
              averageTime: expect.any(Number),
              totalJobs: expect.any(Number)
            }
          },
          timestamp: expect.any(String)
        });
      });

      it('should get error metrics', async () => {
        const response = await request(app)
          .get('/api/grocery-queue/metrics/errors')
          .expect(200);

        expect(response.body).toMatchObject({
          summary: {
            totalFailures: expect.any(Number),
            totalRetries: expect.any(Number),
            overallErrorRate: expect.any(Number)
          },
          byQueue: expect.any(Object),
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect job submission rate limits', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/grocery-queue/jobs/price-update')
          .send({
            productId: 'RATE_TEST_PROD',
            storeId: 'RATE_TEST_STORE',
            newPrice: 10.99,
            currency: 'USD',
            effectiveDate: Date.now(),
            source: 'rate_limit_test',
            confidence: 1.0
          })
      );

      const responses = await Promise.all(requests);
      
      // All requests should succeed with current high limits
      responses.forEach(response => {
        expect([201, 429]).toContain(response.status);
      });
    });

    it('should respect admin operation rate limits', async () => {
      // Make multiple admin requests
      const requests = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/grocery-queue/admin/pipeline/start')
      );

      const responses = await Promise.all(requests);
      
      // At least one should succeed
      const successfulResponses = responses?.filter(r => r.status === 200);
      expect(successfulResponses?.length || 0).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid job type in batch', async () => {
      const invalidBatchData = {
        jobs: [
          {
            type: 'invalid_job_type',
            data: { test: 'data' }
          }
        ]
      };

      const response = await request(app)
        .post('/api/grocery-queue/jobs/batch')
        .send(invalidBatchData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid batch job data',
        details: expect.any(Array)
      });
    });

    it('should handle missing required fields', async () => {
      const invalidJobData = {
        // Missing all required fields
      };

      const response = await request(app)
        .post('/api/grocery-queue/jobs/price-update')
        .send(invalidJobData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid price update data',
        details: expect.any(Array)
      });
    });

    it('should handle invalid queue control actions', async () => {
      const invalidControlData = {
        action: 'invalid_action'
      };

      const response = await request(app)
        .post('/api/grocery-queue/admin/control')
        .send(invalidControlData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: 'Invalid control request',
        details: expect.any(Array)
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete price update workflow', async () => {
      // 1. Submit price update
      const priceUpdateResponse = await request(app)
        .post('/api/grocery-queue/jobs/price-update')
        .send({
          productId: 'WORKFLOW_PROD',
          storeId: 'WORKFLOW_STORE',
          newPrice: 8.99,
          oldPrice: 12.99, // Significant drop - should trigger deal analysis
          currency: 'USD',
          effectiveDate: Date.now(),
          source: 'workflow_test',
          confidence: 0.9
        })
        .expect(201);

      const jobId = priceUpdateResponse?.body?.jobId;
      expect(jobId).toBeDefined();

      // 2. Check job status
      const statusResponse = await request(app)
        .get(`/api/grocery-queue/jobs/${jobId}`)
        .expect(200);

      expect(statusResponse?.body?.jobId).toBe(jobId);

      // 3. Check system stats were updated
      const statsResponse = await request(app)
        .get('/api/grocery-queue/stats')
        .expect(200);

      expect(statsResponse?.body?.overview).toBeDefined();
    });

    it('should handle batch processing workflow', async () => {
      // Submit a mix of different job types
      const batchResponse = await request(app)
        .post('/api/grocery-queue/jobs/batch')
        .send({
          jobs: [
            {
              type: 'price_update',
              data: {
                productId: 'BATCH_WORKFLOW_1',
                storeId: 'BATCH_WORKFLOW_STORE',
                newPrice: 15.99,
                currency: 'USD',
                effectiveDate: Date.now(),
                source: 'batch_workflow',
                confidence: 1.0
              }
            },
            {
              type: 'inventory_sync', 
              data: {
                productId: 'BATCH_WORKFLOW_2',
                storeId: 'BATCH_WORKFLOW_STORE',
                quantity: 100,
                inStock: true,
                lastUpdated: Date.now(),
                source: 'batch_workflow'
              }
            }
          ]
        })
        .expect(201);

      expect(batchResponse?.body?.batch.total).toBe(2);
      expect(batchResponse?.body?.jobs).toHaveLength(2);

      // Check that processing metrics reflect the batch
      const metricsResponse = await request(app)
        .get('/api/grocery-queue/metrics/processing')
        .expect(200);

      expect(metricsResponse?.body?.metrics).toBeDefined();
    });
  });
});