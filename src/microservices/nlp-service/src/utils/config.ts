/**
 * Configuration loader for NLP Microservice
 * Handles environment variables and configuration validation
 */

import { z } from 'zod';
import { logger } from './logger';
import type { NLPServiceConfig } from '../types/index';

// Configuration schema for validation
const configSchema = z.object({
  port: z.number().min(1).max(65535).default(3001),
  grpcPort: z.number().min(1).max(65535).default(50051),
  host: z.string().default('0.0.0.0'),
  environment: z.enum(['development', 'production', 'test']).default('development'),
  
  queue: z.object({
    maxConcurrent: z.number().min(1).max(10).default(2),
    defaultTimeout: z.number().min(1000).max(300000).default(30000),
    maxRetries: z.number().min(0).max(10).default(2),
    persistenceEnabled: z.boolean().default(true),
    persistencePath: z.string().default('./data/nlp-queue')
  }),
  
  monitoring: z.object({
    enabled: z.boolean().default(true),
    metricsPort: z.number().min(1).max(65535).optional(),
    healthCheckInterval: z.number().min(1000).max(300000).default(30000),
    alertThresholds: z.object({
      queueSize: z.number().min(1).default(50),
      errorRate: z.number().min(0).max(1).default(0.1),
      processingTime: z.number().min(100).default(5000),
      memoryUsage: z.number().min(10).max(95).default(80)
    })
  }),
  
  discovery: z.object({
    enabled: z.boolean().default(false),
    serviceName: z.string().default('nlp-service'),
    serviceVersion: z.string().default('1.0.0'),
    registryUrl: z.string().optional(),
    heartbeatInterval: z.number().min(1000).max(60000).default(10000)
  }),
  
  security: z.object({
    rateLimiting: z.object({
      enabled: z.boolean().default(true),
      max: z.number().min(1).default(100),
      timeWindow: z.string().default('1 minute')
    }),
    cors: z.object({
      enabled: z.boolean().default(true),
      origins: z.array(z.string()).default(['http://localhost:3000'])
    }),
    apiKeys: z.object({
      enabled: z.boolean().default(false),
      required: z.boolean().default(false)
    })
  }),
  
  shutdown: z.object({
    timeout: z.number().min(1000).max(60000).default(10000),
    signals: z.array(z.string()).default(['SIGINT', 'SIGTERM'])
  })
});

/**
 * Load and validate configuration from environment
 */
export function loadConfig(): NLPServiceConfig {
  const rawConfig = {
    // Server configuration
    port: parseInt(process.env.PORT || '3001'),
    grpcPort: parseInt(process.env.GRPC_PORT || '50051'),
    host: process.env.HOST || '0.0.0.0',
    environment: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    
    // Queue configuration
    queue: {
      maxConcurrent: parseInt(process.env.OLLAMA_NUM_PARALLEL || '2'),
      defaultTimeout: parseInt(process.env.NLP_DEFAULT_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.NLP_MAX_RETRIES || '2'),
      persistenceEnabled: process.env.NLP_PERSISTENCE_ENABLED !== 'false',
      persistencePath: process.env.NLP_QUEUE_PERSISTENCE_PATH || './data/nlp-queue'
    },
    
    // Monitoring configuration
    monitoring: {
      enabled: process.env.MONITORING_ENABLED !== 'false',
      metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : undefined,
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      alertThresholds: {
        queueSize: parseInt(process.env.ALERT_QUEUE_SIZE || '50'),
        errorRate: parseFloat(process.env.ALERT_ERROR_RATE || '0.1'),
        processingTime: parseInt(process.env.ALERT_PROCESSING_TIME || '5000'),
        memoryUsage: parseFloat(process.env.ALERT_MEMORY_USAGE || '80')
      }
    },
    
    // Service discovery configuration
    discovery: {
      enabled: process.env.SERVICE_DISCOVERY_ENABLED === 'true',
      serviceName: process.env.SERVICE_NAME || 'nlp-service',
      serviceVersion: process.env.SERVICE_VERSION || process.env.npm_package_version || '1.0.0',
      registryUrl: process.env.SERVICE_REGISTRY_URL,
      heartbeatInterval: parseInt(process.env.HEARTBEAT_INTERVAL || '10000')
    },
    
    // Security configuration
    security: {
      rateLimiting: {
        enabled: process.env.RATE_LIMITING_ENABLED !== 'false',
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute'
      },
      cors: {
        enabled: process.env.CORS_ENABLED !== 'false',
        origins: process.env.CORS_ORIGINS ? 
          process.env.CORS_ORIGINS.split(',') : 
          ['http://localhost:3000']
      },
      apiKeys: {
        enabled: process.env.API_KEYS_ENABLED === 'true',
        required: process.env.API_KEYS_REQUIRED === 'true'
      }
    },
    
    // Graceful shutdown configuration
    shutdown: {
      timeout: parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT || '10000'),
      signals: process.env.SHUTDOWN_SIGNALS ? 
        process.env.SHUTDOWN_SIGNALS.split(',') : 
        ['SIGINT', 'SIGTERM']
    }
  };

  try {
    // Validate configuration with proper typing
    const validatedConfig = configSchema.parse(rawConfig) as NLPServiceConfig;
    
    logger.logConfiguration(validatedConfig);
    
    return validatedConfig;
    
  } catch (error) {
    logger.error('Configuration validation failed', 'CONFIG', { error });
    
    if (error instanceof z.ZodError) {
      logger.error('Configuration errors:', 'CONFIG', {
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message,
          received: 'received' in err ? err.received : undefined
        }))
      });
    }
    
    throw new Error('Invalid configuration');
  }
}

