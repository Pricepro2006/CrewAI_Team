/**
 * LLMProviderManager - Manages LLM providers with automatic fallback
 */

import { SafeLlamaCppProvider, LlamaCppResponse, LlamaCppGenerateOptions } from "./SafeLlamaCppProvider.js";
import { SimpleLLMProvider } from "./SimpleLLMProvider.js";
import { HttpLlamaProvider } from "./HttpLlamaProvider.js";
import type { LlamaCppRequestContext } from "./LlamaCppHttpProvider.js";
import { logger } from "../../utils/logger.js";

export interface LLMProvider {
  generate(prompt: string, options?: LlamaCppGenerateOptions & { context?: LlamaCppRequestContext }): Promise<LlamaCppResponse>;
  initialize(): Promise<void>;
  isReady(): boolean;
  cleanup(): Promise<void>;
  getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    processCount: number;
  };
}

export class LLMProviderManager implements LLMProvider {
  private primaryProvider: HttpLlamaProvider | SafeLlamaCppProvider | null = null;
  private fallbackProvider: SimpleLLMProvider;
  private useFallback: boolean = false;
  private initializationAttempted: boolean = false;

  constructor() {
    this.fallbackProvider = new SimpleLLMProvider();
  }

  /**
   * Initialize the LLM provider
   */
  public async initialize(): Promise<void> {
    if (this.initializationAttempted) {
      return;
    }

    this.initializationAttempted = true;

    try {
      // First try HTTP connection to running llama-server (port 8081 to avoid WebSocket conflict on 8080)
      const llamaServerUrl = process.env.LLAMA_SERVER_URL || "http://localhost:8081";
      this.primaryProvider = new HttpLlamaProvider(llamaServerUrl);
      
      try {
        await this.primaryProvider.initialize();
        logger.info("Primary LLM provider (llama-server) initialized successfully", "LLM_MANAGER");
        this.useFallback = false;
        return; // Success, exit early
      } catch (httpError) {
        logger.warn("llama-server not available on port 8081, trying direct llama.cpp", "LLM_MANAGER");
        this.primaryProvider = null;
      }
      
      // Fallback to direct llama.cpp if HTTP fails
      const modelPath = process.env.LLAMA_MODEL_PATH || "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf";
      
      this.primaryProvider = new SafeLlamaCppProvider({
        modelPath: modelPath,
        contextSize: 8192,
        threads: 4,
        temperature: 0.7,
        maxTokens: 2048,
        gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0"),
        maxProcesses: 2,
        maxMemoryMB: 8192,
        processTimeout: 60000,
        allowedModelPaths: [
          "./models",
          "/home/pricepro2006/CrewAI_Team/models",
        ],
      });

      await this.primaryProvider.initialize();
      
      logger.info("Primary LLM provider (llama.cpp) initialized successfully", "LLM_MANAGER");
      this.useFallback = false;
      
    } catch (error) {
      logger.warn("Failed to initialize llama.cpp, using fallback provider", "LLM_MANAGER", { error });
      this.useFallback = true;
      await this.fallbackProvider.initialize();
    }
  }

  /**
   * Generate text using the active provider
   */
  public async generate(
    prompt: string,
    options: LlamaCppGenerateOptions & { context?: LlamaCppRequestContext } = {}
  ): Promise<LlamaCppResponse> {
    // Ensure initialization
    if (!this.initializationAttempted) {
      await this.initialize();
    }

    const activeProvider = this.useFallback ? this.fallbackProvider : this.primaryProvider;
    
    if (!activeProvider) {
      // If no provider is available, use fallback
      this.useFallback = true;
      return this.fallbackProvider.generate(prompt, options);
    }

    try {
      // Try to generate with the active provider
      const response = await activeProvider.generate(prompt, options);
      
      // If using primary and it succeeds, ensure we're not in fallback mode
      if (activeProvider === this.primaryProvider) {
        this.useFallback = false;
      }
      
      return response as LlamaCppResponse;
      
    } catch (error) {
      logger.error("Generation failed, attempting with fallback", "LLM_MANAGER", { error });
      
      // If primary failed, switch to fallback
      if (activeProvider === this.primaryProvider) {
        this.useFallback = true;
        return this.fallbackProvider.generate(prompt, options);
      }
      
      // If even fallback failed, throw the error
      throw error;
    }
  }

  /**
   * Check if the provider is ready
   */
  public isReady(): boolean {
    if (this.useFallback) {
      return this.fallbackProvider.isReady();
    }
    return this.primaryProvider?.isReady() || false;
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.primaryProvider) {
      await this.primaryProvider.cleanup();
    }
    await this.fallbackProvider.cleanup();
  }

  /**
   * Get model information
   */
  public getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    processCount: number;
  } {
    const activeProvider = this.useFallback ? this.fallbackProvider : this.primaryProvider;
    
    if (!activeProvider) {
      return this.fallbackProvider.getModelInfo();
    }
    
    const info = activeProvider.getModelInfo();
    
    return {
      ...info,
      model: this.useFallback ? `${info.model} (fallback)` : info.model,
    };
  }

  /**
   * Check if using fallback provider
   */
  public isUsingFallback(): boolean {
    return this.useFallback;
  }

  /**
   * Force switch to fallback provider
   */
  public switchToFallback(): void {
    this.useFallback = true;
    logger.info("Manually switched to fallback LLM provider", "LLM_MANAGER");
  }

  /**
   * Attempt to switch back to primary provider
   */
  public async switchToPrimary(): Promise<boolean> {
    if (!this.primaryProvider) {
      try {
        await this.initialize();
      } catch (error) {
        logger.error("Failed to initialize primary provider", "LLM_MANAGER", { error });
        return false;
      }
    }

    if (this.primaryProvider && this.primaryProvider.isReady()) {
      this.useFallback = false;
      logger.info("Switched back to primary LLM provider", "LLM_MANAGER");
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const llmProviderManager = new LLMProviderManager();

export default LLMProviderManager;