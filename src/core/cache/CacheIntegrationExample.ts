/**
 * Cache Integration Example
 * 
 * This file demonstrates how to integrate the comprehensive Redis caching layer
 * across different parts of the CrewAI Team application.
 * 
 * Shows integration with:
 * - Email repositories
 * - tRPC routers
 * - LLM services
 * - WebSocket handlers
 * - Session management
 * - Cache monitoring
 */

import { cacheManager } from './RedisCacheManager.js';
import { CachedEmailRepository } from '../../database/repositories/CachedEmailRepository.js';
import { llmCache } from './LLMResponseCache.js';
import { sessionUserCache } from './SessionUserCache.js';
import { webSocketCache } from './WebSocketCache.js';
import { cacheMonitor } from './CacheMonitor.js';
import { createCacheMiddleware } from '../../api/middleware/cacheMiddleware.js';
import { logger } from '../../utils/logger.js';
import { getDatabaseConnection } from '../../database/ConnectionPool.js';

/**
 * Initialize all caching services
 */
export async function initializeCaching(): Promise<void> {
  try {
    logger.info('Initializing comprehensive caching system', 'CACHE_INTEGRATION');

    // Start cache monitoring
    await cacheMonitor.startMonitoring(60000); // Monitor every minute

    // Register event listeners for cache monitoring
    cacheMonitor.on('alert:created', (alert: any) => {
      logger.warn('Cache alert created', 'CACHE_INTEGRATION', {
        alertId: alert.id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
      });
    });

    cacheMonitor.on('health:checked', (health: any) => {
      if (!health.healthy) {
        logger.warn('Cache health check failed', 'CACHE_INTEGRATION', {
          issues: health.issues,
          recommendations: health.recommendations,
        });
      }
    });

    logger.info('Caching system initialized successfully', 'CACHE_INTEGRATION');
  } catch (error) {
    logger.error('Failed to initialize caching system', 'CACHE_INTEGRATION', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Example: Using cached email repository
 */
export async function setupCachedEmailRepository(): Promise<CachedEmailRepository> {
  try {
    const db = getDatabaseConnection();
    const cachedEmailRepo = new CachedEmailRepository({ db: db.getDatabase() });

    // Warm the email cache with recent data
    await cachedEmailRepo.warmCache({
      recentDays: 7,
      priorityEmails: true,
    });

    logger.info('Cached email repository setup completed', 'CACHE_INTEGRATION');
    return cachedEmailRepo;
  } catch (error) {
    logger.error('Failed to setup cached email repository', 'CACHE_INTEGRATION', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Example: tRPC router with caching middleware
 */
export function createCachedEmailRouter() {
  // This would be integrated into your actual tRPC router setup
  const cacheMiddleware = createCacheMiddleware({
    namespace: 'email_router',
    defaultTTL: 900, // 15 minutes
    enableCompression: true,
    shouldCache: (input, ctx) => {
      // Don't cache if user explicitly requests fresh data
      return !input?.skipCache;
    },
    onCacheHit: (key, data) => {
      logger.debug('Email router cache hit', 'CACHE_INTEGRATION', { key });
    },
    onCacheMiss: (key: any) => {
      logger.debug('Email router cache miss', 'CACHE_INTEGRATION', { key });
    },
  });

  return {
    middleware: cacheMiddleware,
    // Your router procedures would use this middleware
  };
}

/**
 * Example: LLM service with response caching
 */
export class CachedLLMService {
  private model: string;

  constructor(model: string = 'llama3.2:3b') {
    this.model = model;
  }

  async analyzeEmail(emailId: string, emailContent: string, analysisType: string): Promise<any> {
    try {
      // Check for cached analysis first
      const cached = await llmCache.getCachedEmailAnalysis(
        emailId,
        analysisType as any,
        this.model
      );

      if (cached) {
        logger.debug('Using cached email analysis', 'CACHE_INTEGRATION', {
          emailId,
          analysisType,
          model: this.model,
        });
        return cached.analysis;
      }

      // Perform analysis (mock implementation)
      const startTime = Date.now();
      const analysis = await this.performAnalysis(emailContent, analysisType);
      const processingTime = Date.now() - startTime;

      // Cache the result
      await llmCache.cacheEmailAnalysis(
        emailId,
        analysisType as any,
        analysis,
        this.model,
        processingTime,
        0.9 // confidence score
      );

      logger.info('Email analysis completed and cached', 'CACHE_INTEGRATION', {
        emailId,
        analysisType,
        processingTime,
      });

      return analysis;
    } catch (error) {
      logger.error('Email analysis failed', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
        analysisType,
      });
      throw error;
    }
  }

  private async performAnalysis(content: string, type: string): Promise<any> {
    // Mock analysis - replace with actual LLM call
    return {
      type,
      sentiment: 'neutral',
      priority: 'medium',
      entities: [],
      summary: 'Email analysis completed',
      timestamp: new Date(),
    };
  }
}

/**
 * Example: Session management with caching
 */
export class CachedSessionManager {
  async createUserSession(userId: string, userEmail: string): Promise<string> {
    try {
      const sessionId = await sessionUserCache.createSession(userId, userEmail, {
        maxAge: 86400, // 24 hours
        slidingExpiration: true,
        trackActivity: true,
      });

      logger.info('User session created', 'CACHE_INTEGRATION', {
        userId,
        sessionId,
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create user session', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }

  async validateSession(sessionId: string): Promise<any> {
    try {
      const session = await sessionUserCache.getSession(sessionId);
      
      if (!session) {
        return null;
      }

      // Update activity
      await sessionUserCache.updateSessionActivity(sessionId);

      return session;
    } catch (error) {
      logger.error('Session validation failed', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      return null;
    }
  }

  async getUserPreferences(userId: string): Promise<any> {
    try {
      const cached = await sessionUserCache.getCachedUserPreferences(userId);
      
      if (cached) {
        return cached;
      }

      // Load from database (mock)
      const preferences = {
        userId,
        theme: 'light' as 'light' | 'dark' | 'auto',
        language: 'en',
        timezone: 'UTC',
        emailNotifications: true,
        updatedAt: new Date(),
      };

      // Cache for future use
      await sessionUserCache.cacheUserPreferences(preferences);

      return preferences;
    } catch (error) {
      logger.error('Failed to get user preferences', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      throw error;
    }
  }
}

/**
 * Example: WebSocket handler with caching
 */
export class CachedWebSocketHandler {
  async handleConnection(connectionId: string, userId?: string): Promise<void> {
    try {
      const connectionData = {
        connectionId,
        userId,
        connectedAt: new Date(),
        lastActivity: new Date(),
        isActive: true,
        rooms: [],
        subscriptions: [],
      };

      await webSocketCache.cacheConnection(connectionData);

      logger.info('WebSocket connection cached', 'CACHE_INTEGRATION', {
        connectionId,
        userId,
      });
    } catch (error) {
      logger.error('Failed to cache WebSocket connection', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
      });
    }
  }

  async handleDisconnection(connectionId: string): Promise<void> {
    try {
      await webSocketCache.removeConnection(connectionId);

      logger.info('WebSocket connection removed from cache', 'CACHE_INTEGRATION', {
        connectionId,
      });
    } catch (error) {
      logger.error('Failed to remove WebSocket connection from cache', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
      });
    }
  }

  async joinRoom(connectionId: string, roomId: string): Promise<void> {
    try {
      await webSocketCache.addConnectionToRoom(roomId, connectionId);

      logger.info('Connection added to room', 'CACHE_INTEGRATION', {
        connectionId,
        roomId,
      });
    } catch (error) {
      logger.error('Failed to add connection to room', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
        roomId,
      });
    }
  }

  async broadcastToRoom(roomId: string, message: any): Promise<void> {
    try {
      // Get all connections in room
      const connections = await webSocketCache.getRoomConnections(roomId);

      // Cache the broadcast message for a short time
      await webSocketCache.cacheRealtimeData(
        `broadcast:${roomId}:${Date.now()}`,
        message,
        60, // 1 minute TTL
        [`room:${roomId}`]
      );

      logger.info('Message broadcast to room', 'CACHE_INTEGRATION', {
        roomId,
        connectionCount: connections?.length || 0,
      });

      // Here you would actually send the message to all connections
    } catch (error) {
      logger.error('Failed to broadcast to room', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
      });
    }
  }
}

/**
 * Example: Cache warming strategy
 */
export async function executeCacheWarmingStrategy(): Promise<void> {
  try {
    logger.info('Starting cache warming strategy', 'CACHE_INTEGRATION');

    // Warm email cache
    const emailRepo = await setupCachedEmailRepository();
    const emailWarmedCount = await emailRepo.warmCache({
      recentDays: 3,
      priorityEmails: true,
    });

    // Warm LLM cache with common prompts
    const commonPrompts = [
      { prompt: 'Analyze email priority and urgency', model: 'llama3.2:3b' },
      { prompt: 'Extract important entities from email content', model: 'llama3.2:3b' },
      { prompt: 'Summarize email conversation thread', model: 'llama3.2:3b' },
      { prompt: 'Detect email sentiment and tone', model: 'llama3.2:3b' },
    ];

    const llmWarmedCount = await llmCache.warmCache(commonPrompts);

    // Execute registered warming jobs
    await cacheMonitor.executeWarmingJobs();

    logger.info('Cache warming strategy completed', 'CACHE_INTEGRATION', {
      emailWarmedCount,
      llmWarmedCount,
    });
  } catch (error) {
    logger.error('Cache warming strategy failed', 'CACHE_INTEGRATION', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Example: Cache health monitoring and alerting
 */
export async function monitorCacheHealth(): Promise<void> {
  try {
    // Perform health check
    const health = await cacheMonitor.performHealthCheck();

    if (!health.healthy) {
      logger.warn('Cache health issues detected', 'CACHE_INTEGRATION', {
        issues: health.issues,
        recommendations: health.recommendations,
      });

      // You could integrate with external alerting systems here
      // e.g., PagerDuty, Slack notifications, etc.
    }

    // Generate performance report
    const report = await cacheMonitor.generatePerformanceReport();

    logger.info('Cache performance report generated', 'CACHE_INTEGRATION', {
      healthy: health.healthy,
      alertCount: report?.alerts?.active || 0,
      hitRate: health?.stats?.hitRate,
      memoryUsage: health?.stats?.memoryUsage,
    });
  } catch (error) {
    logger.error('Cache health monitoring failed', 'CACHE_INTEGRATION', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Example: Cache invalidation strategies
 */
export class CacheInvalidationManager {
  async invalidateUserData(userId: string): Promise<void> {
    try {
      // Invalidate session and user caches
      const sessionDeleted = await sessionUserCache.invalidateUserData(userId);

      // Invalidate email caches for this user
      await cacheManager.invalidateByTags([`user:${userId}`]);

      // Invalidate LLM caches related to this user
      await llmCache.invalidateByEmailId(`user:${userId}`);

      logger.info('User data invalidated across all caches', 'CACHE_INTEGRATION', {
        userId,
        sessionDeleted,
      });
    } catch (error) {
      logger.error('Failed to invalidate user data', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }

  async invalidateEmailData(emailId: string): Promise<void> {
    try {
      // Invalidate all caches related to this email
      await cacheManager.invalidateByTags([`email:${emailId}`]);

      // Invalidate LLM analysis caches
      await llmCache.invalidateByEmailId(emailId);

      logger.info('Email data invalidated across all caches', 'CACHE_INTEGRATION', {
        emailId,
      });
    } catch (error) {
      logger.error('Failed to invalidate email data', 'CACHE_INTEGRATION', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
    }
  }
}

/**
 * Graceful shutdown of caching system
 */
export async function shutdownCaching(): Promise<void> {
  try {
    logger.info('Shutting down caching system', 'CACHE_INTEGRATION');

    // Stop monitoring
    await cacheMonitor.shutdown();

    // Shutdown cache managers
    await cacheManager.shutdown();

    logger.info('Caching system shutdown completed', 'CACHE_INTEGRATION');
  } catch (error) {
    logger.error('Failed to shutdown caching system', 'CACHE_INTEGRATION', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}