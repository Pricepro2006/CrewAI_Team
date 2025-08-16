import { BaseAgent } from "../base/BaseAgent.js";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
  ToolExecutionParams,
} from "../base/AgentTypes.js";
import { WebSearchTool } from "../../tools/web/WebSearchTool.js";
import { WebScraperTool } from "../../tools/web/WebScraperTool.js";
import { SearXNGSearchTool } from "../../tools/web/SearXNGProvider.js";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../../utils/timeout.js";
import { BusinessSearchPromptEnhancer } from "../../prompts/BusinessSearchPromptEnhancer.js";

const businessSearchPromptEnhancer = new BusinessSearchPromptEnhancer();
import { SearchKnowledgeService } from "../../services/SearchKnowledgeService.js";

export class ResearchAgent extends BaseAgent {
  private searchKnowledgeService?: SearchKnowledgeService;

  constructor() {
    super(
      "ResearchAgent",
      "Specializes in web research, information gathering, and fact-checking",
    );
    this.initializeKnowledgeService();
  }

  private async initializeKnowledgeService(): Promise<void> {
    try {
      this.searchKnowledgeService = new SearchKnowledgeService({
        vectorStore: {
          type: "chromadb",
          collectionName: "search_knowledge",
          baseUrl: "http://localhost:8000",
        },
        chunking: {
          chunkSize: 1000,
          overlap: 200,
        },
        retrieval: {
          topK: 5,
        },
      });
      await this?.searchKnowledgeService?.initialize();
    } catch (error) {
      console.warn("Failed to initialize SearchKnowledgeService:", error);
    }
  }

