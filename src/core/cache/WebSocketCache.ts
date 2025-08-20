/**
 * WebSocket Caching Service
 * 
 * Features:
 * - Cache WebSocket connection state
 * - Real-time data caching for WebSocket events
 * - Connection pool management
 * - Message broadcasting optimization
 * - User presence tracking
 * - Room/channel subscription caching
 */

import { cacheManager } from './RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import { z } from 'zod';
import crypto from 'crypto';

// Schema for WebSocket connection data
const ConnectionDataSchema = z.object({
  connectionId: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  connectedAt: z.date(),
  lastActivity: z.date(),
  userAgent: z.string().optional(),
  ipAddress: z.string().optional(),
  rooms: z.array(z.string()).optional().default([]),
  subscriptions: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional(),
});

export type ConnectionData = z.infer<typeof ConnectionDataSchema>;

// Schema for room data
const RoomDataSchema = z.object({
  roomId: z.string(),
  name: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  connectionIds: z.array(z.string()),
  metadata: z.record(z.any()).optional(),
});

export type RoomData = z.infer<typeof RoomDataSchema>;

// Schema for user presence data
const PresenceDataSchema = z.object({
  userId: z.string(),
  connections: z.array(z.string()),
  isOnline: z.boolean(),
  lastSeen: z.date(),
});

export type PresenceData = z.infer<typeof PresenceDataSchema>;

// Schema for real-time data
const RealtimeDataSchema = z.object({
  key: z.string(),
  data: z.any(),
  timestamp: z.date(),
  expiresAt: z.date().optional(),
  tags: z.array(z.string()).optional().default([]),
});

export type RealtimeData = z.infer<typeof RealtimeDataSchema>;

export class WebSocketCache {
  private static instance: WebSocketCache | null = null;
  private cacheNamespace = 'websocket';
  private readonly connectionTTL = 3600; // 1 hour
  private readonly roomTTL = 86400; // 24 hours
  private readonly realtimeTTL = 300; // 5 minutes
  private readonly presenceTTL = 60; // 1 minute

  private constructor() {
    logger.info('WebSocket Cache initialized', 'WEBSOCKET_CACHE');
  }

  public static getInstance(): WebSocketCache {
    if (!WebSocketCache.instance) {
      WebSocketCache.instance = new WebSocketCache();
    }
    return WebSocketCache.instance;
  }

  /**
   * Generate connection cache key
   */
  private generateConnectionKey(connectionId: string): string {
    return `connection:${connectionId}`;
  }

  /**
   * Generate room cache key
   */
  private generateRoomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  /**
   * Generate user presence key
   */
  private generatePresenceKey(userId: string): string {
    return `presence:${userId}`;
  }

  /**
   * Generate realtime data key
   */
  private generateRealtimeKey(key: string): string {
    return `realtime:${key}`;
  }

  /**
   * Generate subscription key
   */
  private generateSubscriptionKey(topic: string): string {
    return `subscription:${topic}`;
  }

  /**
   * Cache WebSocket connection
   */
  async cacheConnection(connectionData: ConnectionData): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateConnectionKey(connectionData.connectionId);

      const success = await cacheManager.set(
        cacheKey,
        connectionData,
        {
          ttl: this.connectionTTL,
          namespace: this.cacheNamespace,
          tags: [
            'connections',
            ...(connectionData.userId ? [`user:${connectionData.userId}`] : []),
            ...(connectionData.sessionId ? [`session:${connectionData.sessionId}`] : []),
            ...connectionData?.rooms?.map(room => `room:${room}`),
          ],
        }
      );

