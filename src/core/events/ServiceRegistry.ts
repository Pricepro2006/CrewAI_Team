import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { z } from 'zod';
import { nanoid } from 'nanoid';

// Service registry schemas and types
export const ServiceInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  type: z.string().default('microservice'),
  status: z.enum(['starting', 'healthy', 'unhealthy', 'stopping', 'stopped']).default('starting'),
  address: z.object({
    host: z.string(),
    port: z.number(),
    protocol: z.enum(['http', 'https', 'grpc', 'ws', 'wss']).default('http')
  }),
  endpoints: z.array(z.object({
    path: z.string(),
    method: z.string().default('POST'),
    description: z.string().optional()
  })).default([]),
  capabilities: z.array(z.string()).default([]),
  eventTypes: z.object({
    publishes: z.array(z.string()).default([]),
    subscribes: z.array(z.string()).default([])
  }).default({ publishes: [], subscribes: [] }),
  metadata: z.record(z.any()).default({}),
  health: z.object({
    endpoint: z.string().default('/health'),
    interval: z.number().default(30000), // 30 seconds
    timeout: z.number().default(5000), // 5 seconds
    retries: z.number().default(3)
  }).default({}),
  registeredAt: z.number(),
  lastSeen: z.number(),
  heartbeatInterval: z.number().default(15000) // 15 seconds
});

export const ServiceDiscoveryConfigSchema = z.object({
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
    db: z.number().default(5), // Separate DB for service registry
    keyPrefix: z.string().default('services:')
  }),
  discovery: z.object({
    healthCheckInterval: z.number().default(30000),
    serviceTimeout: z.number().default(60000), // Consider service unhealthy after 1 minute
    cleanupInterval: z.number().default(120000), // Clean up stale services every 2 minutes
    enableLoadBalancing: z.boolean().default(true),
    loadBalancingStrategy: z.enum(['round_robin', 'least_connections', 'random', 'weighted']).default('round_robin')
  }),
  notifications: z.object({
    enableNotifications: z.boolean().default(true),
    notifyOnServiceUp: z.boolean().default(true),
    notifyOnServiceDown: z.boolean().default(true),
    notifyOnHealthChange: z.boolean().default(true)
  })
});

export type ServiceInfo = z.infer<typeof ServiceInfoSchema>;
export type ServiceDiscoveryConfig = z.infer<typeof ServiceDiscoveryConfigSchema>;

export interface ServiceQuery {
  name?: string;
  type?: string;
  capability?: string;
  eventType?: string;
  status?: ServiceInfo['status'];
  version?: string;
  tags?: string[];
}

export interface LoadBalancerState {
  roundRobinIndex: Map<string, number>;
  connectionCounts: Map<string, number>;
  weights: Map<string, number>;
}

/**
 * ServiceRegistry - Advanced service discovery and registration system
 * 
 * Features:
 * - Automatic service registration and heartbeat
 * - Health checking and status monitoring
 * - Load balancing with multiple strategies
 * - Service capabilities and event type tracking
 * - Advanced service querying and filtering
 * - Notification system for service state changes
 */
export class ServiceRegistry extends EventEmitter {
  private config: ServiceDiscoveryConfig;
  private client: Redis;
  private isConnected = false;
  
  private services = new Map<string, ServiceInfo>();
  private localServiceId?: string;
  private heartbeatTimer?: NodeJS.Timeout;
  private healthCheckTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  
  private loadBalancerState: LoadBalancerState = {
    roundRobinIndex: new Map(),
    connectionCounts: new Map(),
    weights: new Map()
  };

  constructor(config: Partial<ServiceDiscoveryConfig> = {}) {
    super();
    this.config = ServiceDiscoveryConfigSchema.parse(config);
    this.initializeRedisClient();
    this.startPeriodicTasks();
  }

  private initializeRedisClient(): void {
    this.client = new Redis({
      host: this?.config?.redis.host,
      port: this?.config?.redis.port,
      password: this?.config?.redis.password,
      db: this?.config?.redis.db,
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true
    });

    this?.client?.on('connect', () => {
      this.isConnected = true;
      this.emit('connected');
      this.loadServicesFromRedis();
    });

    this?.client?.on('error', (error: any) => {
      this.isConnected = false;
      this.emit('error', error);
    });

    // Subscribe to service notifications
    this?.client?.on('message', (channel, message) => {
      this.handleServiceNotification(channel, message);
    });
  }

