import type { BaseTool } from "../../tools/base/BaseTool.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
  ToolExecutionParams,
} from "./AgentTypes.js";
import { logger } from "../../../utils/logger.js";
import { LLMProviderManager } from "../../llm/LLMProviderManager.js";
import type { LLMProvider } from "../../llm/LLMProviderManager.js";
import {
  MODEL_CONFIG,
  getModelConfig,
  getModelTimeout,
} from "../../../config/models.config.js";
import type { RAGSystem } from "../../rag/RAGSystem.js";
import type { QueryResult } from "../../rag/types.js";

export abstract class BaseAgent {
  protected tools: Map<string, BaseTool> = new Map();
  protected capabilities: Set<string> = new Set();
  protected initialized = false;
  protected llm: LLMProvider | null = null;
  protected timeout: number;
  protected ragSystem: RAGSystem | null = null;
  protected ragEnabled: boolean = true; // Can be overridden by subclasses

  constructor(
    public readonly name: string,
    public readonly description: string,
    protected readonly model: string = getModelConfig("primary"), // Now llama3.2:3b
  ) {
    logger.info(`Initializing agent: ${name} with model: ${model}`, "AGENT");

    // Get timeout for this model
    this.timeout = getModelTimeout("primary");

    // LLM provider will be initialized in initialize() method
  }

  abstract execute(task: string, context: AgentContext): Promise<AgentResult>;

