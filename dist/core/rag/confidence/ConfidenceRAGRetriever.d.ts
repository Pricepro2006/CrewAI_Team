/**
 * ConfidenceRAGRetriever - Retrieves documents with confidence scoring
 * Integrates with vector stores and applies confidence-based filtering
 */
import { VectorStore } from '../VectorStore';
import { RetrievalResult, RetrievalOptions } from './types.js';
export declare class ConfidenceRAGRetriever {
    private vectorStore;
    private retrievalCache;
    private readonly cacheSize;
    private readonly defaultCacheTTL;
    constructor(vectorStore: VectorStore);
    /**
     * Retrieve documents with confidence scoring
     */
    retrieve(query: string, options: RetrievalOptions): Promise<RetrievalResult>;
    /**
     * Score documents with confidence metrics
     */
    private scoreDocuments;
    /**
     * Extract key terms from query
     */
    private extractQueryTerms;
    /**
     * Calculate term coverage score
     */
    private calculateTermCoverage;
    /**
     * Calculate context relevance score
     */
    private calculateContextRelevance;
    /**
     * Assess document quality
     */
    private assessDocumentQuality;
    /**
     * Combine confidence scores
     */
    private combineConfidenceScores;
    /**
     * Apply confidence-based filtering
     */
    private applyConfidenceFiltering;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Get cached result if valid
     */
    private getCachedResult;
    /**
     * Cache result with size limit
     */
    private cacheResult;
    /**
     * Retrieve with custom scoring function
     */
    retrieveWithCustomScoring(query: string, options: RetrievalOptions, scoringFunction: (query: string, doc: any) => number): Promise<RetrievalResult>;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
    };
}
//# sourceMappingURL=ConfidenceRAGRetriever.d.ts.map