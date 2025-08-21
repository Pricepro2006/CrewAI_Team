/**
 * Walmart Grocery Agent Microservices Configuration
 * 
 * This configuration defines all Walmart-related microservices with their
 * discovery settings, load balancing strategies, and health check parameters.
 */

import { ServiceConfig } from '../discovery/ServiceDiscovery.js';
import { LoadBalancingStrategy } from '../discovery/LoadBalancer.js';

export interface WalmartServiceDefinition extends ServiceConfig {
  scaling: {
    min_instances: number;
    max_instances: number;
    auto_scale: boolean;
    cpu_threshold?: number;
    memory_threshold?: number;
  };
  dependencies: string[];
  deployment_priority: number;
}

/**
 * Walmart Grocery Agent Service Configurations
 */
export const WALMART_SERVICES: Record<string, WalmartServiceDefinition> = {
  // Main API Server - Entry point for all requests
  'walmart-api-server': {
    name: 'walmart-api-server',
    version: '1.0.0',
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    health_endpoint: '/health',
    capacity: 200,
    weight: 1,
    tags: ['walmart', 'api', 'main', 'http'],
    metadata: {
      description: 'Main Walmart API server entry point',
      environment: 'production',
      owner: 'walmart-team',
    },
    load_balancing_strategy: 'least_connections',
    health_check_interval: 15000, // 15 seconds
    health_check_timeout: 3000,
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: true,
    proxy_cache_ttl: 60, // 1 minute for API responses
    scaling: {
      min_instances: 1,
      max_instances: 3,
      auto_scale: true,
      cpu_threshold: 80,
      memory_threshold: 85,
    },
    dependencies: [],
    deployment_priority: 1,
  },

  // WebSocket Server - Real-time communication
  'walmart-websocket': {
    name: 'walmart-websocket',
    version: '1.0.0',
    host: 'localhost',
    port: 8080,
    protocol: 'ws',
    health_endpoint: '/ws-health',
    capacity: 500, // High capacity for WebSocket connections
    weight: 1,
    tags: ['walmart', 'websocket', 'realtime'],
    metadata: {
      description: 'WebSocket server for real-time updates',
      environment: 'production',
      connection_limit: '500',
    },
    load_balancing_strategy: 'least_connections', // Best for WebSocket
    health_check_interval: 20000,
    health_check_timeout: 5000,
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: false, // No caching for WebSocket
    proxy_cache_ttl: 0,
    scaling: {
      min_instances: 1,
      max_instances: 2,
      auto_scale: false, // Manual scaling for WebSocket
    },
    dependencies: ['walmart-api-server'],
    deployment_priority: 2,
  },

  // Cache Warmer - Proactive cache management
  'walmart-cache-warmer': {
    name: 'walmart-cache-warmer',
    version: '1.0.0',
    host: 'localhost',
    port: 3006,
    protocol: 'http',
    health_endpoint: '/cache/health',
    capacity: 50,
    weight: 1,
    tags: ['walmart', 'cache', 'background', 'optimization'],
    metadata: {
      description: 'Intelligent cache warming service',
      environment: 'production',
      cache_strategies: 'predictive,scheduled',
    },
    load_balancing_strategy: 'round_robin',
    health_check_interval: 30000,
    health_check_timeout: 10000,
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: false, // Cache warmer doesn't need response caching
    proxy_cache_ttl: 0,
    scaling: {
      min_instances: 1,
      max_instances: 1,
      auto_scale: false, // Single instance for cache coordination
    },
    dependencies: ['walmart-api-server'],
    deployment_priority: 5,
  },

  // Pricing Service - Scalable pricing and comparison
  'walmart-pricing': {
    name: 'walmart-pricing',
    version: '1.0.0',
    host: 'localhost',
    port: 3007,
    protocol: 'http',
    health_endpoint: '/pricing/health',
    capacity: 150,
    weight: 2, // Higher weight for pricing queries
    tags: ['walmart', 'pricing', 'comparison', 'data'],
    metadata: {
      description: 'Walmart pricing and comparison service',
      environment: 'production',
      data_sources: 'walmart_api,competitor_apis',
      update_frequency: '5m',
    },
    load_balancing_strategy: 'weighted_round_robin', // Use weight for distribution
    health_check_interval: 10000, // Fast health checks for critical service
    health_check_timeout: 3000,
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: true,
    proxy_cache_ttl: 300, // 5 minutes for pricing data
    scaling: {
      min_instances: 1,
      max_instances: 3,
      auto_scale: true,
      cpu_threshold: 70,
      memory_threshold: 80,
    },
    dependencies: ['walmart-api-server'],
    deployment_priority: 3,
  },

  // NLP Queue Service - Natural language processing
  'walmart-nlp-queue': {
    name: 'walmart-nlp-queue',
    version: '1.0.0',
    host: 'localhost',
    port: 3008,
    protocol: 'http',
    health_endpoint: '/nlp/health',
    capacity: 100,
    weight: 1,
    tags: ['walmart', 'nlp', 'ai', 'queue', 'processing'],
    metadata: {
      description: 'Natural language processing queue service',
      environment: 'production',
      models: 'llama,phi,embedding',
      queue_type: 'redis_bull',
    },
    load_balancing_strategy: 'least_response_time', // Optimize for processing time
    health_check_interval: 15000,
    health_check_timeout: 8000, // Longer timeout for AI processing
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: true,
    proxy_cache_ttl: 1800, // 30 minutes for NLP results
    scaling: {
      min_instances: 1,
      max_instances: 2,
      auto_scale: true,
      cpu_threshold: 85, // Higher threshold for AI workloads
      memory_threshold: 90,
    },
    dependencies: ['walmart-api-server'],
    deployment_priority: 4,
  },

  // Memory Monitor - System resource monitoring
  'walmart-memory-monitor': {
    name: 'walmart-memory-monitor',
    version: '1.0.0',
    host: 'localhost',
    port: 3009,
    protocol: 'http',
    health_endpoint: '/monitor/health',
    capacity: 20,
    weight: 1,
    tags: ['walmart', 'monitoring', 'memory', 'system'],
    metadata: {
      description: 'Memory and system resource monitor',
      environment: 'production',
      metrics: 'memory,cpu,disk,network',
      alert_thresholds: 'memory:90,cpu:85',
    },
    load_balancing_strategy: 'round_robin',
    health_check_interval: 5000, // Frequent monitoring checks
    health_check_timeout: 2000,
    circuit_breaker_enabled: true,
    proxy_enabled: true,
    proxy_caching_enabled: false, // Real-time monitoring data
    proxy_cache_ttl: 0,
    scaling: {
      min_instances: 1,
      max_instances: 1,
      auto_scale: false, // Single monitor instance
    },
    dependencies: [],
    deployment_priority: 6,
  },
};

