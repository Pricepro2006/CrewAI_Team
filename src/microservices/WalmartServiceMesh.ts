/**
 * Walmart Service Mesh Integration
 * 
 * This class provides a high-level interface to deploy and manage
 * the complete Walmart microservices architecture with service discovery,
 * load balancing, and health monitoring.
 */

import { ServiceDiscovery, serviceDiscovery } from './discovery/ServiceDiscovery.js';
import { ServiceProxy, ServiceProxyFactory } from './discovery/ServiceProxy.js';
import { healthChecker } from './discovery/HealthChecker.js';
import { serviceRegistry } from './discovery/ServiceRegistry.js';
import { 
  WALMART_SERVICES, 
  WalmartServiceDefinition,
  getServicesInDeploymentOrder,
  getServiceConfig,
  validateServiceConfig,
  generateDeploymentManifest
} from './config/WalmartServiceConfig.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../api/monitoring/metrics.js';
import express from 'express';
import type { Express } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import WebSocket from 'ws';

export interface ServiceMeshOptions {
  autoStart: boolean;
  healthCheckEnabled: boolean;
  metricsEnabled: boolean;
  circuitBreakerEnabled: boolean;
  loadBalancingEnabled: boolean;
  proxyEnabled: boolean;
}

export interface ServiceMeshStatus {
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  services: {
    total: number;
    running: number;
    healthy: number;
    unhealthy: number;
  };
  uptime: number;
  last_deployment: Date;
  errors: string[];
}

export class WalmartServiceMesh {
  private static instance: WalmartServiceMesh | null = null;
  private status: ServiceMeshStatus['status'] = 'stopped';
  private startTime: Date | null = null;
  private deploymentErrors: string[] = [];
  private runningServices = new Set<string>();
  private expressApp: Express | null = null;
  private wsServer: WebSocket.Server | null = null;

  private constructor(private options: ServiceMeshOptions) {
    this.setupEventHandlers();
  }

  public static getInstance(options?: Partial<ServiceMeshOptions>): WalmartServiceMesh {
    if (!WalmartServiceMesh.instance) {
      const defaultOptions: ServiceMeshOptions = {
        autoStart: false,
        healthCheckEnabled: true,
        metricsEnabled: true,
        circuitBreakerEnabled: true,
        loadBalancingEnabled: true,
        proxyEnabled: true,
        ...options,
      };
      WalmartServiceMesh.instance = new WalmartServiceMesh(defaultOptions);
    }
    return WalmartServiceMesh.instance;
  }

  /**
   * Deploy all Walmart services in the correct order
   */
  async deployAllServices(): Promise<boolean> {
    try {
      this.status = 'starting';
      this.startTime = new Date();
      this.deploymentErrors = [];

      logger.info('Starting Walmart service mesh deployment', 'SERVICE_MESH');

      const manifest = generateDeploymentManifest();
      logger.info('Deployment manifest generated', 'SERVICE_MESH', {
        totalServices: manifest.total_services,
        minInstances: manifest.total_min_instances,
        maxInstances: manifest.total_max_instances,
        deploymentOrder: manifest.deployment_order,
      });

      // Deploy services in dependency order
      for (const service of manifest.services) {
        const success = await this.deployService(service);
        if (!success) {
          this.deploymentErrors.push(`Failed to deploy ${service.name}`);
          logger.error('Service deployment failed', 'SERVICE_MESH', {
            serviceName: service.name,
          });
        } else {
          this.runningServices.add(service.name);
          logger.info('Service deployed successfully', 'SERVICE_MESH', {
            serviceName: service.name,
            endpoint: `${service.protocol}://${service.host}:${service.port}`,
          });
        }
      }

      // Check if we have critical services running
      const criticalServices = ['walmart-api-server'];
      const criticalRunning = criticalServices.every(name => this.runningServices.has(name));

      if (criticalRunning) {
        this.status = 'running';
        logger.info('Walmart service mesh deployment completed', 'SERVICE_MESH', {
          runningServices: this.runningServices.size,
          totalServices: manifest.total_services,
          errors: this.deploymentErrors.length,
        });
        
        // Start auto-scaling if enabled
        this.startAutoScaling();
        
        return true;
      } else {
        this.status = 'error';
        logger.error('Critical services failed to deploy', 'SERVICE_MESH', {
          criticalServices,
          errors: this.deploymentErrors,
        });
        return false;
      }

    } catch (error) {
      this.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.deploymentErrors.push(errorMessage);
      
      logger.error('Service mesh deployment failed', 'SERVICE_MESH', {
        error: errorMessage,
        errors: this.deploymentErrors,
      });
      
      return false;
    }
  }

