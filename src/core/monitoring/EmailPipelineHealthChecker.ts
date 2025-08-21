/**
 * Email Pipeline Health Checker
 * Comprehensive health monitoring for the email processing pipeline
 */

import type Database from "better-sqlite3";
import { logger } from "../../utils/logger.js";
import { metrics } from "../../api/monitoring/metrics.js";
import { getDatabaseConnection } from "../../database/connection.js";
import { PipelineOrchestrator } from "../pipeline/PipelineOrchestrator.js";
import ollamaConfig from "../../config/ollama.config.js";
import type {
  EmailPipelineHealthStatus,
  ServiceHealth,
  EmailPipelineMetrics,
  HealthStatus,
  ServiceHealthMap,
  SystemResourceMetrics,
} from "../../types/email-pipeline-health.types.js";
import { DEFAULT_HEALTH_CHECK_CONFIG } from "../../types/email-pipeline-health.types.js";

export class EmailPipelineHealthChecker {
  private static instance: EmailPipelineHealthChecker;
  private db: Database.Database;
  private pipelineOrchestrator: PipelineOrchestrator;
  private healthCache: EmailPipelineHealthStatus | null = null;
  private lastHealthCheck = 0;
  private readonly CACHE_TTL = DEFAULT_HEALTH_CHECK_CONFIG.cacheTTL;

  private constructor() {
    this.db = getDatabaseConnection();
    this.pipelineOrchestrator = new PipelineOrchestrator();
  }

  public static getInstance(): EmailPipelineHealthChecker {
    if (!EmailPipelineHealthChecker.instance) {
      EmailPipelineHealthChecker.instance = new EmailPipelineHealthChecker();
    }
    return EmailPipelineHealthChecker.instance;
  }

  /**
   * Get comprehensive pipeline health status
   */
  async getHealthStatus(): Promise<EmailPipelineHealthStatus> {
    const now = Date.now();

    // Return cached result if recent
    if (this.healthCache && now - this.lastHealthCheck < this.CACHE_TTL) {
      return this.healthCache;
    }

    const startTime = now;
    logger.debug(
      "Starting email pipeline health check",
      "EMAIL_PIPELINE_HEALTH",
    );

    try {
      const [
        databaseHealth,
        redisHealth,
        ollamaHealth,
        pipelineHealth,
        queueHealth,
        pipelineMetrics,
        resources,
      ] = await Promise.all([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkLLMHealth(),
        this.checkPipelineHealth(),
        this.checkProcessingQueueHealth(),
        this.getPipelineMetrics(),
        this.getResourceMetrics(),
      ]);

      const overallStatus = this.calculateOverallStatus([
        databaseHealth.status,
        ollamaHealth.status,
        pipelineHealth.status,
        queueHealth.status,
      ]);

      this.healthCache = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
          database: databaseHealth,
          redis: redisHealth,
          ollama: ollamaHealth,
          llama: ollamaHealth, // Using ollama health for llama since they're the same service
          pipeline: pipelineHealth,
          processingQueue: queueHealth,
        },
        metrics: {
          totalEmails: pipelineMetrics.totalEmails,
          todaysEmails: pipelineMetrics.todaysEmails,
          unprocessedEmails: pipelineMetrics.unprocessedEmails,
          failedEmails: pipelineMetrics.failedEmails,
          averageProcessingTime: pipelineMetrics.averageProcessingTime,
          queueDepth: pipelineMetrics?.queueMetrics?.depth,
        },
        resources,
      };

      this.lastHealthCheck = now;

      // Record metrics
      metrics.histogram(
        "email_pipeline.health_check_duration",
        Date.now() - startTime,
      );
      metrics.gauge(
        "email_pipeline.overall_health",
        overallStatus === "healthy"
          ? 1
          : overallStatus === "degraded"
            ? 0.5
            : 0,
      );

      logger.debug(
        "Email pipeline health check completed",
        "EMAIL_PIPELINE_HEALTH",
        {
          status: overallStatus,
          duration: Date.now() - startTime,
        },
      );

