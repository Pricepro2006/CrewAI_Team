/**
 * Integration tests for BusinessSearchMiddleware
 * GROUP 2B WebSearch Enhancement
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BusinessSearchMiddleware } from "../BusinessSearchMiddleware.js";
import { OllamaProvider } from "../../llm/OllamaProvider.js";
import { FeatureFlagService } from "../../../config/features/FeatureFlagService.js";

// Mock modules
vi.mock("../../llm/OllamaProvider");
vi.mock("../../../config/features/FeatureFlagService");
vi.mock("../../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("BusinessSearchMiddleware", () => {
  let middleware: BusinessSearchMiddleware;
  let mockProvider: any;
  let mockFeatureFlags: any;
  let originalGenerate: any;
  let originalGenerateWithLogProbs: any;
  let originalGenerateStream: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock provider
    originalGenerate = vi.fn().mockResolvedValue("Original response");
    originalGenerateWithLogProbs = vi.fn().mockResolvedValue({
      text: "Original response",
      tokens: ["Original", "response"],
      logProbs: [-0.1, -0.2],
    });
    originalGenerateStream = vi
      .fn()
      .mockResolvedValue("Original streamed response");

    mockProvider = {
      generate: originalGenerate,
      generateWithLogProbs: originalGenerateWithLogProbs,
      generateStream: originalGenerateStream,
      initialize: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockReturnValue({ model: "test-model" }),
    };

    // Mock feature flags
    mockFeatureFlags = {
      isEnabled: vi.fn().mockReturnValue(true),
      getUserPercentage: vi.fn().mockReturnValue(100),
      getInstance: vi.fn().mockReturnThis(),
    };

    FeatureFlagService.getInstance = vi.fn().mockReturnValue(mockFeatureFlags);

    // Create middleware instance
    middleware = new BusinessSearchMiddleware({
      enabled: true,
      enhancementLevel: "standard",
      validateResponses: true,
      collectMetrics: true,
      maxLatencyMs: 2000,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Provider Wrapping", () => {
    it("should return original provider when feature is disabled", () => {
      mockFeatureFlags.isEnabled.mockReturnValue(false);

      const wrappedProvider = middleware.wrapProvider(mockProvider);

      expect(wrappedProvider).toBe(mockProvider);
    });

    it("should wrap provider when feature is enabled", () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      expect(wrappedProvider).not.toBe(mockProvider);
      expect(wrappedProvider.generate).toBeDefined();
      expect(wrappedProvider.generateWithLogProbs).toBeDefined();
      expect(wrappedProvider.generateStream).toBeDefined();
    });

    it("should pass through non-intercepted methods", () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      expect(wrappedProvider.initialize).toBe(mockProvider.initialize);
      expect(wrappedProvider.getConfig).toBe(mockProvider.getConfig);
    });
  });

  describe("Business Query Detection", () => {
    it("should enhance business-related queries", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const businessQuery = "Where can I find a plumber near 90210?";

      await wrappedProvider.generate(businessQuery);

      // Should call original with enhanced prompt
      expect(originalGenerate).toHaveBeenCalled();
      const enhancedPrompt = originalGenerate.mock.calls[0][0];
      expect(enhancedPrompt).toContain("[BUSINESS_SEARCH_ENHANCED]");
      expect(enhancedPrompt).toContain("WebSearch");
    });

    it("should not enhance non-business queries", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const nonBusinessQuery = "What is the meaning of life?";

      await wrappedProvider.generate(nonBusinessQuery);

      // Should call original with unmodified prompt
      expect(originalGenerate).toHaveBeenCalledWith(
        nonBusinessQuery,
        undefined,
      );
    });

    it("should skip enhancement for already enhanced prompts", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const enhancedQuery = "Find a restaurant [BUSINESS_SEARCH_ENHANCED]";

      await wrappedProvider.generate(enhancedQuery);

      // Should not double-enhance
      expect(originalGenerate).toHaveBeenCalledWith(enhancedQuery, undefined);
    });
  });

  describe("Response Validation", () => {
    it("should validate responses with business information", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      originalGenerate.mockResolvedValue(
        "Joe's Plumbing - (555) 123-4567, 123 Main St, Open 24/7",
      );

      await wrappedProvider.generate("Find a plumber");

      const metrics = middleware.getMetrics();
      expect(metrics.validatedResponses).toBe(1);
      expect(metrics.failedValidations).toBe(0);
    });

    it("should track failed validations", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      originalGenerate.mockResolvedValue(
        "You should search online for plumbers in your area",
      );

      await wrappedProvider.generate("Find a plumber");

      const metrics = middleware.getMetrics();
      expect(metrics.validatedResponses).toBe(1);
      expect(metrics.failedValidations).toBe(1);
    });
  });

  describe("Performance Monitoring", () => {
    it("should track latency", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      await wrappedProvider.generate("Find a restaurant");

      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeLessThan(2000);
    });

    it("should emit high latency warning", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const highLatencyHandler = vi.fn();
      middleware.on("high_latency", highLatencyHandler);

      // Mock slow response
      originalGenerate.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve("Slow response"), 3000),
          ),
      );

      await wrappedProvider.generate("Find a restaurant");

      expect(highLatencyHandler).toHaveBeenCalled();
    }, 5000);
  });

  describe("Circuit Breaker", () => {
    it("should open circuit breaker after threshold failures", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      originalGenerate.mockRejectedValue(new Error("Network error"));

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await wrappedProvider.generate("Find a restaurant");
        } catch (e) {
          // Expected
        }
      }

      const metrics = middleware.getMetrics();
      expect(metrics.circuitBreakerStatus).toBe("open");
      expect(metrics.errors).toBe(5);
    });

    it("should bypass middleware when circuit breaker is open", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      // Force circuit breaker open
      for (let i = 0; i < 5; i++) {
        originalGenerate.mockRejectedValueOnce(new Error("Network error"));
        try {
          await wrappedProvider.generate("Find a restaurant");
        } catch (e) {
          // Expected
        }
      }

      // Reset mock
      originalGenerate.mockResolvedValue("Recovery response");

      // Next call should bypass middleware
      await wrappedProvider.generate("Find a restaurant");

      // Should be called with original prompt (not enhanced)
      expect(originalGenerate).toHaveBeenLastCalledWith(
        "Find a restaurant",
        undefined,
      );
    });
  });

  describe("A/B Testing", () => {
    it("should respect rollout percentage", async () => {
      mockFeatureFlags.getUserPercentage.mockReturnValue(50);
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      // Make multiple requests
      const requests = 100;
      let enhanced = 0;

      for (let i = 0; i < requests; i++) {
        await wrappedProvider.generate("Find a restaurant");
        const lastCall = originalGenerate.mock.calls[i][0];
        if (lastCall.includes("[BUSINESS_SEARCH_ENHANCED]")) {
          enhanced++;
        }
      }

      // Should be roughly 50% enhanced (with some variance)
      expect(enhanced).toBeGreaterThan(30);
      expect(enhanced).toBeLessThan(70);
    });
  });

  describe("generateWithLogProbs", () => {
    it("should enhance prompts in generateWithLogProbs", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const businessQuery = "Find a locksmith emergency";

      await wrappedProvider.generateWithLogProbs(businessQuery);

      const enhancedPrompt = originalGenerateWithLogProbs.mock.calls[0][0];
      expect(enhancedPrompt).toContain("[BUSINESS_SEARCH_ENHANCED]");
    });

    it("should preserve log probabilities", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      const result = await wrappedProvider.generateWithLogProbs("Find a store");

      expect(result.logProbs).toEqual([-0.1, -0.2]);
      expect(result.tokens).toEqual(["Original", "response"]);
    });
  });

  describe("generateStream", () => {
    it("should enhance prompts in generateStream", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const businessQuery = "Find auto repair near me";

      await wrappedProvider.generateStream(businessQuery);

      const enhancedPrompt = originalGenerateStream.mock.calls[0][0];
      expect(enhancedPrompt).toContain("[BUSINESS_SEARCH_ENHANCED]");
    });

    it("should validate complete streamed response", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      originalGenerateStream.mockResolvedValue(
        "City Auto Repair - 456 Oak Ave, Hours: Mon-Fri 8AM-6PM",
      );

      const chunks: string[] = [];
      await wrappedProvider.generateStream(
        "Find auto repair",
        undefined,
        (chunk) => chunks.push(chunk),
      );

      const metrics = middleware.getMetrics();
      expect(metrics.validatedResponses).toBe(1);
      expect(metrics.failedValidations).toBe(0);
    });
  });

  describe("Metrics and Monitoring", () => {
    it("should accurately track all metrics", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);

      // Make various types of requests
      await wrappedProvider.generate("Find a restaurant");
      await wrappedProvider.generate("What is JavaScript?");
      await wrappedProvider.generateWithLogProbs("Find a plumber");
      await wrappedProvider.generateStream("Find a hotel");

      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(4);
      expect(metrics.enhancedRequests).toBeGreaterThan(0);
      expect(metrics.searchTriggeredRequests).toBeGreaterThan(0);
    });

    it("should reset metrics correctly", () => {
      middleware.resetMetrics();

      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.enhancedRequests).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.averageLatency).toBe(0);
    });
  });

  describe("Configuration", () => {
    it("should update configuration dynamically", () => {
      middleware.updateConfig({
        enhancementLevel: "aggressive",
        maxLatencyMs: 5000,
      });

      const config = middleware.getConfig();
      expect(config.enhancementLevel).toBe("aggressive");
      expect(config.maxLatencyMs).toBe(5000);
    });

    it("should respect bypass patterns", async () => {
      middleware.updateConfig({
        bypassPatterns: [/internal.*query/i],
      });

      const wrappedProvider = middleware.wrapProvider(mockProvider);
      await wrappedProvider.generate("internal system query");

      // Should not enhance
      expect(originalGenerate).toHaveBeenCalledWith(
        "internal system query",
        undefined,
      );
    });

    it("should respect force enhance patterns", async () => {
      middleware.updateConfig({
        forceEnhancePatterns: [/enhance this/i],
      });

      const wrappedProvider = middleware.wrapProvider(mockProvider);
      await wrappedProvider.generate("enhance this: what is coding?");

      // Should enhance even non-business query
      const enhancedPrompt = originalGenerate.mock.calls[0][0];
      expect(enhancedPrompt).toContain("[BUSINESS_SEARCH_ENHANCED]");
    });
  });

  describe("Error Handling", () => {
    it("should handle provider errors gracefully", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      originalGenerate.mockRejectedValue(new Error("Provider error"));

      await expect(wrappedProvider.generate("Find a store")).rejects.toThrow(
        "Provider error",
      );

      const metrics = middleware.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it("should emit error events", async () => {
      const wrappedProvider = middleware.wrapProvider(mockProvider);
      const errorHandler = vi.fn();
      middleware.on("error", errorHandler);

      originalGenerate.mockRejectedValue(new Error("Test error"));

      try {
        await wrappedProvider.generate("Find a store");
      } catch (e) {
        // Expected
      }

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});
