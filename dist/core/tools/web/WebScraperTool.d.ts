import { BaseTool } from '../base/BaseTool';
import type { ToolResult } from '../base/BaseTool';
export declare class WebScraperTool extends BaseTool {
    constructor();
    execute(params: {
        url: string;
        selector?: string;
        extractImages?: boolean;
        extractLinks?: boolean;
        cleanText?: boolean;
    }): Promise<ToolResult>;
    private extractContent;
    private extractImages;
    private extractLinks;
    private extractMetadata;
    private resolveUrl;
}
//# sourceMappingURL=WebScraperTool.d.ts.map