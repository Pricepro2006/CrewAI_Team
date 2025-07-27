import { BaseAgent } from "../base/BaseAgent";
import type {
  AgentCapability,
  AgentContext,
  AgentResult,
} from "../base/AgentTypes";
import type {
  ResearchAgentResult,
  FactCheckResult,
  Citation,
} from "./ResearchAgentTypes";
import type {
  ResearchPlan as AgentResearchPlan,
  ResearchResult as AgentResearchResult,
  Source as AgentSource,
} from "./ResearchAgentTypes";
import { transformToResearchAgentResult } from "./ResearchAgentTypes";
import { WebSearchTool } from "../../tools/web/WebSearchTool";
import { WebScraperTool } from "../../tools/web/WebScraperTool";

export class ResearchAgent extends BaseAgent {
  constructor() {
    super(
      "ResearchAgent",
      "Specializes in web research, information gathering, and fact-checking",
    );
  }

  async execute(
    task: string,
    context: AgentContext,
  ): Promise<ResearchAgentResult> {
    try {
      // Analyze the task to determine research strategy
      const researchPlan = await this.createResearchPlan(task, context);

      // Execute research based on the plan
      const results = await this.executeResearchPlan(researchPlan, context);

      // Synthesize findings
      const synthesis = await this.synthesizeFindings(results, task);

      const baseResult: AgentResult = {
        success: true,
        data: {
          findings: results,
          synthesis: synthesis,
          sources: this.extractSources(results),
          keyFindings: await this.extractKeyFindings(synthesis, results),
          keyPoints: this.extractKeyPoints(synthesis),
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

      return transformToResearchAgentResult(baseResult);
    } catch (error) {
      return this.handleError(error as Error);
    }
  }

  private async createResearchPlan(
    task: string,
    context: AgentContext,
  ): Promise<AgentResearchPlan> {
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

  private parseResearchPlan(response: string): AgentResearchPlan {
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
    plan: AgentResearchPlan,
    context: AgentContext,
  ): Promise<AgentResearchResult[]> {
    const results: AgentResearchResult[] = [];
    const searchTool = this.tools.get("web_search") as WebSearchTool;
    const scraperTool = this.tools.get("web_scraper") as WebScraperTool;

    // Check if we have existing context that might reduce search needs
    const hasExistingContext =
      context.ragDocuments && context.ragDocuments.length > 0;

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
            results.push({
              source: item.url,
              title: item.title,
              content: item.snippet,
              type: "search_result",
              relevance: this.calculateRelevance(item, plan),
            });

            // Scrape full content for highly relevant results
            if (scraperTool && item.relevance > 0.7) {
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

  private calculateRelevance(item: any, plan: ResearchPlan): number {
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

  private async synthesizeFindings(
    results: AgentResearchResult[],
    task: string,
  ): Promise<string> {
    if (results.length === 0) {
      return "No relevant information found for the given task.";
    }

    const topResults = results.slice(0, 5);
    const prompt = `
      Synthesize the following research findings to answer the task: "${task}"
      
      Research Findings:
      ${topResults
        .map(
          (r, i) => `
        ${i + 1}. Source: ${r.source}
        Title: ${r.title}
        Content: ${r.content.substring(0, 500)}...
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

    return await this.llm.generate(prompt);
  }

  private extractSources(results: AgentResearchResult[]): AgentSource[] {
    const uniqueSources = new Map<string, AgentSource>();

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

  private async extractKeyFindings(
    synthesis: string,
    results: AgentResearchResult[],
  ): Promise<string[]> {
    const prompt = `
      From the following synthesis and research results, extract 3-5 key findings:
      
      Synthesis: ${synthesis}
      
      Key findings should be:
      1. Specific and factual
      2. Directly relevant to the research task
      3. Supported by the source material
      4. Concise (1-2 sentences each)
      
      Return as a JSON array of strings.
    `;

    try {
      const response = await this.llm.generate(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      // Fallback: extract first few sentences from synthesis
    }

    return synthesis
      .split(".")
      .slice(0, 3)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);
  }

  private extractKeyPoints(synthesis: string): string[] {
    // Extract key points from synthesis text
    const sentences = synthesis
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);

    // Use simple heuristics to identify key points
    const keyPoints = sentences.filter((sentence) => {
      const lowerSentence = sentence.toLowerCase();
      return (
        lowerSentence.includes("important") ||
        lowerSentence.includes("key") ||
        lowerSentence.includes("significant") ||
        lowerSentence.includes("notable") ||
        lowerSentence.includes("critical") ||
        lowerSentence.includes("main") ||
        sentence.length > 50 // Longer sentences are often more substantial
      );
    });

    return keyPoints.slice(0, 5); // Return top 5 key points
  }

  protected registerDefaultTools(): void {
    this.registerTool(new WebSearchTool());
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
