/**
 * Main Service Discovery Orchestrator
 * 
 * This class orchestrates all service discovery components:
 * - Service Registry for registration and discovery
 * - Load Balancer for intelligent routing
 * - Health Checker for service monitoring
 * - Service Proxy for transparent communication
 * 
 * Features:
 * - Auto-registration with graceful shutdown
 * - Dynamic service scaling support
 * - Service mesh communication patterns
 * - Comprehensive metrics and monitoring
 */

import { ServiceRegistry, ServiceMetadata, serviceRegistry } from './ServiceRegistry.js';
import { LoadBalancer, LoadBalancerFactory, LoadBalancingStrategy } from './LoadBalancer.js';
import { HealthChecker, healthChecker } from './HealthChecker.js';
import { ServiceProxy, ServiceProxyFactory } from './ServiceProxy.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { EventEmitter } from 'events';
import { z } from 'zod';

export const ServiceConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
  host: z.string(),
  port: z.number(),
  protocol: z.enum(['http', 'https', 'ws', 'wss']),
  health_endpoint: z.string().optional(),
  capacity: z.number().optional().default(100),
  weight: z.number().optional().default(1),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.string()).optional().default({}),
  load_balancing_strategy: z.enum(['round_robin', 'weighted_round_robin', 'least_connections', 'random', 'ip_hash', 'least_response_time', 'resource_based']).optional().default('round_robin'),
  health_check_interval: z.number().optional().default(30000),
  health_check_timeout: z.number().optional().default(5000),
  circuit_breaker_enabled: z.boolean().optional().default(true),
  proxy_enabled: z.boolean().optional().default(true),
  proxy_caching_enabled: z.boolean().optional().default(false),
  proxy_cache_ttl: z.number().optional().default(300),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;

export interface ServiceDiscoveryStats {
  registry: {
    total_services: number;
    healthy_services: number;
    unhealthy_services: number;
    services_by_type: Record<string, number>;
  };
  health_checker: {
    total_services: number;
    healthy_services: number;
    avg_response_time: number;
    overall_uptime: number;
  };
  load_balancer: {
    total_load_balancers: number;
    active_connections: number;
    strategies_used: Record<string, number>;
  };
  proxies: {
    total_proxies: number;
    total_requests: number;
    success_rate: number;
    avg_response_time: number;
  };
}

export class ServiceDiscovery extends EventEmitter {
  private static instance: ServiceDiscovery | null = null;
  private registeredServices = new Map<string, ServiceConfig>();
  private loadBalancers = new Map<string, LoadBalancer>();
  private proxies = new Map<string, ServiceProxy>();
  private isShuttingDown = false;

  private constructor() {
    super();
    this.setupGracefulShutdown();
    this.startMetricsCollection();
    this.setupServiceEventHandlers();
  }

  public static getInstance(): ServiceDiscovery {
    if (!ServiceDiscovery.instance) {
      ServiceDiscovery.instance = new ServiceDiscovery();
    }
    return ServiceDiscovery.instance;
  }

