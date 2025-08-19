/**
 * tRPC Router for Grocery NLP Queue Management
 * Type-safe procedures for queue operations with full TypeScript support
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure, protectedProcedure } from "../enhanced-router.js";
import { getGroceryNLPQueue } from "../../services/GroceryNLPQueue.js";
import { logger } from "../../../utils/logger.js";
import type { QueueConfiguration } from "../../types/grocery-nlp.types.js";

// Input validation schemas
const processNLPInputSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  priority: z.enum(["high", "normal", "low"]).optional().default("normal"),
  timeout: z.number().min(1000).max(300000).optional(),
  metadata: z.record(z.any()).optional(),
  requestId: z.string().optional()
});

const batchProcessInputSchema = z.object({
  queries: z.array(z.object({
    query: z.string().min(1, "Query cannot be empty"),
    metadata: z.record(z.any()).optional()
  })).min(1, "At least one query is required").max(100, "Maximum 100 queries per batch"),
  priority: z.enum(["high", "normal", "low"]).optional().default("normal"),
  timeout: z.number().min(1000).max(300000).optional(),
  batchId: z.string().optional()
});

const cancelRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required")
});

const getRequestSchema = z.object({
  requestId: z.string().min(1, "Request ID is required")
});

const updateConfigurationSchema = z.object({
  maxConcurrent: z.number().min(1).max(20).optional(),
  defaultTimeout: z.number().min(1000).max(600000).optional(),
  maxRetries: z.number().min(0).max(10).optional(),
  persistenceEnabled: z.boolean().optional(),
  deduplicationEnabled: z.boolean().optional(),
  deduplicationTTL: z.number().min(1000).optional(),
  healthCheck: z.object({
    maxQueueSize: z.number().min(1).optional(),
    maxErrorRate: z.number().min(0).max(1).optional(),
    maxProcessingTime: z.number().min(100).optional()
  }).optional()
});

// Output schemas for better type safety
const processNLPOutputSchema = z.object({
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  requestId: z.string(),
  processingTime: z.number(),
  queueTime: z.number()
});

const batchProcessOutputSchema = z.object({
  success: z.boolean(),
  batchId: z.string(),
  results: z.array(processNLPOutputSchema),
  totalProcessingTime: z.number(),
  completedCount: z.number(),
  failedCount: z.number()
});

const queueStatusOutputSchema = z.object({
  healthy: z.boolean(),
  queueSize: z.number(),
  activeRequests: z.number(),
  maxConcurrent: z.number(),
  estimatedWaitTime: z.number(),
  metrics: z.object({
    totalRequests: z.number(),
    completedRequests: z.number(),
    failedRequests: z.number(),
    timeoutRequests: z.number(),
    averageWaitTime: z.number(),
    averageProcessingTime: z.number(),
    currentQueueSize: z.number(),
    activeRequests: z.number(),
    successRate: z.number(),
    requestsPerMinute: z.number(),
    peakQueueSize: z.number(),
    throughput: z.object({
      last1min: z.number(),
      last5min: z.number(),
      last15min: z.number()
    })
  })
});

/**
 * Mock NLP operation for demonstration
 * In production, this would integrate with actual NLP services
 */
const mockNLPOperation = async (query: string, metadata?: Record<string, any>) => {
  // Simulate processing time based on query complexity
  const baseTime = 500;
  const complexityFactor = Math.min(query?.length || 0 / 100, 2);
  const processingTime = baseTime + (Math.random() * 1000 * complexityFactor);
  
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  // Simulate occasional failures for testing error handling
  if (Math.random() < 0.03) {
    throw new Error("Mock NLP service temporary failure");
  }
  
  // Mock entity extraction and confidence scoring
  const entities = [];
  if (query.toLowerCase().includes("grocery") || query.toLowerCase().includes("food")) {
    entities.push("food_item");
  }
  if (query.toLowerCase().includes("price") || query.toLowerCase().includes("cost")) {
    entities.push("price_inquiry");
  }
  if (query.toLowerCase().includes("quantity") || query.toLowerCase().includes("amount")) {
    entities.push("quantity");
  }
  
  return {
    originalQuery: query,
    processedText: query.trim().toLowerCase(),
    entities,
    confidence: Math.random() * 0.3 + 0.7,
    intent: entities?.length || 0 > 0 ? entities[0] : "general_query",
    metadata,
    processingTime: Math.round(processingTime),
    timestamp: Date.now()
  };
};

