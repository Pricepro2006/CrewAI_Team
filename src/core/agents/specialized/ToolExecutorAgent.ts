import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
} from "../base/AgentTypes.js";
import type { BaseTool } from "../../tools/base/BaseTool.js";
import { WebScraperTool } from "../../tools/web/WebScraperTool.js";
import { WebSearchTool } from "../../tools/web/WebSearchTool.js";

export class ToolExecutorAgent extends BaseAgent {
  constructor() {
    super(
      "ToolExecutorAgent",
      "General-purpose agent for executing various tools and coordinating tool usage",
    );
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Query RAG for tool documentation and usage patterns
      let ragContext = "";
      let toolExamples: any[] = [];
      
      if (this.ragSystem && this.ragEnabled) {
        // Search for tool documentation
        ragContext = await this.queryRAG(task, {
          limit: 5,
          filter: { 
            agentType: 'ToolExecutorAgent',
            category: 'tool_documentation'
          }
        });
        
        // Search for tool usage patterns
        const usageContext = await this.queryRAG(task, {
          limit: 3,
          filter: {
            category: 'tool_usage_patterns'
          }
        });
        
        if (ragContext || usageContext) {
          console.log(`[ToolExecutorAgent] Retrieved RAG context: ${(ragContext + usageContext).length} characters`);
          ragContext = ragContext + "\n" + usageContext;
        }
        
        // Search for successful tool execution examples
        const searchResults = await this.searchRAG(task, 3);
        toolExamples = searchResults.filter(r => 
          r.metadata?.type === 'tool_execution' || r.metadata?.type === 'workflow'
        );
      }

      // Analyze task to determine which tools to use (enhanced with RAG context)
      const toolPlan = await this.createToolExecutionPlan(task, context, ragContext, toolExamples);

      // Execute tools according to plan
      const results = await this.executeToolPlan(toolPlan, context);

      // Synthesize results
      const synthesis = await this.synthesizeResults(results, task);

      // Index successful tool executions back into RAG
      if (this.ragSystem && this.ragEnabled && results.length > 0) {
        const successfulExecutions = results.filter((r: any) => r.success);
        if (successfulExecutions.length > 0) {
          await this.indexAgentKnowledge([{
            content: JSON.stringify({
              task,
              toolsUsed: toolPlan?.tools?.map((t: any) => t.name),
              results: successfulExecutions,
              synthesis
            }),
            metadata: {
              type: 'tool_execution',
              category: 'tool_usage_patterns',
              toolCount: toolPlan?.tools?.length,
              success: true,
              timestamp: new Date().toISOString()
            }
          }]);
        }
      }

      return {
        success: true,
        data: {
          toolsUsed: toolPlan?.tools?.map((t: any) => t.name),
          results,
          synthesis,
          ragContextUsed: !!ragContext
        },
        output: synthesis,
        metadata: {
          agent: this.name,
          toolCount: toolPlan?.tools?.length,
          executionTime: Date.now() - toolPlan.startTime,
          ragEnhanced: !!ragContext,
          examplesUsed: toolExamples.length,
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
    ragContext: string = "",
    toolExamples: any[] = []
  ): Promise<ToolExecutionPlan> {
    const availableTools = this.getTools();

    // Extract URLs from the original task
    const urlPattern = /https?:\/\/[^\s\)]+/gi;
    const urlsInTask = task.match(urlPattern) || [];
    const cleanedUrls = urlsInTask.map(url => url.replace(/[,;.!?]$/, ''));

    const examplesText = toolExamples.length > 0 
      ? `\nRelevant tool execution examples:\n${toolExamples.map(e => e.content || '').join("\n\n")}\n`
      : "";
      
    const prompt = `
      Create a tool execution plan for this task: "${task}"
      
      ${ragContext ? `RAG Context:\n${ragContext}\n` : ""}
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
      ${examplesText}
      ${cleanedUrls.length > 0 ? `\nURLs found in task: ${cleanedUrls.join(', ')}\n` : ''}
      
      Available tools:
      ${availableTools.map((t: any) => `- ${t.name || 'Unknown'}: ${t.description || 'No description'}`).join("\n")}
      
      Create a detailed plan including:
      1. Which tools to use (from the available list)
      2. Order of execution
      3. Parameters for each tool${cleanedUrls.length > 0 ? ' (use the URLs provided: ' + cleanedUrls.join(', ') + ')' : ''}
      4. Whether tools can run in parallel
      5. Description of the overall approach
    `;

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const response = await this.generateLLMResponse(prompt);
    let parsed = this.parseToolPlan(response.response);

    // If we found URLs in the task and web_scraper is in the plan, ensure URLs are set
    if (cleanedUrls.length > 0 && parsed.tools) {
      for (const tool of parsed.tools) {
        if (tool.name === 'web_scraper' && (!tool.parameters || !tool.parameters.url)) {
          tool.parameters = { url: cleanedUrls[0] };
        }
      }
    }

    return {
      tools: this.resolveTools(parsed.tools),
      parallel: parsed.parallel || false,
      description: parsed.description || "Execute tools sequentially",
      startTime: Date.now(),
    };
  }

  private parseToolPlan(response: string): any {
    // Parse natural language response
    const tools: any[] = [];
    const lines = response.split('\n');
    const lowerResponse = response.toLowerCase();
    
    // Extract tool names mentioned
    const availableToolNames = ['web_search', 'web_scraper', 'calculator', 'file_reader'];
    for (const toolName of availableToolNames) {
      if (lowerResponse.includes(toolName.replace('_', ' ')) || lowerResponse.includes(toolName)) {
        const toolSpec: any = {
          name: toolName,
          parameters: {},
          dependsOn: []
        };
        
        // Extract URL for web_scraper tool
        if (toolName === 'web_scraper') {
          // Look for URLs in the response
          const urlPattern = /https?:\/\/[^\s\)]+/gi;
          const urls = response.match(urlPattern);
          if (urls && urls.length > 0) {
            // Clean up the URL (remove trailing punctuation)
            let url = urls[0].replace(/[,;.!?]$/, '');
            toolSpec.parameters = { url };
          } else {
            // Try to find URL mentioned after "scrape" or "website" or "page"
            const scrapePattern = /(?:scrape|fetch|get|retrieve|extract|website|page|url|from)\s*(?:from\s*)?[:\s]*([^\s,]+(?:\.[a-z]+)+[^\s]*)/gi;
            const scrapeMatch = scrapePattern.exec(response);
            if (scrapeMatch && scrapeMatch[1]) {
              let url = scrapeMatch[1];
              // Add https:// if no protocol specified
              if (!url.startsWith('http')) {
                url = 'https://' + url;
              }
              toolSpec.parameters = { url };
            }
          }
        }
        
        // Extract search query for web_search tool
        if (toolName === 'web_search') {
          // Look for quoted search terms or extract from context
          const queryPattern = /(?:search|query|find|look for)[:\s]*["']([^"']+)["']/i;
          const queryMatch = queryPattern.exec(response);
          if (queryMatch && queryMatch[1]) {
            toolSpec.parameters = { query: queryMatch[1] };
          }
        }
        
        tools.push(toolSpec);
      }
    }
    
    // Check if parallel execution is mentioned
    const parallel = lowerResponse.includes('parallel') || lowerResponse.includes('simultaneously');
    
    // Extract description (first sentence or line that looks like a description)
    let description = "Execute tools to complete the task";
    for (const line of lines) {
      if (line.length > 20 && !line.startsWith('-') && !line.match(/^\d+\./)) {
        description = line.trim();
        break;
      }
    }
    
    // If we couldn't extract tools, add a default
    if (tools.length === 0) {
      tools.push({
        name: 'web_search',
        parameters: {},
        dependsOn: []
      });
    }
    
    return {
      tools,
      parallel,
      description,
    };
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
        (t: any) => t.dependsOn.length === 0,
      );
      const parallelResults = await Promise.all(
        independentTools.map((spec: any) => this.executeTool(spec, context)),
      );

