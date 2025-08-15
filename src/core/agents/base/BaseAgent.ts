import type { BaseTool } from "../../tools/base/BaseTool.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
  ToolExecutionParams,
} from "./AgentTypes.js";
import { logger } from "../../utils/logger.js";
import { LLMProviderFactory, LLMProviderInterface } from "../../llm/LLMProviderFactory.js";
import {
  MODEL_CONFIG,
  getModelConfig,
  getModelTimeout,
} from "../../../config/models?.config.js";

export abstract class BaseAgent {
  protected tools: Map<string, BaseTool> = new Map();
  protected capabilities: Set<string> = new Set();
  protected initialized = false;
  protected llm: LLMProviderInterface;
  protected timeout: number;

  constructor(
    public readonly name: string,
    public readonly description: string,
    protected readonly model: string = getModelConfig("primary"), // Now llama3.2:3b
  ) {
    logger.info(`Initializing agent: ${name} with model: ${model}`, "AGENT");

    // Get timeout for this model
    this.timeout = getModelTimeout("primary");

    // Initialize LLM provider using factory for standardization
    this.llm = null as any; // Will be initialized in initialize() method
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
    this?.tools?.set(tool.name, tool);
    logger.debug(`Registered tool ${tool.name} with ${this.name}`, "AGENT");
  }

  getTools(): BaseTool[] {
    return Array.from(this?.tools?.values());
  }

  getTool(name: string): BaseTool | undefined {
    return this?.tools?.get(name);
  }

  hasTool(name: string): boolean {
    return this?.tools?.has(name);
  }

  hasCapability(capability: string): boolean {
    return this?.capabilities?.has(capability);
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.debug(`Agent ${this.name} already initialized`, "AGENT");
      return;
    }

    logger.info(`Initializing agent ${this.name}`, "AGENT");

    // Initialize LLM provider using factory
    try {
      const llmConfig = LLMProviderFactory.getDefaultConfig();
      this.llm = await LLMProviderFactory.createProvider(llmConfig);
      logger.debug(`LLM provider initialized successfully for ${this.name}`, "AGENT");
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
    for (const tool of this?.tools?.values()) {
      if (
        "initialize" in tool &&
        typeof (tool as any).initialize === "function"
      ) {
        await (tool as any).initialize();
      }
    }

    this.initialized = true;
    logger.info(
      `Agent ${this.name} initialized successfully with ${this?.tools?.size} tools`,
      "AGENT",
    );
  }

  private createFallbackLLM(): LLMProviderInterface {
    return {
      async generate(prompt: string, options?: any): Promise<{ response: string; [key: string]: any }> {
        logger.warn(`Fallback LLM used for agent ${this.name}`, "AGENT");
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
      }
    };
  }

  protected async generateLLMResponse(prompt: string, options?: any): Promise<{ response: string; [key: string]: any }> {
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
    this?.capabilities?.add(capability);
  }
}
