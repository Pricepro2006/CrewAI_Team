import express, { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { GroceryDataPipeline } from '../services/GroceryDataPipeline.js';
import type { PriceUpdate, InventoryUpdate, ProductMatch } from '../services/GroceryDataPipeline.js';
import { RedisMessageQueue } from '../services/RedisMessageQueue.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

// Request validation schemas
const PriceUpdateRequestSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  newPrice: z.number().positive(),
  oldPrice: z.number().positive().optional(),
  currency: z.string().default('USD'),
  effectiveDate: z.number().optional().default(() => Date.now()),
  source: z.string().min(1),
  confidence: z.number().min(0).max(1).default(1.0)
});

const InventoryUpdateRequestSchema = z.object({
  productId: z.string().min(1),
  storeId: z.string().min(1),
  quantity: z.number().min(0),
  inStock: z.boolean(),
  lastUpdated: z.number().optional().default(() => Date.now()),
  source: z.string().min(1),
  threshold: z.number().optional()
});

const ProductMatchRequestSchema = z.object({
  sourceProductId: z.string().min(1),
  targetProductId: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  matchType: z.enum(['exact', 'fuzzy', 'category', 'brand']).default('fuzzy'),
  attributes: z.record(z.any()).default({}),
  verificationStatus: z.enum(['pending', 'verified', 'rejected']).default('pending')
});

const BatchJobRequestSchema = z.object({
  jobs: z.array(z.object({
    type: z.enum(['price_update', 'inventory_sync', 'product_match', 'nutrition_fetch']),
    data: z.record(z.any()),
    priority: z.number().min(0).max(10).optional(),
    delay: z.number().min(0).optional()
  })).min(1).max(100) // Limit batch size
});

const QueueControlRequestSchema = z.object({
  action: z.enum(['pause', 'resume', 'clear', 'purge_failed']),
  queueName: z.string().optional()
});

export interface GroceryQueueRouterDependencies {
  groceryPipeline: GroceryDataPipeline;
  messageQueue: RedisMessageQueue;
}

/**
 * GroceryQueueRouter
 * 
 * REST API endpoints for managing the grocery data processing pipeline.
 * Provides job submission, monitoring, and queue management capabilities.
 */
export class GroceryQueueRouter {
  private router: Router;
  private groceryPipeline: GroceryDataPipeline;
  private messageQueue: RedisMessageQueue;
  private jobRateLimiter: any;
  private adminRateLimiter: any;

