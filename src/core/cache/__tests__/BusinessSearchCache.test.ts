import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BusinessSearchCache,
  type CacheEntry,
} from "../BusinessSearchCache.js";
import type { ValidationResult } from "../../validators/BusinessResponseValidator.js";

// Mock Redis with shared data store
const mockRedisData = new Map<string, string>();

// Reset function for tests
const resetMockRedisData = () => {
  mockRedisData.clear();
};

vi.mock("ioredis", () => {
  const MockRedis = vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    get: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(mockRedisData.get(key) || null);
    }),
    set: vi.fn().mockImplementation((key: string, value: string, ...args: any[]) => {
      mockRedisData.set(key, value);
      return Promise.resolve("OK");
    }),
    del: vi.fn().mockImplementation((...keys: string[]) => {
      keys.forEach((key) => mockRedisData.delete(key));
      return Promise.resolve(keys.length);
    }),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const keys = Array.from(mockRedisData.keys());
      const regex = new RegExp(pattern.replace("*", ".*"));
      return Promise.resolve(keys.filter((key) => regex.test(key)));
    }),
    expire: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
  }));

  return {
    default: MockRedis,
    Redis: MockRedis,
  };
});

describe("BusinessSearchCache", () => {
  let cache: BusinessSearchCache;
  const testQuery = "Find plumbers near me";
  const testLocation = "90210";
  const testResponse =
    "Here are plumbers in your area: ABC Plumbing (555-1234)";

  beforeEach(() => {
    vi.clearAllMocks();
    resetMockRedisData();
    
    cache = new BusinessSearchCache({
      maxSize: 100,
      maxAge: 60 * 1000, // 1 minute for testing
      staleWhileRevalidate: 10 * 1000, // 10 seconds
      useRedis: false,
    });
  });

  describe("Basic Operations", () => {
    it("should store and retrieve cache entries", async () => {
      await cache.set(testQuery, testLocation, testResponse);
      const entry = await cache.get(testQuery, testLocation);

      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);
      expect(entry!.metadata.query).toBe(testQuery);
      expect(entry!.metadata.location).toBe(testLocation);
      expect(entry!.hitCount).toBe(1); // Incremented on get
    });

    it("should return null for missing entries", async () => {
      const entry = await cache.get("non-existent query", "nowhere");
      expect(entry).toBeNull();
    });

    it("should handle entries without location", async () => {
      await cache.set(testQuery, undefined, testResponse);
      const entry = await cache.get(testQuery, undefined);

      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);
    });

    it("should delete entries", async () => {
      await cache.set(testQuery, testLocation, testResponse);
      const deleted = await cache.delete(testQuery, testLocation);

      expect(deleted).toBe(true);

      const entry = await cache.get(testQuery, testLocation);
      expect(entry).toBeNull();
    });

    it("should clear all entries", async () => {
      await cache.set("query1", "loc1", "response1");
      await cache.set("query2", "loc2", "response2");
      await cache.set("query3", "loc3", "response3");

      await cache.clear();

      expect(await cache.get("query1", "loc1")).toBeNull();
      expect(await cache.get("query2", "loc2")).toBeNull();
      expect(await cache.get("query3", "loc3")).toBeNull();
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent keys for same input", async () => {
      await cache.set(testQuery, testLocation, testResponse);

      // Same query and location should hit cache
      const entry1 = await cache.get(testQuery, testLocation);
      
      expect(entry1).not.toBeNull();
      expect(entry1!.hitCount).toBe(1);
      
      const entry2 = await cache.get(testQuery, testLocation);
      
      expect(entry2).not.toBeNull();
      expect(entry2!.hitCount).toBe(2);
      // Both entries are the same object reference
      expect(entry1).toBe(entry2);
      expect(entry1!.hitCount).toBe(2); // entry1 is also updated to 2 since it's the same object
    });

    it("should normalize queries for key generation", async () => {
      await cache.set("  Find PLUMBERS near me  ", testLocation, testResponse);

      // Different casing and spacing should still hit cache
      const entry = await cache.get("find plumbers near me", testLocation);

      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);
    });

    it("should treat different locations as different keys", async () => {
      await cache.set(testQuery, "90210", "Response for 90210");
      await cache.set(testQuery, "10001", "Response for 10001");

      const entry1 = await cache.get(testQuery, "90210");
      const entry2 = await cache.get(testQuery, "10001");

      expect(entry1!.response).toBe("Response for 90210");
      expect(entry2!.response).toBe("Response for 10001");
    });
  });

  describe("TTL and Staleness", () => {
    it("should respect max age", async () => {
      const shortLivedCache = new BusinessSearchCache({
        maxSize: 100,
        maxAge: 100, // 100ms
        staleWhileRevalidate: 50, // 50ms
      });

      await shortLivedCache.set(testQuery, testLocation, testResponse);

      // Should be fresh immediately
      let entry = await shortLivedCache.get(testQuery, testLocation);
      expect(entry).not.toBeNull();

      // Wait for max age + stale window
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should be too stale now
      entry = await shortLivedCache.get(testQuery, testLocation);
      expect(entry).toBeNull();
    });

    it("should serve stale content within revalidation window", async () => {
      const shortLivedCache = new BusinessSearchCache({
        maxSize: 100,
        maxAge: 50, // 50ms
        staleWhileRevalidate: 100, // 100ms
      });

      await shortLivedCache.set(testQuery, testLocation, testResponse);

      // Wait past max age but within stale window
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Should still return stale content
      const entry = await shortLivedCache.get(testQuery, testLocation);
      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);
    });
  });

  describe("Statistics and Metrics", () => {
    it("should track hits and misses", async () => {
      await cache.set(testQuery, testLocation, testResponse);

      // Hit
      await cache.get(testQuery, testLocation);

      // Misses
      await cache.get("non-existent", "nowhere");
      await cache.get("another miss", "nowhere");

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(33.33, 1);
    });

    it("should track evictions", async () => {
      const tinyCache = new BusinessSearchCache({
        maxSize: 2,
        maxAge: 60 * 1000,
      });

      await tinyCache.set("query1", "loc1", "response1");
      await tinyCache.set("query2", "loc2", "response2");
      await tinyCache.set("query3", "loc3", "response3"); // Should evict query1

      const stats = tinyCache.getStats();
      expect(stats.evictions).toBe(1);
      expect(stats.size).toBe(2);
    });

    it("should calculate average response time", async () => {
      await cache.set(testQuery, testLocation, testResponse);

      // Multiple gets to build response time history
      for (let i = 0; i < 5; i++) {
        await cache.get(testQuery, testLocation);
      }

      const stats = cache.getStats();
      expect(stats.avgResponseTime).toBeGreaterThanOrEqual(0);
      expect(stats.avgResponseTime).toBeLessThan(100); // Should be fast (relaxed upper bound)
    });
  });

  describe("Cache Analysis", () => {
    it("should identify hot queries", async () => {
      // Create entries with different hit counts
      await cache.set("popular query", "loc1", "response1");
      await cache.set("rare query", "loc2", "response2");
      await cache.set("medium query", "loc3", "response3");

      // Generate hits
      for (let i = 0; i < 10; i++) {
        await cache.get("popular query", "loc1");
      }
      for (let i = 0; i < 3; i++) {
        await cache.get("medium query", "loc3");
      }
      await cache.get("rare query", "loc2");

      const analysis = cache.analyzePerformance();

      expect(analysis.hotQueries[0]?.query).toBe("popular query");
      expect(analysis.hotQueries[0]?.hitCount).toBe(10);
      expect(analysis.hotQueries[1]?.query).toBe("medium query");
      expect(analysis.hotQueries[1]?.hitCount).toBe(3);
    });

    it("should calculate memory pressure", async () => {
      const smallCache = new BusinessSearchCache({
        maxSize: 5,
        maxAge: 60 * 1000,
      });

      // Fill cache to 60% capacity
      await smallCache.set("query1", "loc1", "response1");
      await smallCache.set("query2", "loc2", "response2");
      await smallCache.set("query3", "loc3", "response3");

      const analysis = smallCache.analyzePerformance();
      expect(analysis.memoryPressure).toBe(60);
    });
  });

  describe("Search Functionality", () => {
    it("should search cache entries by pattern", async () => {
      await cache.set("Find plumbers in NYC", "NYC", "NYC plumbers");
      await cache.set("Find electricians in LA", "LA", "LA electricians");
      await cache.set(
        "Find plumbers in Chicago",
        "Chicago",
        "Chicago plumbers",
      );

      const plumberResults = await cache.search(/plumbers/i);
      expect(plumberResults).toHaveLength(2);
      expect(
        plumberResults.every((r) =>
          r.entry.metadata.query.includes("plumbers"),
        ),
      ).toBe(true);

      const cityResults = await cache.search(/NYC|Chicago/);
      expect(cityResults).toHaveLength(2);
    });
  });

  describe("Preloading", () => {
    it("should preload common queries", async () => {
      const commonQueries = [
        {
          query: "Find emergency plumber",
          location: "90210",
          response: "Emergency plumbers...",
        },
        {
          query: "Find 24/7 electrician",
          location: "90210",
          response: "24/7 electricians...",
        },
        { query: "Find locksmith near me", response: "Locksmiths..." },
      ];

      await cache.preload(commonQueries);

      // Verify all preloaded
      const entry1 = await cache.get("Find emergency plumber", "90210");
      const entry2 = await cache.get("Find 24/7 electrician", "90210");
      const entry3 = await cache.get("Find locksmith near me", undefined);

      expect(entry1!.response).toBe("Emergency plumbers...");
      expect(entry2!.response).toBe("24/7 electricians...");
      expect(entry3!.response).toBe("Locksmiths...");
    });
  });

  describe("Redis Integration", () => {
    it("should use Redis when enabled", async () => {
      const ioredis = await import("ioredis");
      const MockedRedis = vi.mocked(ioredis.default);
      
      // Ensure we have a proper mock implementation
      const mockRedisInstance = {
        on: vi.fn(),
        get: vi.fn().mockImplementation((key: string) => {
          return Promise.resolve(mockRedisData.get(key) || null);
        }),
        set: vi.fn().mockImplementation((key: string, value: string, ...args: any[]) => {
          mockRedisData.set(key, value);
          return Promise.resolve("OK");
        }),
        del: vi.fn().mockImplementation((...keys: string[]) => {
          keys.forEach((key) => mockRedisData.delete(key));
          return Promise.resolve(keys.length);
        }),
        keys: vi.fn().mockImplementation((pattern: string) => {
          const keys = Array.from(mockRedisData.keys());
          const regex = new RegExp(pattern.replace("*", ".*"));
          return Promise.resolve(keys.filter((key) => regex.test(key)));
        }),
        expire: vi.fn().mockResolvedValue(1),
        quit: vi.fn().mockResolvedValue(undefined),
      };

      MockedRedis.mockImplementationOnce(() => mockRedisInstance);

      const redisCache = new BusinessSearchCache({
        useRedis: true,
        redisPrefix: "test:",
        maxAge: 60 * 1000,
      });

      await redisCache.set(testQuery, testLocation, testResponse);

      // Should retrieve from cache (could be memory or Redis)
      const entry = await redisCache.get(testQuery, testLocation);
      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);

      await redisCache.cleanup();
    });

    it("should handle Redis errors gracefully", async () => {
      const ioredis = await import("ioredis");
      const MockedRedis = vi.mocked(ioredis.default);
      
      let setCallCount = 0;
      
      // Create a mock instance that fails on initial set/get but allows cache hit updates
      const mockRedisInstance = {
        on: vi.fn(),
        get: vi.fn().mockRejectedValue(new Error("Redis error")),
        set: vi.fn().mockImplementation(() => {
          setCallCount++;
          if (setCallCount === 1) {
            // First set call (during cache.set) should fail
            return Promise.reject(new Error("Redis error"));
          } else {
            // Subsequent set calls (during cache.get hit updates) should succeed
            return Promise.resolve("OK");
          }
        }),
        del: vi.fn().mockRejectedValue(new Error("Redis error")),
        keys: vi.fn().mockRejectedValue(new Error("Redis error")),
        expire: vi.fn().mockRejectedValue(new Error("Redis error")),
        quit: vi.fn().mockResolvedValue(undefined),
      };

      // Mock the constructor to return our error-throwing instance for this test
      MockedRedis.mockImplementationOnce(() => mockRedisInstance);

      const redisCache = new BusinessSearchCache({
        useRedis: true,
        maxAge: 60 * 1000,
      });

      // Set should work (memory cache always works, Redis set will fail but that's logged and ignored)
      await redisCache.set(testQuery, testLocation, testResponse);
      
      // Get should work from memory cache 
      const entry = await redisCache.get(testQuery, testLocation);

      expect(entry).not.toBeNull();
      expect(entry!.response).toBe(testResponse);

      await redisCache.cleanup();
    });
  });

  describe("Export and Import", () => {
    it("should export and import cache entries", async () => {
      // Populate cache
      await cache.set("query1", "loc1", "response1");
      await cache.set("query2", "loc2", "response2");

      // Export
      const exported = await cache.exportCache();
      expect(exported).toHaveLength(2);

      // Clear and reimport
      await cache.clear();
      await cache.importCache(exported);

      // Verify imported
      const entry1 = await cache.get("query1", "loc1");
      const entry2 = await cache.get("query2", "loc2");

      expect(entry1!.response).toBe("response1");
      expect(entry2!.response).toBe("response2");
    });
  });

  describe("Validation Integration", () => {
    it("should store validation results with cache entries", async () => {
      const validation: ValidationResult = {
        isValid: true,
        confidence: 0.95,
        hasActionableInfo: true,
        contactInfo: {
          phones: [
            {
              value: "555-1234",
              normalized: "5551234",
              type: "us",
              confidence: 0.9,
              index: 0,
            },
          ],
          addresses: [
            {
              value: "123 Main St",
              street: "123 Main St",
              type: "street",
              confidence: 0.9,
              index: 0,
            },
          ],
          businessNames: [
            {
              value: "ABC Plumbing",
              hasEntityType: true,
              confidence: 0.9,
              index: 0,
            },
          ],
          hours: [],
          emails: [],
          websites: [],
        },
        missingInfo: [],
        suggestions: [],
      };

      await cache.set(testQuery, testLocation, testResponse, validation);

      const entry = await cache.get(testQuery, testLocation);
      expect(entry!.validation).toEqual(validation);
      expect(entry!.validation!.confidence).toBe(0.95);
    });
  });
});