  /**
   * Deploy a single service
   */
  async deployService(service: WalmartServiceDefinition): Promise<boolean> {
    try {
      // Validate configuration
      const validationErrors = validateServiceConfig(service);
      if (validationErrors.length > 0) {
        logger.error('Service configuration validation failed', 'SERVICE_MESH', {
          serviceName: service.name,
          errors: validationErrors,
        });
        return false;
      }

      // Check dependencies
      const dependenciesReady = await this.checkDependencies(service.dependencies);
      if (!dependenciesReady) {
        logger.warn('Service dependencies not ready', 'SERVICE_MESH', {
          serviceName: service.name,
          dependencies: service.dependencies,
        });
        return false;
      }

      // Deploy minimum instances
      for (let i = 0; i < service.scaling.min_instances; i++) {
        const instanceConfig = {
          ...service,
          port: service.port + i,
          version: `${service.version}-${i}`,
        };

        const success = await serviceDiscovery.registerService(instanceConfig);
        if (!success) {
          logger.error('Failed to register service instance', 'SERVICE_MESH', {
            serviceName: service.name,
            instance: i,
            port: instanceConfig.port,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Service deployment error', 'SERVICE_MESH', {
        serviceName: service.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Scale a specific service
   */
  async scaleService(serviceName: string, targetInstances: number): Promise<boolean> {
    try {
      const config = getServiceConfig(serviceName);
      if (!config) {
        logger.error('Service not found for scaling', 'SERVICE_MESH', { serviceName });
        return false;
      }

      // Check scaling limits
      if (targetInstances < config.scaling.min_instances || 
          targetInstances > config.scaling.max_instances) {
        logger.error('Target instances outside allowed range', 'SERVICE_MESH', {
          serviceName,
          targetInstances,
          minInstances: config.scaling.min_instances,
          maxInstances: config.scaling.max_instances,
        });
        return false;
      }

      const success = await serviceDiscovery.scaleService(serviceName, targetInstances, config);
      
      if (success) {
        logger.info('Service scaled successfully', 'SERVICE_MESH', {
          serviceName,
          targetInstances,
        });
      } else {
        logger.error('Service scaling failed', 'SERVICE_MESH', {
          serviceName,
          targetInstances,
        });
      }

      return success;
    } catch (error) {
      logger.error('Service scaling error', 'SERVICE_MESH', {
        serviceName,
        targetInstances,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get service proxy for making requests
   */
  getServiceProxy(serviceName: string): ServiceProxy | null {
    return serviceDiscovery.getServiceProxy(serviceName);
  }

  /**
   * Create Express middleware for proxying to services
   */
  createProxyMiddleware(serviceName: string): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    const proxy = this.getServiceProxy(serviceName);
    if (!proxy) {
      return async (req: Request, res: Response, next: NextFunction) => {
        res.status(503).json({
          error: 'Service not available',
          service: serviceName,
          timestamp: new Date().toISOString(),
        });
      };
    }

    return proxy.createHttpMiddleware();
  }

  /**
   * Setup Express app with service proxies
   */
  setupExpressProxies(app: Express): void {
    this.expressApp = app;

    // Setup proxies for HTTP services
    const httpServices = Object.values(WALMART_SERVICES)
      .filter(service => service.protocol === 'http' || service.protocol === 'https');

    for (const service of httpServices) {
      const proxy = this.getServiceProxy(service.name);
      if (proxy) {
        app.use(`/${service.name}`, proxy.createHttpMiddleware());
        logger.info('Express proxy middleware setup', 'SERVICE_MESH', {
          serviceName: service.name,
          path: `/${service.name}`,
        });
      }
    }

    // Add health check endpoint
    app.get('/service-mesh/health', async (req, res) => {
      const status = await this.getStatus();
      res.status(status.status === 'running' ? 200 : 503).json(status);
    });

    // Add service discovery endpoints
    app.get('/service-mesh/services', async (req, res) => {
      const services = await serviceRegistry.getAll();
      res.json({
        services,
        count: services.length,
        timestamp: new Date().toISOString(),
      });
    });

    app.get('/service-mesh/stats', async (req, res) => {
      const stats = await serviceDiscovery.getStats();
      res.json({
        ...stats,
        timestamp: new Date().toISOString(),
      });
    });
  }

  /**
   * Setup WebSocket proxy server
   */
  setupWebSocketProxy(server: Server): void {
    this.wsServer = new WebSocket.Server({ server });
    
    this.wsServer.on('connection', async (ws, req) => {
      const url = new URL(req.url!, `ws://${req.headers.host}`);
      const serviceName = url.pathname.split('/')[1];
      
      const proxy = this.getServiceProxy(serviceName);
      if (proxy) {
        const wsProxyHandler = proxy.createWebSocketProxy();
        await wsProxyHandler(ws, req);
      } else {
        ws.close(1011, 'Service not available');
      }
    });

    logger.info('WebSocket proxy server setup complete', 'SERVICE_MESH');
  }

  /**
   * Check if service dependencies are ready
   */
  private async checkDependencies(dependencies: string[]): Promise<boolean> {
    if (dependencies.length === 0) return true;

    const dependencyChecks = dependencies.map(async (dep) => {
      const services = await serviceDiscovery.discoverServices(dep);
      return services.length > 0;
    });

    const results = await Promise.all(dependencyChecks);
    return results.every(ready => ready);
  }

  /**
   * Start auto-scaling monitoring
   */
  private startAutoScaling(): void {
    const scalableServices = Object.values(WALMART_SERVICES)
      .filter(service => service.scaling.auto_scale);

    if (scalableServices.length === 0) return;

    setInterval(async () => {
      for (const service of scalableServices) {
        try {
          const currentInstances = await serviceDiscovery.discoverServices(service.name);
          const stats = await serviceDiscovery.getStats();
          
          // Simple scaling logic based on CPU threshold (would be more sophisticated in production)
          const avgCpu = 50; // This would come from actual metrics
          
          if (avgCpu > service.scaling.cpu_threshold! && 
              currentInstances.length < service.scaling.max_instances) {
            logger.info('Auto-scaling up service', 'SERVICE_MESH', {
              serviceName: service.name,
              currentInstances: currentInstances.length,
              avgCpu,
            });
            await this.scaleService(service.name, currentInstances.length + 1);
          } else if (avgCpu < 30 && 
                     currentInstances.length > service.scaling.min_instances) {
            logger.info('Auto-scaling down service', 'SERVICE_MESH', {
              serviceName: service.name,
              currentInstances: currentInstances.length,
              avgCpu,
            });
            await this.scaleService(service.name, currentInstances.length - 1);
          }
        } catch (error) {
          logger.warn('Auto-scaling check failed', 'SERVICE_MESH', {
            serviceName: service.name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, 60000); // Check every minute
  }

  /**
   * Setup event handlers for service mesh monitoring
   */
  private setupEventHandlers(): void {
    // Service discovery events
    serviceDiscovery.on('service:started', (serviceId, config) => {
      metrics.increment('service_mesh.service.started', {
        service_name: config.name,
      });
    });

    serviceDiscovery.on('service:stopped', (serviceId, config) => {
      this.runningServices.delete(config.name);
      metrics.increment('service_mesh.service.stopped', {
        service_name: config.name,
      });
    });

    serviceDiscovery.on('service:health_degraded', (result) => {
      metrics.increment('service_mesh.service.health_degraded', {
        service_name: result.serviceName,
      });
    });

    serviceDiscovery.on('service:recovered', (result) => {
      metrics.increment('service_mesh.service.recovered', {
        service_name: result.serviceName,
      });
    });
  }

  /**
   * Get comprehensive service mesh status
   */
  async getStatus(): Promise<ServiceMeshStatus> {
    const stats = await serviceDiscovery.getStats();
    const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      status: this.status,
      services: {
        total: stats.registry.total_services,
        running: this.runningServices.size,
        healthy: stats.registry.healthy_services,
        unhealthy: stats.registry.unhealthy_services,
      },
      uptime,
      last_deployment: this.startTime || new Date(),
      errors: this.deploymentErrors,
    };
  }

  /**
   * Gracefully shutdown the entire service mesh
   */
  async shutdown(): Promise<void> {
    try {
      this.status = 'stopping';
      
      logger.info('Shutting down Walmart service mesh', 'SERVICE_MESH');

      // Close WebSocket server
      if (this.wsServer) {
        this.wsServer.close();
      }

      // Deregister all services
      const runningServiceNames = Array.from(this.runningServices);
      for (const serviceName of runningServiceNames) {
        await serviceDiscovery.deregisterService(serviceName);
      }

      // Shutdown service discovery
      await serviceDiscovery.shutdown();

      this.status = 'stopped';
      this.runningServices.clear();
      this.startTime = null;
      
      WalmartServiceMesh.instance = null;
      
      logger.info('Walmart service mesh shutdown complete', 'SERVICE_MESH');
      
    } catch (error) {
      logger.error('Error during service mesh shutdown', 'SERVICE_MESH', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Health check for the entire service mesh
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: Record<string, any>;
  }> {
    const status = await this.getStatus();
    const stats = await serviceDiscovery.getStats();
    
    const healthy = status.status === 'running' && 
                   status.services.healthy > 0 &&
                   status.errors.length === 0;

    return {
      healthy,
      details: {
        status: status.status,
        services: status.services,
        uptime: status.uptime,
        errors: status.errors,
        registry_stats: stats.registry,
        health_stats: stats.health_checker,
        load_balancer_stats: stats.load_balancer,
        proxy_stats: stats.proxies,
      },
    };
  }
}

// Export singleton instance
export const walmartServiceMesh = WalmartServiceMesh.getInstance();