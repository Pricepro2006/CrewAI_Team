/**
 * QueryComplexityAnalyzer - Analyzes query complexity for confidence scoring
 * Determines routing strategy based on query characteristics
 */
import { QueryComplexity } from './types.js';
export declare class QueryComplexityAnalyzer {
    private complexityCache;
    private readonly cacheSize;
    /**
     * Assess the complexity of a query
     */
    assessComplexity(query: string): Promise<QueryComplexity>;
    /**
     * Calculate complexity score and factors
     */
    private calculateComplexity;
    /**
     * Calculate syntactic complexity
     */
    private calculateSyntacticComplexity;
    /**
     * Calculate semantic complexity
     */
    private calculateSemanticComplexity;
    /**
     * Calculate domain specificity
     */
    private calculateDomainSpecificity;
    /**
     * Detect multi-intent queries
     */
    private detectMultiIntent;
    /**
     * Calculate ambiguity score
     */
    private calculateAmbiguity;
    /**
     * Calculate overall complexity score
     */
    private calculateOverallScore;
    /**
     * Classify complexity level
     */
    private classifyComplexity;
    /**
     * Generate reasoning explanation
     */
    private generateReasoning;
    /**
     * Generate cache key
     */
    private getCacheKey;
    /**
     * Cache result with size limit
     */
    private cacheResult;
    /**
     * Get cached complexity analysis
     */
    getCachedComplexity(query: string): QueryComplexity | null;
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
//# sourceMappingURL=QueryComplexityAnalyzer.d.ts.map