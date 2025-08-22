/**
 * WebSocket Rate Limiting Service
 * Implements sliding window rate limiting with burst protection and IP-based throttling
 */

import { WS_SECURITY_CONFIG } from '../../config/websocket-security.config.js';
import { logger } from '../../utils/logger.js';

// Rate limiting bucket for tracking requests
interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  totalRequests: number;
  rejectedRequests: number;
  firstRequest: number;
}

// Connection tracking for IP-based limits
interface ConnectionTracker {
  count: number;
  connections: Set<string>; // WebSocket client IDs
  firstConnection: number;
  blockedUntil?: number;
}

// Rate limit violation types
export enum ViolationType {
  MESSAGE_RATE = 'message_rate',
  CONNECTION_LIMIT = 'connection_limit',
  BURST_PROTECTION = 'burst_protection',
  PERSISTENT_ABUSE = 'persistent_abuse',
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  violationType?: ViolationType;
  retryAfter?: number; // seconds
  remainingTokens?: number;
  resetTime?: number;
  details?: string;
}

export class WebSocketRateLimiter {
  private messageBuckets = new Map<string, RateLimitBucket>();
  private connectionTrackers = new Map<string, ConnectionTracker>();
  private suspiciousIPs = new Set<string>();
  private cleanupInterval: NodeJS.Timeout;

  // Configuration
  private readonly maxMessagesPerMinute = WS_SECURITY_CONFIG.MESSAGE.MAX_MESSAGES_PER_MINUTE;
  private readonly windowMs = WS_SECURITY_CONFIG.MESSAGE.RATE_LIMIT_WINDOW_MS;
  private readonly maxConnectionsPerIP = WS_SECURITY_CONFIG.CONNECTION.MAX_CONNECTIONS_PER_IP;
  private readonly maxTotalConnections = WS_SECURITY_CONFIG.CONNECTION.MAX_TOTAL_CONNECTIONS;

  // Burst protection - allow temporary bursts but prevent sustained abuse
  private readonly burstAllowance = Math.floor(this.maxMessagesPerMinute * 0.5); // 50% burst
  private readonly burstWindowMs = 10000; // 10 seconds

  constructor() {
    // Clean up old entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);

    logger.info('WebSocket Rate Limiter initialized', 'WS_RATE_LIMITER', {
      maxMessagesPerMinute: this.maxMessagesPerMinute,
      maxConnectionsPerIP: this.maxConnectionsPerIP,
      burstAllowance: this.burstAllowance,
    });
  }

