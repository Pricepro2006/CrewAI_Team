/**
 * Service Mesh Integration Example
 * 
 * This example demonstrates how to integrate the service discovery and 
 * load balancing system with an Express application and WebSocket server.
 */

import express from 'express';
import { createServer } from 'http';
import WebSocket from 'ws';
import { walmartServiceMesh } from '../WalmartServiceMesh.js';
import { serviceDiscovery } from '../discovery/ServiceDiscovery.js';
import { WALMART_SERVICES } from '../config/WalmartServiceConfig.js';
import { logger } from '../../utils/logger.js';

export class ServiceMeshExample {
  private app: express.Express;
  private server: any;
  private wsServer: any | null = null;

  constructor() {
    this.app = express();
    this.setupExpress();
  }

  /**
   * Setup Express application with middleware
   */
  private setupExpress(): void {
    // Basic middleware
    this?.app.use(express.json());
    this?.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this?.app.use((req, res, next) => {
      logger.info('Incoming request', 'SERVICE_MESH_EXAMPLE', {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        clientIp: req.ip,
      });
      next();
    });

    // Health check endpoint
    this?.app.get('/health', async (req, res) => {
      const healthCheck = await walmartServiceMesh.healthCheck();
      res.status(healthCheck.healthy ? 200 : 503).json(healthCheck);
    });

    // Service mesh status endpoint
    this?.app.get('/status', async (req, res) => {
      const status = await walmartServiceMesh.getStatus();
      res.json(status);
    });

    // Service discovery endpoints
    this?.app.get('/services', async (req, res) => {
      try {
        const services = await serviceDiscovery.getStats();
        res.json({
          success: true,
          data: services,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Scale service endpoint
    this?.app.post('/services/:serviceName/scale', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const { instances } = req.body;

        if (!instances || typeof instances !== 'number') {
          return res.status(400).json({
            success: false,
            error: 'instances parameter required and must be a number',
          });
        }

        const success = await walmartServiceMesh.scaleService(serviceName, instances);
        
        return res.json({
          success,
          message: success 
            ? `Service ${serviceName} scaled to ${instances} instances`
            : `Failed to scale service ${serviceName}`,
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Service proxy example endpoint
    this?.app.get('/proxy/:serviceName/*', async (req, res) => {
      try {
        const { serviceName } = req.params;
        const proxy = walmartServiceMesh.getServiceProxy(serviceName);
        
        if (!proxy) {
          return res.status(404).json({
            success: false,
            error: `Service ${serviceName} not found or proxy not available`,
          });
        }

        // Use the proxy middleware
        const proxyMiddleware = proxy.createHttpMiddleware();
        return await proxyMiddleware(req, res, (err: any) => {
          if (err) {
            return res.status(500).json({
              success: false,
              error: err.message,
            });
          }
          return; // Explicitly return void
        });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // Error handling
    this?.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express error handler', 'SERVICE_MESH_EXAMPLE', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Start the complete service mesh
   */
  async start(port: number = 8000): Promise<void> {
    try {
      // Deploy all Walmart services
      logger.info('Deploying Walmart service mesh...', 'SERVICE_MESH_EXAMPLE');
      const deploymentSuccess = await walmartServiceMesh.deployAllServices();
      
      if (!deploymentSuccess) {
        throw new Error('Failed to deploy service mesh');
      }

      // Setup service proxies in Express
      walmartServiceMesh.setupExpressProxies(this.app);

      // Create HTTP server
      this.server = createServer(this.app);

      // Setup WebSocket proxy
      walmartServiceMesh.setupWebSocketProxy(this.server);

      // Start listening
      await new Promise<void>((resolve, reject) => {
        this?.server?.listen(port, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('Service mesh example started successfully', 'SERVICE_MESH_EXAMPLE', {
        port,
        endpoints: [
          `http://localhost:${port}/health`,
          `http://localhost:${port}/status`,
          `http://localhost:${port}/services`,
          `ws://localhost:${port}`,
        ],
      });

      // Display service information
      await this.displayServiceInfo();

    } catch (error) {
      logger.error('Failed to start service mesh example', 'SERVICE_MESH_EXAMPLE', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Display information about deployed services
   */
  private async displayServiceInfo(): Promise<void> {
    const status = await walmartServiceMesh.getStatus();
    const stats = await serviceDiscovery.getStats();

    console.log('\n=== Walmart Service Mesh Status ===');
    console.log(`Status: ${status.status}`);
    console.log(`Total Services: ${status?.services?.total}`);
    console.log(`Healthy Services: ${status?.services?.healthy}`);
    console.log(`Running Services: ${status?.services?.running}`);
    console.log(`Uptime: ${Math.round(status.uptime / 1000)}s`);

    console.log('\n=== Available Services ===');
    Object.entries(WALMART_SERVICES).forEach(([name, config]) => {
      console.log(`- ${name}: ${config.protocol}://${config.host}:${config.port}`);
      console.log(`  Health: ${config.health_endpoint || '/health'}`);
      console.log(`  Load Balancing: ${config.load_balancing_strategy}`);
      console.log(`  Scaling: ${config?.scaling?.min_instances}-${config?.scaling?.max_instances} instances`);
    });

    console.log('\n=== Example API Calls ===');
    console.log('Health Check: curl http://localhost:8000/health');
    console.log('Service Status: curl http://localhost:8000/status');
    console.log('Service Stats: curl http://localhost:8000/services');
    console.log('Scale Pricing Service: curl -X POST -H "Content-Type: application/json" -d \'{"instances": 2}\' http://localhost:8000/services/walmart-pricing/scale');
    console.log('Proxy to Pricing Service: curl http://localhost:8000/walmart-pricing/api/health');

    if (status?.errors?.length > 0) {
      console.log('\n=== Deployment Errors ===');
      status?.errors?.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    console.log('\n');
  }

  /**
   * Demonstrate service communication
   */
  async demonstrateServiceCommunication(): Promise<void> {
    try {
      logger.info('Demonstrating service communication...', 'SERVICE_MESH_EXAMPLE');

      // Example 1: Direct proxy request
      const pricingProxy = walmartServiceMesh.getServiceProxy('walmart-pricing');
      if (pricingProxy) {
        try {
          const response = await pricingProxy.proxyRequest({
            method: 'GET',
            path: '/pricing/health',
            headers: { 'Content-Type': 'application/json' },
          });
          
          logger.info('Direct proxy request successful', 'SERVICE_MESH_EXAMPLE', {
            service: 'walmart-pricing',
            status: response.status,
            cached: response.cached,
            responseTime: response.responseTime,
          });
        } catch (error) {
          logger.warn('Direct proxy request failed', 'SERVICE_MESH_EXAMPLE', {
            service: 'walmart-pricing',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Example 2: Service discovery
      const pricingServices = await serviceDiscovery.discoverServices('walmart-pricing');
      logger.info('Service discovery results', 'SERVICE_MESH_EXAMPLE', {
        service: 'walmart-pricing',
        instances: pricingServices?.length || 0,
        endpoints: pricingServices?.map(s => `${s.protocol}://${s.host}:${s.port}`),
      });

      // Example 3: Load balancer statistics
      const loadBalancer = walmartServiceMesh.getServiceProxy('walmart-pricing');
      if (loadBalancer) {
        const metrics = loadBalancer.getMetrics();
        logger.info('Load balancer metrics', 'SERVICE_MESH_EXAMPLE', {
          service: 'walmart-pricing',
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          avgResponseTime: metrics.avgResponseTime,
          cacheHitRate: metrics.cacheHitRate,
        });
      }

    } catch (error) {
      logger.error('Service communication demonstration failed', 'SERVICE_MESH_EXAMPLE', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Simulate load and demonstrate auto-scaling
   */
  async simulateLoadAndAutoScaling(): Promise<void> {
    logger.info('Starting load simulation and auto-scaling demonstration...', 'SERVICE_MESH_EXAMPLE');

    const pricingProxy = walmartServiceMesh.getServiceProxy('walmart-pricing');
    if (!pricingProxy) {
      logger.warn('Pricing service proxy not available for load simulation', 'SERVICE_MESH_EXAMPLE');
      return;
    }

    // Simulate 10 concurrent requests
    const requests = Array.from({ length: 10 }, async (_, index) => {
      try {
        const response = await pricingProxy.proxyRequest({
          method: 'GET',
          path: `/api/price/item-${index}`,
          headers: { 'Content-Type': 'application/json' },
          clientId: `client-${index}`,
        });
        
        return {
          index,
          success: true,
          status: response.status,
          responseTime: response.responseTime,
        };
      } catch (error) {
        return {
          index,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const results = await Promise.allSettled(requests);
    const successful = results?.filter(r => r.status === 'fulfilled').length;
    const totalResponseTime = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum: number, r: any) => sum + r?.value?.responseTime, 0);
    
    const avgResponseTime = successful > 0 ? totalResponseTime / successful : 0;

    logger.info('Load simulation completed', 'SERVICE_MESH_EXAMPLE', {
      totalRequests: requests?.length || 0,
      successful,
      failed: requests?.length || 0 - successful,
      avgResponseTime,
    });

    // Check if auto-scaling occurred
    setTimeout(async () => {
      const pricingServices = await serviceDiscovery.discoverServices('walmart-pricing');
      logger.info('Post-load service instances', 'SERVICE_MESH_EXAMPLE', {
        service: 'walmart-pricing',
        instances: pricingServices?.length || 0,
      });
    }, 5000);
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down service mesh example...', 'SERVICE_MESH_EXAMPLE');

    try {
      // Close WebSocket server
      if (this.wsServer) {
        this?.wsServer?.close();
      }

      // Close HTTP server
      if (this.server) {
        await new Promise<void>((resolve: any) => {
          this?.server?.close(() => resolve());
        });
      }

      // Shutdown service mesh
      await walmartServiceMesh.shutdown();

      logger.info('Service mesh example shutdown completed', 'SERVICE_MESH_EXAMPLE');
    } catch (error) {
      logger.error('Error during shutdown', 'SERVICE_MESH_EXAMPLE', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Example usage
 */
export async function runServiceMeshExample(): Promise<void> {
  const example = new ServiceMeshExample();

  // Setup graceful shutdown
  process.on('SIGTERM', async () => {
    await example.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await example.shutdown();
    process.exit(0);
  });

  try {
    // Start the service mesh
    await example.start(8000);

    // Wait a bit for services to be fully ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Demonstrate features
    await example.demonstrateServiceCommunication();
    
    // Simulate load
    await example.simulateLoadAndAutoScaling();

    console.log('Service mesh example is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('Failed to run service mesh example:', error);
    await example.shutdown();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runServiceMeshExample();
}