      if (success) {
        // Update user presence if userId is available
        if (connectionData.userId) {
          await this.updateUserPresence(connectionData.userId, connectionData.connectionId, true);
        }

        metrics.increment('websocket_cache.connection_cached');
        metrics.histogram('websocket_cache.connection_cache_duration', Date.now() - startTime);

        logger.debug('WebSocket connection cached', 'WEBSOCKET_CACHE', {
          connectionId: connectionData.connectionId,
          userId: connectionData.userId,
          rooms: connectionData.rooms,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache WebSocket connection', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        connectionId: connectionData.connectionId,
      });
      metrics.increment('websocket_cache.connection_cache_error');
      return false;
    }
  }

  /**
   * Get cached connection data
   */
  async getConnection(connectionId: string): Promise<ConnectionData | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateConnectionKey(connectionId);
      const connection = await cacheManager.get<ConnectionData>(cacheKey, this.cacheNamespace);

      if (connection) {
        metrics.increment('websocket_cache.connection_hit');
        metrics.histogram('websocket_cache.connection_get_duration', Date.now() - startTime);

        logger.debug('WebSocket connection cache hit', 'WEBSOCKET_CACHE', {
          connectionId,
          userId: connection.userId,
        });

        return connection;
      }

      metrics.increment('websocket_cache.connection_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached WebSocket connection', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
      });
      metrics.increment('websocket_cache.connection_get_error');
      return null;
    }
  }

  /**
   * Update connection activity
   */
  async updateConnectionActivity(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(connectionId);
      if (!connection) {
        return false;
      }

      connection.lastActivity = new Date();

      const success = await this.cacheConnection(connection);

      if (success) {
        metrics.increment('websocket_cache.connection_activity_updated');

        logger.debug('WebSocket connection activity updated', 'WEBSOCKET_CACHE', {
          connectionId,
          userId: connection.userId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to update connection activity', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
      });
      return false;
    }
  }

  /**
   * Remove cached connection
   */
  async removeConnection(connectionId: string): Promise<boolean> {
    try {
      const connection = await this.getConnection(connectionId);
      const cacheKey = this.generateConnectionKey(connectionId);

      const success = await cacheManager.del(cacheKey, this.cacheNamespace);

      if (success && connection) {
        // Update user presence
        if (connection.userId) {
          await this.updateUserPresence(connection.userId, connectionId, false);
        }

        // Remove from rooms
        for (const roomId of connection.rooms) {
          await this.removeConnectionFromRoom(roomId, connectionId);
        }

        metrics.increment('websocket_cache.connection_removed');

        logger.info('WebSocket connection removed', 'WEBSOCKET_CACHE', {
          connectionId,
          userId: connection.userId,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to remove WebSocket connection', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
      });
      metrics.increment('websocket_cache.connection_remove_error');
      return false;
    }
  }

  /**
   * Cache room data
   */
  async cacheRoom(roomData: RoomData): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateRoomKey(roomData.roomId);

      const success = await cacheManager.set(
        cacheKey,
        roomData,
        {
          ttl: this.roomTTL,
          namespace: this.cacheNamespace,
          tags: [
            'rooms',
            `room:${roomData.roomId}`,
            ...roomData?.connectionIds?.map(id => `connection:${id}`),
          ],
        }
      );

      if (success) {
        metrics.increment('websocket_cache.room_cached');
        metrics.histogram('websocket_cache.room_cache_duration', Date.now() - startTime);

        logger.debug('WebSocket room cached', 'WEBSOCKET_CACHE', {
          roomId: roomData.roomId,
          connectionCount: roomData?.connectionIds?.length,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache WebSocket room', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        roomId: roomData.roomId,
      });
      metrics.increment('websocket_cache.room_cache_error');
      return false;
    }
  }

  /**
   * Get cached room data
   */
  async getRoom(roomId: string): Promise<RoomData | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateRoomKey(roomId);
      const room = await cacheManager.get<RoomData>(cacheKey, this.cacheNamespace);

      if (room) {
        metrics.increment('websocket_cache.room_hit');
        metrics.histogram('websocket_cache.room_get_duration', Date.now() - startTime);

        logger.debug('WebSocket room cache hit', 'WEBSOCKET_CACHE', {
          roomId,
          connectionCount: room?.connectionIds?.length,
        });

        return room;
      }

      metrics.increment('websocket_cache.room_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached WebSocket room', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
      });
      metrics.increment('websocket_cache.room_get_error');
      return null;
    }
  }

  /**
   * Add connection to room
   */
  async addConnectionToRoom(roomId: string, connectionId: string): Promise<boolean> {
    try {
      let room = await this.getRoom(roomId);
      
      if (!room) {
        // Create new room
        room = {
          roomId,
          createdAt: new Date(),
          updatedAt: new Date(),
          connectionIds: [],
        };
      }

      if (!room?.connectionIds?.includes(connectionId)) {
        room?.connectionIds?.push(connectionId);
        room.updatedAt = new Date();

        const success = await this.cacheRoom(room);

        if (success) {
          // Update connection's room list
          const connection = await this.getConnection(connectionId);
          if (connection && !connection?.rooms?.includes(roomId)) {
            connection?.rooms?.push(roomId);
            await this.cacheConnection(connection);
          }

          metrics.increment('websocket_cache.connection_added_to_room');

          logger.debug('Connection added to room', 'WEBSOCKET_CACHE', {
            roomId,
            connectionId,
            roomSize: room?.connectionIds?.length,
          });
        }

        return success;
      }

      return true; // Already in room
    } catch (error) {
      logger.error('Failed to add connection to room', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
        connectionId,
      });
      return false;
    }
  }

  /**
   * Remove connection from room
   */
  async removeConnectionFromRoom(roomId: string, connectionId: string): Promise<boolean> {
    try {
      const room = await this.getRoom(roomId);
      if (!room) {
        return false;
      }

      const index = room?.connectionIds?.indexOf(connectionId);
      if (index > -1) {
        room?.connectionIds?.splice(index, 1);
        room.updatedAt = new Date();

        const success = await this.cacheRoom(room);

        if (success) {
          // Update connection's room list
          const connection = await this.getConnection(connectionId);
          if (connection) {
            const roomIndex = connection?.rooms?.indexOf(roomId);
            if (roomIndex > -1) {
              connection?.rooms?.splice(roomIndex, 1);
              await this.cacheConnection(connection);
            }
          }

          metrics.increment('websocket_cache.connection_removed_from_room');

          logger.debug('Connection removed from room', 'WEBSOCKET_CACHE', {
            roomId,
            connectionId,
            roomSize: room?.connectionIds?.length,
          });
        }

        return success;
      }

      return true; // Not in room
    } catch (error) {
      logger.error('Failed to remove connection from room', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
        connectionId,
      });
      return false;
    }
  }

  /**
   * Cache realtime data
   */
  async cacheRealtimeData(
    key: string,
    data: any,
    ttl: number = this.realtimeTTL,
    tags: string[] = []
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateRealtimeKey(key);
      const expiresAt = new Date(Date.now() + ttl * 1000);

      const realtimeData: RealtimeData = {
        key,
        data,
        timestamp: new Date(),
        expiresAt,
        tags,
      };

      const success = await cacheManager.set(
        cacheKey,
        realtimeData,
        {
          ttl,
          namespace: this.cacheNamespace,
          tags: ['realtime', ...tags],
        }
      );

      if (success) {
        metrics.increment('websocket_cache.realtime_cached');
        metrics.histogram('websocket_cache.realtime_cache_duration', Date.now() - startTime);

        logger.debug('Realtime data cached', 'WEBSOCKET_CACHE', {
          key,
          ttl,
          tags,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to cache realtime data', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('websocket_cache.realtime_cache_error');
      return false;
    }
  }

  /**
   * Get cached realtime data
   */
  async getRealtimeData(key: string): Promise<RealtimeData | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateRealtimeKey(key);
      const data = await cacheManager.get<RealtimeData>(cacheKey, this.cacheNamespace);

      if (data) {
        // Check if expired
        if (data.expiresAt && new Date() > data.expiresAt) {
          await cacheManager.del(cacheKey, this.cacheNamespace);
          metrics.increment('websocket_cache.realtime_expired');
          return null;
        }

        metrics.increment('websocket_cache.realtime_hit');
        metrics.histogram('websocket_cache.realtime_get_duration', Date.now() - startTime);

        logger.debug('Realtime data cache hit', 'WEBSOCKET_CACHE', {
          key,
          age: Date.now() - data?.timestamp?.getTime(),
        });

        return data;
      }

      metrics.increment('websocket_cache.realtime_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached realtime data', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        key,
      });
      metrics.increment('websocket_cache.realtime_get_error');
      return null;
    }
  }

  /**
   * Update user presence
   */
  async updateUserPresence(
    userId: string,
    connectionId: string,
    isOnline: boolean
  ): Promise<boolean> {
    try {
      const presenceKey = this.generatePresenceKey(userId);
      
      let presence = await cacheManager.get(presenceKey, this.cacheNamespace) as PresenceData | null;
      
      if (!presence) {
        presence = {
          userId,
          connections: [],
          isOnline: false,
          lastSeen: new Date(),
        };
      }

      if (isOnline) {
        if (!presence.connections.includes(connectionId)) {
          presence.connections.push(connectionId);
        }
        presence.isOnline = true;
      } else {
        const index = presence.connections.indexOf(connectionId);
        if (index > -1) {
          presence.connections.splice(index, 1);
        }
        presence.isOnline = presence.connections.length > 0;
        if (!presence.isOnline) {
          presence.lastSeen = new Date();
        }
      }

      const success = await cacheManager.set(
        presenceKey,
        presence,
        {
          ttl: this.presenceTTL,
          namespace: this.cacheNamespace,
          tags: [`user:${userId}`, 'presence'],
        }
      );

      if (success) {
        metrics.increment('websocket_cache.presence_updated');

        logger.debug('User presence updated', 'WEBSOCKET_CACHE', {
          userId,
          connectionId,
          isOnline,
          connectionCount: presence.connections.length,
        });
      }

      return success;
    } catch (error) {
      logger.error('Failed to update user presence', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        connectionId,
      });
      return false;
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<PresenceData | null> {
    try {
      const presenceKey = this.generatePresenceKey(userId);
      const presence = await cacheManager.get(presenceKey, this.cacheNamespace) as PresenceData | null;

      if (presence) {
        metrics.increment('websocket_cache.presence_hit');

        logger.debug('User presence retrieved', 'WEBSOCKET_CACHE', {
          userId,
          isOnline: presence.isOnline,
          connectionCount: presence.connections.length,
        });
      } else {
        metrics.increment('websocket_cache.presence_miss');
      }

      return presence;
    } catch (error) {
      logger.error('Failed to get user presence', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return null;
    }
  }

  /**
   * Get all connections in a room
   */
  async getRoomConnections(roomId: string): Promise<string[]> {
    try {
      const room = await this.getRoom(roomId);
      return room ? room.connectionIds : [];
    } catch (error) {
      logger.error('Failed to get room connections', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        roomId,
      });
      return [];
    }
  }

  /**
   * Get connections by user ID
   */
  async getUserConnections(userId: string): Promise<string[]> {
    try {
      const presence = await this.getUserPresence(userId);
      return presence ? (presence.connections || []) : [];
    } catch (error) {
      logger.error('Failed to get user connections', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
      return [];
    }
  }

  /**
   * Invalidate cache by connection
   */
  async invalidateByConnection(connectionId: string): Promise<number> {
    try {
      const deletedCount = await cacheManager.invalidateByTags([`connection:${connectionId}`]);

      logger.debug('Cache invalidated by connection', 'WEBSOCKET_CACHE', {
        connectionId,
        deletedCount,
      });

      metrics.increment('websocket_cache.invalidated_by_connection', deletedCount);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate cache by connection', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
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
          connection: this.connectionTTL,
          room: this.roomTTL,
          realtime: this.realtimeTTL,
          presence: this.presenceTTL,
        },
      };
    } catch (error) {
      logger.error('Failed to get WebSocket cache stats', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear all WebSocket caches
   */
  async clearCache(): Promise<boolean> {
    try {
      const success = await cacheManager.clear(this.cacheNamespace);

      logger.info('WebSocket cache cleared', 'WEBSOCKET_CACHE', { success });
      metrics.increment('websocket_cache.cleared');

      return success;
    } catch (error) {
      logger.error('Failed to clear WebSocket cache', 'WEBSOCKET_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}

// Export singleton instance
export const webSocketCache = WebSocketCache.getInstance();