/**
 * Service dependency graph for ordered deployment
 */
export const SERVICE_DEPENDENCIES = {
  'walmart-api-server': [],
  'walmart-websocket': ['walmart-api-server'],
  'walmart-pricing': ['walmart-api-server'],
  'walmart-nlp-queue': ['walmart-api-server'],
  'walmart-cache-warmer': ['walmart-api-server'],
  'walmart-memory-monitor': [],
};

/**
 * Load balancing strategies by service type
 */
export const LOAD_BALANCING_STRATEGIES: Record<string, LoadBalancingStrategy> = {
  api: 'least_connections',
  websocket: 'least_connections',
  background: 'round_robin',
  ai_processing: 'least_response_time',
  monitoring: 'round_robin',
  caching: 'round_robin',
};

/**
 * Service scaling policies
 */
export const SCALING_POLICIES = {
  api_services: {
    scale_up_threshold: 80, // CPU %
    scale_down_threshold: 30,
    scale_up_cooldown: 300, // 5 minutes
    scale_down_cooldown: 600, // 10 minutes
    max_scale_up: 1,
    max_scale_down: 1,
  },
  background_services: {
    scale_up_threshold: 90,
    scale_down_threshold: 20,
    scale_up_cooldown: 600,
    scale_down_cooldown: 900,
    max_scale_up: 1,
    max_scale_down: 1,
  },
};

