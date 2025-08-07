import { config } from "dotenv";
config(); // Load environment variables

import CredentialManager from "../config/CredentialManager.js";
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/router.js";
import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import appConfig from "../config/app.config.js";
import ollamaConfig from "../config/ollama.config.js";
import type { Express } from "express";
import {
  apiRateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  websocketRateLimit,
  getRateLimitStatus,
  cleanupRateLimiting,
} from "./middleware/rateLimiter.js";
import {
  optionalAuthenticateJWT as authenticateToken,
  type AuthenticatedRequest,
} from "./middleware/auth.js";
import { wsService } from "./services/WebSocketService.js";
import { logger } from "../utils/logger.js";
import uploadRoutes from "./routes/upload.routes.js";
import { webhookRouter } from "./routes/webhook.router.js";
import { emailAnalysisRouter } from "./routes/email-analysis.router.js";
import emailAssignmentRouter from "./routes/email-assignment.router.js";
import csrfRouter from "./routes/csrf.router.js";
import websocketMonitorRouter from "./routes/websocket-monitor.router.js";
import metricsRouter from "./routes/metrics.router.js";
import {
  cleanupManager,
  registerDefaultCleanupTasks,
} from "./services/ServiceCleanupManager.js";
import { setupWalmartWebSocket } from "./websocket/walmart-updates.js";
import { DealDataService } from "./services/DealDataService.js";
import { EmailStorageService } from "./services/EmailStorageService.js";
import { applySecurityHeaders } from "./middleware/security/headers.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { 
  initializeCredentials, 
  ensureCredentialsInitialized,
  credentialHealthCheck 
} from "./middleware/security/credential-validation.js";
import { GracefulShutdown } from "../utils/error-handling/server.js";
import {
  requestTracking,
  errorTracking,
  requestSizeTracking,
  rateLimitTracking,
  authTracking,
} from "./middleware/monitoring.js";
import monitoringRouter from "./routes/monitoring.router.js";
import emailPipelineHealthRouter from "./routes/email-pipeline-health.router.js";
import circuitBreakerRouter from "./routes/circuit-breaker.router.js";

import { errorTracker } from "../monitoring/ErrorTracker.js";

const app: Express = express();
const gracefulShutdown = new GracefulShutdown();
const PORT = appConfig.api.port;

// Add error listener to prevent crashes
errorTracker.on("error", () => {
  // Silently handle error events to prevent unhandled error exceptions
});

// Trust proxy for accurate IP addresses in rate limiting
app.set("trust proxy", 1);

// Apply comprehensive security headers (includes CORS)
applySecurityHeaders(app, {
  cors: {
    origins: appConfig.api.cors.origin as string[],
    credentials: appConfig.api.cors.credentials,
  },
});

// Add response compression (Performance Optimization - 60-70% bandwidth reduction)
app.use(compression({
  filter: (req, res) => {
    // Don't compress if client explicitly requests no compression
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Compress all responses by default for JSON/text content
    return compression.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6 // Balanced compression level (1=fast, 9=best compression)
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser()); // Enable cookie parsing for CSRF tokens

// Monitoring middleware (must be early in the chain)
app.use(requestTracking);
app.use(requestSizeTracking);
app.use(rateLimitTracking);
app.use(authTracking);

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
    services: {
      ...services,
      rateLimit: "active",
      redis: process.env.REDIS_HOST ? "configured" : "memory_fallback",
    },
  });
});

