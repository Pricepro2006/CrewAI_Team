/**
 * LLM API Rate Limiter
 * Implements intelligent rate limiting for LLM API calls to prevent abuse and manage costs
 */

import { logger } from "../../utils/logger.js";
import { redisService } from "../cache/RedisService.js";

export interface RateLimitConfig {
  // Requests per time window
  maxRequests: number;
  windowMs: number; // milliseconds
  
  // Cost-based limiting
  maxCostPerWindow?: number;
  costPerRequest?: number;
  
  // Model-specific limits
  modelLimits?: Record<string, {
    maxRequests: number;
    maxCostPerWindow?: number;
  }>;
  
  // Burst handling
  burstLimit?: number;
  burstWindowMs?: number;
  
  // Queue management
  enableQueueing?: boolean;
  maxQueueSize?: number;
  queueTimeout?: number; // milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remainingRequests: number;
  remainingCost?: number;
  resetTime: Date;
  queuePosition?: number;
  estimatedWaitTime?: number;
}

export class LLMRateLimiter {
  private config: RateLimitConfig;
  private requestQueue: Map<string, {
    resolve: (value: boolean) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }[]> = new Map();

  constructor(config: RateLimitConfig) {
    this.config = {
      enableQueueing: false,
      maxQueueSize: 100,
      queueTimeout: 60000, // 1 minute default
      ...config,
    };
  }

  /**
   * Check if a request is allowed and consume quota if so
   */
  async checkAndConsume(
    identifier: string,
    model: string,
    estimatedCost?: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Get model-specific limits if configured
    const modelConfig = this.config.modelLimits?.[model];
    const maxRequests = modelConfig?.maxRequests || this.config.maxRequests;
    const maxCost = modelConfig?.maxCostPerWindow || this.config.maxCostPerWindow;

    // Create unique keys for this identifier and model
    const requestKey = `llm_rate:${identifier}:${model}:requests`;
    const costKey = `llm_rate:${identifier}:${model}:cost`;
    const windowKey = `llm_rate:${identifier}:${model}:window`;

    try {
      // Get current window data
      const currentWindow = await redisService.get<number>(windowKey);
      
      // If window has expired, reset counters
      if (!currentWindow || currentWindow < windowStart) {
        await this.resetWindow(identifier, model, now);
      }

      // Get current counts
      const requestCount = (await redisService.get<number>(requestKey)) || 0;
      const currentCost = (await redisService.get<number>(costKey)) || 0;

      // Check burst limits if configured
      if (this.config.burstLimit && this.config.burstWindowMs) {
        const burstAllowed = await this.checkBurstLimit(identifier, model);
        if (!burstAllowed) {
          logger.warn("Burst limit exceeded", "LLM_RATE_LIMITER", {
            identifier,
            model,
            burstLimit: this.config.burstLimit,
          });
          
          return this.createDeniedResult(requestCount, maxRequests, currentCost, maxCost, now);
        }
      }

      // Check request count limit
      if (requestCount >= maxRequests) {
        logger.warn("Request limit exceeded", "LLM_RATE_LIMITER", {
          identifier,
          model,
          requestCount,
          maxRequests,
        });
        
        // Try to queue if enabled
        if (this.config.enableQueueing) {
          const queueResult = await this.addToQueue(identifier, model);
          if (queueResult) {
            return {
              ...this.createDeniedResult(requestCount, maxRequests, currentCost, maxCost, now),
              ...queueResult,
            };
          }
        }
        
        return this.createDeniedResult(requestCount, maxRequests, currentCost, maxCost, now);
      }

      // Check cost limit if configured
      if (maxCost && estimatedCost) {
        if (currentCost + estimatedCost > maxCost) {
          logger.warn("Cost limit exceeded", "LLM_RATE_LIMITER", {
            identifier,
            model,
            currentCost,
            estimatedCost,
            maxCost,
          });
          
          return this.createDeniedResult(requestCount, maxRequests, currentCost, maxCost, now);
        }
      }

      // Request is allowed - update counters
      const ttlSeconds = Math.ceil(this.config.windowMs / 1000);
      
      // Increment request count and set TTL
      await redisService.increment(requestKey);
      await redisService.expire(requestKey, ttlSeconds);
      
      // Update cost using SET for float values
      if (estimatedCost) {
        const newCost = currentCost + estimatedCost;
        await redisService.set(costKey, newCost, ttlSeconds);
      }

      logger.debug("LLM request allowed", "LLM_RATE_LIMITER", {
        identifier,
        model,
        requestCount: requestCount + 1,
        maxRequests,
        currentCost: estimatedCost ? currentCost + estimatedCost : undefined,
      });

      return {
        allowed: true,
        remainingRequests: maxRequests - (requestCount + 1),
        remainingCost: maxCost ? maxCost - (currentCost + (estimatedCost || 0)) : undefined,
        resetTime: new Date(now + this.config.windowMs),
      };
    } catch (error) {
      logger.error("Rate limiter error", "LLM_RATE_LIMITER", { error });
      
      // On error, allow the request but log it
      return {
        allowed: true,
        remainingRequests: 0,
        resetTime: new Date(now + this.config.windowMs),
      };
    }
  }

