import { RAGSystem } from "../rag/RAGSystem";
import type { VectorStoreConfig, RAGConfig } from "../rag/types";
import * as fs from "fs/promises";
import * as path from "path";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevance: number;
  metadata?: Record<string, any>;
}

export interface SearchQuery {
  query: string;
  timestamp: string;
  results: SearchResult[];
  provider: string;
}

export class SearchKnowledgeService {
  private ragSystem: RAGSystem;
  private knowledgeBasePath: string;
  private searchHistoryPath: string;

  constructor(
    ragConfig: {
      vectorStore: VectorStoreConfig;
      chunking?: any;
      retrieval?: any;
    },
    knowledgeBasePath: string = "/home/pricepro2006/CrewAI_Team/master_knowledge_base",
  ) {
    // Provide default values for required properties
    const fullConfig: RAGConfig = {
      vectorStore: ragConfig.vectorStore,
      chunking: ragConfig.chunking || {
        chunkSize: 1000,
        chunkOverlap: 200,
        minChunkSize: 50,
      },
      retrieval: ragConfig.retrieval || {
        topK: 5,
        minScore: 0.7,
        maxTokens: 2000,
      },
    };

    this.ragSystem = new RAGSystem(fullConfig);
    this.knowledgeBasePath = knowledgeBasePath;
    this.searchHistoryPath = path.join(knowledgeBasePath, "search_history");
  }

  async initialize(): Promise<void> {
    // Ensure knowledge base directories exist
    await fs.mkdir(this.knowledgeBasePath, { recursive: true });
    await fs.mkdir(this.searchHistoryPath, { recursive: true });

    // Initialize RAG system
    await this.ragSystem.initialize();
  }

  /**
   * Save search results to both the file system and RAG system
   */
  async saveSearchResults(
    query: string,
    results: SearchResult[],
    provider: string = "SearXNG",
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const searchQuery: SearchQuery = {
      query,
      timestamp,
      results,
      provider,
    };

    // 1. Save to file system for persistent storage
    await this.saveToFileSystem(searchQuery);

    // 2. Add to RAG system for semantic search
    await this.addToRAGSystem(searchQuery);
  }

  private async saveToFileSystem(searchQuery: SearchQuery): Promise<void> {
    // Create a filename based on timestamp and sanitized query
    const sanitizedQuery = searchQuery.query
      .replace(/[^a-z0-9]/gi, "_")
      .substring(0, 50);
    const filename = `${searchQuery.timestamp.split("T")[0]}_${sanitizedQuery}.json`;
    const filePath = path.join(this.searchHistoryPath, filename);

    // Save the search results as JSON
    await fs.writeFile(filePath, JSON.stringify(searchQuery, null, 2), "utf-8");

    // Also append to a master search log
    const logPath = path.join(this.knowledgeBasePath, "search_log.jsonl");
    await fs.appendFile(logPath, JSON.stringify(searchQuery) + "\n", "utf-8");
  }

  private async addToRAGSystem(searchQuery: SearchQuery): Promise<void> {
    // Create a comprehensive document for the search query
    const content = this.formatSearchResultsForRAG(searchQuery);

    const metadata = {
      id: `search_${searchQuery.timestamp}_${Date.now()}`,
      type: "search_result",
      query: searchQuery.query,
      provider: searchQuery.provider,
      timestamp: searchQuery.timestamp,
      resultCount: searchQuery.results.length,
      topUrls: searchQuery.results.slice(0, 3).map((r) => r.url),
      // Add business-specific metadata if detected
      hasBusinessInfo: searchQuery.results.some(
        (r) => r.metadata?.phone || r.metadata?.address,
      ),
    };

    // Add the formatted search results to RAG
    await this.ragSystem.addDocument(content, metadata);

    // Also add individual high-relevance results as separate documents
    for (const result of searchQuery.results.filter((r) => r.relevance > 0.7)) {
      const resultContent = `
Search Result: ${result.title}
URL: ${result.url}
Content: ${result.snippet}
${result.metadata?.phone ? `Phone: ${result.metadata.phone}` : ""}
${result.metadata?.address ? `Address: ${result.metadata.address}` : ""}
Source: ${result.source}
Relevance: ${result.relevance}
From Query: "${searchQuery.query}"
      `.trim();

      await this.ragSystem.addDocument(resultContent, {
        id: `search_result_${searchQuery.timestamp}_${result.url}`,
        type: "search_result_item",
        parentQuery: searchQuery.query,
        url: result.url,
        title: result.title,
        ...result.metadata,
      });
    }
  }

  private formatSearchResultsForRAG(searchQuery: SearchQuery): string {
    let content = `Search Query: "${searchQuery.query}"
Provider: ${searchQuery.provider}
Timestamp: ${searchQuery.timestamp}
Results Found: ${searchQuery.results.length}

Top Search Results:
`;

    searchQuery.results.forEach((result, index) => {
      content += `
${index + 1}. ${result.title}
   URL: ${result.url}
   Summary: ${result.snippet}
   Source: ${result.source}
   Relevance: ${result.relevance}`;

      if (result.metadata) {
        if (result.metadata.phone) {
          content += `\n   Phone: ${result.metadata.phone}`;
        }
        if (result.metadata.address) {
          content += `\n   Address: ${result.metadata.address}`;
        }
        if (result.metadata.engines) {
          content += `\n   Search Engines: ${result.metadata.engines.join(", ")}`;
        }
      }
      content += "\n";
    });

    return content;
  }

  /**
   * Search for previously saved search results
   */
  async searchPreviousResults(
    query: string,
    limit: number = 5,
  ): Promise<any[]> {
    // Search in RAG for relevant previous searches
    const results = await this.ragSystem.searchWithFilter(
      query,
      { type: "search_result" },
      limit,
    );

    return results;
  }

  /**
   * Get search history for a specific date range
   */
  async getSearchHistory(
    startDate?: Date,
    endDate?: Date,
  ): Promise<SearchQuery[]> {
    const logPath = path.join(this.knowledgeBasePath, "search_log.jsonl");

    try {
      const logContent = await fs.readFile(logPath, "utf-8");
      const searches = logContent
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line) as SearchQuery);

      // Filter by date if provided
      if (startDate || endDate) {
        return searches.filter((search) => {
          const searchDate = new Date(search.timestamp);
          if (startDate && searchDate < startDate) return false;
          if (endDate && searchDate > endDate) return false;
          return true;
        });
      }

      return searches;
    } catch (error) {
      // If file doesn't exist, return empty array
      if ((error as any).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get statistics about search history
   */
  async getSearchStats(): Promise<{
    totalSearches: number;
    uniqueQueries: number;
    averageResultsPerSearch: number;
    topQueries: Array<{ query: string; count: number }>;
    providers: Record<string, number>;
  }> {
    const history = await this.getSearchHistory();

    const queryCount = new Map<string, number>();
    const providerCount = new Map<string, number>();
    let totalResults = 0;

    for (const search of history) {
      // Count queries
      const count = queryCount.get(search.query) || 0;
      queryCount.set(search.query, count + 1);

      // Count providers
      const pCount = providerCount.get(search.provider) || 0;
      providerCount.set(search.provider, pCount + 1);

      // Count results
      totalResults += search.results.length;
    }

    // Get top queries
    const topQueries = Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([query, count]) => ({ query, count }));

    return {
      totalSearches: history.length,
      uniqueQueries: queryCount.size,
      averageResultsPerSearch:
        history.length > 0 ? Math.round(totalResults / history.length) : 0,
      topQueries,
      providers: Object.fromEntries(providerCount),
    };
  }
}
