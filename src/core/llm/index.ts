/**
 * Central LLM module exports
 * Provides singleton cached LLM provider for the entire application
 */

import { CachedLLMProvider } from './CachedLLMProvider.js';
import { LLMProviderManager } from './LLMProviderManager.js';
import { logger } from '../../utils/logger.js';

// Singleton instance of CachedLLMProvider
let cachedProviderInstance: CachedLLMProvider | null = null;

/**
 * Get the singleton CachedLLMProvider instance
 * This ensures all agents share the same cache for better performance
 */
export function getCachedLLMProvider(): CachedLLMProvider {
  if (!cachedProviderInstance) {
    cachedProviderInstance = new CachedLLMProvider();
    logger.info('Created singleton CachedLLMProvider instance', 'LLM');
    
    // Warmup cache with common prompts in the background
    cachedProviderInstance.warmupCache([
      { prompt: 'You are a helpful assistant. Respond with: "Ready to help!"' },
      { prompt: 'Analyze the following task and provide a brief response: test' },
      { prompt: 'Create a simple plan for: test task' }
    ]).catch(err => {
      logger.warn('Cache warmup failed', 'LLM', { error: err.message });
    });
  }
  
  return cachedProviderInstance;
}

/**
 * Get regular LLMProviderManager (without caching)
 * Use this for one-off or unique prompts where caching doesn't make sense
 */
export function getLLMProvider(): LLMProviderManager {
  return new LLMProviderManager();
}

// Export types and classes
export { CachedLLMProvider } from './CachedLLMProvider.js';
export { LLMProviderManager } from './LLMProviderManager.js';
export type { LLMProvider } from './LLMProviderManager.js';
export { SimpleLLMProvider } from './SimpleLLMProvider.js';
export { HttpLlamaProvider } from './HttpLlamaProvider.js';
export type { LlamaCppResponse, LlamaCppGenerateOptions } from './SafeLlamaCppProvider.js';