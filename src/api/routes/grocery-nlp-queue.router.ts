/**
 * REST API Router for Grocery NLP Queue Management
 * Provides endpoints for queue operations, monitoring, and batch processing
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { getGroceryNLPQueue } from "../services/GroceryNLPQueue.js";
import { logger } from "../../utils/logger.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import type {
  ProcessNLPRequest,
  ProcessNLPResponse,
  BatchProcessRequest,
  BatchProcessResponse,
  QueueStatus,
  QueueMetrics,
  ApiResponse
} from "../types/grocery-nlp.types.js";

const router = express.Router();

// Request validation schemas
const processNLPSchema = z.object({
  query: z.string().min(1, "Query cannot be empty"),
  priority: z.enum(["high", "normal", "low"]).optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  metadata: z.record(z.any()).optional(),
  requestId: z.string().optional()
});

const batchProcessSchema = z.object({
  queries: z.array(z.object({
    query: z.string().min(1, "Query cannot be empty"),
    metadata: z.record(z.any()).optional()
  })).min(1, "At least one query is required").max(100, "Maximum 100 queries per batch"),
  priority: z.enum(["high", "normal", "low"]).optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  batchId: z.string().optional()
});

/**
 * Validation middleware
 */
const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid request data",
            details: error.errors
          },
          timestamp: Date.now()
        } as ApiResponse);
      } else {
        next(error);
      }
    }
  };
};

/**
 * Dummy NLP operation for demonstration
 * In production, this would integrate with actual NLP services
 */
const mockNLPOperation = async (query: string, metadata?: Record<string, any>) => {
  // Simulate processing time
  const processingTime = Math.random() * 1000 + 500;
  await new Promise(resolve => setTimeout(resolve, processingTime));
  
  // Simulate occasional failures for testing
  if (Math.random() < 0.05) {
    throw new Error("Mock NLP service error");
  }
  
  return {
    query,
    result: `Processed: ${query}`,
    entities: ["grocery", "food", "item"],
    confidence: Math.random() * 0.3 + 0.7,
    metadata
  };
};

/**
 * POST /api/grocery/nlp/process
 * Process single NLP query
 */
router.post("/process", validateRequest(processNLPSchema), asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const { query, priority = "normal", timeout, metadata, requestId } = req.body as ProcessNLPRequest;
  
  const startTime = Date.now();
  
  try {
    logger.info("Processing NLP request", "GROCERY_NLP_API", {
      query: query.substring(0, 100),
      priority,
      requestId,
      userAgent: req.get("User-Agent")
    });
    
    const result = await queue.enqueue(
      () => mockNLPOperation(query, metadata),
      priority,
      timeout,
      query,
      metadata
    );
    
    const processingTime = Date.now() - startTime;
    
    const response: ProcessNLPResponse = {
      success: true,
      result,
      requestId: requestId || `req-${Date.now()}`,
      processingTime,
      queueTime: processingTime // This would be calculated properly in the queue
    };
    
    res.json({
      success: true,
      data: response,
      timestamp: Date.now()
    } as ApiResponse<ProcessNLPResponse>);
    
  } catch (error) {
    logger.error("NLP processing failed", "GROCERY_NLP_API", {
      error,
      query: query.substring(0, 100),
      requestId
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: "PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Processing failed",
        details: { requestId, query: query.substring(0, 100) }
      },
      timestamp: Date.now()
    } as ApiResponse);
  }
}));

/**
 * POST /api/grocery/nlp/batch
 * Process multiple NLP queries in batch
 */