// Rate limit status endpoint for debugging (admin only)
app.get("/api/rate-limit-status", async (req: AuthenticatedRequest, res) => {
  try {
    const authReq = req as AuthenticatedRequest;

    // Only allow admins to check rate limit status
    if (!authReq.user || authReq.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const status = await getRateLimitStatus(req);
    return res.json(status);
  } catch (error) {
    console.error("Rate limit status error:", error);
    return res.status(500).json({ error: "Internal server error" });
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

// Analyzed emails routes (simple direct database access)
import analyzedEmailsRouter from "./routes/analyzed-emails.router.js";
app.use("/", analyzedEmailsRouter);

// WebSocket monitoring routes (authenticated)
app.use("/api/websocket", websocketMonitorRouter);

// Monitoring routes
app.use("/api/monitoring", monitoringRouter);

// Circuit Breaker monitoring and control
app.use("/api/circuit-breaker", circuitBreakerRouter);

// Email pipeline health routes
app.use("/api/health", emailPipelineHealthRouter);

// Add credential health endpoint
app.get("/api/health/credentials", credentialHealthCheck);
app.use("/api/metrics", metricsRouter);

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

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorTracking); // Add monitoring error tracking before the default error handler
app.use(errorHandler);

// Register default cleanup tasks
registerDefaultCleanupTasks();

// Register graceful shutdown handlers
gracefulShutdown.register(async () => {
  logger.info("Shutting down HTTP server...");
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

gracefulShutdown.register(async () => {
  logger.info("Shutting down WebSocket server...");
  wss.close();
  wsService.shutdown();
});

gracefulShutdown.register(async () => {
  logger.info("Running cleanup tasks...");
  await cleanupManager.cleanup();
});

// Setup graceful shutdown signal handlers
gracefulShutdown.setupSignalHandlers();

// Initialize credentials and start HTTP server
const server = app.listen(PORT, async () => {
  try {
    // Initialize credentials on server start
    await initializeCredentials();
    
    console.log(`🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📡 tRPC endpoint: http://localhost:${PORT}/trpc`);
    console.log(`🏥 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Credential health: http://localhost:${PORT}/api/health/credentials`);

    // Start WebSocket health monitoring
    wsService.startHealthMonitoring(30000); // Every 30 seconds
    logger.info("WebSocket health monitoring started", "WEBSOCKET");
  } catch (error) {
    console.error('❌ Failed to initialize credentials:', error);
    console.error('🔧 Run: node scripts/setup-security.js for help');
    process.exit(1);
  }
});

// WebSocket server for subscriptions with enhanced security
const wss = new WebSocketServer({
  port: PORT + 1,
  path: "/trpc-ws",
  // Add origin validation and rate limiting
  verifyClient: (info: { origin?: string; req: any }) => {
    const origin = info.origin;

    // Get allowed origins from environment or use defaults
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") ||
      process.env.CORS_ORIGIN?.split(",") || [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
      ];

    // Add production origins if configured
    if (
      process.env.NODE_ENV === "production" &&
      process.env.PRODUCTION_ORIGINS
    ) {
      allowedOrigins.push(...process.env.PRODUCTION_ORIGINS.split(","));
    }

    // Allow connections without origin (like direct WebSocket clients)
    if (!origin) return true;

    // Check origin
    if (!allowedOrigins.includes(origin)) {
      logger.warn(
        "WebSocket connection rejected - invalid origin",
        "SECURITY",
        {
          origin,
          allowedOrigins,
        },
      );
      return false;
    }

    return true;
  },
});

// Apply rate limiting to WebSocket connections
wss.on("connection", async (ws, req) => {
  try {
    // Create a mock Express request for rate limiting
    const mockReq = {
      ip: req.socket.remoteAddress,
      path: "/ws",
      method: "GET",
      headers: req.headers,
      connection: req.socket,
      user: null, // WebSocket connections start anonymous
    } as any;

    const mockRes = {
      status: () => mockRes,
      json: () => {},
      end: () => {},
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

    console.log("WebSocket connection established:", {
      ip: req.socket.remoteAddress,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("WebSocket rate limit exceeded:", {
      ip: req.socket.remoteAddress,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    ws.close(1008, "Rate limit exceeded");
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
// Use the RealEmailStorageService for Walmart WebSocket
import { realEmailStorageService } from "./services/RealEmailStorageService.js";
const emailStorageService = realEmailStorageService as any;
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

// Note: Graceful shutdown is now handled by the GracefulShutdown class
// which prevents duplicate signal handler registration and infinite loops

export { app, server, wss };
