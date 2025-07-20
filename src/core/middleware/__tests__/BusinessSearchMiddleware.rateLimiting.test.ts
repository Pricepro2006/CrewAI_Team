import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BusinessSearchMiddleware } from '../BusinessSearchMiddleware';
import type { OllamaProvider } from '../../llm/OllamaProvider';

// Mock dependencies
jest.mock('../../llm/OllamaProvider');
jest.mock('../../../utils/logger');
jest.mock('../../../config/features/FeatureFlagService', () => ({
  FeatureFlagService: {
    getInstance: () => ({
      isEnabled: jest.fn().mockReturnValue(true),
      getUserPercentage: jest.fn().mockReturnValue(100)
    })
  }
}));

describe('BusinessSearchMiddleware - Rate Limiting Integration', () => {
  let middleware: BusinessSearchMiddleware;
  let mockProvider: jest.Mocked<OllamaProvider>;
  let wrappedProvider: OllamaProvider;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock provider
    mockProvider = {
      generate: jest.fn().mockResolvedValue('Mock response'),
      generateWithLogProbs: jest.fn().mockResolvedValue({
        text: 'Mock response',
        logProbs: []
      }),
      generateStream: jest.fn().mockResolvedValue('Mock stream response')
    } as any;

    // Create middleware instance
    middleware = new BusinessSearchMiddleware({
      enabled: true,
      enhancementLevel: 'standard',
      validateResponses: false, // Disable validation for rate limit tests
      collectMetrics: true
    });

    // Wrap the provider
    wrappedProvider = middleware.wrapProvider(mockProvider);
  });

  describe('Rate Limiting Behavior', () => {
    it('should apply rate limiting to business search queries', async () => {
      const businessQuery = 'Find plumbers near me';
      
      // First request should succeed
      const response1 = await wrappedProvider.generate(businessQuery);
      expect(response1).toBe('Mock response');
      expect(mockProvider.generate).toHaveBeenCalledTimes(1);
      
      // Check metrics
      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.enhancedRequests).toBeGreaterThan(0);
    });

    it('should track rate limited requests in metrics', async () => {
      const businessQuery = 'Find electricians in 90210';
      
      // Mock rate limit exceeded
      const checkRateLimitSpy = jest.spyOn(middleware as any, 'checkRateLimit')
        .mockResolvedValue(false);
      
      // Request should still succeed but without enhancement
      const response = await wrappedProvider.generate(businessQuery);
      expect(response).toBe('Mock response');
      
      // Verify rate limit was checked
      expect(checkRateLimitSpy).toHaveBeenCalled();
      
      // Check metrics - enhancement should be skipped
      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.rateLimitedRequests).toBe(1);
    });

    it('should emit rate_limited event when rate limit is hit', async () => {
      const businessQuery = 'Find restaurants nearby';
      const rateLimitedHandler = jest.fn();
      
      // Listen for rate_limited event
      middleware.on('rate_limited', rateLimitedHandler);
      
      // Mock rate limit exceeded
      jest.spyOn(middleware as any, 'checkRateLimit').mockResolvedValue(false);
      
      // Make request
      await wrappedProvider.generate(businessQuery);
      
      // Verify event was emitted
      expect(rateLimitedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: businessQuery,
          timestamp: expect.any(Number),
          totalRateLimited: 1
        })
      );
    });

    it('should continue processing if rate limit check fails', async () => {
      const businessQuery = 'Find doctors near me';
      
      // Mock rate limit check error
      jest.spyOn(middleware as any, 'checkRateLimit')
        .mockRejectedValue(new Error('Rate limit check failed'));
      
      // Request should still succeed with enhancement
      const response = await wrappedProvider.generate(businessQuery);
      expect(response).toBe('Mock response');
      
      // Verify original method was called with enhanced prompt
      expect(mockProvider.generate).toHaveBeenCalledWith(
        expect.stringContaining('WebSearch'),
        undefined
      );
    });

    it('should use different rate limit keys for different queries', async () => {
      const checkRateLimitSpy = jest.spyOn(middleware as any, 'checkRateLimit')
        .mockResolvedValue(true);
      
      // Make requests with different queries
      await wrappedProvider.generate('Find plumbers near me');
      await wrappedProvider.generate('Find electricians in NYC');
      
      // Verify different keys were used
      expect(checkRateLimitSpy).toHaveBeenCalledWith('websearch:Find plumbers near me');
      expect(checkRateLimitSpy).toHaveBeenCalledWith('websearch:Find electricians in NYC');
    });

    it('should respect rate limits in streaming mode', async () => {
      const businessQuery = 'Find mechanics nearby';
      const onChunk = jest.fn();
      
      // Mock rate limit exceeded
      jest.spyOn(middleware as any, 'checkRateLimit').mockResolvedValue(false);
      
      // Stream request
      const response = await wrappedProvider.generateStream(
        businessQuery,
        undefined,
        onChunk
      );
      
      expect(response).toBe('Mock stream response');
      
      // Verify no enhancement was applied
      expect(mockProvider.generateStream).toHaveBeenCalledWith(
        businessQuery, // Original prompt without enhancement
        undefined,
        onChunk
      );
    });
  });

  describe('Rate Limiting with Circuit Breaker', () => {
    it('should bypass rate limiting when circuit breaker is open', async () => {
      // Open the circuit breaker
      (middleware as any).circuitBreakerStatus = 'open';
      
      const checkRateLimitSpy = jest.spyOn(middleware as any, 'checkRateLimit');
      
      // Make request
      await wrappedProvider.generate('Find services near me');
      
      // Rate limit check should not be called when circuit breaker is open
      expect(checkRateLimitSpy).not.toHaveBeenCalled();
    });
  });

  describe('Performance Impact', () => {
    it('should track latency including rate limit checks', async () => {
      // Mock rate limit check with delay
      jest.spyOn(middleware as any, 'checkRateLimit')
        .mockImplementation(() => new Promise(resolve => 
          setTimeout(() => resolve(true), 50)
        ));
      
      const startTime = Date.now();
      await wrappedProvider.generate('Find services near me');
      const endTime = Date.now();
      
      const metrics = middleware.getMetrics();
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Configuration', () => {
    it('should allow updating rate limit configuration', () => {
      const newConfig = {
        enabled: true,
        enhancementLevel: 'aggressive' as const,
        maxLatencyMs: 3000
      };
      
      middleware.updateConfig(newConfig);
      
      const config = middleware.getConfig();
      expect(config.enhancementLevel).toBe('aggressive');
      expect(config.maxLatencyMs).toBe(3000);
    });
  });

  describe('Metrics Tracking', () => {
    it('should accurately track rate limited vs total requests', async () => {
      const checkRateLimitMock = jest.spyOn(middleware as any, 'checkRateLimit');
      
      // Alternate between allowed and rate limited
      checkRateLimitMock
        .mockResolvedValueOnce(true)   // Request 1: allowed
        .mockResolvedValueOnce(false)  // Request 2: rate limited
        .mockResolvedValueOnce(true)   // Request 3: allowed
        .mockResolvedValueOnce(false)  // Request 4: rate limited
        .mockResolvedValueOnce(false); // Request 5: rate limited
      
      // Make 5 business search requests
      for (let i = 0; i < 5; i++) {
        await wrappedProvider.generate(`Find service ${i} near me`);
      }
      
      const metrics = middleware.getMetrics();
      expect(metrics.totalRequests).toBe(5);
      expect(metrics.rateLimitedRequests).toBe(3);
      expect(metrics.enhancedRequests).toBe(2); // Only non-rate-limited get enhanced
    });

    it('should reset rate limited count with resetMetrics', () => {
      // Set some rate limited requests
      (middleware as any).rateLimitedRequests = 10;
      (middleware as any).metrics.rateLimitedRequests = 10;
      
      middleware.resetMetrics();
      
      const metrics = middleware.getMetrics();
      expect(metrics.rateLimitedRequests).toBe(0);
      expect((middleware as any).rateLimitedRequests).toBe(0);
    });
  });
});