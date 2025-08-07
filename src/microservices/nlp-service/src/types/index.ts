/**
 * NLP Microservice Types
 * Comprehensive type definitions for the standalone NLP service
 */

// Re-export shared types
export * from '../../../api/types/grocery-nlp.types.js';

// Service-specific types
export interface NLPServiceConfig {
  port: number;
  grpcPort: number;
  host: string;
  environment: 'development' | 'production' | 'test';
  
  // Queue configuration
  queue: {
    maxConcurrent: number;
    defaultTimeout: number;
    maxRetries: number;
    persistenceEnabled: boolean;
    persistencePath: string;
  };
  
  // Monitoring and health
  monitoring: {
    enabled: boolean;
    metricsPort?: number;
    healthCheckInterval: number;
    alertThresholds: {
      queueSize: number;
      errorRate: number;
      processingTime: number;
      memoryUsage: number;
    };
  };
  
  // Service discovery
  discovery: {
    enabled: boolean;
    serviceName: string;
    serviceVersion: string;
    registryUrl?: string;
    heartbeatInterval: number;
  };
  
  // Security
  security: {
    rateLimiting: {
      enabled: boolean;
      max: number;
      timeWindow: string;
    };
    cors: {
      enabled: boolean;
      origins: string[];
    };
    apiKeys: {
      enabled: boolean;
      required: boolean;
    };
  };
  
  // Graceful shutdown
  shutdown: {
    timeout: number;
    signals: string[];
  };
}

// Service lifecycle events
export type ServiceEvent = 
  | 'starting'
  | 'started' 
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'health-check'
  | 'metrics-update';

export interface ServiceStatus {
  service: 'nlp-service';
  version: string;
  status: 'starting' | 'healthy' | 'degraded' | 'unhealthy' | 'stopping';
  uptime: number;
  startedAt: number;
  lastHealthCheck: number;
  dependencies: {
    ollama: 'healthy' | 'unhealthy' | 'unknown';
    redis: 'healthy' | 'unhealthy' | 'unknown';
    queue: 'healthy' | 'degraded' | 'unhealthy';
  };
  resources: {
    cpu: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  queue: {
    size: number;
    activeRequests: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
  };
}

// API Contracts
export namespace NLPServiceAPI {
  // REST API types
  export namespace REST {
    export interface ProcessRequest {
      query: string;
      priority?: 'high' | 'normal' | 'low';
      timeout?: number;
      metadata?: Record<string, any>;
    }
    
    export interface ProcessResponse {
      success: boolean;
      requestId: string;
      result?: {
        entities: Array<{
          type: 'product' | 'quantity' | 'unit' | 'action' | 'location';
          value: string;
          confidence: number;
          startIndex: number;
          endIndex: number;
        }>;
        intent: {
          action: 'add' | 'remove' | 'update' | 'search' | 'list';
          confidence: number;
        };
        normalized: {
          products: Array<{
            name: string;
            quantity: number;
            unit?: string;
          }>;
        };
        metadata: {
          processingTime: number;
          model: string;
          version: string;
        };
      };
      error?: string;
      processingTime: number;
      queueTime: number;
    }
    
    export interface BatchRequest {
      queries: Array<{
        query: string;
        metadata?: Record<string, any>;
      }>;
      priority?: 'high' | 'normal' | 'low';
      timeout?: number;
    }
    
    export interface BatchResponse {
      success: boolean;
      batchId: string;
      results: ProcessResponse[];
      totalProcessingTime: number;
      completedCount: number;
      failedCount: number;
    }
  }
  
  // gRPC API types
  export namespace GRPC {
    export interface NLPRequest {
      query: string;
      priority: number; // 0=low, 1=normal, 2=high
      timeout: number;
      metadata: { [key: string]: string };
      requestId: string;
    }
    
    export interface NLPResponse {
      success: boolean;
      requestId: string;
      entities: Entity[];
      intent: Intent;
      normalizedProducts: NormalizedProduct[];
      error: string;
      processingTime: number;
      queueTime: number;
    }
    
    export interface Entity {
      type: string;
      value: string;
      confidence: number;
      startIndex: number;
      endIndex: number;
    }
    
    export interface Intent {
      action: string;
      confidence: number;
    }
    
    export interface NormalizedProduct {
      name: string;
      quantity: number;
      unit: string;
    }
    
    export interface BatchNLPRequest {
      queries: NLPRequest[];
      batchId: string;
    }
    
    export interface BatchNLPResponse {
      success: boolean;
      batchId: string;
      results: NLPResponse[];
      totalProcessingTime: number;
      completedCount: number;
      failedCount: number;
    }
  }
  
  // tRPC API types
  export namespace TRPC {
    export interface ProcessInput {
      query: string;
      priority?: 'high' | 'normal' | 'low';
      timeout?: number;
      metadata?: Record<string, any>;
    }
    
    export interface BatchInput {
      queries: Array<{
        query: string;
        metadata?: Record<string, any>;
      }>;
      priority?: 'high' | 'normal' | 'low';
      timeout?: number;
    }
  }
}

// Grocery-specific NLP types
export interface GroceryEntity {
  type: 'product' | 'quantity' | 'unit' | 'action' | 'location' | 'modifier';
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  metadata?: {
    category?: string;
    brand?: string;
    size?: string;
    organic?: boolean;
  };
}

export interface GroceryIntent {
  action: 'add' | 'remove' | 'update' | 'search' | 'list' | 'clear' | 'checkout';
  confidence: number;
  modifiers: Array<{
    type: 'urgent' | 'optional' | 'substitute' | 'brand-specific';
    confidence: number;
  }>;
}

export interface NormalizedGroceryItem {
  name: string;
  quantity: number;
  unit?: string;
  category?: string;
  brand?: string;
  metadata?: {
    organic?: boolean;
    size?: string;
    urgent?: boolean;
    allowSubstitute?: boolean;
  };
}

export interface GroceryNLPResult {
  entities: GroceryEntity[];
  intent: GroceryIntent;
  normalizedItems: NormalizedGroceryItem[];
  confidence: number;
  processingMetadata: {
    model: string;
    version: string;
    processingTime: number;
    cacheHit: boolean;
    patterns: string[];
  };
}

// Error types specific to the service
export interface NLPServiceError extends Error {
  code: 'QUEUE_OVERFLOW' | 'TIMEOUT' | 'INVALID_QUERY' | 'SERVICE_UNAVAILABLE' | 'PROCESSING_ERROR';
  statusCode: number;
  requestId?: string;
  retryable: boolean;
  details?: Record<string, any>;
}

// Metrics and monitoring
export interface ServiceMetrics {
  uptime: number;
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number; // requests per second
  };
  queue: {
    size: number;
    processing: number;
    averageWaitTime: number;
    averageProcessingTime: number;
    throughput: number;
  };
  resources: {
    cpu: {
      usage: number;
      load: number[];
    };
    memory: {
      used: number;
      total: number;
      heapUsed: number;
      heapTotal: number;
    };
  };
  dependencies: {
    ollama: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      lastCheck: number;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      lastCheck: number;
    };
  };
}