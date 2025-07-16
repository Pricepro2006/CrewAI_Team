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
      // Note: This is a simplified example. In production, you'd use proper APIs
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      $('.result').each((index, element) => {
        if (results.length >= limit) return false;

        const title = $(element).find('.result__title').text().trim();
        const url = $(element).find('.result__url').attr('href');
        const snippet = $(element).find('.result__snippet').text().trim();

        if (title && url) {
          results.push({
            title,
            url,
            snippet
          });
        }
      });

      return results;
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