/**
 * Circuit breaker configurations by service type
 */
export const CIRCUIT_BREAKER_CONFIGS = {
  critical: {
    failureThreshold: 3,
    resetTimeout: 30000, // 30 seconds
    monitoringPeriod: 60000,
    halfOpenMaxAttempts: 2,
  },
  standard: {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    monitoringPeriod: 120000,
    halfOpenMaxAttempts: 3,
  },
  background: {
    failureThreshold: 10,
    resetTimeout: 120000, // 2 minutes
    monitoringPeriod: 300000,
    halfOpenMaxAttempts: 5,
  },
};

/**
 * Health check configurations by service type
 */
export const HEALTH_CHECK_CONFIGS = {
  critical: {
    interval: 5000,
    timeout: 2000,
    retries: 2,
    expectedStatus: [200],
  },
  standard: {
    interval: 15000,
    timeout: 5000,
    retries: 3,
    expectedStatus: [200, 204],
  },
  background: {
    interval: 30000,
    timeout: 10000,
    retries: 5,
    expectedStatus: [200, 204],
  },
};

/**
 * Get service configuration by name
 */
export function getServiceConfig(serviceName: string): WalmartServiceDefinition | null {
  return WALMART_SERVICES[serviceName] || null;
}

/**
 * Get all services ordered by deployment priority
 */
export function getServicesInDeploymentOrder(): WalmartServiceDefinition[] {
  return Object.values(WALMART_SERVICES)
    .sort((a, b) => a.deployment_priority - b.deployment_priority);
}

/**
 * Get services that can be scaled
 */
export function getScalableServices(): WalmartServiceDefinition[] {
  return Object.values(WALMART_SERVICES)
    .filter(service => service?.scaling?.auto_scale);
}

/**
 * Get services by tag
 */
export function getServicesByTag(tag: string): WalmartServiceDefinition[] {
  return Object.values(WALMART_SERVICES)
    .filter(service => service?.tags?.includes(tag));
}

/**
 * Validate service configuration
 */
export function validateServiceConfig(config: WalmartServiceDefinition): string[] {
  const errors: string[] = [];

  // Check for port conflicts
  const allServices = Object.values(WALMART_SERVICES);
  const conflictingService = allServices.find(
    service => service.port === config.port && service.name !== config.name
  );
  
  if (conflictingService) {
    errors.push(`Port ${config.port} conflicts with service ${conflictingService.name}`);
  }

  // Validate dependencies
  for (const dependency of config.dependencies) {
    if (!WALMART_SERVICES[dependency]) {
      errors.push(`Unknown dependency: ${dependency}`);
    }
  }

  // Validate scaling configuration
  if (config?.scaling?.min_instances > config?.scaling?.max_instances) {
    errors.push('min_instances cannot be greater than max_instances');
  }

  if (config?.scaling?.auto_scale && (!config?.scaling?.cpu_threshold || !config?.scaling?.memory_threshold)) {
    errors.push('Auto-scaling requires cpu_threshold and memory_threshold');
  }

  return errors;
}

/**
 * Generate deployment manifest for all services
 */
export function generateDeploymentManifest(): {
  services: WalmartServiceDefinition[];
  total_services: number;
  total_min_instances: number;
  total_max_instances: number;
  deployment_order: string[];
} {
  const services = getServicesInDeploymentOrder();
  
  return {
    services,
    total_services: services?.length || 0,
    total_min_instances: services.reduce((sum: any, s: any) => sum + s?.scaling?.min_instances, 0),
    total_max_instances: services.reduce((sum: any, s: any) => sum + s?.scaling?.max_instances, 0),
    deployment_order: services?.map(s => s.name),
  };
}