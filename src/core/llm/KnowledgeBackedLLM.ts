/**
 * KnowledgeBackedLLM - RAG-enhanced LLM provider using node-llama-cpp
 * Integrates with ChromaDB for context-aware responses
 */

import {
  getLlama,
  LlamaChatSession,
  LlamaContext,
  LlamaModel,
  type Llama,
  type LlamaJsonSchema,
  type ChatHistoryItem
} from "node-llama-cpp";
import * as path from "path";
import * as fs from "fs";
import { RAGSystem } from "../rag/RAGSystem.js";
import { logger } from "../../utils/logger.js";
import { performanceMonitor } from "../../monitoring/PerformanceMonitor.js";
import { metricsCollector } from "../../monitoring/MetricsCollector.js";
import { errorTracker } from "../../monitoring/ErrorTracker.js";
import type { QueryResult } from "../rag/types.js";

export interface KnowledgeBackedConfig {
  modelPath: string;
  fallbackModelPath?: string;
  contextSize?: number;
  gpuLayers?: number;
  threads?: number;
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  seed?: number;
  ragConfig?: {
    enabled: boolean;
    topK?: number;
    minScore?: number;
    maxContextDocs?: number;
  };
}

export interface GenerateWithContextOptions {
  temperature?: number;
  maxTokens?: number;
  topK?: number;
  topP?: number;
  systemPrompt?: string;
  useRAG?: boolean;
  format?: "text" | "json";
  jsonSchema?: LlamaJsonSchema;
}

export class KnowledgeBackedLLM {
  private llama: Llama | null = null;
  private model: LlamaModel | null = null;
  private context: LlamaContext | null = null;
  private session: LlamaChatSession | null = null;
  private ragSystem: RAGSystem | null = null;
  private config: KnowledgeBackedConfig;
  private isInitialized: boolean = false;
  private currentModelPath: string;

  constructor(config: KnowledgeBackedConfig, ragSystem?: RAGSystem) {
    this.config = {
      contextSize: 8192,
      gpuLayers: 0,
      threads: 8,
      temperature: 0.7,
      maxTokens: 2048,
      topK: 40,
      topP: 0.95,
      ragConfig: {
        enabled: true,
        topK: 5,
        minScore: 0.5,
        maxContextDocs: 3,
      },
      ...config,
    };
    this.currentModelPath = config.modelPath;
    this.ragSystem = ragSystem || null;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this?.config?.modelPath) {
      throw new Error("Model path is required");
    }

