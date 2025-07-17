import { z } from "zod";
import { publicProcedure, router } from "../trpc/enhanced-router";
import { logger } from "../../utils/logger";
import appConfig from "../../config/app.config";

/**
 * Enhanced Health Check Router
 * Provides comprehensive system health monitoring
 */

// Health status enum
const HealthStatus = z.enum(["healthy", "degraded", "unhealthy", "unknown"]);

// Service status enum
const ServiceStatus = z.enum([
  "connected",
  "disconnected",
  "timeout",
  "error",
  "not_configured",
  "running",
]);

type ServiceStatusType = z.infer<typeof ServiceStatus>;

// Health check response schema
const HealthCheckResponse = z.object({
  status: HealthStatus,
  timestamp: z.string(),
  uptime: z.number(),
  version: z.string(),
  environment: z.string(),
  services: z.object({
    api: ServiceStatus,
    ollama: ServiceStatus,
    chromadb: ServiceStatus,
    database: ServiceStatus,
    masterOrchestrator: ServiceStatus,
    agentRegistry: ServiceStatus,
  }),
  metrics: z.object({
    responseTime: z.number(),
    memoryUsage: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number(),
    }),
    cpuUsage: z.number().optional(),
  }),
  details: z.record(z.any()).optional(),
});

// Service health check functions
async function checkOllamaHealth(): Promise<{
  status: ServiceStatusType;
  details?: any;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${appConfig.ollama?.baseUrl || "http://localhost:11434"}/api/tags`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as { models?: Array<{ name: string }> };
      return {
        status: "connected",
        details: {
          modelsCount: data.models?.length || 0,
          models: data.models?.map((m) => m.name) || [],
        },
      };
    }

    return { status: "disconnected" };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return { status: "timeout" };
    }
    return {
      status: "error",
      details: { error: (error as Error).message },
    };
  }
}

async function checkChromaDBHealth(): Promise<{
  status: ServiceStatusType;
  details?: any;
}> {
  try {
    if (!appConfig.rag?.vectorStore?.baseUrl) {
      return { status: "not_configured" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      `${appConfig.rag.vectorStore.baseUrl}/api/v1/heartbeat`,
      { signal: controller.signal },
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      // Try to get version info
      try {
        const versionResponse = await fetch(
          `${appConfig.rag.vectorStore.baseUrl}/api/v1/version`,
          { signal: controller.signal },
        );
        if (versionResponse.ok) {
          const versionData = await versionResponse.json() as { version?: string };
          return {
            status: "connected",
            details: { version: versionData.version },
          };
        }
      } catch (e) {
        // Version endpoint might not exist, but service is still healthy
      }

      return { status: "connected" };
    }

    return { status: "disconnected" };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return { status: "timeout" };
    }
    return {
      status: "error",
      details: { error: (error as Error).message },
    };
  }
}

async function checkDatabaseHealth(): Promise<{
  status: ServiceStatusType;
  details?: any;
}> {
  try {
    const Database = (await import("better-sqlite3")).default;
    const dbPath = appConfig.database?.path || "./data/app.db";

    const db = new Database(dbPath, { readonly: true });

    // Test basic connectivity
    const result = db.prepare("SELECT 1 as test").get();

    // Get database info
    const dbInfo = db
      .prepare(
        `
      SELECT 
        page_count * page_size as size,
        page_count,
        page_size
      FROM pragma_page_count(), pragma_page_size()
    `,
      )
      .get() as any;

    db.close();

    return {
      status: "connected",
      details: {
        path: dbPath,
        size: dbInfo.size,
        pageCount: dbInfo.page_count,
        pageSize: dbInfo.page_size,
      },
    };
  } catch (error) {
    return {
      status: "error",
      details: { error: (error as Error).message },
    };
  }
}

async function checkMasterOrchestratorHealth(
  ctx: any,
): Promise<{ status: ServiceStatusType; details?: any }> {
  try {
    if (!ctx.masterOrchestrator) {
      return { status: "not_configured" };
    }

    // Check if orchestrator is initialized
    const isInitialized =
      (await ctx.masterOrchestrator.isInitialized?.()) ?? false;

    if (isInitialized) {
      return {
        status: "running",
        details: {
          initialized: true,
          // Add more orchestrator-specific health checks here
        },
      };
    }

    return { status: "disconnected", details: { initialized: false } };
  } catch (error) {
    return {
      status: "error",
      details: { error: (error as Error).message },
    };
  }
}

async function checkAgentRegistryHealth(
  ctx: any,
): Promise<{ status: ServiceStatusType; details?: any }> {
  try {
    if (!ctx.agentRegistry) {
      return { status: "not_configured" };
    }

    // Get registered agents
    const registeredAgents = ctx.agentRegistry.getRegisteredAgents?.() || [];

    return {
      status: "running",
      details: {
        registeredAgents: registeredAgents.length,
        agentTypes: registeredAgents.map(
          (agent: any) => agent.type || agent.name,
        ),
      },
    };
  } catch (error) {
    return {
      status: "error",
      details: { error: (error as Error).message },
    };
  }
}

function getSystemMetrics() {
  const memUsage = process.memoryUsage();
  const totalMem = memUsage.heapTotal;
  const usedMem = memUsage.heapUsed;

  return {
    memoryUsage: {
      used: usedMem,
      total: totalMem,
      percentage: Math.round((usedMem / totalMem) * 100),
    },
    // CPU usage would require additional monitoring
    cpuUsage: undefined,
  };
}

export const healthRouter = router({
  // Basic health check - lightweight for load balancers
  basic: publicProcedure.query(async () => {
    const startTime = Date.now();

    // Quick connectivity checks only
    const ollamaHealth = await checkOllamaHealth();
    const dbHealth = await checkDatabaseHealth();

    const responseTime = Date.now() - startTime;

    const isHealthy =
      ollamaHealth.status === "connected" && dbHealth.status === "connected";

    return {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      responseTime,
      services: {
        api: "running" as ServiceStatusType,
        ollama: ollamaHealth.status,
        database: dbHealth.status,
      },
    };
  }),

  // Comprehensive health check - detailed system status
  detailed: publicProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();

    logger.info("Running detailed health check", "HEALTH_CHECK");

    // Check all services in parallel
    const [
      ollamaHealth,
      chromaHealth,
      dbHealth,
      orchestratorHealth,
      agentRegistryHealth,
    ] = await Promise.all([
      checkOllamaHealth(),
      checkChromaDBHealth(),
      checkDatabaseHealth(),
      checkMasterOrchestratorHealth(ctx),
      checkAgentRegistryHealth(ctx),
    ]);

    const responseTime = Date.now() - startTime;
    const metrics = getSystemMetrics();

    const services = {
      api: "running" as ServiceStatusType,
      ollama: ollamaHealth.status,
      chromadb: chromaHealth.status,
      database: dbHealth.status,
      masterOrchestrator: orchestratorHealth.status,
      agentRegistry: agentRegistryHealth.status,
    };

    // Determine overall status
    const criticalServices = [services.api, services.ollama, services.database];
    const hasCriticalFailure = criticalServices.some(
      (s) => s === "error" || s === "disconnected",
    );
    const hasTimeout = Object.values(services).some((s) => s === "timeout");

    let overallStatus: z.infer<typeof HealthStatus>;
    if (hasCriticalFailure) {
      overallStatus = "unhealthy";
    } else if (hasTimeout || services.chromadb === "error") {
      overallStatus = "degraded";
    } else {
      overallStatus = "healthy";
    }

    const result = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || "unknown",
      environment: process.env.NODE_ENV || "development",
      services,
      metrics: {
        responseTime,
        ...metrics,
      },
      details: {
        ollama: ollamaHealth.details,
        chromadb: chromaHealth.details,
        database: dbHealth.details,
        masterOrchestrator: orchestratorHealth.details,
        agentRegistry: agentRegistryHealth.details,
      },
    };

    logger.info("Health check completed", "HEALTH_CHECK", {
      status: overallStatus,
      responseTime,
      services: Object.entries(services).map(
        ([name, status]) => `${name}:${status}`,
      ),
    });

    return result;
  }),

  // Readiness check - for Kubernetes readiness probes
  ready: publicProcedure.query(async ({ ctx }) => {
    const startTime = Date.now();

    // Check critical services for readiness
    const ollamaHealth = await checkOllamaHealth();
    const dbHealth = await checkDatabaseHealth();
    const orchestratorHealth = await checkMasterOrchestratorHealth(ctx);

    const responseTime = Date.now() - startTime;

    const isReady =
      ollamaHealth.status === "connected" &&
      dbHealth.status === "connected" &&
      orchestratorHealth.status === "running";

    return {
      ready: isReady,
      timestamp: new Date().toISOString(),
      responseTime,
      services: {
        ollama: ollamaHealth.status,
        database: dbHealth.status,
        masterOrchestrator: orchestratorHealth.status,
      },
    };
  }),

  // Liveness check - for Kubernetes liveness probes
  live: publicProcedure.query(async () => {
    const startTime = Date.now();

    // Basic liveness - just check if the process is responsive
    const responseTime = Date.now() - startTime;

    return {
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime,
      pid: process.pid,
    };
  }),
});

export type HealthRouter = typeof healthRouter;
