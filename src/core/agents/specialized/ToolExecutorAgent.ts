import { BaseAgent } from "../base/BaseAgent";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
} from "../base/AgentTypes";
import type { BaseTool } from "../../tools/base/BaseTool";

export class ToolExecutorAgent extends BaseAgent {
  constructor() {
    super(
      "ToolExecutorAgent",
      "General-purpose agent for executing various tools and coordinating tool usage",
    );
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Analyze task to determine which tools to use
      const toolPlan = await this.createToolExecutionPlan(task, context);

      // Execute tools according to plan
      const results = await this.executeToolPlan(toolPlan, context);

      // Synthesize results
      const synthesis = await this.synthesizeResults(results, task);

      return {
        success: true,
        data: {
          toolsUsed: toolPlan.tools.map((t) => t.name),
          results,
          synthesis,
        },
        output: synthesis,
        metadata: {
          agent: this.name,
          toolCount: toolPlan.tools.length,
          executionTime: Date.now() - toolPlan.startTime,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private async createToolExecutionPlan(
    task: string,
    context: AgentContext,
  ): Promise<ToolExecutionPlan> {
    const availableTools = this.getTools();

    const prompt = `
      Create a tool execution plan for this task: "${task}"
      
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d) => d.content).join("\n")}` : ""}
      
      Available tools:
      ${availableTools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}
      
      Determine:
      1. Which tools to use
      2. Order of execution
      3. Parameters for each tool
      4. Dependencies between tools
      
      Respond in JSON format:
      {
        "tools": [
          {
            "name": "tool_name",
            "parameters": {},
            "dependsOn": []
          }
        ],
        "parallel": true/false,
        "description": "Plan description"
      }
    `;

    const response = await this.llm.generate(prompt, { format: "json" });
    const parsed = this.parseToolPlan(response);

    return {
      tools: this.resolveTools(parsed.tools),
      parallel: parsed.parallel || false,
      description: parsed.description || "Execute tools sequentially",
      startTime: Date.now(),
    };
  }

  private parseToolPlan(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.warn("Failed to parse tool plan:", error);
      return {
        tools: [],
        parallel: false,
        description: `Failed to parse plan: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private resolveTools(toolSpecs: any[]): ToolSpec[] {
    const resolved: ToolSpec[] = [];

    for (const spec of toolSpecs) {
      const tool = this.tools.get(spec.name);
      if (tool) {
        resolved.push({
          name: spec.name,
          tool,
          parameters: spec.parameters || {},
          dependsOn: spec.dependsOn || [],
        });
      }
    }

    return resolved;
  }

  private async executeToolPlan(
    plan: ToolExecutionPlan,
    context: AgentContext,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    const completed = new Set<string>();

    if (plan.parallel) {
      // Execute independent tools in parallel
      const independentTools = plan.tools.filter(
        (t) => t.dependsOn.length === 0,
      );
      const parallelResults = await Promise.all(
        independentTools.map((spec) => this.executeTool(spec, context)),
      );

      results.push(...parallelResults);
      independentTools.forEach((t) => completed.add(t.name));

      // Execute dependent tools
      const dependentTools = plan.tools.filter((t) => t.dependsOn.length > 0);
      for (const spec of dependentTools) {
        if (spec.dependsOn.every((dep) => completed.has(dep))) {
          const result = await this.executeTool(spec, context, results);
          results.push(result);
          completed.add(spec.name);
        }
      }
    } else {
      // Execute tools sequentially
      for (const spec of plan.tools) {
        const result = await this.executeTool(spec, context, results);
        results.push(result);
        completed.add(spec.name);
      }
    }

    return results;
  }

  private async executeTool(
    spec: ToolSpec,
    context: AgentContext,
    previousResults: ToolExecutionResult[] = [],
  ): Promise<ToolExecutionResult> {
    try {
      // Enhance parameters with context and previous results
      const enhancedParams = await this.enhanceParameters(
        spec,
        context,
        previousResults,
      );

      // Execute tool
      const result = await spec.tool.execute(enhancedParams);

      return {
        toolName: spec.name,
        success: result.success,
        result: result.data,
        ...(result.error && { error: result.error }),
        ...(result.metadata && { metadata: result.metadata }),
      };
    } catch (error) {
      return {
        toolName: spec.name,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async enhanceParameters(
    spec: ToolSpec,
    context: AgentContext,
    previousResults: ToolExecutionResult[],
  ): Promise<any> {
    // Use previous results to enhance parameters if needed
    let enhanced = { ...spec.parameters };

    // Check if we need to use results from dependencies
    if (spec.dependsOn.length > 0) {
      const prompt = `
        Enhance tool parameters based on previous results.
        
        Tool: ${spec.name}
        Current parameters: ${JSON.stringify(spec.parameters)}
        
        ${context.ragDocuments ? `Context from knowledge base:\n${context.ragDocuments.map((d) => d.content).join("\n")}` : ""}
        
        Previous results from dependencies:
        ${previousResults
          .filter((r) => spec.dependsOn.includes(r.toolName))
          .map((r) => `${r.toolName}: ${JSON.stringify(r.result)}`)
          .join("\n")}
        
        Provide enhanced parameters in JSON format.
      `;

      const response = await this.llm.generate(prompt, { format: "json" });

      try {
        enhanced = JSON.parse(response);
      } catch {
        // Keep original parameters if parsing fails
      }
    }

    return enhanced;
  }

  private async synthesizeResults(
    results: ToolExecutionResult[],
    task: string,
  ): Promise<string> {
    const successfulResults = results.filter((r) => r.success);

    if (successfulResults.length === 0) {
      return "No tools executed successfully.";
    }

    const prompt = `
      Synthesize the results from multiple tool executions to answer: "${task}"
      
      Tool Results:
      ${successfulResults
        .map(
          (r) => `
        Tool: ${r.toolName}
        Result: ${JSON.stringify(r.result, null, 2)}
      `,
        )
        .join("\n\n")}
      
      Create a comprehensive response that:
      1. Directly addresses the original task
      2. Integrates information from all tools
      3. Highlights key findings
      4. Provides actionable insights
    `;

    return await this.llm.generate(prompt);
  }

  protected getAgentSpecificCapabilities(): AgentCapability[] {
    return [
      {
        name: "tool_orchestration",
        description: "Can coordinate multiple tool executions",
        type: "tool",
      },
      {
        name: "parallel_execution",
        description: "Can execute independent tools in parallel",
        type: "tool",
      },
      {
        name: "result_synthesis",
        description: "Can synthesize results from multiple tools",
        type: "analysis",
      },
      {
        name: "adaptive_execution",
        description: "Can adapt tool parameters based on results",
        type: "tool",
      },
    ];
  }

  protected registerDefaultTools(): void {
    // This agent can use all tools registered to it
    // Tools are registered externally based on requirements
  }

  async executeSpecificTool(
    toolName: string,
    parameters: any,
    context?: AgentContext,
  ): Promise<AgentResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolName} not found`,
      };
    }

    try {
      const result = await tool.execute(parameters);

      return {
        success: result.success,
        data: result.data,
        output: JSON.stringify(result.data, null, 2),
        ...(result.error && { error: result.error }),
        metadata: {
          agent: this.name,
          tool: toolName,
          timestamp: new Date().toISOString(),
          hasContext: !!context,
          ...result.metadata,
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }
}

interface ToolExecutionPlan {
  tools: ToolSpec[];
  parallel: boolean;
  description: string;
  startTime: number;
}

interface ToolSpec {
  name: string;
  tool: BaseTool;
  parameters: any;
  dependsOn: string[];
}

interface ToolExecutionResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  metadata?: any;
}