  private startPeriodicTasks(): void {
    // Health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this?.config?.discovery.healthCheckInterval);

    // Cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleServices();
    }, this?.config?.discovery.cleanupInterval);
  }

  // Core service registry operations
  public async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      await this?.client?.connect();
      console.log('ServiceRegistry connected to Redis');
    } catch (error) {
      this.emit('connection_error', error);
      throw error;
    }
  }

  public async registerService(serviceInfo: Omit<ServiceInfo, 'id' | 'registeredAt' | 'lastSeen'>): Promise<string> {
    if (!this.isConnected) {
      throw new Error('ServiceRegistry is not connected');
    }

    const now = Date.now();
    const service: ServiceInfo = {
      ...serviceInfo,
      id: nanoid(),
      registeredAt: now,
      lastSeen: now
    };

    // Validate service info
    ServiceInfoSchema.parse(service);

    try {
      const serviceKey = this.getServiceKey(service.id);
      const serviceData = this.serializeService(service);

      // Store service in Redis
      await this?.client?.hset(serviceKey, serviceData);
      await this?.client?.expire(serviceKey, 300); // 5 minutes TTL

      // Add to service name index
      await this?.client?.sadd(
        `${this?.config?.redis.keyPrefix}by_name:${service.name}`,
        service.id
      );

      // Add to service type index
      await this?.client?.sadd(
        `${this?.config?.redis.keyPrefix}by_type:${service.type}`,
        service.id
      );

      // Add to capability indexes
      for (const capability of service.capabilities) {
        await this?.client?.sadd(
          `${this?.config?.redis.keyPrefix}by_capability:${capability}`,
          service.id
        );
      }

      // Add to event type indexes
      for (const eventType of service?.eventTypes?.publishes) {
        await this?.client?.sadd(
          `${this?.config?.redis.keyPrefix}publishers:${eventType}`,
          service.id
        );
      }

      for (const eventType of service?.eventTypes?.subscribes) {
        await this?.client?.sadd(
          `${this?.config?.redis.keyPrefix}subscribers:${eventType}`,
          service.id
        );
      }

      // Cache locally
      this?.services?.set(service.id, service);
      this.localServiceId = service.id;

      // Start heartbeat for this service
      this.startHeartbeat(service.id);

      // Notify about service registration
      if (this?.config?.notifications.enableNotifications && 
          this?.config?.notifications.notifyOnServiceUp) {
        await this.publishServiceNotification('service:registered', service);
      }

      this.emit('service_registered', {
        serviceId: service.id,
        serviceName: service.name,
        serviceType: service.type
      });

      console.log(`Service registered: ${service.name}@${service.id}`);
      return service.id;

    } catch (error) {
      this.emit('registration_error', { serviceInfo, error });
      throw error;
    }
  }

  public async updateService(serviceId: string, updates: Partial<ServiceInfo>): Promise<void> {
    if (!this.isConnected) {
      throw new Error('ServiceRegistry is not connected');
    }

    try {
      const existingService = await this.getService(serviceId);
      if (!existingService) {
        throw new Error(`Service ${serviceId} not found`);
      }

      const updatedService: ServiceInfo = {
        ...existingService,
        ...updates,
        lastSeen: Date.now()
      };

      // Validate updated service
      ServiceInfoSchema.parse(updatedService);

      const serviceKey = this.getServiceKey(serviceId);
      const serviceData = this.serializeService(updatedService);

      await this?.client?.hset(serviceKey, serviceData);

      // Update local cache
      this?.services?.set(serviceId, updatedService);

      // Notify about status change if applicable
      if (updates.status && updates.status !== existingService.status &&
          this?.config?.notifications.enableNotifications &&
          this?.config?.notifications.notifyOnHealthChange) {
        await this.publishServiceNotification('service:status_changed', updatedService);
      }

      this.emit('service_updated', {
        serviceId,
        changes: Object.keys(updates)
      });

    } catch (error) {
      this.emit('update_error', { serviceId, updates, error });
      throw error;
    }
  }

  public async unregisterService(serviceId: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('ServiceRegistry is not connected');
    }

    try {
      const service = await this.getService(serviceId);
      if (!service) {
        return; // Already unregistered
      }

      const serviceKey = this.getServiceKey(serviceId);
      
      // Remove from Redis
      await this?.client?.del(serviceKey);

      // Remove from indexes
      await this?.client?.srem(`${this?.config?.redis.keyPrefix}by_name:${service.name}`, serviceId);
      await this?.client?.srem(`${this?.config?.redis.keyPrefix}by_type:${service.type}`, serviceId);

      for (const capability of service.capabilities) {
        await this?.client?.srem(
          `${this?.config?.redis.keyPrefix}by_capability:${capability}`,
          serviceId
        );
      }

      for (const eventType of service?.eventTypes?.publishes) {
        await this?.client?.srem(
          `${this?.config?.redis.keyPrefix}publishers:${eventType}`,
          serviceId
        );
      }

      for (const eventType of service?.eventTypes?.subscribes) {
        await this?.client?.srem(
          `${this?.config?.redis.keyPrefix}subscribers:${eventType}`,
          serviceId
        );
      }

      // Remove from local cache
      this?.services?.delete(serviceId);

      // Stop heartbeat if this is our local service
      if (this.localServiceId === serviceId) {
        this.stopHeartbeat();
        this.localServiceId = undefined;
      }

      // Notify about service unregistration
      if (this?.config?.notifications.enableNotifications && 
          this?.config?.notifications.notifyOnServiceDown) {
        await this.publishServiceNotification('service:unregistered', service);
      }

      this.emit('service_unregistered', {
        serviceId,
        serviceName: service.name
      });

      console.log(`Service unregistered: ${service.name}@${serviceId}`);

    } catch (error) {
      this.emit('unregistration_error', { serviceId, error });
      throw error;
    }
  }

  // Service discovery methods
  public async discoverServices(query: ServiceQuery = {}): Promise<ServiceInfo[]> {
    if (!this.isConnected) {
      throw new Error('ServiceRegistry is not connected');
    }

    try {
      let serviceIds: Set<string> = new Set();

      if (query.name) {
        const nameMembers = await this?.client?.smembers(
          `${this?.config?.redis.keyPrefix}by_name:${query.name}`
        );
        serviceIds = new Set(nameMembers);
      }

      if (query.type) {
        const typeMembers = await this?.client?.smembers(
          `${this?.config?.redis.keyPrefix}by_type:${query.type}`
        );
        if (serviceIds.size === 0) {
          serviceIds = new Set(typeMembers);
        } else {
          serviceIds = new Set([...serviceIds].filter(id => typeMembers.includes(id)));
        }
      }

      if (query.capability) {
        const capabilityMembers = await this?.client?.smembers(
          `${this?.config?.redis.keyPrefix}by_capability:${query.capability}`
        );
        if (serviceIds.size === 0) {
          serviceIds = new Set(capabilityMembers);
        } else {
          serviceIds = new Set([...serviceIds].filter(id => capabilityMembers.includes(id)));
        }
      }

      if (query.eventType) {
        const publishers = await this?.client?.smembers(
          `${this?.config?.redis.keyPrefix}publishers:${query.eventType}`
        );
        const subscribers = await this?.client?.smembers(
          `${this?.config?.redis.keyPrefix}subscribers:${query.eventType}`
        );
        const eventMembers = [...publishers, ...subscribers];
        
        if (serviceIds.size === 0) {
          serviceIds = new Set(eventMembers);
        } else {
          serviceIds = new Set([...serviceIds].filter(id => eventMembers.includes(id)));
        }
      }

      // If no specific query, get all services
      if (serviceIds.size === 0 && Object.keys(query).length === 0) {
        const allKeys = await this?.client?.keys(`${this?.config?.redis.keyPrefix}service:*`);
        serviceIds = new Set(allKeys?.map(key => key.split(':').pop()!));
      }

      // Fetch service details
      const services: ServiceInfo[] = [];
      for (const serviceId of serviceIds) {
        const service = await this.getService(serviceId);
        if (service) {
          // Apply additional filters
          if (query.status && service.status !== query.status) continue;
          if (query.version && service.version !== query.version) continue;
          
          services.push(service);
        }
      }

      // Sort by registration time (newest first)
      services.sort((a, b) => b.registeredAt - a.registeredAt);

      this.emit('services_discovered', {
        query,
        resultCount: services?.length || 0
      });

      return services;

    } catch (error) {
      this.emit('discovery_error', { query, error });
      throw error;
    }
  }

  public async getService(serviceId: string): Promise<ServiceInfo | null> {
    // Check local cache first
    if (this?.services?.has(serviceId)) {
      return this?.services?.get(serviceId)!;
    }

    if (!this.isConnected) {
      return null;
    }

    try {
      const serviceKey = this.getServiceKey(serviceId);
      const serviceData = await this?.client?.hgetall(serviceKey);

      if (Object.keys(serviceData).length === 0) {
        return null;
      }

      const service = this.deserializeService(serviceData);
      
      // Cache locally
      this?.services?.set(serviceId, service);
      
      return service;

    } catch (error) {
      this.emit('get_service_error', { serviceId, error });
      return null;
    }
  }

  public async getServiceByName(serviceName: string): Promise<ServiceInfo[]> {
    return await this.discoverServices({ name: serviceName });
  }

  public async getHealthyService(serviceName: string): Promise<ServiceInfo | null> {
    const services = await this.getServiceByName(serviceName);
    const healthyServices = services?.filter(s => s.status === 'healthy');
    
    if (healthyServices?.length || 0 === 0) {
      return null;
    }

    return this.selectServiceByLoadBalancing(serviceName, healthyServices);
  }

  // Load balancing
  private selectServiceByLoadBalancing(serviceName: string, services: ServiceInfo[]): ServiceInfo {
    const strategy = this?.config?.discovery.loadBalancingStrategy;

    switch (strategy) {
      case 'round_robin':
        return this.selectRoundRobin(serviceName, services);
      
      case 'least_connections':
        return this.selectLeastConnections(services);
      
      case 'random':
        return services[Math.floor(Math.random() * services?.length || 0)];
      
      case 'weighted':
        return this.selectWeighted(services);
      
      default:
        return services[0];
    }
  }

  private selectRoundRobin(serviceName: string, services: ServiceInfo[]): ServiceInfo {
    if (!this?.loadBalancerState?.roundRobinIndex.has(serviceName)) {
      this?.loadBalancerState?.roundRobinIndex.set(serviceName, 0);
    }

    const currentIndex = this?.loadBalancerState?.roundRobinIndex.get(serviceName)!;
    const selectedService = services[currentIndex % services?.length || 0];
    
    this?.loadBalancerState?.roundRobinIndex.set(serviceName, currentIndex + 1);
    
    return selectedService;
  }

  private selectLeastConnections(services: ServiceInfo[]): ServiceInfo {
    let minConnections = Infinity;
    let selectedService = services[0];

    for (const service of services) {
      const connections = this?.loadBalancerState?.connectionCounts.get(service.id) || 0;
      if (connections < minConnections) {
        minConnections = connections;
        selectedService = service;
      }
    }

    return selectedService;
  }

  private selectWeighted(services: ServiceInfo[]): ServiceInfo {
    const totalWeight = services.reduce((sum: any, service: any) => {
      return sum + (this?.loadBalancerState?.weights.get(service.id) || 1);
    }, 0);

    const random = Math.random() * totalWeight;
    let weightSum = 0;

    for (const service of services) {
      weightSum += this?.loadBalancerState?.weights.get(service.id) || 1;
      if (random <= weightSum) {
        return service;
      }
    }

    return services[services?.length || 0 - 1];
  }

  public incrementConnectionCount(serviceId: string): void {
    const current = this?.loadBalancerState?.connectionCounts.get(serviceId) || 0;
    this?.loadBalancerState?.connectionCounts.set(serviceId, current + 1);
  }

  public decrementConnectionCount(serviceId: string): void {
    const current = this?.loadBalancerState?.connectionCounts.get(serviceId) || 0;
    this?.loadBalancerState?.connectionCounts.set(serviceId, Math.max(0, current - 1));
  }

  public setServiceWeight(serviceId: string, weight: number): void {
    this?.loadBalancerState?.weights.set(serviceId, weight);
  }

  // Heartbeat and health checking
  private startHeartbeat(serviceId: string): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.sendHeartbeat(serviceId);
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    }, 15000); // 15 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private async sendHeartbeat(serviceId: string): Promise<void> {
    const serviceKey = this.getServiceKey(serviceId);
    const now = Date.now();

    await this?.client?.hset(serviceKey, 'lastSeen', now.toString());
    await this?.client?.expire(serviceKey, 300); // Refresh TTL

    // Update local cache
    const service = this?.services?.get(serviceId);
    if (service) {
      service.lastSeen = now;
    }
  }

  private async performHealthChecks(): Promise<void> {
    const services = Array.from(this?.services?.values());
    const healthCheckPromises = services?.map(service => this.checkServiceHealth(service));
    
    await Promise.allSettled(healthCheckPromises);
  }

  private async checkServiceHealth(service: ServiceInfo): Promise<void> {
    try {
      const healthUrl = `${service?.address?.protocol}://${service?.address?.host}:${service?.address?.port}${service?.health?.endpoint}`;
      
      // Simplified health check - in production, use proper HTTP client
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), service?.health?.timeout);

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: { 'User-Agent': 'ServiceRegistry/1.0' }
        });

        clearTimeout(timeoutId);

        const isHealthy = response?.ok;
        const newStatus: ServiceInfo['status'] = isHealthy ? 'healthy' : 'unhealthy';

        if (service.status !== newStatus) {
          await this.updateService(service.id, { status: newStatus });
        }

      } catch (error) {
        clearTimeout(timeoutId);
        await this.updateService(service.id, { status: 'unhealthy' });
      }

    } catch (error) {
      this.emit('health_check_error', { serviceId: service.id, error });
    }
  }

  private async cleanupStaleServices(): Promise<void> {
    const now = Date.now();
    const staleThreshold = now - this?.config?.discovery.serviceTimeout;

    for (const [serviceId, service] of this.services) {
      if (service.lastSeen < staleThreshold && service.id !== this.localServiceId) {
        console.log(`Cleaning up stale service: ${service.name}@${serviceId}`);
        await this.unregisterService(serviceId);
      }
    }
  }

  // Notification system
  private async publishServiceNotification(type: string, service: ServiceInfo): Promise<void> {
    const notificationChannel = `${this?.config?.redis.keyPrefix}notifications`;
    const notification = {
      type,
      service: {
        id: service.id,
        name: service.name,
        type: service.type,
        status: service.status,
        address: service.address
      },
      timestamp: Date.now()
    };

    await this?.client?.publish(notificationChannel, JSON.stringify(notification));
  }

  private handleServiceNotification(channel: string, message: string): void {
    try {
      const notification = JSON.parse(message);
      this.emit('service_notification', notification);
    } catch (error) {
      console.error('Failed to parse service notification:', error);
    }
  }

  // Utility methods
  private async loadServicesFromRedis(): Promise<void> {
    try {
      const serviceKeys = await this?.client?.keys(`${this?.config?.redis.keyPrefix}service:*`);
      
      for (const key of serviceKeys) {
        const serviceData = await this?.client?.hgetall(key);
        if (Object.keys(serviceData).length > 0) {
          const service = this.deserializeService(serviceData);
          this?.services?.set(service.id, service);
        }
      }

      console.log(`Loaded ${this?.services?.size} services from Redis`);

    } catch (error) {
      console.error('Failed to load services from Redis:', error);
    }
  }

  private getServiceKey(serviceId: string): string {
    return `${this?.config?.redis.keyPrefix}service:${serviceId}`;
  }

  private serializeService(service: ServiceInfo): Record<string, string> {
    return {
      id: service.id,
      name: service.name,
      version: service.version,
      type: service.type,
      status: service.status,
      address: JSON.stringify(service.address),
      endpoints: JSON.stringify(service.endpoints),
      capabilities: JSON.stringify(service.capabilities),
      eventTypes: JSON.stringify(service.eventTypes),
      metadata: JSON.stringify(service.metadata),
      health: JSON.stringify(service.health),
      registeredAt: service?.registeredAt?.toString(),
      lastSeen: service?.lastSeen?.toString(),
      heartbeatInterval: service?.heartbeatInterval?.toString()
    };
  }

  private deserializeService(data: Record<string, string>): ServiceInfo {
    return {
      id: data.id,
      name: data.name,
      version: data.version,
      type: data.type,
      status: data.status as ServiceInfo['status'],
      address: JSON.parse(data.address),
      endpoints: JSON.parse(data.endpoints || '[]'),
      capabilities: JSON.parse(data.capabilities || '[]'),
      eventTypes: JSON.parse(data.eventTypes || '{"publishes":[],"subscribes":[]}'),
      metadata: JSON.parse(data.metadata || '{}'),
      health: JSON.parse(data.health || '{"endpoint":"/health","interval":30000,"timeout":5000,"retries":3}'),
      registeredAt: parseInt(data.registeredAt),
      lastSeen: parseInt(data.lastSeen),
      heartbeatInterval: parseInt(data.heartbeatInterval || '15000')
    };
  }

  // Public API methods
  public getStats(): {
    connected: boolean;
    totalServices: number;
    healthyServices: number;
    servicesByType: Record<string, number>;
    loadBalancerStats: LoadBalancerState;
  } {
    const services = Array.from(this?.services?.values());
    const healthyCount = services?.filter(s => s.status === 'healthy').length;
    
    const servicesByType = services.reduce((acc: any, service: any) => {
      acc[service.type] = (acc[service.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      connected: this.isConnected,
      totalServices: services?.length || 0,
      healthyServices: healthyCount,
      servicesByType,
      loadBalancerStats: this.loadBalancerState
    };
  }

  public listServices(): ServiceInfo[] {
    return Array.from(this?.services?.values());
  }

  public async shutdown(): Promise<void> {
    // Unregister local service if any
    if (this.localServiceId) {
      await this.unregisterService(this.localServiceId);
    }

    // Clear timers
    this.stopHeartbeat();
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Close Redis connection
    try {
      await this?.client?.quit();
      this.isConnected = false;
      this.emit('shutdown');
    } catch (error) {
      this.emit('shutdown_error', error);
      throw error;
    }
  }
}