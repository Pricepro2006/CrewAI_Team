import { EventEmitter } from 'events';
import { OllamaProvider } from './OllamaProvider.js';
import { LlamaCppProvider } from './LlamaCppProvider.js';
import { KnowledgeBackedLLM } from './KnowledgeBackedLLM.js';
import { RAGSystem } from '../rag/RAGSystem.js';
import { logger } from '../../utils/logger.js';

export interface LLMProviderInterface {
  generate(prompt: string, options?: any): Promise<{ response: string; [key: string]: any }>;
  initialize(): Promise<void>;
  isReady?(): boolean;
}

export interface LLMProviderConfig {
  type: 'ollama' | 'llamacpp' | 'knowledge-backed' | 'auto';
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
  knowledgeBacked?: {
    modelPath: string;
    fallbackModelPath?: string;
    contextSize?: number;
    threads?: number;
    temperature?: number;
    gpuLayers?: number;
    ragEnabled?: boolean;
  };
  ragSystem?: RAGSystem;
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
      
      case 'knowledge-backed':
        provider = await LLMProviderFactory.createKnowledgeBackedProvider(config.knowledgeBacked!, config.ragSystem);
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
   * Create Knowledge-Backed LLM provider
   */
  private static async createKnowledgeBackedProvider(
    config: NonNullable<LLMProviderConfig['knowledgeBacked']>,
    ragSystem?: RAGSystem
  ): Promise<KnowledgeBackedLLM> {
    logger.info('Creating Knowledge-Backed LLM provider', 'LLM_FACTORY', {
      modelPath: config.modelPath,
      ragEnabled: config.ragEnabled !== false,
    });

    const provider = new KnowledgeBackedLLM(
      {
        modelPath: config.modelPath,
        fallbackModelPath: config.fallbackModelPath,
        contextSize: config.contextSize || 8192,
        threads: config.threads || 8,
        temperature: config.temperature || 0.7,
        gpuLayers: config.gpuLayers || 0,
        ragConfig: {
          enabled: config.ragEnabled !== false,
          topK: 5,
          minScore: 0.5,
          maxContextDocs: 3,
        },
      },
      ragSystem
    );

    try {
      await provider.initialize();
      logger.info('Knowledge-Backed LLM provider initialized successfully', 'LLM_FACTORY');
      return provider;
    } catch (error) {
      logger.error('Failed to initialize Knowledge-Backed LLM provider', 'LLM_FACTORY', { error });
      throw error;
    }
  }

  /**
   * Auto-select the best available provider
   */
  private static async autoSelectProvider(config: LLMProviderConfig): Promise<LLMProviderInterface> {
    logger.info('Auto-selecting LLM provider', 'LLM_FACTORY');

    // Try Knowledge-Backed LLM first if configured
    if (config.knowledgeBacked?.modelPath) {
      try {
        const provider = await LLMProviderFactory.createKnowledgeBackedProvider(
          config.knowledgeBacked,
          config.ragSystem
        );
        logger.info('Auto-selected Knowledge-Backed LLM provider', 'LLM_FACTORY');
        return provider;
      } catch (error) {
        logger.warn('Knowledge-Backed LLM provider failed, trying alternatives', 'LLM_FACTORY', {
          error: error.message,
        });
      }
    }

    // Try Llama.cpp if configured
    if (config.llamacpp?.modelPath) {
      try {
        const provider = await LLMProviderFactory.createLlamaCppProvider(config.llamacpp);
        logger.info('Auto-selected Llama.cpp provider', 'LLM_FACTORY');
        return provider;
      } catch (error) {
        logger.warn('Llama.cpp provider failed, trying Ollama as fallback', 'LLM_FACTORY', { error: error.message });
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
    const mistralModelPath = process.env.MISTRAL_MODEL_PATH || '/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf';
    const llamaModelPath = process.env.LLAMA_MODEL_PATH || '/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf';
    const llamaCppPath = process.env.LLAMA_CPP_PATH || '/usr/local/bin/llama-cli';
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const ollamaModel = process.env.OLLAMA_MODEL_MAIN || 'qwen3:14b';

    return {
      type: 'auto',
      knowledgeBacked: {
        modelPath: mistralModelPath,
        fallbackModelPath: llamaModelPath,
        contextSize: parseInt(process.env.LLM_CONTEXT_SIZE || '8192'),
        threads: parseInt(process.env.LLM_THREADS || '8'),
        temperature: 0.7,
        gpuLayers: parseInt(process.env.LLM_GPU_LAYERS || '0'),
        ragEnabled: process.env.ENABLE_RAG !== 'false',
      },
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