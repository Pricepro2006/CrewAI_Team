/**
 * Hybrid Search Service
 * Combines multiple search strategies for optimal results
 */

import { Logger } from "../../utils/logger.js";
const logger = Logger.getInstance();

export interface SearchQuery {
  q: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  relevanceScore: number;
  source: 'text' | 'semantic' | 'hybrid';
  metadata?: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  searchTime: number;
  strategies: string[];
}

export class HybridSearchService {
  private static instance: HybridSearchService;

  static getInstance(): HybridSearchService {
    if (!HybridSearchService.instance) {
      HybridSearchService.instance = new HybridSearchService();
    }
    return HybridSearchService.instance;
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startTime = Date.now();
    
    try {
      // Combine multiple search strategies
      const [textResults, semanticResults] = await Promise.all([
        this.textSearch(query),
        this.semanticSearch(query)
      ]);

      // Merge and rank results
      const hybridResults = this.mergeResults(textResults, semanticResults);
      const rankedResults = this.rankResults(hybridResults, query);

      const page = Math.floor((query.offset || 0) / (query.limit || 10)) + 1;
      const limit = query.limit || 10;
      const offset = query.offset || 0;
      
      const paginatedResults = rankedResults.slice(offset, offset + limit);

      return {
        results: paginatedResults,
        total: rankedResults.length,
        page,
        limit,
        hasMore: offset + limit < rankedResults.length,
        searchTime: Date.now() - startTime,
        strategies: ['text', 'semantic', 'hybrid']
      };
    } catch (error) {
      logger.error('Error in hybrid search:', error);
      throw error;
    }
  }

  private async textSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Mock text search implementation
    return [
      {
        id: '1',
        title: `Text result for "${query.q}"`,
        description: 'Text-based search result',
        relevanceScore: 0.8,
        source: 'text',
        metadata: { method: 'text_search' }
      }
    ];
  }

  private async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    // Mock semantic search implementation
    return [
      {
        id: '2',
        title: `Semantic result for "${query.q}"`,
        description: 'Semantically similar content',
        relevanceScore: 0.7,
        source: 'semantic',
        metadata: { method: 'semantic_search' }
      }
    ];
  }

  private mergeResults(textResults: SearchResult[], semanticResults: SearchResult[]): SearchResult[] {
    const merged = [...textResults, ...semanticResults];
    
    // Remove duplicates based on ID
    const uniqueResults = merged.filter((result, index, self) => 
      index === self.findIndex(r => r.id === result.id)
    );

    return uniqueResults;
  }

  private rankResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results
      .map(result => ({
        ...result,
        relevanceScore: this.calculateHybridScore(result, query)
      }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  private calculateHybridScore(result: SearchResult, query: SearchQuery): number {
    let score = result.relevanceScore;

    // Boost hybrid results
    if (result.source === 'hybrid') {
      score *= 1.2;
    }

    // Apply query-specific boosting
    if (result.title.toLowerCase().includes(query.q.toLowerCase())) {
      score *= 1.1;
    }

    return Math.min(score, 1.0);
  }

  async searchProducts(query: SearchQuery): Promise<SearchResponse> {
    try {
      // Specialized product search
      return this.search({
        ...query,
        filters: { ...query.filters, type: 'product' }
      });
    } catch (error) {
      logger.error('Error in product search:', error);
      throw error;
    }
  }

  async searchEmails(query: SearchQuery): Promise<SearchResponse> {
    try {
      // Specialized email search
      return this.search({
        ...query,
        filters: { ...query.filters, type: 'email' }
      });
    } catch (error) {
      logger.error('Error in email search:', error);
      throw error;
    }
  }

  async getSuggestions(partial: string): Promise<string[]> {
    try {
      // Mock auto-complete suggestions
      return [
        `${partial} suggestion 1`,
        `${partial} suggestion 2`,
        `${partial} suggestion 3`
      ];
    } catch (error) {
      logger.error('Error getting search suggestions:', error);
      throw error;
    }
  }
}