  /**
   * Check if a message is allowed for a specific client
   */
  checkMessageRate(clientId: string, ipAddress: string, userId?: string): RateLimitResult {
    const now = Date.now();
    const identifier = userId || `client_${clientId}`;

    // Check if IP is temporarily blocked
    const connectionTracker = this.connectionTrackers.get(ipAddress);
    if (connectionTracker?.blockedUntil && now < connectionTracker.blockedUntil) {
      return {
        allowed: false,
        violationType: ViolationType.PERSISTENT_ABUSE,
        retryAfter: Math.ceil((connectionTracker.blockedUntil - now) / 1000),
        details: 'IP temporarily blocked for abuse',
      };
    }

    // Get or create bucket for this identifier
    let bucket = this.messageBuckets.get(identifier);
    if (!bucket) {
      bucket = {
        tokens: this.maxMessagesPerMinute,
        lastRefill: now,
        totalRequests: 0,
        rejectedRequests: 0,
        firstRequest: now,
      };
      this.messageBuckets.set(identifier, bucket);
    }

    // Refill tokens based on time passed (token bucket algorithm)
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.windowMs) * this.maxMessagesPerMinute);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.maxMessagesPerMinute, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    bucket.totalRequests++;

    // Check for burst protection
    if (this.isBurstAbuse(bucket, now)) {
      bucket.rejectedRequests++;
      this.markSuspiciousIP(ipAddress);
      
      return {
        allowed: false,
        violationType: ViolationType.BURST_PROTECTION,
        retryAfter: Math.ceil(this.burstWindowMs / 1000),
        details: 'Burst limit exceeded',
      };
    }

    // Check if tokens available
    if (bucket.tokens <= 0) {
      bucket.rejectedRequests++;
      
      // Block IP if persistent abuse detected
      if (this.isPersistentAbuse(bucket)) {
        this.blockIP(ipAddress, 300); // 5 minutes
        return {
          allowed: false,
          violationType: ViolationType.PERSISTENT_ABUSE,
          retryAfter: 300,
          details: 'Persistent abuse detected - IP blocked',
        };
      }

      return {
        allowed: false,
        violationType: ViolationType.MESSAGE_RATE,
        retryAfter: Math.ceil((this.windowMs - timePassed) / 1000),
        remainingTokens: 0,
        resetTime: bucket.lastRefill + this.windowMs,
      };
    }

    // Consume token
    bucket.tokens--;

    return {
      allowed: true,
      remainingTokens: bucket.tokens,
      resetTime: bucket.lastRefill + this.windowMs,
    };
  }

  /**
   * Check if a new connection is allowed from an IP
   */
  checkConnectionLimit(ipAddress: string, clientId: string): RateLimitResult {
    const now = Date.now();

    // Check if IP is blocked
    const tracker = this.connectionTrackers.get(ipAddress);
    if (tracker?.blockedUntil && now < tracker.blockedUntil) {
      return {
        allowed: false,
        violationType: ViolationType.CONNECTION_LIMIT,
        retryAfter: Math.ceil((tracker.blockedUntil - now) / 1000),
        details: 'IP blocked for connection abuse',
      };
    }

    // Get or create connection tracker
    let connectionTracker = this.connectionTrackers.get(ipAddress);
    if (!connectionTracker) {
      connectionTracker = {
        count: 0,
        connections: new Set(),
        firstConnection: now,
      };
      this.connectionTrackers.set(ipAddress, connectionTracker);
    }

    // Check total connections across all IPs
    const totalConnections = Array.from(this.connectionTrackers.values())
      .reduce((sum, tracker) => sum + tracker.count, 0);

    if (totalConnections >= this.maxTotalConnections) {
      logger.warn('Max total connections reached', 'WS_RATE_LIMITER', {
        totalConnections,
        maxTotalConnections: this.maxTotalConnections,
      });

      return {
        allowed: false,
        violationType: ViolationType.CONNECTION_LIMIT,
        retryAfter: 60, // Try again in 1 minute
        details: 'Server at capacity',
      };
    }

    // Check per-IP connection limit
    if (connectionTracker.count >= this.maxConnectionsPerIP) {
      // Check if this is a reconnection (reusing client ID)
      if (!connectionTracker.connections.has(clientId)) {
        this.markSuspiciousIP(ipAddress);
        
        return {
          allowed: false,
          violationType: ViolationType.CONNECTION_LIMIT,
          retryAfter: 30,
          details: `Max connections per IP (${this.maxConnectionsPerIP}) exceeded`,
        };
      }
    }

    // Allow connection
    connectionTracker.connections.add(clientId);
    connectionTracker.count = connectionTracker.connections.size;

    return { allowed: true };
  }

  /**
   * Remove a connection from tracking
   */
  removeConnection(ipAddress: string, clientId: string): void {
    const tracker = this.connectionTrackers.get(ipAddress);
    if (tracker) {
      tracker.connections.delete(clientId);
      tracker.count = tracker.connections.size;

      // Clean up empty tracker
      if (tracker.count === 0) {
        this.connectionTrackers.delete(ipAddress);
      }
    }
  }

  /**
   * Check if behavior indicates burst abuse
   */
  private isBurstAbuse(bucket: RateLimitBucket, now: number): boolean {
    // Check if too many requests in burst window
    const burstWindowStart = now - this.burstWindowMs;
    const recentRequests = bucket.totalRequests - bucket.rejectedRequests;
    
    return recentRequests > this.burstAllowance && 
           bucket.firstRequest > burstWindowStart;
  }

  /**
   * Check if behavior indicates persistent abuse
   */
  private isPersistentAbuse(bucket: RateLimitBucket): boolean {
    const totalTime = Date.now() - bucket.firstRequest;
    const rejectionRate = bucket.rejectedRequests / bucket.totalRequests;
    
    // If more than 50% of requests are rejected over 1 minute, it's abuse
    return totalTime > 60000 && 
           rejectionRate > 0.5 && 
           bucket.rejectedRequests > 20;
  }

  /**
   * Mark IP as suspicious
   */
  private markSuspiciousIP(ipAddress: string): void {
    this.suspiciousIPs.add(ipAddress);
    
    logger.warn('Suspicious IP activity detected', 'WS_RATE_LIMITER', {
      ipAddress,
      suspiciousCount: this.suspiciousIPs.size,
    });

    // Auto-block if IP appears suspicious multiple times
    const tracker = this.connectionTrackers.get(ipAddress);
    if (tracker) {
      const violations = tracker.count > this.maxConnectionsPerIP ? 1 : 0;
      if (violations > 0) {
        this.blockIP(ipAddress, 180); // 3 minutes initial block
      }
    }
  }

  /**
   * Block IP for a specific duration
   */
  private blockIP(ipAddress: string, durationSeconds: number): void {
    const tracker = this.connectionTrackers.get(ipAddress) || {
      count: 0,
      connections: new Set(),
      firstConnection: Date.now(),
    };

    tracker.blockedUntil = Date.now() + (durationSeconds * 1000);
    this.connectionTrackers.set(ipAddress, tracker);

    logger.warn('IP blocked for rate limit violations', 'WS_RATE_LIMITER', {
      ipAddress,
      durationSeconds,
      blockedUntil: new Date(tracker.blockedUntil).toISOString(),
    });
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): {
    totalBuckets: number;
    totalConnections: number;
    suspiciousIPs: number;
    blockedIPs: number;
    connectionsPerIP: Record<string, number>;
  } {
    const now = Date.now();
    const blockedIPs = Array.from(this.connectionTrackers.values())
      .filter(tracker => tracker.blockedUntil && tracker.blockedUntil > now)
      .length;

    const connectionsPerIP: Record<string, number> = {};
    for (const [ip, tracker] of this.connectionTrackers.entries()) {
      if (tracker.count > 0) {
        connectionsPerIP[ip] = tracker.count;
      }
    }

    return {
      totalBuckets: this.messageBuckets.size,
      totalConnections: Array.from(this.connectionTrackers.values())
        .reduce((sum, tracker) => sum + tracker.count, 0),
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs,
      connectionsPerIP,
    };
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const now = Date.now();
    const cleanupThreshold = 15 * 60 * 1000; // 15 minutes

    // Clean up old message buckets
    for (const [identifier, bucket] of this.messageBuckets.entries()) {
      if (now - bucket.lastRefill > cleanupThreshold) {
        this.messageBuckets.delete(identifier);
      }
    }

    // Clean up old connection trackers
    for (const [ip, tracker] of this.connectionTrackers.entries()) {
      if (tracker.count === 0 && 
          (!tracker.blockedUntil || tracker.blockedUntil < now) &&
          now - tracker.firstConnection > cleanupThreshold) {
        this.connectionTrackers.delete(ip);
        this.suspiciousIPs.delete(ip);
      }
    }

    logger.debug('Rate limiter cleanup completed', 'WS_RATE_LIMITER', {
      activeBuckets: this.messageBuckets.size,
      activeTrackers: this.connectionTrackers.size,
      suspiciousIPs: this.suspiciousIPs.size,
    });
  }

  /**
   * Reset rate limits for a specific identifier (admin function)
   */
  resetLimits(identifier: string, ipAddress?: string): void {
    this.messageBuckets.delete(identifier);
    
    if (ipAddress) {
      const tracker = this.connectionTrackers.get(ipAddress);
      if (tracker) {
        delete tracker.blockedUntil;
        this.suspiciousIPs.delete(ipAddress);
      }
    }

    logger.info('Rate limits reset', 'WS_RATE_LIMITER', { identifier, ipAddress });
  }

  /**
   * Shutdown the rate limiter
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.messageBuckets.clear();
    this.connectionTrackers.clear();
    this.suspiciousIPs.clear();
    
    logger.info('WebSocket Rate Limiter shutdown', 'WS_RATE_LIMITER');
  }
}

// Export singleton instance
export const wsRateLimiter = new WebSocketRateLimiter();