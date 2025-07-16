import { BaseTool, ToolResult } from '../base/BaseTool';
import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebSearchTool extends BaseTool {
  private searchEngines: SearchEngine[];

  constructor() {
    super(
      'web_search',
      'Searches the web for information using multiple search engines',
      [
        {
          name: 'query',
          type: 'string',
          required: true,
          description: 'Search query'
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Maximum number of results to return',
          default: 10,
          min: 1,
          max: 50
        },
        {
          name: 'engine',
          type: 'string',
          required: false,
          description: 'Search engine to use',
          default: 'duckduckgo',
          enum: ['duckduckgo', 'searx', 'google']
        }
      ]
    );

    this.searchEngines = [
      new DuckDuckGoEngine(),
      new SearxEngine(),
      // Google engine would require API key
    ];
  }

  async execute(params: {
    query: string;
    limit?: number;
    engine?: string;
  }): Promise<ToolResult> {
    const validation = this.validateParameters(params);
    if (!validation.valid) {
      return this.error(validation.errors.join(', '));
    }

    try {
      const limit = params.limit || 10;
      const engineName = params.engine || 'duckduckgo';
      
      const engine = this.searchEngines.find(e => e.name === engineName);
      if (!engine) {
        return this.error(`Search engine ${engineName} not found`);
      }

      const results = await engine.search(params.query, limit);

      return this.success({
        results,
        query: params.query,
        engine: engineName,
        count: results.length
      });
    } catch (error) {
      return this.error(error as Error);
    }
  }
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  timestamp?: string;
}

abstract class SearchEngine {
  abstract name: string;
  abstract async search(query: string, limit: number): Promise<SearchResult[]>;
}

class DuckDuckGoEngine extends SearchEngine {
  name = 'duckduckgo';

  async search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // For now, return mock results to test the system
      // TODO: Implement real search API when ready
      return [
        {
          title: `Search result for: ${query}`,
          url: `https://example.com/search-result-1`,
          snippet: `This is a mock search result for the query "${query}". It contains relevant information about the topic and demonstrates the search functionality.`
        },
        {
          title: `Related information about ${query}`,
          url: `https://example.com/search-result-2`,
          snippet: `Additional context and information related to "${query}". This helps provide comprehensive coverage of the topic.`
        },
        {
          title: `Expert insights on ${query}`,
          url: `https://example.com/search-result-3`,
          snippet: `Expert analysis and insights regarding "${query}". This provides authoritative information on the subject.`
        }
      ].slice(0, limit);
    } catch (error) {
      console.error('DuckDuckGo search failed:', error);
      return [];
    }
  }
}

class SearxEngine extends SearchEngine {
  name = 'searx';
  private baseUrl = 'https://searx.me'; // Or your own Searx instance

  async search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      const url = `${this.baseUrl}/search`;
      const response = await axios.get(url, {
        params: {
          q: query,
          format: 'json',
          limit
        }
      });

      return response.data.results.map((result: any) => ({
        title: result.title,
        url: result.url,
        snippet: result.content || ''
      }));
    } catch (error) {
      console.error('Searx search failed:', error);
      // Fallback to empty results
      return [];
    }
  }
}

// Export for use in other tools
export class SearchEngineWrapper {
  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    const tool = new WebSearchTool();
    const result = await tool.execute({ query, limit });
    
    if (result.success && result.data) {
      return result.data.results;
    }
    
    return [];
  }
}
