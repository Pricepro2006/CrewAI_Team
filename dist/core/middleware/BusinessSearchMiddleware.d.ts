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
import { EventEmitter } from 'events';
import type { OllamaProvider } from '../llm/OllamaProvider';
export interface MiddlewareMetrics {
    totalRequests: number;
    enhancedRequests: number;
    searchTriggeredRequests: number;
    validatedResponses: number;
    failedValidations: number;
    averageLatency: number;
    errors: number;
    circuitBreakerStatus: 'closed' | 'open' | 'half-open';
    rateLimitedRequests: number;
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
}
export interface MiddlewareConfig {
    enabled: boolean;
    enhancementLevel: 'minimal' | 'standard' | 'aggressive';
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
export declare class BusinessSearchMiddleware extends EventEmitter {
    private promptEnhancer;
    private responseValidator;
    private featureFlags;
    private metrics;
    private config;
    private rateLimiter;
    private cache;
    private circuitBreakerFailures;
    private circuitBreakerLastFailure;
    private circuitBreakerStatus;
    private latencyHistory;
    private readonly MAX_LATENCY_HISTORY;
    private rateLimitedRequests;
    constructor(config?: Partial<MiddlewareConfig>);
    /**
     * Wrap an OllamaProvider instance with middleware functionality
     */
    wrapProvider(provider: OllamaProvider): OllamaProvider;
    /**
     * Wrap the generate method
     */
    private wrapGenerate;
    /**
     * Wrap the generateWithLogProbs method
     */
    private wrapGenerateWithLogProbs;
    /**
     * Wrap the generateStream method
     */
    private wrapGenerateStream;
    /**
     * Check if middleware is enabled via feature flags
     */
    private isEnabled;
    /**
     * Determine if a prompt should be enhanced
     */
    private shouldEnhancePrompt;
    /**
     * Enhance a prompt with business search instructions
     */
    private enhancePrompt;
    /**
     * Validate a response for business information
     */
    private validateResponse;
    /**
     * Handle validation failure
     */
    private handleValidationFailure;
    /**
     * Check rate limit for a given key
     */
    private checkRateLimit;
    /**
     * Circuit breaker check
     */
    private checkCircuitBreaker;
    /**
     * Handle errors and update circuit breaker
     */
    private handleError;
    /**
     * Track latency and update metrics
     */
    private trackLatency;
    /**
     * Update cache metrics
     */
    private updateCacheMetrics;
    /**
     * Get current metrics
     */
    getMetrics(): MiddlewareMetrics;
    /**
     * Reset metrics
     */
    resetMetrics(): void;
    /**
     * Update configuration
     */
    updateConfig(config: Partial<MiddlewareConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): MiddlewareConfig;
    /**
     * Manually trigger circuit breaker reset
     */
    resetCircuitBreaker(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): import("../cache/BusinessSearchCache").CacheStats;
    /**
     * Clear cache
     */
    clearCache(): Promise<void>;
    /**
     * Preload cache with common queries
     */
    preloadCache(queries: Array<{
        query: string;
        location?: string;
        response: string;
    }>): Promise<void>;
    /**
     * Analyze cache performance
     */
    analyzeCachePerformance(): {
        hotQueries: Array<{
            query: string;
            location?: string;
            hitCount: number;
        }>;
        staleEntries: number;
        avgAge: number;
        memoryPressure: number;
    };
    /**
     * Search cache entries
     */
    searchCache(pattern: RegExp): Promise<{
        key: string;
        entry: import("../cache/BusinessSearchCache").CacheEntry;
    }[]>;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=BusinessSearchMiddleware.d.ts.map