/**
 * Response Cache - Stores frequently asked questions and their responses
 */

interface CachedResponse {
  prompt: string;
  response: string;
  timestamp: number;
  hits: number;
}

export class ResponseCache {
  private cache: Map<string, CachedResponse> = new Map();
  private readonly maxSize: number = 100;
  private readonly ttl: number = 3600000; // 1 hour in milliseconds
  
  // Pre-populated common responses for instant replies
  private readonly commonResponses = new Map([
    ["which tools can you use", {
      response: "I have access to specialized agents: ResearchAgent (web search, information gathering), CodeAgent (code generation, debugging), DataAnalysisAgent (data processing, visualization), WriterAgent (content creation), and ToolExecutorAgent (web scraping, automation). Each agent has specific tools for their domain.",
      keywords: ["tools", "capabilities", "agents", "what can you do"]
    }],
    ["what agents are available", {
      response: "The CrewAI Team system includes 5 specialized agents: ResearchAgent for information retrieval, CodeAgent for programming tasks, DataAnalysisAgent for data insights, WriterAgent for content creation, and ToolExecutorAgent for automation and web scraping.",
      keywords: ["agents", "available", "system"]
    }],
    ["hello", {
      response: "Hello! I'm the CrewAI Team assistant. I can help you with research, coding, data analysis, writing, and automation tasks. What would you like to work on today?",
      keywords: ["hi", "hey", "greetings"]
    }],
    ["help", {
      response: "I can assist with: 1) Research and information gathering, 2) Code generation and debugging, 3) Data analysis and visualization, 4) Content writing and editing, 5) Web scraping and automation. Just describe what you need!",
      keywords: ["help", "what can", "how to"]
    }]
  ]);
  
  /**
   * Get cached response if available
   */
  get(prompt: string): string | null {
    // Check common responses first
    const normalizedPrompt = prompt.toLowerCase().trim();
    
    for (const [key, data] of this.commonResponses) {
      if (normalizedPrompt.includes(key) || 
          data.keywords.some(kw => normalizedPrompt.includes(kw))) {
        return data.response;
      }
    }
    
    // Check dynamic cache
    const cacheKey = this.createCacheKey(prompt);
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      // Check if cache is still valid
      if (Date.now() - cached.timestamp < this.ttl) {
        cached.hits++;
        return cached.response;
      } else {
        // Remove expired entry
        this.cache.delete(cacheKey);
      }
    }
    
    return null;
  }
  
  /**
   * Store a response in cache
   */
  set(prompt: string, response: string): void {
    const cacheKey = this.createCacheKey(prompt);
    
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const leastUsed = this.findLeastUsedEntry();
      if (leastUsed) {
        this.cache.delete(leastUsed);
      }
    }
    
    this.cache.set(cacheKey, {
      prompt,
      response,
      timestamp: Date.now(),
      hits: 0
    });
  }
  
  /**
   * Create a normalized cache key from prompt
   */
  private createCacheKey(prompt: string): string {
    return prompt
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .substring(0, 100);        // Limit length
  }
  
  /**
   * Find least recently used entry for eviction
   */
  private findLeastUsedEntry(): string | null {
    let leastUsed: string | null = null;
    let minHits = Infinity;
    let oldestTime = Date.now();
    
    for (const [key, value] of this.cache) {
      const score = value.hits * 1000 + (Date.now() - value.timestamp);
      if (score < minHits) {
        minHits = score;
        leastUsed = key;
      }
    }
    
    return leastUsed;
  }
  
  /**
   * Clear all cached responses
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    commonResponsesUsed: number;
  } {
    let totalHits = 0;
    for (const value of this.cache.values()) {
      totalHits += value.hits;
    }
    
    return {
      size: this.cache.size,
      hits: totalHits,
      commonResponsesUsed: this.commonResponses.size
    };
  }
}

// Singleton instance
export const responseCache = new ResponseCache();