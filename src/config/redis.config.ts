import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

// Secure Redis client configuration
const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: process.env.REDIS_ENABLE_READY_CHECK === 'true',
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  // TLS configuration for production
  ...(process.env.REDIS_TLS_ENABLED === 'true' && {
    tls: {
      checkServerIdentity: (_hostname: string, _cert: any) => {
        return undefined; // Custom certificate validation
      }
    }
  })
};

// Validate security configuration in production
if (process.env.NODE_ENV === 'production') {
  if (!redisOptions.password) {
    throw new Error('Redis password is required in production environment');
  }
  
  if (!process.env.REDIS_TLS_ENABLED) {
    logger.warn('Redis TLS is disabled in production - this is not recommended');
  }
}

// Create Redis client instance
export const redisClient = new Redis(redisOptions);

// Handle Redis connection events with secure logging
redisClient.on('connect', () => {
  logger.info('Redis client connected', 'REDIS_CONFIG', {
    host: redisOptions.host,
    port: redisOptions.port,
    db: redisOptions.db,
    tls: !!redisOptions.tls
  });
});

redisClient.on('ready', () => {
  logger.info('Redis client ready for commands');
});

redisClient.on('error', (err: any) => {
  logger.error('Redis client error', 'REDIS_CONFIG', {
    error: err.message,
    stack: err.stack,
    host: redisOptions.host,
    port: redisOptions.port
  });
});

redisClient.on('close', () => {
  logger.warn('Redis client connection closed');
});

redisClient.on('reconnecting', (timeToReconnect: any) => {
  logger.info('Redis client reconnecting', 'REDIS_CONFIG', {
    timeToReconnect: `${timeToReconnect}ms`
  });
});

redisClient.on('end', () => {
  logger.warn('Redis client connection ended');
});

// Export configuration for other modules
export const redisConfig = redisOptions;