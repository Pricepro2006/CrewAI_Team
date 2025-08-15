/**
 * Service Discovery for NLP Microservice
 * Handles service registration, discovery, and heartbeat mechanisms
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import type { NLPServiceConfig } from '../types/index.js';

export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  grpcPort?: number;
  protocol: 'http' | 'https' | 'grpc';
  endpoints: {
    health: string;
    metrics: string;
    api: string;
  };
  metadata: {
    capabilities: string[];
    environment: string;
    startedAt: number;
    lastHeartbeat: number;
  };
  tags: string[];
}

export interface ServiceInstance {
  id: string;
  name: string;
  version: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc';
  healthy: boolean;
  lastSeen: number;
  metadata: Record<string, any>;
}

export interface DiscoveryBackend {
  register(registration: ServiceRegistration): Promise<void>;
  deregister(serviceId: string): Promise<void>;
  updateHeartbeat(serviceId: string): Promise<void>;
  discover(serviceName: string): Promise<ServiceInstance[]>;
  watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): () => void;
}

/**
 * Consul Discovery Backend
 */
class ConsulDiscoveryBackend implements DiscoveryBackend {
  private consulUrl: string;
  private watchers = new Map<string, Set<(instances: ServiceInstance[]) => void>>();

  constructor(consulUrl: string) {
    this.consulUrl = consulUrl;
  }

  async register(registration: ServiceRegistration): Promise<void> {
    // Consul service registration
    const consulService = {
      ID: registration.id,
      Name: registration.name,
      Tags: registration.tags,
      Address: registration.host,
      Port: registration.port,
      Meta: {
        version: registration.version,
        protocol: registration.protocol,
        grpcPort: registration.grpcPort?.toString(),
        ...registration.metadata
      },
      Check: {
        HTTP: `${registration.protocol}://${registration.host}:${registration.port}${registration?.endpoints?.health}`,
        Interval: '10s',
        Timeout: '5s'
      }
    };

    // Mock Consul registration (replace with actual HTTP call)
    logger.info('Service registered with Consul', 'SERVICE_DISCOVERY', {
      serviceId: registration.id,
      serviceName: registration.name,
      consul: this.consulUrl
    });
  }

  async deregister(serviceId: string): Promise<void> {
    // Mock Consul deregistration
    logger.info('Service deregistered from Consul', 'SERVICE_DISCOVERY', {
      serviceId,
      consul: this.consulUrl
    });
  }

  async updateHeartbeat(serviceId: string): Promise<void> {
    // Consul TTL check update (if using TTL checks instead of HTTP checks)
    logger.debug('Heartbeat updated in Consul', 'SERVICE_DISCOVERY', {
      serviceId,
      consul: this.consulUrl
    });
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    // Mock service discovery (replace with actual Consul API call)
    logger.debug('Discovering services in Consul', 'SERVICE_DISCOVERY', {
      serviceName,
      consul: this.consulUrl
    });
    
    return []; // Mock empty result
  }

  watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): () => void {
    if (!this?.watchers?.has(serviceName)) {
      this?.watchers?.set(serviceName, new Set());
    }
    
    this?.watchers?.get(serviceName)!.add(callback);
    
    // Mock watch setup
    logger.debug('Service watch established', 'SERVICE_DISCOVERY', {
      serviceName
    });
    
    // Return cleanup function
    return () => {
      this?.watchers?.get(serviceName)?.delete(callback);
    };
  }
}

/**
 * In-Memory Discovery Backend (for development/testing)
 */
class InMemoryDiscoveryBackend implements DiscoveryBackend {
  private services = new Map<string, ServiceRegistration>();
  private watchers = new Map<string, Set<(instances: ServiceInstance[]) => void>>();

  async register(registration: ServiceRegistration): Promise<void> {
    this?.services?.set(registration.id, registration);
    
    // Notify watchers
    this.notifyWatchers(registration.name);
    
    logger.info('Service registered in memory', 'SERVICE_DISCOVERY', {
      serviceId: registration.id,
      serviceName: registration.name
    });
  }

