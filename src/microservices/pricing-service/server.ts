import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { PricingService } from './PricingService.js';
import { PricingRouter } from './PricingRouter.js';
import { config } from 'dotenv';

// Load environment variables
config();

const app = express();
const PORT = process.env.PRICING_SERVICE_PORT || 3003;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Initialize pricing service with configuration
const pricingService = new PricingService({
  cache: {
    memory: {
      maxSize: parseInt(process.env.MEMORY_CACHE_SIZE || '10000'),
      ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300')
    },
    redis: {
      ttl: parseInt(process.env.REDIS_CACHE_TTL || '3600'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'price:'
    },
    sqlite: {
      ttl: parseInt(process.env.SQLITE_CACHE_TTL || '86400'),
      tableName: 'price_cache'
    }
  },
  api: {
    baseUrl: process.env.WALMART_API_URL || 'https://api.walmart.com',
    apiKey: process.env.WALMART_API_KEY || '',
    rateLimit: parseInt(process.env.API_RATE_LIMIT || '10'),
    timeout: parseInt(process.env.API_TIMEOUT || '5000'),
    retries: parseInt(process.env.API_RETRIES || '3')
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  sqlitePath: process.env.SQLITE_PATH || './data/price_cache.db'
});

// Initialize router
const pricingRouter = new PricingRouter(pricingService);

// Mount pricing routes
app.use('/api/pricing', pricingRouter.getRouter());

// Root health check
app.get('/', (req, res) => {
  res.json({
    service: 'pricing-microservice',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Create HTTP server
const server = createServer(app);

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  
  server.close(() => {
    console.log('HTTP server closed');
  });

  try {
    await pricingRouter.shutdown();
    console.log('Pricing service closed');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start server
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║         Pricing Microservice Started           ║
╠════════════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(40)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(33)}║
║  Cache Layers:                                 ║
║    • Memory (L1): ${process.env.MEMORY_CACHE_SIZE || '10000'} items, ${process.env.MEMORY_CACHE_TTL || '300'}s TTL      ║
║    • Redis (L2): ${process.env.REDIS_CACHE_TTL || '3600'}s TTL                   ║
║    • SQLite (L3): ${process.env.SQLITE_CACHE_TTL || '86400'}s TTL                ║
║    • Walmart API (L4): Rate limited            ║
╚════════════════════════════════════════════════╝
  `);
});

export { server, pricingService };