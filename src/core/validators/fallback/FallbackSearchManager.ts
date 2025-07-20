import type { ValidationResult, ContactInfo } from '../BusinessResponseValidator.js';

export interface FallbackSearchOptions {
  query: string;
  missingInfo: string[];
  currentResults?: ContactInfo;
  location?: string;
  searchDepth?: 'shallow' | 'deep';
}

export interface FallbackSearchResult {
  success: boolean;
  enhancedInfo?: ContactInfo;
  searchQueries: string[];
  sourcesUsed: string[];
  error?: string;
}

export interface DataSource {
  name: string;
  priority: number;
  searchFunction: (query: string) => Promise<string>;
  isAvailable: () => Promise<boolean>;
}

export class FallbackSearchManager {
  private dataSources: DataSource[] = [];
  private searchHistory: Map<string, FallbackSearchResult> = new Map();
  private userFeedback: Map<string, { helpful: boolean; reason?: string }[]> = new Map();

  constructor() {
    this.initializeDataSources();
  }

  /**
   * Initialize available data sources
   */
  private initializeDataSources(): void {
    // Note: These are placeholder implementations
    // In production, these would integrate with actual services
    
    this.dataSources = [
      {
        name: 'BrightData',
        priority: 1,
        searchFunction: async (query: string) => {
          // Placeholder for BrightData integration
          // In production: return await mcp__Bright_Data__scrape_as_markdown({ url: searchUrl });
          return `BrightData results for: ${query}`;
        },
        isAvailable: async () => true
      },
      {
        name: 'GoogleMaps',
        priority: 2,
        searchFunction: async (query: string) => {
          // Placeholder for Google Maps API
          return `Google Maps results for: ${query}`;
        },
        isAvailable: async () => true
      },
      {
        name: 'YellowPages',
        priority: 3,
        searchFunction: async (query: string) => {
          // Placeholder for Yellow Pages scraping
          return `Yellow Pages results for: ${query}`;
        },
        isAvailable: async () => true
      },
      {
        name: 'BusinessDirectory',
        priority: 4,
        searchFunction: async (query: string) => {
          // Placeholder for business directory API
          return `Business Directory results for: ${query}`;
        },
        isAvailable: async () => true
      }
    ];

    // Sort by priority
    this.dataSources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Perform fallback search when initial validation fails
   */
  public async performFallbackSearch(
    options: FallbackSearchOptions
  ): Promise<FallbackSearchResult> {
    const cacheKey = this.generateCacheKey(options);
    
    // Check cache first
    if (this.searchHistory.has(cacheKey)) {
      return this.searchHistory.get(cacheKey)!;
    }

    const searchQueries = this.generateSearchQueries(options);
    const sourcesUsed: string[] = [];
    let combinedResults = '';

    try {
      // Try each data source in priority order
      for (const source of this.dataSources) {
        if (await source.isAvailable()) {
          for (const query of searchQueries) {
            try {
              const result = await source.searchFunction(query);
              combinedResults += `\n${result}`;
              sourcesUsed.push(source.name);
              
              // If we get good results, we might stop early
              if (this.hasRequiredInfo(combinedResults, options.missingInfo)) {
                break;
              }
            } catch (error) {
              console.error(`Error with ${source.name}:`, error);
            }
          }
        }
        
        // Stop if we have enough information
        if (this.hasRequiredInfo(combinedResults, options.missingInfo)) {
          break;
        }
      }

      // Parse the combined results
      const enhancedInfo = this.parseSearchResults(combinedResults);
      
      const result: FallbackSearchResult = {
        success: this.hasRequiredInfo(combinedResults, options.missingInfo),
        enhancedInfo,
        searchQueries,
        sourcesUsed
      };

      // Cache the result
      this.searchHistory.set(cacheKey, result);
      
      return result;
    } catch (error) {
      return {
        success: false,
        searchQueries,
        sourcesUsed,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate optimized search queries based on missing information
   */
  private generateSearchQueries(options: FallbackSearchOptions): string[] {
    const queries: string[] = [];
    const baseQuery = options.query;

    // Always include the base query
    queries.push(baseQuery);

    // Add specific queries for missing information
    if (options.missingInfo.includes('phone')) {
      queries.push(`${baseQuery} phone number contact`);
      queries.push(`${baseQuery} call telephone`);
    }

    if (options.missingInfo.includes('address')) {
      queries.push(`${baseQuery} address location directions`);
      queries.push(`${baseQuery} ${options.location || ''} location`);
    }

    if (options.missingInfo.includes('hours')) {
      queries.push(`${baseQuery} hours open closed schedule`);
      queries.push(`${baseQuery} business hours operation`);
    }

    if (options.missingInfo.includes('business name')) {
      queries.push(`${baseQuery} company business name`);
    }

    // Add location-specific queries if location is provided
    if (options.location) {
      queries.push(`${baseQuery} ${options.location}`);
    }

    // Remove duplicates and limit number of queries
    return [...new Set(queries)].slice(0, 5);
  }

  /**
   * Check if results contain required information
   */
  private hasRequiredInfo(results: string, missingInfo: string[]): boolean {
    const checks = {
      phone: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/,
      address: /\d{1,5}\s+\w+\s+(?:street|st|avenue|ave|road|rd)/i,
      hours: /\b(?:\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)\s*[-–—]\s*(?:\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?)/i,
      'business name': /\b[A-Z]\w+(?:\s+[A-Z]\w+)*(?:\s+(?:Inc|LLC|Ltd|Corp|Co))?\b/
    };

    for (const info of missingInfo) {
      if (checks[info as keyof typeof checks]) {
        if (!results.match(checks[info as keyof typeof checks])) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Parse search results into ContactInfo structure
   */
  private parseSearchResults(results: string): ContactInfo {
    // This would use the BusinessResponseValidator to parse the results
    // Placeholder implementation
    return {
      phones: [],
      addresses: [],
      businessNames: [],
      hours: [],
      emails: [],
      websites: []
    };
  }

  /**
   * Generate cache key for search
   */
  private generateCacheKey(options: FallbackSearchOptions): string {
    return `${options.query}_${options.missingInfo.join(',')}_${options.location || 'no-location'}`;
  }

  /**
   * Record user feedback on search results
   */
  public recordFeedback(
    query: string, 
    helpful: boolean, 
    reason?: string
  ): void {
    if (!this.userFeedback.has(query)) {
      this.userFeedback.set(query, []);
    }

    this.userFeedback.get(query)!.push({ helpful, reason });
  }

  /**
   * Get feedback summary for a query
   */
  public getFeedbackSummary(query: string): { 
    totalFeedback: number; 
    helpfulPercentage: number; 
    commonIssues: string[] 
  } {
    const feedback = this.userFeedback.get(query) || [];
    const helpful = feedback.filter(f => f.helpful).length;
    
    const issues = feedback
      .filter(f => !f.helpful && f.reason)
      .map(f => f.reason!)
      .reduce((acc, reason) => {
        acc[reason] = (acc[reason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const commonIssues = Object.entries(issues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([issue]) => issue);

    return {
      totalFeedback: feedback.length,
      helpfulPercentage: feedback.length > 0 ? (helpful / feedback.length) * 100 : 0,
      commonIssues
    };
  }

  /**
   * Add a new data source dynamically
   */
  public addDataSource(source: DataSource): void {
    this.dataSources.push(source);
    this.dataSources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Remove a data source
   */
  public removeDataSource(name: string): void {
    this.dataSources = this.dataSources.filter(s => s.name !== name);
  }

  /**
   * Get available data sources
   */
  public async getAvailableDataSources(): Promise<string[]> {
    const available: string[] = [];
    
    for (const source of this.dataSources) {
      if (await source.isAvailable()) {
        available.push(source.name);
      }
    }

    return available;
  }

  /**
   * Clear search cache
   */
  public clearCache(): void {
    this.searchHistory.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { 
    size: number; 
    hits: number; 
    misses: number 
  } {
    // In a real implementation, we would track hits and misses
    return {
      size: this.searchHistory.size,
      hits: 0, // Placeholder
      misses: 0 // Placeholder
    };
  }
}