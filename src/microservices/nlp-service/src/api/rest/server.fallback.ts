/**
 * Fallback REST API Server for NLP Microservice
 * Provides a simple HTTP server when Fastify is not available
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { URL } from 'url';
import { NLPService } from '../../services/NLPService';
import { logger } from '../../utils/logger';
import type {
  NLPServiceConfig,
  NLPServiceAPI,
  ServiceStatus,
  ServiceMetrics
} from '../../types/index';

export class RestAPIServer {
  private server: any;
  private nlpService: NLPService;
  private config: NLPServiceConfig;
  private isAvailable: boolean = true;

  constructor(nlpService: NLPService, config: NLPServiceConfig) {
    this.nlpService = nlpService;
    this.config = config;
    
    // Use Node.js built-in HTTP server as fallback
    this.server = createServer(this.handleRequest.bind(this));
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const path = url.pathname;
      const method = req.method?.toUpperCase();

      // Health check endpoint
      if (path === '/health' && method === 'GET') {
        const status = this.nlpService.getStatus();
        res.writeHead(200);
        res.end(JSON.stringify({
          service: 'nlp-service',
          status: status.status,
          timestamp: new Date().toISOString()
        }));
        return;
      }

      // Detailed health endpoint
      if (path === '/health/detailed' && method === 'GET') {
        const status = this.nlpService.getStatus();
        const metrics = this.nlpService.getMetrics();
        res.writeHead(200);
        res.end(JSON.stringify({
          service: status.service,
          status: status.status,
          metrics: metrics,
          queue: status.queue
        }));
        return;
      }

      // Metrics endpoint
      if (path === '/metrics' && method === 'GET') {
        const metrics = this.nlpService.getMetrics();
        res.writeHead(200);
        res.end(JSON.stringify(metrics));
        return;
      }

      // Root documentation endpoint
      if (path === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>NLP Microservice API</title></head>
          <body>
            <h1>NLP Microservice API</h1>
            <h2>Available Endpoints:</h2>
            <ul>
              <li><strong>GET /health</strong> - Basic health check</li>
              <li><strong>GET /health/detailed</strong> - Detailed health information</li>
              <li><strong>GET /metrics</strong> - Service metrics</li>
              <li><strong>POST /api/v1/process</strong> - Process NLP query</li>
              <li><strong>POST /api/v1/batch</strong> - Process batch queries</li>
              <li><strong>GET /api/v1/status</strong> - Service status</li>
              <li><strong>GET /api/v1/queue/status</strong> - Queue status</li>
            </ul>
          </body>
          </html>
        `);
        return;
      }

      // Process single query endpoint
      if (path === '/api/v1/process' && method === 'POST') {
        const body = await this.readBody(req);
        const requestData = JSON.parse(body);
        
        if (!requestData.query) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Query is required' }));
          return;
        }

        const result = await this.nlpService.processQuery(
          requestData.query,
          requestData.priority,
          requestData.timeout,
          requestData.metadata
        );

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          requestId: `req-${Date.now()}`,
          result,
          processingTime: result.processingMetadata.processingTime,
          queueTime: 0
        }));
        return;
      }

      // Status endpoint
      if (path === '/api/v1/status' && method === 'GET') {
        const status = this.nlpService.getStatus();
        res.writeHead(200);
        res.end(JSON.stringify(status));
        return;
      }

      // Queue status endpoint
      if (path === '/api/v1/queue/status' && method === 'GET') {
        const queueStatus = this.nlpService.getQueueStatus();
        res.writeHead(200);
        res.end(JSON.stringify(queueStatus));
        return;
      }

      // 404 for unknown endpoints
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));

    } catch (error) {
      logger.error('Request handling error', 'REST_SERVER', { error });
      res.writeHead(500);
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, (error: any) => {
        if (error) {
          logger.error('Failed to start REST API server', 'REST_SERVER', { error });
          reject(error);
        } else {
          logger.info('REST API server started', 'REST_SERVER', {
            host: this.config.host,
            port: this.config.port
          });
          resolve();
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('REST API server stopped', 'REST_SERVER');
        resolve();
      });
    });
  }

  getServerInfo() {
    return {
      isAvailable: this.isAvailable,
      host: this.config.host,
      port: this.config.port,
      serverType: 'http-fallback'
    };
  }
}