import { BaseTool } from "../base/BaseTool";
import type { ToolResult } from "../base/BaseTool";
export declare class WebSearchTool extends BaseTool {
    private searchEngines;
    private searchKnowledgeService?;
    constructor();
    private initializeKnowledgeService;
    execute(params: {
        query: string;
        limit?: number;
        engine?: string;
    }): Promise<ToolResult>;
}
interface SearchResult {
    title: string;
    url: string;
    snippet: string;
    timestamp?: string;
}
declare abstract class SearchEngine {
    abstract name: string;
    abstract search(query: string, limit: number): Promise<SearchResult[]>;
}
export type { SearchResult, SearchEngine };
//# sourceMappingURL=WebSearchTool.d.ts.map