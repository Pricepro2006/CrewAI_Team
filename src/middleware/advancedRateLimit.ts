import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { TRPCError } from '@trpc/server';

// Types for rate limit configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface AdvancedRateLimitOptions {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  tiers: {
    anonymous: RateLimitConfig;
    authenticated: RateLimitConfig;
    admin: RateLimitConfig;
  };
  endpoints: {
    auth: RateLimitConfig;
    api: RateLimitConfig;
    upload: RateLimitConfig;
    websocket: RateLimitConfig;
  };
  progressiveDelay: {
    enabled: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    multiplier: number;
  };
  monitoring: {
    alertThreshold: number;
    logViolations: boolean;
  };
}

// Default configuration
export const DEFAULT_RATE_LIMIT_CONFIG: AdvancedRateLimitOptions = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0')
  },
  tiers: {
    anonymous: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 requests per window
      message: 'Too many requests from this IP, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    },
    authenticated: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 requests per window
      message: 'Too many requests from this user, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    },
    admin: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 10000, // Effectively unlimited for admins
      message: 'Admin rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false
    }
  },
  endpoints: {
    auth: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // Very strict for auth endpoints
      message: 'Too many authentication attempts, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    },
    api: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 500, // Standard API rate limit
      message: 'API rate limit exceeded, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    },
    upload: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 10, // Very strict for file uploads
      message: 'File upload rate limit exceeded, please try again later',
      standardHeaders: true,
      legacyHeaders: false
    },
    websocket: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60, // 1 per second average
      message: 'WebSocket connection rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false
    }
  },
  progressiveDelay: {
    enabled: true,
    baseDelayMs: 1000, // 1 second base delay
    maxDelayMs: 30000, // 30 seconds max delay
    multiplier: 2 // Double delay each violation
  },
  monitoring: {
    alertThreshold: 10, // Alert after 10 violations in window
    logViolations: true
  }
};

export class AdvancedRateLimit {
  private redis: Redis;
  private config: AdvancedRateLimitOptions;
  private violationCounts: Map<string, number> = new Map();

