/**
 * REST API Server for NLP Microservice - Quick Fix Version
 * Provides HTTP endpoints for NLP operations with corrected TypeScript typing
 */

// Optional dependencies for REST API - fallback gracefully if not available
let Fastify: any;
let fastifyCors: any;
let fastifyHelmet: any;
let fastifyRateLimit: any;

// Type imports with fallbacks
interface FastifyInstanceType {
  listen(opts: any): Promise<string>;
  close(): Promise<void>;
  register(plugin: any, opts?: any): Promise<void>;
  get(path: string, handler: (request: any, reply: any) => Promise<any>): void;
  post(path: string, handler: (request: any, reply: any) => Promise<any>): void;
  put(path: string, handler: (request: any, reply: any) => Promise<any>): void;
  delete(path: string, handler: (request: any, reply: any) => Promise<any>): void;
  setErrorHandler(handler: (error: any, request: any, reply: any) => Promise<any>): void;
  addHook(name: string, handler: (request: any, reply: any) => Promise<void>): void;
  ready(): Promise<void>;
  server: any;
}

interface FastifyRequestType {
  params: Record<string, any>;
  query: Record<string, any>;
  body: any;
  headers: Record<string, string>;
  ip: string;
  method: string;
  url: string;
}

interface FastifyReplyType {
  code(statusCode: number): FastifyReplyType;
  send(payload: any): Promise<void>;
  header(name: string, value: string): FastifyReplyType;
  type(contentType: string): FastifyReplyType;
  status(statusCode: number): FastifyReplyType;
}

try {
  Fastify = require('fastify').default || require('fastify');
  fastifyCors = require('@fastify/cors');
  fastifyHelmet = require('@fastify/helmet');
  fastifyRateLimit = require('@fastify/rate-limit');
} catch (error) {
  // Fastify dependencies not available - REST server will be disabled
  Fastify = null;
}

import { NLPService } from '../../services/NLPService';
import { logger } from '../../utils/logger';
import type {
  NLPServiceConfig,
  NLPServiceAPI,
  ServiceStatus,
  ServiceMetrics
} from '../../types/index';

