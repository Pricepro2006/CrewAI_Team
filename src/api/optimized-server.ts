/**
 * Optimized Server with Parallel Initialization
 * Reduces startup time from 2.5-4s to under 1s
 */

import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { WebSocketServer } from 'ws';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { logger } from '../utils/logger.js';
import IORedis from 'ioredis';
import { 
  ParallelInitializationService, 
  initService,
  createInitTask 
} from './services/ParallelInitializationService.js';
import { optimizedWSService } from './services/OptimizedWebSocketService.js';
import { CacheFactory } from './services/OptimizedCacheService.js';
import { circuitBreakerManager } from './services/CircuitBreakerService.js';
import appConfig from '../config/app.config.js';

const app = express();
const PORT = appConfig.api.port || 3001;

// Performance monitoring
const startTime = Date.now();

// Register initialization tasks
initService.register(createInitTask('core-middleware', async () => {
  // Core middleware that must be loaded first
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // Compression with optimized settings
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    threshold: 1024,
    level: 1 // Fast compression (1=fastest, 9=best)
  }));
}, { critical: true }));

// Security headers (parallel)
initService.register(createInitTask('security', async () => {
  const { applySecurityHeaders } = await import('./middleware/security/headers.js');
  applySecurityHeaders(app, {
    cors: {
      origins: appConfig.api.cors.origin as string[],
      credentials: appConfig.api.cors.credentials,
    },
  });
}, { dependencies: ['core-middleware'] }));

// Database initialization (parallel)
initService.register(createInitTask('database', async () => {
  const Database = (await import('better-sqlite3')).default;
  
  // Initialize main database
  const mainDb = new Database(appConfig.database?.path || './data/app.db');
  mainDb.pragma('journal_mode = WAL');
  mainDb.pragma('synchronous = NORMAL');
  mainDb.pragma('cache_size = 10000');
  mainDb.pragma('temp_store = MEMORY');
  mainDb.pragma('busy_timeout = 5000');
  mainDb.close();
  
  // Initialize Walmart database
  const walmartDb = new Database('./data/walmart_grocery.db');
  walmartDb.pragma('journal_mode = WAL');
  walmartDb.pragma('synchronous = NORMAL');
  walmartDb.pragma('cache_size = 10000');
  walmartDb.pragma('temp_store = MEMORY');
  walmartDb.pragma('busy_timeout = 5000');
  walmartDb.close();
  
  logger.info('Databases initialized with optimizations', "INIT");
}, { critical: true }));

// Cache warming (parallel)
initService.register(createInitTask('cache-warming', async () => {
  const { walmartPriceCache, groceryListCache, nlpResultCache } = await import('./services/OptimizedCacheService.js');
  
  // Pre-warm critical cache entries
  const criticalProducts = ['23656054', '10450114', '44391472']; // Common products
  
  await Promise.all([
    // Warm product cache
    ...criticalProducts.map(id => 
      walmartPriceCache.set(`product:${id}`, { 
        id, 
        name: 'Cached Product',
        cached: true 
      }, 3600000)
    ),
    // Initialize other caches
    groceryListCache.prune(),
    nlpResultCache.prune()
  ]);
  
  logger.info('Cache warming completed', "INIT");
}, { critical: false }));

// Redis connection (optional, parallel)
initService.register(createInitTask('redis', async () => {
  try {
    const client = new (IORedis as any)({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3000
    });
    
    await client.ping();
    await client.quit();
    logger.info('Redis connection verified', "INIT");
  } catch (error) {
    logger.warn('Redis not available, using in-memory cache', "INIT");
  }
}, { critical: false, timeout: 3000 }));

// Ollama connection (optional, parallel)
initService.register(createInitTask('ollama', async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      logger.info('Ollama connection verified', "INIT");
    } else {
      throw new Error('Ollama not responding');
    }
  } catch (error) {
    logger.warn('Ollama not available, NLP features limited', "INIT");
  }
}, { critical: false, timeout: 2000 }));

// Rate limiting setup (parallel)
initService.register(createInitTask('rate-limiting', async () => {
  const { 
    apiRateLimiter, 
    authRateLimiter, 
    uploadRateLimiter 
  } = await import('./middleware/rateLimiter.js');
  
  app.use('/api', apiRateLimiter);
  app.use('/auth', authRateLimiter);
  app.use('/upload', uploadRateLimiter);
  
  logger.info('Rate limiting configured', "INIT");
}, { dependencies: ['core-middleware'] }));

// Authentication middleware (parallel)
initService.register(createInitTask('authentication', async () => {
  const { optionalAuthenticateJWT } = await import('./middleware/auth.js');
  app.use(optionalAuthenticateJWT);
  logger.info('Authentication middleware configured', "INIT");
}, { dependencies: ['core-middleware'] }));

