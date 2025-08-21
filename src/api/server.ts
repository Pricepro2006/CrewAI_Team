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
import type { IncomingMessage } from "http";
import appConfig from "../config/app.config.js";
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
import databasePerformanceRouter from "./routes/database-performance.router.js";
import optimizationMetricsRouter from "./routes/optimization-metrics.router.js";
import { databaseManager } from "../core/database/DatabaseManager.js";
import {
  cleanupManager,
  registerDefaultCleanupTasks,
} from "./services/ServiceCleanupManager.js";
import { setupWalmartWebSocket } from "./websocket/walmart-updates.js";
import { walmartWSServer } from "./websocket/WalmartWebSocketServer.js";
import { DealDataService } from "./services/DealDataService.js";
import { emailProcessingWebSocket } from "./websocket/EmailProcessingWebSocket.js";
import { applySecurityHeaders } from "./middleware/security/headers.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { 
  initializeCredentials, 
  ensureCredentialsInitialized,
  credentialHealthCheck 
} from "./middleware/security/credential-validation.js";
import { csrfValidator } from "./middleware/csrfValidator.js";
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
const PORT = appConfig?.api?.port;

// Add error listener to prevent crashes
errorTracker.on("error", () => {
  // Silently handle error events to prevent unhandled error exceptions
});

// Trust proxy for accurate IP addresses in rate limiting
app.set("trust proxy", 1);

// CRITICAL: Cookie parser MUST be early in the middleware stack
// This ensures cookies are parsed before any middleware that needs them (CSRF, auth, etc.)
app.use(cookieParser()); // Enable cookie parsing for CSRF tokens

// Apply comprehensive security headers (includes CORS)
applySecurityHeaders(app, {
  cors: {
    origins: appConfig?.api?.cors.origin as string[],
    credentials: appConfig?.api?.cors.credentials,
  },
});

