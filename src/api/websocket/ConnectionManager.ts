import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { ClientConnection } from './WebSocketGateway.js';
import { EventMonitor } from '../../core/events/EventMonitor.js';
import Redis from 'ioredis';

// Authentication schemas
export const AuthConfigSchema = z.object({
  jwt: z.object({
    secret: z.string().default('default-secret-change-in-production'),
    algorithms: z.array(z.string()).default(['HS256']),
    issuer: z.string().optional(),
    audience: z.string().optional(),
    expiresIn: z.string().default('24h'),
    clockTolerance: z.number().default(60) // seconds
  }),
  apiKey: z.object({
    enabled: z.boolean().default(false),
    headerName: z.string().default('X-API-Key'),
    keys: z.array(z.string()).default([])
  }),
  oauth: z.object({
    enabled: z.boolean().default(false),
    providers: z.array(z.object({
      name: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      scope: z.array(z.string()).default([]),
      tokenEndpoint: z.string(),
      userInfoEndpoint: z.string()
    })).default([])
  }),
  session: z.object({
    enabled: z.boolean().default(true),
    ttl: z.number().default(24 * 60 * 60), // seconds
    redis: z.object({
      keyPrefix: z.string().default('ws_session:'),
      db: z.number().default(5)
    })
  })
});

