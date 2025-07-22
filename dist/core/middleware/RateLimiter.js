import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import { logger } from '../../utils/logger';
export class RateLimiter {
    redisClient;
    useRedis;
    constructor(useRedis = false) {
        this.useRedis = useRedis;
        if (useRedis) {
            this.redisClient = new Redis({
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT || '6379'),
                password: process.env.REDIS_PASSWORD,
                retryStrategy: (times) => {
                    if (times > 3) {
                        logger.error('Redis connection failed, falling back to memory store');
                        this.useRedis = false;
                        return null;
                    }
                    return Math.min(times * 50, 2000);
                }
            });
            this.redisClient.on('error', (err) => {
                logger.error('Redis error:', err instanceof Error ? err.message : String(err));
                this.useRedis = false;
            });
        }
    }
    // WebSearch-specific rate limiter
    webSearchLimiter() {
        const config = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // 100 requests per window
            message: 'Too many WebSearch requests, please try again later.',
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: false,
            skipFailedRequests: true,
            keyGenerator: (req) => {
                // Rate limit by user ID if authenticated, otherwise by IP
                return req.user?.id || req.ip || 'unknown';
            }
        };
        return this.createLimiter(config);
    }
    // Strict rate limiter for business search queries
    businessSearchLimiter() {
        const config = {
            windowMs: 5 * 60 * 1000, // 5 minutes
            max: 30, // 30 requests per window
            message: 'Business search rate limit exceeded. Please wait before searching again.',
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
                // Combine IP and search query for more granular limiting
                const query = req.body?.query || req.query?.q || '';
                return `${req.ip || 'unknown'}:${query.slice(0, 50)}`;
            }
        };
        return this.createLimiter(config);
    }
    // Global API rate limiter
    globalLimiter() {
        const config = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // 1000 requests per window
            message: 'Too many requests from this IP, please try again later.',
            standardHeaders: true,
            legacyHeaders: false
        };
        return this.createLimiter(config);
    }
    // Premium tier rate limiter (higher limits)
    premiumLimiter() {
        const config = {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 500, // 500 requests per window for premium users
            message: 'Premium rate limit exceeded.',
            standardHeaders: true,
            legacyHeaders: false,
            keyGenerator: (req) => {
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
    createLimiter(config) {
        const limiterConfig = {
            ...config,
            handler: this.rateLimitHandler.bind(this),
            // Disable IPv6 validation warning for local development
            validate: false
        };
        // Use Redis store if available and connected
        if (this.useRedis && this.redisClient) {
            limiterConfig.store = new RedisStore({
                // @ts-expect-error - RedisStore types may not match exactly
                client: this.redisClient,
                prefix: 'rl:'
            });
        }
        return rateLimit(limiterConfig);
    }
    // Custom rate limit handler with logging
    rateLimitHandler(req, res) {
        logger.warn('Rate limit exceeded', 'RATE_LIMITER', {
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
    slidingWindowLimiter(windowMs, max) {
        const requests = new Map();
        return (req, res, next) => {
            const key = req.ip || 'unknown';
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
    tokenBucketLimiter(capacity, refillRate) {
        const buckets = new Map();
        return (req, res, next) => {
            const key = req.ip || 'unknown';
            const now = Date.now();
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { tokens: capacity, lastRefill: now };
                buckets.set(key, bucket);
            }
            else {
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
    cleanup() {
        if (this.redisClient) {
            this.redisClient.disconnect();
        }
    }
    // Get metrics for rate limiting
    getMetrics() {
        // Return mock metrics for now - in production this would aggregate from Redis
        return {
            totalRequests: 0,
            rateLimitedRequests: 0,
            percentageRateLimited: '0',
            averageLatency: 0,
            circuitBreakerStatus: 'closed',
            windowResets: {
                webSearch: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                businessSearch: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                premium: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            }
        };
    }
    // Check limit for an identifier
    checkLimit(identifier) {
        // Mock implementation - in production this would check Redis
        return {
            allowed: true,
            remaining: 100,
            reset: new Date(Date.now() + 15 * 60 * 1000)
        };
    }
    // Reset rate limit for an identifier
    reset(identifier) {
        // In production, this would clear the Redis keys for this identifier
        logger.info('Rate limit reset', 'RATE_LIMITER', { identifier });
    }
    // Reset all rate limits
    resetAll() {
        // In production, this would clear all Redis rate limit keys
        logger.info('All rate limits reset', 'RATE_LIMITER');
    }
    // Get singleton instance
    static getInstance() {
        return rateLimiter;
    }
}
// Export singleton instance
export const rateLimiter = new RateLimiter(process.env.USE_REDIS === 'true');
// Export middleware functions
export const webSearchRateLimit = rateLimiter.webSearchLimiter();
export const businessSearchRateLimit = rateLimiter.businessSearchLimiter();
export const globalRateLimit = rateLimiter.globalLimiter();
export const premiumRateLimit = rateLimiter.premiumLimiter();
//# sourceMappingURL=RateLimiter.js.map