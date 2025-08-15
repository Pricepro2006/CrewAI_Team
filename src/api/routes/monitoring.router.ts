import express from "express";
import { authenticateJWT as requireAuth } from "../middleware/auth.js";
import { metricsCollector } from "../../monitoring/MetricsCollector.js";
import { errorTracker } from "../../monitoring/ErrorTracker.js";
import { performanceMonitor } from "../../monitoring/PerformanceMonitor.js";
import { healthChecker } from "../../monitoring/HealthChecker.js";
import { logger } from "../../utils/logger.js";

const router = express.Router();

// Middleware to track API performance
router.use((req, res, next) => {
  const endTimer = metricsCollector.startTimer("api_request_duration", {
    method: req.method,
    path: req.path,
  });

  res.on("finish", () => {
    endTimer();
    metricsCollector.increment("api_requests_total", 1, {
      method: req.method,
      path: req.path,
      status: res?.statusCode?.toString(),
    });
  });

  next();
});

// Health check endpoint (public)
router.get("/health", async (req, res) => {
  try {
    const overall = healthChecker.getOverallHealth();
    const status =
      overall.status === "healthy"
        ? 200
        : overall.status === "degraded"
          ? 503
          : 500;

    res.status(status).json({
      status: overall.status,
      timestamp: new Date().toISOString(),
      services: {
        healthy: overall.healthyServices,
        degraded: overall.degradedServices,
        unhealthy: overall.unhealthyServices,
      },
      criticalServicesDown: overall.criticalServicesDown,
    });
  } catch (error) {
    logger.error("Health check endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      status: "error",
      message: "Failed to retrieve health status",
    });
  }
});

// Detailed health status (requires auth)
router.get("/health/detailed", requireAuth, async (req, res) => {
  try {
    const healthStatus = healthChecker.getHealthStatus();
    const overall = healthChecker.getOverallHealth();

    res.json({
      overall,
      services: healthStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Detailed health endpoint error", "MONITORING_ROUTER", {
      error,
    });
    res.status(500).json({
      error: "Failed to retrieve detailed health status",
    });
  }
});

// Metrics endpoint in Prometheus format (requires auth)
router.get("/metrics", requireAuth, async (req, res) => {
  try {
    const prometheusMetrics = metricsCollector.exportPrometheus();
    res.set("Content-Type", "text/plain; version=0.0.4");
    res.send(prometheusMetrics);
  } catch (error) {
    logger.error("Metrics endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to export metrics",
    });
  }
});

// Aggregated metrics JSON (requires auth)
router.get("/metrics/json", requireAuth, async (req, res) => {
  try {
    const aggregated = metricsCollector.getAggregatedMetrics();
    const system = metricsCollector.getSystemMetrics();

    res.json({
      metrics: aggregated,
      system,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("JSON metrics endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve metrics",
    });
  }
});

// Error tracking endpoints (requires auth)
router.get("/errors", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req?.query?.limit as string) || 100;
    const errors = errorTracker.getRecentErrors(limit);

    res.json({
      errors,
      count: errors?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Errors endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve errors",
    });
  }
});

// Error statistics (requires auth)
router.get("/errors/stats", requireAuth, async (req, res) => {
  try {
    const windowMs = parseInt(req?.query?.window as string) || 3600000; // 1 hour default
    const stats = errorTracker.getStatistics(windowMs);
    const aggregations = errorTracker.getAggregations();

    res.json({
      stats,
      aggregations,
      window: {
        ms: windowMs,
        human: `${windowMs / 60000} minutes`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error stats endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve error statistics",
    });
  }
});

// Search errors (requires auth)
router.post("/errors/search", requireAuth, async (req, res) => {
  try {
    const results = errorTracker.searchErrors(req.body);

    res.json({
      results,
      count: results?.length || 0,
      query: req.body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Error search endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to search errors",
    });
  }
});

// Performance monitoring endpoints (requires auth)
router.get("/performance", requireAuth, async (req, res) => {
  try {
    const name = req?.query?.name as string;
    const windowMs = parseInt(req?.query?.window as string) || 300000; // 5 minutes default
    const stats = performanceMonitor.getStatistics(name, windowMs);

    res.json({
      stats,
      window: {
        ms: windowMs,
        human: `${windowMs / 60000} minutes`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Performance endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve performance statistics",
    });
  }
});

// Slow operations (requires auth)
router.get("/performance/slow", requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req?.query?.limit as string) || 10;
    const slowOps = performanceMonitor.getSlowOperations(limit);

    res.json({
      operations: slowOps,
      count: slowOps?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Slow ops endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve slow operations",
    });
  }
});

// Threshold violations (requires auth)
router.get("/performance/violations", requireAuth, async (req, res) => {
  try {
    const violations = performanceMonitor.getThresholdViolations();

    res.json({
      violations,
      count: violations?.length || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Violations endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve threshold violations",
    });
  }
});

// Resource usage (requires auth)
router.get("/resources", requireAuth, async (req, res) => {
  try {
    const resources = performanceMonitor.monitorResourceUsage();
    const system = metricsCollector.getSystemMetrics();

    res.json({
      process: resources,
      system,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Resources endpoint error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to retrieve resource usage",
    });
  }
});

// Force health check run (requires auth)
router.post("/health/check", requireAuth, async (req, res) => {
  try {
    await healthChecker.runAllChecks();
    const overall = healthChecker.getOverallHealth();

    res.json({
      message: "Health checks completed",
      overall,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Force health check error", "MONITORING_ROUTER", { error });
    res.status(500).json({
      error: "Failed to run health checks",
    });
  }
});

export default router;
