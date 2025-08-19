import { BaseAgent } from "../base/BaseAgent.js";
export class ToolExecutorAgent extends BaseAgent {
    constructor() {
        super("ToolExecutorAgent", "General-purpose agent for executing various tools and coordinating tool usage");
    }
    async execute(task, context) {
        try {
            // Query RAG for tool documentation and usage patterns
            let ragContext = "";
            let toolExamples = [];
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
                toolExamples = searchResults.filter(r => r.metadata?.type === 'tool_execution' || r.metadata?.type === 'workflow');
            }
            // Analyze task to determine which tools to use (enhanced with RAG context)
            const toolPlan = await this.createToolExecutionPlan(task, context, ragContext, toolExamples);
            // Execute tools according to plan
            const results = await this.executeToolPlan(toolPlan, context);
            // Synthesize results
            const synthesis = await this.synthesizeResults(results, task);
            // Index successful tool executions back into RAG
            if (this.ragSystem && this.ragEnabled && results.length > 0) {
                const successfulExecutions = results.filter((r) => r.success);
                if (successfulExecutions.length > 0) {
                    await this.indexAgentKnowledge([{
                            content: JSON.stringify({
                                task,
                                toolsUsed: toolPlan?.tools?.map((t) => t.name),
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
                    toolsUsed: toolPlan?.tools?.map((t) => t.name),
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
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async createToolExecutionPlan(task, context, ragContext = "", toolExamples = []) {
        const availableTools = this.getTools();
        const examplesText = toolExamples.length > 0
            ? `\nRelevant tool execution examples:\n${toolExamples.map(e => e.content || '').join("\n\n")}\n`
            : "";
        const prompt = `
      Create a tool execution plan for this task: "${task}"
      
      ${ragContext ? `RAG Context:\n${ragContext}\n` : ""}
      ${context.ragDocuments ? `Context:\n${context.ragDocuments.map((d) => d.content || '').join("\n")}` : ""}
      ${examplesText}
      
      Available tools:
      ${availableTools.map((t) => `- ${t.name || 'Unknown'}: ${t.description || 'No description'}`).join("\n")}
      
      Create a detailed plan including:
      1. Which tools to use (from the available list)
      2. Order of execution
      3. Parameters for each tool
      4. Whether tools can run in parallel
      5. Description of the overall approach
    `;
        if (!this.llm) {
            throw new Error("LLM provider not initialized");
        }
        const response = await this.generateLLMResponse(prompt);
        const parsed = this.parseToolPlan(response.response);
        return {
            tools: this.resolveTools(parsed.tools),
            parallel: parsed.parallel || false,
            description: parsed.description || "Execute tools sequentially",
            startTime: Date.now(),
        };
    }
    parseToolPlan(response) {
        // Parse natural language response
        const tools = [];
        const lines = response.split('\n');
        const lowerResponse = response.toLowerCase();
        // Extract tool names mentioned
        const availableToolNames = ['web_search', 'web_scraper', 'calculator', 'file_reader'];
        for (const toolName of availableToolNames) {
            if (lowerResponse.includes(toolName.replace('_', ' ')) || lowerResponse.includes(toolName)) {
                tools.push({
                    name: toolName,
                    parameters: {},
                    dependsOn: []
                });
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
    resolveTools(toolSpecs) {
        const resolved = [];
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
    async executeToolPlan(plan, context) {
        const results = [];
        const completed = new Set();
        if (plan.parallel) {
            // Execute independent tools in parallel
            const independentTools = plan.tools.filter((t) => t.dependsOn.length === 0);
            const parallelResults = await Promise.all(independentTools.map((spec) => this.executeTool(spec, context)));
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
        }
        else {
            // Execute tools sequentially
            for (const spec of plan.tools) {
                const result = await this.executeTool(spec, context, results);
                results.push(result);
                completed.add(spec.name);
            }
        }
        return results;
    }
    async executeTool(spec, context, previousResults = []) {
        try {
            // Enhance parameters with context and previous results
            const enhancedParams = await this.enhanceParameters(spec, context, previousResults);
            // Execute tool
            const result = await spec.tool.execute(enhancedParams);
            return {
                toolName: spec.name,
                success: result.success,
                result: result.data,
                ...(result.error && { error: result.error }),
                ...(result.metadata && { metadata: result.metadata }),
            };
        }
        catch (error) {
            return {
                toolName: spec.name,
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }
    async enhanceParameters(spec, context, previousResults) {
        // Use previous results to enhance parameters if needed
        let enhanced = { ...spec.parameters };
        // Check if we need to use results from dependencies
        if (spec.dependsOn.length > 0) {
            const prompt = `
        Enhance tool parameters based on previous results.
        
        Tool: ${spec.name}
        Current parameters: ${JSON.stringify(spec.parameters)}
        
        ${context.ragDocuments ? `Context from knowledge base:\n${context.ragDocuments.map((d) => d.content || '').join("\n")}` : ""}
        
        Previous results from dependencies:
        ${previousResults
                .filter((r) => spec.dependsOn.includes(r.toolName))
                .map((r) => `${r.toolName}: ${JSON.stringify(r.result)}`)
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
    async synthesizeResults(results, task) {
        const successfulResults = results.filter((r) => r.success);
        if (successfulResults.length === 0) {
            return "No tools executed successfully.";
        }
        const prompt = `
      Synthesize the results from multiple tool executions to answer: "${task}"
      
      Tool Results:
      ${successfulResults
            .map((r) => `
        Tool: ${r.toolName}
        Result: ${JSON.stringify(r.result, null, 2)}
      `)
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
    getAgentSpecificCapabilities() {
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
    registerDefaultTools() {
        // This agent can use all tools registered to it
        // Tools are registered externally based on requirements
    }
    async executeSpecificTool(toolName, parameters, context) {
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
        }
        catch (error) {
            return this.handleError(error);
        }
    }
}
