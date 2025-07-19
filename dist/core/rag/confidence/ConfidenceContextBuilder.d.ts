/**
 * ConfidenceContextBuilder - Builds context from retrieved documents
 * Optimizes context for confidence-aware generation
 */
import { ScoredDocument, ContextOptions, BuiltContext } from './types.js';
export declare class ConfidenceContextBuilder {
    private readonly maxTokensDefault;
    private readonly minTokensPerDoc;
    /**
     * Build context from scored documents
     */
    buildContext(documents: ScoredDocument[], query: string, options: ContextOptions): BuiltContext;
    /**
     * Prioritize documents based on confidence and relevance
     */
    private prioritizeDocuments;
    /**
     * Apply temporal prioritization
     */
    private applyTemporalPrioritization;
    /**
     * Build unified context (single flowing text)
     */
    private buildUnifiedContext;
    /**
     * Build sectioned context (clear document boundaries)
     */
    private buildSectionedContext;
    /**
     * Build hierarchical context (organized by confidence/relevance)
     */
    private buildHierarchicalContext;
    /**
     * Build confidence-based section
     */
    private buildConfidenceSection;
    /**
     * Format document for unified context
     */
    private formatDocumentForUnified;
    /**
     * Format document for sectioned context
     */
    private formatDocumentForSectioned;
    /**
     * Format document for hierarchical context
     */
    private formatDocumentForHierarchical;
    /**
     * Estimate token count (rough approximation)
     */
    private estimateTokens;
    /**
     * Truncate content to fit token limit
     */
    private truncateContent;
    /**
     * Calculate context confidence
     */
    private calculateContextConfidence;
    /**
     * Get context summary
     */
    getContextSummary(context: BuiltContext): string;
}
//# sourceMappingURL=ConfidenceContextBuilder.d.ts.map