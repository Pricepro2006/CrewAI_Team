/**
 * Redis-based Service Registry for Microservices Discovery
 * 
 * Features:
 * - Auto-registration with health status
 * - Service metadata storage
 * - TTL-based service expiration
 * - Event-driven service updates
 * - Circuit breaker integration
 */

import { redisClient } from '../../config/redis.config.js';
import { logger } from '../../utils/logger.js';
import { EventEmitter } from 'events';
import { z } from 'zod';

export const ServiceMetadataSchema = z.object({
  id: z.string(),
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
  registered_at: z.date().optional(),
  last_heartbeat: z.date().optional(),
  status: z.enum(['healthy', 'unhealthy', 'unknown']).default('unknown')
});

export type ServiceMetadata = z.infer<typeof ServiceMetadataSchema>;

export interface ServiceRegistryEvents {
  'service:registered': (service: ServiceMetadata) => void;
  'service:updated': (service: ServiceMetadata, previous: ServiceMetadata) => void;
  'service:deregistered': (serviceId: string) => void;
  'service:health_changed': (serviceId: string, status: 'healthy' | 'unhealthy') => void;
}

export class ServiceRegistry extends EventEmitter {
  private static instance: ServiceRegistry | null = null;
  private readonly SERVICE_KEY_PREFIX = 'services:';
  private readonly SERVICE_LIST_KEY = 'services:list';
  private readonly HEARTBEAT_KEY_PREFIX = 'heartbeat:';
  private readonly DEFAULT_TTL = 30; // seconds
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    this.setupCleanupInterval();
  }

  public static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Register a service in the registry
   */
  async register(service: Omit<ServiceMetadata, 'registered_at' | 'last_heartbeat'>): Promise<boolean> {
    try {
      const validatedService = ServiceMetadataSchema.parse({
        ...service,
        registered_at: new Date(),
        last_heartbeat: new Date(),
      });

      const serviceKey = this.getServiceKey(validatedService.id);
      const serviceData = JSON.stringify({
        ...validatedService,
        registered_at: validatedService.registered_at?.toISOString(),
        last_heartbeat: validatedService.last_heartbeat?.toISOString(),
      });

      // Store service data with TTL
      await redisClient.setex(serviceKey, this.DEFAULT_TTL * 2, serviceData);
      
      // Add to services list
      await redisClient.sadd(this.SERVICE_LIST_KEY, validatedService.id);
      
      // Set initial heartbeat
      await this.updateHeartbeat(validatedService.id);

      logger.info('Service registered', 'SERVICE_REGISTRY', {
        id: validatedService.id,
        name: validatedService.name,
        endpoint: `${validatedService.protocol}://${validatedService.host}:${validatedService.port}`,
      });

      this.emit('service:registered', validatedService);
      return true;
    } catch (error) {
      logger.error('Service registration failed', 'SERVICE_REGISTRY', {
        service: service.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Update service metadata
   */
  async update(serviceId: string, updates: Partial<ServiceMetadata>): Promise<boolean> {
    try {
      const currentService = await this.get(serviceId);
      if (!currentService) {
        logger.warn('Cannot update non-existent service', 'SERVICE_REGISTRY', { serviceId });
        return false;
      }

      const updatedService = ServiceMetadataSchema.parse({
        ...currentService,
        ...updates,
        last_heartbeat: new Date(),
      });

      const serviceKey = this.getServiceKey(serviceId);
      const serviceData = JSON.stringify({
        ...updatedService,
        registered_at: updatedService.registered_at?.toISOString(),
        last_heartbeat: updatedService.last_heartbeat?.toISOString(),
      });

      await redisClient.setex(serviceKey, this.DEFAULT_TTL * 2, serviceData);
      await this.updateHeartbeat(serviceId);

      logger.debug('Service updated', 'SERVICE_REGISTRY', {
        serviceId,
        updates,
      });

      this.emit('service:updated', updatedService, currentService);
      return true;
    } catch (error) {
      logger.error('Service update failed', 'SERVICE_REGISTRY', {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Deregister a service
   */
  async deregister(serviceId: string): Promise<boolean> {
    try {
      const serviceKey = this.getServiceKey(serviceId);
      const heartbeatKey = this.getHeartbeatKey(serviceId);

      // Remove service data
      await redisClient.del(serviceKey);
      await redisClient.del(heartbeatKey);
      
      // Remove from services list
      await redisClient.srem(this.SERVICE_LIST_KEY, serviceId);

      logger.info('Service deregistered', 'SERVICE_REGISTRY', { serviceId });
      this.emit('service:deregistered', serviceId);
      
      return true;
    } catch (error) {
      logger.error('Service deregistration failed', 'SERVICE_REGISTRY', {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get service by ID
   */
  async get(serviceId: string): Promise<ServiceMetadata | null> {
    try {
      const serviceKey = this.getServiceKey(serviceId);
      const serviceData = await redisClient.get(serviceKey);
      
      if (!serviceData) {
        return null;
      }

      const parsed = JSON.parse(serviceData);
      return ServiceMetadataSchema.parse({
        ...parsed,
        registered_at: parsed.registered_at ? new Date(parsed.registered_at) : undefined,
        last_heartbeat: parsed.last_heartbeat ? new Date(parsed.last_heartbeat) : undefined,
      });
    } catch (error) {
      logger.error('Failed to get service', 'SERVICE_REGISTRY', {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all services by name
   */
  async getByName(serviceName: string): Promise<ServiceMetadata[]> {
    const allServices = await this.getAll();
    return allServices.filter(service => service.name === serviceName);
  }

  /**
   * Get services by tags
   */
  async getByTags(tags: string[]): Promise<ServiceMetadata[]> {
    const allServices = await this.getAll();
    return allServices.filter(service => 
      tags.some(tag => service.tags.includes(tag))
    );
  }

  /**
   * Get healthy services by name
   */
  async getHealthyByName(serviceName: string): Promise<ServiceMetadata[]> {
    const services = await this.getByName(serviceName);
    return services.filter(service => service.status === 'healthy');
  }

  /**
   * Get all services
   */
  async getAll(): Promise<ServiceMetadata[]> {
    try {
      const serviceIds = await redisClient.smembers(this.SERVICE_LIST_KEY);
      const services: ServiceMetadata[] = [];

      for (const serviceId of serviceIds) {
        const service = await this.get(serviceId);
        if (service) {
          services.push(service);
        }
      }

      return services;
    } catch (error) {
      logger.error('Failed to get all services', 'SERVICE_REGISTRY', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Update service heartbeat
   */
  async updateHeartbeat(serviceId: string): Promise<boolean> {
    try {
      const heartbeatKey = this.getHeartbeatKey(serviceId);
      await redisClient.setex(heartbeatKey, this.DEFAULT_TTL, Date.now().toString());
      
      // Update last_heartbeat in service data
      const service = await this.get(serviceId);
      if (service) {
        await this.update(serviceId, { last_heartbeat: new Date() });
      }

      return true;
    } catch (error) {
      logger.error('Failed to update heartbeat', 'SERVICE_REGISTRY', {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Check if service is alive based on heartbeat
   */
  async isServiceAlive(serviceId: string): Promise<boolean> {
    try {
      const heartbeatKey = this.getHeartbeatKey(serviceId);
      const heartbeat = await redisClient.get(heartbeatKey);
      
      if (!heartbeat) {
        return false;
      }

      const lastHeartbeat = parseInt(heartbeat);
      const now = Date.now();
      const timeDiff = now - lastHeartbeat;

      return timeDiff < (this.DEFAULT_TTL * 1000);
    } catch (error) {
      logger.error('Failed to check service heartbeat', 'SERVICE_REGISTRY', {
        serviceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Update service health status
   */
  async updateHealthStatus(serviceId: string, status: 'healthy' | 'unhealthy'): Promise<boolean> {
    const currentService = await this.get(serviceId);
    if (!currentService) {
      return false;
    }

    const previousStatus = currentService.status;
    const updated = await this.update(serviceId, { status });
    
    if (updated && previousStatus !== status) {
      this.emit('service:health_changed', serviceId, status);
    }

    return updated;
  }

  /**
   * Start heartbeat for a service
   */
  startHeartbeat(serviceId: string, interval: number = this.DEFAULT_TTL * 1000 / 3): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(async () => {
      await this.updateHeartbeat(serviceId);
    }, interval);

    logger.info('Heartbeat started', 'SERVICE_REGISTRY', {
      serviceId,
      interval,
    });
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('Heartbeat stopped', 'SERVICE_REGISTRY');
    }
  }

  /**
   * Get service discovery statistics
   */
  async getStats(): Promise<{
    total_services: number;
    healthy_services: number;
    unhealthy_services: number;
    unknown_services: number;
    services_by_type: Record<string, number>;
  }> {
    try {
      const services = await this.getAll();
      const stats = {
        total_services: services.length,
        healthy_services: services.filter(s => s.status === 'healthy').length,
        unhealthy_services: services.filter(s => s.status === 'unhealthy').length,
        unknown_services: services.filter(s => s.status === 'unknown').length,
        services_by_type: {} as Record<string, number>,
      };

      // Count services by name
      services.forEach(service => {
        stats.services_by_type[service.name] = (stats.services_by_type[service.name] || 0) + 1;
      });

      return stats;
    } catch (error) {
      logger.error('Failed to get registry stats', 'SERVICE_REGISTRY', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        total_services: 0,
        healthy_services: 0,
        unhealthy_services: 0,
        unknown_services: 0,
        services_by_type: {},
      };
    }
  }

  /**
   * Clean up expired services
   */
  private async cleanupExpiredServices(): Promise<void> {
    try {
      const serviceIds = await redisClient.smembers(this.SERVICE_LIST_KEY);
      
      for (const serviceId of serviceIds) {
        const isAlive = await this.isServiceAlive(serviceId);
        if (!isAlive) {
          await this.deregister(serviceId);
          logger.info('Expired service cleaned up', 'SERVICE_REGISTRY', { serviceId });
        }
      }
    } catch (error) {
      logger.error('Cleanup failed', 'SERVICE_REGISTRY', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup periodic cleanup
   */
  private setupCleanupInterval(): void {
    setInterval(async () => {
      await this.cleanupExpiredServices();
    }, this.DEFAULT_TTL * 1000);
  }

  /**
   * Helper methods
   */
  private getServiceKey(serviceId: string): string {
    return `${this.SERVICE_KEY_PREFIX}${serviceId}`;
  }

  private getHeartbeatKey(serviceId: string): string {
    return `${this.HEARTBEAT_KEY_PREFIX}${serviceId}`;
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();
    this.removeAllListeners();
    ServiceRegistry.instance = null;
    logger.info('Service registry shutdown complete', 'SERVICE_REGISTRY');
  }
}

// Export singleton
export const serviceRegistry = ServiceRegistry.getInstance();