/**
 * Get configuration for specific environment
 */
export function getEnvironmentConfig(): Partial<NLPServiceConfig> {
  const env = process.env.NODE_ENV || 'development';
  
  const envConfigs: Record<string, Partial<NLPServiceConfig>> = {
    development: {
      monitoring: {
        enabled: true,
        healthCheckInterval: 10000, // Check every 10 seconds in dev
        alertThresholds: {
          queueSize: 50,
          errorRate: 0.1,
          processingTime: 5000,
          memoryUsage: 80
        }
      },
      security: {
        rateLimiting: {
          enabled: false, // Disable rate limiting in dev
          max: 100,
          timeWindow: '1 minute'
        },
        cors: {
          enabled: true,
          origins: ['*'] // Allow all origins in dev
        },
        apiKeys: {
          enabled: false,
          required: false
        }
      }
    },
    
    test: {
      queue: {
        maxConcurrent: 2,
        defaultTimeout: 30000,
        maxRetries: 2,
        persistenceEnabled: false, // Don't persist queue state in tests
        persistencePath: './test-data'
      },
      monitoring: {
        enabled: false, // Disable monitoring in tests
        healthCheckInterval: 30000,
        alertThresholds: {
          queueSize: 50,
          errorRate: 0.1,
          processingTime: 5000,
          memoryUsage: 80
        }
      },
      discovery: {
        enabled: false, // Disable service discovery in tests
        serviceName: 'nlp-service-test',
        serviceVersion: '1.0.0-test',
        heartbeatInterval: 10000
      }
    },
    
    production: {
      monitoring: {
        enabled: true,
        healthCheckInterval: 30000,
        alertThresholds: {
          queueSize: 100,
          errorRate: 0.05,
          processingTime: 3000,
          memoryUsage: 85
        }
      },
      security: {
        rateLimiting: {
          enabled: true,
          max: 1000, // Higher limit for production
          timeWindow: '1 minute'
        },
        cors: {
          enabled: true,
          origins: ['https://yourdomain.com']
        },
        apiKeys: {
          enabled: true,
          required: true // Require API keys in production
        }
      },
      discovery: {
        enabled: true, // Enable service discovery in production
        serviceName: 'nlp-service',
        serviceVersion: '1.0.0',
        heartbeatInterval: 10000
      }
    }
  };
  
  return envConfigs[env] || {};
}

/**
 * Merge environment-specific configuration
 */
export function mergeEnvironmentConfig(baseConfig: NLPServiceConfig): NLPServiceConfig {
  const envConfig = getEnvironmentConfig();
  
  return {
    ...baseConfig,
    ...envConfig,
    queue: {
      ...baseConfig.queue,
      ...envConfig.queue
    },
    monitoring: {
      ...baseConfig.monitoring,
      ...envConfig.monitoring,
      alertThresholds: {
        ...baseConfig.monitoring.alertThresholds,
        ...(envConfig.monitoring?.alertThresholds || {})
      }
    },
    discovery: {
      ...baseConfig.discovery,
      ...envConfig.discovery
    },
    security: {
      ...baseConfig.security,
      ...envConfig.security,
      rateLimiting: {
        ...baseConfig.security.rateLimiting,
        ...(envConfig.security?.rateLimiting || {})
      },
      cors: {
        ...baseConfig.security.cors,
        ...(envConfig.security?.cors || {})
      },
      apiKeys: {
        ...baseConfig.security.apiKeys,
        ...(envConfig.security?.apiKeys || {})
      }
    },
    shutdown: {
      ...baseConfig.shutdown,
      ...envConfig.shutdown
    }
  };
}

/**
 * Validate required environment variables
 */
export function validateEnvironment(): void {
  const requiredVars: string[] = [];
  
  // Add required environment variables based on configuration
  if (process.env.SERVICE_DISCOVERY_ENABLED === 'true' && !process.env.SERVICE_REGISTRY_URL) {
    requiredVars.push('SERVICE_REGISTRY_URL');
  }
  
  if (process.env.API_KEYS_REQUIRED === 'true' && !process.env.ADMIN_API_KEY) {
    requiredVars.push('ADMIN_API_KEY');
  }
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', 'CONFIG', {
      missingVariables: missingVars
    });
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

/**
 * Get full configuration with environment overrides
 */
export function getConfig(): NLPServiceConfig {
  validateEnvironment();
  const baseConfig = loadConfig();
  return mergeEnvironmentConfig(baseConfig);
}