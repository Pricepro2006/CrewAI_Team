import { OllamaProvider } from '../../llm/OllamaProvider';
import { BaseTool } from '../../tools/base/BaseTool';
import type { AgentCapability, AgentContext, AgentResult, ToolExecutionParams } from './AgentTypes';
// import { wsService } from '../../../api/services/WebSocketService';
// import { v4 as uuidv4 } from 'uuid';

export abstract class BaseAgent {
  protected llm: OllamaProvider;
  protected tools: Map<string, BaseTool>;
  protected capabilities: AgentCapability[];
  protected isInitialized: boolean = false;

  constructor(
    protected name: string,
    protected description: string
  ) {
    this.llm = new OllamaProvider({
      model: 'qwen3:8b' // Smaller model for agents
    });
    this.tools = new Map();
    this.capabilities = [];
  }

  /**
   * Execute a task with the given context
   */
  abstract execute(
    task: string, 
    context: AgentContext
  ): Promise<AgentResult>;

  /**
   * Execute a task using a specific tool
   */
  async executeWithTool(params: ToolExecutionParams): Promise<AgentResult> {
    try {
      // Validate tool exists
      const tool = this.tools.get(params.tool.name);
      if (!tool) {
        throw new Error(`Tool ${params.tool.name} not found for agent ${this.name}`);
      }

      // Prepare prompt with context
      const prompt = this.buildPromptWithContext(params);
      
      // Get LLM guidance for tool usage
      const guidance = await this.llm.generate(prompt);
      
      // Parse LLM response to get tool parameters
      const toolParams = this.parseToolParameters(guidance, params.parameters);
      
      // Execute tool
      const toolResult = await tool.execute(toolParams);

      // Process and return result
      return this.processToolResult(toolResult, params.context);
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  /**
   * Register a tool for this agent
   */
  registerTool(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
    this.updateCapabilities();
  }

  /**
   * Get all registered tools
   */
  getTools(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if agent has a specific capability
   */
  hasCapability(capability: string): boolean {
    return this.capabilities.some(cap => cap.name === capability);
  }

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.llm.initialize();
    this.registerDefaultTools();
    this.isInitialized = true;
  }

  /**
   * Build prompt with context for tool execution
   */
  protected buildPromptWithContext(params: ToolExecutionParams): string {
    const contextStr = this.formatContext(params.context);
    
    return `
      You are ${this.name}, ${this.description}.
      
      Task: ${params.context.task}
      
      Context Information:
      ${contextStr}
      
      You need to use the ${params.tool.name} tool.
      Tool Description: ${params.tool.description}
      
      Available Parameters:
      ${JSON.stringify(params.tool.parameters, null, 2)}
      
      User provided parameters:
      ${JSON.stringify(params.parameters, null, 2)}
      
      Based on the task and context, determine the best parameters to use for this tool.
      Respond with a JSON object containing the tool parameters.
    `;
  }

  /**
   * Process tool execution result
   */
  protected processToolResult(
    result: any, 
    context: AgentContext
  ): AgentResult {
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Tool execution failed',
        metadata: {
          agent: this.name,
          timestamp: new Date().toISOString(),
          ...(context.tool && { tool: context.tool })
        }
      };
    }

    return {
      success: true,
      data: result.data,
      output: this.formatToolOutput(result.data),
      metadata: {
        agent: this.name,
        timestamp: new Date().toISOString(),
        ...(context.tool && { tool: context.tool }),
        ...(result.metadata && { toolMetadata: result.metadata })
      }
    };
  }

  /**
   * Format context information for prompts
   */
  protected formatContext(context: AgentContext): string {
    const parts: string[] = [];
    
    if (context.previousResults && context.previousResults.length > 0) {
      parts.push('Previous Results:');
      context.previousResults.forEach((result, index) => {
        parts.push(`${index + 1}. ${result.summary || JSON.stringify(result)}`);
      });
    }
    
    if (context.ragDocuments && context.ragDocuments.length > 0) {
      parts.push('\nRelevant Documents:');
      context.ragDocuments.forEach((doc, index) => {
        parts.push(`${index + 1}. ${doc.content.substring(0, 200)}...`);
      });
    }
    
    if (context.userPreferences) {
      parts.push('\nUser Preferences:');
      parts.push(JSON.stringify(context.userPreferences, null, 2));
    }
    
    return parts.join('\n');
  }

  /**
   * Parse tool parameters from LLM response
   */
  protected parseToolParameters(
    llmResponse: string, 
    userParams: any
  ): any {
    try {
      // Try to extract JSON from the response
      const jsonMatch = llmResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Merge with user parameters (user params take precedence)
        return { ...parsed, ...userParams };
      }
    } catch (error) {
      console.error('Failed to parse LLM response:', error);
    }
    
    // Fallback to user parameters
    return userParams;
  }

  /**
   * Format tool output for presentation
   */
  protected formatToolOutput(data: any): string {
    if (typeof data === 'string') return data;
    if (data.results && Array.isArray(data.results)) {
      return data.results
        .map((r: any) => r.title ? `- ${r.title}: ${r.summary}` : JSON.stringify(r))
        .join('\n');
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Handle errors uniformly
   */
  protected handleError(error: Error): AgentResult {
    console.error(`Error in ${this.name}:`, error);
    
    return {
      success: false,
      error: error.message,
      metadata: {
        agent: this.name,
        errorType: error.name,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Update agent capabilities based on registered tools
   */
  protected updateCapabilities(): void {
    // Base capabilities from tools
    const toolCapabilities: AgentCapability[] = Array.from(this.tools.values()).map(tool => ({
      name: `tool:${tool.name}`,
      description: `Can use ${tool.name}: ${tool.description}`,
      type: 'tool'
    }));
    
    // Combine with agent-specific capabilities
    this.capabilities = [
      ...this.getAgentSpecificCapabilities(),
      ...toolCapabilities
    ];
  }

  /**
   * Get agent-specific capabilities (to be overridden by subclasses)
   */
  protected abstract getAgentSpecificCapabilities(): AgentCapability[];

  /**
   * Register default tools for this agent type
   */
  protected abstract registerDefaultTools(): void;
}