  async execute(task: string, context: AgentContext): Promise<AgentResult> {
    try {
      // First, check RAG system for relevant knowledge
      let ragContext = "";
      if (this.ragSystem && this.ragEnabled) {
        ragContext = await this.queryRAG(task, {
          limit: 5,
          filter: { agentType: 'ResearchAgent' }
        });
        
        if (ragContext) {
          console.log(`[ResearchAgent] Retrieved RAG context: ${ragContext.length} characters`);
        }
      }

      // Analyze the task to determine research strategy
      const researchPlan = await this.createResearchPlan(task, context);

      // Execute research based on the plan
      const results = await this.executeResearchPlan(researchPlan, context);

      // Enhance results with RAG knowledge if available
      if (ragContext) {
        results.unshift({
          type: 'knowledge_base',
          source: 'RAG System',
          content: ragContext,
          relevance: 1.0
        });
      }

      // Synthesize findings including RAG context
      const synthesis = await this.synthesizeFindings(results, task);

      // Index successful research results back into RAG for future use
      if (this.ragSystem && this.ragEnabled && synthesis) {
        await this.indexAgentKnowledge([{
          content: synthesis,
          metadata: {
            task,
            timestamp: new Date().toISOString(),
            sources: this.extractSources(results)
          }
        }]);
      }

      return {
        success: true,
        data: {
          findings: results,
          synthesis: synthesis,
          sources: this.extractSources(results),
          ragContextUsed: !!ragContext
        },
        output: synthesis,
        metadata: {
          agent: this.name,
          toolsUsed: researchPlan.tools,
          queriesExecuted: researchPlan?.queries?.length,
          sourcesFound: results?.length || 0,
          ragEnhanced: !!ragContext,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  override async executeWithTool(
    params: ToolExecutionParams,
  ): Promise<AgentResult> {
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
      const isBusinessQuery = !businessSearchPromptEnhancer.isAlreadyEnhanced(
        query || taskDescription,
      );
      if (isBusinessQuery) {
        console.log(
          "[ResearchAgent] Business query detected - will enhance synthesis",
        );
      }

      // For tool execution, skip the LLM-based research plan creation
      // and go directly to search execution
      // Get whichever search tool is registered (SearXNG or WebSearchTool)
      const searchTool =
        this?.tools?.get("searxng_search") || this?.tools?.get("web_search");

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

      // Check for cached results first
      let cachedResults: any[] = [];
      if (this.searchKnowledgeService) {
        try {
          cachedResults =
            await this?.searchKnowledgeService?.searchPreviousResults(query, 3);
          if ((cachedResults?.length || 0) > 0) {
            console.log(
              `[ResearchAgent] Found ${cachedResults?.length || 0} cached results for similar queries`,
            );
          }
        } catch (error) {
          console.warn("Failed to search cached results:", error);
        }
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
          output:
            "I couldn't find any relevant information for your query. This might be due to search limitations or the specificity of your request.",
          data: { findings: [], sources: [] },
          metadata: {
            agent: this.name,
            tool: tool.name,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Convert search results to research results
      const results: ResearchResult[] = searchResult?.data?.results?.map(
        (item: any) => ({
          source: item.url,
          title: item.title,
          content: item.snippet,
          type: "search_result" as const,
          relevance: 0.8,
        }),
      );

      console.log(
        "[ResearchAgent] Found",
        results?.length || 0,
        "results, synthesizing...",
      );

      // Synthesize the findings
      const synthesis = await this.synthesizeFindings(
        results,
        query || taskDescription,
      );

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
          sourcesFound: results?.length || 0,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("[ResearchAgent] Error in executeWithTool:", error);
      return this.handleError(error as Error);
    }
  }

  private async createResearchPlan(
    task: string,
    context: AgentContext,
  ): Promise<ResearchPlan> {
    const prompt = `
      You are a research specialist. Create a research plan for the following task:
      "${task}"
      
      ${context.ragDocuments ? `Existing knowledge base context:\n${context?.ragDocuments?.map((d: any) => d.content).join("\n\n")}` : ""}
      
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

    const responseResponse = await this.generateLLMResponse(prompt);
    const response = responseResponse?.response;
    return this.parseResearchPlan(response);
  }

  private parseResearchPlan(response: string): ResearchPlan {
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
    } catch (error) {
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

  private async executeResearchPlan(
    plan: ResearchPlan,
    context: AgentContext,
  ): Promise<ResearchResult[]> {
    const results: ResearchResult[] = [];
    // Get whichever search tool is registered (SearXNG or WebSearchTool)
    const searchTool =
      this?.tools?.get("searxng_search") || this?.tools?.get("web_search");
    const scraperTool = this?.tools?.get("web_scraper") as WebScraperTool;

    // Check if we have existing context that might reduce search needs
    const hasExistingContext =
      context.ragDocuments && context?.ragDocuments?.length > 0;

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
          for (const item of searchResult?.data?.results) {
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
                  content: scraped?.data?.content,
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

  private calculateRelevance(item: any, plan: ResearchPlan): number {
    // Simple relevance scoring based on keyword matching
    let score = 0.5; // Base score

    const text = `${item.title} ${item.snippet}`.toLowerCase();

    // Check for extraction focus keywords
    plan?.extractionFocus?.forEach((focus: any) => {
      if (text.includes(focus.toLowerCase())) {
        score += 0.1;
      }
    });

    // Check for source type indicators
    const url = item?.url?.toLowerCase();
    plan?.sourceTypes?.forEach((type: any) => {
      if (url.includes(type) || text.includes(type)) {
        score += 0.1;
      }
    });

    return Math.min(score, 1.0);
  }

  private async synthesizeFindings(
    results: ResearchResult[],
    task: string,
  ): Promise<string> {
    if (results?.length || 0 === 0) {
      return "No relevant information found for the given task.";
    }

    const topResults = results.slice(0, 5);

    // Check if we have any cached results that might be helpful
    let cachedContext = "";
    if (this.searchKnowledgeService) {
      try {
        const cachedResults =
          await this?.searchKnowledgeService?.searchPreviousResults(task, 2);
        if (cachedResults?.length || 0 > 0) {
          cachedContext = `\n\nPreviously cached relevant information:\n${cachedResults
            .map((r: any) => r.content)
            .join("\n\n")}\n\n`;
        }
      } catch (error) {
        // Ignore cache errors
      }
    }

    // Check if this is a business-related query
    const isBusinessQuery = !businessSearchPromptEnhancer.isAlreadyEnhanced(task);

    // Increase content size for business queries to capture contact info
    const contentLength = isBusinessQuery ? 1500 : 500;

    let basePrompt = `
      Synthesize the following research findings to answer the task: "${task}"
      ${cachedContext}
      Research Findings:
      ${topResults
        .map(
          (r, i) => `
        ${i + 1}. Source: ${r.source}
        Title: ${r.title}
        Content: ${r?.content?.substring(0, contentLength)}...
        Relevance: ${r.relevance}
      `,
        )
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
      console.log(
        "[ResearchAgent] Detected business query, enhancing synthesis prompt",
      );

      // Determine enhancement level based on urgency keywords
      const urgentKeywords = [
        "urgent",
        "emergency",
        "asap",
        "immediately",
        "now",
      ];
      const hasUrgency = urgentKeywords.some((keyword: any) =>
        task.toLowerCase().includes(keyword),
      );

      // Extract location if present
      const locationMatch = task.match(
        /(?:in|near|at|around)\s+([^.?!]+?)(?:\.|$)/i,
      );
      const customInstructions = locationMatch
        ? `Focus on businesses in or near ${locationMatch[1]}. Include distance/travel information.`
        : "";

      const enhancedPrompt = businessSearchPromptEnhancer.enhance(basePrompt, {
        enableEntityExtraction: true,
        enableSentimentAnalysis: hasUrgency,
        enableWorkflowDetection: true,
        maxContextLength: 3000,
      });
      
      // Append custom instructions to the enhanced prompt
      basePrompt = enhancedPrompt.user + `
          
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
        `;
    }

    const llmResponse = await withTimeout(
      this.generateLLMResponse(basePrompt),
      DEFAULT_TIMEOUTS.LLM_GENERATION,
      "LLM synthesis timed out",
    );
    
    return llmResponse.response;
  }

  private extractSources(results: ResearchResult[]): Source[] {
    const uniqueSources = new Map<string, Source>();

    results.forEach((result: any) => {
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

  protected getAgentSpecificCapabilities(): AgentCapability[] {
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

  protected registerDefaultTools(): void {
    // Try to use SearXNG first if available
    const searxng = new SearXNGSearchTool();
    searxng
      .isAvailable()
      .then((available: any) => {
        if (available) {
          console.log(
            "[ResearchAgent] Using SearXNG for search (unlimited, better results)",
          );
          this.registerTool(searxng);
        } else {
          console.log(
            "[ResearchAgent] SearXNG not available, using DuckDuckGo fallback",
          );
          this.registerTool(new WebSearchTool());
        }
      })
      .catch(() => {
        this.registerTool(new WebSearchTool());
      });

    this.registerTool(new WebScraperTool());
  }
}

interface ResearchPlan {
  queries: string[];
  sourceTypes: string[];
  extractionFocus: string[];
  tools: string[];
}

interface ResearchResult {
  source: string;
  title: string;
  content: string;
  type: "search_result" | "scraped_content";
  relevance: number;
}

interface Source {
  url: string;
  title: string;
  type: string;
  accessedAt: string;
}
