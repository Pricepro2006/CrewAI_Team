/**
 * Multi-Strategy Load Balancer for Microservices
 * 
 * Features:
 * - Multiple load balancing strategies
 * - Circuit breaker integration
 * - Health-aware routing
 * - Weighted distribution
 * - Connection tracking
 * - Metrics collection
 */

import { ServiceMetadata, serviceRegistry } from './ServiceRegistry.js';
import { CircuitBreakerFactory } from '../../core/resilience/CircuitBreaker.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { EventEmitter } from 'events';

export type LoadBalancingStrategy = 
  | 'round_robin' 
  | 'weighted_round_robin' 
  | 'least_connections' 
  | 'random' 
  | 'ip_hash' 
  | 'least_response_time'
  | 'resource_based';

export interface LoadBalancerConfig {
  strategy: LoadBalancingStrategy;
  healthCheckEnabled: boolean;
  circuitBreakerEnabled: boolean;
  stickySession: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
}

export interface ServiceInstance extends ServiceMetadata {
  current_connections: number;
  avg_response_time: number;
  total_requests: number;
  failed_requests: number;
  last_selected: Date;
  cpu_usage?: number;
  memory_usage?: number;
}

export interface LoadBalancingResult {
  service: ServiceInstance | null;
  error?: string;
  failover_used?: boolean;
  attempts: number;
}

export class LoadBalancer extends EventEmitter {
  private serviceInstances = new Map<string, ServiceInstance[]>();
  private roundRobinCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();
  private responseTimesHistory = new Map<string, number[]>();
  private stickySessionMap = new Map<string, string>(); // clientId -> serviceId
  private readonly MAX_RESPONSE_TIME_HISTORY = 100;

  constructor(private config: LoadBalancerConfig) {
    super();
    this.startMetricsCollection();
    this.setupServiceRegistryListeners();
  }

