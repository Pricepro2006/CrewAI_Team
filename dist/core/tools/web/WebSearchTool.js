import { BaseTool } from "../base/BaseTool";
import axios from "axios";
export class WebSearchTool extends BaseTool {
    searchEngines;
    constructor() {
        super("web_search", "Searches the web for information using multiple search engines", [
            {
                name: "query",
                type: "string",
                required: true,
                description: "Search query",
            },
            {
                name: "limit",
                type: "number",
                required: false,
                description: "Maximum number of results to return",
                default: 10,
                min: 1,
                max: 50,
            },
            {
                name: "engine",
                type: "string",
                required: false,
                description: "Search engine to use",
                default: "duckduckgo",
                enum: ["duckduckgo", "searx", "google"],
            },
        ]);
        this.searchEngines = [
            new DuckDuckGoEngine(),
            new SearxEngine(),
            // Google engine would require API key
        ];
    }
    async execute(params) {
        const validation = this.validateParameters(params);
        if (!validation.valid) {
            return this.error(validation.errors.join(", "));
        }
        try {
            const limit = params.limit || 10;
            const engineName = params.engine || "duckduckgo";
            const engine = this.searchEngines.find((e) => e.name === engineName);
            if (!engine) {
                return this.error(`Search engine ${engineName} not found`);
            }
            const results = await engine.search(params.query, limit);
            return this.success({
                results,
                query: params.query,
                engine: engineName,
                count: results.length,
            });
        }
        catch (error) {
            return this.error(error);
        }
    }
}
class SearchEngine {
}
class DuckDuckGoEngine extends SearchEngine {
    name = "duckduckgo";
    async search(query, limit) {
        try {
            // Use DuckDuckGo Instant Answer API for search
            const response = await axios.get("https://api.duckduckgo.com/", {
                params: {
                    q: query,
                    format: "json",
                    no_html: "1",
                    skip_disambig: "1",
                },
                timeout: 10000,
                headers: {
                    "User-Agent": "CrewAI-Team-Search/1.0",
                },
            });
            const results = [];
            const data = response.data;
            // Add main result if available
            if (data.Abstract && data.AbstractURL) {
                results.push({
                    title: data.Heading || query,
                    url: data.AbstractURL,
                    snippet: data.Abstract,
                });
            }
            // Add related topics
            if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                for (const topic of data.RelatedTopics.slice(0, limit - results.length)) {
                    if (topic.FirstURL && topic.Text) {
                        results.push({
                            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 60),
                            url: topic.FirstURL,
                            snippet: topic.Text,
                        });
                    }
                }
            }
            // Add results from answer types
            if (data.Answer) {
                results.push({
                    title: `Answer: ${query}`,
                    url: data.AnswerURL ||
                        `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    snippet: data.Answer,
                });
            }
            // If we still don't have enough results, add a fallback search link
            if (results.length === 0) {
                results.push({
                    title: `Search results for: ${query}`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    snippet: `No direct results found. Click to search for "${query}" on DuckDuckGo.`,
                });
            }
            return results.slice(0, limit);
        }
        catch (error) {
            console.error("DuckDuckGo search failed:", error);
            // Return fallback result with search link
            return [
                {
                    title: `Search for: ${query}`,
                    url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    snippet: `Error occurred during search. Click to search for "${query}" manually.`,
                },
            ];
        }
    }
}
class SearxEngine extends SearchEngine {
    name = "searx";
    baseUrl = "https://searx.me"; // Or your own Searx instance
    async search(query, limit) {
        try {
            const url = `${this.baseUrl}/search`;
            const response = await axios.get(url, {
                params: {
                    q: query,
                    format: "json",
                    limit,
                },
            });
            return response.data.results.map((result) => ({
                title: result.title,
                url: result.url,
                snippet: result.content || "",
            }));
        }
        catch (error) {
            console.error("Searx search failed:", error);
            // Fallback to empty results
            return [];
        }
    }
}
// Export for use in other tools
export class SearchEngineWrapper {
    async search(query, limit = 10) {
        const tool = new WebSearchTool();
        const result = await tool.execute({ query, limit });
        if (result.success && result.data) {
            return result.data.results;
        }
        return [];
    }
}
//# sourceMappingURL=WebSearchTool.js.map