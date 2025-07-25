# SearXNG Integration Pattern

## Overview

SearXNG is now the primary search provider for the CrewAI Team project, offering unlimited searches with zero API costs by aggregating results from 70+ search engines.

## Architecture

### Search Provider Hierarchy

1. **Primary**: SearXNG (port 8888)
   - Aggregates from Google, Bing, DuckDuckGo, and 70+ engines
   - Zero API costs
   - Unlimited searches
   - Self-hosted for privacy

2. **Fallback**: DuckDuckGo Direct
   - Used when SearXNG is unavailable
   - Limited to snippets only
   - Also free and unlimited

### Search Result Caching

All search results are automatically saved to the master knowledge base:

```
master_knowledge_base/
├── search_history/        # Individual search result files
│   └── YYYY-MM-DD_query.json
└── search_log.jsonl      # Append-only log of all searches
```

## Implementation Details

### 1. SearXNG Tool (`SearXNGSearchTool`)

```typescript
// src/core/tools/web/SearXNGProvider.ts
export class SearXNGSearchTool extends ValidatedTool {
  constructor(baseUrl: string = "http://localhost:8888") {
    // Initializes with knowledge service
  }

  async performExecution(params: SearXNGSearchParams): Promise<ToolResult> {
    // 1. Execute search via SearXNG API
    // 2. Transform results to standard format
    // 3. Save to knowledge base via SearchKnowledgeService
    // 4. Return results
  }
}
```

### 2. Search Knowledge Service

```typescript
// src/core/services/SearchKnowledgeService.ts
export class SearchKnowledgeService {
  async saveSearchResults(
    query: string,
    results: SearchResult[],
    provider: string,
  ): Promise<void> {
    // 1. Save to file system (master_knowledge_base)
    // 2. Add to RAG system for semantic search
    // 3. Index high-relevance results separately
  }

  async searchPreviousResults(query: string, limit: number): Promise<any[]> {
    // Search cached results via RAG
  }
}
```

### 3. ResearchAgent Integration

The ResearchAgent automatically:

1. Checks cached results before making new searches
2. Uses SearXNG as primary search tool
3. Falls back to DuckDuckGo if SearXNG unavailable
4. Enhances business queries with specialized prompts

## Configuration

### Environment Variables

```bash
# .env.example
SEARXNG_BASE_URL=http://localhost:8888
SEARXNG_ENABLED=true
SEARXNG_FALLBACK_TO_DUCKDUCKGO=true
```

### Docker Configuration

```yaml
# Note: SearXNG runs separately at ~/searxng
# Start with: cd ~/searxng && docker-compose up -d
services:
  app:
    environment:
      - SEARXNG_BASE_URL=http://host.docker.internal:8888
      - SEARXNG_ENABLED=true
```

## Usage Patterns

### 1. Direct Search Tool Usage

```typescript
const searxng = new SearXNGSearchTool();
const results = await searxng.execute({
  query: "AI agents TypeScript",
  categories: "general",
  limit: 10,
});
```

### 2. Via ResearchAgent

```typescript
const agent = new ResearchAgent();
const result = await agent.executeWithTool({
  tool: searxng,
  parameters: { query: "business near me" },
  context: { task: "Find local businesses" },
});
```

### 3. Accessing Cached Results

```typescript
const knowledgeService = new SearchKnowledgeService(ragConfig);
const cached = await knowledgeService.searchPreviousResults("similar query", 5);
```

## Benefits

1. **Cost Savings**: Zero API costs vs paid search APIs
2. **Better Results**: Aggregates from multiple engines
3. **Privacy**: Self-hosted, no tracking
4. **Knowledge Building**: All searches enhance the knowledge base
5. **Performance**: Cached results reduce redundant searches

## Maintenance

### SearXNG Management

```bash
# Start SearXNG
cd ~/searxng && docker-compose up -d

# View logs
docker-compose logs -f

# Stop SearXNG
docker-compose down

# Update SearXNG
docker-compose pull && docker-compose up -d
```

### Knowledge Base Management

```bash
# View search statistics
npm run knowledge:stats

# Export search history
npm run knowledge:export

# Clean old searches (>30 days)
npm run knowledge:clean
```

## Best Practices

1. **Always Check Cache First**: Reduce redundant searches
2. **Handle Failures Gracefully**: Use fallback providers
3. **Monitor Disk Usage**: Search history grows over time
4. **Regular Backups**: Include master_knowledge_base in backups
5. **Privacy Compliance**: Ensure search logs comply with data policies

## Troubleshooting

### SearXNG Not Available

```typescript
// Automatic fallback to DuckDuckGo
if (!(await searxng.isAvailable())) {
  console.log("SearXNG unavailable, using fallback");
  return new WebSearchTool();
}
```

### Knowledge Base Errors

```typescript
// Continue without saving if knowledge service fails
try {
  await knowledgeService.saveSearchResults(...);
} catch (error) {
  console.warn("Failed to save search results:", error);
  // Continue without saving
}
```

## Future Enhancements

1. **Search Result Deduplication**: Detect and merge duplicate results
2. **Smart Caching**: Expire results based on query type
3. **Result Quality Scoring**: Learn from user interactions
4. **Multi-Language Support**: Configure SearXNG for different languages
5. **Custom Search Engines**: Add specialized engines for domains

## Related Documentation

- [Tool Integration Best Practices](tool_integration_best_practices_2025.md)
- [Empty Response Investigation](empty_response_investigation_solution_2025.md)
- [Architecture Patterns](../ARCHITECTURE.md)

---

_Last Updated: January 2025_
_Version: 1.0.0_