    // Check if primary model exists
    if (!fs.existsSync(this?.config?.modelPath)) {
      // Try fallback model if configured
      if (this?.config?.fallbackModelPath && fs.existsSync(this?.config?.fallbackModelPath)) {
        logger.warn(
          `Primary model not found at ${this?.config?.modelPath}, using fallback at ${this?.config?.fallbackModelPath}`,
          "KNOWLEDGE_LLM"
        );
        this.currentModelPath = this?.config?.fallbackModelPath;
      } else {
        throw new Error(`Model file not found: ${this?.config?.modelPath}`);
      }
    }
  }

  /**
   * Initialize the LLM with node-llama-cpp
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const startTime = Date.now();
    try {
      logger.info("Initializing KnowledgeBackedLLM...", "KNOWLEDGE_LLM", {
        model: path.basename(this.currentModelPath),
        contextSize: this?.config?.contextSize,
        gpuLayers: this?.config?.gpuLayers,
      });

      // Get llama instance
      this.llama = await getLlama({
        gpu: this?.config?.gpuLayers && this?.config?.gpuLayers > 0 ? "cuda" : false,
      });

      // Load model
      this.model = await this?.llama?.loadModel({
        modelPath: this.currentModelPath,
      });

      // Create context
      this.context = await this?.model?.createContext({
        contextSize: this?.config?.contextSize,
        threads: this?.config?.threads,
        batchSize: 512,
      });

      // Create chat session with system prompt
      this.session = new LlamaChatSession({
        contextSequence: this?.context?.getSequence(),
        systemPrompt: "You are a helpful AI assistant with access to a knowledge base. Provide accurate, detailed responses based on the context provided.",
      });

      // Initialize RAG system if provided
      if (this.ragSystem) {
        await this?.ragSystem?.initialize();
        logger.info("RAG system initialized for context-aware responses", "KNOWLEDGE_LLM");
      }

      this.isInitialized = true;
      const duration = Date.now() - startTime;
      logger.info(`KnowledgeBackedLLM initialized in ${duration}ms`, "KNOWLEDGE_LLM");
      performanceMonitor.recordMetric("llm_initialization_time", duration);
    } catch (error) {
      errorTracker.captureError(error as Error, {
        context: "knowledge_llm_initialization",
        modelPath: this.currentModelPath,
      });
      throw error;
    }
  }

  /**
   * Generate response with optional RAG context
   */
  async generateWithContext(
    prompt: string,
    options: GenerateWithContextOptions = {}
  ): Promise<{ response: string; context?: QueryResult[]; metadata?: any }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    metricsCollector.increment("knowledge_llm?.requests?.total");

    try {
      let augmentedPrompt = prompt;
      let retrievedContext: QueryResult[] | undefined;

      // Retrieve context from RAG if enabled
      if (options.useRAG !== false && this.ragSystem && this?.config?.ragConfig?.enabled) {
        retrievedContext = await this.retrieveContext(prompt);
        if (retrievedContext && retrievedContext?.length || 0 > 0) {
          augmentedPrompt = this.buildAugmentedPrompt(prompt, retrievedContext);
          logger.debug(
            `Retrieved ${retrievedContext?.length || 0} context documents`,
            "KNOWLEDGE_LLM"
          );
        }
      }

      // Generate response
      const response = await this.generate(augmentedPrompt, options);

      // Track metrics
      const duration = Date.now() - startTime;
      performanceMonitor.recordMetric("knowledge_llm_generation_time", duration);
      metricsCollector.recordHistogram("knowledge_llm?.generation?.duration", duration);

      return {
        response,
        context: retrievedContext,
        metadata: {
          model: path.basename(this.currentModelPath),
          contextUsed: retrievedContext ? retrievedContext?.length || 0 : 0,
          generationTime: duration,
        },
      };
    } catch (error) {
      metricsCollector.increment("knowledge_llm?.requests?.failed");
      errorTracker.captureError(error as Error, {
        context: "knowledge_llm_generation",
        prompt: prompt.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Retrieve relevant context from RAG system
   */
  private async retrieveContext(query: string): Promise<QueryResult[]> {
    if (!this.ragSystem) return [];

    try {
      const results = await this?.ragSystem?.query(query, {
        topK: this?.config?.ragConfig?.topK || 5,
        minScore: this?.config?.ragConfig?.minScore || 0.5,
      });

      // Filter and limit results
      const maxDocs = this?.config?.ragConfig?.maxContextDocs || 3;
      return results.slice(0, maxDocs);
    } catch (error) {
      logger.error(
        `Failed to retrieve context: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_LLM"
      );
      return [];
    }
  }

  /**
   * Build augmented prompt with context
   */
  private buildAugmentedPrompt(query: string, context: QueryResult[]): string {
    const contextText = context
      .map((doc, idx) => {
        const metadata = doc.metadata
          ? Object.entries(doc.metadata)
              .map(([key, value]) => `${key}: ${value}`)
              .join(", ")
          : "";
        return `[Document ${idx + 1}${metadata ? ` - ${metadata}` : ""}]\n${doc.text}`;
      })
      .join("\n\n");

    return `Context Information:
${contextText}

Based on the above context, please answer the following question:
${query}

Please provide a comprehensive and accurate response based on the context provided. If the context doesn't contain enough information to fully answer the question, acknowledge what you can answer and what requires additional information.`;
  }

  /**
   * Core generation method
   */
  private async generate(
    prompt: string,
    options: GenerateWithContextOptions
  ): Promise<string> {
    if (!this.session || !this.context) {
      throw new Error("LLM not initialized");
    }

    try {
      // Update session with system prompt if provided
      if (options.systemPrompt) {
        // Create new session with custom system prompt
        this.session = new LlamaChatSession({
          contextSequence: this?.context?.getSequence(),
          systemPrompt: options.systemPrompt,
        });
      }

      // Set generation parameters
      const generationConfig = {
        temperature: options.temperature ?? this?.config?.temperature,
        maxTokens: options.maxTokens ?? this?.config?.maxTokens,
        topK: options.topK ?? this?.config?.topK,
        topP: options.topP ?? this?.config?.topP,
      };

      // Generate response based on format
      let response: string;
      if (options.format === "json" && options.jsonSchema) {
        // Generate structured JSON response
        const jsonResponse = await this?.session?.prompt(prompt, {
          ...generationConfig,
          responseFormat: {
            type: "json",
            schema: options.jsonSchema,
          },
        });
        response = JSON.stringify(jsonResponse);
      } else {
        // Generate text response
        response = await this?.session?.prompt(prompt, generationConfig);
      }

      return response;
    } catch (error) {
      logger.error(
        `Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_LLM"
      );
      throw error;
    }
  }

  /**
   * Stream generation with context
   */
  async *streamGenerateWithContext(
    prompt: string,
    options: GenerateWithContextOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      let augmentedPrompt = prompt;
      
      // Retrieve context if enabled
      if (options.useRAG !== false && this.ragSystem && this?.config?.ragConfig?.enabled) {
        const context = await this.retrieveContext(prompt);
        if (context && context?.length || 0 > 0) {
          augmentedPrompt = this.buildAugmentedPrompt(prompt, context);
        }
      }

      // Stream the response
      yield* this.streamGenerate(augmentedPrompt, options);
    } catch (error) {
      errorTracker.captureError(error as Error, {
        context: "knowledge_llm_stream",
        prompt: prompt.substring(0, 100),
      });
      throw error;
    }
  }

  /**
   * Stream generation implementation
   */
  private async *streamGenerate(
    prompt: string,
    options: GenerateWithContextOptions
  ): AsyncGenerator<string, void, unknown> {
    if (!this.session || !this.context) {
      throw new Error("LLM not initialized");
    }

    const generationConfig = {
      temperature: options.temperature ?? this?.config?.temperature,
      maxTokens: options.maxTokens ?? this?.config?.maxTokens,
      topK: options.topK ?? this?.config?.topK,
      topP: options.topP ?? this?.config?.topP,
      onToken: (tokens: number[]) => {
        // Token callback for streaming
        return tokens;
      },
    };

    try {
      // Create an async iterator for the response
      const responseGenerator = this?.session?.promptWithMeta(prompt, {
        ...generationConfig,
      });

      // Stream tokens as they are generated
      for await (const part of responseGenerator) {
        if (part.response) {
          yield part.response;
        }
      }
    } catch (error) {
      logger.error(
        `Stream generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_LLM"
      );
      throw error;
    }
  }

  /**
   * Add document to knowledge base
   */
  async addToKnowledgeBase(
    content: string,
    metadata: Record<string, any>
  ): Promise<void> {
    if (!this.ragSystem) {
      logger.warn("RAG system not configured, cannot add to knowledge base", "KNOWLEDGE_LLM");
      return;
    }

    try {
      await this?.ragSystem?.addDocument(content, metadata);
      logger.info("Document added to knowledge base", "KNOWLEDGE_LLM", {
        sourceId: metadata.id || "unknown",
      });
    } catch (error) {
      logger.error(
        `Failed to add document to knowledge base: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_LLM"
      );
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    if (this.session && this.context) {
      // Create new session to clear history
      this.session = new LlamaChatSession({
        contextSequence: this?.context?.getSequence(),
        systemPrompt: "You are a helpful AI assistant with access to a knowledge base. Provide accurate, detailed responses based on the context provided.",
      });
    }
  }

  /**
   * Get model information
   */
  getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    ragEnabled: boolean;
  } {
    return {
      model: path.basename(this.currentModelPath),
      contextSize: this?.config?.contextSize || 8192,
      loaded: this.isInitialized,
      ragEnabled: this.ragSystem !== null && (this?.config?.ragConfig?.enabled ?? true),
    };
  }

  /**
   * Check if ready
   */
  isReady(): boolean {
    return this.isInitialized && this.model !== null && this.context !== null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.session) {
        this.session = null;
      }
      if (this.context) {
        await this?.context?.dispose();
        this.context = null;
      }
      if (this.model) {
        await this?.model?.dispose();
        this.model = null;
      }
      this.isInitialized = false;
      logger.info("KnowledgeBackedLLM cleaned up", "KNOWLEDGE_LLM");
    } catch (error) {
      logger.error(
        `Cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        "KNOWLEDGE_LLM"
      );
    }
  }
}

// Export factory function for easy creation
export async function createKnowledgeBackedLLM(
  config?: Partial<KnowledgeBackedConfig>,
  ragSystem?: RAGSystem
): Promise<KnowledgeBackedLLM> {
  const defaultConfig: KnowledgeBackedConfig = {
    modelPath: process.env.MISTRAL_MODEL_PATH || "/home/pricepro2006/CrewAI_Team/models/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
    fallbackModelPath: process.env.LLAMA_MODEL_PATH || "/home/pricepro2006/CrewAI_Team/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    contextSize: parseInt(process.env.LLM_CONTEXT_SIZE || "8192"),
    gpuLayers: parseInt(process.env.LLM_GPU_LAYERS || "0"),
    threads: parseInt(process.env.LLM_THREADS || "8"),
    temperature: 0.7,
    ragConfig: {
      enabled: process.env.ENABLE_RAG !== "false",
      topK: 5,
      minScore: 0.5,
      maxContextDocs: 3,
    },
  };

  const mergedConfig = { ...defaultConfig, ...config };
  const llm = new KnowledgeBackedLLM(mergedConfig, ragSystem);
  await llm.initialize();
  return llm;
}

export default KnowledgeBackedLLM;