export const ConnectionPoolConfigSchema = z.object({
  maxConnections: z.number().default(10000),
  maxConnectionsPerUser: z.number().default(10),
  maxConnectionsPerIP: z.number().default(100),
  connectionTimeout: z.number().default(30000), // milliseconds
  idleTimeout: z.number().default(300000), // 5 minutes
  heartbeatInterval: z.number().default(30000), // 30 seconds
  cleanup: z.object({
    interval: z.number().default(60000), // 1 minute
    maxIdleTime: z.number().default(600000), // 10 minutes
    batchSize: z.number().default(100)
  })
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;
export type ConnectionPoolConfig = z.infer<typeof ConnectionPoolConfigSchema>;

export interface AuthContext {
  userId: string;
  username?: string;
  roles: string[];
  permissions: string[];
  metadata: Record<string, any>;
  sessionId: string;
  expiresAt: number;
}

export interface ConnectionStats {
  total: number;
  active: number;
  idle: number;
  byUser: Record<string, number>;
  byIP: Record<string, number>;
  byRole: Record<string, number>;
  averageConnectionTime: number;
  peakConnections: number;
  connectionsPerSecond: number;
}

export interface SecurityMetrics {
  authAttempts: number;
  authFailures: number;
  authSuccesses: number;
  suspiciousActivity: number;
  blockedIPs: string[];
  rateLimitViolations: number;
  tokenValidationErrors: number;
}

/**
 * ConnectionManager - Advanced WebSocket connection management with security
 * 
 * Features:
 * - Multi-strategy authentication (JWT, API Key, OAuth)
 * - Connection pooling with limits per user/IP
 * - Session management with Redis storage
 * - Real-time security monitoring
 * - Rate limiting and abuse protection
 * - Automatic cleanup and connection recovery
 * - Performance metrics and health monitoring
 */
export class ConnectionManager extends EventEmitter {
  private authConfig: AuthConfig;
  private poolConfig: ConnectionPoolConfig;
  private redis: Redis;
  private monitor: EventMonitor;

  // Connection pools and tracking
  private connections = new Map<string, ClientConnection>();
  private connectionsByUser = new Map<string, Set<string>>();
  private connectionsByIP = new Map<string, Set<string>>();
  private sessionStore = new Map<string, AuthContext>();
  
  // Security and monitoring
  private securityMetrics: SecurityMetrics = {
    authAttempts: 0,
    authFailures: 0,
    authSuccesses: 0,
    suspiciousActivity: 0,
    blockedIPs: [],
    rateLimitViolations: 0,
    tokenValidationErrors: 0
  };

  private stats: ConnectionStats = {
    total: 0,
    active: 0,
    idle: 0,
    byUser: {},
    byIP: {},
    byRole: {},
    averageConnectionTime: 0,
    peakConnections: 0,
    connectionsPerSecond: 0
  };

  // Timers and cleanup
  private cleanupTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private connectionRateWindow: number[] = [];

  constructor(
    authConfig: Partial<AuthConfig> = {},
    poolConfig: Partial<ConnectionPoolConfig> = {},
    redis: Redis,
    monitor: EventMonitor
  ) {
    super();
    
    this.authConfig = AuthConfigSchema.parse(authConfig);
    this.poolConfig = ConnectionPoolConfigSchema.parse(poolConfig);
    this.redis = redis;
    this.monitor = monitor;

    this.startPeriodicTasks();
    console.log('ConnectionManager initialized with authentication and pooling');
  }

  private startPeriodicTasks(): void {
    // Connection cleanup
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this?.poolConfig?.cleanup.interval);

    // Metrics collection
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
      this.emit('metrics', {
        connections: this.stats,
        security: this.securityMetrics,
        timestamp: Date.now()
      });
    }, 30000); // Every 30 seconds

    // Heartbeat monitoring
    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this?.poolConfig?.heartbeatInterval);
  }

  // Authentication methods
  public async authenticateConnection(token: string, metadata: Record<string, any> = {}): Promise<AuthContext> {
    if (this.securityMetrics.authAttempts) { this.securityMetrics.authAttempts++ };

    try {
      // Try JWT authentication first
      if (token.startsWith('Bearer ')) {
        return await this.authenticateJWT(token.substring(7), metadata);
      }

      // Try API key authentication
      if (this?.authConfig?.apiKey.enabled) {
        return await this.authenticateAPIKey(token, metadata);
      }

      throw new Error('Invalid authentication method');

    } catch (error) {
      if (this.securityMetrics.authFailures) { this.securityMetrics.authFailures++ };
      this?.monitor?.recordError(error as Error, {
        eventType: 'authentication_failed',
        source: 'connection_manager'
      });
      throw error;
    }
  }

  private async authenticateJWT(token: string, metadata: Record<string, any>): Promise<AuthContext> {
    try {
      const decoded = jwt.verify(token, this?.authConfig?.jwt.secret, {
        algorithms: this?.authConfig?.jwt.algorithms as jwt.Algorithm[],
        issuer: this?.authConfig?.jwt.issuer,
        audience: this?.authConfig?.jwt.audience,
        clockTolerance: this?.authConfig?.jwt.clockTolerance
      }) as any;

      const authContext: AuthContext = {
        userId: decoded.sub || decoded.userId,
        username: decoded.username || decoded.name,
        roles: decoded.roles || ['user'],
        permissions: decoded.permissions || [],
        metadata: { ...decoded.metadata, ...metadata },
        sessionId: this.generateSessionId(),
        expiresAt: decoded.exp * 1000 // Convert to milliseconds
      };

      // Store session if enabled
      if (this?.authConfig?.session.enabled) {
        await this.storeSession(authContext);
      }

      if (this.securityMetrics.authSuccesses) { this.securityMetrics.authSuccesses++ };
      return authContext;

    } catch (error) {
      if (this.securityMetrics.tokenValidationErrors) { this.securityMetrics.tokenValidationErrors++ };
      throw new Error(`JWT validation failed: ${error}`);
    }
  }

  private async authenticateAPIKey(apiKey: string, metadata: Record<string, any>): Promise<AuthContext> {
    if (!this?.authConfig?.apiKey.keys.includes(apiKey)) {
      throw new Error('Invalid API key');
    }

    const authContext: AuthContext = {
      userId: `api_key_${apiKey.substring(0, 8)}`,
      roles: ['api'],
      permissions: ['read', 'write'],
      metadata,
      sessionId: this.generateSessionId(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    if (this?.authConfig?.session.enabled) {
      await this.storeSession(authContext);
    }

    if (this.securityMetrics.authSuccesses) { this.securityMetrics.authSuccesses++ };
    return authContext;
  }

  private async storeSession(authContext: AuthContext): Promise<void> {
    const sessionKey = `${this?.authConfig?.session.redis.keyPrefix}${authContext.sessionId}`;
    
    await this?.redis.setex(
      sessionKey,
      this?.authConfig?.session.ttl,
      JSON.stringify(authContext)
    );

    this?.sessionStore?.set(authContext.sessionId, authContext);
  }

  public async getSession(sessionId: string): Promise<AuthContext | null> {
    // Try memory cache first
    const cached = this?.sessionStore?.get(sessionId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    // Try Redis
    const sessionKey = `${this?.authConfig?.session.redis.keyPrefix}${sessionId}`;
    const sessionData = await this?.redis.get(sessionKey);
    
    if (sessionData) {
      const authContext = JSON.parse(sessionData) as AuthContext;
      
      if (authContext.expiresAt > Date.now()) {
        this?.sessionStore?.set(sessionId, authContext);
        return authContext;
      }
    }

    return null;
  }

  // Connection management
  public async addConnection(connection: ClientConnection, authContext: AuthContext): Promise<boolean> {
    const { userId } = authContext;
    const userIP = connection?.metadata?.ip;

    // Check global connection limit
    if (this?.connections?.size >= this?.poolConfig?.maxConnections) {
      this.emit('connection_rejected', {
        reason: 'max_connections_reached',
        connectionId: connection.id,
        userId
      });
      return false;
    }

    // Check per-user connection limit
    const userConnections = this?.connectionsByUser?.get(userId)?.size || 0;
    if (userConnections >= this?.poolConfig?.maxConnectionsPerUser) {
      this.emit('connection_rejected', {
        reason: 'max_user_connections',
        connectionId: connection.id,
        userId,
        currentCount: userConnections
      });
      return false;
    }

    // Check per-IP connection limit
    const ipConnections = this?.connectionsByIP?.get(userIP)?.size || 0;
    if (ipConnections >= this?.poolConfig?.maxConnectionsPerIP) {
      this.emit('connection_rejected', {
        reason: 'max_ip_connections',
        connectionId: connection.id,
        userIP,
        currentCount: ipConnections
      });
      return false;
    }

    // Add connection to pools
    connection.userId = userId;
    if (connection.metadata) {
      connection.metadata.authContext = authContext;
    }
    this.connections?.set(connection.id, connection);

    // Update tracking maps
    if (!this?.connectionsByUser?.has(userId)) {
      this?.connectionsByUser?.set(userId, new Set());
    }
    this?.connectionsByUser?.get(userId)!.add(connection.id);

    if (!this?.connectionsByIP?.has(userIP)) {
      this?.connectionsByIP?.set(userIP, new Set());
    }
    this?.connectionsByIP?.get(userIP)!.add(connection.id);

    // Update statistics
    if (this.stats.total) { this.stats.total++ };
    if (this.stats.active) { this.stats.active++ };
    if (this.stats) {

      this.stats.peakConnections = Math.max(this?.stats?.peakConnections, this?.stats?.active);

    }

    // Track connection rate
    this?.connectionRateWindow?.push(Date.now());
    if (this?.connectionRateWindow?.length > 100) {
      this.connectionRateWindow = this?.connectionRateWindow?.slice(-100);
    }

    this.emit('connection_added', {
      connectionId: connection.id,
      userId,
      totalConnections: this?.connections?.size
    });

    return true;
  }

  public removeConnection(connectionId: string, reason: string = 'unknown'): boolean {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return false;

    const { userId } = connection;
    const userIP = connection?.metadata?.ip;

    // Remove from main pool
    this?.connections?.delete(connectionId);

    // Update tracking maps
    const userConnections = this?.connectionsByUser?.get(userId);
    if (userConnections) {
      userConnections.delete(connectionId);
      if (userConnections.size === 0) {
        this?.connectionsByUser?.delete(userId);
      }
    }

    const ipConnections = this?.connectionsByIP?.get(userIP);
    if (ipConnections) {
      ipConnections.delete(connectionId);
      if (ipConnections.size === 0) {
        this?.connectionsByIP?.delete(userIP);
      }
    }

    // Update statistics
    if (this.stats.active) { this.stats.active-- };

    const connectionDuration = Date.now() - connection?.stats?.connectedAt;
    this.updateAverageConnectionTime(connectionDuration);

    this.emit('connection_removed', {
      connectionId,
      userId,
      reason,
      duration: connectionDuration,
      totalConnections: this?.connections?.size
    });

    return true;
  }

  public getConnection(connectionId: string): ClientConnection | undefined {
    return this?.connections?.get(connectionId);
  }

  public getConnectionsByUser(userId: string): ClientConnection[] {
    const connectionIds = this?.connectionsByUser?.get(userId);
    if (!connectionIds) return [];

    return Array.from(connectionIds)
      .map(id => this?.connections?.get(id))
      .filter(conn => conn !== undefined) as ClientConnection[];
  }

  public getConnectionsByRole(role: string): ClientConnection[] {
    const connections: ClientConnection[] = [];
    
    for (const connection of this?.connections?.values()) {
      const authContext = connection?.metadata?.authContext as AuthContext;
      if (authContext && authContext?.roles?.includes(role)) {
        connections.push(connection);
      }
    }

    return connections;
  }

  // Permission and security checks
  public hasPermission(connectionId: string, permission: string): boolean {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return false;

    const authContext = connection?.metadata?.authContext as AuthContext;
    if (!authContext) return false;

    return authContext?.permissions?.includes(permission) ||
           authContext?.roles?.includes('admin');
  }

  public checkRateLimit(connectionId: string, action: string, limit: number, windowMs: number): boolean {
    const connection = this?.connections?.get(connectionId);
    if (!connection) return false;

    const rateLimitKey = `${connectionId}:${action}`;
    const now = Date.now();

    if (connection?.metadata && !connection.metadata.rateLimits) {
      connection.metadata.rateLimits = {};
    }

    const rateLimit = connection?.metadata?.rateLimits[rateLimitKey] || {
      count: 0,
      windowStart: now
    };

    // Reset window if needed
    if (now - rateLimit.windowStart > windowMs) {
      rateLimit.count = 0;
      rateLimit.windowStart = now;
    }

    rateLimit.count++;
    if (connection?.metadata?.rateLimits) {
      connection.metadata.rateLimits[rateLimitKey] = rateLimit;
    }

    if (rateLimit.count > limit) {
      if (this.securityMetrics.rateLimitViolations) { this.securityMetrics.rateLimitViolations++ };
      this.emit('rate_limit_exceeded', {
        connectionId,
        action,
        count: rateLimit.count,
        limit
      });
      return false;
    }

    return true;
  }

  public detectSuspiciousActivity(connectionId: string, activity: string, severity: 'low' | 'medium' | 'high'): void {
    if (this.securityMetrics.suspiciousActivity) { this.securityMetrics.suspiciousActivity++ };
    
    this.emit('suspicious_activity', {
      connectionId,
      activity,
      severity,
      timestamp: Date.now()
    });

    // Auto-disconnect for high severity activities
    if (severity === 'high') {
      const connection = this?.connections?.get(connectionId);
      if (connection && connection?.ws?.readyState === WebSocket.OPEN) {
        connection?.ws?.close(1008, 'Policy violation');
        this.removeConnection(connectionId, 'security_violation');
      }
    }
  }

  // Monitoring and maintenance
  private performCleanup(): void {
    const now = Date.now();
    const connectionsToRemove: string[] = [];

    for (const [connectionId, connection] of this.connections) {
      // Check for dead connections
      if (connection?.ws?.readyState === WebSocket.CLOSED || 
          connection?.ws?.readyState === WebSocket.CLOSING) {
        connectionsToRemove.push(connectionId);
        continue;
      }

      // Check for idle connections
      const idleTime = now - connection?.stats?.lastActivity;
      if (idleTime > this?.poolConfig?.idleTimeout) {
        connection?.ws?.close(1000, 'Idle timeout');
        connectionsToRemove.push(connectionId);
        continue;
      }

      // Check session expiry
      const authContext = connection?.metadata?.authContext as AuthContext;
      if (authContext && authContext.expiresAt < now) {
        connection?.ws?.close(1008, 'Session expired');
        connectionsToRemove.push(connectionId);
        continue;
      }
    }

    // Remove identified connections
    connectionsToRemove.forEach(connectionId => {
      this.removeConnection(connectionId, 'cleanup');
    });

    // Clean up session cache
    for (const [sessionId, authContext] of this.sessionStore) {
      if (authContext.expiresAt < now) {
        this?.sessionStore?.delete(sessionId);
      }
    }

    if (connectionsToRemove?.length || 0 > 0) {
      this.emit('cleanup_performed', {
        removedConnections: connectionsToRemove?.length || 0,
        activeConnections: this?.connections?.size
      });
    }
  }

  private performHeartbeat(): void {
    let responsiveConnections = 0;
    let unresponsiveConnections = 0;

    for (const connection of this?.connections?.values()) {
      if (connection?.ws?.readyState === WebSocket.OPEN) {
        try {
          connection?.ws?.ping();
          responsiveConnections++;
        } catch (error) {
          unresponsiveConnections++;
          this.removeConnection(connection.id, 'heartbeat_failed');
        }
      }
    }

    this.emit('heartbeat_completed', {
      responsive: responsiveConnections,
      unresponsive: unresponsiveConnections,
      timestamp: Date.now()
    });
  }

  private updateMetrics(): void {
    // Update connection statistics
    if (this.stats) {

      this.stats.active = this?.connections?.size;

    }
    if (this.stats) {

      this.stats.idle = 0;

    }

    // Reset per-request counters
    if (this.stats) {

      this.stats.byUser = {};

    }
    if (this.stats) {

      this.stats.byIP = {};

    }
    if (this.stats) {

      this.stats.byRole = {};

    }

    const now = Date.now();

    for (const connection of this?.connections?.values()) {
      const { userId } = connection;
      const userIP = connection?.metadata?.ip;
      const authContext = connection?.metadata?.authContext as AuthContext;

      // Count by user
      this?.stats?.byUser[userId] = (this?.stats?.byUser[userId] || 0) + 1;

      // Count by IP
      this?.stats?.byIP[userIP] = (this?.stats?.byIP[userIP] || 0) + 1;

      // Count by role
      if (authContext) {
        authContext?.roles?.forEach(role => {
          this?.stats?.byRole[role] = (this?.stats?.byRole[role] || 0) + 1;
        });
      }

      // Check if idle
      const idleTime = now - connection?.stats?.lastActivity;
      if (idleTime > 60000) { // 1 minute
        if (this.stats.idle) { this.stats.idle++ };
      }
    }

    // Calculate connection rate
    const recentConnections = this?.connectionRateWindow?.filter(
      timestamp => now - timestamp < 60000 // Last minute
    );
    if (this.stats) {

      this.stats.connectionsPerSecond = recentConnections?.length || 0 / 60;

    }
  }

  private updateAverageConnectionTime(newDuration: number): void {
    const totalConnections = this?.stats?.total;
    
    if (totalConnections === 1) {
      if (this.stats) {

        this.stats.averageConnectionTime = newDuration;

      }
    } else {
      if (this.stats) {

        this.stats.averageConnectionTime = (this?.stats?.averageConnectionTime * (totalConnections - 1) + newDuration) / totalConnections;

      }
    }
  }

  // Utility methods
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`;
  }

  // Public API methods
  public getStats(): ConnectionStats {
    return { ...this.stats };
  }

  public getSecurityMetrics(): SecurityMetrics {
    return { ...this.securityMetrics };
  }

  public getConnectionCount(): number {
    return this?.connections?.size;
  }

  public getAllConnections(): ClientConnection[] {
    return Array.from(this?.connections?.values());
  }

  public async refreshSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    // Extend session TTL
    const sessionKey = `${this?.authConfig?.session.redis.keyPrefix}${sessionId}`;
    await this?.redis.expire(sessionKey, this?.authConfig?.session.ttl);

    session.expiresAt = Date.now() + (this?.authConfig?.session.ttl * 1000);
    this?.sessionStore?.set(sessionId, session);

    return true;
  }

  public async revokeSession(sessionId: string): Promise<boolean> {
    // Remove from Redis
    const sessionKey = `${this?.authConfig?.session.redis.keyPrefix}${sessionId}`;
    await this?.redis.del(sessionKey);

    // Remove from memory cache
    this?.sessionStore?.delete(sessionId);

    // Close any active connections with this session
    for (const connection of this?.connections?.values()) {
      const authContext = connection?.metadata?.authContext as AuthContext;
      if (authContext && authContext.sessionId === sessionId) {
        connection?.ws?.close(1008, 'Session revoked');
        this.removeConnection(connection.id, 'session_revoked');
      }
    }

    return true;
  }

  public broadcastToRole(role: string, message: any): number {
    const connections = this.getConnectionsByRole(role);
    let sentCount = 0;

    for (const connection of connections) {
      if (connection?.ws?.readyState === WebSocket.OPEN) {
        try {
          connection?.ws?.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          this.emit('broadcast_error', { connectionId: connection.id, error });
        }
      }
    }

    return sentCount;
  }

  public broadcastToUser(userId: string, message: any): number {
    const connections = this.getConnectionsByUser(userId);
    let sentCount = 0;

    for (const connection of connections) {
      if (connection?.ws?.readyState === WebSocket.OPEN) {
        try {
          connection?.ws?.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          this.emit('broadcast_error', { connectionId: connection.id, error });
        }
      }
    }

    return sentCount;
  }

  public isHealthy(): boolean {
    const errorRate = this?.stats?.total > 0 
      ? this?.securityMetrics?.authFailures / this?.securityMetrics?.authAttempts 
      : 0;

    return this?.connections?.size > 0 && 
           errorRate < 0.1 && // Less than 10% auth failure rate
           this?.stats?.connectionsPerSecond < 100; // Not being overwhelmed
  }

  public getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    connections: number;
    authFailureRate: number;
    connectionRate: number;
    issues: string[];
  } {
    const issues: string[] = [];
    const authFailureRate = this?.securityMetrics?.authAttempts > 0 
      ? this?.securityMetrics?.authFailures / this?.securityMetrics?.authAttempts 
      : 0;

    if (this?.connections?.size === 0) {
      issues.push('No active connections');
    }

    if (authFailureRate > 0.1) {
      issues.push(`High authentication failure rate: ${Math.round(authFailureRate * 100)}%`);
    }

    if (this?.stats?.connectionsPerSecond > 50) {
      issues.push('High connection rate detected');
    }

    if (this?.securityMetrics?.suspiciousActivity > 0) {
      issues.push(`${this?.securityMetrics?.suspiciousActivity} suspicious activities detected`);
    }

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (issues?.length || 0 > 2 || authFailureRate > 0.2) {
      status = 'unhealthy';
    } else if (issues?.length || 0 > 0) {
      status = 'degraded';
    }

    return {
      status,
      connections: this?.connections?.size,
      authFailureRate,
      connectionRate: this?.stats?.connectionsPerSecond,
      issues
    };
  }

  public async shutdown(): Promise<void> {
    // Clear timers
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    // Close all connections gracefully
    const closePromises: Promise<void>[] = [];
    
    for (const connection of this?.connections?.values()) {
      closePromises.push(new Promise((resolve: any) => {
        if (connection?.ws?.readyState === WebSocket.OPEN) {
          connection?.ws?.close(1001, 'Server shutdown');
        }
        resolve();
      }));
    }

    await Promise.all(closePromises);

    // Clear all data structures
    this?.connections?.clear();
    this?.connectionsByUser?.clear();
    this?.connectionsByIP?.clear();
    this?.sessionStore?.clear();

    this.emit('shutdown', {
      totalConnectionsProcessed: this?.stats?.total,
      peakConnections: this?.stats?.peakConnections
    });
  }
}