      results.push(...parallelResults);
      independentTools.forEach((t: any) => completed.add(t.name));

      // Execute dependent tools
      const dependentTools = plan.tools.filter((t: any) => t.dependsOn.length > 0);
      for (const spec of dependentTools) {
        if (spec.dependsOn.every((dep: any) => completed.has(dep))) {
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
        
        ${context.ragDocuments ? `Context from knowledge base:\n${context.ragDocuments.map((d: any) => d.content || '').join("\n")}` : ""}
        
        Previous results from dependencies:
        ${previousResults
          .filter((r: any) => spec.dependsOn.includes(r.toolName))
          .map((r: any) => `${r.toolName}: ${JSON.stringify(r.result)}`)
          .join("\n")}
        
        Suggest any parameter improvements or additional values needed.
      `;

      if (!this.llm) {
        throw new Error("LLM provider not initialized");
      }
      
      const response = await this.generateLLMResponse(prompt, { temperature: 0.1 });

      // For now, keep the original parameters since we're not forcing JSON
      // The LLM response could be parsed for key-value suggestions in the future
      enhanced = spec.parameters;
    }

    return enhanced;
  }

  private async synthesizeResults(
    results: ToolExecutionResult[],
    task: string,
  ): Promise<string> {
    const successfulResults = results.filter((r: any) => r.success);

    if (successfulResults.length === 0) {
      return "No tools executed successfully.";
    }

    const prompt = `
      Synthesize the results from multiple tool executions to answer: "${task}"
      
      Tool Results:
      ${successfulResults
        .map(
          (r: any) => `
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

    if (!this.llm) {
      throw new Error("LLM provider not initialized");
    }
    
    const llmResponse = await this.generateLLMResponse(prompt);
    return llmResponse.response;
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
    // Register web scraping and search tools for this agent
    this.registerTool(new WebScraperTool());
    this.registerTool(new WebSearchTool());
    // Additional tools can be registered externally based on requirements
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
