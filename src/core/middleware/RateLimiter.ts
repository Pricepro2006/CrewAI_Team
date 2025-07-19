import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

export class RateLimiter {
  private redisClient?: Redis;
  private useRedis: boolean;

  constructor(useRedis: boolean = false) {
    this.useRedis = useRedis;
    
    if (useRedis) {
      this.redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryStrategy: (times: number) => {
          if (times > 3) {
            logger.error('Redis connection failed, falling back to memory store');
            this.useRedis = false;
            return null;
          }
          return Math.min(times * 50, 2000);
        }
      });

      this.redisClient.on('error', (err) => {
        logger.error('Redis error:', err);
        this.useRedis = false;
      });
    }
  }

  // WebSearch-specific rate limiter
  public webSearchLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      message: 'Too many WebSearch requests, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
      keyGenerator: (req: Request) => {
        // Rate limit by user ID if authenticated, otherwise by IP
        return req.user?.id || req.ip;
      }
    };

    return this.createLimiter(config);
  }

  // Strict rate limiter for business search queries
  public businessSearchLimiter() {
    const config: RateLimitConfig = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 30, // 30 requests per window
      message: 'Business search rate limit exceeded. Please wait before searching again.',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        // Combine IP and search query for more granular limiting
        const query = req.body?.query || req.query?.q || '';
        return `${req.ip}:${query.slice(0, 50)}`;
      }
    };

    return this.createLimiter(config);
  }

  // Global API rate limiter
  public globalLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per window
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    };

    return this.createLimiter(config);
  }

  // Premium tier rate limiter (higher limits)
  public premiumLimiter() {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // 500 requests per window for premium users
      message: 'Premium rate limit exceeded.',
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        // Must have authenticated user with premium status
        if (!req.user?.premium) {
          return 'non-premium';
        }
        return `premium:${req.user.id}`;
      }
    };

    return this.createLimiter(config);
  }

  // Create rate limiter with Redis store if available
  private createLimiter(config: RateLimitConfig) {
    const limiterConfig: any = {
      ...config,
      handler: this.rateLimitHandler.bind(this)
    };

    // Use Redis store if available and connected
    if (this.useRedis && this.redisClient) {
      limiterConfig.store = new RedisStore({
        client: this.redisClient,
        prefix: 'rl:',
        sendCommand: (...args: string[]) => (this.redisClient as any).call(...args)
      });
    }

    return rateLimit(limiterConfig);
  }

  // Custom rate limit handler with logging
  private rateLimitHandler(req: Request, res: Response) {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      userId: req.user?.id,
      headers: {
        'x-ratelimit-limit': res.getHeader('x-ratelimit-limit'),
        'x-ratelimit-remaining': res.getHeader('x-ratelimit-remaining'),
        'x-ratelimit-reset': res.getHeader('x-ratelimit-reset')
      }
    });

    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: res.getHeader('Retry-After')
    });
  }

  // Sliding window rate limiter for more accurate limiting
  public slidingWindowLimiter(windowMs: number, max: number) {
    const requests = new Map<string, number[]>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Get existing requests for this key
      const userRequests = requests.get(key) || [];
      
      // Filter out old requests outside the window
      const validRequests = userRequests.filter(timestamp => timestamp > windowStart);
      
      // Check if limit exceeded
      if (validRequests.length >= max) {
        return this.rateLimitHandler(req, res);
      }

      // Add current request
      validRequests.push(now);
      requests.set(key, validRequests);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - validRequests.length);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());

      next();
    };
  }

  // Token bucket rate limiter for burst handling
  public tokenBucketLimiter(capacity: number, refillRate: number) {
    const buckets = new Map<string, { tokens: number; lastRefill: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const key = req.ip;
      const now = Date.now();
      
      let bucket = buckets.get(key);
      
      if (!bucket) {
        bucket = { tokens: capacity, lastRefill: now };
        buckets.set(key, bucket);
      } else {
        // Refill tokens based on time passed
        const timePassed = now - bucket.lastRefill;
        const tokensToAdd = Math.floor(timePassed * refillRate / 1000);
        bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }

      if (bucket.tokens < 1) {
        return this.rateLimitHandler(req, res);
      }

      // Consume a token
      bucket.tokens--;

      // Set headers
      res.setHeader('X-RateLimit-Limit', capacity);
      res.setHeader('X-RateLimit-Remaining', bucket.tokens);

      next();
    };
  }

  // Cleanup method for memory management
  public cleanup() {
    if (this.redisClient) {
      this.redisClient.disconnect();
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter(process.env.USE_REDIS === 'true');

// Export middleware functions
export const webSearchRateLimit = rateLimiter.webSearchLimiter();
export const businessSearchRateLimit = rateLimiter.businessSearchLimiter();
export const globalRateLimit = rateLimiter.globalLimiter();
export const premiumRateLimit = rateLimiter.premiumLimiter();