import { EventEmitter } from "events";
import { metricsCollector } from "./MetricsCollector.js";
import { logger } from "../utils/logger.js";
import fs from "fs";
import appConfig from "../config/app.config.js";

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
  critical?: boolean;
  timeout?: number;
}

export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latency?: number;
  metadata?: Record<string, any>;
}

export interface ServiceHealth {
  service: string;
  status: HealthCheckResult["status"];
  lastCheck: Date;
  consecutiveFailures: number;
  latency?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class HealthChecker extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private healthStatus: Map<string, ServiceHealth> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly defaultTimeout = 5000;
  private readonly maxConsecutiveFailures = 3;

  constructor() {
    super();
    this.registerDefaultChecks();
  }

  // Register a health check
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    logger.info(`Health check registered: ${check.name}`, "HEALTH_CHECKER");
  }

  // Start periodic health checks
  startHealthChecks(intervalMs: number = 30000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Run initial check
    this.runAllChecks();

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.runAllChecks();
    }, intervalMs);

    logger.info(
      `Health checks started with ${intervalMs}ms interval`,
      "HEALTH_CHECKER",
    );
  }

  // Stop health checks
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    logger.info("Health checks stopped", "HEALTH_CHECKER");
  }

  // Run all health checks
  async runAllChecks(): Promise<void> {
    const checkPromises = Array.from(this.checks.entries()).map(
      ([name, check]) => this.runCheck(name, check),
    );

    await Promise.allSettled(checkPromises);

    // Update overall health status
    this.updateOverallHealth();
  }

  // Run a single health check
  async runCheck(name: string, check: HealthCheck): Promise<void> {
    const startTime = Date.now();
    const timeout = check.timeout || this.defaultTimeout;

    try {
      // Run check with timeout
      const result = await this.withTimeout(check.check(), timeout);
      const latency = Date.now() - startTime;

      // Update health status
      const previousHealth = this.healthStatus.get(name);
      const consecutiveFailures =
        result.status === "healthy"
          ? 0
          : (previousHealth?.consecutiveFailures || 0) + 1;

      const health: ServiceHealth = {
        service: name,
        status: result.status,
        lastCheck: new Date(),
        consecutiveFailures,
        latency,
        metadata: result.metadata,
      };

      if (result.message) {
        health.error = result.message;
      }

      this.healthStatus.set(name, health);

      // Record metrics
      metricsCollector.gauge(
        `health_${name}_status`,
        result.status === "healthy"
          ? 1
          : result.status === "degraded"
            ? 0.5
            : 0,
      );
      metricsCollector.histogram(`health_${name}_latency_ms`, latency);

      // Emit events
      this.emit("health-check-complete", { name, result, latency });

      // Check for status changes
      if (previousHealth && previousHealth.status !== result.status) {
        this.emit("health-status-changed", {
          service: name,
          previousStatus: previousHealth.status,
          currentStatus: result.status,
        });

        // Alert on critical service failures
        if (check.critical && result.status === "unhealthy") {
          this.emit("critical-service-failure", { service: name, health });
        }
      }

      // Check consecutive failures
      if (
        consecutiveFailures >= this.maxConsecutiveFailures &&
        check.critical
      ) {
        this.emit("service-down", {
          service: name,
          failures: consecutiveFailures,
        });
      }
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      // Update health status for error
      const previousHealth = this.healthStatus.get(name);
      const consecutiveFailures =
        (previousHealth?.consecutiveFailures || 0) + 1;

      const health: ServiceHealth = {
        service: name,
        status: "unhealthy",
        lastCheck: new Date(),
        consecutiveFailures,
        latency,
        error: errorMessage,
      };

      this.healthStatus.set(name, health);

      // Record metrics
      metricsCollector.gauge(`health_${name}_status`, 0);
      metricsCollector.increment(`health_${name}_errors`);

      // Log error
      logger.error(`Health check failed: ${name}`, "HEALTH_CHECKER", {
        error: errorMessage,
      });

      // Emit error event
      this.emit("health-check-error", { name, error: errorMessage, latency });
    }
  }

  // Get current health status
  getHealthStatus(): Record<string, ServiceHealth> {
    const status: Record<string, ServiceHealth> = {};
    this.healthStatus.forEach((health, service) => {
      status[service] = health;
    });
    return status;
  }

  // Get overall system health
  getOverallHealth(): {
    status: "healthy" | "degraded" | "unhealthy";
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
    criticalServicesDown: string[];
  } {
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    const criticalDown: string[] = [];

    this.healthStatus.forEach((health, service) => {
      switch (health.status) {
        case "healthy":
          healthyCount++;
          break;
        case "degraded":
          degradedCount++;
          break;
        case "unhealthy": {
          unhealthyCount++;
          const check = this.checks.get(service);
          if (check?.critical) {
            criticalDown.push(service);
          }
          break;
        }
      }
    });

    // Determine overall status
    let overallStatus: "healthy" | "degraded" | "unhealthy";
    if (criticalDown.length > 0 || unhealthyCount > 0) {
      overallStatus = "unhealthy";
    } else if (degradedCount > 0) {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    return {
      status: overallStatus,
      healthyServices: healthyCount,
      degradedServices: degradedCount,
      unhealthyServices: unhealthyCount,
      criticalServicesDown: criticalDown,
    };
  }

  // Check if system is healthy
  isHealthy(): boolean {
    return this.getOverallHealth().status === "healthy";
  }

  // Private methods
  private registerDefaultChecks(): void {
    // Database health check
    this.registerCheck({
      name: "database",
      critical: true,
      check: async () => {
        try {
          const Database = (await import("better-sqlite3")).default;
          const db = new Database(appConfig.database?.path || "./data/app.db", {
            readonly: true,
          });
          const result = db.prepare("SELECT 1 as test").get();
          db.close();

          return {
            status: "healthy",
            metadata: { test: result },
          };
        } catch (error) {
          return {
            status: "unhealthy",
            message:
              error instanceof Error
                ? error.message
                : "Database connection failed",
          };
        }
      },
    });

    // Llama.cpp health check
    this.registerCheck({
      name: "llama",
      critical: false,
      check: async () => {
        try {
          const modelPath = process.env.LLAMA_MODEL_PATH || "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf";
          
          // Check if model file exists and is accessible
          const stats = await fs.promises.stat(modelPath);
          
          if (stats.isFile()) {
            return {
              status: "healthy",
              metadata: { 
                modelPath,
                modelSize: Math.round(stats.size / 1024 / 1024) + "MB",
                lastModified: stats.mtime.toISOString()
              },
            };
          } else {
            return {
              status: "unhealthy",
              message: `Model path exists but is not a file: ${modelPath}`,
            };
          }
        } catch (error) {
          return {
            status: "unhealthy",
            message:
              error instanceof Error
                ? `Llama model file check failed: ${error.message}`
                : "Llama model file access failed",
          };
        }
      },
    });

    // ChromaDB health check
    this.registerCheck({
      name: "chromadb",
      critical: false,
      check: async () => {
        try {
          const chromaUrl = process.env.CHROMA_URL || "http://localhost:8001";
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);

          const response = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          return {
            status: response.ok ? "healthy" : "unhealthy",
            message: response.ok
              ? undefined
              : `ChromaDB returned status ${response.status}`,
          };
        } catch (error) {
          return {
            status: "unhealthy",
            message:
              error instanceof Error
                ? error.message
                : "ChromaDB connection failed",
          };
        }
      },
    });

    // Redis health check (if configured)
    if (process.env.REDIS_HOST) {
      this.registerCheck({
        name: "redis",
        critical: false,
        check: async () => {
          try {
            // Try to import Redis config, fallback to direct Redis import if config doesn't exist
            let redisClient;
            try {
              const redisConfig = await import("../config/redis.config.js");
              redisClient = redisConfig.redisClient;
            } catch (importError) {
              // Fallback: create a basic Redis client directly
              const Redis = (await import("ioredis")).default;
              redisClient = new Redis({
                host: process.env.REDIS_HOST || "localhost",
                port: parseInt(process.env.REDIS_PORT || "6379"),
                password: process.env.REDIS_PASSWORD,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                retryStrategy: (times: number) => {
                  const delay = Math.min(times * 100, 3000);
                  return delay;
                },
              });
            }

            await redisClient.ping();
            return { status: "healthy" };
          } catch (error) {
            return {
              status: "unhealthy",
              message:
                error instanceof Error
                  ? error.message
                  : "Redis connection failed",
            };
          }
        },
      });
    }

    // Memory health check
    this.registerCheck({
      name: "memory",
      critical: false,
      check: async () => {
        const usage = process.memoryUsage();
        const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;

        if (heapUsedPercent > 90) {
          return {
            status: "unhealthy",
            message: `Heap usage critical: ${heapUsedPercent.toFixed(1)}%`,
            metadata: { heapUsedPercent },
          };
        } else if (heapUsedPercent > 75) {
          return {
            status: "degraded",
            message: `Heap usage high: ${heapUsedPercent.toFixed(1)}%`,
            metadata: { heapUsedPercent },
          };
        }

        return {
          status: "healthy",
          metadata: { heapUsedPercent },
        };
      },
    });
  }

  private updateOverallHealth(): void {
    const overall = this.getOverallHealth();

    // Record metrics
    metricsCollector.gauge(
      "health_overall_status",
      overall.status === "healthy"
        ? 1
        : overall.status === "degraded"
          ? 0.5
          : 0,
    );
    metricsCollector.gauge("health_services_healthy", overall.healthyServices);
    metricsCollector.gauge(
      "health_services_degraded",
      overall.degradedServices,
    );
    metricsCollector.gauge(
      "health_services_unhealthy",
      overall.unhealthyServices,
    );

    // Record in metrics collector
    metricsCollector.recordHealthCheck("overall", {
      service: "overall",
      status: overall.status,
      lastCheck: new Date(),
    });

    // Emit overall health event
    this.emit("overall-health-updated", overall);
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), timeoutMs),
      ),
    ]);
  }

  shutdown(): void {
    this.stopHealthChecks();
    this.removeAllListeners();
  }
}

// Singleton instance
export const healthChecker = new HealthChecker();

// Start health checks automatically
healthChecker.startHealthChecks();

// Graceful shutdown
process.once("SIGINT", () => healthChecker.shutdown());
process.once("SIGTERM", () => healthChecker.shutdown());