  /**
   * Check burst limits
   */
  private async checkBurstLimit(identifier: string, model: string): Promise<boolean> {
    if (!this.config.burstLimit || !this.config.burstWindowMs) {
      return true;
    }

    const burstKey = `llm_burst:${identifier}:${model}`;
    const now = Date.now();
    const burstWindowStart = now - this.config.burstWindowMs;

    // Get burst requests in current window
    const burstRequests = await redisService.get<number[]>(burstKey) || [];
    
    // Filter out old requests
    const recentRequests = burstRequests.filter(timestamp => timestamp > burstWindowStart);
    
    if (recentRequests.length >= this.config.burstLimit) {
      return false;
    }

    // Add current request
    recentRequests.push(now);
    await redisService.set(
      burstKey, 
      recentRequests, 
      Math.ceil(this.config.burstWindowMs / 1000)
    );

    return true;
  }

  /**
   * Reset rate limit window
   */
  private async resetWindow(identifier: string, model: string, now: number): Promise<void> {
    const requestKey = `llm_rate:${identifier}:${model}:requests`;
    const costKey = `llm_rate:${identifier}:${model}:cost`;
    const windowKey = `llm_rate:${identifier}:${model}:window`;
    
    const ttlSeconds = Math.ceil(this.config.windowMs / 1000);
    
    await redisService.set(requestKey, 0, ttlSeconds);
    await redisService.set(costKey, 0, ttlSeconds);
    await redisService.set(windowKey, now, ttlSeconds);
  }

  /**
   * Create denied result
   */
  private createDeniedResult(
    requestCount: number,
    maxRequests: number,
    currentCost: number,
    maxCost: number | undefined,
    now: number
  ): RateLimitResult {
    return {
      allowed: false,
      remainingRequests: Math.max(0, maxRequests - requestCount),
      remainingCost: maxCost ? Math.max(0, maxCost - currentCost) : undefined,
      resetTime: new Date(now + this.config.windowMs),
    };
  }

  /**
   * Add request to queue
   */
  private async addToQueue(
    identifier: string,
    model: string
  ): Promise<{ queuePosition: number; estimatedWaitTime: number } | null> {
    if (!this.config.enableQueueing) {
      return null;
    }

    const queueKey = `${identifier}:${model}`;
    const queue = this.requestQueue.get(queueKey) || [];

    // Check queue size
    if (queue.length >= (this.config.maxQueueSize || 100)) {
      logger.warn("Queue is full", "LLM_RATE_LIMITER", {
        identifier,
        model,
        queueSize: queue.length,
      });
      return null;
    }

    // Estimate wait time based on current queue and rate limit
    const estimatedWaitTime = this.estimateWaitTime(queue.length);

    // Add to queue
    return new Promise((resolve) => {
      const queueEntry = {
        resolve: () => resolve({
          queuePosition: queue.length + 1,
          estimatedWaitTime,
        }),
        reject: () => resolve(null),
        timestamp: Date.now(),
      };

      queue.push(queueEntry as any);
      this.requestQueue.set(queueKey, queue);

      // Set timeout for queue entry
      setTimeout(() => {
        const index = queue.indexOf(queueEntry as any);
        if (index > -1) {
          queue.splice(index, 1);
          resolve(null);
        }
      }, this.config.queueTimeout || 60000);
    });
  }

