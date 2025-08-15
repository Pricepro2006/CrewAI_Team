/**
 * tRPC Router for NLP Microservice
 * Provides type-safe RPC endpoints for NLP operations
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { NLPService } from '../../services/NLPService.js';
import { logger } from '../../utils/logger.js';
import type { NLPServiceAPI } from '../../types/index.js';

// Initialize tRPC
const t = initTRPC.create();

export const router = t?.router;
export const procedure = t?.procedure;

// Input validation schemas
const processInputSchema = z.object({
  query: z.string().min(1, 'Query cannot be empty').max(1000, 'Query too long'),
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
  timeout: z.number().min(1000).max(60000).optional(),
  metadata: z.record(z.any()).optional()
});

const batchInputSchema = z.object({
  queries: z.array(z.object({
    query: z.string().min(1),
    metadata: z.record(z.any()).optional()
  })).min(1, 'Batch cannot be empty').max(10, 'Batch too large'),
  priority: z.enum(['high', 'normal', 'low']).optional().default('normal'),
  timeout: z.number().min(1000).max(120000).optional()
});

// Output schemas for type safety
const entitySchema = z.object({
  type: z.string(),
  value: z.string(),
  confidence: z.number(),
  startIndex: z.number(),
  endIndex: z.number()
});

const intentSchema = z.object({
  action: z.string(),
  confidence: z.number()
});

const normalizedProductSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string().optional()
});

const processResponseSchema = z.object({
  success: z.boolean(),
  requestId: z.string(),
  result: z.object({
    entities: z.array(entitySchema),
    intent: intentSchema,
    normalized: z.object({
      products: z.array(normalizedProductSchema)
    }),
    metadata: z.object({
      processingTime: z.number(),
      model: z.string(),
      version: z.string()
    })
  }).optional(),
  error: z.string().optional(),
  processingTime: z.number(),
  queueTime: z.number()
});

/**
 * Create NLP tRPC router
 */
