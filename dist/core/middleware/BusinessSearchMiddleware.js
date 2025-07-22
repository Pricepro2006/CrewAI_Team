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
import { BusinessSearchPromptEnhancer } from '../prompts/BusinessSearchPromptEnhancer';
import { BusinessQueryOptimizer } from '../search/BusinessQueryOptimizer';
import { BusinessResponseValidator } from '../validators/BusinessResponseValidator';
import { logger } from '../../utils/logger';
import { FeatureFlagService } from '../../config/features/FeatureFlagService';
import { RateLimiter } from './RateLimiter';
import { BusinessSearchCache } from '../cache/BusinessSearchCache';
export class BusinessSearchMiddleware extends EventEmitter {
    promptEnhancer;
    responseValidator;
    featureFlags;
    metrics;
    config;
    rateLimiter;
    cache;
    // Circuit breaker state
    circuitBreakerFailures = 0;
    circuitBreakerLastFailure = 0;
    circuitBreakerStatus = 'closed';
    // Performance tracking
    latencyHistory = [];
    MAX_LATENCY_HISTORY = 100;
    // Rate limiting tracking
    rateLimitedRequests = 0;
    constructor(config) {
        super();
        this.config = {
            enabled: true,
            enhancementLevel: 'standard',
            validateResponses: true,
            collectMetrics: true,
            maxLatencyMs: 2000, // 2 second max added latency
            circuitBreakerThreshold: 5,
            circuitBreakerCooldownMs: 60000, // 1 minute cooldown
            cacheEnabled: true,
            cacheMaxAge: 60 * 60 * 1000, // 1 hour
            cacheStaleWhileRevalidate: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        this.promptEnhancer = new BusinessSearchPromptEnhancer();
        this.responseValidator = new BusinessResponseValidator({
            privacyMode: false,
            minConfidenceThreshold: 0.6
        });
        this.featureFlags = FeatureFlagService.getInstance();
        this.rateLimiter = new RateLimiter(process.env.USE_REDIS === 'true');
        this.cache = new BusinessSearchCache({
            maxAge: this.config.cacheMaxAge,
            staleWhileRevalidate: this.config.cacheStaleWhileRevalidate,
            useRedis: process.env.USE_REDIS === 'true'
        });
        this.metrics = {
            totalRequests: 0,
            enhancedRequests: 0,
            searchTriggeredRequests: 0,
            validatedResponses: 0,
            failedValidations: 0,
            averageLatency: 0,
            errors: 0,
            circuitBreakerStatus: 'closed',
            rateLimitedRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            cacheHitRate: 0
        };
    }
    /**
     * Wrap an OllamaProvider instance with middleware functionality
     */
    wrapProvider(provider) {
        // Check if feature is enabled
        if (!this.isEnabled()) {
            logger.info('BusinessSearchMiddleware is disabled via feature flag');
            return provider;
        }
        // Create a proxy to intercept method calls
        return new Proxy(provider, {
            get: (target, prop, receiver) => {
                // Intercept specific methods
                if (prop === 'generate') {
                    return this.wrapGenerate(target, target.generate.bind(target));
                }
                if (prop === 'generateWithLogProbs') {
                    return this.wrapGenerateWithLogProbs(target, target.generateWithLogProbs.bind(target));
                }
                if (prop === 'generateStream') {
                    return this.wrapGenerateStream(target, target.generateStream.bind(target));
                }
                // Pass through all other properties/methods
                return Reflect.get(target, prop, receiver);
            }
        });
    }
    /**
     * Wrap the generate method
     */
    wrapGenerate(provider, originalMethod) {
        return async (prompt, options) => {
            const startTime = Date.now();
            try {
                // Check circuit breaker
                if (!this.checkCircuitBreaker()) {
                    logger.warn('Circuit breaker is open, bypassing middleware');
                    return originalMethod(prompt, options);
                }
                // Track request
                this.metrics.totalRequests++;
                // Check if we should enhance this prompt
                const shouldEnhance = await this.shouldEnhancePrompt(prompt);
                if (!shouldEnhance) {
                    return originalMethod(prompt, options);
                }
                // Extract location from prompt for cache key
                const optimization = BusinessQueryOptimizer.optimize(prompt);
                const location = optimization.components.location;
                // Check cache if enabled
                if (this.config.cacheEnabled) {
                    const cacheEntry = await this.cache.get(prompt, location?.rawLocation);
                    if (cacheEntry) {
                        this.metrics.cacheHits++;
                        this.updateCacheMetrics();
                        // Track latency for cached response
                        this.trackLatency(Date.now() - startTime);
                        // Emit cache hit event
                        this.emit('cache_hit', {
                            prompt,
                            location,
                            age: Date.now() - cacheEntry.timestamp,
                            hitCount: cacheEntry.hitCount
                        });
                        logger.debug('Cache hit for business search', 'BUSINESS_SEARCH', {
                            prompt: prompt.slice(0, 50),
                            location: location?.rawLocation,
                            age: (Date.now() - cacheEntry.timestamp) / 1000
                        });
                        return cacheEntry.response;
                    }
                    else {
                        this.metrics.cacheMisses++;
                        this.updateCacheMetrics();
                    }
                }
                // Enhance the prompt
                const enhancedPrompt = await this.enhancePrompt(prompt);
                this.metrics.enhancedRequests++;
                // Call the original method with enhanced prompt
                const response = await originalMethod(enhancedPrompt, options);
                // Validate response if enabled
                let validation;
                if (this.config.validateResponses) {
                    validation = await this.validateResponse(response);
                    this.metrics.validatedResponses++;
                    if (!validation.isValid) {
                        this.metrics.failedValidations++;
                        this.handleValidationFailure(validation, prompt, response);
                    }
                }
                // Store in cache if enabled and response is valid
                if (this.config.cacheEnabled && (!validation || validation.isValid)) {
                    await this.cache.set(prompt, location?.rawLocation, response, validation, {
                        enhanced: true,
                        modelUsed: provider.getConfig().model
                    });
                }
                // Track latency
                this.trackLatency(Date.now() - startTime);
                // Emit success event
                this.emit('request_processed', {
                    type: 'generate',
                    enhanced: shouldEnhance,
                    latency: Date.now() - startTime,
                    cached: false
                });
                return response;
            }
            catch (error) {
                this.handleError(error);
                throw error;
            }
        };
    }
    /**
     * Wrap the generateWithLogProbs method
     */
    wrapGenerateWithLogProbs(provider, originalMethod) {
        return async (prompt, options) => {
            const startTime = Date.now();
            try {
                // Check circuit breaker
                if (!this.checkCircuitBreaker()) {
                    logger.warn('Circuit breaker is open, bypassing middleware');
                    return originalMethod(prompt, options);
                }
                // Track request
                this.metrics.totalRequests++;
                // Check if we should enhance this prompt
                const shouldEnhance = await this.shouldEnhancePrompt(prompt);
                if (!shouldEnhance) {
                    return originalMethod(prompt, options);
                }
                // Enhance the prompt
                const enhancedPrompt = await this.enhancePrompt(prompt);
                this.metrics.enhancedRequests++;
                // Call the original method with enhanced prompt
                const response = await originalMethod(enhancedPrompt, options);
                // Validate response if enabled
                if (this.config.validateResponses && response.text) {
                    const validation = await this.validateResponse(response.text);
                    this.metrics.validatedResponses++;
                    if (!validation.isValid) {
                        this.metrics.failedValidations++;
                        this.handleValidationFailure(validation, prompt, response.text);
                    }
                }
                // Track latency
                this.trackLatency(Date.now() - startTime);
                // Emit success event
                this.emit('request_processed', {
                    type: 'generateWithLogProbs',
                    enhanced: shouldEnhance,
                    latency: Date.now() - startTime
                });
                return response;
            }
            catch (error) {
                this.handleError(error);
                throw error;
            }
        };
    }
    /**
     * Wrap the generateStream method
     */
    wrapGenerateStream(provider, originalMethod) {
        return async (prompt, options, onChunk) => {
            const startTime = Date.now();
            try {
                // Check circuit breaker
                if (!this.checkCircuitBreaker()) {
                    logger.warn('Circuit breaker is open, bypassing middleware');
                    return originalMethod(prompt, options, onChunk);
                }
                // Track request
                this.metrics.totalRequests++;
                // Check if we should enhance this prompt
                const shouldEnhance = await this.shouldEnhancePrompt(prompt);
                if (!shouldEnhance) {
                    return originalMethod(prompt, options, onChunk);
                }
                // Enhance the prompt
                const enhancedPrompt = await this.enhancePrompt(prompt);
                this.metrics.enhancedRequests++;
                // Wrap the chunk callback to collect full response for validation
                let fullResponse = '';
                const wrappedOnChunk = onChunk ? (chunk) => {
                    fullResponse += chunk;
                    onChunk(chunk);
                } : undefined;
                // Call the original method with enhanced prompt
                const response = await originalMethod(enhancedPrompt, options, wrappedOnChunk);
                // Validate response if enabled
                if (this.config.validateResponses) {
                    const validation = await this.validateResponse(fullResponse || response);
                    this.metrics.validatedResponses++;
                    if (!validation.isValid) {
                        this.metrics.failedValidations++;
                        this.handleValidationFailure(validation, prompt, fullResponse || response);
                    }
                }
                // Track latency
                this.trackLatency(Date.now() - startTime);
                // Emit success event
                this.emit('request_processed', {
                    type: 'generateStream',
                    enhanced: shouldEnhance,
                    latency: Date.now() - startTime
                });
                return response;
            }
            catch (error) {
                this.handleError(error);
                throw error;
            }
        };
    }
    /**
     * Check if middleware is enabled via feature flags
     */
    isEnabled() {
        return this.featureFlags.isEnabled('business-search-enhancement') && this.config.enabled;
    }
    /**
     * Determine if a prompt should be enhanced
     */
    async shouldEnhancePrompt(prompt) {
        // Check bypass patterns
        if (this.config.bypassPatterns) {
            for (const pattern of this.config.bypassPatterns) {
                if (pattern.test(prompt)) {
                    logger.debug('Prompt matches bypass pattern, skipping enhancement');
                    return false;
                }
            }
        }
        // Check force enhance patterns
        if (this.config.forceEnhancePatterns) {
            for (const pattern of this.config.forceEnhancePatterns) {
                if (pattern.test(prompt)) {
                    logger.debug('Prompt matches force enhance pattern');
                    return true;
                }
            }
        }
        // Use BusinessQueryOptimizer to analyze the query
        const optimization = BusinessQueryOptimizer.optimize(prompt);
        // Check for security issues
        if (optimization.securityFlags.some(f => f.severity === 'high')) {
            logger.warn('Security issue detected in prompt, skipping enhancement');
            return false;
        }
        // Check if it's a business-related query
        const isBusinessQuery = optimization.components.serviceType !== '' ||
            optimization.components.businessIndicators.length > 0 ||
            optimization.confidence > 0.5;
        // Check if prompt already has enhancement
        if (this.promptEnhancer.isAlreadyEnhanced(prompt)) {
            return false;
        }
        // Use A/B testing percentage from feature flags
        if (isBusinessQuery) {
            const percentage = this.featureFlags.getUserPercentage('business-search-enhancement');
            const shouldEnhance = Math.random() * 100 < percentage;
            if (shouldEnhance) {
                this.metrics.searchTriggeredRequests++;
            }
            return shouldEnhance;
        }
        return false;
    }
    /**
     * Enhance a prompt with business search instructions
     */
    async enhancePrompt(prompt) {
        // Apply rate limiting check
        const rateLimitKey = `websearch:${prompt.slice(0, 50)}`;
        try {
            // Check rate limit using token bucket for burst handling
            const isAllowed = await this.checkRateLimit(rateLimitKey);
            if (!isAllowed) {
                this.rateLimitedRequests++;
                logger.warn('Rate limit exceeded for WebSearch enhancement', 'BUSINESS_SEARCH', {
                    key: rateLimitKey,
                    rateLimitedTotal: this.rateLimitedRequests
                });
                // Emit rate limit event
                this.emit('rate_limited', {
                    prompt,
                    timestamp: Date.now(),
                    totalRateLimited: this.rateLimitedRequests
                });
                // Return original prompt without enhancement when rate limited
                return prompt;
            }
        }
        catch (error) {
            logger.error('Rate limit check failed, allowing request', error instanceof Error ? error.message : String(error));
            // Continue with enhancement if rate limit check fails
        }
        const options = {
            enhancementLevel: this.config.enhancementLevel,
            includeExamples: true,
            preserveOriginalMarkers: true
        };
        const enhanced = this.promptEnhancer.enhance(prompt, options);
        logger.debug('Prompt enhanced for business search', 'BUSINESS_SEARCH', {
            originalLength: prompt.length,
            enhancedLength: enhanced.length,
            level: this.config.enhancementLevel
        });
        return enhanced;
    }
    /**
     * Validate a response for business information
     */
    async validateResponse(response) {
        return this.responseValidator.validateResponse(response);
    }
    /**
     * Handle validation failure
     */
    handleValidationFailure(validation, prompt, response) {
        logger.warn('Response validation failed', 'BUSINESS_SEARCH', {
            confidence: validation.confidence,
            missingInfo: validation.missingInfo,
            suggestions: validation.suggestions
        });
        this.emit('validation_failed', {
            prompt,
            response,
            validation
        });
    }
    /**
     * Check rate limit for a given key
     */
    async checkRateLimit(key) {
        // Use token bucket limiter for WebSearch operations
        // 30 requests per 5 minutes with burst capacity of 5
        const tokenBucket = this.rateLimiter.tokenBucketLimiter(5, 0.1); // 0.1 tokens/second = 6 tokens/minute
        return new Promise((resolve) => {
            const mockReq = { ip: key };
            const mockRes = {
                setHeader: () => { },
                getHeader: () => null,
                status: () => ({ json: () => { } })
            };
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
    checkCircuitBreaker() {
        const now = Date.now();
        // Check if we should reset the circuit breaker
        if (this.circuitBreakerStatus === 'open') {
            if (now - this.circuitBreakerLastFailure > this.config.circuitBreakerCooldownMs) {
                this.circuitBreakerStatus = 'half-open';
                this.circuitBreakerFailures = 0;
            }
            else {
                return false;
            }
        }
        return true;
    }
    /**
     * Handle errors and update circuit breaker
     */
    handleError(error) {
        this.metrics.errors++;
        this.circuitBreakerFailures++;
        this.circuitBreakerLastFailure = Date.now();
        if (this.circuitBreakerFailures >= this.config.circuitBreakerThreshold) {
            this.circuitBreakerStatus = 'open';
            logger.error('Circuit breaker opened due to repeated failures');
        }
        this.emit('error', {
            error,
            circuitBreakerStatus: this.circuitBreakerStatus
        });
    }
    /**
     * Track latency and update metrics
     */
    trackLatency(latency) {
        this.latencyHistory.push(latency);
        if (this.latencyHistory.length > this.MAX_LATENCY_HISTORY) {
            this.latencyHistory.shift();
        }
        // Update average latency
        const sum = this.latencyHistory.reduce((a, b) => a + b, 0);
        this.metrics.averageLatency = sum / this.latencyHistory.length;
        // Update circuit breaker status in metrics
        this.metrics.circuitBreakerStatus = this.circuitBreakerStatus;
        // Check if latency is too high
        if (latency > this.config.maxLatencyMs) {
            logger.warn(`High latency detected: ${latency}ms`);
            this.emit('high_latency', {
                latency,
                threshold: this.config.maxLatencyMs
            });
        }
    }
    /**
     * Update cache metrics
     */
    updateCacheMetrics() {
        const total = this.metrics.cacheHits + this.metrics.cacheMisses;
        this.metrics.cacheHitRate = total > 0
            ? (this.metrics.cacheHits / total) * 100
            : 0;
    }
    /**
     * Get current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Reset metrics
     */
    resetMetrics() {
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
            cacheHitRate: 0
        };
        this.latencyHistory = [];
        this.rateLimitedRequests = 0;
    }
    /**
     * Update configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
        logger.info('BusinessSearchMiddleware configuration updated', 'MIDDLEWARE', this.config);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Manually trigger circuit breaker reset
     */
    resetCircuitBreaker() {
        this.circuitBreakerStatus = 'closed';
        this.circuitBreakerFailures = 0;
        this.circuitBreakerLastFailure = 0;
        logger.info('Circuit breaker manually reset');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return this.cache.getStats();
    }
    /**
     * Clear cache
     */
    async clearCache() {
        await this.cache.clear();
        this.metrics.cacheHits = 0;
        this.metrics.cacheMisses = 0;
        this.metrics.cacheHitRate = 0;
        logger.info('Business search cache cleared');
    }
    /**
     * Preload cache with common queries
     */
    async preloadCache(queries) {
        await this.cache.preload(queries);
        logger.info(`Preloaded ${queries.length} queries into cache`);
    }
    /**
     * Analyze cache performance
     */
    analyzeCachePerformance() {
        return this.cache.analyzePerformance();
    }
    /**
     * Search cache entries
     */
    async searchCache(pattern) {
        return this.cache.search(pattern);
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        await this.cache.cleanup();
        this.rateLimiter.cleanup();
        logger.info('BusinessSearchMiddleware cleaned up');
    }
}
//# sourceMappingURL=BusinessSearchMiddleware.js.map