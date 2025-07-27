import { config } from "dotenv";
config(); // Load environment variables

import express from "express";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./trpc/context";
import { appRouter } from "./trpc/router";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import appConfig from "../config/app.config";
import ollamaConfig from "../config/ollama.config";
import type { Express } from "express";
import { apiRateLimiter, authRateLimiter, uploadRateLimiter, websocketRateLimit, getRateLimitStatus, cleanupRateLimiting } from "./middleware/rateLimiter";
import { authenticateToken, AuthenticatedRequest } from "../../middleware/auth";
import { wsService } from "./services/WebSocketService";
import { logger } from "../utils/logger";
import uploadRoutes from "./routes/upload.routes";
import { webhookRouter } from "./routes/webhook.router";
import { emailAnalysisRouter } from "./routes/email-analysis.router";
import emailAssignmentRouter from "./routes/email-assignment.router";
import csrfRouter from "./routes/csrf.router";
import {
  cleanupManager,
  registerDefaultCleanupTasks,
} from "./services/ServiceCleanupManager";
import { setupWalmartWebSocket } from "./websocket/walmart-updates";
import { DealDataService } from "./services/DealDataService";
import { EmailStorageService } from "./services/EmailStorageService";
import { applySecurityHeaders } from "./middleware/security/headers";

const app: Express = express();
const PORT = appConfig.api.port;

// Trust proxy for accurate IP addresses in rate limiting
app.set('trust proxy', 1);

// Apply comprehensive security headers (includes CORS)
applySecurityHeaders(app, {
  cors: {
    origins: appConfig.api.cors.origin as string[],
    credentials: appConfig.api.cors.credentials
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser()); // Enable cookie parsing for CSRF tokens

// Authentication middleware (runs before rate limiting to enable user-aware limits)
app.use(authenticateToken);

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
    const chromaUrl = process.env.CHROMA_URL || "http://localhost:8001";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const chromaResponse = await fetch(`${chromaUrl}/api/v1/heartbeat`, {
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
    services: {
      ...services,
      rateLimit: 'active',
      redis: process.env.REDIS_HOST ? 'configured' : 'memory_fallback'
    },
  });
});

// Rate limit status endpoint for debugging (admin only)
app.get('/api/rate-limit-status', async (req: AuthenticatedRequest, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    
    // Only allow admins to check rate limit status
    if (!authReq.user?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const status = await getRateLimitStatus(req);
    res.json(status);
  } catch (error) {
    console.error('Rate limit status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Authentication routes with strict rate limiting
app.use("/auth", authRateLimiter);
app.use("/api/auth", authRateLimiter);

// File upload routes with strict rate limiting (before tRPC to handle multipart forms)
app.use("/upload", uploadRateLimiter);
app.use("/api/upload", uploadRateLimiter);
app.use("/api", uploadRoutes);

// CSRF routes (no auth required for token fetching)
app.use("/api", csrfRouter);

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

// WebSocket server for subscriptions with enhanced security
const wss = new WebSocketServer({
  port: PORT + 1,
  path: "/trpc-ws",
  // Add origin validation and rate limiting
  verifyClient: (info: { origin?: string; req: any }) => {
    const origin = info.origin;
    
    // Get allowed origins from environment or use defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || 
      process.env.CORS_ORIGIN?.split(',') || [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:5175'
      ];
    
    // Add production origins if configured
    if (process.env.NODE_ENV === 'production' && process.env.PRODUCTION_ORIGINS) {
      allowedOrigins.push(...process.env.PRODUCTION_ORIGINS.split(','));
    }
    
    // Allow connections without origin (like direct WebSocket clients)
    if (!origin) return true;
    
    // Check origin
    if (!allowedOrigins.includes(origin)) {
      logger.warn('WebSocket connection rejected - invalid origin', 'SECURITY', {
        origin,
        allowedOrigins
      });
      return false;
    }
    
    return true;
  },
});

// Apply rate limiting to WebSocket connections
wss.on('connection', async (ws, req) => {
  try {
    // Create a mock Express request for rate limiting
    const mockReq = {
      ip: req.socket.remoteAddress,
      path: '/ws',
      method: 'GET',
      headers: req.headers,
      connection: req.socket,
      user: null // WebSocket connections start anonymous
    } as any;
    
    const mockRes = {
      status: () => mockRes,
      json: () => {},
      end: () => {}
    } as any;
    
    // Check WebSocket rate limit
    await new Promise<void>((resolve, reject) => {
      websocketRateLimit(mockReq, mockRes, (err?: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
    console.log('WebSocket connection established:', {
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.warn('WebSocket rate limit exceeded:', {
      ip: req.socket.remoteAddress,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    ws.close(1008, 'Rate limit exceeded');
    return;
  }
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

// Setup Walmart-specific WebSocket handlers
const dealDataService = DealDataService.getInstance();
const emailStorageService = new EmailStorageService();
const walmartRealtimeManager = setupWalmartWebSocket(
  wss,
  dealDataService,
  emailStorageService,
);

// Register Walmart realtime manager for cleanup
cleanupManager.register({
  name: "walmart-realtime",
  cleanup: async () => {
    walmartRealtimeManager.cleanup();
  },
  priority: 5,
});

console.log(`🛒 Walmart WebSocket handlers initialized`);

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

    // Cleanup rate limiting resources
    await cleanupRateLimiting();
    logger.info("Rate limiting resources cleaned up", "SHUTDOWN");

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