  /**
   * Select a service instance based on the configured strategy
   */
  async selectService(
    serviceName: string, 
    clientId?: string,
    context?: any
  ): Promise<LoadBalancingResult> {
    const startTime = Date.now();
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Get available services
        const services = await this.getAvailableServices(serviceName);
        
        if ((services?.length || 0) === 0) {
          return {
            service: null,
            error: `No healthy services available for ${serviceName}`,
            attempts
          };
        }

        // Handle sticky sessions
        if (this?.config?.stickySession && clientId) {
          const stickyService = this.handleStickySession(services, clientId);
          if (stickyService) {
            await this.trackServiceSelection(stickyService, startTime);
            return { service: stickyService, attempts };
          }
        }

        // Apply load balancing strategy
        const selectedService = await this.applyStrategy(services, serviceName, context);
        
        if (!selectedService) {
          continue;
        }

        // Check circuit breaker
        if (this?.config?.circuitBreakerEnabled && !this.isCircuitClosed(selectedService.id)) {
          logger.warn('Circuit breaker open for service', 'LOAD_BALANCER', {
            serviceId: selectedService.id,
            serviceName,
          });
          continue;
        }

        // Track selection
        await this.trackServiceSelection(selectedService, startTime);
        
        // Set sticky session if enabled
        if (this?.config?.stickySession && clientId) {
          this?.stickySessionMap?.set(clientId, selectedService.id);
        }

        logger.debug('Service selected', 'LOAD_BALANCER', {
          serviceId: selectedService.id,
          serviceName,
          strategy: this?.config?.strategy,
          attempts,
        });

        return { service: selectedService, attempts };
        
      } catch (error) {
        logger.warn('Service selection attempt failed', 'LOAD_BALANCER', {
          serviceName,
          attempt: attempts,
          error: error instanceof Error ? error.message : String(error),
        });

        if (attempts >= maxAttempts) {
          return {
            service: null,
            error: `Failed to select service after ${maxAttempts} attempts`,
            attempts
          };
        }
      }
    }

    return {
      service: null,
      error: 'Maximum selection attempts reached',
      attempts
    };
  }

  /**
   * Apply the configured load balancing strategy
   */
  private async applyStrategy(
    services: ServiceInstance[],
    serviceName: string,
    context?: any
  ): Promise<ServiceInstance | null> {
    switch (this?.config?.strategy) {
      case 'round_robin':
        return this.roundRobinSelection(services, serviceName);
        
      case 'weighted_round_robin':
        return this.weightedRoundRobinSelection(services, serviceName);
        
      case 'least_connections':
        return this.leastConnectionsSelection(services);
        
      case 'random':
        return this.randomSelection(services);
        
      case 'ip_hash':
        return this.ipHashSelection(services, context?.clientIp || '');
        
      case 'least_response_time':
        return this.leastResponseTimeSelection(services);
        
      case 'resource_based':
        return this.resourceBasedSelection(services);
        
      default:
        logger.warn('Unknown strategy, falling back to round robin', 'LOAD_BALANCER', {
          strategy: this?.config?.strategy,
        });
        return this.roundRobinSelection(services, serviceName);
    }
  }

  /**
   * Round robin selection
   */
  private roundRobinSelection(services: ServiceInstance[], serviceName: string): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    const counter = this?.roundRobinCounters?.get(serviceName) || 0;
    const selectedIndex = counter % services.length;
    
    this?.roundRobinCounters?.set(serviceName, counter + 1);
    return services[selectedIndex] || null;
  }

  /**
   * Weighted round robin selection
   */
  private weightedRoundRobinSelection(services: ServiceInstance[], serviceName: string): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    const totalWeight = services.reduce((sum: any, service: any) => sum + (service.weight || 1), 0);
    const counter = this?.roundRobinCounters?.get(serviceName) || 0;
    
    let weightSum = 0;
    const normalizedPosition = counter % totalWeight;
    
    for (const service of services) {
      weightSum += (service.weight || 1);
      if (normalizedPosition < weightSum) {
        this?.roundRobinCounters?.set(serviceName, counter + 1);
        return service;
      }
    }
    
    return services[0] || null;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(services: ServiceInstance[]): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    return services.reduce((min: any, service: any) => 
      service.current_connections < min.current_connections ? service : min
    );
  }

  /**
   * Random selection
   */
  private randomSelection(services: ServiceInstance[]): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    const randomIndex = Math.floor(Math.random() * services.length);
    return services[randomIndex] || null;
  }

  /**
   * IP hash selection (sticky by IP)
   */
  private ipHashSelection(services: ServiceInstance[], clientIp: string): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    if (!clientIp) {
      return this.randomSelection(services);
    }
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < clientIp.length; i++) {
      hash = ((hash << 5) - hash) + clientIp.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const index = Math.abs(hash) % services.length;
    return services[index] || null;
  }

  /**
   * Least response time selection
   */
  private leastResponseTimeSelection(services: ServiceInstance[]): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    return services.reduce((min: any, service: any) => 
      service.avg_response_time < min.avg_response_time ? service : min
    );
  }

  /**
   * Resource-based selection (considering CPU and memory)
   */
  private resourceBasedSelection(services: ServiceInstance[]): ServiceInstance | null {
    if (!services || services.length === 0) return null;
    
    return services.reduce((best: any, service: any) => {
      const serviceScore = this.calculateResourceScore(service);
      const bestScore = this.calculateResourceScore(best);
      return serviceScore > bestScore ? service : best;
    });
  }

  /**
   * Calculate resource score (higher is better)
   */
  private calculateResourceScore(service: ServiceInstance): number {
    const cpuScore = 100 - (service.cpu_usage || 50); // Lower CPU usage is better
    const memoryScore = 100 - (service.memory_usage || 50); // Lower memory usage is better
    const connectionScore = Math.max(0, 100 - service.current_connections); // Fewer connections is better
    const responseTimeScore = Math.max(0, 1000 - service.avg_response_time) / 10; // Lower response time is better
    
    return (cpuScore + memoryScore + connectionScore + responseTimeScore) / 4;
  }

  /**
   * Get available services with health checking
   */
  private async getAvailableServices(serviceName: string): Promise<ServiceInstance[]> {
    try {
      const services = await serviceRegistry.getHealthyByName(serviceName);
      const serviceInstances: ServiceInstance[] = [];

      for (const service of services) {
        // Check connection limits
        if (this?.config?.maxConnections && 
            this?.connectionCounts?.get(service.id)! >= this?.config?.maxConnections) {
          continue;
        }

        const instance: ServiceInstance = {
          ...service,
          current_connections: this?.connectionCounts?.get(service.id) || 0,
          avg_response_time: this.getAverageResponseTime(service.id),
          total_requests: 0,
          failed_requests: 0,
          last_selected: new Date(),
          cpu_usage: service?.metadata?.cpu_usage ? parseInt(service?.metadata?.cpu_usage) : undefined,
          memory_usage: service?.metadata?.memory_usage ? parseInt(service?.metadata?.memory_usage) : undefined,
        };

        serviceInstances.push(instance);
      }

      return serviceInstances;
    } catch (error) {
      logger.error('Failed to get available services', 'LOAD_BALANCER', {
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Handle sticky session routing
   */
  private handleStickySession(services: ServiceInstance[], clientId: string): ServiceInstance | null {
    const stickyServiceId = this?.stickySessionMap?.get(clientId);
    
    if (stickyServiceId) {
      const stickyService = services.find(s => s.id === stickyServiceId);
      if (stickyService) {
        return stickyService;
      } else {
        // Remove stale sticky session
        this?.stickySessionMap?.delete(clientId);
      }
    }
    
    return null;
  }

  /**
   * Track service selection for metrics
   */
  private async trackServiceSelection(service: ServiceInstance, startTime: number): Promise<void> {
    const selectionTime = Date.now() - startTime;
    
    // Update connection count
    const currentConnections = this?.connectionCounts?.get(service.id) || 0;
    this?.connectionCounts?.set(service.id, currentConnections + 1);
    
    // Record metrics
    if (metrics && typeof metrics.increment === 'function') {
      metrics.increment('load_balancer.selection.success', 1);
    }
    if (metrics && typeof metrics.histogram === 'function') {
      metrics.histogram('load_balancer.selection_time', selectionTime);
    }
    if (metrics && typeof metrics.gauge === 'function') {
      metrics.gauge('load_balancer.connections', currentConnections + 1, {
        service_id: service.id,
        service_name: service.name,
      });
    }
  }

  /**
   * Report request completion for metrics
   */
  async reportRequestCompletion(
    serviceId: string, 
    responseTime: number, 
    success: boolean
  ): Promise<void> {
    // Update connection count
    const currentConnections = this?.connectionCounts?.get(serviceId) || 0;
    this?.connectionCounts?.set(serviceId, Math.max(0, currentConnections - 1));
    
    // Update response time history
    const history = this?.responseTimesHistory?.get(serviceId) || [];
    history.push(responseTime);
    
    if ((history?.length || 0) > this.MAX_RESPONSE_TIME_HISTORY) {
      history.shift();
    }
    
    this?.responseTimesHistory?.set(serviceId, history);
    
    // Record metrics
    if (metrics && typeof metrics.histogram === 'function') {
      metrics.histogram('load_balancer.response_time', responseTime, {
        service_id: serviceId,
        success: success.toString(),
      });
    }
    
    if (metrics && typeof metrics.gauge === 'function') {
      metrics.gauge('load_balancer.connections', Math.max(0, currentConnections - 1), {
        service_id: serviceId,
      });
    }

    if (!success) {
      if (metrics && typeof metrics.increment === 'function') {
        metrics.increment('load_balancer.request.failed', 1, {
          service_id: serviceId,
        });
      }
    } else {
      if (metrics && typeof metrics.increment === 'function') {
        metrics.increment('load_balancer.request.success', 1, {
          service_id: serviceId,
        });
      }
    }
  }

  /**
   * Get average response time for a service
   */
  private getAverageResponseTime(serviceId: string): number {
    const history = this?.responseTimesHistory?.get(serviceId) || [];
    if ((history?.length || 0) === 0) return 0;
    
    const sum = history.reduce((acc: any, time: any) => acc + time, 0);
    return sum / history?.length || 0;
  }

  /**
   * Check if circuit breaker is closed for a service
   */
  private isCircuitClosed(serviceId: string): boolean {
    const circuitBreaker = CircuitBreakerFactory.getInstance(serviceId);
    return circuitBreaker.isAvailable();
  }

  /**
   * Get load balancer statistics
   */
  getStats(): {
    total_selections: number;
    active_connections: number;
    sticky_sessions: number;
    strategy: LoadBalancingStrategy;
    service_stats: Array<{
      service_id: string;
      connections: number;
      avg_response_time: number;
    }>;
  } {
    const totalConnections = Array.from(this?.connectionCounts?.values()).reduce((sum: any, count: any) => sum + count, 0);
    
    const serviceStats = Array.from(this?.connectionCounts?.entries()).map(([serviceId, connections]) => ({
      service_id: serviceId,
      connections,
      avg_response_time: this.getAverageResponseTime(serviceId),
    }));

    return {
      total_selections: 0, // This would be tracked separately
      active_connections: totalConnections,
      sticky_sessions: this?.stickySessionMap?.size,
      strategy: this?.config?.strategy,
      service_stats: serviceStats,
    };
  }

  /**
   * Update load balancer configuration
   */
  updateConfig(newConfig: Partial<LoadBalancerConfig>): void {
    Object.assign(this.config, newConfig);
    
    logger.info('Load balancer config updated', 'LOAD_BALANCER', {
      config: this.config,
    });
  }

  /**
   * Clear sticky sessions
   */
  clearStickySession(clientId?: string): void {
    if (clientId) {
      this?.stickySessionMap?.delete(clientId);
    } else {
      this?.stickySessionMap?.clear();
    }
  }

  /**
   * Setup service registry event listeners
   */
  private setupServiceRegistryListeners(): void {
    serviceRegistry.on('service:deregistered', (serviceId: any) => {
      // Clean up tracking data for deregistered service
      this?.connectionCounts?.delete(serviceId);
      this?.responseTimesHistory?.delete(serviceId);
      
      // Remove sticky sessions pointing to this service
      for (const [clientId, stickyServiceId] of this?.stickySessionMap?.entries()) {
        if (stickyServiceId === serviceId) {
          this?.stickySessionMap?.delete(clientId);
        }
      }
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      const stats = this.getStats();
      
      if (metrics && typeof metrics.gauge === 'function') {
        metrics.gauge('load_balancer.active_connections', stats.active_connections);
        metrics.gauge('load_balancer.sticky_sessions', stats.sticky_sessions);
        
        // Report per-service metrics
        stats?.service_stats?.forEach(stat => {
          metrics.gauge('load_balancer.service.connections', stat.connections, {
            service_id: stat.service_id,
          });
          metrics.gauge('load_balancer.service.avg_response_time', stat.avg_response_time, {
            service_id: stat.service_id,
          });
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Graceful shutdown
   */
  shutdown(): void {
    this.removeAllListeners();
    this?.connectionCounts?.clear();
    this?.responseTimesHistory?.clear();
    this?.stickySessionMap?.clear();
    this?.roundRobinCounters?.clear();
    
    logger.info('Load balancer shutdown complete', 'LOAD_BALANCER');
  }
}

/**
 * Load balancer factory for creating instances with different configurations
 */
export class LoadBalancerFactory {
  private static instances = new Map<string, LoadBalancer>();

  static getInstance(name: string, config: LoadBalancerConfig): LoadBalancer {
    if (!this?.instances?.has(name)) {
      this?.instances?.set(name, new LoadBalancer(config));
    }
    return this?.instances?.get(name)!;
  }

  static getDefaultInstance(): LoadBalancer {
    return this.getInstance('default', {
      strategy: 'round_robin',
      healthCheckEnabled: true,
      circuitBreakerEnabled: true,
      stickySession: false,
      maxConnections: 100,
      connectionTimeout: 30000,
    });
  }

  static getAllInstances(): Map<string, LoadBalancer> {
    return new Map(this.instances);
  }

  static shutdown(): void {
    this?.instances?.forEach(lb => lb.shutdown());
    this?.instances?.clear();
  }
}