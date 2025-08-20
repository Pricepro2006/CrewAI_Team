/**
 * BusinessSearchMiddleware - GROUP 2B WebSearch Enhancement
 *
 * Intercepts LLM calls to inject business search context when needed.
 * Uses a non-invasive proxy pattern to wrap OllamaProvider methods.
 *
 * Architecture:
 * 1. Intercepts generate(), generateWithLogProbs(), and generateStream() methods
 * 2. Analyzes prompts using BusinessQueryOptimizer
 * 3. Enhances prompts using BusinessSearchPromptEnhancer when appropriate
 * 4. Validates responses using BusinessResponseValidator
 * 5. Collects metrics for performance monitoring
 * 6. Implements circuit breaker for graceful degradation
 */

import { EventEmitter } from "events";
import type {
  OllamaProvider,
  OllamaGenerateOptions,
  OllamaGenerateWithLogProbsResponse,
} from "../llm/OllamaProvider.js";
import {
  BusinessSearchPromptEnhancer,
  type BusinessSearchEnhancementOptions,
} from "../prompts/BusinessSearchPromptEnhancer.js";
import { BusinessQueryOptimizer } from "../search/BusinessQueryOptimizer.js";
import {
  BusinessResponseValidator,
  type ValidationResult,
} from "../validators/BusinessResponseValidator.js";
import { logger } from "../../utils/logger.js";
import { FeatureFlagService } from "../../config/features/FeatureFlagService.js";
import { RateLimiter } from "./RateLimiter.js";
import { BusinessSearchCache } from "../cache/BusinessSearchCache.js";

export interface MiddlewareMetrics {
  totalRequests: number;
  enhancedRequests: number;
  searchTriggeredRequests: number;
  validatedResponses: number;
  failedValidations: number;
  averageLatency: number;
  errors: number;
  circuitBreakerStatus: "closed" | "open" | "half-open";
  rateLimitedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
}

export interface MiddlewareConfig {
  enabled: boolean;
  enhancementLevel: "minimal" | "standard" | "aggressive";
  validateResponses: boolean;
  collectMetrics: boolean;
  maxLatencyMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownMs: number;
  bypassPatterns?: RegExp[];
  forceEnhancePatterns?: RegExp[];
  cacheEnabled: boolean;
  cacheMaxAge: number;
  cacheStaleWhileRevalidate: number;
}

export class BusinessSearchMiddleware extends EventEmitter {
  private promptEnhancer: BusinessSearchPromptEnhancer;
  private responseValidator: BusinessResponseValidator;
  private featureFlags: FeatureFlagService;
  private metrics: MiddlewareMetrics;
  private config: MiddlewareConfig;
  private rateLimiter: RateLimiter;
  private cache: BusinessSearchCache;

  // Circuit breaker state
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private circuitBreakerStatus: "closed" | "open" | "half-open" = "closed";

  // Performance tracking
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 100;

  // Rate limiting tracking
  private rateLimitedRequests: number = 0;

  constructor(config?: Partial<MiddlewareConfig>) {
    super();

    this.config = {
      enabled: true,
      enhancementLevel: "standard",
      validateResponses: true,
      collectMetrics: true,
      maxLatencyMs: 2000, // 2 second max added latency
      circuitBreakerThreshold: 5,
      circuitBreakerCooldownMs: 60000, // 1 minute cooldown
      cacheEnabled: true,
      cacheMaxAge: 60 * 60 * 1000, // 1 hour
      cacheStaleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
      ...config,
    };

    this.promptEnhancer = new BusinessSearchPromptEnhancer();
    this.responseValidator = new BusinessResponseValidator({
      privacyMode: false,
      minConfidenceThreshold: 0.6,
    });
    this.featureFlags = FeatureFlagService.getInstance();
    this.rateLimiter = new RateLimiter(process.env.USE_REDIS === "true");
    this.cache = new BusinessSearchCache({
      maxAge: this?.config?.cacheMaxAge,
      staleWhileRevalidate: this?.config?.cacheStaleWhileRevalidate,
      useRedis: process.env.USE_REDIS === "true",
    });

    this.metrics = {
      totalRequests: 0,
      enhancedRequests: 0,
      searchTriggeredRequests: 0,
      validatedResponses: 0,
      failedValidations: 0,
      averageLatency: 0,
      errors: 0,
      circuitBreakerStatus: "closed",
      rateLimitedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
    };
  }

