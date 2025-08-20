/**
 * Session and User Caching Service
 * 
 * Features:
 * - Redis-based session storage with automatic expiry
 * - User authentication data caching
 * - User preferences and settings caching
 * - Session activity tracking
 * - Distributed session management
 * - User permission caching
 */

import { cacheManager } from './RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import crypto from 'crypto';
import { z } from 'zod';

// Schema for session data
const SessionDataSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  userEmail: z.string(),
  userName: z.string().optional(),
  createdAt: z.date(),
  lastActivity: z.date(),
  expiresAt: z.date(),
  isActive: z.boolean(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type SessionData = z.infer<typeof SessionDataSchema>;

// Schema for user data
const UserDataSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().optional(),
  role: z.string(),
  permissions: z.array(z.string()),
  preferences: z.record(z.any()).optional(),
  settings: z.record(z.any()).optional(),
  lastLogin: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isActive: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

export type UserData = z.infer<typeof UserDataSchema>;

// Schema for user preferences
const UserPreferencesSchema = z.object({
  userId: z.string(),
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  language: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  dashboardLayout: z.record(z.any()).optional(),
  filters: z.record(z.any()).optional(),
  shortcuts: z.record(z.any()).optional(),
  updatedAt: z.date(),
});

export type UserPreferences = z.infer<typeof UserPreferencesSchema>;

export interface SessionConfig {
  maxAge?: number; // Session max age in seconds
  slidingExpiration?: boolean; // Extend session on activity
  secureOnly?: boolean; // Only allow secure sessions
  trackActivity?: boolean; // Track user activity
}

export class SessionUserCache {
  private static instance: SessionUserCache | null = null;
  private cacheNamespace = 'session_user';
  private readonly defaultSessionTTL = 86400; // 24 hours
  private readonly userDataTTL = 3600; // 1 hour for user data
  private readonly preferencesTTL = 86400; // 24 hours for preferences
  private readonly activityTTL = 300; // 5 minutes for activity tracking

  private constructor() {
    logger.info('Session User Cache initialized', 'SESSION_USER_CACHE');
  }

  public static getInstance(): SessionUserCache {
    if (!SessionUserCache.instance) {
      SessionUserCache.instance = new SessionUserCache();
    }
    return SessionUserCache.instance;
  }

  /**
   * Generate session cache key
   */
  private generateSessionKey(sessionId: string): string {
    return `session:${sessionId}`;
  }

  /**
   * Generate user cache key
   */
  private generateUserKey(userId: string): string {
    return `user:${userId}`;
  }

  /**
   * Generate user preferences cache key
   */
  private generatePreferencesKey(userId: string): string {
    return `preferences:${userId}`;
  }

  /**
   * Generate user permissions cache key
   */
  private generatePermissionsKey(userId: string): string {
    return `permissions:${userId}`;
  }

  /**
   * Generate activity tracking key
   */
  private generateActivityKey(userId: string): string {
    return `activity:${userId}`;
  }

  /**
   * Create a new session
   */
  async createSession(
    userId: string,
    userEmail: string,
    config: SessionConfig = {}
  ): Promise<string> {
    const startTime = Date.now();

    try {
      const sessionId = crypto.randomUUID();
      const now = new Date();
      const maxAge = config.maxAge || this.defaultSessionTTL;
      const expiresAt = new Date(now.getTime() + maxAge * 1000);

      const sessionData: SessionData = {
        sessionId,
        userId,
        userEmail,
        createdAt: now,
        lastActivity: now,
        expiresAt,
        isActive: true,
        permissions: [],
        metadata: {
          config,
        },
      };

      const cacheKey = this.generateSessionKey(sessionId);

      const success = await cacheManager.set(
        cacheKey,
        sessionData,
        {
          ttl: maxAge,
          namespace: this.cacheNamespace,
          tags: [`user:${userId}`, 'sessions', 'active_sessions'],
        }
      );

      if (success) {
        // Track session creation
        await this.trackActivity(userId, 'session_created', {
          sessionId,
          timestamp: now,
        });

        metrics.increment('session_cache.session_created');
        metrics.histogram('session_cache.create_duration', Date.now() - startTime);

        logger.info('Session created', 'SESSION_USER_CACHE', {
          sessionId,
          userId,
          userEmail,
          expiresAt,
        });
      }

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        userEmail,
      });
      metrics.increment('session_cache.create_error');
      throw error;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateSessionKey(sessionId);
      const session = await cacheManager.get<SessionData>(cacheKey, this.cacheNamespace);

      if (session) {
        // Check if session is expired
        if (new Date() > session.expiresAt) {
          await this.destroySession(sessionId);
          metrics.increment('session_cache.session_expired');
          return null;
        }

        // Update last activity if sliding expiration is enabled
        const config = session.metadata?.config as SessionConfig;
        if (config?.slidingExpiration) {
          await this.updateSessionActivity(sessionId);
        }

        metrics.increment('session_cache.session_hit');
        metrics.histogram('session_cache.get_duration', Date.now() - startTime);

        logger.debug('Session retrieved', 'SESSION_USER_CACHE', {
          sessionId,
          userId: session.userId,
          lastActivity: session.lastActivity,
        });

        return session;
      }

      metrics.increment('session_cache.session_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get session', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      metrics.increment('session_cache.get_error');
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        return false;
      }

      const now = new Date();
      const config = session.metadata?.config as SessionConfig;
      const maxAge = config?.maxAge || this.defaultSessionTTL;

      // Update session data
      session.lastActivity = now;
      
      if (config?.slidingExpiration) {
        session.expiresAt = new Date(now.getTime() + maxAge * 1000);
      }

      const cacheKey = this.generateSessionKey(sessionId);

      const success = await cacheManager.set(
        cacheKey,
        session,
        {
          ttl: maxAge,
          namespace: this.cacheNamespace,
          tags: [`user:${session.userId}`, 'sessions', 'active_sessions'],
        }
      );

      if (success && config?.trackActivity) {
        await this.trackActivity(session.userId, 'session_activity', {
          sessionId,
          timestamp: now,
        });
      }

      metrics.increment('session_cache.activity_updated');
      return success;
    } catch (error) {
      logger.error('Failed to update session activity', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      metrics.increment('session_cache.activity_update_error');
      return false;
    }
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      const cacheKey = this.generateSessionKey(sessionId);

      const success = await cacheManager.del(cacheKey, this.cacheNamespace);

      if (success && session) {
        await this.trackActivity(session.userId, 'session_destroyed', {
          sessionId,
          timestamp: new Date(),
        });

        metrics.increment('session_cache.session_destroyed');

        logger.info('Session destroyed', 'SESSION_USER_CACHE', {
          sessionId,
          userId: session.userId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to destroy session', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      metrics.increment('session_cache.destroy_error');
      return false;
    }
  }

  /**
   * Cache user data
   */
  async cacheUserData(userData: UserData): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateUserKey(userData.userId);

      const success = await cacheManager.set(
        cacheKey,
        userData,
        {
          ttl: this.userDataTTL,
          namespace: this.cacheNamespace,
          tags: [`user:${userData.userId}`, 'user_data', `role:${userData.role}`],
        }
      );

      if (success) {
        metrics.increment('session_cache.user_data_cached');
        metrics.histogram('session_cache.user_cache_duration', Date.now() - startTime);

        logger.debug('User data cached', 'SESSION_USER_CACHE', {
          userId: userData.userId,
          email: userData.email,
          role: userData.role,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache user data', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId: userData.userId,
      });
      metrics.increment('session_cache.user_cache_error');
      return false;
    }
  }

  /**
   * Get cached user data
   */
  async getCachedUserData(userId: string): Promise<UserData | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateUserKey(userId);
      const userData = await cacheManager.get<UserData>(cacheKey, this.cacheNamespace);

      if (userData) {
        metrics.increment('session_cache.user_data_hit');
        metrics.histogram('session_cache.user_get_duration', Date.now() - startTime);

        logger.debug('User data cache hit', 'SESSION_USER_CACHE', {
          userId,
          email: userData.email,
        });

        return userData;
      }

      metrics.increment('session_cache.user_data_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached user data', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      metrics.increment('session_cache.user_get_error');
      return null;
    }
  }

  /**
   * Cache user preferences
   */
  async cacheUserPreferences(preferences: UserPreferences): Promise<boolean> {
    try {
      const cacheKey = this.generatePreferencesKey(preferences.userId);

      const success = await cacheManager.set(
        cacheKey,
        preferences,
        {
          ttl: this.preferencesTTL,
          namespace: this.cacheNamespace,
          tags: [`user:${preferences.userId}`, 'user_preferences'],
        }
      );

      if (success) {
        metrics.increment('session_cache.preferences_cached');

        logger.debug('User preferences cached', 'SESSION_USER_CACHE', {
          userId: preferences.userId,
          theme: preferences.theme,
          language: preferences.language,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache user preferences', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId: preferences.userId,
      });
      metrics.increment('session_cache.preferences_cache_error');
      return false;
    }
  }

  /**
   * Get cached user preferences
   */
  async getCachedUserPreferences(userId: string): Promise<UserPreferences | null> {
    try {
      const cacheKey = this.generatePreferencesKey(userId);
      const preferences = await cacheManager.get<UserPreferences>(cacheKey, this.cacheNamespace);

      if (preferences) {
        metrics.increment('session_cache.preferences_hit');

        logger.debug('User preferences cache hit', 'SESSION_USER_CACHE', {
          userId,
          theme: preferences.theme,
        });

        return preferences;
      }

      metrics.increment('session_cache.preferences_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached user preferences', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      metrics.increment('session_cache.preferences_get_error');
      return null;
    }
  }

  /**
   * Cache user permissions
   */
  async cacheUserPermissions(userId: string, permissions: string[]): Promise<boolean> {
    try {
      const cacheKey = this.generatePermissionsKey(userId);

      const success = await cacheManager.set(
        cacheKey,
        { userId, permissions, cachedAt: new Date() },
        {
          ttl: this.userDataTTL,
          namespace: this.cacheNamespace,
          tags: [`user:${userId}`, 'user_permissions'],
        }
      );

      if (success) {
        metrics.increment('session_cache.permissions_cached');

        logger.debug('User permissions cached', 'SESSION_USER_CACHE', {
          userId,
          permissionCount: permissions?.length || 0,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache user permissions', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      metrics.increment('session_cache.permissions_cache_error');
      return false;
    }
  }

  /**
   * Get cached user permissions
   */
  async getCachedUserPermissions(userId: string): Promise<string[] | null> {
    try {
      const cacheKey = this.generatePermissionsKey(userId);
      const cached = await cacheManager.get<{ permissions: string[] }>(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('session_cache.permissions_hit');

        logger.debug('User permissions cache hit', 'SESSION_USER_CACHE', {
          userId,
          permissionCount: cached?.permissions?.length,
        });

        return cached.permissions;
      }

      metrics.increment('session_cache.permissions_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached user permissions', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      metrics.increment('session_cache.permissions_get_error');
      return null;
    }
  }

  /**
   * Track user activity
   */
  async trackActivity(
    userId: string,
    action: string,
    metadata: Record<string, any> = {}
  ): Promise<boolean> {
    try {
      const cacheKey = this.generateActivityKey(userId);
      const now = new Date();

      const activityData = {
        userId,
        action,
        timestamp: now,
        metadata,
      };

      // Get existing activities
      const existingActivities = await cacheManager.get<any[]>(cacheKey, this.cacheNamespace) || [];
      
      // Add new activity
      existingActivities.push(activityData);
      
      // Keep only last 100 activities
      const recentActivities = existingActivities.slice(-100);

      const success = await cacheManager.set(
        cacheKey,
        recentActivities,
        {
          ttl: this.activityTTL,
          namespace: this.cacheNamespace,
          tags: [`user:${userId}`, 'user_activity'],
        }
      );

      if (success) {
        metrics.increment('session_cache.activity_tracked');

        logger.debug('User activity tracked', 'SESSION_USER_CACHE', {
          userId,
          action,
          activityCount: recentActivities?.length || 0,
        });
      }

      return success;
    } catch (error) {
      logger.warn('Failed to track user activity', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        action,
      });
      return false;
    }
  }

  /**
   * Get user activity history
   */
  async getUserActivity(userId: string): Promise<any[] | null> {
    try {
      const cacheKey = this.generateActivityKey(userId);
      const activities = await cacheManager.get<any[]>(cacheKey, this.cacheNamespace);

      if (activities) {
        metrics.increment('session_cache.activity_retrieved');

        logger.debug('User activity retrieved', 'SESSION_USER_CACHE', {
          userId,
          activityCount: activities?.length || 0,
        });

        return activities;
      }

      return null;
    } catch (error) {
      logger.error('Failed to get user activity', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return null;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<SessionData[]> {
    try {
      // This is a simplified implementation
      // In production, you'd maintain a separate index of user sessions
      const sessions: SessionData[] = [];

      // For now, return empty array
      // You would implement proper session indexing for this feature

      logger.debug('User sessions retrieved', 'SESSION_USER_CACHE', {
        userId,
        sessionCount: sessions?.length || 0,
      });

      return sessions;
    } catch (error) {
      logger.error('Failed to get user sessions', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Invalidate all user data
   */
  async invalidateUserData(userId: string): Promise<number> {
    try {
      const deletedCount = await cacheManager.invalidateByTags([`user:${userId}`]);

      logger.info('User data invalidated', 'SESSION_USER_CACHE', {
        userId,
        deletedCount,
      });

      metrics.increment('session_cache.user_data_invalidated', deletedCount);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate user data', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const baseStats = await cacheManager.getStats();

      return {
        ...baseStats,
        namespace: this.cacheNamespace,
        ttl: {
          session: this.defaultSessionTTL,
          userData: this.userDataTTL,
          preferences: this.preferencesTTL,
          activity: this.activityTTL,
        },
      };
    } catch (error) {
      logger.error('Failed to get session cache stats', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear all session and user caches
   */
  async clearCache(): Promise<boolean> {
    try {
      const success = await cacheManager.clear(this.cacheNamespace);

      logger.info('Session user cache cleared', 'SESSION_USER_CACHE', { success });
      metrics.increment('session_cache.cleared');

      return success;
    } catch (error) {
      logger.error('Failed to clear session user cache', 'SESSION_USER_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instance
export const sessionUserCache = SessionUserCache.getInstance();