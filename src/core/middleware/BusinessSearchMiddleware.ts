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
import { OllamaProvider, OllamaGenerateOptions, OllamaGenerateWithLogProbsResponse } from '../llm/OllamaProvider';
import { BusinessSearchPromptEnhancer, BusinessSearchEnhancementOptions } from '../prompts/BusinessSearchPromptEnhancer';
import { BusinessQueryOptimizer } from '../search/BusinessQueryOptimizer';
import { BusinessResponseValidator, ValidationResult } from '../validators/BusinessResponseValidator';
import { logger } from '../../utils/logger';
import { FeatureFlagService } from '../../config/features/FeatureFlagService';

export interface MiddlewareMetrics {
  totalRequests: number;
  enhancedRequests: number;
  searchTriggeredRequests: number;
  validatedResponses: number;
  failedValidations: number;
  averageLatency: number;
  errors: number;
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
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
}

export class BusinessSearchMiddleware extends EventEmitter {
  private promptEnhancer: BusinessSearchPromptEnhancer;
  private responseValidator: BusinessResponseValidator;
  private featureFlags: FeatureFlagService;
  private metrics: MiddlewareMetrics;
  private config: MiddlewareConfig;
  
  // Circuit breaker state
  private circuitBreakerFailures: number = 0;
  private circuitBreakerLastFailure: number = 0;
  private circuitBreakerStatus: 'closed' | 'open' | 'half-open' = 'closed';

  // Performance tracking
  private latencyHistory: number[] = [];
  private readonly MAX_LATENCY_HISTORY = 100;

  constructor(config?: Partial<MiddlewareConfig>) {
    super();
    
    this.config = {
      enabled: true,
      enhancementLevel: 'standard',
      validateResponses: true,
      collectMetrics: true,
      maxLatencyMs: 2000, // 2 second max added latency
      circuitBreakerThreshold: 5,
      circuitBreakerCooldownMs: 60000, // 1 minute cooldown
      ...config
    };

    this.promptEnhancer = new BusinessSearchPromptEnhancer();
    this.responseValidator = new BusinessResponseValidator({
      privacyMode: false,
      minConfidenceThreshold: 0.6
    });
    this.featureFlags = FeatureFlagService.getInstance();

    this.metrics = {
      totalRequests: 0,
      enhancedRequests: 0,
      searchTriggeredRequests: 0,
      validatedResponses: 0,
      failedValidations: 0,
      averageLatency: 0,
      errors: 0,
      circuitBreakerStatus: 'closed'
    };
  }

  /**
   * Wrap an OllamaProvider instance with middleware functionality
   */
  public wrapProvider(provider: OllamaProvider): OllamaProvider {
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
  private wrapGenerate(provider: OllamaProvider, originalMethod: Function) {
    return async (prompt: string, options?: OllamaGenerateOptions): Promise<string> => {
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
        if (this.config.validateResponses) {
          const validation = await this.validateResponse(response);
          this.metrics.validatedResponses++;
          
          if (!validation.isValid) {
            this.metrics.failedValidations++;
            this.handleValidationFailure(validation, prompt, response);
          }
        }

        // Track latency
        this.trackLatency(Date.now() - startTime);

        // Emit success event
        this.emit('request_processed', {
          type: 'generate',
          enhanced: shouldEnhance,
          latency: Date.now() - startTime
        });

        return response;

      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }

  /**
   * Wrap the generateWithLogProbs method
   */
  private wrapGenerateWithLogProbs(provider: OllamaProvider, originalMethod: Function) {
    return async (prompt: string, options?: OllamaGenerateOptions): Promise<OllamaGenerateWithLogProbsResponse> => {
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

      } catch (error) {
        this.handleError(error);
        throw error;
      }
    };
  }

  /**
   * Wrap the generateStream method
   */
  private wrapGenerateStream(provider: OllamaProvider, originalMethod: Function) {
    return async (
      prompt: string, 
      options?: OllamaGenerateOptions,
      onChunk?: (chunk: string) => void
    ): Promise<string> => {
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
        const wrappedOnChunk = onChunk ? (chunk: string) => {
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
    return this.featureFlags.isEnabled('business-search-enhancement') && this.config.enabled;
  }

  /**
   * Determine if a prompt should be enhanced
   */
  private async shouldEnhancePrompt(prompt: string): Promise<boolean> {
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
  private async enhancePrompt(prompt: string): Promise<string> {
    const options: BusinessSearchEnhancementOptions = {
      enhancementLevel: this.config.enhancementLevel,
      includeExamples: true,
      preserveOriginalMarkers: true
    };

    const enhanced = this.promptEnhancer.enhance(prompt, options);
    
    logger.debug('Prompt enhanced for business search', {
      originalLength: prompt.length,
      enhancedLength: enhanced.length,
      level: this.config.enhancementLevel
    });

    return enhanced;
  }

  /**
   * Validate a response for business information
   */
  private async validateResponse(response: string): Promise<ValidationResult> {
    return this.responseValidator.validateResponse(response);
  }

  /**
   * Handle validation failure
   */
  private handleValidationFailure(validation: ValidationResult, prompt: string, response: string): void {
    logger.warn('Response validation failed', {
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
   * Circuit breaker check
   */
  private checkCircuitBreaker(): boolean {
    const now = Date.now();
    
    // Check if we should reset the circuit breaker
    if (this.circuitBreakerStatus === 'open') {
      if (now - this.circuitBreakerLastFailure > this.config.circuitBreakerCooldownMs) {
        this.circuitBreakerStatus = 'half-open';
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
  private handleError(error: any): void {
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
  private trackLatency(latency: number): void {
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
      circuitBreakerStatus: this.circuitBreakerStatus
    };
    this.latencyHistory = [];
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<MiddlewareConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('BusinessSearchMiddleware configuration updated', this.config);
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
    this.circuitBreakerStatus = 'closed';
    this.circuitBreakerFailures = 0;
    this.circuitBreakerLastFailure = 0;
    logger.info('Circuit breaker manually reset');
  }
}