/**
 * REST API Server for NLP Microservice
 * Provides HTTP endpoints for NLP operations
 */

import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import { NLPService } from '../../services/NLPService.js';
import { logger } from '../../utils/logger.js';
import type {
  NLPServiceConfig,
  NLPServiceAPI,
  ServiceStatus,
  ServiceMetrics
} from '../../types/index.js';

export class RestAPIServer {
  private fastify: FastifyInstance;
  private nlpService: NLPService;
  private config: NLPServiceConfig;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        stream: process.stdout
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Start the REST server
   */
  async start(): Promise<void> {
    try {
      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });
      
      logger.info('REST API server started', 'REST_SERVER', {
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
    try {
      await this.fastify.close();
      logger.info('REST API server stopped', 'REST_SERVER');
    } catch (error) {
      logger.error('Error stopping REST server', 'REST_SERVER', { error });
      throw error;
    }
  }

  /**
   * Set up middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.fastify.register(fastifyHelmet, {
      contentSecurityPolicy: false // Disable CSP for API
    });

    // CORS
    if (this.config.security.cors.enabled) {
      this.fastify.register(fastifyCors, {
        origin: this.config.security.cors.origins,
        credentials: true
      });
    }

    // Rate limiting
    if (this.config.security.rateLimiting.enabled) {
      this.fastify.register(fastifyRateLimit, {
        max: this.config.security.rateLimiting.max,
        timeWindow: this.config.security.rateLimiting.timeWindow,
        errorResponseBuilder: (request: FastifyRequest, context: any) => ({
          error: 'Rate limit exceeded',
          message: `Too many requests, please try again later`,
          statusCode: 429,
          retryAfter: Math.round(context.ttl / 1000)
        })
      });
    }

    // Request ID middleware
    this.fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      request.id = request.headers['x-request-id'] as string || this.generateRequestId();
      reply.header('x-request-id', request.id);
    });

    // API Key authentication (if enabled)
    if (this.config.security.apiKeys.enabled) {
      this.fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
        const apiKey = request.headers['x-api-key'] as string;
        
        if (this.config.security.apiKeys.required && !apiKey) {
          reply.status(401).send({
            error: 'Unauthorized',
            message: 'API key required',
            statusCode: 401
          });
          return;
        }
        
        // Validate API key (implement your validation logic)
        if (apiKey && !this.validateApiKey(apiKey)) {
          reply.status(401).send({
            error: 'Unauthorized',
            message: 'Invalid API key',
            statusCode: 401
          });
          return;
        }
      });
    }
  }

  /**
   * Set up API routes
   */
  private setupRoutes(): void {
    // Health check
    this.fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      const status = this.nlpService.getStatus();
      const httpStatus = status.status === 'healthy' ? 200 : 
                        status.status === 'degraded' ? 200 : 503;
      
      reply.status(httpStatus).send({
        service: 'nlp-service',
        status: status.status,
        timestamp: Date.now(),
        uptime: status.uptime,
        version: status.version,
        dependencies: status.dependencies,
        queue: {
          size: status.queue.size,
          activeRequests: status.queue.activeRequests,
          health: status.queue.health
        }
      });
    });

    // Detailed health check
    this.fastify.get('/health/detailed', async (request: FastifyRequest, reply: FastifyReply) => {
      const status = this.nlpService.getStatus();
      const metrics = this.nlpService.getMetrics();
      const queueStatus = this.nlpService.getQueueStatus();
      
      reply.send({
        service: status,
        metrics,
        queue: queueStatus
      });
    });