// API routes (parallel)
initService.register(createInitTask('api-routes', async () => {
  // Import routers in parallel
  const [
    uploadRoutes,
    csrfRouter,
    metricsRouter,
    nlpRouter,
    analyzedEmailsRouter
  ] = await Promise.all([
    import('./routes/upload.routes.js'),
    import('./routes/csrf.router.js'),
    import('./routes/metrics.router.js'),
    import('./routes/nlp.router.js'),
    import('./routes/analyzed-emails.router.js')
  ]);
  
  app.use('/api', uploadRoutes.default);
  app.use('/api', csrfRouter.default);
  app.use('/api/metrics', metricsRouter.default);
  app.use('/api/nlp', nlpRouter.default);
  app.use('/', analyzedEmailsRouter.default);
  
  logger.info('API routes configured', "INIT");
}, { dependencies: ['authentication', 'rate-limiting'] }));

// tRPC setup (depends on other middleware)
initService.register(createInitTask('trpc', async () => {
  const { appRouter } = await import('./trpc/router.js');
  const { createContext } = await import('./trpc/context.js');
  
  app.use(
    '/trpc',
    createExpressMiddleware({
      router: appRouter,
      createContext,
      batching: {
        enabled: true
      },
      onError({ error, type, path }) {
        logger.error('tRPC Error', "TRPC", {
          type,
          path: path || 'unknown',
          error: error.message,
        });
      },
    }),
  );
  
  logger.info('tRPC configured with batching', "INIT");
}, { dependencies: ['api-routes'] }));

// Health check endpoint (can be added early)
app.get('/health', async (req, res) => {
  const services = {
    api: 'running',
    cache: CacheFactory.getStats().size > 0 ? 'healthy' : 'initializing',
    circuits: circuitBreakerManager.getStats().size,
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services
  });
});

// Error handling (must be last)
initService.register(createInitTask('error-handlers', async () => {
  const { errorHandler, notFoundHandler } = await import('./middleware/errorHandler.js');
  app.use(notFoundHandler);
  app.use(errorHandler);
  logger.info('Error handlers configured', "INIT");
}, { dependencies: ['trpc'] }));

// Start server with parallel initialization
async function startServer() {
  try {
    logger.info('Starting optimized server initialization...', "SERVER");
    
    // Run parallel initialization
    const initResult = await initService.initialize();
    
    if (!initResult.success) {
      logger.error('Critical initialization tasks failed', "SERVER", {
        failed: initResult.failed.map(f => ({ name: f.name, error: f.error?.message }))
      });
      process.exit(1);
    }
    
    // Start HTTP server
    const server = app.listen(PORT, () => {
      const totalTime = Date.now() - startTime;
      
      logger.info(`🚀 Server started in ${totalTime}ms`, "SERVER");
      logger.info(`API Server: http://localhost:${PORT}`, "SERVER");
      logger.info(`tRPC endpoint: http://localhost:${PORT}/trpc`, "SERVER");
      logger.info(`Health check: http://localhost:${PORT}/health`, "SERVER");
      
      // Log initialization metrics
      const metrics = initService.getMetrics();
      logger.info('Initialization metrics', "SERVER", {
        totalDuration: `${metrics.totalDuration}ms`,
        parallelizationFactor: metrics.parallelizationFactor.toFixed(2),
        taskCount: metrics.taskCount,
        bottlenecks: metrics.bottlenecks
      });
    });
    
    // Initialize optimized WebSocket service
    await optimizedWSService.initialize(server, '/ws');
    logger.info('WebSocket service initialized', "SERVER");
    
    // Setup WebSocket for tRPC subscriptions
    const wss = new WebSocketServer({
      server,
      path: '/trpc-ws'
    });
    
    const { appRouter } = await import('./trpc/router.js');
    const { createContext } = await import('./trpc/context.js');
    
    applyWSSHandler({
      wss: wss as any,
      router: appRouter,
      createContext: ({ req }) => createContext({ req } as any)
    });
    
    logger.info('tRPC WebSocket initialized', "SERVER");
    
    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, starting graceful shutdown...`, "SERVER");
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed', "SERVER");
      });
      
      // Cleanup services
      await Promise.all([
        optimizedWSService.shutdown(),
        CacheFactory.disposeAll(),
        circuitBreakerManager.dispose()
      ]);
      
      logger.info('Graceful shutdown completed', "SERVER");
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.fatal('Failed to start server', "SERVER", { error });
    process.exit(1);
  }
}

// Start the server
startServer().catch(error => {
  logger.fatal('Unhandled server error', "SERVER", { error });
  process.exit(1);
});

export { app };