  constructor(config: Partial<AdvancedRateLimitOptions> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3
    });

    this.redis.on('error', (err) => {
      console.error('Redis connection error:', err);
    });

    this.redis.on('connect', () => {
      console.log('Redis connected for rate limiting');
    });
  }

  // Get user tier based on request context
  private getUserTier(req: Request): 'anonymous' | 'authenticated' | 'admin' {
    const user = (req as any).user;
    
    if (!user) return 'anonymous';
    if (user.role === 'admin' || user.isAdmin) return 'admin';
    return 'authenticated';
  }

  // Get endpoint type based on request path
  private getEndpointType(req: Request): keyof AdvancedRateLimitOptions['endpoints'] {
    const path = req.path;
    
    if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
      return 'auth';
    }
    if (path.includes('/upload') || req.method === 'POST' && req.headers['content-type']?.includes('multipart')) {
      return 'upload';
    }
    if (path.includes('/ws') || path.includes('/websocket')) {
      return 'websocket';
    }
    return 'api';
  }

  // Generate rate limit key
  private generateKey(req: Request, type: 'user' | 'ip' | 'endpoint'): string {
    const user = (req as any).user;
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const endpoint = this.getEndpointType(req);

    switch (type) {
      case 'user':
        return user?.id ? `rate_limit:user:${user.id}` : `rate_limit:ip:${ip}`;
      case 'ip':
        return `rate_limit:ip:${ip}`;
      case 'endpoint':
        return `rate_limit:endpoint:${endpoint}:${user?.id || ip}`;
      default:
        return `rate_limit:unknown:${ip}`;
    }
  }

  // Apply progressive delay for repeated violations
  private async applyProgressiveDelay(key: string): Promise<void> {
    if (!this.config.progressiveDelay.enabled) return;

    const violations = this.violationCounts.get(key) || 0;
    if (violations === 0) return;

    const delay = Math.min(
      this.config.progressiveDelay.baseDelayMs * Math.pow(this.config.progressiveDelay.multiplier, violations - 1),
      this.config.progressiveDelay.maxDelayMs
    );

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // Log rate limit violation
  private logViolation(req: Request, config: RateLimitConfig): void {
    if (!this.config.monitoring.logViolations) return;

    const user = (req as any).user;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    const endpoint = req.path;

    console.warn('Rate limit violation:', {
      timestamp: new Date().toISOString(),
      ip,
      userId: user?.id,
      userAgent,
      endpoint,
      method: req.method,
      limit: config.maxRequests,
      window: config.windowMs
    });
  }

  // Check if monitoring alert threshold is reached
  private checkAlertThreshold(key: string): void {
    const violations = this.violationCounts.get(key) || 0;
    if (violations >= this.config.monitoring.alertThreshold) {
      console.error('ALERT: High rate limit violations detected:', {
        key,
        violations,
        threshold: this.config.monitoring.alertThreshold,
        timestamp: new Date().toISOString()
      });
      
      // Reset count to avoid spam alerts
      this.violationCounts.set(key, 0);
    }
  }

  // Create rate limit middleware for specific configuration
  private createRateLimiter(config: RateLimitConfig, keyType: 'user' | 'ip' | 'endpoint' = 'user') {
    return rateLimit({
      store: new RedisStore({
        client: this.redis,
        prefix: 'rl:'
      }),
      windowMs: config.windowMs,
      max: config.maxRequests,
      standardHeaders: config.standardHeaders,
      legacyHeaders: config.legacyHeaders,
      skipSuccessfulRequests: config.skipSuccessfulRequests,
      skipFailedRequests: config.skipFailedRequests,
      keyGenerator: (req: Request) => this.generateKey(req, keyType),
      handler: async (req: Request, res: Response) => {
        const key = this.generateKey(req, keyType);
        
        // Log violation
        this.logViolation(req, config);
        
        // Update violation count
        const violations = this.violationCounts.get(key) || 0;
        this.violationCounts.set(key, violations + 1);
        
        // Check alert threshold
        this.checkAlertThreshold(key);
        
        // Apply progressive delay
        await this.applyProgressiveDelay(key);
        
        // Send rate limit response
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: config.message,
          retryAfter: Math.ceil(config.windowMs / 1000),
          limit: config.maxRequests,
          window: config.windowMs,
          violations: violations + 1
        });
      },
      onLimitReached: config.onLimitReached
    });
  }

  // Get rate limiter based on user tier
  public getUserTierLimiter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const tier = this.getUserTier(req);
      const config = this.config.tiers[tier];
      const limiter = this.createRateLimiter(config, 'user');
      return limiter(req, res, next);
    };
  }

  // Get rate limiter based on endpoint type
  public getEndpointLimiter() {
    return (req: Request, res: Response, next: NextFunction) => {
      const endpointType = this.getEndpointType(req);
      const config = this.config.endpoints[endpointType];
      const limiter = this.createRateLimiter(config, 'endpoint');
      return limiter(req, res, next);
    };
  }

  // Get IP-based rate limiter (fallback)
  public getIPLimiter() {
    const config = this.config.tiers.anonymous;
    return this.createRateLimiter(config, 'ip');
  }

  // Get auth endpoint specific limiter
  public getAuthLimiter() {
    const config = this.config.endpoints.auth;
    return this.createRateLimiter(config, 'ip');
  }

  // Get upload endpoint specific limiter
  public getUploadLimiter() {
    const config = this.config.endpoints.upload;
    return this.createRateLimiter(config, 'user');
  }

  // Get WebSocket connection limiter
  public getWebSocketLimiter() {
    const config = this.config.endpoints.websocket;
    return this.createRateLimiter(config, 'ip');
  }

  // Admin bypass checker
  public adminBypass() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      // Skip rate limiting for admin users
      if (user && (user.role === 'admin' || user.isAdmin)) {
        return next();
      }
      
      return next();
    };
  }

  // TRPC-specific rate limiting middleware
  public createTRPCRateLimit(config: RateLimitConfig) {
    const limiter = this.createRateLimiter(config);
    
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await new Promise<void>((resolve, reject) => {
          limiter(req, res, (err?: any) => {
            if (err) reject(err);
            else resolve();
          });
        });
        next();
      } catch (error) {
        // Convert Express rate limit error to TRPC error
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: config.message || 'Rate limit exceeded'
        });
      }
    };
  }

  // Cleanup method
  public async cleanup(): Promise<void> {
    await this.redis.quit();
    this.violationCounts.clear();
  }

  // Get current rate limit status for a key
  public async getRateLimitStatus(req: Request): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
    violations: number;
  }> {
    const tier = this.getUserTier(req);
    const config = this.config.tiers[tier];
    const key = this.generateKey(req, 'user');
    
    const current = await this.redis.get(`rl:${key}`) || '0';
    const remaining = Math.max(0, config.maxRequests - parseInt(current));
    const violations = this.violationCounts.get(key) || 0;
    
    // Calculate reset time
    const ttl = await this.redis.ttl(`rl:${key}`);
    const reset = new Date(Date.now() + (ttl * 1000));
    
    return {
      limit: config.maxRequests,
      remaining,
      reset,
      violations
    };
  }
}

// Export singleton instance
export const advancedRateLimit = new AdvancedRateLimit();