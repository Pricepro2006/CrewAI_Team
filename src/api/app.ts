import { config } from "dotenv";
config(); // Load environment variables

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import appConfig from "../config/app.config.js";
import type { Express } from "express";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { metricsMiddleware } from "./middleware/metricsMiddleware.js";
import uploadRoutes from "./routes/upload.routes.js";
import emailPipelineHealthRouter from "./routes/email-pipeline-health.router.js";
import { groceryNLPQueueRouter } from "./routes/grocery-nlp-queue.router.js";
import metricsRouter from "./routes/metrics.router.js";

/**
 * Create Express app with all middleware configured
 * This is separated from server.ts to allow for easier testing
 */
export async function createApp(): Promise<Express> {
  const app: Express = express();

  // Middleware
  app.use(helmet());
  app.use(cors(appConfig?.api?.cors));
  app.use(express.json());

  // Apply metrics middleware to track all requests
  app.use(metricsMiddleware);

  // Apply general rate limiting to all routes
  app.use(apiRateLimiter);

  // Health check endpoint
  app.get("/health", async (_req, res) => {
    const startTime = Date.now();
    const services = {
      api: "running",
      ollama: "unknown",
      chromadb: "unknown",
      database: "unknown",
    };

    try {
      // Check Ollama connection with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const ollamaResponse = await fetch(
        `${appConfig.ollama?.baseUrl || "http://localhost:8081"}/api/tags`,
        {
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);
      services.ollama = ollamaResponse.ok ? "connected" : "disconnected";
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        services.ollama = "timeout";
      } else {
        services.ollama = "error";
      }
    }

    try {
      // Check ChromaDB connection (if configured)
      if (appConfig.rag?.vectorStore?.baseUrl) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const chromaResponse = await fetch(
          `${appConfig?.rag?.vectorStore.baseUrl}/api/v1/heartbeat`,
          {
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);
        services.chromadb = chromaResponse.ok ? "connected" : "disconnected";
      } else {
        services.chromadb = "not_configured";
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        services.chromadb = "timeout";
      } else {
        services.chromadb = "error";
      }
    }

    try {
      // Check database connection
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(
        process.env['DATABASE_PATH'] ||
          appConfig.database?.path ||
          "./data/app.db",
        {
          readonly: true,
        },
      );
      db.prepare("SELECT 1").get();
      db.close();
      services.database = "connected";
    } catch (error) {
      services.database = "error";
    }

    const overallStatus = Object.values(services).every(
      (s: any) => s === "running" || s === "connected" || s === "not_configured",
    )
      ? "healthy"
      : "degraded";

    res.json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      services,
    });
  });

  // File upload routes (before tRPC to handle multipart forms)
  app.use("/api", uploadRoutes);

  // Email pipeline health routes
  app.use("/api/health", emailPipelineHealthRouter);
  
  // Grocery NLP Queue routes
  app.use("/api/grocery/nlp", groceryNLPQueueRouter);
  
  // Metrics routes (Prometheus format)
  app.use("/", metricsRouter);

  // tRPC middleware
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, type, path, input }) {
        console.error("tRPC Error:", {
          type,
          path: path || "unknown",
          error: error.message,
          input,
        });
      },
    }),
  );

  // Static file serving for UI in production
  if (process.env["NODE_ENV"] === "production") {
    app.use(express.static("dist/client"));
    app.get("*", (_req, res) => {
      res.sendFile("index.html", { root: "dist/client" });
    });
  }

  return app;
}
