/**
 * RelevanceScorer - Evaluates response relevance to the query
 * Measures semantic similarity and intent fulfillment
 */
import { ScoredDocument } from '../types.js';
export interface RelevanceResult {
    score: number;
    semanticSimilarity: number;
    termCoverage: number;
    intentFulfillment: number;
    keyTermsMatched: string[];
    missingKeyTerms: string[];
}
export declare class RelevanceScorer {
    /**
     * Calculate overall relevance score
     * @param query Original user query
     * @param response Generated response
     * @param sources Source documents used
     * @returns Relevance result with detailed metrics
     */
    calculateRelevance(query: string, response: string, _sources: ScoredDocument[]): RelevanceResult;
    /**
     * Extract meaningful terms from query
     */
    private extractQueryTerms;
    /**
     * Extract terms from response
     */
    private extractResponseTerms;
    /**
     * Extract meaningful phrases (e.g., "machine learning", "artificial intelligence")
     */
    private extractPhrases;
    /**
     * Identify the intent of the query
     */
    private identifyQueryIntent;
    /**
     * Calculate semantic similarity between query and response
     * Simplified version - in production, use embeddings
     */
    private calculateSemanticSimilarity;
    /**
     * Calculate term coverage
     */
    private calculateTermCoverage;
    /**
     * Check if terms match (including variations)
     */
    private termsMatch;
    /**
     * Simple stemming function
     */
    private simpleStem;
    /**
     * Assess intent fulfillment
     */
    private assessIntentFulfillment;
    /**
     * Check if response directly addresses the query
     */
    isDirectlyRelevant(relevanceResult: RelevanceResult): boolean;
    /**
     * Get relevance category
     */
    getRelevanceCategory(score: number): 'high' | 'medium' | 'low' | 'off-topic';
}
//# sourceMappingURL=RelevanceScorer.d.ts.map