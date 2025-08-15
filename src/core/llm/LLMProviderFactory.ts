import { EventEmitter } from 'events';
import { OllamaProvider } from './OllamaProvider.js';
import { LlamaCppProvider } from './LlamaCppProvider.js';
import { logger } from '../../utils/logger.js';

export interface LLMProviderInterface {
  generate(prompt: string, options?: any): Promise<{ response: string; [key: string]: any }>;
  initialize(): Promise<void>;
  isReady?(): boolean;
}

export interface LLMProviderConfig {
  type: 'ollama' | 'llamacpp' | 'auto';
  ollama?: {
    baseUrl: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  llamacpp?: {
    modelPath: string;
    contextSize?: number;
    threads?: number;
    temperature?: number;
    gpuLayers?: number;
  };
}

export class LLMProviderFactory {
  private static instance: LLMProviderInterface | null = null;
  private static config: LLMProviderConfig | null = null;

  /**
   * Create and initialize an LLM provider based on configuration
   */
  static async createProvider(config: LLMProviderConfig): Promise<LLMProviderInterface> {
    if (LLMProviderFactory.instance && LLMProviderFactory.config?.type === config.type) {
      return LLMProviderFactory.instance;
    }

    LLMProviderFactory.config = config;
    let provider: LLMProviderInterface;

    switch (config.type) {
      case 'ollama':
        provider = await LLMProviderFactory.createOllamaProvider(config.ollama!);
        break;
      
      case 'llamacpp':
        provider = await LLMProviderFactory.createLlamaCppProvider(config.llamacpp!);
        break;
      
      case 'auto':
        provider = await LLMProviderFactory.autoSelectProvider(config);
        break;
      
      default:
        throw new Error(`Unsupported LLM provider type: ${config.type}`);
    }

    LLMProviderFactory.instance = provider;
    return provider;
  }

  /**
   * Get the current provider instance
   */
  static getInstance(): LLMProviderInterface | null {
    return LLMProviderFactory.instance;
  }

  /**
   * Create Ollama provider
   */
  private static async createOllamaProvider(config: NonNullable<LLMProviderConfig['ollama']>): Promise<OllamaProvider> {
    logger.info('Creating Ollama provider', 'LLM_FACTORY', { model: config.model });
    
    const provider = new OllamaProvider({
      baseUrl: config.baseUrl,
      model: config.model,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 4096,
    });

    try {
      await provider.initialize();
      logger.info('Ollama provider initialized successfully', 'LLM_FACTORY');
      return provider;
    } catch (error) {
      logger.error('Failed to initialize Ollama provider', 'LLM_FACTORY', { error });
      throw error;
    }
  }

  /**
   * Create Llama.cpp provider
   */
  private static async createLlamaCppProvider(config: NonNullable<LLMProviderConfig['llamacpp']>): Promise<LlamaCppProvider> {
    logger.info('Creating Llama.cpp provider', 'LLM_FACTORY', { modelPath: config.modelPath });
    
    const provider = new LlamaCppProvider({
      modelPath: config.modelPath,
      contextSize: config.contextSize || 8192,
      threads: config.threads || 8,
      temperature: config.temperature || 0.7,
      gpuLayers: config.gpuLayers || 0,
    });

    try {
      // LlamaCppProvider initializes lazily, but we can check if model exists
      if (!provider.isReady()) {
        logger.info('Llama.cpp provider created, model will load on first use', 'LLM_FACTORY');
      }
      return provider;
    } catch (error) {
      logger.error('Failed to create Llama.cpp provider', 'LLM_FACTORY', { error });
      throw error;
    }
  }

  /**
   * Auto-select the best available provider
   */
  private static async autoSelectProvider(config: LLMProviderConfig): Promise<LLMProviderInterface> {
    logger.info('Auto-selecting LLM provider', 'LLM_FACTORY');

    // Try Llama.cpp first if configured
    if (config.llamacpp?.modelPath) {
      try {
        const provider = await LLMProviderFactory.createLlamaCppProvider(config.llamacpp);
        logger.info('Auto-selected Llama.cpp provider', 'LLM_FACTORY');
        return provider;
      } catch (error) {
        logger.warn('Llama.cpp provider failed, trying Ollama', 'LLM_FACTORY', { error: error.message });
      }
    }

    // Fallback to Ollama if available
    if (config.ollama?.baseUrl && config.ollama?.model) {
      try {
        const provider = await LLMProviderFactory.createOllamaProvider(config.ollama);
        logger.info('Auto-selected Ollama provider', 'LLM_FACTORY');
        return provider;
      } catch (error) {
        logger.error('Ollama provider also failed', 'LLM_FACTORY', { error: error.message });
        throw new Error('No LLM providers are available');
      }
    }

    throw new Error('No LLM provider configurations available');
  }

  /**
   * Get default configuration based on environment
   */
  static getDefaultConfig(): LLMProviderConfig {
    const llamaModelPath = process.env.LLAMA_MODEL_PATH || './models/Llama-3.2-3B-Instruct-Q4_K_M.gguf';
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL_MAIN || 'qwen3:14b';

    return {
      type: 'auto',
      llamacpp: {
        modelPath: llamaModelPath,
        contextSize: 8192,
        threads: parseInt(process.env.LLAMA_THREADS || '8'),
        temperature: 0.7,
        gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || '0'),
      },
      ollama: {
        baseUrl: ollamaUrl,
        model: ollamaModel,
        temperature: 0.7,
        maxTokens: 4096,
      },
    };
  }

  /**
   * Reset the factory instance
   */
  static reset(): void {
    LLMProviderFactory.instance = null;
    LLMProviderFactory.config = null;
  }
}

export default LLMProviderFactory;