    // Service metrics
    this.fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      const metrics = this.nlpService.getMetrics();
      reply.send(metrics);
    });

    // Process single query
    this.fastify.post<{
      Body: NLPServiceAPI.REST.ProcessRequest,
      Reply: NLPServiceAPI.REST.ProcessResponse
    }>('/api/v1/process', {
      schema: {
        body: {
          type: 'object',
          required: ['query'],
          properties: {
            query: { type: 'string', minLength: 1 },
            priority: { type: 'string', enum: ['high', 'normal', 'low'] },
            timeout: { type: 'number', minimum: 1000, maximum: 60000 },
            metadata: { type: 'object' }
          }
        }
      }
    }, async (request: FastifyRequest<{
      Body: NLPServiceAPI.REST.ProcessRequest,
      Reply: NLPServiceAPI.REST.ProcessResponse
    }>, reply: FastifyReply) => {
      const { query, priority = 'normal', timeout, metadata } = request.body;
      const requestId = request.id;
      
      try {
        const startTime = Date.now();
        const result = await this.nlpService.processQuery(query, priority, timeout, {
          ...metadata,
          requestId,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
        
        const processingTime = Date.now() - startTime;
        
        reply.send({
          success: true,
          requestId,
          result: {
            entities: result.entities.map(e => ({
              type: e.type,
              value: e.value,
              confidence: e.confidence,
              startIndex: e.startIndex,
              endIndex: e.endIndex
            })),
            intent: {
              action: result.intent.action,
              confidence: result.intent.confidence
            },
            normalized: {
              products: result.normalizedItems.map(item => ({
                name: item.name,
                quantity: item.quantity,
                unit: item.unit
              }))
            },
            metadata: {
              processingTime: result.processingMetadata.processingTime,
              model: result.processingMetadata.model,
              version: result.processingMetadata.version
            }
          },
          processingTime,
          queueTime: 0 // Would be populated by queue metrics
        });
        
      } catch (error: any) {
        logger.error('Process query failed', 'REST_API', {
          requestId,
          error: error.message,
          query: query.substring(0, 100)
        });
        
        reply.status(error.statusCode || 500).send({
          success: false,
          requestId,
          error: error.message || 'Internal server error',
          processingTime: 0,
          queueTime: 0
        });
      }
    });

    // Process batch queries
    this.fastify.post<{
      Body: NLPServiceAPI.REST.BatchRequest,
      Reply: NLPServiceAPI.REST.BatchResponse
    }>('/api/v1/batch', {
      schema: {
        body: {
          type: 'object',
          required: ['queries'],
          properties: {
            queries: {
              type: 'array',
              minItems: 1,
              maxItems: 10, // Limit batch size
              items: {
                type: 'object',
                required: ['query'],
                properties: {
                  query: { type: 'string', minLength: 1 },
                  metadata: { type: 'object' }
                }
              }
            },
            priority: { type: 'string', enum: ['high', 'normal', 'low'] },
            timeout: { type: 'number', minimum: 1000, maximum: 120000 }
          }
        }
      }
    }, async (request: FastifyRequest<{
      Body: NLPServiceAPI.REST.BatchRequest,
      Reply: NLPServiceAPI.REST.BatchResponse
    }>, reply: FastifyReply) => {
      const { queries, priority = 'normal', timeout } = request.body;
      const requestId = request.id;
      
      try {
        const result = await this.nlpService.processBatch(
          queries.map((q: any) => ({
            ...q,
            metadata: {
              ...q.metadata,
              requestId,
              userAgent: request.headers['user-agent'],
              ip: request.ip
            }
          })),
          priority,
          timeout,
          { batchId: requestId }
        );
        
        reply.send({
          success: true,
          batchId: result.batchId,
          results: result.results.map((r, index) => {
            if (!r) {
              return {
                success: false,
                requestId: `${requestId}-${index}`,
                error: 'Processing failed',
                processingTime: 0,
                queueTime: 0
              };
            }
            
            return {
              success: true,
              requestId: `${requestId}-${index}`,
              result: {
                entities: r.entities.map(e => ({
                  type: e.type,
                  value: e.value,
                  confidence: e.confidence,
                  startIndex: e.startIndex,
                  endIndex: e.endIndex
                })),
                intent: {
                  action: r.intent.action,
                  confidence: r.intent.confidence
                },
                normalized: {
                  products: r.normalizedItems.map(item => ({
                    name: item.name,
                    quantity: item.quantity,
                    unit: item.unit
                  }))
                },
                metadata: {
                  processingTime: r.processingMetadata.processingTime,
                  model: r.processingMetadata.model,
                  version: r.processingMetadata.version
                }
              },
              processingTime: r.processingMetadata.processingTime,
              queueTime: 0
            };
          }),
          totalProcessingTime: result.totalProcessingTime,
          completedCount: result.completedCount,
          failedCount: result.failedCount
        });
        
      } catch (error: any) {
        logger.error('Batch process failed', 'REST_API', {
          requestId,
          error: error.message,
          queryCount: queries.length
        });
        
        reply.status(error.statusCode || 500).send({
          success: false,
          batchId: requestId,
          results: [],
          totalProcessingTime: 0,
          completedCount: 0,
          failedCount: queries.length
        });
      }
    });

    // Queue management endpoints
    this.fastify.get('/api/v1/queue/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const status = this.nlpService.getQueueStatus();
      reply.send(status);
    });

    this.fastify.delete('/api/v1/queue/clear', async (request: FastifyRequest, reply: FastifyReply) => {
      // Require admin privileges for this operation
      const apiKey = request.headers['x-api-key'] as string;
      if (!this.isAdminApiKey(apiKey)) {
        reply.status(403).send({
          error: 'Forbidden',
          message: 'Admin privileges required'
        });
        return;
      }
      
      this.nlpService.clearQueue();
      reply.send({ message: 'Queue cleared' });
    });

    // Service control endpoints
    this.fastify.get('/api/v1/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const status = this.nlpService.getStatus();
      reply.send(status);
    });

    // API documentation
    this.fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>NLP Microservice API</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; }
            .endpoint { margin: 20px 0; padding: 10px; border-left: 3px solid #007acc; }
            .method { font-weight: bold; color: #007acc; }
          </style>
        </head>
        <body>
          <h1>NLP Microservice API</h1>
          <p>Version: ${this.nlpService.getStatus().version}</p>
          
          <div class="endpoint">
            <div class="method">GET /health</div>
            <p>Basic health check endpoint</p>
          </div>
          
          <div class="endpoint">
            <div class="method">GET /health/detailed</div>
            <p>Detailed health check with metrics</p>
          </div>
          
          <div class="endpoint">
            <div class="method">POST /api/v1/process</div>
            <p>Process a single NLP query</p>
          </div>
          
          <div class="endpoint">
            <div class="method">POST /api/v1/batch</div>
            <p>Process multiple NLP queries in batch</p>
          </div>
          
          <div class="endpoint">
            <div class="method">GET /api/v1/queue/status</div>
            <p>Get current queue status</p>
          </div>
          
          <div class="endpoint">
            <div class="method">GET /metrics</div>
            <p>Service metrics endpoint</p>
          </div>
        </body>
        </html>
      `);
    });
  }

  /**
   * Set up error handling
   */
  private setupErrorHandling(): void {
    this.fastify.setErrorHandler((error: any, request: FastifyRequest, reply: FastifyReply) => {
      logger.error('REST API error', 'REST_SERVER', {
        error: error.message,
        stack: error.stack,
        requestId: request.id,
        url: request.url,
        method: request.method
      });

      const statusCode = error.statusCode || 500;
      const message = statusCode === 500 ? 'Internal server error' : error.message;

      reply.status(statusCode).send({
        error: 'Request failed',
        message,
        statusCode,
        requestId: request.id,
        timestamp: Date.now()
      });
    });

    this.fastify.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
      reply.status(404).send({
        error: 'Not found',
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
        requestId: request.id
      });
    });
  }

  /**
   * Generate request ID
   */
  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate API key (implement your logic)
   */
  private validateApiKey(apiKey: string): boolean {
    // Implement your API key validation logic
    return apiKey.length >= 32; // Simple example
  }

  /**
   * Check if API key has admin privileges
   */
  private isAdminApiKey(apiKey: string): boolean {
    // Implement your admin key validation logic
    return apiKey === process.env.ADMIN_API_KEY;
  }
}