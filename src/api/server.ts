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
import type { Express } from "express";
import { apiRateLimiter } from "./middleware/rateLimiter";

const app: Express = express();
const PORT = appConfig.api.port;

// Middleware
app.use(helmet());
app.use(cors(appConfig.api.cors));
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

    const ollamaResponse = await fetch(
      `${appConfig.ollama?.baseUrl || "http://localhost:11434"}/api/tags`,
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
        `${appConfig.rag.vectorStore.baseUrl}/api/v1/heartbeat`,
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

// tRPC middleware
app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, type, path, input }) {
      console.error("tRPC Error:", {
        type,
        path,
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

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

// WebSocket server for subscriptions
const wss = new WebSocketServer({
  port: PORT + 1,
  path: "/trpc-ws",
});

const wsHandler = applyWSSHandler({
  wss,
  router: appRouter,
  createContext: ({ req }) =>
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
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...");

  wsHandler.broadcastReconnectNotification();

  server.close(() => {
    console.log("HTTP server closed");
  });

  wss.close(() => {
    console.log("WebSocket server closed");
  });
});

export { app, server, wss };