  /**
   * Estimate wait time for queue position
   */
  private estimateWaitTime(queuePosition: number): number {
    // Simple estimation: assume requests are processed at max rate
    const processingRate = this.config.maxRequests / this.config.windowMs;
    return Math.ceil(queuePosition / processingRate);
  }

  /**
   * Process queued requests
   */
  async processQueue(identifier: string, model: string): Promise<void> {
    const queueKey = `${identifier}:${model}`;
    const queue = this.requestQueue.get(queueKey) || [];

    if (queue.length === 0) {
      return;
    }

    // Try to process the first item in queue
    const result = await this.checkAndConsume(identifier, model);
    if (result.allowed) {
      const item = queue.shift();
      if (item) {
        item.resolve(true);
      }
    }
  }

  /**
   * Get current rate limit status without consuming
   */
  async getStatus(identifier: string, model: string): Promise<{
    currentRequests: number;
    maxRequests: number;
    currentCost?: number;
    maxCost?: number;
    resetTime: Date;
  }> {
    const now = Date.now();
    const requestKey = `llm_rate:${identifier}:${model}:requests`;
    const costKey = `llm_rate:${identifier}:${model}:cost`;
    
    const modelConfig = this.config.modelLimits?.[model];
    const maxRequests = modelConfig?.maxRequests || this.config.maxRequests;
    const maxCost = modelConfig?.maxCostPerWindow || this.config.maxCostPerWindow;

    const currentRequests = (await redisService.get<number>(requestKey)) || 0;
    const currentCost = (await redisService.get<number>(costKey)) || 0;

    return {
      currentRequests,
      maxRequests,
      currentCost: maxCost ? currentCost : undefined,
      maxCost,
      resetTime: new Date(now + this.config.windowMs),
    };
  }
}

// Export pre-configured rate limiters for different use cases
export const llmRateLimiters = {
  // Standard rate limiter for general LLM calls
  standard: new LLMRateLimiter({
    maxRequests: 60,
    windowMs: 60 * 1000, // 60 requests per minute
    burstLimit: 10,
    burstWindowMs: 10 * 1000, // 10 requests per 10 seconds
    enableQueueing: true,
    maxQueueSize: 50,
  }),

  // Strict rate limiter for expensive models
  strict: new LLMRateLimiter({
    maxRequests: 10,
    windowMs: 60 * 1000, // 10 requests per minute
    maxCostPerWindow: 1.0, // $1 per minute max
    costPerRequest: 0.05,
    burstLimit: 3,
    burstWindowMs: 10 * 1000,
    enableQueueing: false,
  }),

  // Relaxed rate limiter for cheap/local models
  relaxed: new LLMRateLimiter({
    maxRequests: 300,
    windowMs: 60 * 1000, // 300 requests per minute
    burstLimit: 50,
    burstWindowMs: 10 * 1000,
    enableQueueing: true,
    maxQueueSize: 200,
  }),

  // Model-specific rate limiter
  modelSpecific: new LLMRateLimiter({
    maxRequests: 100, // default
    windowMs: 60 * 1000,
    modelLimits: {
      "gpt-4": {
        maxRequests: 10,
        maxCostPerWindow: 2.0,
      },
      "gpt-3.5-turbo": {
        maxRequests: 60,
        maxCostPerWindow: 0.5,
      },
      "llama3.2:3b": {
        maxRequests: 200,
      },
      "doomgrave/phi-4:14b-tools-Q3_K_S": {
        maxRequests: 100,
      },
    },
    enableQueueing: true,
  }),
};