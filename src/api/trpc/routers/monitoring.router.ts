import { z } from "zod";
import {
  router,
  publicProcedure,
  protectedProcedure,
} from "../enhanced-router.js";
import { TRPCError } from "@trpc/server";
import { metricsCollector } from "../../../monitoring/MetricsCollector.js";
import { errorTracker } from "../../../monitoring/ErrorTracker.js";
import { performanceMonitor } from "../../../monitoring/PerformanceMonitor.js";
import { healthChecker } from "../../../monitoring/HealthChecker.js";

export const monitoringRouter = router({
  // Public health check endpoint
  health: publicProcedure.query(async () => {
    const overall = healthChecker.getOverallHealth();
    const status =
      overall.status === "healthy"
        ? 200
        : overall.status === "degraded"
          ? 503
          : 500;

    return {
      status: overall.status,
      timestamp: new Date().toISOString(),
      services: {
        healthy: overall.healthyServices,
        degraded: overall.degradedServices,
        unhealthy: overall.unhealthyServices,
      },
      criticalServicesDown: overall.criticalServicesDown,
    };
  }),

  // Detailed health status (protected)
  healthDetailed: protectedProcedure.query(async ({ ctx }) => {
    // Check if user has admin privileges
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for detailed health information",
      });
    }

    const healthStatus = healthChecker.getHealthStatus();
    const overall = healthChecker.getOverallHealth();

    return {
      overall,
      services: healthStatus,
      timestamp: new Date().toISOString(),
    };
  }),

  // Get metrics in JSON format (protected)
  metrics: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for metrics",
      });
    }

    const aggregated = metricsCollector.getAggregatedMetrics();
    const system = metricsCollector.getSystemMetrics();

    return {
      metrics: aggregated,
      system,
      timestamp: new Date().toISOString(),
    };
  }),

  // Get error statistics (protected)
  errorStats: protectedProcedure
    .input(
      z.object({
        window: z.number().default(3600000), // 1 hour default
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required for error statistics",
        });
      }

      const stats = errorTracker.getStatistics(input.window);
      const aggregations = errorTracker.getAggregations();

      return {
        stats,
        aggregations,
        window: {
          ms: input.window,
          human: `${input.window / 60000} minutes`,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  // Get recent errors (protected)
  recentErrors: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required for error logs",
        });
      }

      const errors = errorTracker.getRecentErrors(input.limit);

      return {
        errors,
        count: errors?.length || 0,
        timestamp: new Date().toISOString(),
      };
    }),

  // Search errors (protected)
  searchErrors: protectedProcedure
    .input(
      z.object({
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        handled: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        errorType: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required for error search",
        });
      }

      const results = errorTracker.searchErrors(input);

      return {
        results,
        count: results?.length || 0,
        query: input,
        timestamp: new Date().toISOString(),
      };
    }),

  // Get performance statistics (protected)
  performance: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        window: z.number().default(300000), // 5 minutes default
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required for performance metrics",
        });
      }

      const stats = performanceMonitor.getStatistics(input.name, input.window);

      return {
        stats,
        window: {
          ms: input.window,
          human: `${input.window / 60000} minutes`,
        },
        timestamp: new Date().toISOString(),
      };
    }),

  // Get slow operations (protected)
  slowOperations: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required for performance data",
        });
      }

      const slowOps = performanceMonitor.getSlowOperations(input.limit);

      return {
        operations: slowOps,
        count: slowOps?.length || 0,
        timestamp: new Date().toISOString(),
      };
    }),

  // Get threshold violations (protected)
  thresholdViolations: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for threshold data",
      });
    }

    const violations = performanceMonitor.getThresholdViolations();

    return {
      violations,
      count: violations?.length || 0,
      timestamp: new Date().toISOString(),
    };
  }),

  // Get resource usage (protected)
  resources: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for resource metrics",
      });
    }

    const resources = performanceMonitor.monitorResourceUsage();
    const system = metricsCollector.getSystemMetrics();

    return {
      process: resources,
      system,
      timestamp: new Date().toISOString(),
    };
  }),

  // Force health check (protected)
  forceHealthCheck: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required to force health checks",
      });
    }

    await healthChecker.runAllChecks();
    const overall = healthChecker.getOverallHealth();

    return {
      message: "Health checks completed",
      overall,
      timestamp: new Date().toISOString(),
    };
  }),

  // Clear error logs (protected)
  clearErrors: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required to clear errors",
      });
    }

    errorTracker.clearErrors();

    return {
      message: "Error logs cleared",
      timestamp: new Date().toISOString(),
    };
  }),

  // Clear performance metrics (protected)
  clearPerformanceMetrics: protectedProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required to clear performance metrics",
      });
    }

    performanceMonitor.clearMeasurements();

    return {
      message: "Performance metrics cleared",
      timestamp: new Date().toISOString(),
    };
  }),

  // Set performance threshold (protected)
  setPerformanceThreshold: protectedProcedure
    .input(
      z.object({
        name: z.string(),
        warningMs: z.number(),
        criticalMs: z.number(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.user?.isAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required to set thresholds",
        });
      }

      performanceMonitor.setThreshold(
        input.name,
        input.warningMs,
        input.criticalMs,
      );

      return {
        message: "Threshold set successfully",
        threshold: input,
        timestamp: new Date().toISOString(),
      };
    }),

  // Get monitoring configuration (protected)
  config: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user?.isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required for configuration",
      });
    }

    return {
      healthCheckInterval: 30000,
      metricsRetentionMs: 3600000,
      errorRetentionMs: 86400000,
      performanceThresholds: {
        api_request: { warning: 100, critical: 500 },
        database_query: { warning: 50, critical: 200 },
        ollama_inference: { warning: 1000, critical: 5000 },
      },
      timestamp: new Date().toISOString(),
    };
  }),
});
