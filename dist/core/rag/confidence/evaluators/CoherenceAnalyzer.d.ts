/**
 * CoherenceAnalyzer - Evaluates coherence and logical flow of responses
 * Analyzes response structure, consistency, and readability
 */
import type { TokenConfidence } from '../types.js';
export interface CoherenceResult {
    score: number;
    structuralCoherence: number;
    logicalFlow: number;
    linguisticCoherence: number;
    topicConsistency: number;
    readabilityScore: number;
    issues: string[];
}
export declare class CoherenceAnalyzer {
    /**
     * Analyze response coherence
     */
    analyzeCoherence(response: string, tokenConfidence?: TokenConfidence[]): CoherenceResult;
    /**
     * Analyze structural coherence
     */
    private analyzeStructuralCoherence;
    /**
     * Analyze logical flow
     */
    private analyzeLogicalFlow;
    /**
     * Analyze linguistic coherence
     */
    private analyzeLinguisticCoherence;
    /**
     * Analyze topic consistency
     */
    private analyzeTopicConsistency;
    /**
     * Calculate readability score
     */
    private calculateReadabilityScore;
    /**
     * Extract topic words from text
     */
    private extractTopicWords;
    /**
     * Calculate overall coherence score
     */
    private calculateOverallCoherence;
    /**
     * Identify specific coherence issues
     */
    private identifyCoherenceIssues;
    /**
     * Get coherence category
     */
    getCoherenceCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor';
    /**
     * Suggest improvements
     */
    suggestImprovements(result: CoherenceResult): string[];
}
//# sourceMappingURL=CoherenceAnalyzer.d.ts.map