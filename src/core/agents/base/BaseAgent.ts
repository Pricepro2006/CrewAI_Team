import type { BaseTool } from "../../tools/base/BaseTool.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
  ToolExecutionParams,
} from "./AgentTypes.js";
import { logger } from "../../../utils/logger.js";
import { OllamaProvider } from "../../llm/OllamaProvider.js";
import {
  MODEL_CONFIG,
  getModelConfig,
  getModelTimeout,
} from "../../../config/models.config.js";

export abstract class BaseAgent {
  protected tools: Map<string, BaseTool> = new Map();
  protected capabilities: Set<string> = new Set();
  protected initialized = false;
  protected llm: OllamaProvider;
  protected timeout: number;

  constructor(
    public readonly name: string,
    public readonly description: string,
    protected readonly model: string = getModelConfig("primary"), // Now llama3.2:3b
  ) {
    logger.info(`Initializing agent: ${name} with model: ${model}`, "AGENT");

    // Get timeout for this model
    this.timeout = getModelTimeout("primary");

    // Initialize LLM provider
    this.llm = new OllamaProvider({
      model: this.model,
      baseUrl: MODEL_CONFIG.api.ollamaUrl,
    });
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

    // Register default tools first
    if (typeof (this as any).registerDefaultTools === "function") {
      (this as any).registerDefaultTools();
      logger.debug(`Registered default tools for ${this.name}`, "AGENT");
    }

    // Initialize any tools (if they have initialization method)
    for (const tool of this.tools.values()) {
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
}
