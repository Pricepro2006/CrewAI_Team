import { BaseTool } from "../base/BaseTool";
import type { ToolResult } from "../base/BaseTool";
export declare class WebSearchTool extends BaseTool {
    private searchEngines;
    constructor();
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
export declare class SearchEngineWrapper {
    search(query: string, limit?: number): Promise<SearchResult[]>;
}
export {};
//# sourceMappingURL=WebSearchTool.d.ts.map