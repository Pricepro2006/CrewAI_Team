/**
 * ConfidenceResponseGenerator - Generates responses with confidence scoring
 * Uses LLM to generate responses with token-level confidence tracking
 */
import type { OllamaProvider } from '../../llm/OllamaProvider';
import type { GenerationRequest, GenerationResult, GenerationOptions } from './types.js';
export declare class ConfidenceResponseGenerator {
    private llm;
    private defaultOptions;
    constructor(llm: OllamaProvider);
    /**
     * Generate response with confidence scoring
     */
    generateWithConfidence(request: GenerationRequest): Promise<GenerationResult>;
    /**
     * Build confidence-aware prompt
     */
    private buildConfidencePrompt;
    /**
     * Extract token-level confidence (simplified version)
     */
    private extractTokenConfidence;
    /**
     * Check if word is an uncertainty marker
     */
    private isUncertaintyMarker;
    /**
     * Check if word is a definitive marker
     */
    private isDefinitiveMarker;
    /**
     * Calculate raw confidence score
     */
    private calculateRawConfidence;
    /**
     * Identify uncertainty areas in the response
     */
    private identifyUncertaintyAreas;
    /**
     * Generate reasoning for the confidence score
     */
    private generateReasoning;
    /**
     * Generate response with streaming confidence
     */
    generateStreamingWithConfidence(request: GenerationRequest, onToken: (token: string, confidence: number) => void): Promise<GenerationResult>;
    /**
     * Update generation options
     */
    setDefaultOptions(options: Partial<GenerationOptions>): void;
    /**
     * Get generation statistics
     */
    getGenerationStats(): {
        averageConfidence: number;
        totalGenerations: number;
        averageTime: number;
    };
}
//# sourceMappingURL=ConfidenceResponseGenerator.d.ts.map