// Body parsers need to come after cookie parser but before routes
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Add response compression (Performance Optimization - 60-70% bandwidth reduction)
// Compression should come after parsers but before routes
app.use(compression({
  filter: (req: express.Request, res: express.Response) => {
    // Don't compress if client explicitly requests no compression
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Compress all responses by default for JSON/text content
    return compression?.filter(req, res);
  },
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6 // Balanced compression level (1=fast, 9=best compression)
}))

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
    // Check llama.cpp provider status
    const { LLMProviderFactory } = await import("../core/llm/LLMProviderFactory.js");
    const provider = LLMProviderFactory.getInstance();
    
    if (provider && provider.isReady && provider.isReady()) {
      services.ollama = "connected"; // Keep field name for compatibility but it's actually llama.cpp
    } else {
      services.ollama = "disconnected";
    }
  } catch (error) {
    services.ollama = "error";
  }

  try {
    // Check ChromaDB connection (if configured)
    const chromaUrl = process.env.CHROMA_BASE_URL || process.env.CHROMA_URL || "http://localhost:8000";
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
    const { default: Database } = await import("better-sqlite3") as any;
    const db = new Database(appConfig.database?.path || "./data/app.db", {
      readonly: true,
    });
    db.prepare("SELECT 1").get();
    db.close();
    services.database = "connected";
  } catch (error) {
    services.database = "error";
  }

  // ChromaDB is optional - system is healthy without it
  const criticalServices = {
    api: services.api,
    database: services.database,
    // ChromaDB and Ollama are optional enhancements
  };
  
  const overallStatus = Object.values(criticalServices).every(
    (s: any) => s === "running" || s === "connected",
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
    if (!authReq.user || authReq?.user?.role !== "admin") {
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
// MUST come before CSRF validator middleware
app.use("/api", csrfRouter);

// Apply CSRF validation to all state-changing operations
// This runs AFTER the CSRF token endpoints but BEFORE all other routes
app.use(csrfValidator([
  "/api/csrf-token",     // Skip CSRF endpoints themselves
  "/api/health",          // Skip health checks
  "/health",              // Skip root health check
  "/api/webhooks",        // Skip webhooks (they use different auth)
  "/api/rate-limit-status", // Skip rate limit status
  // "/trpc" - CSRF protection ENABLED for tRPC (security hardening)
]));

// Webhook routes (needs to be before tRPC)
app.use("/api/webhooks", webhookRouter);

// Email analysis routes
app.use("/api/email-analysis", emailAnalysisRouter);

// Email assignment routes
app.use("/api/email-assignment", emailAssignmentRouter);

// Analyzed emails routes (simple direct database access)
import analyzedEmailsRouter from "./routes/analyzed-emails.router.js";
app.use("/", analyzedEmailsRouter);

// NLP routes for Walmart Grocery (Qwen3:0.6b)
import nlpRouter from "./routes/nlp.router.js";
app.use("/api/nlp", nlpRouter);

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

// Database performance monitoring routes
app.use("/api/database", databasePerformanceRouter);

// Optimization metrics routes (for OptimizedQueryExecutor and CachedLLMProvider)
app.use("/api/optimization", optimizationMetricsRouter);

// Debug middleware for tRPC input issues
app.use("/trpc", (req, res, next) => {
  console.log("DEBUG - tRPC Request:", {
    method: req.method,
    path: req.path,
    body: req.body,
    bodyType: typeof req.body,
    hasBody: !!req.body,
    contentType: req.headers['content-type'],
    contentLength: req.headers['content-length']
  });
  next();
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
  await new Promise<void>((resolve: any) => {
    server.close(() => resolve());
  });
});

gracefulShutdown.register(async () => {
  logger.info("Shutting down WebSocket servers...");
  wss.close();
  mainWSS.close();
  wsService.shutdown();
});

gracefulShutdown.register(async () => {
  logger.info("Shutting down Database Manager...");
  await databaseManager.closeAll();
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

    // Initialize Walmart WebSocket server on main port temporarily
    // The separate port 8080 server will be started by the websocket server script
    walmartWSServer.initialize(server, "/ws/walmart");
    console.log(`🛒 Walmart WebSocket: ws://localhost:${PORT}/ws/walmart`);

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
// Using HTTP upgrade on same port instead of separate port
const wss = new WebSocketServer({
  noServer: true,  // Don't create a separate server
  path: "/trpc-ws",
  // Add origin validation and rate limiting
  verifyClient: (info: { origin?: string; req: any }) => {
    const origin = info?.origin;

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
      ip: req?.socket?.remoteAddress,
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
      setHeader: () => {},
      getHeader: () => null,
      headersSent: false,
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
      ip: req?.socket?.remoteAddress,
      userAgent: req.headers["user-agent"],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("WebSocket rate limit exceeded:", {
      ip: req?.socket?.remoteAddress,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    ws.close(1008, "Rate limit exceeded");
    return;
  }
});

const wsHandler = applyWSSHandler({
  wss: wss as any,
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

// Create dedicated WebSocket server for /ws endpoint on same port
const mainWSS = new WebSocketServer({
  noServer: true,
  path: '/ws',
  perMessageDeflate: true,
  maxPayload: 1024 * 1024 // 1MB
});

// Setup main WebSocket connection handling
mainWSS.on('connection', (ws, request) => {
  const clientId = `main_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Register with WebSocket service
  wsService.registerClient(clientId, ws as any);
  
  // Subscribe to all message types for main WebSocket
  wsService.subscribe(clientId, ['*']);
  
  logger.info(`Main WebSocket connection established: ${clientId}`, 'WEBSOCKET');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    connectionId: clientId,
    serverTime: Date.now(),
    message: 'Connected to main WebSocket server'
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      logger.info(`Main WebSocket message received:`, 'WEBSOCKET', message);
      
      // Handle subscription requests
      if (message.type === 'subscribe' && message.topics) {
        wsService.subscribe(clientId, message.topics);
        ws.send(JSON.stringify({
          type: 'subscription_confirmed',
          topics: message.topics,
          timestamp: Date.now()
        }));
      }
      
      // Echo other messages back with timestamp
      if (message.type !== 'subscribe') {
        ws.send(JSON.stringify({
          type: 'echo',
          originalMessage: message,
          serverTimestamp: Date.now(),
          connectionId: clientId
        }));
      }
    } catch (error) {
      logger.error('Error processing main WebSocket message:', 'WEBSOCKET', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  });
  
  ws.on('close', () => {
    logger.info(`Main WebSocket connection closed: ${clientId}`, 'WEBSOCKET');
    wsService.unregisterClient(clientId, ws as any);
  });
  
  ws.on('error', (error) => {
    logger.error(`Main WebSocket error for ${clientId}:`, 'WEBSOCKET', error);
  });
});

// Handle HTTP upgrade for WebSocket connections on the same port
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url || '';
  
  logger.info(`HTTP upgrade request for path: ${pathname}`, 'WEBSOCKET');
  
  if (pathname === '/trpc-ws') {
    // Verify client before upgrading
    const verifyClient = wss.options.verifyClient;
    const clientInfo = { 
      origin: request.headers.origin || '', 
      secure: (request.connection as any)?.encrypted || false,
      req: request 
    };
    
    if (verifyClient) {
      let result: boolean = true;
      if (typeof verifyClient === 'function') {
        // Handle both sync and async verifyClient
        try {
          const verifyResult = verifyClient(clientInfo, (res: boolean) => {
            result = res;
          });
          // If verifyClient returns a value directly (sync), use it
          if (typeof verifyResult === 'boolean') {
            result = verifyResult;
          }
        } catch (error) {
          logger.error('Error in verifyClient function:', 'WEBSOCKET', error as Error);
          result = false;
        }
      }
      
      if (!result) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }
    
    wss.handleUpgrade(request, socket, head, (ws: any) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws') {
    // Handle main WebSocket connections directly on same port
    logger.info('Handling /ws WebSocket connection on main port', 'WEBSOCKET');
    
    // Apply rate limiting
    const mockReq = {
      ip: request.socket.remoteAddress,
      path: "/ws",
      method: "GET",
      headers: request.headers,
      connection: request.socket,
      user: null,
    } as any;

    const mockRes = {
      status: () => mockRes,
      json: () => {},
      end: () => {},
      setHeader: () => {},
      getHeader: () => null,
      headersSent: false,
    } as any;

    // Check WebSocket rate limit
    websocketRateLimit(mockReq, mockRes, (err?: any) => {
      if (err) {
        logger.warn("WebSocket rate limit exceeded for /ws:", 'WEBSOCKET', {
          ip: request.socket.remoteAddress,
          error: err.message,
        });
        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
        socket.destroy();
        return;
      }
      
      // Proceed with WebSocket upgrade
      mainWSS.handleUpgrade(request, socket, head, (ws: any) => {
        mainWSS.emit('connection', ws, request);
      });
    });
  } else if (pathname === '/ws/walmart') {
    // Handle Walmart WebSocket upgrades
    if (walmartWSServer && 'handleUpgrade' in walmartWSServer && typeof walmartWSServer.handleUpgrade === 'function') {
      walmartWSServer.handleUpgrade(request, socket, head);
    } else {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
    }
  } else if (pathname === '/ws/email') {
    // Handle Email WebSocket upgrades - use main WebSocket for now
    // TODO: Implement dedicated email WebSocket handler
    mainWSS.handleUpgrade(request, socket, head, (ws: any) => {
      mainWSS.emit('connection', ws, request);
    });
  } else {
    // Reject unknown WebSocket requests
    logger.warn(`Unknown WebSocket path: ${pathname}`, 'WEBSOCKET');
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

console.log(
  `🔌 WebSocket endpoints available:`,
);
console.log(
  `   📡 Main WebSocket: ws://localhost:${PORT}/ws`,
);
console.log(
  `   🔧 tRPC WebSocket: ws://localhost:${PORT}/trpc-ws`,
);
console.log(
  `   🛒 Walmart WebSocket: ws://localhost:${PORT}/ws/walmart`,
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

// Initialize Email Processing WebSocket
emailProcessingWebSocket.initialize(wss as any);

// Register email processing WebSocket for cleanup
cleanupManager.register({
  name: "email-processing-websocket",
  cleanup: async () => {
    emailProcessingWebSocket.shutdown();
  },
  priority: 4,
});

console.log(`📧 Email Processing WebSocket initialized`);

// Note: Graceful shutdown is now handled by the GracefulShutdown class
// which prevents duplicate signal handler registration and infinite loops

export { app, server, wss };
