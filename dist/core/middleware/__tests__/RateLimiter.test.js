import { describe, it, expect, beforeEach, vi } from "vitest";
import { RateLimiter } from "../RateLimiter";
// Mock Redis
vi.mock("ioredis", () => {
    return vi.fn().mockImplementation(() => ({
        on: vi.fn(),
        disconnect: vi.fn(),
    }));
});
// Mock express-rate-limit
vi.mock("express-rate-limit", () => {
    return vi.fn().mockImplementation((config) => {
        return (req, res, next) => {
            // Simple mock implementation
            const key = config.keyGenerator ? config.keyGenerator(req) : req.ip;
            const requestCounts = global.mockRequestCounts || new Map();
            const count = requestCounts.get(key) || 0;
            if (count >= config.max) {
                res.status(429);
                return config.handler(req, res);
            }
            requestCounts.set(key, count + 1);
            res.setHeader("X-RateLimit-Limit", config.max);
            res.setHeader("X-RateLimit-Remaining", config.max - count - 1);
            next();
        };
    });
});
describe("RateLimiter", () => {
    let rateLimiter;
    let mockReq;
    let mockRes;
    let nextFn;
    beforeEach(() => {
        // Clear mock request counts
        global.mockRequestCounts = new Map();
        rateLimiter = new RateLimiter(false); // Use memory store
        mockReq = {
            ip: "127.0.0.1",
            path: "/api/search",
            body: {},
            query: {},
            user: undefined,
        };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            setHeader: vi.fn(),
            getHeader: vi.fn(),
        };
        nextFn = vi.fn();
    });
    describe("webSearchLimiter", () => {
        it("should allow requests under the limit", () => {
            const limiter = rateLimiter.webSearchLimiter();
            for (let i = 0; i < 10; i++) {
                limiter(mockReq, mockRes, nextFn);
            }
            expect(nextFn).toHaveBeenCalledTimes(10);
            expect(mockRes.status).not.toHaveBeenCalled();
        });
        it("should block requests over the limit", () => {
            const limiter = rateLimiter.webSearchLimiter();
            // Make 100 requests (the limit)
            for (let i = 0; i < 100; i++) {
                limiter(mockReq, mockRes, nextFn);
            }
            // The 101st request should be blocked
            limiter(mockReq, mockRes, nextFn);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: "Too many requests",
                message: "Rate limit exceeded. Please try again later.",
                retryAfter: undefined,
            });
        });
        it("should use user ID for authenticated users", () => {
            const limiter = rateLimiter.webSearchLimiter();
            const authenticatedReq = {
                ...mockReq,
                user: { id: "user123", premium: false },
            };
            limiter(authenticatedReq, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });
    describe("businessSearchLimiter", () => {
        it("should have stricter limits than webSearchLimiter", () => {
            const limiter = rateLimiter.businessSearchLimiter();
            // Make 30 requests (the limit)
            for (let i = 0; i < 30; i++) {
                if ("mockReset" in nextFn)
                    nextFn.mockReset();
                limiter(mockReq, mockRes, nextFn);
                expect(nextFn).toHaveBeenCalled();
            }
            // The 31st request should be blocked
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(429);
        });
        it("should include query in rate limit key", () => {
            const limiter = rateLimiter.businessSearchLimiter();
            const reqWithQuery = {
                ...mockReq,
                body: { query: "plumber near me" },
            };
            limiter(reqWithQuery, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });
    describe("globalLimiter", () => {
        it("should have high limit for general API usage", () => {
            const limiter = rateLimiter.globalLimiter();
            // Should allow many requests
            for (let i = 0; i < 100; i++) {
                limiter(mockReq, mockRes, nextFn);
            }
            expect(nextFn).toHaveBeenCalledTimes(100);
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });
    describe("premiumLimiter", () => {
        it("should allow premium users higher limits", () => {
            const limiter = rateLimiter.premiumLimiter();
            const premiumReq = {
                ...mockReq,
                user: { id: "premium123", premium: true },
            };
            // Premium users get 500 requests
            for (let i = 0; i < 100; i++) {
                limiter(premiumReq, mockRes, nextFn);
            }
            expect(nextFn).toHaveBeenCalledTimes(100);
            expect(mockRes.status).not.toHaveBeenCalled();
        });
        it("should apply default limits to non-premium users", () => {
            const limiter = rateLimiter.premiumLimiter();
            // Non-premium users treated as single key
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });
    describe("slidingWindowLimiter", () => {
        it("should track requests in sliding window", async () => {
            const limiter = rateLimiter.slidingWindowLimiter(1000, 5); // 1 second window, 5 max
            // Make 5 requests quickly
            for (let i = 0; i < 5; i++) {
                if ("mockReset" in nextFn)
                    nextFn.mockReset();
                limiter(mockReq, mockRes, nextFn);
                expect(nextFn).toHaveBeenCalled();
            }
            // 6th request should be blocked
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
            // Wait for window to slide
            await new Promise((resolve) => setTimeout(resolve, 1100));
            // Should allow request again
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });
    describe("tokenBucketLimiter", () => {
        it("should allow burst of requests up to capacity", () => {
            const limiter = rateLimiter.tokenBucketLimiter(5, 1); // 5 capacity, 1 token/second
            // Should allow 5 requests immediately (using all tokens)
            for (let i = 0; i < 5; i++) {
                if ("mockReset" in nextFn)
                    nextFn.mockReset();
                limiter(mockReq, mockRes, nextFn);
                expect(nextFn).toHaveBeenCalled();
            }
            // 6th request should be blocked (no tokens left)
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
        });
        it("should refill tokens over time", async () => {
            const limiter = rateLimiter.tokenBucketLimiter(2, 2); // 2 capacity, 2 tokens/second
            // Use all tokens
            limiter(mockReq, mockRes, nextFn);
            limiter(mockReq, mockRes, nextFn);
            // Should be blocked
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).not.toHaveBeenCalled();
            // Wait for token refill
            await new Promise((resolve) => setTimeout(resolve, 600));
            // Should have 1 token now
            if ("mockReset" in nextFn)
                nextFn.mockReset();
            limiter(mockReq, mockRes, nextFn);
            expect(nextFn).toHaveBeenCalled();
        });
    });
    describe("cleanup", () => {
        it("should disconnect Redis client if present", () => {
            const rateLimiterWithRedis = new RateLimiter(true);
            const disconnectSpy = vi.spyOn(rateLimiterWithRedis.redisClient || {}, "disconnect");
            rateLimiterWithRedis.cleanup();
            if (rateLimiterWithRedis.redisClient) {
                expect(disconnectSpy).toHaveBeenCalled();
            }
        });
    });
});
//# sourceMappingURL=RateLimiter.test.js.map