  async executeWithTool(params: ToolExecutionParams): Promise<AgentResult> {
    const { tool, context, parameters, guidance } = params;

    try {
      if (!this.hasTool(tool.name)) {
        return {
          success: false,
          error: `Tool ${tool.name} not registered with this agent`,
        };
      }

      const result = await tool.execute(parameters);

      return {
        success: true,
        data: result,
        metadata: {
          agent: this.name,
          tool: tool.name,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
    logger.debug(`Registered tool ${tool.name} with ${this.name}`, "AGENT");
  }

  getTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  hasCapability(capability: string): boolean {
    return this.capabilities.has(capability);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug(`Agent ${this.name} already initialized`, "AGENT");
      return;
    }

    logger.info(`Initializing agent ${this.name}`, "AGENT");

    // Initialize LLM provider using singleton manager
    try {
      this.llm = new LLMProviderManager();
      await this.llm.initialize();
      logger.debug(`LLM provider initialized successfully for ${this.name}`, "AGENT", {
        isUsingFallback: (this.llm as any).isUsingFallback ? (this.llm as any).isUsingFallback() : false,
        modelInfo: this.llm.getModelInfo()
      });
    } catch (error) {
      logger.warn(
        `LLM initialization failed for ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing with fallback responses.`,
        "AGENT"
      );
      // Create a fallback LLM that provides basic responses
      this.llm = this.createFallbackLLM();
    }

    // Register default tools first
    if (typeof (this as any).registerDefaultTools === "function") {
      (this as any).registerDefaultTools();
      logger.debug(`Registered default tools for ${this.name}`, "AGENT");
    }

    // Initialize any tools (if they have initialization method)
    for (const tool of Array.from(this.tools.values())) {
      if (
        "initialize" in tool &&
        typeof (tool as any).initialize === "function"
      ) {
        await (tool as any).initialize();
      }
    }

    this.initialized = true;
    logger.info(
      `Agent ${this.name} initialized successfully with ${this.tools.size} tools`,
      "AGENT",
    );
  }

  private createFallbackLLM(): LLMProvider {
    const name = this.name;
    return {
      async generate(prompt: string, options?: any): Promise<any> {
        logger.warn(`Fallback LLM used for agent ${name}`, "AGENT");
        return {
          response: "I apologize, but I'm experiencing technical difficulties with the AI models. Please try again later or contact support.",
          model: "fallback",
          timestamp: new Date().toISOString()
        };
      },
      async initialize(): Promise<void> {
        // No-op for fallback
      },
      isReady(): boolean {
        return true; // Fallback is always ready
      },
      async cleanup(): Promise<void> {
        // No-op for fallback
      },
      getModelInfo(): {
        model: string;
        contextSize: number;
        loaded: boolean;
        processCount: number;
      } {
        return {
          model: "fallback",
          contextSize: 0,
          loaded: true,
          processCount: 0
        };
      }
    };
  }

  protected async generateLLMResponse(prompt: string, options?: any): Promise<any> {
    if (!this.llm) {
      throw new Error(`LLM not initialized for agent ${this.name}`);
    }
    
    try {
      return await this.llm.generate(prompt, options);
    } catch (error) {
      logger.error(`LLM generation failed for agent ${this.name}`, "AGENT", { error });
      throw error;
    }
  }

  protected handleError(error: Error): AgentResult {
    logger.error(`Error in agent ${this.name}: ${error.message}`, "AGENT", {
      error,
    });

    return {
      success: false,
      error: error.message,
      metadata: {
        agent: this.name,
        timestamp: new Date().toISOString(),
        errorType: error.name || "UnknownError",
      },
    };
  }

  protected addCapability(capability: string): void {
    this.capabilities.add(capability);
  }

  /**
   * Set the RAG system for this agent
   * Called by MasterOrchestrator during agent initialization
   */
  setRAGSystem(ragSystem: RAGSystem): void {
    if (!this.ragEnabled) {
      logger.debug(`RAG system disabled for agent ${this.name}`, "AGENT");
      return;
    }
    
    this.ragSystem = ragSystem;
    logger.info(`RAG system integrated with agent ${this.name}`, "AGENT");
  }

  /**
   * Query the RAG system for relevant context
   * @param query The query to search for
   * @param options Search options
   * @returns Relevant context from RAG system
   */
  protected async queryRAG(
    query: string,
    options: {
      limit?: number;
      filter?: Record<string, any>;
      includeMetadata?: boolean;
      formatForLLM?: boolean;
    } = {}
  ): Promise<string> {
    if (!this.ragSystem || !this.ragEnabled) {
      logger.debug(`RAG system not available for agent ${this.name}`, "AGENT");
      return "";
    }

    try {
      const context = await this.ragSystem.getContextForPrompt(query, {
        limit: options.limit || 5,
        filter: {
          ...options.filter,
          // Add agent-specific filter to get relevant knowledge for this agent type
          agentType: this.name,
        },
        includeMetadata: options.includeMetadata !== false,
        formatForLLM: options.formatForLLM !== false,
      });

      if (context) {
        logger.debug(
          `Retrieved RAG context for agent ${this.name}: ${context.length} characters`,
          "AGENT"
        );
      }

      return context;
    } catch (error) {
      logger.error(
        `Failed to query RAG system for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "AGENT"
      );
      return "";
    }
  }

  /**
   * Search RAG system for specific documents
   * @param query Search query
   * @param limit Number of results
   * @returns Array of search results
   */
  protected async searchRAG(
    query: string,
    limit: number = 5
  ): Promise<QueryResult[]> {
    if (!this.ragSystem || !this.ragEnabled) {
      return [];
    }

    try {
      return await this.ragSystem.search(query, limit);
    } catch (error) {
      logger.error(
        `RAG search failed for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "AGENT"
      );
      return [];
    }
  }

  /**
   * Index knowledge specific to this agent in the RAG system
   * @param documents Documents to index
   */
  protected async indexAgentKnowledge(
    documents: Array<{ content: string; metadata?: Record<string, any> }>
  ): Promise<void> {
    if (!this.ragSystem || !this.ragEnabled) {
      return;
    }

    try {
      await this.ragSystem.indexAgentKnowledge(this.name, documents);
      logger.info(
        `Indexed ${documents.length} documents for agent ${this.name}`,
        "AGENT"
      );
    } catch (error) {
      logger.error(
        `Failed to index knowledge for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        "AGENT"
      );
    }
  }

  /**
   * Generate LLM response with RAG context enhancement
   * @param prompt The prompt to send to LLM
   * @param options Generation options
   * @returns LLM response with optional RAG enhancement
   */
  protected async generateLLMResponseWithRAG(
    prompt: string,
    options?: {
      useRAG?: boolean;
      ragQuery?: string;
      ragLimit?: number;
      includeContext?: boolean;
      [key: string]: any;
    }
  ): Promise<{ response: string; context?: string; [key: string]: any }> {
    const useRAG = options?.useRAG !== false && this.ragEnabled && this.ragSystem;
    let ragContext = "";

    if (useRAG) {
      // Use custom RAG query or extract from prompt
      const ragQuery = options?.ragQuery || prompt;
      ragContext = await this.queryRAG(ragQuery, { limit: options?.ragLimit || 5 });
    }

    // Enhance prompt with RAG context if available
    let enhancedPrompt = prompt;
    if (ragContext) {
      enhancedPrompt = `${ragContext}\n\n## Query\n${prompt}`;
      logger.debug(`Enhanced prompt with RAG context for agent ${this.name}`, "AGENT");
    }

    // Generate response using base method
    const response = await this.generateLLMResponse(enhancedPrompt, options);

    // Include context in response if requested
    if (options?.includeContext && ragContext) {
      return {
        ...response,
        context: ragContext,
      };
    }

    return response;
  }
}