export class RestAPIServer {
  private fastify: FastifyInstanceType | null = null;
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private isStarted = false;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    if (Fastify) {
      this.fastify = Fastify({
        logger: {
          level: process.env.LOG_LEVEL || 'info',
          stream: process.stdout
        }
      }) as FastifyInstanceType;
      
      this.setupMiddleware();
      this.setupRoutes();
      this.setupErrorHandlers();
    } else {
      logger.warn('Fastify not available, REST API disabled', 'REST_SERVER');
    }
  }

  /**
   * Setup middleware
   */
  private async setupMiddleware(): Promise<void> {
    if (!this.fastify) return;

    try {
      // CORS
      if (this.config.security.cors.enabled && fastifyCors) {
        await this.fastify.register(fastifyCors, {
          origin: this.config.security.cors.origins,
          credentials: true
        });
      }

      // Security headers
      if (fastifyHelmet) {
        await this.fastify.register(fastifyHelmet, {
          contentSecurityPolicy: {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:']
            }
          }
        });
      }

      // Rate limiting
      if (this.config.security.rateLimiting.enabled && fastifyRateLimit) {
        await this.fastify.register(fastifyRateLimit, {
          max: this.config.security.rateLimiting.max,
          timeWindow: this.config.security.rateLimiting.timeWindow
        });
      }

      // Request logging
      this.fastify.addHook('onRequest', async (request: FastifyRequestType, reply: FastifyReplyType) => {
        logger.debug('Incoming request', 'REST_API', {
          method: request.method,
          url: request.url,
          ip: request.ip
        });
      });

      // Response time tracking
      this.fastify.addHook('onRequest', async (request: any, reply: any) => {
        (request as any).startTime = Date.now();
      });

      logger.info('REST API middleware configured', 'REST_SERVER');
    } catch (error) {
      logger.error('Failed to setup middleware', 'REST_SERVER', { error });
      throw error;
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    if (!this.fastify) return;

    // Health check
    this.fastify.get('/health', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      const status = this.nlpService.getStatus();
      const responseCode = status.status === 'healthy' ? 200 : 503;
      
      return reply.code(responseCode).send({
        service: 'nlp-microservice',
        status: status.status,
        timestamp: new Date().toISOString(),
        uptime: status.uptime,
        dependencies: status.dependencies,
        queue: status.queue
      });
    });

    // Metrics endpoint
    this.fastify.get('/metrics', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      const metrics = this.nlpService.getMetrics();
      return reply.code(200).send(metrics);
    });

    // Process single query
    this.fastify.post('/api/v1/process', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      try {
        const { query, priority = 'normal', timeout, metadata }: NLPServiceAPI.REST.ProcessRequest = request.body || {};
        
        if (!query || typeof query !== 'string') {
          return reply.code(400).send({
            success: false,
            error: 'Query is required and must be a string',
            processingTime: 0,
            queueTime: 0
          });
        }

        const startTime = Date.now();
        const result = await this.nlpService.processQuery(
          query,
          priority as 'high' | 'normal' | 'low',
          timeout,
          metadata
        );
        const processingTime = Date.now() - startTime;

        // Convert GroceryNLPResult to REST API format
        const response: NLPServiceAPI.REST.ProcessResponse = {
          success: true,
          requestId: this.generateRequestId(),
          result: {
            entities: result.entities.map(entity => ({
              type: entity.type as 'product' | 'quantity' | 'unit' | 'action' | 'location',
              value: entity.value,
              confidence: entity.confidence,
              startIndex: entity.startIndex,
              endIndex: entity.endIndex
            })),
            intent: {
              action: result.intent.action as 'add' | 'remove' | 'update' | 'search' | 'list',
              confidence: result.intent.confidence
            },
            normalized: {
              products: result.normalizedItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit || ''
              }))
            },
            metadata: {
              processingTime: result.processingMetadata.processingTime,
              model: result.processingMetadata.model,
              version: result.processingMetadata.version
            }
          },
          processingTime,
          queueTime: 0 // Would be tracked by queue
        };

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error('Error processing query', 'REST_API', { error });
        return reply.code(error.statusCode || 500).send({
          success: false,
          error: error.message || 'Internal server error',
          processingTime: Date.now() - ((request as any).startTime || Date.now()),
          queueTime: 0
        });
      }
    });

    // Process batch queries
    this.fastify.post('/api/v1/batch', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      try {
        const { queries, priority = 'normal', timeout }: NLPServiceAPI.REST.BatchRequest = request.body || {};
        
        if (!Array.isArray(queries) || queries.length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'Queries array is required and cannot be empty'
          });
        }

        const startTime = Date.now();
        const batchResult = await this.nlpService.processBatch(
          queries,
          priority as 'high' | 'normal' | 'low',
          timeout,
          { batchId: this.generateBatchId() }
        );
        const totalProcessingTime = Date.now() - startTime;

        const response: NLPServiceAPI.REST.BatchResponse = {
          success: true,
          batchId: batchResult.batchId,
          results: batchResult.results.map((result, index) => {
            if (result) {
              return {
                success: true,
                requestId: `${batchResult.batchId}-${index}`,
                result: {
                  entities: result.entities.map(entity => ({
                    type: entity.type as 'product' | 'quantity' | 'unit' | 'action' | 'location',
                    value: entity.value,
                    confidence: entity.confidence,
                    startIndex: entity.startIndex,
                    endIndex: entity.endIndex
                  })),
                  intent: {
                    action: result.intent.action as 'add' | 'remove' | 'update' | 'search' | 'list',
                    confidence: result.intent.confidence
                  },
                  normalized: {
                    products: result.normalizedItems.map(item => ({
                      name: item.name,
                      quantity: item.quantity,
                      unit: item.unit || ''
                    }))
                  },
                  metadata: {
                    processingTime: result.processingMetadata.processingTime,
                    model: result.processingMetadata.model,
                    version: result.processingMetadata.version
                  }
                },
                processingTime: batchResult.totalProcessingTime / queries.length,
                queueTime: 0
              };
            } else {
              return {
                success: false,
                requestId: `${batchResult.batchId}-${index}`,
                error: 'Processing failed',
                processingTime: 0,
                queueTime: 0
              };
            }
          }),
          totalProcessingTime,
          completedCount: batchResult.completedCount,
          failedCount: batchResult.failedCount
        };

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error('Error processing batch', 'REST_API', { error });
        return reply.code(error.statusCode || 500).send({
          success: false,
          error: error.message || 'Internal server error'
        });
      }
    });

    // Get queue status
    this.fastify.get('/api/v1/queue/status', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      const queueStatus = this.nlpService.getQueueStatus();
      return reply.code(200).send(queueStatus);
    });

    // Clear queue (emergency only)
    this.fastify.delete('/api/v1/queue', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      try {
        this.nlpService.clearQueue();
        return reply.code(200).send({
          success: true,
          message: 'Queue cleared successfully'
        });
      } catch (error: any) {
        logger.error('Error clearing queue', 'REST_API', { error });
        return reply.code(500).send({
          success: false,
          error: error.message || 'Failed to clear queue'
        });
      }
    });

    // Service status endpoint
    this.fastify.get('/api/v1/status', async (request: FastifyRequestType, reply: FastifyReplyType) => {
      const status = this.nlpService.getStatus();
      return reply.code(200).send(status);
    });

    // Development/testing endpoints
    if (this.config.environment === 'development') {
      // Test endpoint for development
      this.fastify.get('/dev/test', async (request: FastifyRequestType, reply: FastifyReplyType) => {
        return reply.code(200).send({
          message: 'NLP Microservice is running',
          version: this.config.discovery.serviceVersion,
          environment: this.config.environment,
          timestamp: new Date().toISOString()
        });
      });
    }

    logger.info('REST API routes configured', 'REST_SERVER', {
      endpoints: ['/health', '/metrics', '/api/v1/process', '/api/v1/batch', '/api/v1/queue/status']
    });
  }

  /**
   * Setup error handlers
   */
  private setupErrorHandlers(): void {
    if (!this.fastify) return;

    this.fastify.setErrorHandler(async (error: any, request: FastifyRequestType, reply: FastifyReplyType) => {
      logger.error('Unhandled REST API error', 'REST_SERVER', {
        error: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url
      });

      const statusCode = error.statusCode || 500;
      const errorResponse = {
        success: false,
        error: this.config.environment === 'production' 
          ? 'Internal server error' 
          : error.message,
        timestamp: new Date().toISOString()
      };

      return reply.code(statusCode).send(errorResponse);
    });
  }

  /**
   * Start the REST server
   */
  async start(): Promise<void> {
    if (!this.fastify) {
      logger.warn('Fastify not available, skipping REST server start', 'REST_SERVER');
      return;
    }

    if (this.isStarted) {
      logger.warn('REST server already started', 'REST_SERVER');
      return;
    }

    try {
      await this.fastify.ready();
      
      const address = await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });

      this.isStarted = true;
      
      logger.info('REST API server started', 'REST_SERVER', {
        address,
        port: this.config.port,
        host: this.config.host
      });
    } catch (error) {
      logger.error('Failed to start REST server', 'REST_SERVER', { error });
      throw error;
    }
  }

  /**
   * Stop the REST server
   */
  async stop(): Promise<void> {
    if (!this.fastify || !this.isStarted) {
      return;
    }

    try {
      await this.fastify.close();
      this.isStarted = false;
      
      logger.info('REST API server stopped', 'REST_SERVER');
    } catch (error) {
      logger.error('Error stopping REST server', 'REST_SERVER', { error });
      throw error;
    }
  }

  /**
   * Force shutdown (emergency)
   */
  forceShutdown(): void {
    if (this.fastify?.server) {
      this.fastify.server.close();
      this.isStarted = false;
      logger.warn('REST server force shutdown completed', 'REST_SERVER');
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isStarted: this.isStarted,
      port: this.config.port,
      host: this.config.host,
      fastifyAvailable: Fastify !== null
    };
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate batch ID
   */
  private generateBatchId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Fallback REST server for when Fastify is not available
export class RestAPIServerFallback {
  private nlpService: NLPService;
  private config: NLPServiceConfig;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    logger.warn('Using REST API fallback server (limited functionality)', 'REST_SERVER_FALLBACK');
  }

  async start(): Promise<void> {
    logger.info('REST API fallback server started (no-op)', 'REST_SERVER_FALLBACK');
  }

  async stop(): Promise<void> {
    logger.info('REST API fallback server stopped (no-op)', 'REST_SERVER_FALLBACK');
  }

  forceShutdown(): void {
    logger.info('REST API fallback server force shutdown (no-op)', 'REST_SERVER_FALLBACK');
  }

  getStatus() {
    return {
      isStarted: false,
      port: this.config.port,
      host: this.config.host,
      fastifyAvailable: false,
      fallbackMode: true
    };
  }
}

// Export the appropriate server class
export { RestAPIServer as FastifyRestServer };