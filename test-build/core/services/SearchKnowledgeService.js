import { RAGSystem } from "../rag/RAGSystem.js";
import * as fs from "fs/promises";
import * as path from "path";
export class SearchKnowledgeService {
    ragSystem;
    knowledgeBasePath;
    searchHistoryPath;
    constructor(ragConfig, knowledgeBasePath = "/home/pricepro2006/CrewAI_Team/master_knowledge_base") {
        // Provide default values for required properties
        const fullConfig = {
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
    async initialize() {
        // Ensure knowledge base directories exist
        await fs.mkdir(this.knowledgeBasePath, { recursive: true });
        await fs.mkdir(this.searchHistoryPath, { recursive: true });
        // Initialize RAG system
        await this?.ragSystem?.initialize();
    }
    /**
     * Save search results to both the file system and RAG system
     */
    async saveSearchResults(query, results, provider = "SearXNG") {
        const timestamp = new Date().toISOString();
        const searchQuery = {
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
    async saveToFileSystem(searchQuery) {
        // Create a filename based on timestamp and sanitized query
        const sanitizedQuery = searchQuery.query
            .replace(/[^a-z0-9]/gi, "_")
            .substring(0, 50);
        const filename = `${searchQuery?.timestamp?.split("T")[0]}_${sanitizedQuery}.json`;
        const filePath = path.join(this.searchHistoryPath, filename);
        // Save the search results as JSON
        await fs.writeFile(filePath, JSON.stringify(searchQuery, null, 2), "utf-8");
        // Also append to a master search log
        const logPath = path.join(this.knowledgeBasePath, "search_log.jsonl");
        await fs.appendFile(logPath, JSON.stringify(searchQuery) + "\n", "utf-8");
    }
    async addToRAGSystem(searchQuery) {
        // Create a comprehensive document for the search query
        const content = this.formatSearchResultsForRAG(searchQuery);
        const metadata = {
            id: `search_${searchQuery.timestamp}_${Date.now()}`,
            type: "search_result",
            query: searchQuery.query,
            provider: searchQuery.provider,
            timestamp: searchQuery.timestamp,
            resultCount: searchQuery?.results?.length,
            topUrls: searchQuery?.results?.slice(0, 3).map((r) => r.url),
            // Add business-specific metadata if detected
            hasBusinessInfo: searchQuery?.results?.some((r) => r.metadata?.phone || r.metadata?.address),
        };
        // Add the formatted search results to RAG
        await this?.ragSystem?.addDocument(content, metadata);
        // Also add individual high-relevance results as separate documents
        for (const result of searchQuery?.results?.filter((r) => r.relevance > 0.7)) {
            const resultContent = `
Search Result: ${result.title}
URL: ${result.url}
Content: ${result.snippet}
${result.metadata?.phone ? `Phone: ${result?.metadata?.phone}` : ""}
${result.metadata?.address ? `Address: ${result?.metadata?.address}` : ""}
Source: ${result.source}
Relevance: ${result.relevance}
From Query: "${searchQuery.query}"
      `.trim();
            await this?.ragSystem?.addDocument(resultContent, {
                id: `search_result_${searchQuery.timestamp}_${result.url}`,
                type: "search_result_item",
                parentQuery: searchQuery.query,
                url: result.url,
                title: result.title,
                ...result.metadata,
            });
        }
    }
    formatSearchResultsForRAG(searchQuery) {
        let content = `Search Query: "${searchQuery.query}"
Provider: ${searchQuery.provider}
Timestamp: ${searchQuery.timestamp}
Results Found: ${searchQuery?.results?.length}

Top Search Results:
`;
        searchQuery?.results?.forEach((result, index) => {
            content += `
${index + 1}. ${result.title}
   URL: ${result.url}
   Summary: ${result.snippet}
   Source: ${result.source}
   Relevance: ${result.relevance}`;
            if (result.metadata) {
                if (result?.metadata?.phone) {
                    content += `\n   Phone: ${result?.metadata?.phone}`;
                }
                if (result?.metadata?.address) {
                    content += `\n   Address: ${result?.metadata?.address}`;
                }
                if (result?.metadata?.engines) {
                    content += `\n   Search Engines: ${result?.metadata?.engines.join(", ")}`;
                }
            }
            content += "\n";
        });
        return content;
    }
    /**
     * Search for previously saved search results
     */
    async searchPreviousResults(query, limit = 5) {
        // Search in RAG for relevant previous searches
        const results = await this?.ragSystem?.searchWithFilter(query, { type: "search_result" }, limit);
        return results;
    }
    /**
     * Get search history for a specific date range
     */
    async getSearchHistory(startDate, endDate) {
        const logPath = path.join(this.knowledgeBasePath, "search_log.jsonl");
        try {
            const logContent = await fs.readFile(logPath, "utf-8");
            const searches = logContent
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => JSON.parse(line));
            // Filter by date if provided
            if (startDate || endDate) {
                return searches?.filter((search) => {
                    const searchDate = new Date(search.timestamp);
                    if (startDate && searchDate < startDate)
                        return false;
                    if (endDate && searchDate > endDate)
                        return false;
                    return true;
                });
            }
            return searches;
        }
        catch (error) {
            // If file doesn't exist, return empty array
            if (error.code === "ENOENT") {
                return [];
            }
            throw error;
        }
    }
    /**
     * Get statistics about search history
     */
    async getSearchStats() {
        const history = await this.getSearchHistory();
        const queryCount = new Map();
        const providerCount = new Map();
        let totalResults = 0;
        for (const search of history) {
            // Count queries
            const count = queryCount.get(search.query) || 0;
            queryCount.set(search.query, count + 1);
            // Count providers
            const pCount = providerCount.get(search.provider) || 0;
            providerCount.set(search.provider, pCount + 1);
            // Count results
            totalResults += search?.results?.length;
        }
        // Get top queries
        const topQueries = Array.from(queryCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([query, count]) => ({ query, count }));
        return {
            totalSearches: history?.length || 0,
            uniqueQueries: queryCount.size,
            averageResultsPerSearch: history?.length || 0 > 0 ? Math.round(totalResults / history?.length || 0) : 0,
            topQueries,
            providers: Object.fromEntries(providerCount),
        };
    }
}
