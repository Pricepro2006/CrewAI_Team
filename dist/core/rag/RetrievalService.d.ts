import type { QueryResult, RetrievalConfig } from "./types";
export declare class RetrievalService {
    private config;
    constructor(config: RetrievalConfig);
    enhance(query: string, results: QueryResult[]): Promise<QueryResult[]>;
    private filterByScore;
    private rerank;
    private diversify;
    private calculateDiversity;
    private calculateOverlap;
    private boostRecentDocuments;
    private extractTerms;
    filterByMetadata(results: QueryResult[], filters: Record<string, any>): Promise<QueryResult[]>;
    highlightMatches(query: string, results: QueryResult[]): QueryResult[];
}
//# sourceMappingURL=RetrievalService.d.ts.map