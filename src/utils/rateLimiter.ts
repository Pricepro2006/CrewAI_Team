/**
 * Advanced Rate Limiter Utility
 * Token bucket algorithm with enhanced security features
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

export interface RateLimiterOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests in window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor(private options: RateLimiterOptions) {
    // Clean up old buckets every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Try to consume a token for the given identifier
   * Returns true if successful, false if rate limit exceeded
   */
  tryConsume(identifier: string): boolean {
    let bucket = this.buckets.get(identifier);
    
    if (!bucket) {
      bucket = new TokenBucket(this.options.max, this.options.windowMs);
      this.buckets.set(identifier, bucket);
    }
    
    return bucket.tryConsume();
  }
  
  /**
   * Get remaining tokens for identifier
   */
  getRemaining(identifier: string): number {
    const bucket = this.buckets.get(identifier);
    return bucket ? bucket.getRemaining() : this.options.max;
  }
  
  /**
   * Reset rate limit for identifier
   */
  reset(identifier: string): void {
    this.buckets.delete(identifier);
  }
  
  /**
   * Clean up old buckets
   */
  private cleanup(): void {
    const now = Date.now();
    
    this.buckets.forEach((bucket, identifier) => {
      if (now - bucket.lastRefill > this.options.windowMs * 2) {
        this.buckets.delete(identifier);
      }
    });
  }
  
  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

/**
 * Token Bucket implementation
 */
class TokenBucket {
  private tokens: number;
  public lastRefill: number;
  
  constructor(
    private capacity: number,
    private windowMs: number
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  
  /**
   * Try to consume a token
   */
  tryConsume(): boolean {
    this.refill();
    
    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }
    
    return false;
  }
  
  /**
   * Get remaining tokens
   */
  getRemaining(): number {
    this.refill();
    return this.tokens;
  }
  
  /**
   * Refill tokens based on time passed
   */
  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    
    if (timePassed >= this.windowMs) {
      // Full refill after window expires
      this.tokens = this.capacity;
      this.lastRefill = now;
    } else {
      // Partial refill based on time passed
      const tokensToAdd = Math.floor((timePassed / this.windowMs) * this.capacity);
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      
      if (tokensToAdd > 0) {
        this.lastRefill = now;
      }
    }
  }
}

/**
 * Enhanced Express middleware for rate limiting
 */
export function createRateLimitMiddleware(options: RateLimiterOptions) {
  const limiter = new RateLimiter(options);
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate identifier using custom key generator or default
    const identifier = options.keyGenerator ? 
      options.keyGenerator(req) : 
      getClientIP(req);
    
    if (!limiter.tryConsume(identifier)) {
      const retryAfter = Math.ceil(options.windowMs / 1000);
      
      // Add rate limit headers
      res.setHeader("X-RateLimit-Limit", options.max);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", new Date(Date.now() + options.windowMs).toISOString());
      res.setHeader("Retry-After", retryAfter);
      
      // Log rate limit event
      logger.warn('Rate limit exceeded', 'RATE_LIMIT', {
        ip: getClientIP(req),
        userId: (req as any).user?.id,
        path: req.path,
        method: req.method,
        identifier,
        windowMs: options.windowMs,
        retryAfter
      });
      
      // Call custom handler if provided
      if (options.onLimitReached) {
        options.onLimitReached(req, res);
        return;
      }
      
      res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter,
        limit: options.max,
        windowMs: options.windowMs
      });
      return;
    }
    
    // Add rate limit headers for successful requests
    res.setHeader("X-RateLimit-Limit", options.max);
    res.setHeader("X-RateLimit-Remaining", limiter.getRemaining(identifier));
    res.setHeader("X-RateLimit-Reset", new Date(Date.now() + options.windowMs).toISOString());
    
    next();
  };
}

/**
 * Get client IP address
 */
function getClientIP(req: Request): string {
  return req.headers['x-forwarded-for']?.toString().split(',')[0] ||
         req.headers['x-real-ip']?.toString() ||
         req.socket.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Predefined rate limit configurations for security
 */
export const SecurityRateLimits = {
  // Very strict - for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    keyGenerator: (req: Request) => `auth:${getClientIP(req)}`
  },
  
  // Strict - for sensitive operations
  sensitive: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20
  },
  
  // Standard - for API endpoints
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100
  },
  
  // Search - for search operations
  search: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30
  },
  
  // WebSocket connections
  websocket: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60
  }
};

/**
 * Create user-specific rate limiter
 */
export function createUserRateLimiter(windowMs: number, max: number) {
  return createRateLimitMiddleware({
    windowMs,
    max,
    keyGenerator: (req: Request) => {
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${getClientIP(req)}`;
    }
  });
}