  /**
   * Register and start a service
   */
  async registerService(config: ServiceConfig): Promise<boolean> {
    try {
      const validatedConfig = ServiceConfigSchema.parse(config);
      const serviceId = this.generateServiceId(validatedConfig);

      // Register with service registry
      const serviceMetadata: Omit<ServiceMetadata, 'registered_at' | 'last_heartbeat'> = {
        id: serviceId,
        name: validatedConfig.name,
        version: validatedConfig.version,
        host: validatedConfig.host,
        port: validatedConfig.port,
        protocol: validatedConfig.protocol,
        health_endpoint: validatedConfig.health_endpoint,
        capacity: validatedConfig.capacity,
        weight: validatedConfig.weight,
        tags: validatedConfig.tags,
        metadata: validatedConfig.metadata,
        status: 'unknown',
      };

      const registered = await serviceRegistry.register(serviceMetadata);
      if (!registered) {
        throw new Error('Failed to register service with registry');
      }

      // Store configuration
      this.registeredServices.set(serviceId, validatedConfig);

      // Start health checking
      await healthChecker.startHealthCheck(serviceMetadata, {
        interval: validatedConfig.health_check_interval,
        timeout: validatedConfig.health_check_timeout,
      });

      // Create load balancer if not exists
      if (!this.loadBalancers.has(validatedConfig.name)) {
        const loadBalancer = LoadBalancerFactory.getInstance(validatedConfig.name, {
          strategy: validatedConfig.load_balancing_strategy,
          healthCheckEnabled: true,
          circuitBreakerEnabled: validatedConfig.circuit_breaker_enabled,
          stickySession: false,
        });
        this.loadBalancers.set(validatedConfig.name, loadBalancer);
      }

      // Create proxy if enabled
      if (validatedConfig.proxy_enabled && !this.proxies.has(validatedConfig.name)) {
        const proxy = ServiceProxyFactory.createProxy(validatedConfig.name, {
          loadBalancingStrategy: validatedConfig.load_balancing_strategy,
          circuitBreakerEnabled: validatedConfig.circuit_breaker_enabled,
          cachingEnabled: validatedConfig.proxy_caching_enabled,
          cacheTTL: validatedConfig.proxy_cache_ttl,
        });
        this.proxies.set(validatedConfig.name, proxy);
      }

      // Start heartbeat
      serviceRegistry.startHeartbeat(serviceId);

      logger.info('Service registered and started', 'SERVICE_DISCOVERY', {
        serviceId,
        name: validatedConfig.name,
        version: validatedConfig.version,
        endpoint: `${validatedConfig.protocol}://${validatedConfig.host}:${validatedConfig.port}`,
      });

      this.emit('service:started', serviceId, validatedConfig);
      return true;

    } catch (error) {
      logger.error('Service registration failed', 'SERVICE_DISCOVERY', {
        service: config.name,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Deregister and stop a service
   */
  async deregisterService(serviceName: string, version?: string): Promise<boolean> {
    try {
      const services = Array.from(this.registeredServices.entries()).filter(
        ([id, config]) => config.name === serviceName && (!version || config.version === version)
      );

      if (services.length === 0) {
        logger.warn('Service not found for deregistration', 'SERVICE_DISCOVERY', {
          serviceName,
          version,
        });
        return false;
      }

      for (const [serviceId, config] of services) {
        // Stop health checking
        await healthChecker.stopHealthCheck(serviceId);

        // Deregister from registry
        await serviceRegistry.deregister(serviceId);

        // Remove from local tracking
        this.registeredServices.delete(serviceId);

        logger.info('Service deregistered', 'SERVICE_DISCOVERY', {
          serviceId,
          serviceName: config.name,
          version: config.version,
        });

        this.emit('service:stopped', serviceId, config);
      }

      // Clean up load balancer if no more instances
      const remainingServices = Array.from(this.registeredServices.values())
        .filter(config => config.name === serviceName);
      
      if (remainingServices.length === 0) {
        this.loadBalancers.delete(serviceName);
        this.proxies.delete(serviceName);
      }

      return true;

    } catch (error) {
      logger.error('Service deregistration failed', 'SERVICE_DISCOVERY', {
        serviceName,
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Discover services by name
   */
  async discoverServices(serviceName: string): Promise<ServiceMetadata[]> {
    return await serviceRegistry.getHealthyByName(serviceName);
  }

  /**
   * Discover services by tags
   */
  async discoverServicesByTags(tags: string[]): Promise<ServiceMetadata[]> {
    return await serviceRegistry.getByTags(tags);
  }

  /**
   * Get service proxy for communication
   */
  getServiceProxy(serviceName: string): ServiceProxy | null {
    return this.proxies.get(serviceName) || null;
  }

  /**
   * Get load balancer for a service
   */
  getLoadBalancer(serviceName: string): LoadBalancer | null {
    return this.loadBalancers.get(serviceName) || null;
  }

  /**
   * Scale service instances
   */
  async scaleService(
    serviceName: string,
    targetInstances: number,
    baseConfig: Omit<ServiceConfig, 'port'>
  ): Promise<boolean> {
    try {
      const currentServices = Array.from(this.registeredServices.values())
        .filter(config => config.name === serviceName);

      const currentCount = currentServices.length;

      if (targetInstances > currentCount) {
        // Scale up
        const instancesToAdd = targetInstances - currentCount;
        const basePort = baseConfig.port || 3000;

        for (let i = 0; i < instancesToAdd; i++) {
          const instanceConfig: ServiceConfig = {
            ...baseConfig,
            name: serviceName,
            port: basePort + currentCount + i,
            version: baseConfig.version,
          };

          await this.registerService(instanceConfig);
        }

        logger.info('Service scaled up', 'SERVICE_DISCOVERY', {
          serviceName,
          from: currentCount,
          to: targetInstances,
        });

      } else if (targetInstances < currentCount) {
        // Scale down
        const instancesToRemove = currentCount - targetInstances;
        const servicesToRemove = currentServices.slice(-instancesToRemove);

        for (const service of servicesToRemove) {
          await this.deregisterService(serviceName, service.version);
        }

        logger.info('Service scaled down', 'SERVICE_DISCOVERY', {
          serviceName,
          from: currentCount,
          to: targetInstances,
        });
      }

      return true;

    } catch (error) {
      logger.error('Service scaling failed', 'SERVICE_DISCOVERY', {
        serviceName,
        targetInstances,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get comprehensive service discovery statistics
   */
  async getStats(): Promise<ServiceDiscoveryStats> {
    const registryStats = await serviceRegistry.getStats();
    const healthStats = healthChecker.getOverallStats();
    
    // Collect load balancer stats
    let totalConnections = 0;
    const strategiesUsed: Record<string, number> = {};
    
    this.loadBalancers.forEach(lb => {
      const stats = lb.getStats();
      totalConnections += stats.active_connections;
      strategiesUsed[stats.strategy] = (strategiesUsed[stats.strategy] || 0) + 1;
    });

    // Collect proxy stats
    let totalProxyRequests = 0;
    let totalSuccessfulRequests = 0;
    let totalProxyResponseTime = 0;
    let proxyCount = 0;

    this.proxies.forEach(proxy => {
      const metrics = proxy.getMetrics();
      totalProxyRequests += metrics.totalRequests;
      totalSuccessfulRequests += metrics.successfulRequests;
      totalProxyResponseTime += metrics.avgResponseTime;
      proxyCount++;
    });

    const avgProxyResponseTime = proxyCount > 0 ? totalProxyResponseTime / proxyCount : 0;
    const successRate = totalProxyRequests > 0 ? (totalSuccessfulRequests / totalProxyRequests) * 100 : 0;

    return {
      registry: registryStats,
      health_checker: healthStats,
      load_balancer: {
        total_load_balancers: this.loadBalancers.size,
        active_connections: totalConnections,
        strategies_used: strategiesUsed,
      },
      proxies: {
        total_proxies: this.proxies.size,
        total_requests: totalProxyRequests,
        success_rate: successRate,
        avg_response_time: avgProxyResponseTime,
      },
    };
  }

  /**
   * Update service configuration
   */
  async updateServiceConfig(
    serviceName: string,
    version: string,
    updates: Partial<ServiceConfig>
  ): Promise<boolean> {
    try {
      const serviceId = Array.from(this.registeredServices.entries())
        .find(([id, config]) => config.name === serviceName && config.version === version)?.[0];

      if (!serviceId) {
        logger.warn('Service not found for config update', 'SERVICE_DISCOVERY', {
          serviceName,
          version,
        });
        return false;
      }

      const currentConfig = this.registeredServices.get(serviceId)!;
      const newConfig = { ...currentConfig, ...updates };
      
      // Validate new config
      const validatedConfig = ServiceConfigSchema.parse(newConfig);
      
      // Update local storage
      this.registeredServices.set(serviceId, validatedConfig);

      // Update service registry
      await serviceRegistry.update(serviceId, {
        weight: validatedConfig.weight,
        capacity: validatedConfig.capacity,
        tags: validatedConfig.tags,
        metadata: validatedConfig.metadata,
      });

      // Update proxy if needed
      const proxy = this.proxies.get(serviceName);
      if (proxy && updates.load_balancing_strategy) {
        proxy.updateConfig({
          loadBalancingStrategy: updates.load_balancing_strategy,
        });
      }

      logger.info('Service config updated', 'SERVICE_DISCOVERY', {
        serviceId,
        serviceName,
        version,
        updates,
      });

      return true;

    } catch (error) {
      logger.error('Service config update failed', 'SERVICE_DISCOVERY', {
        serviceName,
        version,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Generate unique service ID
   */
  private generateServiceId(config: ServiceConfig): string {
    return `${config.name}-${config.version}-${config.host}-${config.port}`;
  }

  /**
   * Setup service event handlers
   */
  private setupServiceEventHandlers(): void {
    // Handle service health changes
    healthChecker.on('health:failure', async (result) => {
      logger.warn('Service health degraded', 'SERVICE_DISCOVERY', {
        serviceId: result.serviceId,
        serviceName: result.serviceName,
        error: result.error,
      });
      this.emit('service:health_degraded', result);
    });

    healthChecker.on('health:success', (result) => {
      if (result.consecutive_successes === 1) {
        logger.info('Service recovered', 'SERVICE_DISCOVERY', {
          serviceId: result.serviceId,
          serviceName: result.serviceName,
        });
        this.emit('service:recovered', result);
      }
    });

    // Handle service registry events
    serviceRegistry.on('service:deregistered', (serviceId) => {
      this.emit('service:lost', serviceId);
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(async () => {
      try {
        const stats = await this.getStats();

        // Registry metrics
        metrics.gauge('service_discovery.registry.total_services', stats.registry.total_services);
        metrics.gauge('service_discovery.registry.healthy_services', stats.registry.healthy_services);
        metrics.gauge('service_discovery.registry.unhealthy_services', stats.registry.unhealthy_services);

        // Health checker metrics
        metrics.gauge('service_discovery.health.avg_response_time', stats.health_checker.avg_response_time);
        metrics.gauge('service_discovery.health.overall_uptime', stats.health_checker.overall_uptime);

        // Load balancer metrics
        metrics.gauge('service_discovery.lb.active_connections', stats.load_balancer.active_connections);
        metrics.gauge('service_discovery.lb.total_balancers', stats.load_balancer.total_load_balancers);

        // Proxy metrics
        metrics.gauge('service_discovery.proxy.success_rate', stats.proxies.success_rate);
        metrics.gauge('service_discovery.proxy.avg_response_time', stats.proxies.avg_response_time);
        metrics.gauge('service_discovery.proxy.total_requests', stats.proxies.total_requests);

      } catch (error) {
        logger.warn('Failed to collect service discovery metrics', 'SERVICE_DISCOVERY', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info('Starting graceful shutdown of service discovery', 'SERVICE_DISCOVERY', { signal });

      try {
        // Deregister all services
        const serviceIds = Array.from(this.registeredServices.keys());
        await Promise.all(serviceIds.map(id => {
          const config = this.registeredServices.get(id)!;
          return this.deregisterService(config.name, config.version);
        }));

        // Shutdown components
        await this.shutdown();

        logger.info('Service discovery graceful shutdown completed', 'SERVICE_DISCOVERY');
        process.exit(0);

      } catch (error) {
        logger.error('Error during graceful shutdown', 'SERVICE_DISCOVERY', {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon restart
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Stop heartbeat
    serviceRegistry.stopHeartbeat();

    // Shutdown health checker
    await healthChecker.shutdown();

    // Shutdown service registry
    await serviceRegistry.shutdown();

    // Shutdown load balancers
    LoadBalancerFactory.shutdown();

    // Shutdown proxies
    ServiceProxyFactory.shutdown();

    // Clear local state
    this.registeredServices.clear();
    this.loadBalancers.clear();
    this.proxies.clear();

    this.removeAllListeners();
    ServiceDiscovery.instance = null;

    logger.info('Service discovery shutdown complete', 'SERVICE_DISCOVERY');
  }
}

// Export singleton
export const serviceDiscovery = ServiceDiscovery.getInstance();