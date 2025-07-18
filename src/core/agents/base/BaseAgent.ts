import { BaseTool } from '../../tools/base/BaseTool';
import type { AgentCapability, AgentContext, AgentResult, ToolExecutionParams } from './AgentTypes';
import { logger } from '../../../utils/logger';

export abstract class BaseAgent {
  protected tools: Map<string, BaseTool> = new Map();
  protected capabilities: Set<string> = new Set();
  protected initialized = false;

  constructor(
    public readonly name: string,
    public readonly description: string,
    protected readonly model: string = 'qwen3:0.6b'
  ) {
    logger.info(`Initializing agent: ${name}`, 'AGENT');
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

      const result = await tool.execute(parameters, context);
      
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
    logger.debug(`Registered tool ${tool.name} with ${this.name}`, 'AGENT');
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
      logger.debug(`Agent ${this.name} already initialized`, 'AGENT');
      return;
    }

    logger.info(`Initializing agent ${this.name}`, 'AGENT');
    
    // Initialize any tools
    for (const tool of this.tools.values()) {
      if (tool.initialize) {
        await tool.initialize();
      }
    }

    this.initialized = true;
    logger.info(`Agent ${this.name} initialized successfully`, 'AGENT');
  }

  protected handleError(error: Error): AgentResult {
    logger.error(`Error in agent ${this.name}: ${error.message}`, 'AGENT', { error });
    
    return {
      success: false,
      error: error.message,
      metadata: {
        agent: this.name,
        timestamp: new Date().toISOString(),
        errorType: error.name || 'UnknownError',
      },
    };
  }

  protected addCapability(capability: string): void {
    this.capabilities.add(capability);
  }
}