router.post("/batch", validateRequest(batchProcessSchema), asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const { queries, priority = "normal", timeout, batchId } = req.body as BatchProcessRequest;
  
  const startTime = Date.now();
  const generatedBatchId = batchId || `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    logger.info("Processing batch NLP request", "GROCERY_NLP_API", {
      batchId: generatedBatchId,
      queryCount: queries?.length || 0,
      priority,
      userAgent: req.get("User-Agent")
    });
    
    // Process all queries concurrently through the queue
    const operations = queries?.map((queryData, index) => 
      () => mockNLPOperation(queryData.query, {
        ...queryData.metadata,
        batchId: generatedBatchId,
        batchIndex: index
      })
    );
    
    const results = await queue.enqueueBatch(operations, priority);
    
    const totalProcessingTime = Date.now() - startTime;
    const completedCount = results?.filter(r => r !== null).length;
    const failedCount = results?.length || 0 - completedCount;
    
    // Convert results to ProcessNLPResponse format
    const processedResults: ProcessNLPResponse[] = results?.map((result, index) => ({
      success: result !== null,
      result: result || undefined,
      error: result === null ? "Processing failed" : undefined,
      requestId: `${generatedBatchId}-${index}`,
      processingTime: totalProcessingTime / queries?.length || 0, // Average
      queueTime: 0 // Would be calculated properly
    }));
    
    const response: BatchProcessResponse = {
      success: true,
      batchId: generatedBatchId,
      results: processedResults,
      totalProcessingTime,
      completedCount,
      failedCount
    };
    
    res.json({
      success: true,
      data: response,
      timestamp: Date.now()
    } as ApiResponse<BatchProcessResponse>);
    
  } catch (error) {
    logger.error("Batch NLP processing failed", "GROCERY_NLP_API", {
      error,
      batchId: generatedBatchId,
      queryCount: queries?.length || 0
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: "BATCH_PROCESSING_ERROR",
        message: error instanceof Error ? error.message : "Batch processing failed",
        details: { batchId: generatedBatchId, queryCount: queries?.length || 0 }
      },
      timestamp: Date.now()
    } as ApiResponse);
  }
}));

/**
 * GET /api/grocery/nlp/status
 * Get current queue status
 */
router.get("/status", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const status = queue.getStatus();
  
  res.json({
    success: true,
    data: status,
    timestamp: Date.now()
  } as ApiResponse<QueueStatus>);
}));

/**
 * GET /api/grocery/nlp/metrics
 * Get detailed performance metrics
 */
router.get("/metrics", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const metrics = queue.getMetrics();
  
  res.json({
    success: true,
    data: metrics,
    timestamp: Date.now()
  } as ApiResponse<QueueMetrics>);
}));

/**
 * DELETE /api/grocery/nlp/queue/:id
 * Cancel a queued request
 */
router.delete("/queue/:id", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_REQUEST_ID",
        message: "Request ID is required"
      },
      timestamp: Date.now()
    } as ApiResponse);
    return;
  }
  
  const cancelled = queue.cancelRequest(id);
  
  if (cancelled) {
    logger.info("Request cancelled", "GROCERY_NLP_API", {
      requestId: id,
      userAgent: req.get("User-Agent")
    });
    
    res.json({
      success: true,
      data: { cancelled: true, requestId: id },
      timestamp: Date.now()
    } as ApiResponse);
  } else {
    res.status(404).json({
      success: false,
      error: {
        code: "REQUEST_NOT_FOUND",
        message: "Request not found in queue",
        details: { requestId: id }
      },
      timestamp: Date.now()
    } as ApiResponse);
  }
}));

/**
 * GET /api/grocery/nlp/queue
 * Get all queue items (for debugging/monitoring)
 */
router.get("/queue", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const items = queue.getQueueItems();
  
  res.json({
    success: true,
    data: {
      items,
      total: items?.length || 0
    },
    timestamp: Date.now()
  } as ApiResponse);
}));

/**
 * GET /api/grocery/nlp/queue/:id
 * Get specific queue item details
 */
router.get("/queue/:id", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const { id } = req.params;
  
  if (!id) {
    res.status(400).json({
      success: false,
      error: {
        code: "MISSING_REQUEST_ID",
        message: "Request ID is required"
      },
      timestamp: Date.now()
    } as ApiResponse);
    return;
  }
  
  const item = queue.getRequest(id);
  
  if (item) {
    res.json({
      success: true,
      data: item,
      timestamp: Date.now()
    } as ApiResponse);
  } else {
    res.status(404).json({
      success: false,
      error: {
        code: "REQUEST_NOT_FOUND",
        message: "Request not found",
        details: { requestId: id }
      },
      timestamp: Date.now()
    } as ApiResponse);
  }
}));

/**
 * POST /api/grocery/nlp/queue/clear
 * Clear the entire queue (emergency use only)
 */
router.post("/queue/clear", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  
  logger.warn("Queue clear requested", "GROCERY_NLP_API", {
    userAgent: req.get("User-Agent"),
    ip: req.ip
  });
  
  queue.clearQueue();
  
  res.json({
    success: true,
    data: { cleared: true },
    timestamp: Date.now()
  } as ApiResponse);
}));

/**
 * GET /api/grocery/nlp/health
 * Health check endpoint
 */
router.get("/health", asyncHandler(async (req: Request, res: Response) => {
  const queue = getGroceryNLPQueue();
  const healthy = queue.isHealthy();
  const status = queue.getStatus();
  
  res.status(healthy ? 200 : 503).json({
    success: healthy,
    data: {
      service: "grocery-nlp-queue",
      status: healthy ? "healthy" : "unhealthy",
      timestamp: Date.now(),
      details: status
    },
    timestamp: Date.now()
  } as ApiResponse);
}));

export { router as groceryNLPQueueRouter };