/**
 * Grocery NLP Queue tRPC Router
 */
export const groceryNLPQueueRouter = router({
  /**
   * Process single NLP query
   */
  process: publicProcedure
    .input(processNLPInputSchema)
    .output(processNLPOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const queue = getGroceryNLPQueue();
      const { query, priority, timeout, metadata, requestId } = input;
      
      const startTime = Date.now();
      const generatedRequestId = requestId || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        logger.info("tRPC NLP processing request", "GROCERY_NLP_TRPC", {
          query: query.substring(0, 100),
          priority,
          requestId: generatedRequestId,
          userId: ctx?.user?.id
        });
        
        const result = await queue.enqueue(
          () => mockNLPOperation(query, {
            ...metadata,
            source: "trpc",
            userId: ctx?.user?.id
          }),
          priority,
          timeout,
          query,
          metadata
        );
        
        const processingTime = Date.now() - startTime;
        
        return {
          success: true,
          result,
          requestId: generatedRequestId,
          processingTime,
          queueTime: processingTime // This would be calculated properly in the queue
        };
        
      } catch (error) {
        logger.error("tRPC NLP processing failed", "GROCERY_NLP_TRPC", {
          error,
          query: query.substring(0, 100),
          requestId: generatedRequestId,
          userId: ctx?.user?.id
        });
        
        if (error instanceof Error && error?.message?.includes("timeout")) {
          throw new TRPCError({
            code: "TIMEOUT",
            message: "Request timed out",
            cause: error
          });
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Processing failed",
          cause: error
        });
      }
    }),

  /**
   * Process multiple NLP queries in batch
   */
  processBatch: publicProcedure
    .input(batchProcessInputSchema)
    .output(batchProcessOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const queue = getGroceryNLPQueue();
      const { queries, priority, timeout, batchId } = input;
      
      const startTime = Date.now();
      const generatedBatchId = batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        logger.info("tRPC batch NLP processing request", "GROCERY_NLP_TRPC", {
          batchId: generatedBatchId,
          queryCount: queries?.length || 0,
          priority,
          userId: ctx?.user?.id
        });
        
        // Process all queries concurrently through the queue
        const operations = queries?.map((queryData, index) => 
          () => mockNLPOperation(queryData.query, {
            ...queryData.metadata,
            batchId: generatedBatchId,
            batchIndex: index,
            source: "trpc",
            userId: ctx?.user?.id
          })
        );
        
        const results = await queue.enqueueBatch(operations, priority);
        
        const totalProcessingTime = Date.now() - startTime;
        const completedResults = results?.filter(r => r !== null && r !== undefined);
        const failedResults = results?.filter(r => r === null || r === undefined);
        
        // Convert results to the expected format
        const processedResults = results?.map((result, index) => ({
          success: result !== null && result !== undefined,
          result: result || undefined,
          error: result === null || result === undefined ? "Processing failed" : undefined,
          requestId: `${generatedBatchId}-${index}`,
          processingTime: totalProcessingTime / queries?.length || 0,
          queueTime: 0 // Would be calculated properly in practice
        }));
        
        return {
          success: true,
          batchId: generatedBatchId,
          results: processedResults,
          totalProcessingTime,
          completedCount: completedResults?.length || 0,
          failedCount: failedResults?.length || 0
        };
        
      } catch (error) {
        logger.error("tRPC batch NLP processing failed", "GROCERY_NLP_TRPC", {
          error,
          batchId: generatedBatchId,
          queryCount: queries?.length || 0,
          userId: ctx?.user?.id
        });
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Batch processing failed",
          cause: error
        });
      }
    }),

  /**
   * Get current queue status
   */
  getStatus: publicProcedure
    .output(queueStatusOutputSchema)
    .query(async () => {
      const queue = getGroceryNLPQueue();
      return queue.getStatus();
    }),

  /**
   * Get detailed performance metrics
   */
  getMetrics: publicProcedure
    .query(async () => {
      const queue = getGroceryNLPQueue();
      return queue.getMetrics();
    }),

  /**
   * Cancel a queued request
   */
  cancelRequest: publicProcedure
    .input(cancelRequestSchema)
    .mutation(async ({ input, ctx }) => {
      const queue = getGroceryNLPQueue();
      const { requestId } = input;
      
      logger.info("tRPC request cancellation", "GROCERY_NLP_TRPC", {
        requestId,
        userId: ctx?.user?.id
      });
      
      const cancelled = queue.cancelRequest(requestId);
      
      if (!cancelled) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found in queue"
        });
      }
      
      return {
        success: true,
        cancelled: true,
        requestId
      };
    }),

  /**
   * Get specific queue item details
   */
  getRequest: publicProcedure
    .input(getRequestSchema)
    .query(async ({ input }) => {
      const queue = getGroceryNLPQueue();
      const { requestId } = input;
      
      const item = queue.getRequest(requestId);
      
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Request not found"
        });
      }
      
      return item;
    }),

  /**
   * Get all queue items (for monitoring/debugging)
   */
  getQueueItems: protectedProcedure
    .query(async () => {
      const queue = getGroceryNLPQueue();
      const items = queue.getQueueItems();
      
      return {
        items,
        total: items?.length || 0
      };
    }),

  /**
   * Clear the entire queue (admin only)
   */
  clearQueue: protectedProcedure
    .mutation(async ({ ctx }) => {
      const queue = getGroceryNLPQueue();
      
      logger.warn("tRPC queue clear requested", "GROCERY_NLP_TRPC", {
        userId: ctx?.user?.id,
        userRole: ctx?.user?.role
      });
      
      queue.clearQueue();
      
      return {
        success: true,
        cleared: true,
        timestamp: Date.now()
      };
    }),

  /**
   * Get queue configuration
   */
  getConfiguration: protectedProcedure
    .query(async () => {
      const queue = getGroceryNLPQueue();
      return queue.getConfiguration();
    }),

  /**
   * Update queue configuration (admin only)
   */
  updateConfiguration: protectedProcedure
    .input(updateConfigurationSchema)
    .mutation(async ({ input, ctx }) => {
      const queue = getGroceryNLPQueue();
      
      logger.info("tRPC configuration update", "GROCERY_NLP_TRPC", {
        updates: input,
        userId: ctx?.user?.id,
        userRole: ctx?.user?.role
      });
      
      queue.updateConfiguration(input as Partial<QueueConfiguration>);
      
      return {
        success: true,
        updated: true,
        configuration: queue.getConfiguration()
      };
    }),

  /**
   * Health check endpoint
   */
  healthCheck: publicProcedure
    .query(async () => {
      const queue = getGroceryNLPQueue();
      const healthy = queue.isHealthy();
      const status = queue.getStatus();
      
      return {
        service: "grocery-nlp-queue",
        status: healthy ? "healthy" : "unhealthy" as const,
        timestamp: Date.now(),
        details: status
      };
    }),

  /**
   * Get queue statistics summary
   */
  getStatistics: publicProcedure
    .query(async () => {
      const queue = getGroceryNLPQueue();
      const metrics = queue.getMetrics();
      const status = queue.getStatus();
      
      return {
        overview: {
          healthy: status.healthy,
          queueSize: status.queueSize,
          activeRequests: status.activeRequests,
          estimatedWaitTime: status.estimatedWaitTime
        },
        performance: {
          totalRequests: metrics.totalRequests,
          successRate: metrics.successRate,
          averageProcessingTime: metrics.averageProcessingTime,
          averageWaitTime: metrics.averageWaitTime,
          requestsPerMinute: metrics.requestsPerMinute
        },
        capacity: {
          maxConcurrent: status.maxConcurrent,
          peakQueueSize: metrics.peakQueueSize,
          currentUtilization: status.activeRequests / status.maxConcurrent
        }
      };
    })
});