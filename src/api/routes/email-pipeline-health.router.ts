/**
 * Email Pipeline Health Router
 * Provides comprehensive health check endpoints for the email processing pipeline
 */

import express from "express";
import {
  authenticateJWT as requireAuth,
  optionalAuthenticateJWT,
} from "../middleware/auth.js";
import { EmailPipelineHealthChecker } from "../../core/monitoring/EmailPipelineHealthChecker.js";
import { logger } from "../../utils/logger.js";
import { metrics } from "../monitoring/metrics.js";
import { z } from "zod";
import type {
  HealthCheckQuery,
  MetricsQuery,
  ServiceName,
  TimeWindow,
} from "../../types/email-pipeline-health.types.js";
import {
  isServiceName,
  isTimeWindow,
} from "../../types/email-pipeline-health.types.js";

const router = express.Router();
const healthChecker = EmailPipelineHealthChecker.getInstance();

// Request validation schemas
const MetricsQuerySchema = z.object({
  timeWindow: z.enum(["1h", "24h", "7d", "30d"]).optional().default("24h"),
  includeDetails: z.boolean().optional().default(false),
});

const HealthCheckQuerySchema = z.object({
  force: z.boolean().optional().default(false),
  services: z
    .array(
      z.enum(["database", "redis", "ollama", "pipeline", "processingQueue"]),
    )
    .optional(),
});

// Middleware to track API performance
router.use((req, res, next) => {
  const endTimer = metrics.startTimer(
    "email_pipeline_health.api_request_duration",
    {
      endpoint: req.path,
      method: req.method,
    },
  );

  res.on("finish", () => {
    endTimer();
    metrics.increment("email_pipeline_health.api_requests_total", 1, {
      endpoint: req.path,
      method: req.method,
      status: res?.statusCode?.toString(),
    });
  });

  next();
});

/**
 * GET /api/health/email-pipeline
 * Overall pipeline health status (public endpoint)
 */