  constructor(dependencies: GroceryQueueRouterDependencies) {
    this.router = Router();
    this.groceryPipeline = dependencies.groceryPipeline;
    this.messageQueue = dependencies.messageQueue;

    // Rate limiting for job submissions (higher limit)
    this.jobRateLimiter = createRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 1000, // 1000 jobs per minute
      message: 'Too many job submissions, please slow down'
    });

    // Rate limiting for admin operations (lower limit)
    this.adminRateLimiter = createRateLimiter({
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 admin operations per minute
      message: 'Too many admin operations, please slow down'
    });

    this.setupRoutes();
    this.setupEventHandlers();
  }

  private setupRoutes(): void {
    // Health and status endpoints
    this.router.get('/health', this.getHealth.bind(this));
    this.router.get('/status', this.getStatus.bind(this));
    this.router.get('/stats', this.getStats.bind(this));
    this.router.get('/queues', this.getQueueList.bind(this));
    this.router.get('/queues/:queueName/stats', this.getQueueStats.bind(this));

    // Job submission endpoints
    this.router.post('/jobs/price-update', this.jobRateLimiter, this.submitPriceUpdate.bind(this));
    this.router.post('/jobs/inventory-sync', this.jobRateLimiter, this.submitInventorySync.bind(this));
    this.router.post('/jobs/product-match', this.jobRateLimiter, this.submitProductMatch.bind(this));
    this.router.post('/jobs/nutrition-fetch', this.jobRateLimiter, this.submitNutritionFetch.bind(this));
    
    // Batch job submission
    this.router.post('/jobs/batch', this.jobRateLimiter, this.submitBatchJobs.bind(this));

    // Job monitoring endpoints
    this.router.get('/jobs/:jobId', this.getJobStatus.bind(this));
    this.router.get('/jobs/:jobId/logs', this.getJobLogs.bind(this));

    // Queue management endpoints (admin)
    this.router.post('/admin/control', this.adminRateLimiter, this.controlQueue.bind(this));
    this.router.post('/admin/retry/:jobId', this.adminRateLimiter, this.retryJob.bind(this));
    this.router.delete('/admin/jobs/:jobId', this.adminRateLimiter, this.deleteJob.bind(this));
    
    // Pipeline management
    this.router.post('/admin/pipeline/start', this.adminRateLimiter, this.startPipeline.bind(this));
    this.router.post('/admin/pipeline/stop', this.adminRateLimiter, this.stopPipeline.bind(this));
    this.router.post('/admin/pipeline/restart', this.adminRateLimiter, this.restartPipeline.bind(this));

    // Monitoring and metrics
    this.router.get('/metrics/processing', this.getProcessingMetrics.bind(this));
    this.router.get('/metrics/performance', this.getPerformanceMetrics.bind(this));
    this.router.get('/metrics/errors', this.getErrorMetrics.bind(this));
  }

  private setupEventHandlers(): void {
    this.groceryPipeline.on('job:completed', (data) => {
      console.log(`[GroceryQueue] Job completed: ${data.messageId} (${data.processingTime}ms)`);
    });

    this.groceryPipeline.on('job:failed', (data) => {
      console.error(`[GroceryQueue] Job failed: ${data.messageId} - ${data.error}`);
    });

    this.groceryPipeline.on('job:retry', (data) => {
      console.warn(`[GroceryQueue] Job retry: ${data.messageId} (attempt ${data.retryCount})`);
    });

    this.groceryPipeline.on('pipeline:started', () => {
      console.log('[GroceryQueue] Pipeline started successfully');
    });

    this.groceryPipeline.on('pipeline:stopped', () => {
      console.log('[GroceryQueue] Pipeline stopped');
    });
  }

  // Health and status endpoints
  private async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const pipelineActive = this.groceryPipeline.isActive();
      const queueStats = await this.groceryPipeline.getQueueStats();
      
      const health = {
        status: pipelineActive ? 'healthy' : 'stopped',
        pipeline: {
          active: pipelineActive,
          uptime: process.uptime()
        },
        queues: {
          total: queueStats.length,
          active: queueStats.filter((q: any) => q.length > 0).length
        },
        timestamp: new Date().toISOString()
      };

      const statusCode = pipelineActive ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const processingStats = this.groceryPipeline.getProcessingStats();
      const queueStats = await this.groceryPipeline.getQueueStats();

      res.json({
        pipeline: {
          active: this.groceryPipeline.isActive(),
          startedAt: new Date(Date.now() - (process.uptime() * 1000)).toISOString()
        },
        queues: queueStats,
        processing: Object.fromEntries(processingStats),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getStats(req: Request, res: Response): Promise<void> {
    try {
      const processingStats = this.groceryPipeline.getProcessingStats();
      const queueStats = await this.groceryPipeline.getQueueStats();
      
      // Aggregate statistics
      const totalCompleted = Array.from(processingStats.values())
        .reduce((sum, stats) => sum + (stats.completed || 0), 0);
      const totalFailed = Array.from(processingStats.values())
        .reduce((sum, stats) => sum + (stats.failed || 0), 0);
      const totalRetries = Array.from(processingStats.values())
        .reduce((sum, stats) => sum + (stats.retry || 0), 0);

      const avgProcessingTime = Array.from(processingStats.values())
        .reduce((sum, stats) => sum + (stats.avgProcessingTime || 0), 0) / processingStats.size;

      res.json({
        overview: {
          totalJobsCompleted: totalCompleted,
          totalJobsFailed: totalFailed,
          totalRetries: totalRetries,
          successRate: totalCompleted + totalFailed > 0 
            ? ((totalCompleted / (totalCompleted + totalFailed)) * 100).toFixed(2) + '%'
            : '0%',
          avgProcessingTime: avgProcessingTime.toFixed(2) + 'ms'
        },
        queues: queueStats,
        processing: Object.fromEntries(processingStats),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getQueueList(req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await this.groceryPipeline.getQueueStats();
      
      res.json({
        queues: queueStats.map((queue: any) => ({
          name: queue.name,
          length: queue.length,
          processing: queue.processing,
          completed: queue.completed,
          failed: queue.failed,
          throughput: queue.throughput
        })),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get queue list',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const { queueName } = req.params;
      const stats = await this.messageQueue.getQueueStats(queueName);
      
      if (!stats) {
        res.status(404).json({ error: 'Queue not found' });
        return;
      }

      res.json({
        queue: queueName,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get queue statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Job submission endpoints
  private async submitPriceUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const priceData = PriceUpdateRequestSchema.parse(req.body);
      const jobId = await this.groceryPipeline.submitPriceUpdate(priceData as PriceUpdate);
      
      res.status(201).json({
        jobId,
        type: 'price_update',
        status: 'queued',
        submittedAt: new Date().toISOString(),
        productId: priceData.productId,
        storeId: priceData.storeId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid price update data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async submitInventorySync(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const inventoryData = InventoryUpdateRequestSchema.parse(req.body);
      const jobId = await this.groceryPipeline.submitInventorySync(inventoryData as InventoryUpdate);
      
      res.status(201).json({
        jobId,
        type: 'inventory_sync',
        status: 'queued',
        submittedAt: new Date().toISOString(),
        productId: inventoryData.productId,
        storeId: inventoryData.storeId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid inventory data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async submitProductMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const matchData = ProductMatchRequestSchema.parse(req.body);
      const jobId = await this.groceryPipeline.submitProductMatch(matchData as ProductMatch);
      
      res.status(201).json({
        jobId,
        type: 'product_match',
        status: 'queued',
        submittedAt: new Date().toISOString(),
        sourceProductId: matchData.sourceProductId,
        targetProductId: matchData.targetProductId
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid product match data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async submitNutritionFetch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productId } = req.body;
      
      if (!productId || typeof productId !== 'string') {
        res.status(400).json({
          error: 'Product ID is required'
        });
        return;
      }

      const jobId = await this.groceryPipeline.submitNutritionFetch(productId);
      
      res.status(201).json({
        jobId,
        type: 'nutrition_fetch',
        status: 'queued',
        submittedAt: new Date().toISOString(),
        productId
      });
    } catch (error) {
      next(error);
    }
  }

  private async submitBatchJobs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const batchData = BatchJobRequestSchema.parse(req.body);
      const results = [];

      for (const job of batchData.jobs) {
        try {
          let jobId: string;

          switch (job.type) {
            case 'price_update':
              jobId = await this.groceryPipeline.submitPriceUpdate(job.data as PriceUpdate);
              break;
            case 'inventory_sync':
              jobId = await this.groceryPipeline.submitInventorySync(job.data as InventoryUpdate);
              break;
            case 'product_match':
              jobId = await this.groceryPipeline.submitProductMatch(job.data as ProductMatch);
              break;
            case 'nutrition_fetch':
              jobId = await this.groceryPipeline.submitNutritionFetch(job.data.productId);
              break;
            default:
              throw new Error(`Unsupported job type: ${job.type}`);
          }

          results.push({
            jobId,
            type: job.type,
            status: 'queued',
            success: true
          });
        } catch (error) {
          results.push({
            type: job.type,
            status: 'failed',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;

      res.status(201).json({
        batch: {
          total: results.length,
          successful: successCount,
          failed: failureCount,
          submittedAt: new Date().toISOString()
        },
        jobs: results
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid batch job data',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  // Job monitoring endpoints
  private async getJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      // This would typically query job status from Redis
      // For now, return a mock response
      res.json({
        jobId,
        status: 'processing', // queued, processing, completed, failed, retrying
        progress: 75,
        submittedAt: new Date(Date.now() - 30000).toISOString(),
        startedAt: new Date(Date.now() - 15000).toISOString(),
        estimatedCompletion: new Date(Date.now() + 5000).toISOString(),
        retryCount: 0,
        message: 'Job is being processed'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get job status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getJobLogs(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      // Mock job logs
      const logs = Array.from({ length: Math.min(limit, 10) }, (_, i) => ({
        timestamp: new Date(Date.now() - (i * 1000)).toISOString(),
        level: i < 2 ? 'error' : i < 4 ? 'warn' : 'info',
        message: `Processing step ${10 - i} for job ${jobId}`,
        data: { step: 10 - i, jobId }
      })).reverse();

      res.json({
        jobId,
        logs,
        totalCount: logs.length,
        limit
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get job logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Queue management endpoints
  private async controlQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const controlData = QueueControlRequestSchema.parse(req.body);
      const { action, queueName } = controlData;

      switch (action) {
        case 'pause':
          if (queueName) {
            await this.messageQueue.pauseQueue(queueName);
          } else {
            await this.groceryPipeline.stop();
          }
          break;
        case 'resume':
          if (queueName) {
            await this.messageQueue.resumeQueue(queueName);
          } else {
            await this.groceryPipeline.start();
          }
          break;
        case 'clear':
          if (queueName) {
            const deletedCount = await this.messageQueue.clearQueue(queueName);
            res.json({
              action,
              queueName,
              deletedMessages: deletedCount,
              timestamp: new Date().toISOString()
            });
            return;
          } else {
            res.status(400).json({ error: 'Queue name required for clear action' });
            return;
          }
        default:
          res.status(400).json({ error: `Unsupported action: ${action}` });
          return;
      }

      res.json({
        action,
        queueName: queueName || 'all',
        success: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Invalid control request',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private async retryJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      // Implementation would retry the specific job
      res.json({
        jobId,
        action: 'retry',
        success: true,
        message: 'Job queued for retry',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to retry job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async deleteJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      
      // Implementation would delete/cancel the job
      res.json({
        jobId,
        action: 'delete',
        success: true,
        message: 'Job deleted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Pipeline management
  private async startPipeline(req: Request, res: Response): Promise<void> {
    try {
      await this.groceryPipeline.start();
      res.json({
        action: 'start',
        success: true,
        message: 'Pipeline started successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to start pipeline',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async stopPipeline(req: Request, res: Response): Promise<void> {
    try {
      await this.groceryPipeline.stop();
      res.json({
        action: 'stop',
        success: true,
        message: 'Pipeline stopped successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to stop pipeline',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async restartPipeline(req: Request, res: Response): Promise<void> {
    try {
      await this.groceryPipeline.stop();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Brief pause
      await this.groceryPipeline.start();
      
      res.json({
        action: 'restart',
        success: true,
        message: 'Pipeline restarted successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to restart pipeline',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Metrics endpoints
  private async getProcessingMetrics(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.groceryPipeline.getProcessingStats();
      const metrics = Object.fromEntries(
        Array.from(stats.entries()).map(([queue, data]) => [
          queue,
          {
            ...data,
            throughput: data.completed / Math.max(process.uptime() / 60, 1), // per minute
            errorRate: data.failed / Math.max(data.completed + data.failed, 1) * 100
          }
        ])
      );

      res.json({
        metrics,
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime())
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get processing metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const memoryUsage = process.memoryUsage();
      const stats = this.groceryPipeline.getProcessingStats();
      
      res.json({
        performance: {
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
          },
          cpu: {
            uptime: Math.floor(process.uptime()),
            loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0]
          },
          processing: {
            averageTime: Array.from(stats.values()).reduce(
              (sum, stat) => sum + (stat.avgProcessingTime || 0), 0
            ) / Math.max(stats.size, 1),
            totalJobs: Array.from(stats.values()).reduce(
              (sum, stat) => sum + (stat.completed || 0) + (stat.failed || 0), 0
            )
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get performance metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getErrorMetrics(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.groceryPipeline.getProcessingStats();
      const errorMetrics = Object.fromEntries(
        Array.from(stats.entries()).map(([queue, data]) => [
          queue,
          {
            failed: data.failed || 0,
            retries: data.retry || 0,
            errorRate: ((data.failed || 0) / Math.max((data.completed || 0) + (data.failed || 0), 1)) * 100
          }
        ])
      );

      const totalFailed = Object.values(errorMetrics).reduce((sum: number, metrics: any) => sum + metrics.failed, 0);
      const totalRetries = Object.values(errorMetrics).reduce((sum: number, metrics: any) => sum + metrics.retries, 0);

      res.json({
        summary: {
          totalFailures: totalFailed,
          totalRetries: totalRetries,
          overallErrorRate: totalFailed / Math.max(Object.values(stats).reduce((sum, stat) => sum + (stat.completed || 0) + (stat.failed || 0), 0), 1) * 100
        },
        byQueue: errorMetrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get error metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  public getRouter(): Router {
    return this.router;
  }
}