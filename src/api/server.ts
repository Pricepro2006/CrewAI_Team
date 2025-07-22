import { config } from "dotenv";
config(); // Load environment variables

import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import appConfig from "../config/app.config";
import ollamaConfig from "../config/ollama.config";
import type { Express } from "express";
import { apiRateLimiter } from "./middleware/rateLimiter";
import { wsService } from "./services/WebSocketService";
import { logger } from "../utils/logger";
import uploadRoutes from "./routes/upload.routes";
import { webhookRouter } from "./routes/webhook.router";
import { emailAnalysisRouter } from "./routes/email-analysis.router";
import emailAssignmentRouter from "./routes/email-assignment.router";
import {
  cleanupManager,
  registerDefaultCleanupTasks,
} from "./services/ServiceCleanupManager";

const app: Express = express();
const PORT = appConfig.api.port;

// Middleware
app.use(helmet());
app.use(cors(appConfig.api.cors));

// Handle preflight requests for all routes
app.options("*", cors(appConfig.api.cors));

app.use(express.json());

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

    const ollamaResponse = await fetch(`${ollamaConfig.baseUrl}/api/tags`, {
      signal: controller.signal,
    });
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
    const chromaUrl = process.env.CHROMA_BASE_URL || "http://localhost:8000";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const chromaResponse = await fetch(`${chromaUrl}/api/v2/version`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    services.chromadb = chromaResponse.ok ? "connected" : "disconnected";
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
    const db = new Database(appConfig.database?.path || "./data/app.db", {
      readonly: true,
    });
    db.prepare("SELECT 1").get();
    db.close();
    services.database = "connected";
  } catch (error) {
    services.database = "error";
  }

  const overallStatus = Object.values(services).every(
    (s) => s === "running" || s === "connected" || s === "not_configured",
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

// Webhook routes (needs to be before tRPC)
app.use("/api/webhooks", webhookRouter);

// Email analysis routes
app.use("/api/email-analysis", emailAnalysisRouter);

// Email assignment routes
app.use("/api/email-assignment", emailAssignmentRouter);

// tRPC middleware
app.use(
  "/trpc",
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

// Register default cleanup tasks
registerDefaultCleanupTasks();

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);

  // Start WebSocket health monitoring
  wsService.startHealthMonitoring(30000); // Every 30 seconds
  logger.info("WebSocket health monitoring started", "WEBSOCKET");
});

// WebSocket server for subscriptions
const wss = new WebSocketServer({
  port: PORT + 1,
  path: "/trpc-ws",
  // Add origin validation
  verifyClient: (info: { origin?: string }) => {
    const origin = info.origin;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
    ];
    // Allow connections without origin (like direct WebSocket clients)
    if (!origin) return true;
    return allowedOrigins.includes(origin);
  },
});

const wsHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req }: { req: any }) =>
    createContext({
      req: req as any,
      res: {
        json: () => {},
        status: () => ({ json: () => {} }),
        send: () => {},
      } as any,
    }),
});

console.log(
  `🔌 WebSocket server running on ws://localhost:${PORT + 1}/trpc-ws`,
);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received, starting graceful shutdown...`);
  logger.info("Shutdown initiated", "SHUTDOWN", { signal });

  // Stop accepting new connections
  server.close(() => {
    console.log("HTTP server closed");
    logger.info("HTTP server closed", "SHUTDOWN");
  });

  // Close WebSocket connections
  wsHandler.broadcastReconnectNotification();
  wss.close(() => {
    console.log("WebSocket server closed");
    logger.info("WebSocket server closed", "SHUTDOWN");
  });

  // Cleanup services
  try {
    // Stop WebSocket health monitoring
    wsService.stopHealthMonitoring();
    logger.info("WebSocket health monitoring stopped", "SHUTDOWN");

    // Execute all registered cleanup tasks
    await cleanupManager.cleanup();

    // Add a small delay to allow pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info("All services cleaned up successfully", "SHUTDOWN");

    // Exit the process
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown", "SHUTDOWN", { error });
    process.exit(1);
  }
};

// Handle different termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", "CRITICAL", { error });
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection", "CRITICAL", { reason, promise });
  gracefulShutdown("UNHANDLED_REJECTION");
});

export { app, server, wss };
