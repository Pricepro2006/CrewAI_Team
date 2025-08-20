import { ValidatedTool } from "../base/ValidatedTool.js";
import type { ToolResult } from "../base/ToolTypes.js";
import { withTimeout, DEFAULT_TIMEOUTS } from "../../../utils/timeout.js";
import { SearchKnowledgeService } from "../../services/SearchKnowledgeService.js";

interface SearXNGResult {
  url: string;
  title: string;
  content: string;
  engine: string;
  engines: string[];
  score: number;
  category: string;
  publishedDate?: string;
  address?: string;
  phone?: string;
  thumbnail?: string;
}

interface SearXNGResponse {
  query: string;
  number_of_results: number;
  results: SearXNGResult[];
  suggestions: string[];
  infoboxes: any[];
}

export interface SearXNGSearchParams {
  query: string;
  categories?: string;
  engines?: string;
  language?: string;
  time_range?: string;
  safesearch?: number;
  limit?: number;
}

export class SearXNGSearchTool extends ValidatedTool {
  private baseUrl: string;
  private searchKnowledgeService?: SearchKnowledgeService;

  constructor(baseUrl: string = "http://localhost:8888") {
    super(
      "searxng_search",
      "Searches using local SearXNG instance - aggregates results from multiple search engines including Google, Bing, DuckDuckGo, and specialized engines",
    );
    this.baseUrl = baseUrl;
    this.initializeKnowledgeService();
  }

  private async initializeKnowledgeService(): Promise<void> {
    try {
      // Initialize with default RAG configuration
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
      // Continue without knowledge service
    }
  }

  getInputSchema() {
    return {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        categories: {
          type: "string",
          description: "Search categories: general, map, news, images, videos",
          enum: ["general", "map", "news", "images", "videos"],
          default: "general",
        },
        engines: {
          type: "string",
          description:
            "Comma-separated list of engines to use (e.g., 'google,bing,duckduckgo')",
        },
        language: {
          type: "string",
          description: "Language code (e.g., 'en-US')",
          default: "en-US",
        },
        time_range: {
          type: "string",
          description: "Time range filter",
          enum: ["", "day", "week", "month", "year"],
        },
        safesearch: {
          type: "number",
          description: "Safe search level (0=off, 1=moderate, 2=strict)",
          default: 0,
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
          default: 10,
        },
      },
      required: ["query"],
    };
  }

  override async validateExecution(params: SearXNGSearchParams) {
    if (!params.query || params?.query?.trim().length === 0) {
      return { valid: false, error: "Search query cannot be empty" };
    }
    return { valid: true };
  }

  override async performExecution(
    params: SearXNGSearchParams,
  ): Promise<ToolResult> {
    try {
      console.log(`[SearXNGSearchTool] Received search query: "${params.query}"`);
      
      // Build query parameters
      const searchParams = new URLSearchParams({
        q: params.query,
        format: "json",
        categories: params.categories || "general",
        language: params.language || "en-US",
        safesearch: String(params.safesearch || 0),
        pageno: "1",
      });

      if (params.engines) {
        searchParams.append("engines", params.engines);
      }

      if (params.time_range) {
        searchParams.append("time_range", params.time_range);
      }

      // Make request with timeout
      const response = await withTimeout(
        fetch(`${this.baseUrl}/search?${searchParams}`),
        DEFAULT_TIMEOUTS.API_REQUEST,
        "SearXNG search timed out",
      );

      if (!response.ok) {
        throw new Error(`SearXNG returned status ${response.status}`);
      }

      const data = (await response.json()) as SearXNGResponse;

      // Transform results to our standard format
      const results = data.results
        .slice(0, params.limit || 10)
        .map((result: any) => ({
          title: result.title,
          url: result.url,
          snippet: result.content,
          source: result?.engines?.join(", "),
          relevance: this.normalizeScore(result.score),
          metadata: {
            engines: result.engines,
            category: result.category,
            publishedDate: result.publishedDate,
            // Include business-specific fields if available
            address: result.address,
            phone: result.phone,
            thumbnail: result.thumbnail,
          },
        }));

      // Save search results to knowledge base
      if (this.searchKnowledgeService && results?.length || 0 > 0) {
        try {
          await this?.searchKnowledgeService?.saveSearchResults(
            params.query,
            results?.map((r: any) => ({
              title: r.title,
              url: r.url,
              snippet: r.snippet,
              source: r.source,
              relevance: r.relevance,
              metadata: r.metadata,
            })),
            "SearXNG",
          );
        } catch (error) {
          console.warn(
            "Failed to save search results to knowledge base:",
            error,
          );
          // Continue without saving
        }
      }

      return {
        success: true,
        data: {
          results,
          totalResults: data.number_of_results,
          suggestions: data.suggestions,
          query: params.query,
        },
        metadata: {
          tool: this.name,
          searchEngines: this.getUniqueEngines(results),
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        metadata: {
          tool: this.name,
          query: params.query,
        },
      };
    }
  }

  override getTimeout(): number {
    return DEFAULT_TIMEOUTS.API_REQUEST;
  }

  private normalizeScore(score: number): number {
    // SearXNG scores can vary widely, normalize to 0-1 range
    // Typical scores range from 0 to 10+
    return Math.min(score / 10, 1);
  }

  private getUniqueEngines(results: any[]): string[] {
    const engines = new Set<string>();
    results.forEach((result: any) => {
      if (result.metadata?.engines) {
        result?.metadata?.engines.forEach((engine: string) =>
          engines.add(engine),
        );
      }
    });
    return Array.from(engines);
  }

  // Helper method to check if SearXNG is available
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Search for previously cached results in the knowledge base
   */
  async searchCachedResults(query: string, limit: number = 5): Promise<any[]> {
    if (!this.searchKnowledgeService) {
      return [];
    }

    try {
      return await this?.searchKnowledgeService?.searchPreviousResults(
        query,
        limit,
      );
    } catch (error) {
      console.warn("Failed to search cached results:", error);
      return [];
    }
  }
}
