import { router, publicProcedure } from "../trpc/enhanced-router";
import { logger } from "../../utils/logger";
import ollamaConfig from "../../config/ollama.config";
import appConfig from "../../config/app.config";
import { MODEL_CONFIG } from "../../config/models.config";
import Database from "better-sqlite3";

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

export const healthRouter = router({
  // Main health status endpoint
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

    // Check ChromaDB connection (if configured)
    try {
      const chromaUrl = process.env.CHROMA_URL || "http://localhost:8001";
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const chromaResponse = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (chromaResponse.ok) {
        services.chromadb = {
          status: "healthy",
          message: "ChromaDB is connected",
          details: {
            url: chromaUrl,
          },
        };
      } else {
        services.chromadb = {
          status: "degraded",
          message: "ChromaDB not available - using in-memory fallback",
        };
      }
    } catch (error) {
      services.chromadb = {
        status: "degraded",
        message: "ChromaDB not available - using in-memory fallback",
      };
    }

    // Check RAG system status
    try {
      if (ctx.ragSystem) {
        // Get document stats
        const documents = await ctx.ragSystem.getAllDocuments(1);
        services.rag = {
          status: "healthy",
          message: "RAG system is operational",
          details: {
            initialized: true,
            hasDocuments: documents.length > 0,
          },
        };
      } else {
        services.rag = {
          status: "error",
          message: "RAG system not initialized",
        };
      }
    } catch (error) {
      services.rag = {
        status: "error",
        message: `RAG system error: ${(error as Error).message}`,
      };
    }

    // Get system metrics
    const memoryUsage = process.memoryUsage();
    const os = await import("os");
    const totalMemory = os.totalmem();
    const usedMemory = memoryUsage.heapUsed + memoryUsage.external;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Calculate overall status
    const serviceStatuses = Object.values(services).map((s) => s.status);
    let overallStatus: HealthStatus["status"] = "healthy";

    if (serviceStatuses.includes("error")) {
      if (
        services.api.status === "error" ||
        services.database.status === "error"
      ) {
        overallStatus = "error";
      } else {
        overallStatus = "degraded";
      }
    } else if (serviceStatuses.includes("degraded")) {
      overallStatus = "degraded";
    }

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
      const requiredModels = [MODEL_CONFIG.models.primary, MODEL_CONFIG.models.critical, MODEL_CONFIG.models.embedding];
      const availableModels = models.map((m) => m.name);
      const missingModels = requiredModels.filter(
        (m) =>
          !availableModels.some((am) => am.startsWith(m.split(":")[0] || m)),
      );

      return {
        connected: true,
        baseUrl: ollamaConfig.baseUrl,
        models: availableModels,
        missingModels,
        status: missingModels.length === 0 ? "ready" : "missing_models",
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
        tables: tables.map((t) => t.name),
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
      const documents = await ctx.ragSystem.getAllDocuments(100);

      return {
        initialized: true,
        documentCount: documents.length,
        chromadbConnected:
          ctx.ragSystem["vectorStore"]?.["isConnected"] || false,
        embeddingModel: MODEL_CONFIG.models.embedding,
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
});