export function createNLPRouter(nlpService: NLPService) {
  return router({
    // Process single query
    process: procedure
      .input(processInputSchema)
      .output(processResponseSchema)
      .mutation(async ({ input, ctx }): Promise<z.infer<typeof processResponseSchema>> => {
        const requestId = generateRequestId();
        
        try {
          logger.debug('tRPC process query', 'TRPC_ROUTER', {
            requestId,
            query: input?.query?.substring(0, 100),
            priority: input.priority
          });
          
          const startTime = Date.now();
          const result = await nlpService.processQuery(
            input.query,
            input.priority,
            input.timeout,
            {
              ...input.metadata,
              requestId,
              trpc: true
            }
          );
          
          const processingTime = Date.now() - startTime;
          
          return {
            success: true,
            requestId,
            result: {
              entities: result?.entities?.map(e => ({
                type: e.type,
                value: e.value,
                confidence: e.confidence,
                startIndex: e.startIndex,
                endIndex: e.endIndex
              })),
              intent: {
                action: result?.intent?.action,
                confidence: result?.intent?.confidence
              },
              normalized: {
                products: result?.normalizedItems?.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit
                }))
              },
              metadata: {
                processingTime: result?.processingMetadata?.processingTime,
                model: result?.processingMetadata?.model,
                version: result?.processingMetadata?.version
              }
            },
            processingTime,
            queueTime: 0 // Would be populated by queue metrics
          };
          
        } catch (error: any) {
          logger.error('tRPC process query failed', 'TRPC_ROUTER', {
            requestId,
            error: error.message
          });
          
          return {
            success: false,
            requestId,
            error: error.message || 'Processing failed',
            processingTime: 0,
            queueTime: 0
          };
        }
      }),

    // Process batch queries
    batch: procedure
      .input(batchInputSchema)
      .mutation(async ({ input }) => {
        const batchId = generateBatchId();
        
        try {
          logger.debug('tRPC process batch', 'TRPC_ROUTER', {
            batchId,
            queryCount: input?.queries?.length
          });
          
          const result = await nlpService.processBatch(
            input?.queries?.map(q => ({
              ...q,
              metadata: {
                ...q.metadata,
                batchId,
                trpc: true
              }
            })),
            input.priority,
            input.timeout,
            { batchId }
          );
          
          return {
            success: true,
            batchId: result.batchId,
            results: result?.results?.map((r, index) => {
              if (!r) {
                return {
                  success: false,
                  requestId: `${batchId}-${index}`,
                  error: 'Processing failed',
                  processingTime: 0,
                  queueTime: 0
                };
              }
              
              return {
                success: true,
                requestId: `${batchId}-${index}`,
                result: {
                  entities: r?.entities?.map(e => ({
                    type: e.type,
                    value: e.value,
                    confidence: e.confidence,
                    startIndex: e.startIndex,
                    endIndex: e.endIndex
                  })),
                  intent: {
                    action: r?.intent?.action,
                    confidence: r?.intent?.confidence
                  },
                  normalized: {
                    products: r?.normalizedItems?.map(item => ({
                      name: item.name,
                      quantity: item.quantity,
                      unit: item.unit
                    }))
                  },
                  metadata: {
                    processingTime: r?.processingMetadata?.processingTime,
                    model: r?.processingMetadata?.model,
                    version: r?.processingMetadata?.version
                  }
                },
                processingTime: r?.processingMetadata?.processingTime,
                queueTime: 0
              };
            }),
            totalProcessingTime: result.totalProcessingTime,
            completedCount: result.completedCount,
            failedCount: result.failedCount
          };
          
        } catch (error: any) {
          logger.error('tRPC process batch failed', 'TRPC_ROUTER', {
            batchId,
            error: error.message
          });
          
          throw error;
        }
      }),

    // Get service status
    status: procedure
      .query(async () => {
        const status = nlpService.getStatus();
        return {
          service: status.service,
          version: status.version,
          status: status.status,
          uptime: status.uptime,
          startedAt: status.startedAt,
          dependencies: {
            ollama: status?.dependencies?.ollama,
            redis: status?.dependencies?.redis,
            queue: status?.dependencies?.queue
          },
          resources: {
            cpu: status?.resources?.cpu,
            memory: {
              used: status?.resources?.memory.used,
              total: status?.resources?.memory.total,
              percentage: status?.resources?.memory.percentage
            }
          },
          queue: {
            size: status?.queue?.size,
            activeRequests: status?.queue?.activeRequests,
            health: status?.queue?.health
          }
        };
      }),

    // Get service metrics
    metrics: procedure
      .query(async () => {
        const metrics = nlpService.getMetrics();
        return {
          uptime: metrics.uptime,
          requests: {
            total: metrics?.requests?.total,
            successful: metrics?.requests?.successful,
            failed: metrics?.requests?.failed,
            rate: metrics?.requests?.rate
          },
          queue: {
            size: metrics?.queue?.size,
            processing: metrics?.queue?.processing,
            averageWaitTime: metrics?.queue?.averageWaitTime,
            averageProcessingTime: metrics?.queue?.averageProcessingTime,
            throughput: metrics?.queue?.throughput
          },
          resources: {
            cpu: {
              usage: metrics?.resources?.cpu.usage,
              load: metrics?.resources?.cpu.load
            },
            memory: {
              used: metrics?.resources?.memory.used,
              total: metrics?.resources?.memory.total,
              heapUsed: metrics?.resources?.memory.heapUsed,
              heapTotal: metrics?.resources?.memory.heapTotal
            }
          },
          dependencies: {
            ollama: {
              status: metrics?.dependencies?.ollama.status,
              responseTime: metrics?.dependencies?.ollama.responseTime,
              lastCheck: metrics?.dependencies?.ollama.lastCheck
            },
            redis: {
              status: metrics?.dependencies?.redis.status,
              responseTime: metrics?.dependencies?.redis.responseTime,
              lastCheck: metrics?.dependencies?.redis.lastCheck
            }
          }
        };
      }),

    // Get queue status
    queueStatus: procedure
      .query(async () => {
        const queueStatus = nlpService.getQueueStatus();
        return {
          healthy: queueStatus.healthy,
          queueSize: queueStatus.queueSize,
          activeRequests: queueStatus.activeRequests,
          maxConcurrent: queueStatus.maxConcurrent,
          estimatedWaitTime: queueStatus.estimatedWaitTime,
          metrics: queueStatus.metrics
        };
      }),

    // Health check
    health: procedure
      .query(async () => {
        const status = nlpService.getStatus();
        return {
          status: status.status,
          service: status.service,
          version: status.version,
          timestamp: Date.now(),
          healthy: status.status === 'healthy',
          checks: {
            service: status.status === 'healthy' ? 'pass' : 'fail',
            queue: status?.queue?.health === 'healthy' ? 'pass' : 'fail',
            dependencies: {
              ollama: status?.dependencies?.ollama === 'healthy' ? 'pass' : 'fail',
              redis: status?.dependencies?.redis === 'healthy' ? 'pass' : 'fail'
            }
          }
        };
      }),

    // Administrative operations (require special permissions)
    admin: router({
      // Clear queue (emergency operation)
      clearQueue: procedure
        .mutation(async ({ ctx }) => {
          // Check for admin permissions in context
          if (!isAdminContext(ctx)) {
            throw new Error('Admin privileges required');
          }
          
          nlpService.clearQueue();
          logger.warn('Queue cleared via tRPC admin', 'TRPC_ROUTER');
          
          return {
            success: true,
            message: 'Queue cleared',
            timestamp: Date.now()
          };
        }),

      // Get detailed diagnostics
      diagnostics: procedure
        .query(async ({ ctx }) => {
          if (!isAdminContext(ctx)) {
            throw new Error('Admin privileges required');
          }
          
          const status = nlpService.getStatus();
          const metrics = nlpService.getMetrics();
          const queueStatus = nlpService.getQueueStatus();
          
          return {
            timestamp: Date.now(),
            service: status,
            metrics,
            queue: queueStatus,
            system: {
              nodeVersion: process.version,
              platform: process.platform,
              arch: process.arch,
              pid: process.pid,
              uptime: process.uptime(),
              memory: process.memoryUsage(),
              env: process.env.NODE_ENV || 'development'
            }
          };
        })
    })
  });
}

// Type inference helpers
export type NLPRouter = ReturnType<typeof createNLPRouter>;

/**
 * Generate request ID
 */
function generateRequestId(): string {
  return `trpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate batch ID
 */
function generateBatchId(): string {
  return `batch-trpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if context has admin privileges
 */
function isAdminContext(ctx: any): boolean {
  // Implement your admin context validation logic
  // This could check JWT tokens, API keys, etc.
  return ctx?.user?.role === 'admin' || ctx?.apiKey?.admin === true;
}