/**
 * Redis Caching Layer - Main Export File
 * 
 * Comprehensive Redis caching system for CrewAI Team with:
 * - Centralized cache management
 * - Database query caching
 * - LLM response caching
 * - Session and user caching
 * - WebSocket state caching
 * - Performance monitoring
 * - Cache warming strategies
 */

// Core cache manager
export { cacheManager, RedisCacheManager, type CacheConfig, type CacheStats } from './RedisCacheManager.js';

// Database caching
export { CachedEmailRepository } from '../../database/repositories/CachedEmailRepository.js';

// LLM response caching
export { 
  llmCache, 
  LLMResponseCache, 
  type LLMResponse, 
  type EmailAnalysisCache, 
  type WorkflowAnalysisCache,
  type LLMCacheConfig 
} from './LLMResponseCache.js';

// Session and user caching
export { 
  sessionUserCache, 
  SessionUserCache, 
  type SessionData, 
  type UserData, 
  type UserPreferences,
  type SessionConfig 
} from './SessionUserCache.js';

// WebSocket caching
export { 
  webSocketCache, 
  WebSocketCache, 
  type ConnectionData, 
  type RoomData, 
  type RealtimeData 
} from './WebSocketCache.js';

// Cache middleware for tRPC
export { 
  createCacheMiddleware,
  createQueryCacheMiddleware,
  createMutationCacheMiddleware,
  warmTRPCCache,
  getTRPCCacheStats,
  clearTRPCCache,
  type CacheMiddlewareOptions 
} from '../../api/middleware/cacheMiddleware.js';

// Cache monitoring and management
export { 
  cacheMonitor, 
  CacheMonitor, 
  type CacheHealthStatus, 
  type CacheWarmingJob, 
  type CacheAlert 
} from './CacheMonitor.js';

// Integration examples and utilities
export {
  initializeCaching,
  setupCachedEmailRepository,
  executeCacheWarmingStrategy,
  monitorCacheHealth,
  shutdownCaching,
  CachedLLMService,
  CachedSessionManager,
  CachedWebSocketHandler,
  CacheInvalidationManager,
} from './CacheIntegrationExample.js';

// Re-export Redis configuration
export { redisClient, redisConfig } from '../../config/redis.config.js';