      return this.healthCache!;
    } catch (error) {
      logger.error(
        "Email pipeline health check failed",
        "EMAIL_PIPELINE_HEALTH",
        error as Error,
      );
      metrics.increment("email_pipeline.health_check_errors");

      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        services: {
          database: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
          redis: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
          ollama: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
          llama: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
          pipeline: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
          processingQueue: {
            status: "unhealthy",
            lastCheck: new Date().toISOString(),
            details: "Health check failed",
          },
        },
        metrics: {
          totalEmails: 0,
          todaysEmails: 0,
          unprocessedEmails: 0,
          failedEmails: 0,
          averageProcessingTime: 0,
          queueDepth: 0,
        },
        resources: {
          memoryUsage: 0,
          cpuUsage: 0,
          diskUsage: 0,
          databaseSize: 0,
        },
      };
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Test basic connectivity
      this?.db?.prepare("SELECT 1 as test").get();

      // Check critical tables exist
      const tables = [
        "emails_enhanced",
        "email_analysis",
        "pipeline_executions",
      ];
      for (const table of tables) {
        const result = this.db
          .prepare(`SELECT COUNT(*) as count FROM ${table} LIMIT 1`)
          .get() as { count: number };
        if (typeof result.count !== "number") {
          throw new Error(`Table ${table} query failed`);
        }
      }

      // Check database size and performance
      const dbInfo = this?.db?.prepare(`PRAGMA database_list`).all() as Array<{
        name: string;
        file: string;
      }>;
      const mainDb = dbInfo.find((db: any) => db.name === "main");

      let dbSize = 0;
      if (mainDb?.file) {
        try {
          const fs = await import("fs");
          const stats = fs.statSync(mainDb.file);
          dbSize = stats.size;
        } catch {
          // File size check failed, not critical
        }
      }

      const responseTime = Date.now() - startTime;
      const status =
        responseTime < 100
          ? "healthy"
          : responseTime < 500
            ? "degraded"
            : "unhealthy";

      return {
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        details: `Database responsive, ${dbSize > 0 ? `size: ${Math.round(dbSize / 1024 / 1024)}MB` : "size unknown"}`,
        metrics: {
          responseTime,
          databaseSize: dbSize,
          tablesChecked: tables?.length || 0,
        },
      };
    } catch (error) {
      logger.error(
        "Database health check failed",
        "EMAIL_PIPELINE_HEALTH",
        error as Error,
      );
      return {
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: `Database error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check Redis connectivity (optional service)
   */
  private async checkRedisHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Redis is optional in this architecture, check if configured
      const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;

      if (!redisUrl) {
        return {
          status: "healthy",
          lastCheck: new Date().toISOString(),
          details: "Redis not configured (using memory fallback)",
        };
      }

      // If Redis is configured, try to connect
      // Note: This would require redis client implementation
      // For now, return healthy as it's optional
      return {
        status: "healthy",
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: "Redis configured but health check not implemented",
      };
    } catch (error) {
      return {
        status: "degraded",
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: `Redis check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check Ollama service availability
   */
  private async checkLLMHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const models = data.models || [];

      // Check if required models are available
      const requiredModels = ["llama3.2:3b", "phi3:14b"];
      const availableModels = models?.map((m: any) => m.name || m.model);
      const missingModels = requiredModels?.filter(
        (model: any) =>
          !availableModels.some((available: string) =>
            available?.includes(model.split(":")[0]),
          ),
      );

      const status =
        responseTime < 2000 && missingModels?.length || 0 === 0
          ? "healthy"
          : responseTime < 5000 && missingModels?.length || 0 <= 1
            ? "degraded"
            : "unhealthy";

      return {
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        details: `${models?.length || 0} models available${missingModels?.length || 0 > 0 ? `, missing: ${missingModels.join(", ")}` : ""}`,
        metrics: {
          responseTime,
          modelsAvailable: models?.length || 0,
          missingModels: missingModels?.length || 0,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const isTimeout = (error as Error).name === "AbortError";

      return {
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
        responseTime,
        details: `Ollama ${isTimeout ? "timeout" : "error"}: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check pipeline orchestrator health
   */
  private async checkPipelineHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check current pipeline status
      const pipelineStatus = await this?.pipelineOrchestrator?.getStatus();

      // Check recent pipeline executions
      const recentExecutions = this.db
        .prepare(
          `
        SELECT status, COUNT(*) as count
        FROM pipeline_executions 
        WHERE started_at >= datetime('now', '-24 hours')
        GROUP BY status
      `,
        )
        .all() as Array<{ status: string; count: number }>;

      const totalRecent = recentExecutions.reduce(
        (sum, exec) => sum + exec.count,
        0,
      );
      const failedRecent =
        recentExecutions.find((exec: any) => exec.status === "failed")?.count || 0;
      const successRate =
        totalRecent > 0
          ? ((totalRecent - failedRecent) / totalRecent) * 100
          : 100;

      const responseTime = Date.now() - startTime;
      const status =
        successRate >= 95 && pipelineStatus.status !== "failed"
          ? "healthy"
          : successRate >= 80
            ? "degraded"
            : "unhealthy";

      return {
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        details: `Pipeline ${pipelineStatus.status}, ${successRate.toFixed(1)}% success rate (24h)`,
        metrics: {
          responseTime,
          successRate,
          recentExecutions: totalRecent,
          failedExecutions: failedRecent,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: `Pipeline health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Check email processing queue health
   */
  private async checkProcessingQueueHealth(): Promise<ServiceHealth> {
    const startTime = Date.now();

    try {
      // Check unprocessed emails
      const unprocessed = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'new' OR status = 'pending'
      `,
        )
        .get() as { count: number };

      // Check stuck emails (pending for more than 1 hour)
      const stuck = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'pending' AND updated_at < datetime('now', '-1 hour')
      `,
        )
        .get() as { count: number };

      // Check processing rate
      const processed1h = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'processed' AND updated_at >= datetime('now', '-1 hour')
      `,
        )
        .get() as { count: number };

      const responseTime = Date.now() - startTime;
      const status =
        stuck.count === 0 && unprocessed.count < 1000
          ? "healthy"
          : stuck.count < 10 && unprocessed.count < 5000
            ? "degraded"
            : "unhealthy";

      return {
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        details: `${unprocessed.count} unprocessed, ${stuck.count} stuck, ${processed1h.count}/h processed`,
        metrics: {
          responseTime,
          unprocessedCount: unprocessed.count,
          stuckCount: stuck.count,
          processedLastHour: processed1h.count,
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        lastCheck: new Date().toISOString(),
        responseTime: Date.now() - startTime,
        details: `Queue health check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get comprehensive pipeline metrics
   */
  async getPipelineMetrics(): Promise<EmailPipelineMetrics> {
    try {
      // Basic counts
      const totalEmails = this.db
        .prepare("SELECT COUNT(*) as count FROM emails_enhanced")
        .get() as { count: number };
      const todaysEmails = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE received_at >= date('now', 'start of day')
      `,
        )
        .get() as { count: number };

      const unprocessedEmails = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status IN ('new', 'pending')
      `,
        )
        .get() as { count: number };

      const failedEmails = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'failed'
      `,
        )
        .get() as { count: number };

      // Processing rates
      const lastHour = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'processed' AND updated_at >= datetime('now', '-1 hour')
      `,
        )
        .get() as { count: number };

      const last24Hours = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'processed' AND updated_at >= datetime('now', '-24 hours')
      `,
        )
        .get() as { count: number };

      const last7Days = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM emails_enhanced 
        WHERE status = 'processed' AND updated_at >= datetime('now', '-7 days')
      `,
        )
        .get() as { count: number };

      // Average processing time
      const avgProcessingTime = this.db
        .prepare(
          `
        SELECT AVG(
          CASE 
            WHEN processed_at IS NOT NULL AND created_at IS NOT NULL 
            THEN (julianday(processed_at) - julianday(created_at)) * 24 * 60 * 60 
            ELSE NULL 
          END
        ) as avg_seconds
        FROM emails_enhanced 
        WHERE processed_at IS NOT NULL AND created_at IS NOT NULL
        AND processed_at >= datetime('now', '-24 hours')
      `,
        )
        .get() as { avg_seconds: number | null };

      // Queue metrics
      const queueDepth = unprocessedEmails?.count;
      const avgWaitTime = this.db
        .prepare(
          `
        SELECT AVG(
          (julianday('now') - julianday(created_at)) * 24 * 60 * 60
        ) as avg_wait_seconds
        FROM emails_enhanced 
        WHERE status IN ('new', 'pending')
      `,
        )
        .get() as { avg_wait_seconds: number | null };

      // Stage success metrics - using the three-phase analysis columns
      const stageStats = this.db
        .prepare(
          `
        SELECT 
          COUNT(CASE WHEN quick_workflow IS NOT NULL THEN 1 END) as stage1_total,
          COUNT(CASE WHEN deep_workflow_primary IS NOT NULL THEN 1 END) as stage2_total,
          COUNT(CASE WHEN action_summary IS NOT NULL THEN 1 END) as stage3_total,
          COUNT(*) as total_processed
        FROM email_analysis
        WHERE created_at >= datetime('now', '-24 hours')
      `,
        )
        .get() as {
        stage1_total: number;
        stage2_total: number;
        stage3_total: number;
        total_processed: number;
      };

      const stage1Success =
        stageStats.total_processed > 0
          ? (stageStats.stage1_total / stageStats.total_processed) * 100
          : 0;
      const stage2Success =
        stageStats.stage1_total > 0
          ? (stageStats.stage2_total / stageStats.stage1_total) * 100
          : 0;
      const stage3Success =
        stageStats.stage2_total > 0
          ? (stageStats.stage3_total / stageStats.stage2_total) * 100
          : 0;
      const overallSuccessRate =
        stageStats.total_processed > 0
          ? ((stageStats.total_processed - failedEmails.count) /
              stageStats.total_processed) *
            100
          : 100;

      return {
        totalEmails: totalEmails.count,
        todaysEmails: todaysEmails.count,
        unprocessedEmails: unprocessedEmails.count,
        failedEmails: failedEmails.count,
        averageProcessingTime: avgProcessingTime.avg_seconds || 0,
        queueDepth: queueDepth,
        processingRates: {
          lastHour: lastHour.count,
          last24Hours: last24Hours.count,
          last7Days: last7Days.count,
        },
        queueMetrics: {
          depth: queueDepth,
          averageWaitTime: avgWaitTime.avg_wait_seconds || 0,
          throughput: last24Hours.count / 24, // emails per hour
        },
        stageMetrics: {
          stage1Success,
          stage2Success,
          stage3Success,
          overallSuccessRate,
        },
      };
    } catch (error) {
      logger.error(
        "Failed to get pipeline metrics",
        "EMAIL_PIPELINE_HEALTH",
        error as Error,
      );

      // Return default metrics on error
      return {
        totalEmails: 0,
        todaysEmails: 0,
        unprocessedEmails: 0,
        failedEmails: 0,
        averageProcessingTime: 0,
        queueDepth: 0,
        processingRates: {
          lastHour: 0,
          last24Hours: 0,
          last7Days: 0,
        },
        queueMetrics: {
          depth: 0,
          averageWaitTime: 0,
          throughput: 0,
        },
        stageMetrics: {
          stage1Success: 0,
          stage2Success: 0,
          stage3Success: 0,
          overallSuccessRate: 0,
        },
      };
    }
  }

  /**
   * Get system resource metrics
   */
  private async getResourceMetrics(): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    databaseSize: number;
  }> {
    try {
      const process = await import("process");
      const memUsage = process.memoryUsage();

      // Memory usage in MB
      const memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);

      // CPU usage (approximate)
      const cpuUsage = process.cpuUsage();
      const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

      // Database size
      let databaseSize = 0;
      try {
        const fs = await import("fs");
        const dbPath = process.env.DATABASE_PATH || "./data/crewai.db";
        const stats = fs.statSync(dbPath);
        databaseSize = Math.round(stats.size / 1024 / 1024); // MB
      } catch {
        // Database size check failed
      }

      return {
        memoryUsage,
        cpuUsage: cpuPercent,
        diskUsage: 0, // Would need OS-specific implementation
        databaseSize,
      };
    } catch (error) {
      logger.error(
        "Failed to get resource metrics",
        "EMAIL_PIPELINE_HEALTH",
        error as Error,
      );
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        diskUsage: 0,
        databaseSize: 0,
      };
    }
  }

  /**
   * Calculate overall health status from individual service statuses
   */
  private calculateOverallStatus(statuses: Array<HealthStatus>): HealthStatus {
    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    }
    if (statuses.includes("degraded")) {
      return "degraded";
    }
    return "healthy";
  }

  /**
   * Clear health cache to force fresh check
   */
  clearCache(): void {
    this.healthCache = null;
    this.lastHealthCheck = 0;
  }

  /**
   * Force a fresh health check
   */
  async forceHealthCheck(): Promise<EmailPipelineHealthStatus> {
    this.clearCache();
    return this.getHealthStatus();
  }
}