router.get("/email-pipeline", async (req, res) => {
  const startTime = Date.now();

  try {
    const query = HealthCheckQuerySchema.parse(req.query);
    const healthStatus = query.force
      ? await healthChecker.forceHealthCheck()
      : await healthChecker.getHealthStatus();

    const statusCode =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
          ? 503
          : 500;

    // Public response with essential information only
    const publicResponse = {
      status: healthStatus.status,
      timestamp: healthStatus.timestamp,
      services: {
        critical: {
          database: healthStatus?.services?.database.status,
          ollama: healthStatus?.services?.ollama.status,
          pipeline: healthStatus?.services?.pipeline.status,
        },
        optional: {
          redis: healthStatus?.services?.redis.status,
          processingQueue: healthStatus?.services?.processingQueue.status,
        },
      },
      metrics: {
        totalEmails: healthStatus?.metrics?.totalEmails,
        todaysEmails: healthStatus?.metrics?.todaysEmails,
        queueDepth: healthStatus?.metrics?.queueDepth,
        averageProcessingTime: healthStatus?.metrics?.averageProcessingTime,
      },
      responseTime: Date.now() - startTime,
    };

    logger.info(
      "Email pipeline health check requested",
      "EMAIL_PIPELINE_HEALTH",
      {
        status: healthStatus.status,
        forced: query.force,
        responseTime: Date.now() - startTime,
      },
    );

    res.status(statusCode).json(publicResponse);
  } catch (error) {
    logger.error(
      "Email pipeline health check failed",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );
    metrics.increment("email_pipeline_health.health_check_errors");

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/health/email-pipeline/detailed
 * Detailed pipeline health status (requires authentication)
 */
router.get("/email-pipeline/detailed", requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    const query = HealthCheckQuerySchema.parse(req.query);
    const healthStatus = query.force
      ? await healthChecker.forceHealthCheck()
      : await healthChecker.getHealthStatus();

    const detailedMetrics = await healthChecker.getPipelineMetrics();

    const detailedResponse = {
      ...healthStatus,
      detailedMetrics,
      responseTime: Date.now() - startTime,
      cacheInfo: {
        cached: !query.force,
        cacheAge: query.force
          ? 0
          : Date.now() - new Date(healthStatus.timestamp).getTime(),
      },
    };

    const statusCode =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
          ? 503
          : 500;

    logger.info(
      "Detailed email pipeline health check requested",
      "EMAIL_PIPELINE_HEALTH",
      {
        status: healthStatus.status,
        forced: query.force,
        responseTime: Date.now() - startTime,
        userId: (req as any).user?.id,
      },
    );

    res.status(statusCode).json(detailedResponse);
  } catch (error) {
    logger.error(
      "Detailed email pipeline health check failed",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );
    metrics.increment("email_pipeline_health.detailed_health_check_errors");

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Detailed health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * GET /api/metrics/email-pipeline
 * Pipeline performance metrics (requires authentication)
 */
router.get("/email-pipeline", requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    const query = MetricsQuerySchema.parse(req.query);
    const pipelineMetrics = await healthChecker.getPipelineMetrics();
    const healthStatus = await healthChecker.getHealthStatus();

    const response = {
      metrics: pipelineMetrics,
      healthSummary: {
        status: healthStatus.status,
        timestamp: healthStatus.timestamp,
        criticalServices: {
          database: healthStatus?.services?.database.status,
          ollama: healthStatus?.services?.ollama.status,
          pipeline: healthStatus?.services?.pipeline.status,
        },
      },
      query: {
        timeWindow: query.timeWindow,
        includeDetails: query.includeDetails,
      },
      responseTime: Date.now() - startTime,
      generatedAt: new Date().toISOString(),
    };

    if (query.includeDetails) {
      // Add additional detailed metrics
      response.metrics = {
        ...response.metrics,
        systemResources: healthStatus.resources,
      };
    }

    logger.info("Email pipeline metrics requested", "EMAIL_PIPELINE_HEALTH", {
      timeWindow: query.timeWindow,
      includeDetails: query.includeDetails,
      responseTime: Date.now() - startTime,
      userId: (req as any).user?.id,
    });

    res.json(response);
  } catch (error) {
    logger.error(
      "Email pipeline metrics request failed",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );
    metrics.increment("email_pipeline_health.metrics_request_errors");

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Metrics request failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/health/email-pipeline/check
 * Force a fresh health check (requires authentication)
 */
router.post("/email-pipeline/check", requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    logger.info(
      "Forced email pipeline health check initiated",
      "EMAIL_PIPELINE_HEALTH",
      {
        userId: (req as any).user?.id,
      },
    );

    const healthStatus = await healthChecker.forceHealthCheck();
    const statusCode =
      healthStatus.status === "healthy"
        ? 200
        : healthStatus.status === "degraded"
          ? 503
          : 500;

    const response = {
      message: "Health check completed successfully",
      ...healthStatus,
      forced: true,
      responseTime: Date.now() - startTime,
    };

    logger.info(
      "Forced email pipeline health check completed",
      "EMAIL_PIPELINE_HEALTH",
      {
        status: healthStatus.status,
        responseTime: Date.now() - startTime,
        userId: (req as any).user?.id,
      },
    );

    metrics.increment("email_pipeline_health.forced_health_checks");
    res.status(statusCode).json(response);
  } catch (error) {
    logger.error(
      "Forced email pipeline health check failed",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );
    metrics.increment("email_pipeline_health.forced_health_check_errors");

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Forced health check failed",
      error: error instanceof Error ? error.message : "Unknown error",
      forced: true,
      responseTime: Date.now() - startTime,
    });
  }
});

/**
 * GET /api/health/email-pipeline/services/:service
 * Individual service health check (requires authentication)
 */
router.get(
  "/email-pipeline/services/:service",
  requireAuth,
  async (req, res) => {
    const startTime = Date.now();
    const { service } = req.params;

    try {
      if (!service || !isServiceName(service)) {
        return res.status(400).json({
          status: "error",
          message: `Invalid service. Valid services: database, redis, ollama, pipeline, processingQueue`,
        });
      }

      const healthStatus = await healthChecker.getHealthStatus();
      const serviceHealth = healthStatus.services[service as ServiceName];

      if (!serviceHealth) {
        return res.status(404).json({
          status: "error",
          message: `Service '${service}' not found`,
        });
      }

      const response = {
        service,
        ...serviceHealth,
        responseTime: Date.now() - startTime,
        checkedAt: new Date().toISOString(),
      };

      const statusCode =
        serviceHealth.status === "healthy"
          ? 200
          : serviceHealth.status === "degraded"
            ? 503
            : 500;

      logger.info(
        "Individual service health check requested",
        "EMAIL_PIPELINE_HEALTH",
        {
          service,
          status: serviceHealth.status,
          responseTime: Date.now() - startTime,
          userId: (req as any).user?.id,
        },
      );

      return res.status(statusCode).json(response);
    } catch (error) {
      logger.error(
        "Individual service health check failed",
        "EMAIL_PIPELINE_HEALTH",
        error as Error,
      );
      metrics.increment("email_pipeline_health.service_health_check_errors");

      return res.status(500).json({
        status: "error",
        service,
        timestamp: new Date().toISOString(),
        message: "Service health check failed",
        error: error instanceof Error ? error.message : "Unknown error",
        responseTime: Date.now() - startTime,
      });
    }
  },
);

/**
 * GET /api/health/email-pipeline/history
 * Health check history (requires authentication)
 */
router.get("/email-pipeline/history", requireAuth, async (req, res) => {
  const startTime = Date.now();

  try {
    const limit = Math.min(parseInt(req?.query?.limit as string) || 50, 200);
    const offset = parseInt(req?.query?.offset as string) || 0;

    // This would require storing health check history in the database
    // For now, return current status with note about implementation
    const currentHealth = await healthChecker.getHealthStatus();

    const response = {
      message: "Health history endpoint - implementation pending",
      currentStatus: currentHealth,
      query: { limit, offset },
      note: "Historical data requires database schema extension",
      responseTime: Date.now() - startTime,
    };

    logger.info(
      "Email pipeline health history requested",
      "EMAIL_PIPELINE_HEALTH",
      {
        limit,
        offset,
        responseTime: Date.now() - startTime,
        userId: (req as any).user?.id,
      },
    );

    res.json(response);
  } catch (error) {
    logger.error(
      "Email pipeline health history request failed",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Health history request failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * DELETE /api/health/email-pipeline/cache
 * Clear health check cache (requires authentication)
 */
router.delete("/email-pipeline/cache", requireAuth, async (req, res) => {
  try {
    healthChecker.clearCache();

    logger.info(
      "Email pipeline health cache cleared",
      "EMAIL_PIPELINE_HEALTH",
      {
        userId: (req as any).user?.id,
      },
    );

    metrics.increment("email_pipeline_health.cache_clears");

    res.json({
      message: "Health check cache cleared successfully",
      timestamp: new Date().toISOString(),
      note: "Next health check will be fresh",
    });
  } catch (error) {
    logger.error(
      "Failed to clear email pipeline health cache",
      "EMAIL_PIPELINE_HEALTH",
      error as Error,
    );

    res.status(500).json({
      status: "error",
      timestamp: new Date().toISOString(),
      message: "Failed to clear cache",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
