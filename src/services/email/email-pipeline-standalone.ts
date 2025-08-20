#!/usr/bin/env node

/**
 * Standalone Email Pipeline Service
 * Production-ready service for processing emails through the adaptive 3-phase pipeline
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer } from 'http';
import { logger } from '../../utils/logger.js';
import { EmailQueueProcessor } from '../../core/processors/EmailQueueProcessor.js';
import { EmailStorageService } from '../../api/services/EmailStorageService.js';
import { OptimizedEmailProcessingService } from '../../api/services/OptimizedEmailProcessingService.js';
import { getDatabaseConnection } from '../../database/connection.js';
import { apiRateLimiter } from '../../api/middleware/rateLimiter.js';
import { requestTracking } from '../../api/middleware/monitoring.js';

const app = express();
const PORT = parseInt(process.env.EMAIL_PIPELINE_PORT || '3456', 10);
const HOST = process.env.EMAIL_PIPELINE_HOST || '0.0.0.0';

// Global error handlers
process.on('uncaughtException', (error: any) => {
  logger.error('Uncaught Exception', 'PROCESS', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', 'PROCESS', { reason, promise });
  process.exit(1);
});

// Services
let queueProcessor: EmailQueueProcessor;
let emailStorage: EmailStorageService;
let emailProcessing: OptimizedEmailProcessingService;
let server: ReturnType<typeof createServer>;

// Middleware setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking and rate limiting
app.use(requestTracking);
app.use(apiRateLimiter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.2.1',
      service: 'email-pipeline',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      checks: {
        database: false,
        queue: false,
        ollama: false,
      }
    };

    // Check database
    try {
      const db = getDatabaseConnection();
      const result = db.prepare('SELECT 1').get();
      if (health.checks) {
        health.checks.database = true;
      }
    } catch (error) {
      logger.warn('Database health check failed', 'HEALTH', { error });
    }

    // Check queue processor
    if (queueProcessor && health.checks) {
      health.checks.queue = queueProcessor.isHealthy();
    }

    // Check Ollama (basic connectivity)
    try {
      const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (health.checks) {
        health.checks.ollama = response.ok;
      }
    } catch (error) {
      logger.warn('Ollama health check failed', 'HEALTH', { error });
    }

    const allHealthy = Object.values(health.checks).every(check => check === true);
    
    res.status(allHealthy ? 200 : 503).json(health);
  } catch (error) {
    logger.error('Health check failed', 'HEALTH', { error });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Status endpoint
app.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'email-pipeline',
      version: '2.2.1',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      configuration: {
        phases: {
          phase1: process.env.ENABLE_PHASE1 !== 'false',
          phase2: process.env.ENABLE_PHASE2 !== 'false',
          phase3: process.env.ENABLE_PHASE3 !== 'false',
        },
        models: {
          primary: process.env.OLLAMA_MODEL || 'llama3.2:3b',
          fallback: 'llama3.2:3b',
        },
        processing: {
          batchSize: parseInt(process.env.EMAIL_PROCESSING_BATCH_SIZE || '50'),
          concurrentLimit: parseInt(process.env.EMAIL_PROCESSING_CONCURRENT_LIMIT || '10'),
        }
      },
      queue: queueProcessor ? await queueProcessor.getQueueStats() : null,
    };

    res.json(status);
  } catch (error) {
    logger.error('Status check failed', 'STATUS', { error });
    res.status(500).json({
      error: 'Status check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Metrics endpoint (basic)
app.get('/metrics', async (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      cpu_usage: process.cpuUsage(),
      queue_stats: queueProcessor ? await queueProcessor.getQueueStats() : null,
      processing_stats: emailProcessing ? await emailProcessing.getProcessingStats() : null,
    };

    res.json(metrics);
  } catch (error) {
    logger.error('Metrics check failed', 'METRICS', { error });
    res.status(500).json({
      error: 'Metrics unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// API endpoint to trigger manual processing
app.post('/api/process-emails', async (req, res) => {
  try {
    const { batchSize = 50, priority = 'medium' } = req.body;
    
    if (!queueProcessor) {
      res.status(503).json({
        error: 'Queue processor not initialized',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const jobId = await queueProcessor.addEmailProcessingJob({
      type: 'manual_batch',
      batchSize: Math.min(batchSize, 100), // Limit batch size
      priority,
      timestamp: new Date().toISOString(),
    });

    logger.info('Manual processing job queued', 'API', {
      jobId,
      batchSize,
      priority,
    });

    res.json({
      success: true,
      jobId,
      message: 'Email processing job queued successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to queue processing job', 'API', { error });
    res.status(500).json({
      error: 'Failed to queue processing job',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

// Initialize services
async function initializeServices() {
  logger.info('Initializing email pipeline services', 'STARTUP');

  try {
    // Initialize database connection
    logger.info('Connecting to database', 'STARTUP');
    getDatabaseConnection();
    logger.info('Database connected successfully', 'STARTUP');

    // Initialize storage service
    logger.info('Initializing email storage service', 'STARTUP');
    emailStorage = new EmailStorageService();
    logger.info('Email storage service initialized', 'STARTUP');

    // Initialize processing service
    logger.info('Initializing email processing service', 'STARTUP');
    emailProcessing = OptimizedEmailProcessingService.getInstance();
    logger.info('Email processing service initialized', 'STARTUP');

    // Initialize queue processor
    logger.info('Initializing queue processor', 'STARTUP');
    queueProcessor = new EmailQueueProcessor({
      concurrency: parseInt(process.env.EMAIL_PROCESSING_CONCURRENT_LIMIT || '10'),
      maxRetries: 3,
      retryDelay: 5000,
    });
    await queueProcessor.initialize();
    await queueProcessor.start();
    logger.info('Queue processor started successfully', 'STARTUP');

    logger.info('All services initialized successfully', 'STARTUP');
  } catch (error) {
    logger.error('Failed to initialize services', 'STARTUP', { error });
    throw error;
  }
}

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`, 'SHUTDOWN');

  try {
    // Stop accepting new requests
    if (server) {
      server.close(() => {
        logger.info('HTTP server closed', 'SHUTDOWN');
      });
    }

    // Stop queue processor
    if (queueProcessor) {
      logger.info('Stopping queue processor', 'SHUTDOWN');
      await queueProcessor.stop();
      logger.info('Queue processor stopped', 'SHUTDOWN');
    }

    // Close database connections
    logger.info('Closing database connections', 'SHUTDOWN');
    // Database connections will be closed automatically

    logger.info('Graceful shutdown completed', 'SHUTDOWN');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', 'SHUTDOWN', { error });
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

// Error handler middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error in request', 'ERROR', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

// Start the server
async function startServer() {
  try {
    logger.info('Starting email pipeline service', 'STARTUP', {
      version: '2.2.1',
      environment: process.env.NODE_ENV,
      port: PORT,
      host: HOST as string,
    });

    // Initialize all services
    await initializeServices();

    // Start HTTP server
    server = createServer(app);
    
    server.listen(PORT, HOST as any, () => {
      logger.info('Email pipeline service started successfully', 'STARTUP', {
        port: PORT,
        host: HOST,
        processId: process.pid,
        endpoints: {
          health: `http://${HOST}:${PORT}/health`,
          status: `http://${HOST}:${PORT}/status`,
          metrics: `http://${HOST}:${PORT}/metrics`,
          api: `http://${HOST}:${PORT}/api`,
        },
      });
    });

    server.on('error', (error: any) => {
      logger.error('Server error', 'SERVER', { error });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start email pipeline service', 'STARTUP', { error });
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  startServer();
}

export { app, startServer };