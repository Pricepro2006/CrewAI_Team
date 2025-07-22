/**
 * FactualityChecker - Evaluates factual accuracy of responses
 * Checks response claims against source documents
 */
import type { ScoredDocument } from '../types.js';
export interface FactualityResult {
    score: number;
    verifiableClaims: string[];
    supportedClaims: string[];
    unsupportedClaims: string[];
    contradictedClaims: string[];
    confidence: number;
}
export declare class FactualityChecker {
    /**
     * Check factual accuracy of response against sources
     */
    checkFactuality(response: string, sources: ScoredDocument[]): FactualityResult;
    /**
     * Extract factual claims from response
     */
    private extractClaims;
    /**
     * Check if sentence contains factual claims
     */
    private isFactualSentence;
    /**
     * Check if claim is verifiable
     */
    private isVerifiable;
    /**
     * Verify claim against sources
     */
    private verifyClaim;
    /**
     * Check if source directly supports claim
     */
    private supportsClaimDirectly;
    /**
     * Check if source contradicts claim
     */
    private contradictsClaimDirectly;
    /**
     * Extract keywords from claim
     */
    private extractKeywords;
    /**
     * Check if word is a stop word
     */
    private isStopWord;
    /**
     * Calculate factuality score
     */
    private calculateFactualityScore;
    /**
     * Calculate confidence in factuality assessment
     */
    private calculateConfidence;
    /**
     * Check specific fact types
     */
    checkSpecificFactTypes(response: string, sources: ScoredDocument[]): {
        numbers: {
            claim: string;
            verified: boolean;
        }[];
        dates: {
            claim: string;
            verified: boolean;
        }[];
        names: {
            claim: string;
            verified: boolean;
        }[];
        locations: {
            claim: string;
            verified: boolean;
        }[];
    };
    /**
     * Extract and verify numbers
     */
    private extractAndVerifyNumbers;
    /**
     * Extract and verify dates
     */
    private extractAndVerifyDates;
    /**
     * Extract and verify names
     */
    private extractAndVerifyNames;
    /**
     * Extract and verify locations
     */
    private extractAndVerifyLocations;
}
//# sourceMappingURL=FactualityChecker.d.ts.map