  async deregister(serviceId: string): Promise<void> {
    const service = this?.services?.get(serviceId);
    if (service) {
      this?.services?.delete(serviceId);
      this.notifyWatchers(service.name);
      
      logger.info('Service deregistered from memory', 'SERVICE_DISCOVERY', {
        serviceId,
        serviceName: service.name
      });
    }
  }

  async updateHeartbeat(serviceId: string): Promise<void> {
    const service = this?.services?.get(serviceId);
    if (service) {
      service?.metadata?.lastHeartbeat = Date.now();
      
      logger.debug('Heartbeat updated in memory', 'SERVICE_DISCOVERY', {
        serviceId
      });
    }
  }

  async discover(serviceName: string): Promise<ServiceInstance[]> {
    const instances: ServiceInstance[] = [];
    
    for (const service of this?.services?.values()) {
      if (service.name === serviceName) {
        instances.push({
          id: service.id,
          name: service.name,
          version: service.version,
          host: service.host,
          port: service.port,
          protocol: service.protocol,
          healthy: Date.now() - service?.metadata?.lastHeartbeat < 30000, // 30 seconds
          lastSeen: service?.metadata?.lastHeartbeat,
          metadata: service.metadata
        });
      }
    }
    
    logger.debug('Services discovered from memory', 'SERVICE_DISCOVERY', {
      serviceName,
      instanceCount: instances?.length || 0
    });
    
    return instances;
  }

  watch(serviceName: string, callback: (instances: ServiceInstance[]) => void): () => void {
    if (!this?.watchers?.has(serviceName)) {
      this?.watchers?.set(serviceName, new Set());
    }
    
    this?.watchers?.get(serviceName)!.add(callback);
    
    // Initial callback
    this.discover(serviceName).then(callback);
    
    return () => {
      this?.watchers?.get(serviceName)?.delete(callback);
    };
  }

  private notifyWatchers(serviceName: string): void {
    const callbacks = this?.watchers?.get(serviceName);
    if (callbacks) {
      this.discover(serviceName).then(instances => {
        callbacks.forEach(callback => callback(instances));
      });
    }
  }
}

/**
 * Service Discovery Manager
 */
export class ServiceDiscovery extends EventEmitter {
  private config: NLPServiceConfig;
  private backend: DiscoveryBackend;
  private serviceRegistration?: ServiceRegistration;
  private heartbeatInterval?: NodeJS.Timeout;
  private watchCleanupFunctions = new Map<string, () => void>();

  constructor(config: NLPServiceConfig) {
    super();
    this.config = config;
    
    // Initialize discovery backend
    if (config?.discovery?.registryUrl) {
      this.backend = new ConsulDiscoveryBackend(config?.discovery?.registryUrl);
    } else {
      this.backend = new InMemoryDiscoveryBackend();
    }
    
    logger.info('Service Discovery initialized', 'SERVICE_DISCOVERY', {
      enabled: config?.discovery?.enabled,
      backend: config?.discovery?.registryUrl ? 'consul' : 'in-memory',
      serviceName: config?.discovery?.serviceName
    });
  }

  /**
   * Start service discovery
   */
  async start(): Promise<void> {
    if (!this?.config?.discovery.enabled) {
      logger.info('Service discovery disabled', 'SERVICE_DISCOVERY');
      return;
    }

    try {
      // Create service registration
      this.serviceRegistration = this.createServiceRegistration();
      
      // Register service
      await this?.backend?.register(this.serviceRegistration);
      
      // Start heartbeat
      this.startHeartbeat();
      
      this.emit('registered', this.serviceRegistration);
      
      logger.info('Service discovery started', 'SERVICE_DISCOVERY', {
        serviceId: this?.serviceRegistration?.id,
        serviceName: this?.serviceRegistration?.name
      });
      
    } catch (error) {
      logger.error('Failed to start service discovery', 'SERVICE_DISCOVERY', { error });
      throw error;
    }
  }

  /**
   * Stop service discovery
   */
  async stop(): Promise<void> {
    if (!this?.config?.discovery.enabled || !this.serviceRegistration) {
      return;
    }

    try {
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Clean up watches
      this.cleanupWatches();
      
      // Deregister service
      await this?.backend?.deregister(this?.serviceRegistration?.id);
      
      this.emit('deregistered', this.serviceRegistration);
      
      logger.info('Service discovery stopped', 'SERVICE_DISCOVERY', {
        serviceId: this?.serviceRegistration?.id
      });
      
    } catch (error) {
      logger.error('Error stopping service discovery', 'SERVICE_DISCOVERY', { error });
      throw error;
    }
  }