  /**
   * Wrap an OllamaProvider instance with middleware functionality
   */
  public wrapProvider(provider: OllamaProvider): OllamaProvider {
    // Check if feature is enabled
    if (!this.isEnabled()) {
      logger.info("BusinessSearchMiddleware is disabled via feature flag");
      return provider;
    }

    // Create a proxy to intercept method calls
    return new Proxy(provider, {
      get: (target, prop, receiver) => {
        // Intercept specific methods
        if (prop === "generate") {
          return this.wrapGenerate(target, (target as any).generate.bind(target));
        }
        if (prop === "generateWithLogProbs") {
          return this.wrapGenerateWithLogProbs(
            target,
            (target as any).generateWithLogProbs.bind(target),
          );
        }
        if (prop === "generateStream") {
          return this.wrapGenerateStream(
            target,
            (target as any).generateStream.bind(target),
          );
        }

        // Pass through all other properties/methods
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  /**
   * Wrap the generate method
   */
  private wrapGenerate(
    provider: OllamaProvider,
    originalMethod: (...args: unknown[]) => unknown,
  ) {
    return async (
      prompt: string,
      options?: OllamaGenerateOptions,
    ): Promise<string> => {
      const startTime = Date.now();

      try {
        // Check circuit breaker
        if (!this.checkCircuitBreaker()) {
          logger.warn("Circuit breaker is open, bypassing middleware");
          return originalMethod(prompt, options) as Promise<string>;
        }

        // Track request
        if (this.metrics.totalRequests) { this.metrics.totalRequests++ };

        // Check if we should enhance this prompt
        const shouldEnhance = await this.shouldEnhancePrompt(prompt);

        if (!shouldEnhance) {
          return originalMethod(prompt, options) as Promise<string>;
        }

        // Extract location from prompt for cache key
        const optimization = BusinessQueryOptimizer.optimize(prompt);
        const location = optimization?.components?.location;

        // Check cache if enabled
        if (this?.config?.cacheEnabled) {
          const cacheEntry = await this?.cache?.get(
            prompt,
            location?.rawLocation,
          );

          if (cacheEntry) {
            if (this.metrics.cacheHits) { this.metrics.cacheHits++ };
            this.updateCacheMetrics();

            // Track latency for cached response
            this.trackLatency(Date.now() - startTime);

            // Emit cache hit event
            this.emit("cache_hit", {
              prompt,
              location,
              age: Date.now() - cacheEntry.timestamp,
              hitCount: cacheEntry.hitCount,
            });

            logger.debug("Cache hit for business search", "BUSINESS_SEARCH", {
              prompt: prompt.slice(0, 50),
              location: location?.rawLocation,
              age: (Date.now() - cacheEntry.timestamp) / 1000,
            });

            return cacheEntry.response;
          } else {
            if (this.metrics.cacheMisses) { this.metrics.cacheMisses++ };
            this.updateCacheMetrics();
          }
        }

        // Enhance the prompt
        const enhancedPrompt = await this.enhancePrompt(prompt);
        if (this.metrics.enhancedRequests) { this.metrics.enhancedRequests++ };

        // Call the original method with enhanced prompt
        const response = await originalMethod(enhancedPrompt, options) as string;

        // Validate response if enabled
        let validation: ValidationResult | undefined;
        if (this?.config?.validateResponses) {
          validation = await this.validateResponse(response);
          if (this.metrics.validatedResponses) { this.metrics.validatedResponses++ };

          if (!validation.isValid) {
            if (this.metrics.failedValidations) { this.metrics.failedValidations++ };
            this.handleValidationFailure(validation, prompt, response);
          }
        }

        // Store in cache if enabled and response is valid
        if (this?.config?.cacheEnabled && (!validation || validation.isValid)) {
          await this?.cache?.set(
            prompt,
            location?.rawLocation,
            response,
            validation,
            {
              enhanced: true,
              modelUsed: 'unknown', // provider doesn't have getConfig method
            },
          );
        }

        // Track latency
        this.trackLatency(Date.now() - startTime);

        // Emit success event
        this.emit("request_processed", {
          type: "generate",
          enhanced: shouldEnhance,
          latency: Date.now() - startTime,
          cached: false,
        });

        return response as string;
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }

  /**
   * Wrap the generateWithLogProbs method
   */
  private wrapGenerateWithLogProbs(
    provider: OllamaProvider,
    originalMethod: (...args: unknown[]) => unknown,
  ) {
    return async (
      prompt: string,
      options?: OllamaGenerateOptions,
    ): Promise<OllamaGenerateWithLogProbsResponse> => {
      const startTime = Date.now();

      try {
        // Check circuit breaker
        if (!this.checkCircuitBreaker()) {
          logger.warn("Circuit breaker is open, bypassing middleware");
          return originalMethod(prompt, options) as Promise<OllamaGenerateWithLogProbsResponse>;
        }

        // Track request
        if (this.metrics.totalRequests) { this.metrics.totalRequests++ };

        // Check if we should enhance this prompt
        const shouldEnhance = await this.shouldEnhancePrompt(prompt);

        if (!shouldEnhance) {
          return originalMethod(prompt, options) as Promise<OllamaGenerateWithLogProbsResponse>;
        }

        // Enhance the prompt
        const enhancedPrompt = await this.enhancePrompt(prompt);
        if (this.metrics.enhancedRequests) { this.metrics.enhancedRequests++ };

        // Call the original method with enhanced prompt
        const response = await originalMethod(enhancedPrompt, options) as OllamaGenerateWithLogProbsResponse;

        // Validate response if enabled
        if (this?.config?.validateResponses && response.text) {
          const validation = await this.validateResponse(response.text);
          if (this.metrics.validatedResponses) { this.metrics.validatedResponses++ };

          if (!validation.isValid) {
            if (this.metrics.failedValidations) { this.metrics.failedValidations++ };
            this.handleValidationFailure(validation, prompt, response.text);
          }
        }

        // Track latency
        this.trackLatency(Date.now() - startTime);

        // Emit success event
        this.emit("request_processed", {
          type: "generateWithLogProbs",
          enhanced: shouldEnhance,
          latency: Date.now() - startTime,
        });

        return response as OllamaGenerateWithLogProbsResponse;
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }

  /**
   * Wrap the generateStream method
   */
  private wrapGenerateStream(
    provider: OllamaProvider,
    originalMethod: (...args: unknown[]) => unknown,
  ) {
    return async (
      prompt: string,
      options?: OllamaGenerateOptions,
      onChunk?: (chunk: string) => void,
    ): Promise<string> => {
      const startTime = Date.now();

      try {
        // Check circuit breaker
        if (!this.checkCircuitBreaker()) {
          logger.warn("Circuit breaker is open, bypassing middleware");
          return originalMethod(prompt, options, onChunk) as Promise<string>;
        }

        // Track request
        if (this.metrics.totalRequests) { this.metrics.totalRequests++ };

        // Check if we should enhance this prompt
        const shouldEnhance = await this.shouldEnhancePrompt(prompt);

        if (!shouldEnhance) {
          return originalMethod(prompt, options, onChunk) as Promise<string>;
        }

        // Enhance the prompt
        const enhancedPrompt = await this.enhancePrompt(prompt);
        if (this.metrics.enhancedRequests) { this.metrics.enhancedRequests++ };

        // Wrap the chunk callback to collect full response for validation
        let fullResponse = "";
        const wrappedOnChunk = onChunk
          ? (chunk: string) => {
              fullResponse += chunk;
              onChunk(chunk);
            }
          : undefined;

        // Call the original method with enhanced prompt
        const response = await originalMethod(
          enhancedPrompt,
          options,
          wrappedOnChunk,
        ) as string;

        // Validate response if enabled
        if (this?.config?.validateResponses) {
          const validation = await this.validateResponse(
            fullResponse || response,
          );
          if (this.metrics.validatedResponses) { this.metrics.validatedResponses++ };

          if (!validation.isValid) {
            if (this.metrics.failedValidations) { this.metrics.failedValidations++ };
            this.handleValidationFailure(
              validation,
              prompt,
              fullResponse || response,
            );
          }
        }

        // Track latency
        this.trackLatency(Date.now() - startTime);

        // Emit success event
        this.emit("request_processed", {
          type: "generateStream",
          enhanced: shouldEnhance,
          latency: Date.now() - startTime,
        });

        return response as string;
      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }

  /**
   * Check if middleware is enabled via feature flags
   */
  private isEnabled(): boolean {
    return (
      this?.featureFlags?.isEnabled("business-search-enhancement") &&
      this?.config?.enabled
    );
  }

  /**
   * Determine if a prompt should be enhanced
   */
  private async shouldEnhancePrompt(prompt: string): Promise<boolean> {
    // Check bypass patterns
    if (this?.config?.bypassPatterns) {
      for (const pattern of this?.config?.bypassPatterns) {
        if (pattern.test(prompt)) {
          logger.debug("Prompt matches bypass pattern, skipping enhancement");
          return false;
        }
      }
    }

    // Check force enhance patterns
    if (this?.config?.forceEnhancePatterns) {
      for (const pattern of this?.config?.forceEnhancePatterns) {
        if (pattern.test(prompt)) {
          logger.debug("Prompt matches force enhance pattern");
          return true;
        }
      }
    }

    // Use BusinessQueryOptimizer to analyze the query
    const optimization = BusinessQueryOptimizer.optimize(prompt);

    // Check for security issues
    if (optimization?.securityFlags?.some((f: any) => f.severity === "high")) {
      logger.warn("Security issue detected in prompt, skipping enhancement");
      return false;
    }

    // Check if it's a business-related query
    const isBusinessQuery =
      optimization?.components?.serviceType !== "" ||
      optimization?.components?.businessIndicators?.length || 0 > 0 ||
      optimization.confidence > 0.5;

    // Check if prompt already has enhancement
    if (this?.promptEnhancer?.isAlreadyEnhanced(prompt)) {
      return false;
    }

    // Use A/B testing percentage from feature flags
    if (isBusinessQuery) {
      const percentage = this?.featureFlags?.getUserPercentage(
        "business-search-enhancement",
      );
      const shouldEnhance = Math.random() * 100 < percentage;

      if (shouldEnhance) {
        if (this.metrics.searchTriggeredRequests) { this.metrics.searchTriggeredRequests++ };
      }

      return shouldEnhance;
    }

    return false;
  }

  /**
   * Enhance a prompt with business search instructions
   */
  private async enhancePrompt(prompt: string): Promise<string> {
    // Apply rate limiting check
    const rateLimitKey = `websearch:${prompt.slice(0, 50)}`;

    try {
      // Check rate limit using token bucket for burst handling
      const isAllowed = await this.checkRateLimit(rateLimitKey);

      if (!isAllowed) {
        this.rateLimitedRequests++;
        logger.warn(
          "Rate limit exceeded for WebSearch enhancement",
          "BUSINESS_SEARCH",
          {
            key: rateLimitKey,
            rateLimitedTotal: this.rateLimitedRequests,
          },
        );

        // Emit rate limit event
        this.emit("rate_limited", {
          prompt,
          timestamp: Date.now(),
          totalRateLimited: this.rateLimitedRequests,
        });

        // Return original prompt without enhancement when rate limited
        return prompt;
      }
    } catch (error) {
      logger.error(
        "Rate limit check failed, allowing request",
        error instanceof Error ? error.message : String(error),
      );
      // Continue with enhancement if rate limit check fails
    }

    const options: BusinessSearchEnhancementOptions = {
      enableEntityExtraction: true,
      enableSentimentAnalysis: true,
      enableWorkflowDetection: true,
      maxContextLength: 2000,
    };

    const enhanced = this?.promptEnhancer?.enhance(prompt, options);

    logger.debug("Prompt enhanced for business search", "BUSINESS_SEARCH", {
      originalLength: prompt?.length || 0,
      enhancedLength: enhanced?.user?.length,
      level: this?.config?.enhancementLevel,
    });

    return enhanced.user;
  }

  /**
   * Validate a response for business information
   */
  private async validateResponse(response: string): Promise<ValidationResult> {
    return this?.responseValidator?.validateResponse(response);
  }

  /**
   * Handle validation failure
   */
  private handleValidationFailure(
    validation: ValidationResult,
    prompt: string,
    response: string,
  ): void {
    logger.warn("Response validation failed", "BUSINESS_SEARCH", {
      confidence: validation.confidence,
      missingInfo: validation.missingInfo,
      suggestions: validation.suggestions,
    });

    this.emit("validation_failed", {
      prompt,
      response,
      validation,
    });
  }

  /**
   * Check rate limit for a given key
   */
  private async checkRateLimit(key: string): Promise<boolean> {
    // Use token bucket limiter for WebSearch operations
    // 30 requests per 5 minutes with burst capacity of 5
    const tokenBucket = this?.rateLimiter?.tokenBucketLimiter(5, 0.1); // 0.1 tokens/second = 6 tokens/minute

    return new Promise((resolve: any) => {
      const mockReq = { ip: key } as any;
      const mockRes = {
        setHeader: () => {},
        getHeader: () => null,
        status: () => ({ json: () => {} }),
      } as any;

      tokenBucket(mockReq, mockRes, () => {
        resolve(true); // Request allowed
      });

      // If middleware doesn't call next, request is rate limited
      setTimeout(() => resolve(false), 10);
    });
  }

  /**
   * Circuit breaker check
   */
  private checkCircuitBreaker(): boolean {
    const now = Date.now();

    // Check if we should reset the circuit breaker
    if (this.circuitBreakerStatus === "open") {
      if (
        now - this.circuitBreakerLastFailure >
        this?.config?.circuitBreakerCooldownMs
      ) {
        this.circuitBreakerStatus = "half-open";
        this.circuitBreakerFailures = 0;
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * Handle errors and update circuit breaker
   */
  private handleError(error: unknown): void {
    if (this.metrics.errors) { this.metrics.errors++ };
    this.circuitBreakerFailures++;
    this.circuitBreakerLastFailure = Date.now();

    if (this.circuitBreakerFailures >= this?.config?.circuitBreakerThreshold) {
      this.circuitBreakerStatus = "open";
      logger.error("Circuit breaker opened due to repeated failures");
    }

    this.emit("error", {
      error,
      circuitBreakerStatus: this.circuitBreakerStatus,
    });
  }

  /**
   * Track latency and update metrics
   */
  private trackLatency(latency: number): void {
    this?.latencyHistory?.push(latency);

    if (this?.latencyHistory?.length > this.MAX_LATENCY_HISTORY) {
      this?.latencyHistory?.shift();
    }

    // Update average latency
    const sum = this?.latencyHistory?.reduce((a: any, b: any) => a + b, 0);
    if (this.metrics) {

      this.metrics.averageLatency = sum / this?.latencyHistory?.length;

    }

    // Update circuit breaker status in metrics
    if (this.metrics) {

      this.metrics.circuitBreakerStatus = this.circuitBreakerStatus;

    }

    // Check if latency is too high
    if (latency > this?.config?.maxLatencyMs) {
      logger.warn(`High latency detected: ${latency}ms`);
      this.emit("high_latency", {
        latency,
        threshold: this?.config?.maxLatencyMs,
      });
    }
  }

  /**
   * Update cache metrics
   */
  private updateCacheMetrics(): void {
    const total = this?.metrics?.cacheHits + this?.metrics?.cacheMisses;
    if (this.metrics) {

      this.metrics.cacheHitRate = total > 0 ? (this?.metrics?.cacheHits / total) * 100 : 0;

    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): MiddlewareMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      enhancedRequests: 0,
      searchTriggeredRequests: 0,
      validatedResponses: 0,
      failedValidations: 0,
      averageLatency: 0,
      errors: 0,
      circuitBreakerStatus: this.circuitBreakerStatus,
      rateLimitedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
    };
    this.latencyHistory = [];
    this.rateLimitedRequests = 0;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info(
      "BusinessSearchMiddleware configuration updated",
      "MIDDLEWARE",
      this.config,
    );
  }

  /**
   * Get current configuration
   */
  public getConfig(): MiddlewareConfig {
    return { ...this.config };
  }

  /**
   * Manually trigger circuit breaker reset
   */
  public resetCircuitBreaker(): void {
    this.circuitBreakerStatus = "closed";
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = 0;
    logger.info("Circuit breaker manually reset");
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return this?.cache?.getStats();
  }

  /**
   * Clear cache
   */
  public async clearCache(): Promise<void> {
    await this?.cache?.clear();
    if (this.metrics) {

      this.metrics.cacheHits = 0;

    }
    if (this.metrics) {

      this.metrics.cacheMisses = 0;

    }
    if (this.metrics) {

      this.metrics.cacheHitRate = 0;

    }
    logger.info("Business search cache cleared");
  }

  /**
   * Preload cache with common queries
   */
  public async preloadCache(
    queries: Array<{ query: string; location?: string; response: string }>,
  ): Promise<void> {
    await this?.cache?.preload(queries);
    logger.info(`Preloaded ${queries?.length || 0} queries into cache`);
  }

  /**
   * Analyze cache performance
   */
  public analyzeCachePerformance() {
    return this?.cache?.analyzePerformance();
  }

  /**
   * Search cache entries
   */
  public async searchCache(pattern: RegExp) {
    return this?.cache?.search(pattern);
  }

  /**
   * Cleanup resources
   */
  public async cleanup(): Promise<void> {
    await this?.cache?.cleanup();
    this?.rateLimiter?.cleanup();
    logger.info("BusinessSearchMiddleware cleaned up");
  }
}
