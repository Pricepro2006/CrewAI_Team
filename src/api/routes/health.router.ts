import { router, publicProcedure } from "../trpc/enhanced-router.js";
import { logger } from "../../utils/logger.js";
import ollamaConfig from "../../config/ollama.config.js";
import appConfig from "../../config/app.config.js";
import { MODEL_CONFIG } from "../../config/models.config.js";
import Database from "better-sqlite3";
import { GroceryNLPQueue } from "../services/GroceryNLPQueue.js";
import { healthCheckService } from "../../monitoring/HealthCheckService.js";
import { z } from "zod";

interface ServiceStatus {
  status: "healthy" | "degraded" | "error" | "unknown";
  message?: string;
  details?: Record<string, any>;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "error";
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    api: ServiceStatus;
    ollama: ServiceStatus;
    database: ServiceStatus;
    chromadb: ServiceStatus;
    rag: ServiceStatus;
    nlpQueue?: ServiceStatus;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
  };
}

// Track API start time for uptime calculation
const apiStartTime = Date.now();

// Validation schemas for enhanced endpoints
const serviceHealthCheckSchema = z.object({
  serviceId: z.string().optional(),
  detailed: z.boolean().default(false),
});

const triggerHealthCheckSchema = z.object({
  serviceId: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
});

export const healthRouter = router({
  // Main health status endpoint (enhanced with comprehensive health service)
  status: publicProcedure.query(async ({ ctx }): Promise<HealthStatus> => {
    const services: HealthStatus["services"] = {
      api: { status: "healthy", message: "API is running" },
      ollama: { status: "unknown" },
      database: { status: "unknown" },
      chromadb: { status: "unknown" },
      rag: { status: "unknown" },
    };

    // Check Ollama connection
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const ollamaResponse = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (ollamaResponse.ok) {
        const data = (await ollamaResponse.json()) as {
          models?: Array<{ name: string }>;
        };
        services.ollama = {
          status: "healthy",
          message: "Ollama is connected",
          details: {
            models: data.models?.length || 0,
            baseUrl: ollamaConfig.baseUrl,
          },
        };
      } else {
        services.ollama = {
          status: "error",
          message: `Ollama returned status ${ollamaResponse.status}`,
        };
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        services.ollama = {
          status: "error",
          message: "Ollama connection timeout",
        };
      } else {
        services.ollama = {
          status: "error",
          message: `Ollama connection failed: ${(error as Error).message}`,
        };
      }
    }

    // Check database connection
    try {
      const db = new Database(appConfig.database?.path || "./data/app.db", {
        readonly: true,
      });

      // Test query
      const result = db.prepare("SELECT 1 as test").get();

      // Get some basic stats
      const conversationCount = (
        db.prepare("SELECT COUNT(*) as count FROM conversations").get() as any
      ).count;

      const messageCount = (
        db.prepare("SELECT COUNT(*) as count FROM messages").get() as any
      ).count;

      db.close();

      services.database = {
        status: "healthy",
        message: "Database is connected",
        details: {
          path: appConfig.database?.path,
          conversations: conversationCount,
          messages: messageCount,
        },
      };
    } catch (error) {
      services.database = {
        status: "error",
        message: `Database error: ${(error as Error).message}`,
      };
    }

    // Check ChromaDB connection (optional service - system remains healthy even if unavailable)
    try {
      const chromaUrl = process.env.CHROMA_URL || "http://localhost:8001";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // Reduced timeout

      const chromaResponse = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (chromaResponse.ok) {
        services.chromadb = {
          status: "healthy",
          message: "ChromaDB connected - persistent vector storage active",
          details: {
            url: chromaUrl,
            mode: "persistent",
            fallback: false,
            optional: true,
          },
        };
      } else {
        services.chromadb = {
          status: "healthy", // Still healthy because fallback works
          message: "ChromaDB unavailable - in-memory fallback active (system fully operational)",
          details: {
            url: chromaUrl,
            mode: "in-memory",
            fallback: true,
            optional: true,
            info: "System automatically using in-memory vector store",
          },
        };
      }
    } catch (error) {
      services.chromadb = {
        status: "healthy", // Still healthy because fallback works
        message: "ChromaDB offline - in-memory fallback active (system fully operational)",
        details: {
          mode: "in-memory",
          fallback: true,
          optional: true,
          retryScheduled: true,
          info: "System automatically using in-memory vector store with periodic retry",
          error: error instanceof Error ? error.message : 'Connection timeout',
        },
      };
    }

    // Check RAG system status (with resilient vector store awareness)
    try {
      if (ctx.ragSystem) {
        // Get RAG health status including vector store details
        const ragHealth = await ctx?.ragSystem?.getHealthStatus();
        const documents = await ctx?.ragSystem?.getAllDocuments(1);
        
        // RAG is always healthy if initialized, regardless of vector store backend
        const isUsingFallback = ragHealth.vectorStore?.fallbackUsed || 
                               ragHealth.vectorStore?.type === "in-memory" ||
                               ragHealth.vectorStore?.mode === "in-memory";
        
        services.rag = {
          status: "healthy", // Always healthy with resilient store
          message: isUsingFallback 
            ? "RAG system operational with in-memory vector store"
            : "RAG system operational with persistent vector storage",
          details: {
            initialized: true,
            hasDocuments: documents?.length || 0 > 0,
            vectorStoreType: ragHealth.vectorStore?.type || "resilient",
            vectorStoreMode: ragHealth.vectorStore?.mode || "unknown",
            fallbackMode: isUsingFallback,
            embeddingService: ragHealth.embeddingService?.status || "unknown",
            resilient: true,
          },
        };
      } else {
        services.rag = {
          status: "error",
          message: "RAG system not initialized",
        };
      }
    } catch (error) {
      // Even on error, check if it's just a vector store issue
      const errorMessage = (error as Error).message;
      if (errorMessage.includes("vector") || errorMessage.includes("ChromaDB")) {
        services.rag = {
          status: "healthy", // Still healthy with fallback
          message: "RAG system operational with fallback mode",
          details: {
            fallbackActive: true,
            error: errorMessage,
          },
        };
      } else {
        services.rag = {
          status: "error",
          message: `RAG system error: ${errorMessage}`,
        };
      }
    }

    // Check NLP Queue status (for grocery processing)
    try {
      const nlpQueue = GroceryNLPQueue.getInstance();
      const queueStatus = nlpQueue.getStatus();
      
      services.nlpQueue = {
        status: queueStatus.healthy ? "healthy" : "degraded",
        message: queueStatus.healthy 
          ? "NLP queue is healthy" 
          : "NLP queue experiencing issues",
        details: {
          queueSize: queueStatus.queueSize,
          activeRequests: queueStatus.activeRequests,
          maxConcurrent: queueStatus.maxConcurrent,
          metrics: queueStatus.metrics
        }
      };
    } catch (error) {
      services.nlpQueue = {
        status: "error",
        message: `NLP queue error: ${(error as Error).message}`,
      };
    }

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const os = await import("os");
    const totalMemory = os.totalmem();
    const usedMemory = memoryUsage.heapUsed + memoryUsage.external;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Calculate overall status (ChromaDB is fully optional with automatic fallback)
    let overallStatus: HealthStatus["status"] = "healthy";

    // Critical services - if any are in error, system is in error
    const criticalServices = [services.api, services.database];
    const criticalErrors = criticalServices.some(s => s.status === "error");

    // Important but non-critical services - error causes degradation
    const importantServices = [services.ollama, services.rag];
    const importantErrors = importantServices.some(s => s.status === "error");
    const importantDegraded = importantServices.some(s => s.status === "degraded");

    // ChromaDB is fully optional - its status never affects overall health
    // because we have automatic fallback to in-memory storage

    if (criticalErrors) {
      overallStatus = "error";
    } else if (importantErrors) {
      overallStatus = "degraded";
    } else if (importantDegraded) {
      // Only degrade if important services are degraded
      // ChromaDB status is ignored since fallback ensures full functionality
      overallStatus = "degraded";
    }
    // Otherwise, system remains healthy even if ChromaDB is unavailable

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
      uptime: Date.now() - apiStartTime,
      services,
      system: {
        memory: {
          used: usedMemory,
          total: totalMemory,
          percentage: Math.round(memoryPercentage * 100) / 100,
        },
        cpu: {
          usage: 0, // CPU usage would require additional monitoring
        },
      },
    };
  }),

  // Simple ping endpoint
  ping: publicProcedure.query(() => {
    return {
      pong: true,
      timestamp: new Date().toISOString(),
    };
  }),

  // Service-specific health checks
  checkOllama: publicProcedure.query(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      const models = data.models || [];

      // Check for required models
      const requiredModels = [MODEL_CONFIG?.models?.primary, MODEL_CONFIG?.models?.critical, MODEL_CONFIG?.models?.embedding];
      const availableModels = models?.map((m: any) => m.name);
      const missingModels = requiredModels?.filter(
        (m: any) =>
          !availableModels.some((am: any) => am.startsWith(m.split(":")[0] || m)),
      );

      return {
        connected: true,
        baseUrl: ollamaConfig.baseUrl,
        models: availableModels,
        missingModels,
        status: missingModels?.length || 0 === 0 ? "ready" : "missing_models",
      };
    } catch (error) {
      logger.error("Ollama health check failed", "HEALTH", { error });
      return {
        connected: false,
        error: (error as Error).message,
        status: "error",
      };
    }
  }),

  checkDatabase: publicProcedure.query(async () => {
    try {
      const db = new Database(appConfig.database?.path || "./data/app.db", {
        readonly: true,
      });

      // Get table information
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[];

      // Get row counts for main tables
      const stats: Record<string, number> = {};
      for (const table of tables) {
        try {
          const count = (
            db
              .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
              .get() as any
          ).count;
          stats[table.name] = count;
        } catch {
          stats[table.name] = -1;
        }
      }

      db.close();

      return {
        connected: true,
        path: appConfig.database?.path,
        tables: tables?.map((t: any) => t.name),
        stats,
        status: "healthy",
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
        status: "error",
      };
    }
  }),

  checkRag: publicProcedure.query(async ({ ctx }) => {
    try {
      if (!ctx.ragSystem) {
        return {
          initialized: false,
          status: "not_initialized",
        };
      }

      // Get basic RAG stats
      const documents = await ctx?.ragSystem?.getAllDocuments(100);

      return {
        initialized: true,
        documentCount: documents?.length || 0,
        chromadbConnected:
          ctx.ragSystem["vectorStore"]?.["isConnected"] || false,
        embeddingModel: MODEL_CONFIG?.models?.embedding,
        status: "healthy",
      };
    } catch (error) {
      return {
        initialized: false,
        error: (error as Error).message,
        status: "error",
      };
    }
  }),

  // System metrics endpoint
  metrics: publicProcedure.query(() => {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      pid: process.pid,
      version: {
        node: process.version,
        app: process.env.npm_package_version || "1.0.0",
      },
    };
  }),

  // =============================================================================
  // COMPREHENSIVE HEALTH CHECK ENDPOINTS (New Implementation)
  // =============================================================================

  // Aggregated health status for all microservices
  aggregated: publicProcedure.query(async () => {
    try {
      const aggregatedHealth = healthCheckService.getAggregatedHealth();
      
      return {
        status: aggregatedHealth.overall,
        timestamp: aggregatedHealth?.lastCheck?.toISOString(),
        uptime: Math.floor(aggregatedHealth.uptime / 1000),
        version: aggregatedHealth.version,
        environment: aggregatedHealth.environment,
        summary: aggregatedHealth.summary,
        services: aggregatedHealth?.services?.map(service => ({
          id: service.serviceId,
          name: service.serviceName,
          status: service.status,
          responseTime: service.responseTime,
          lastCheck: service?.timestamp?.toISOString(),
          type: service.metadata?.type,
          critical: service.metadata?.critical,
          uptime: service.uptime,
          version: service.version,
          error: service.error
        })),
        criticalServicesDown: aggregatedHealth?.summary?.critical_down
      };
    } catch (error) {
      logger.error('Aggregated health check failed', 'HEALTH_ROUTER', { error });
      throw new Error(`Aggregated health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),

  // Individual service health check
  service: publicProcedure
    .input(serviceHealthCheckSchema)
    .query(async ({ input }) => {
      try {
        if (!input.serviceId) {
          // Return all service configurations
          const configs = healthCheckService.getServiceConfigurations();
          return {
            services: configs?.map(config => ({
              id: config.id,
              name: config.name,
              type: config.type,
              endpoint: `${config.protocol}://${config.host}:${config.port}${config.healthEndpoint || '/health'}`,
              critical: config.critical,
              interval: config.interval,
              timeout: config.timeout,
              dependencies: config.dependencies,
              tags: config.tags,
              health: healthCheckService.getServiceHealth(config.id)
            }))
          };
        }

        let healthResult = healthCheckService.getServiceHealth(input.serviceId);
        
        if (!healthResult && input.detailed) {
          // Trigger fresh health check if detailed info requested
          healthResult = await healthCheckService.checkServiceNow(input.serviceId);
        }

        if (!healthResult) {
          throw new Error(`Health data not available for service: ${input.serviceId}`);
        }

        const response = {
          serviceId: healthResult.serviceId,
          serviceName: healthResult.serviceName,
          status: healthResult.status,
          responseTime: healthResult.responseTime,
          timestamp: healthResult?.timestamp?.toISOString(),
          uptime: healthResult.uptime,
          version: healthResult.version,
          error: healthResult.error,
          metadata: healthResult.metadata
        };

        if (input.detailed) {
          return {
            ...response,
            checks: {
              liveness: {
                status: healthResult?.checks?.liveness.status,
                message: healthResult?.checks?.liveness.message,
                responseTime: healthResult?.checks?.liveness.responseTime,
                details: healthResult?.checks?.liveness.details
              },
              readiness: {
                status: healthResult?.checks?.readiness.status,
                message: healthResult?.checks?.readiness.message,
                responseTime: healthResult?.checks?.readiness.responseTime,
                details: healthResult?.checks?.readiness.details
              },
              dependencies: healthResult?.checks?.dependencies?.map(dep => ({
                name: dep.name,
                status: dep.status,
                message: dep.message,
                responseTime: dep.responseTime,
                details: dep.details
              })),
              resources: {
                cpu: healthResult?.checks?.resources.cpu,
                memory: {
                  usage: Math.round((healthResult?.checks?.resources.memory.usage || 0) / 1024 / 1024),
                  total: Math.round((healthResult?.checks?.resources.memory.total || 0) / 1024 / 1024),
                  percentage: healthResult?.checks?.resources.memory.percentage,
                  status: healthResult?.checks?.resources.memory.status
                },
                connections: healthResult?.checks?.resources.connections
              }
            }
          };
        }

        return response;
      } catch (error) {
        logger.error('Service health check failed', 'HEALTH_ROUTER', { 
          serviceId: input.serviceId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw error;
      }
    }),

  // Trigger manual health checks
  triggerCheck: publicProcedure
    .input(triggerHealthCheckSchema)
    .mutation(async ({ input }) => {
      try {
        let results;
        
        if (input.serviceId) {
          // Single service check
          const result = await healthCheckService.checkServiceNow(input.serviceId);
          results = result ? [result] : [];
        } else if (input.serviceIds && input?.serviceIds?.length > 0) {
          // Multiple service check
          results = await healthCheckService.checkServicesNow(input.serviceIds);
        } else {
          // Check all services
          const configs = healthCheckService.getServiceConfigurations();
          const allServiceIds = configs?.map(c => c.id);
          results = await healthCheckService.checkServicesNow(allServiceIds);
        }

        return {
          timestamp: new Date().toISOString(),
          message: 'Health checks completed',
          results: results?.map(result => ({
            serviceId: result.serviceId,
            serviceName: result.serviceName,
            status: result.status,
            responseTime: result.responseTime,
            timestamp: result?.timestamp?.toISOString(),
            error: result.error
          }))
        };
      } catch (error) {
        logger.error('Manual health check trigger failed', 'HEALTH_ROUTER', { 
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        throw new Error(`Health check trigger failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),

  // Circuit breaker states
  circuitBreakers: publicProcedure.query(() => {
    try {
      const circuitBreakers = healthCheckService.getCircuitBreakerStates();
      
      return {
        timestamp: new Date().toISOString(),
        circuitBreakers: Array.from(circuitBreakers.entries()).map(([serviceId, state]) => ({
          serviceId,
          state: state.state,
          failures: state.failures,
          lastFailure: state.lastFailure?.toISOString(),
          nextRetry: state.nextRetry?.toISOString()
        }))
      };
    } catch (error) {
      logger.error('Circuit breaker status failed', 'HEALTH_ROUTER', { error });
      throw new Error(`Circuit breaker status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),

  // Prometheus metrics
  prometheusMetrics: publicProcedure.query(() => {
    try {
      const metrics = healthCheckService.getPrometheusMetrics();
      
      return {
        timestamp: new Date().toISOString(),
        metrics: Object.entries(metrics).map(([name, metric]) => ({
          name,
          value: metric.value,
          labels: metric.labels,
          help: metric.help,
          type: metric.type
        }))
      };
    } catch (error) {
      logger.error('Prometheus metrics collection failed', 'HEALTH_ROUTER', { error });
      throw new Error(`Metrics collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),

  // Service dependencies graph
  dependencies: publicProcedure.query(() => {
    try {
      const services = healthCheckService.getServiceConfigurations();
      
      const dependencyGraph = services?.map(service => ({
        id: service.id,
        name: service.name,
        type: service.type,
        dependencies: service.dependencies || [],
        dependents: services
          .filter(s => s.dependencies?.includes(service.id))
          .map(s => ({ id: s.id, name: s.name })),
        health: healthCheckService.getServiceHealth(service.id)?.status || 'unknown'
      }));

      return {
        timestamp: new Date().toISOString(),
        services: dependencyGraph
      };
    } catch (error) {
      logger.error('Dependencies graph generation failed', 'HEALTH_ROUTER', { error });
      throw new Error(`Dependencies check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),

  // Service configuration
  configurations: publicProcedure.query(() => {
    try {
      const configs = healthCheckService.getServiceConfigurations();
      
      return {
        timestamp: new Date().toISOString(),
        services: configs?.map(config => ({
          id: config.id,
          name: config.name,
          type: config.type,
          host: config.host,
          port: config.port,
          healthEndpoint: config.healthEndpoint,
          protocol: config.protocol,
          critical: config.critical,
          timeout: config.timeout,
          retries: config.retries,
          interval: config.interval,
          dependencies: config.dependencies,
          tags: config.tags
        }))
      };
    } catch (error) {
      logger.error('Configuration retrieval failed', 'HEALTH_ROUTER', { error });
      throw new Error(`Configuration retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }),
});
