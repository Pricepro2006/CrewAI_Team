import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusinessSearchMiddleware } from '../BusinessSearchMiddleware';
import type { OllamaProvider } from '../../llm/OllamaProvider';

// Mock dependencies
vi.mock("../../llm/OllamaProvider");
vi.mock("../../../utils/logger");
vi.mock("../../../config/features/FeatureFlagService", () => ({
  FeatureFlagService: {
    getInstance: () => ({
      isEnabled: vi.fn().mockReturnValue(true),
      getUserPercentage: vi.fn().mockReturnValue(100),
    }),
  },
}));

describe("BusinessSearchMiddleware - Caching Integration", () => {
  let middleware: BusinessSearchMiddleware;
  let mockProvider: OllamaProvider;
  let wrappedProvider: OllamaProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock provider
    mockProvider = {
      generate: vi.fn().mockResolvedValue("Fresh response with contact info"),
      generateWithLogProbs: vi.fn().mockResolvedValue({
        text: "Fresh response with contact info",
        logProbs: [],
      }),
      generateStream: vi.fn().mockResolvedValue("Fresh stream response"),
      client: {} as any,
      config: { model: "test-model", ollamaUrl: "http://localhost:8081" },
      isInitialized: true,
      generateFallbackResponse: vi.fn(),
      buildPrompt: vi.fn(),
    } as any;

    // Create middleware with caching enabled
    middleware = new BusinessSearchMiddleware({
      enabled: true,
      enhancementLevel: "standard",
      validateResponses: false, // Disable validation for cache tests
      collectMetrics: true,
      cacheEnabled: true,
      cacheMaxAge: 60 * 1000, // 1 minute
      cacheStaleWhileRevalidate: 10 * 1000, // 10 seconds
    });

    // Clear cache before each test
    middleware.clearCache();

    // Wrap the provider
    wrappedProvider = middleware.wrapProvider(mockProvider);
  });

  describe("Cache Hit Scenarios", () => {
    it("should return cached response on second request", async () => {
      const query = "Find plumbers near me";

      // First request - should hit LLM
      const response1 = await wrappedProvider.generate(query);
      expect(response1).toBe("Fresh response with contact info");
      expect(mockProvider.generate).toHaveBeenCalledTimes(1);

      // Second request - should hit cache
      const response2 = await wrappedProvider.generate(query);
      expect(response2).toBe("Fresh response with contact info");
      expect(mockProvider.generate).toHaveBeenCalledTimes(1); // Still only 1 call

      // Check metrics
      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBeCloseTo(50, 0);
    });

    it("should emit cache_hit event", async () => {
      const query = "Find electricians in 90210";
      const cacheHitHandler = vi.fn();

      middleware.on("cache_hit", cacheHitHandler);

      // First request to populate cache
      await wrappedProvider.generate(query);

      // Second request should hit cache
      await wrappedProvider.generate(query);

      expect(cacheHitHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: query,
          location: "90210",
          age: expect.any(Number),
          hitCount: 1,
        }),
      );
    });

    it("should respect location in cache key", async () => {
      // Same service, different locations
      await wrappedProvider.generate("Find plumbers in NYC");
      await wrappedProvider.generate("Find plumbers in LA");

      // Both should miss cache
      expect(mockProvider.generate).toHaveBeenCalledTimes(2);

      // Request NYC again - should hit cache
      await wrappedProvider.generate("Find plumbers in NYC");
      expect(mockProvider.generate).toHaveBeenCalledTimes(2); // No new call

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.cacheMisses).toBe(2);
    });
  });

  describe("Cache Miss Scenarios", () => {
    it("should not cache non-business queries", async () => {
      const nonBusinessQuery = "What is the weather today?";

      // First request
      await wrappedProvider.generate(nonBusinessQuery);

      // Second request - should not hit cache (wasn't enhanced)
      await wrappedProvider.generate(nonBusinessQuery);

      expect(mockProvider.generate).toHaveBeenCalledTimes(2);

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0); // No cache operations for non-business queries
    });

    it("should not use cache when disabled", async () => {
      // Disable cache
      middleware.updateConfig({ cacheEnabled: false });

      const query = "Find mechanics near me";

      // Multiple requests
      await wrappedProvider.generate(query);
      await wrappedProvider.generate(query);
      await wrappedProvider.generate(query);

      // All should hit LLM
      expect(mockProvider.generate).toHaveBeenCalledTimes(3);

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(0);
    });
  });

  describe("Cache Performance", () => {
    it("should significantly reduce latency for cached responses", async () => {
      const query = "Find dentists near me";

      // Add artificial delay to mock provider
      (mockProvider.generate as any).mockImplementation(
        () =>
          new Promise((resolve: any) => setTimeout(() => resolve("Response"), 100)),
      );

      // First request - slow
      const start1 = Date.now();
      await wrappedProvider.generate(query);
      const time1 = Date.now() - start1;

      // Second request - should be fast (from cache)
      const start2 = Date.now();
      await wrappedProvider.generate(query);
      const time2 = Date.now() - start2;

      expect(time1).toBeGreaterThan(90); // Close to 100ms
      expect(time2).toBeLessThan(20); // Much faster from cache
    });

    it("should track cache performance metrics", async () => {
      // Populate cache with several queries
      const queries = [
        "Find plumbers near me",
        "Find electricians near me",
        "Find locksmiths near me",
      ];

      // First pass - all misses
      for (const query of queries) {
        await wrappedProvider.generate(query);
      }

      // Second pass - all hits
      for (const query of queries) {
        await wrappedProvider.generate(query);
      }

      const cacheStats = middleware.getCacheStats();
      expect(cacheStats.hits).toBe(3);
      expect(cacheStats.misses).toBe(3);
      expect(cacheStats.hitRate).toBe(50);
      expect(cacheStats.size).toBe(3);
    });
  });

  describe("Cache Management", () => {
    it("should clear cache on demand", async () => {
      const query = "Find contractors near me";

      // Populate cache
      await wrappedProvider.generate(query);

      // Verify cached
      await wrappedProvider.generate(query);
      expect(mockProvider.generate).toHaveBeenCalledTimes(1);

      // Clear cache
      await middleware.clearCache();

      // Should miss cache now
      await wrappedProvider.generate(query);
      expect(mockProvider.generate).toHaveBeenCalledTimes(2);
    });

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
      ];

      await middleware.preloadCache(commonQueries);

      // These should hit cache without calling LLM
      const response1 = await wrappedProvider.generate(
        "Find emergency plumber",
      );
      const response2 = await wrappedProvider.generate("Find 24/7 electrician");

      expect(response1).toBe("Emergency plumbers...");
      expect(response2).toBe("24/7 electricians...");
      expect(mockProvider.generate).not.toHaveBeenCalled();

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(2);
    });

    it("should analyze cache performance", async () => {
      // Create some hot queries
      const hotQuery = "Find popular service near me";
      const coldQuery = "Find rare service near me";

      // Generate traffic
      for (let i = 0; i < 10; i++) {
        await wrappedProvider.generate(hotQuery);
      }
      await wrappedProvider.generate(coldQuery);

      const analysis = middleware.analyzeCachePerformance();

      expect(analysis.hotQueries).toBeDefined();
      expect(analysis.hotQueries[0]?.length).toBe(hotQuery);
      expect(analysis.hotQueries[0]?.length).toBeGreaterThan(5);
      expect(analysis.memoryPressure).toBeGreaterThan(0);
    });

    it("should search cache entries", async () => {
      // Populate with various queries
      await wrappedProvider.generate("Find plumbers in NYC");
      await wrappedProvider.generate("Find electricians in NYC");
      await wrappedProvider.generate("Find plumbers in LA");

      // Search for NYC services
      const nycResults = await middleware.searchCache(/NYC/);
      expect(nycResults).toHaveLength(2);

      // Search for plumbers
      const plumberResults = await middleware.searchCache(/plumbers/i);
      expect(plumberResults).toHaveLength(2);
    });
  });

  describe("Cache with Validation", () => {
    it("should only cache valid responses", async () => {
      // Enable validation
      middleware.updateConfig({ validateResponses: true });

      // Mock validator to fail for certain responses
      const validator = (middleware as any).responseValidator;
      validator.validateResponse = vi
        .fn()
        .mockResolvedValueOnce({ isValid: false }) // First call fails
        .mockResolvedValueOnce({ isValid: true }); // Second call passes

      // First request - invalid response, should not cache
      (mockProvider.generate as any).mockResolvedValueOnce(
        "Invalid response without contact info",
      );
      await wrappedProvider.generate("Find services near me");

      // Second request - valid response, should cache
      (mockProvider.generate as any).mockResolvedValueOnce(
        "Valid: Call 555-1234 at 123 Main St",
      );
      await wrappedProvider.generate("Find other services near me");

      // Third request for second query - should hit cache
      await wrappedProvider.generate("Find other services near me");

      expect(mockProvider.generate).toHaveBeenCalledTimes(2);

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(1);
      expect(metrics.failedValidations).toBe(1);
    });
  });

  describe("Cache with Rate Limiting", () => {
    it("should not cache rate-limited requests", async () => {
      // Mock rate limit exceeded
      vi.spyOn(middleware as any, "checkRateLimit").mockResolvedValue(false);

      const query = "Find services near me";

      // First request - rate limited, no enhancement, no cache
      await wrappedProvider.generate(query);

      // Reset rate limit
      vi.spyOn(middleware as any, "checkRateLimit").mockResolvedValue(true);

      // Second request - should not hit cache (wasn't stored)
      await wrappedProvider.generate(query);

      expect(mockProvider.generate).toHaveBeenCalledTimes(2);

      const metrics = middleware.getMetrics();
      expect(metrics.cacheHits).toBe(0);
      expect(metrics.cacheMisses).toBe(1); // Only one cache check (second request)
    });
  });

  describe("Streaming with Cache", () => {
    it("should not use cache for streaming requests", async () => {
      const query = "Find services near me";
      const onChunk = vi.fn();

      // Regular request to populate cache
      await wrappedProvider.generate(query);

      // Streaming request - should not use cache
      await wrappedProvider.generateStream(query, undefined, onChunk);

      expect(mockProvider.generate).toHaveBeenCalledTimes(1);
      expect(mockProvider.generateStream).toHaveBeenCalledTimes(1);

      // Regular request again - should hit cache
      await wrappedProvider.generate(query);
      expect(mockProvider.generate).toHaveBeenCalledTimes(1); // No new call
    });
  });
});
