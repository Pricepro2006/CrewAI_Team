import { BaseAgent } from "../base/BaseAgent";
import { WebSearchTool } from "../../tools/web/WebSearchTool";
import { WebScraperTool } from "../../tools/web/WebScraperTool";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../../utils/timeout";
import { businessSearchPromptEnhancer } from "../../prompts/BusinessSearchPromptEnhancer";
export class ResearchAgent extends BaseAgent {
    constructor() {
        super("ResearchAgent", "Specializes in web research, information gathering, and fact-checking");
    }
    async execute(task, context) {
        try {
            // Analyze the task to determine research strategy
            const researchPlan = await this.createResearchPlan(task, context);
            // Execute research based on the plan
            const results = await this.executeResearchPlan(researchPlan, context);
            // Synthesize findings
            const synthesis = await this.synthesizeFindings(results, task);
            return {
                success: true,
                data: {
                    findings: results,
                    synthesis: synthesis,
                    sources: this.extractSources(results),
                },
                output: synthesis,
                metadata: {
                    agent: this.name,
                    toolsUsed: researchPlan.tools,
                    queriesExecuted: researchPlan.queries.length,
                    sourcesFound: results.length,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    async executeWithTool(params) {
        const { tool, context, parameters } = params;
        try {
            // If it's not a web search tool, use default behavior
            if (tool.name !== "web_search") {
                return super.executeWithTool(params);
            }
            console.log("[ResearchAgent] Starting executeWithTool for web_search");
            // For web search, we need to create a proper research query
            // Extract the query from the task description (format: "Process and respond to: <query>")
            const taskDescription = context.task || "";
            const taskMatch = taskDescription.match(/Process and respond to: (.+)/);
            const query = taskMatch ? taskMatch[1] : taskDescription;
            console.log("[ResearchAgent] Query extracted:", query);
            // Check if this is a business query and enhance search parameters
            const isBusinessQuery = businessSearchPromptEnhancer.needsEnhancement(query || taskDescription);
            if (isBusinessQuery) {
                console.log("[ResearchAgent] Business query detected - will enhance synthesis");
            }
            // For tool execution, skip the LLM-based research plan creation
            // and go directly to search execution
            const searchTool = this.tools.get("web_search");
            if (!searchTool) {
                return {
                    success: false,
                    error: "Web search tool not found",
                };
            }
            if (!query) {
                return {
                    success: false,
                    error: "No query provided for web search",
                };
            }
            console.log("[ResearchAgent] Executing web search...");
            const searchResult = await searchTool.execute({
                query,
                limit: 5,
            });
            console.log("[ResearchAgent] Search completed:", searchResult.success);
            if (!searchResult.success || !searchResult.data) {
                return {
                    success: true,
                    output: "I couldn't find any relevant information for your query. This might be due to search limitations or the specificity of your request.",
                    data: { findings: [], sources: [] },
                    metadata: {
                        agent: this.name,
                        tool: tool.name,
                        timestamp: new Date().toISOString(),
                    },
                };
            }
            // Convert search results to research results
            const results = searchResult.data.results.map((item) => ({
                source: item.url,
                title: item.title,
                content: item.snippet,
                type: "search_result",
                relevance: 0.8,
            }));
            console.log("[ResearchAgent] Found", results.length, "results, synthesizing...");
            // Synthesize the findings
            const synthesis = await this.synthesizeFindings(results, query || taskDescription);
            console.log("[ResearchAgent] Synthesis complete");
            return {
                success: true,
                data: {
                    findings: results,
                    synthesis: synthesis,
                    sources: this.extractSources(results),
                },
                output: synthesis,
                metadata: {
                    agent: this.name,
                    tool: tool.name,
                    queriesExecuted: 1,
                    sourcesFound: results.length,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            console.error("[ResearchAgent] Error in executeWithTool:", error);
            return this.handleError(error);
        }
    }
    async createResearchPlan(task, context) {
        const prompt = `
      You are a research specialist. Create a research plan for the following task:
      "${task}"
      
      ${context.ragDocuments ? `Existing knowledge base context:\n${context.ragDocuments.map((d) => d.content).join("\n\n")}` : ""}
      
      Create a research plan that includes:
      1. Key search queries to execute
      2. Types of sources to prioritize
      3. Information to extract
      4. Validation strategies
      
      Respond with a JSON object:
      {
        "queries": ["query1", "query2", ...],
        "sourceTypes": ["academic", "news", "technical", ...],
        "extractionFocus": ["facts", "statistics", "expert opinions", ...],
        "tools": ["web_search", "web_scraper"]
      }
    `;
        const response = await this.llm.generate(prompt);
        return this.parseResearchPlan(response);
    }
    parseResearchPlan(response) {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                return {
                    queries: parsed.queries || ["general research query"],
                    sourceTypes: parsed.sourceTypes || ["general"],
                    extractionFocus: parsed.extractionFocus || ["information"],
                    tools: parsed.tools || ["web_search"],
                };
            }
        }
        catch (error) {
            console.error("Failed to parse research plan:", error);
        }
        // Fallback plan
        return {
            queries: ["general research query"],
            sourceTypes: ["general"],
            extractionFocus: ["information"],
            tools: ["web_search"],
        };
    }
    async executeResearchPlan(plan, context) {
        const results = [];
        const searchTool = this.tools.get("web_search");
        const scraperTool = this.tools.get("web_scraper");
        // Check if we have existing context that might reduce search needs
        const hasExistingContext = context.ragDocuments && context.ragDocuments.length > 0;
        // If we have existing context, limit the search scope
        const searchLimit = hasExistingContext ? 3 : 5;
        // Execute searches
        for (const query of plan.queries) {
            if (searchTool) {
                const searchResult = await searchTool.execute({
                    query,
                    limit: searchLimit,
                });
                if (searchResult.success && searchResult.data) {
                    // For each search result, potentially scrape the content
                    for (const item of searchResult.data.results) {
                        const relevance = this.calculateRelevance(item, plan);
                        results.push({
                            source: item.url,
                            title: item.title,
                            content: item.snippet,
                            type: "search_result",
                            relevance: relevance,
                        });
                        // Scrape full content for highly relevant results
                        if (scraperTool && relevance > 0.7) {
                            const scraped = await scraperTool.execute({
                                url: item.url,
                            });
                            if (scraped.success && scraped.data) {
                                results.push({
                                    source: item.url,
                                    title: item.title,
                                    content: scraped.data.content,
                                    type: "scraped_content",
                                    relevance: item.relevance,
                                });
                            }
                        }
                    }
                }
            }
        }
        // Sort by relevance
        return results.sort((a, b) => b.relevance - a.relevance);
    }
    calculateRelevance(item, plan) {
        // Simple relevance scoring based on keyword matching
        let score = 0.5; // Base score
        const text = `${item.title} ${item.snippet}`.toLowerCase();
        // Check for extraction focus keywords
        plan.extractionFocus.forEach((focus) => {
            if (text.includes(focus.toLowerCase())) {
                score += 0.1;
            }
        });
        // Check for source type indicators
        const url = item.url.toLowerCase();
        plan.sourceTypes.forEach((type) => {
            if (url.includes(type) || text.includes(type)) {
                score += 0.1;
            }
        });
        return Math.min(score, 1.0);
    }
    async synthesizeFindings(results, task) {
        if (results.length === 0) {
            return "No relevant information found for the given task.";
        }
        const topResults = results.slice(0, 5);
        // Check if this is a business-related query
        const isBusinessQuery = businessSearchPromptEnhancer.needsEnhancement(task);
        // Increase content size for business queries to capture contact info
        const contentLength = isBusinessQuery ? 1500 : 500;
        let basePrompt = `
      Synthesize the following research findings to answer the task: "${task}"
      
      Research Findings:
      ${topResults
            .map((r, i) => `
        ${i + 1}. Source: ${r.source}
        Title: ${r.title}
        Content: ${r.content.substring(0, contentLength)}...
        Relevance: ${r.relevance}
      `)
            .join("\n\n")}
      
      Create a comprehensive summary that:
      1. Directly addresses the original task
      2. Integrates information from multiple sources
      3. Highlights key facts and insights
      4. Notes any conflicting information
      5. Maintains objectivity
      
      Format the response in clear paragraphs.
    `;
        // Enhance the prompt for business queries
        if (isBusinessQuery) {
            console.log("[ResearchAgent] Detected business query, enhancing synthesis prompt");
            // Determine enhancement level based on urgency keywords
            const urgentKeywords = ['urgent', 'emergency', 'asap', 'immediately', 'now'];
            const hasUrgency = urgentKeywords.some(keyword => task.toLowerCase().includes(keyword));
            // Extract location if present
            const locationMatch = task.match(/(?:in|near|at|around)\s+([^.?!]+?)(?:\.|$)/i);
            const customInstructions = locationMatch
                ? `Focus on businesses in or near ${locationMatch[1]}. Include distance/travel information.`
                : '';
            basePrompt = businessSearchPromptEnhancer.enhance(basePrompt, {
                enhancementLevel: hasUrgency ? 'aggressive' : 'standard',
                includeExamples: true,
                customInstructions: `
          ${customInstructions}
          
          CRITICAL: Extract and include the following business information:
          - Business name and type
          - Complete phone number(s)
          - Full street address
          - Business hours/availability
          - Website URL and/or email
          - Service areas and travel availability
          - Initial visit costs or pricing information
          - Any special certifications or qualifications
          
          Format business listings clearly with a "Recommendations" section.
          Each business should be a separate subsection with contact details prominently displayed.
        `
            });
        }
        return await withTimeout(this.llm.generate(basePrompt), DEFAULT_TIMEOUTS.LLM_GENERATION, "LLM synthesis timed out");
    }
    extractSources(results) {
        const uniqueSources = new Map();
        results.forEach((result) => {
            if (!uniqueSources.has(result.source)) {
                uniqueSources.set(result.source, {
                    url: result.source,
                    title: result.title,
                    type: result.type,
                    accessedAt: new Date().toISOString(),
                });
            }
        });
        return Array.from(uniqueSources.values());
    }
    getAgentSpecificCapabilities() {
        return [
            {
                name: "web_research",
                description: "Can search the web for information",
                type: "retrieval",
            },
            {
                name: "content_extraction",
                description: "Can extract and parse content from web pages",
                type: "analysis",
            },
            {
                name: "fact_checking",
                description: "Can verify information across multiple sources",
                type: "analysis",
            },
            {
                name: "source_evaluation",
                description: "Can assess the credibility and relevance of sources",
                type: "analysis",
            },
        ];
    }
    registerDefaultTools() {
        this.registerTool(new WebSearchTool());
        this.registerTool(new WebScraperTool());
    }
}
//# sourceMappingURL=ResearchAgent.js.map