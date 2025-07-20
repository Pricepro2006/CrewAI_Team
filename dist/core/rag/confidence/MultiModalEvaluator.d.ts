/**
 * MultiModalEvaluator - Evaluates responses using multiple evaluation methods
 * Combines factuality, relevance, and coherence scoring for comprehensive evaluation
 */
import { type ResponseEvaluationResult, type ScoredDocument, type TokenConfidence, ActionType } from './types.js';
export declare class MultiModalEvaluator {
    private relevanceScorer;
    private factualityChecker;
    private coherenceAnalyzer;
    private evaluationHistory;
    constructor();
    /**
     * Comprehensive evaluation of response
     */
    evaluate(query: string, response: string, sources: ScoredDocument[], tokenConfidence: TokenConfidence[]): Promise<ResponseEvaluationResult>;
    /**
     * Quick evaluation for simple cases
     */
    quickEvaluate(query: string, response: string, baseConfidence?: number): ResponseEvaluationResult;
    /**
     * Evaluate relevance
     */
    private evaluateRelevance;
    /**
     * Evaluate factuality
     */
    private evaluateFactuality;
    /**
     * Evaluate coherence
     */
    private evaluateCoherence;
    /**
     * Calculate completeness score
     */
    private calculateCompleteness;
    /**
     * Calculate consistency score
     */
    private calculateConsistency;
    /**
     * Calculate overall confidence
     */
    private calculateOverallConfidence;
    /**
     * Determine recommended action
     */
    private determineAction;
    /**
     * Check if human review is needed
     */
    private requiresHumanReview;
    /**
     * Identify uncertainty areas
     */
    private identifyUncertaintyAreas;
    /**
     * Extract supporting evidence
     */
    private extractSupportingEvidence;
    /**
     * Extract contradictory evidence
     */
    private extractContradictoryEvidence;
    /**
     * Create fallback evaluation
     */
    private createFallbackEvaluation;
    /**
     * Get evaluation history
     */
    getEvaluationHistory(): ResponseEvaluationResult[];
    /**
     * Get evaluation statistics
     */
    getEvaluationStats(): {
        totalEvaluations: number;
        averageConfidence: number;
        actionDistribution: Record<ActionType, number>;
    };
}
//# sourceMappingURL=MultiModalEvaluator.d.ts.map