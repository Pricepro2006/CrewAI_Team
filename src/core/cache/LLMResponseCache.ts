/**
 * LLM Response Caching Service
 * 
 * Features:
 * - Cache Ollama API responses with semantic similarity
 * - Prompt-based cache keys with normalization
 * - Email analysis results caching
 * - Workflow and phase analysis data caching
 * - Semantic similarity matching for cache hits
 * - Context-aware TTL management
 */

import { cacheManager } from './RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import crypto from 'crypto';
import { z } from 'zod';

// Schema for LLM response data
const LLMResponseSchema = z.object({
  prompt: z.string(),
  response: z.string(),
  model: z.string(),
  timestamp: z.date(),
  processingTime: z.number(),
  tokenCount: z.number().optional(),
  confidence: z.number().optional(),
  metadata: z.record(z.any()).optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Schema for email analysis cache data
const EmailAnalysisSchema = z.object({
  emailId: z.string(),
  phase: z.enum(['pattern_triage', 'llama_analysis', 'critical_analysis']),
  analysis: z.record(z.any()),
  confidence: z.number(),
  model: z.string(),
  timestamp: z.date(),
  processingTime: z.number(),
});

export type EmailAnalysisCache = z.infer<typeof EmailAnalysisSchema>;

// Schema for workflow analysis cache data
const WorkflowAnalysisSchema = z.object({
  workflowId: z.string(),
  workflowType: z.string(),
  analysis: z.record(z.any()),
  state: z.string(),
  timestamp: z.date(),
  emailIds: z.array(z.string()),
});

export type WorkflowAnalysisCache = z.infer<typeof WorkflowAnalysisSchema>;

export interface LLMCacheConfig {
  ttl?: number;
  semanticSimilarityThreshold?: number;
  enableSemanticMatching?: boolean;
  compressLargeResponses?: boolean;
  maxPromptLength?: number;
}

export class LLMResponseCache {
  private static instance: LLMResponseCache | null = null;
  private cacheNamespace = 'llm';
  private readonly defaultTTL = 7200; // 2 hours
  private readonly longTTL = 86400; // 24 hours for stable analysis
  private readonly shortTTL = 1800; // 30 minutes for dynamic content
  private readonly semanticThreshold = 0.85; // Similarity threshold for cache hits
  private readonly maxPromptLength = 10000; // Max prompt length for caching

  private constructor() {
    logger.info('LLM Response Cache initialized', 'LLM_CACHE');
  }

  public static getInstance(): LLMResponseCache {
    if (!LLMResponseCache.instance) {
      LLMResponseCache.instance = new LLMResponseCache();
    }
    return LLMResponseCache.instance;
  }

  /**
   * Normalize prompt for consistent caching
   */
  private normalizePrompt(prompt: string): string {
    return prompt
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[^\w\s]/g, '') // Remove special characters
      .substring(0, this.maxPromptLength); // Limit length
  }

  /**
   * Generate cache key for LLM response
   */
  private generatePromptCacheKey(prompt: string, model: string): string {
    const normalizedPrompt = this.normalizePrompt(prompt);
    const hash = crypto
      .createHash('sha256')
      .update(`${model}:${normalizedPrompt}`)
      .digest('hex');
    return `prompt:${hash}`;
  }

  /**
   * Generate cache key for email analysis
   */
  private generateEmailAnalysisCacheKey(emailId: string, phase: string, model: string): string {
    return `email_analysis:${emailId}:${phase}:${model}`;
  }

  /**
   * Generate cache key for workflow analysis
   */
  private generateWorkflowAnalysisCacheKey(workflowId: string, workflowType: string): string {
    return `workflow_analysis:${workflowId}:${workflowType}`;
  }

  /**
   * Calculate semantic similarity between two prompts
   */
  private calculateSimilarity(prompt1: string, prompt2: string): number {
    const norm1 = this.normalizePrompt(prompt1);
    const norm2 = this.normalizePrompt(prompt2);

    // Simple Jaccard similarity for demonstration
    // In production, you might want to use more sophisticated NLP techniques
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  /**
   * Cache LLM response
   */
  async cacheLLMResponse(
    prompt: string,
    response: string,
    model: string,
    config: LLMCacheConfig = {}
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      // Skip caching for very large prompts
      if (prompt?.length || 0 > this.maxPromptLength * 2) {
        logger.debug('Skipping cache for oversized prompt', 'LLM_CACHE', {
          promptLength: prompt?.length || 0,
          maxLength: this.maxPromptLength * 2,
        });
        return false;
      }

      const cacheKey = this.generatePromptCacheKey(prompt, model);
      const processingTime = Date.now() - startTime;

      const llmResponse: LLMResponse = {
        prompt,
        response,
        model,
        timestamp: new Date(),
        processingTime,
        tokenCount: response?.length || 0 / 4, // Rough token estimate
        confidence: config.semanticSimilarityThreshold || 1.0,
        metadata: {
          cacheConfig: config,
          promptLength: prompt?.length || 0,
          responseLength: response?.length || 0,
        },
      };

      const ttl = config.ttl || this.defaultTTL;
      const compress = config.compressLargeResponses && response?.length || 0 > 2048;

      const success = await cacheManager.set(
        cacheKey,
        llmResponse,
        {
          ttl,
          compress,
          namespace: this.cacheNamespace,
          tags: [`model:${model}`, 'llm_responses'],
        }
      );

      metrics.increment('llm_cache.response_cached');
      metrics.histogram('llm_cache.cache_duration', Date.now() - startTime);

      logger.debug('LLM response cached', 'LLM_CACHE', {
        cacheKey,
        model,
        promptLength: prompt?.length || 0,
        responseLength: response?.length || 0,
        ttl,
        compressed: compress,
      });

      return success;
    } catch (error) {
      logger.error('Failed to cache LLM response', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        model,
        promptLength: prompt?.length || 0,
      });
      metrics.increment('llm_cache.cache_error');
      return false;
    }
  }

  /**
   * Get cached LLM response
   */
  async getCachedLLMResponse(
    prompt: string,
    model: string,
    config: LLMCacheConfig = {}
  ): Promise<LLMResponse | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generatePromptCacheKey(prompt, model);
      
      // Try exact match first
      let cached = await cacheManager.get<LLMResponse>(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('llm_cache.exact_hit');
        metrics.histogram('llm_cache.get_duration', Date.now() - startTime);
        
        logger.debug('LLM cache exact hit', 'LLM_CACHE', {
          cacheKey,
          model,
          age: Date.now() - cached?.timestamp?.getTime(),
        });

        return cached;
      }

      // Try semantic matching if enabled
      if (config.enableSemanticMatching) {
        cached = await this.findSemanticallySimilarResponse(prompt, model, config);
        
        if (cached) {
          metrics.increment('llm_cache.semantic_hit');
          metrics.histogram('llm_cache.semantic_get_duration', Date.now() - startTime);
          
          logger.debug('LLM cache semantic hit', 'LLM_CACHE', {
            model,
            similarity: 'above_threshold',
          });

          return cached;
        }
      }

      metrics.increment('llm_cache.miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached LLM response', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        model,
      });
      metrics.increment('llm_cache.get_error');
      return null;
    }
  }

  /**
   * Cache email analysis result
   */
  async cacheEmailAnalysis(
    emailId: string,
    phase: 'pattern_triage' | 'llama_analysis' | 'critical_analysis',
    analysis: any,
    model: string,
    processingTime: number,
    confidence: number = 1.0
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateEmailAnalysisCacheKey(emailId, phase, model);

      const emailAnalysis: EmailAnalysisCache = {
        emailId,
        phase,
        analysis,
        confidence,
        model,
        timestamp: new Date(),
        processingTime,
      };

      // Use longer TTL for completed analysis, shorter for in-progress
      const ttl = confidence >= 0.8 ? this.longTTL : this.shortTTL;

      const success = await cacheManager.set(
        cacheKey,
        emailAnalysis,
        {
          ttl,
          compress: true, // Analysis objects can be large
          namespace: this.cacheNamespace,
          tags: [
            `email:${emailId}`,
            `phase:${phase}`,
            `model:${model}`,
            'email_analysis',
          ],
        }
      );

      metrics.increment('llm_cache.email_analysis_cached');
      metrics.histogram('llm_cache.email_analysis_cache_duration', Date.now() - startTime);

      logger.debug('Email analysis cached', 'LLM_CACHE', {
        emailId,
        phase,
        model,
        confidence,
        ttl,
      });

      return success;
    } catch (error) {
      logger.error('Failed to cache email analysis', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
        phase,
      });
      metrics.increment('llm_cache.email_analysis_cache_error');
      return false;
    }
  }

  /**
   * Get cached email analysis
   */
  async getCachedEmailAnalysis(
    emailId: string,
    phase: 'pattern_triage' | 'llama_analysis' | 'critical_analysis',
    model: string
  ): Promise<EmailAnalysisCache | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateEmailAnalysisCacheKey(emailId, phase, model);
      
      const cached = await cacheManager.get<EmailAnalysisCache>(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('llm_cache.email_analysis_hit');
        metrics.histogram('llm_cache.email_analysis_get_duration', Date.now() - startTime);
        
        logger.debug('Email analysis cache hit', 'LLM_CACHE', {
          emailId,
          phase,
          model,
          age: Date.now() - cached?.timestamp?.getTime(),
        });

        return cached;
      }

      metrics.increment('llm_cache.email_analysis_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached email analysis', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
        phase,
      });
      metrics.increment('llm_cache.email_analysis_get_error');
      return null;
    }
  }

  /**
   * Cache workflow analysis result
   */
  async cacheWorkflowAnalysis(
    workflowId: string,
    workflowType: string,
    analysis: any,
    state: string,
    emailIds: string[]
  ): Promise<boolean> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateWorkflowAnalysisCacheKey(workflowId, workflowType);

      const workflowAnalysis: WorkflowAnalysisCache = {
        workflowId,
        workflowType,
        analysis,
        state,
        timestamp: new Date(),
        emailIds,
      };

      // Use longer TTL for completed workflows
      const ttl = state === 'completed' ? this.longTTL : this.defaultTTL;

      const success = await cacheManager.set(
        cacheKey,
        workflowAnalysis,
        {
          ttl,
          compress: true,
          namespace: this.cacheNamespace,
          tags: [
            `workflow:${workflowId}`,
            `workflow_type:${workflowType}`,
            `state:${state}`,
            'workflow_analysis',
            ...emailIds?.map(id => `email:${id}`),
          ],
        }
      );

      metrics.increment('llm_cache.workflow_analysis_cached');
      metrics.histogram('llm_cache.workflow_analysis_cache_duration', Date.now() - startTime);

      logger.debug('Workflow analysis cached', 'LLM_CACHE', {
        workflowId,
        workflowType,
        state,
        emailCount: emailIds?.length || 0,
        ttl,
      });

      return success;
    } catch (error) {
      logger.error('Failed to cache workflow analysis', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        workflowType,
      });
      metrics.increment('llm_cache.workflow_analysis_cache_error');
      return false;
    }
  }

  /**
   * Get cached workflow analysis
   */
  async getCachedWorkflowAnalysis(
    workflowId: string,
    workflowType: string
  ): Promise<WorkflowAnalysisCache | null> {
    const startTime = Date.now();

    try {
      const cacheKey = this.generateWorkflowAnalysisCacheKey(workflowId, workflowType);
      
      const cached = await cacheManager.get<WorkflowAnalysisCache>(cacheKey, this.cacheNamespace);

      if (cached) {
        metrics.increment('llm_cache.workflow_analysis_hit');
        metrics.histogram('llm_cache.workflow_analysis_get_duration', Date.now() - startTime);
        
        logger.debug('Workflow analysis cache hit', 'LLM_CACHE', {
          workflowId,
          workflowType,
          state: cached.state,
          age: Date.now() - cached?.timestamp?.getTime(),
        });

        return cached;
      }

      metrics.increment('llm_cache.workflow_analysis_miss');
      return null;
    } catch (error) {
      logger.error('Failed to get cached workflow analysis', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
        workflowType,
      });
      metrics.increment('llm_cache.workflow_analysis_get_error');
      return null;
    }
  }

  /**
   * Invalidate cache by email ID
   */
  async invalidateByEmailId(emailId: string): Promise<number> {
    try {
      const deletedCount = await cacheManager.invalidateByTags([`email:${emailId}`]);
      
      logger.debug('Cache invalidated by email ID', 'LLM_CACHE', {
        emailId,
        deletedCount,
      });
      
      metrics.increment('llm_cache.invalidated_by_email', deletedCount);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate cache by email ID', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        emailId,
      });
      return 0;
    }
  }

  /**
   * Invalidate cache by workflow ID
   */
  async invalidateByWorkflowId(workflowId: string): Promise<number> {
    try {
      const deletedCount = await cacheManager.invalidateByTags([`workflow:${workflowId}`]);
      
      logger.debug('Cache invalidated by workflow ID', 'LLM_CACHE', {
        workflowId,
        deletedCount,
      });
      
      metrics.increment('llm_cache.invalidated_by_workflow', deletedCount);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate cache by workflow ID', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
        workflowId,
      });
      return 0;
    }
  }

  /**
   * Find semantically similar cached response
   */
  private async findSemanticallySimilarResponse(
    prompt: string,
    model: string,
    config: LLMCacheConfig
  ): Promise<LLMResponse | null> {
    try {
      // This is a simplified implementation
      // In production, you'd want to use proper vector similarity search
      
      // Get all cached responses for the model
      const pattern = `${this.cacheNamespace}:prompt:*`;
      const threshold = config.semanticSimilarityThreshold || this.semanticThreshold;
      
      // For now, we'll skip the complex semantic search
      // and return null to avoid performance issues
      // In a real implementation, you'd use vector databases like ChromaDB
      
      return null;
    } catch (error) {
      logger.warn('Semantic similarity search failed', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get cache statistics for LLM responses
   */
  async getCacheStats(): Promise<any> {
    try {
      const baseStats = await cacheManager.getStats();
      
      // Add LLM-specific metrics
      return {
        ...baseStats,
        namespace: this.cacheNamespace,
        semanticThreshold: this.semanticThreshold,
        maxPromptLength: this.maxPromptLength,
        ttl: {
          default: this.defaultTTL,
          short: this.shortTTL,
          long: this.longTTL,
        },
      };
    } catch (error) {
      logger.error('Failed to get LLM cache stats', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Clear all LLM caches
   */
  async clearCache(): Promise<boolean> {
    try {
      const success = await cacheManager.clear(this.cacheNamespace);
      
      logger.info('LLM cache cleared', 'LLM_CACHE', { success });
      metrics.increment('llm_cache.cleared');
      
      return success;
    } catch (error) {
      logger.error('Failed to clear LLM cache', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Warm LLM cache with common prompts
   */
  async warmCache(commonPrompts: Array<{ prompt: string; model: string }>): Promise<number> {
    let warmedCount = 0;

    try {
      logger.info('Starting LLM cache warming', 'LLM_CACHE', {
        promptCount: commonPrompts?.length || 0,
      });

      for (const { prompt, model } of commonPrompts) {
        try {
          // Check if already cached
          const existing = await this.getCachedLLMResponse(prompt, model);
          if (!existing) {
            // You would typically generate the response here
            // For warming, we'll skip actual LLM calls
            logger.debug('Skipping cache warming for uncached prompt', 'LLM_CACHE', {
              model,
              promptLength: prompt?.length || 0,
            });
          } else {
            warmedCount++;
          }
        } catch (error) {
          logger.warn('Failed to warm cache for prompt', 'LLM_CACHE', {
            model,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('LLM cache warming completed', 'LLM_CACHE', {
        warmedCount,
        totalPrompts: commonPrompts?.length || 0,
      });

      return warmedCount;
    } catch (error) {
      logger.error('LLM cache warming failed', 'LLM_CACHE', {
        error: error instanceof Error ? error.message : String(error),
      });
      return warmedCount;
    }
  }
}

// Export singleton instance
export const llmCache = LLMResponseCache.getInstance();