  /**
   * Discover services by name
   */
  async discoverServices(serviceName: string): Promise<ServiceInstance[]> {
    try {
      const instances = await this?.backend?.discover(serviceName);
      
      logger.debug('Services discovered', 'SERVICE_DISCOVERY', {
        serviceName,
        instanceCount: instances?.length || 0
      });
      
      return instances;
    } catch (error) {
      logger.error('Service discovery failed', 'SERVICE_DISCOVERY', {
        serviceName,
        error
      });
      return [];
    }
  }

  /**
   * Watch for service changes
   */
  watchServices(
    serviceName: string,
    callback: (instances: ServiceInstance[]) => void
  ): () => void {
    const cleanup = this?.backend?.watch(serviceName, callback);
    this?.watchCleanupFunctions?.set(serviceName, cleanup);
    
    logger.debug('Service watch started', 'SERVICE_DISCOVERY', {
      serviceName
    });
    
    return cleanup;
  }

  /**
   * Get current service registration
   */
  getServiceRegistration(): ServiceRegistration | undefined {
    return this.serviceRegistration;
  }

  /**
   * Update service metadata
   */
  async updateServiceMetadata(metadata: Record<string, any>): Promise<void> {
    if (!this.serviceRegistration) {
      return;
    }

    Object.assign(this?.serviceRegistration?.metadata, metadata);
    
    // Re-register with updated metadata
    await this?.backend?.register(this.serviceRegistration);
    
    logger.info('Service metadata updated', 'SERVICE_DISCOVERY', {
      serviceId: this?.serviceRegistration?.id,
      metadata
    });
  }

  /**
   * Create service registration object
   */
  private createServiceRegistration(): ServiceRegistration {
    const serviceId = `${this?.config?.discovery.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    return {
      id: serviceId,
      name: this?.config?.discovery.serviceName,
      version: this?.config?.discovery.serviceVersion,
      host: this?.config?.host,
      port: this?.config?.port,
      grpcPort: this?.config?.grpcPort,
      protocol: 'http',
      endpoints: {
        health: '/health',
        metrics: '/metrics',
        api: '/api/v1'
      },
      metadata: {
        capabilities: [
          'nlp-processing',
          'batch-processing',
          'grocery-parsing',
          'entity-extraction',
          'intent-detection'
        ],
        environment: this?.config?.environment,
        startedAt: now,
        lastHeartbeat: now
      },
      tags: [
        'nlp',
        'microservice',
        'grocery',
        this?.config?.environment
      ]
    };
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (!this.serviceRegistration) return;

    this.heartbeatInterval = setInterval(async () => {
      try {
        if (this.serviceRegistration) {
          this?.serviceRegistration?.metadata.lastHeartbeat = Date.now();
          await this?.backend?.updateHeartbeat(this?.serviceRegistration?.id);
          
          this.emit('heartbeat', {
            serviceId: this?.serviceRegistration?.id,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        logger.error('Heartbeat failed', 'SERVICE_DISCOVERY', { error });
        this.emit('heartbeatFailed', error);
      }
    }, this?.config?.discovery.heartbeatInterval);
    
    logger.debug('Heartbeat started', 'SERVICE_DISCOVERY', {
      interval: this?.config?.discovery.heartbeatInterval
    });
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
      
      logger.debug('Heartbeat stopped', 'SERVICE_DISCOVERY');
    }
  }

  /**
   * Clean up all watches
   */
  private cleanupWatches(): void {
    for (const [serviceName, cleanup] of this.watchCleanupFunctions) {
      cleanup();
      logger.debug('Service watch cleaned up', 'SERVICE_DISCOVERY', {
        serviceName
      });
    }
    
    this?.watchCleanupFunctions?.clear();
  }

  /**
   * Get service health for registration
   */
  private getServiceHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    // This would integrate with the health monitor
    return 'healthy'; // Simplified for now
  }
}