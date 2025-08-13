import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc/router.js';
import { TRPCError } from '@trpc/server';
// import { EmailIngestionServiceImpl } from '../../core/services/EmailIngestionServiceImpl.js';
import { logger } from '../../utils/logger.js';
import type {
  IngestionMetrics,
  QueueStatus,
  HealthStatus,
  IngestionBatchResult,
  IngestionSource,
} from '../../core/services/EmailIngestionService.js';

// =====================================================
// Input Validation Schemas
// =====================================================

const timeWindowSchema = z.object({
  hours: z.number().min(1).max(168).default(24), // Max 1 week
});

const batchLimitSchema = z.object({
  limit: z.number().min(1).max(1000).default(100),
});

const retryLimitSchema = z.object({
  limit: z.number().min(1).max(1000).default(100),
});

const ingestionSourceSchema = z.nativeEnum({
  JSON_FILE: 'json_file',
  DATABASE: 'database',
  MICROSOFT_GRAPH: 'microsoft_graph',
  GMAIL_API: 'gmail_api',
  WEBHOOK: 'webhook',
} as const);

// =====================================================
// Email Ingestion Monitoring Router
// =====================================================

export const emailIngestionMonitoringRouter = router({
  // =====================================================
  // Health and Status Endpoints
  // =====================================================

  /**
   * Get overall health status of the ingestion pipeline
   */
  health: publicProcedure
    .query(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          // Return mock data for development
          return {
            status: 'degraded',
            message: 'Email ingestion service temporarily unavailable',
            timestamp: new Date().toISOString(),
            services: {
              queue: { status: 'unknown', latency: 0 },
              redis: { status: 'unknown', latency: 0 },
              database: { status: 'unknown', latency: 0 }
            }
          };
        }

        const health = await ingestionService.healthCheck();
        
        logger.info('Health check requested', 'EMAIL_INGESTION_MONITORING', {
          status: health.status,
          healthy: health.healthy,
        });

        return {
          success: true,
          data: health,
        };
      } catch (error) {
        logger.error('Health check failed', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve health status',
          cause: error,
        });
      }
    }),

  /**
   * Get detailed queue status
   */
  queueStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          // Return mock data for development
          const queueStatus: QueueStatus = {
            waiting: 0,
            active: 0,
            completed: 0,
            failed: 0,
            delayed: 0,
            paused: false
          };
          return {
            success: true,
            data: queueStatus,
          };
        }
        
        const queueStatus = await ingestionService.getQueueStatus();

        logger.debug('Queue status requested', 'EMAIL_INGESTION_MONITORING', {
          waiting: queueStatus.waiting,
          active: queueStatus.active,
          failed: queueStatus.failed,
        });

        return {
          success: true,
          data: queueStatus,
        };
      } catch (error) {
        logger.error('Queue status check failed', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve queue status',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Metrics Endpoints
  // =====================================================

  /**
   * Get comprehensive ingestion metrics
   */
  metrics: protectedProcedure
    .input(timeWindowSchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          // Return mock data for development
          const metrics: IngestionMetrics = {
            totalIngested: 0,
            duplicatesDetected: 0,
            failedIngestions: 0,
            averageProcessingTime: 0,
            currentQueueSize: 0,
            throughput: {
              lastMinute: 0,
              lastHour: 0,
              last24Hours: 0
            },
            bySource: {
              json_file: 0,
              database: 0,
              microsoft_graph: 0,
              gmail_api: 0,
              webhook: 0
            } as Record<IngestionSource, number>,
            errors: []
          };
          return {
            success: true,
            data: metrics,
          };
        }
        
        const metrics = await ingestionService.getMetrics();

        logger.debug('Metrics requested', 'EMAIL_INGESTION_MONITORING', {
          totalIngested: metrics.totalIngested,
          queueSize: metrics.currentQueueSize,
          timeWindow: input?.hours,
        });

        return {
          success: true,
          data: metrics,
        };
      } catch (error) {
        logger.error('Metrics retrieval failed', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve metrics',
          cause: error,
        });
      }
    }),

  /**
   * Get recent error statistics
   */
  recentErrors: protectedProcedure
    .input(batchLimitSchema.optional())
    .query(async ({ ctx, input }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          // Return mock data for development
          return {
            success: true,
            data: [],
          };
        }
        
        const errors = await ingestionService.getRecentErrors(input?.limit);

        logger.debug('Recent errors requested', 'EMAIL_INGESTION_MONITORING', {
          errorCount: errors.length,
          limit: input?.limit,
        });

        return {
          success: true,
          data: errors,
        };
      } catch (error) {
        logger.error('Error statistics retrieval failed', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve error statistics',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Queue Management Endpoints
  // =====================================================

  /**
   * Pause the ingestion queue
   */
  pauseQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        await ingestionService.pauseIngestion();

        logger.info('Ingestion queue paused', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          message: 'Ingestion queue paused successfully',
        };
      } catch (error) {
        logger.error('Failed to pause ingestion queue', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to pause ingestion queue',
          cause: error,
        });
      }
    }),

  /**
   * Resume the ingestion queue
   */
  resumeQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        await ingestionService.resumeIngestion();

        logger.info('Ingestion queue resumed', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          message: 'Ingestion queue resumed successfully',
        };
      } catch (error) {
        logger.error('Failed to resume ingestion queue', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to resume ingestion queue',
          cause: error,
        });
      }
    }),

  /**
   * Retry failed jobs
   */
  retryFailedJobs: protectedProcedure
    .input(retryLimitSchema.optional())
    .mutation(async ({ ctx, input }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            data: { retriedCount: 0 },
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        const retriedCount = await ingestionService.retryFailedJobs(input?.limit);

        logger.info('Failed jobs retried', 'EMAIL_INGESTION_MONITORING', {
          retriedCount,
          limit: input?.limit,
          userId: ctx.user?.id,
        });

        return {
          success: true,
          data: {
            retriedCount,
          },
          message: `Successfully retried ${retriedCount} failed jobs`,
        };
      } catch (error) {
        logger.error('Failed to retry failed jobs', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retry failed jobs',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Deduplication Management
  // =====================================================

  /**
   * Clear deduplication cache
   */
  clearDeduplicationCache: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        await ingestionService.clearDeduplicationCache();

        logger.info('Deduplication cache cleared', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          message: 'Deduplication cache cleared successfully',
        };
      } catch (error) {
        logger.error('Failed to clear deduplication cache', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear deduplication cache',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Auto-Pull Management
  // =====================================================

  /**
   * Start auto-pull process
   */
  startAutoPull: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        await ingestionService.startAutoPull();

        logger.info('Auto-pull started', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          message: 'Auto-pull started successfully',
        };
      } catch (error) {
        logger.error('Failed to start auto-pull', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to start auto-pull',
          cause: error,
        });
      }
    }),

  /**
   * Stop auto-pull process
   */
  stopAutoPull: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: false,
            message: 'Email ingestion service temporarily unavailable',
          };
        }
        
        await ingestionService.stopAutoPull();

        logger.info('Auto-pull stopped', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          message: 'Auto-pull stopped successfully',
        };
      } catch (error) {
        logger.error('Failed to stop auto-pull', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to stop auto-pull',
          cause: error,
        });
      }
    }),

  /**
   * Get auto-pull status
   */
  autoPullStatus: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          return {
            success: true,
            data: { isActive: false },
          };
        }
        
        const isActive = ingestionService.isAutoPullActive();

        logger.debug('Auto-pull status requested', 'EMAIL_INGESTION_MONITORING', {
          isActive,
        });

        return {
          success: true,
          data: {
            isActive,
          },
        };
      } catch (error) {
        logger.error('Failed to get auto-pull status', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get auto-pull status',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Real-time Subscriptions (WebSocket)
  // =====================================================

  /**
   * Subscribe to real-time ingestion events
   */
  subscribeToIngestionEvents: protectedProcedure
    .subscription(async function* ({ ctx }) {
      try {
        logger.info('Client subscribed to ingestion events', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        // Set up event listeners for real-time updates
        const eventEmitter = ctx.eventEmitter;
        
        if (!eventEmitter) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Event emitter not available',
          });
        }

        // Listen for ingestion events
        const events = [
          'email:ingested',
          'ingestion:batch_progress',
          'ingestion:health',
          'queue:status_changed',
        ];

        for (const eventType of events) {
          eventEmitter.on(eventType, (data: any) => {
            // Yield the event to the subscription
            return {
              type: eventType,
              data,
              timestamp: new Date().toISOString(),
            };
          });
        }

        // Keep the subscription alive
        while (true) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          yield {
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        logger.error('Subscription error', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to establish subscription',
          cause: error,
        });
      }
    }),

  // =====================================================
  // Debugging and Diagnostics
  // =====================================================

  /**
   * Get diagnostic information for troubleshooting
   */
  diagnostics: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        // const ingestionService = ctx.emailIngestionService as EmailIngestionServiceImpl;
        const ingestionService = null as any; // TODO: Fix service injection
        
        if (!ingestionService) {
          // Return mock diagnostic data for development
          const diagnostics = {
            health: {
              healthy: false,
              status: 'degraded' as const,
              components: {
                queue: { healthy: false, message: 'Service unavailable' },
                redis: { healthy: false, message: 'Service unavailable' },
                database: { healthy: false, message: 'Service unavailable' },
                autoPull: { healthy: false, message: 'Service unavailable' }
              },
              uptime: 0,
              lastCheck: new Date()
            },
            queueStatus: {
              waiting: 0,
              active: 0,
              completed: 0,
              failed: 0,
              delayed: 0,
              paused: false
            },
            metrics: {
              totalIngested: 0,
              currentQueueSize: 0,
              duplicatesDetected: 0,
              failedIngestions: 0,
              averageProcessingTime: 0,
            },
            systemInfo: {
              nodeVersion: process.version,
              platform: process.platform,
              uptime: process.uptime(),
              memoryUsage: process.memoryUsage(),
            },
            timestamp: new Date().toISOString(),
          };
          
          return {
            success: true,
            data: diagnostics,
          };
        }
        
        const [health, queueStatus, metrics] = await Promise.all([
          ingestionService.healthCheck(),
          ingestionService.getQueueStatus(),
          ingestionService.getMetrics(),
        ]);

        const diagnostics = {
          health,
          queueStatus,
          metrics: {
            totalIngested: metrics.totalIngested,
            currentQueueSize: metrics.currentQueueSize,
            duplicatesDetected: metrics.duplicatesDetected,
            failedIngestions: metrics.failedIngestions,
            averageProcessingTime: metrics.averageProcessingTime,
          },
          systemInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
          },
          timestamp: new Date().toISOString(),
        };

        logger.debug('Diagnostics requested', 'EMAIL_INGESTION_MONITORING', {
          userId: ctx.user?.id,
        });

        return {
          success: true,
          data: diagnostics,
        };
      } catch (error) {
        logger.error('Failed to get diagnostics', 'EMAIL_INGESTION_MONITORING', {
          error: error instanceof Error ? error.message : String(error),
          userId: ctx.user?.id,
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve diagnostics',
          cause: error,
        });
      }
    }),
});

// =====================================================
// Export
// =====================================================

export type EmailIngestionMonitoringRouter = typeof emailIngestionMonitoringRouter;