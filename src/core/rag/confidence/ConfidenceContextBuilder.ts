/**
 * ConfidenceContextBuilder - Builds context from retrieved documents
 * Optimizes context for confidence-aware generation
 */

import type { ScoredDocument, ContextOptions, BuiltContext } from './types.js';

export class ConfidenceContextBuilder {
  private readonly maxTokensDefault = 4000;
  private readonly minTokensPerDoc = 100;

  /**
   * Build context from scored documents
   */
  buildContext(
    documents: ScoredDocument[],
    query: string,
    options: ContextOptions
  ): BuiltContext {
    const maxTokens = options.maxTokens || this.maxTokensDefault;
    const warnings: string[] = [];

    // Filter and prioritize documents
    const prioritizedDocs = this.prioritizeDocuments(documents, query, options);

    // Build context based on mode
    let content: string;
    let usedDocs: ScoredDocument[];
    let estimatedTokens: number;

    switch (options.mode) {
      case 'unified':
        ({ content, usedDocs, estimatedTokens } = this.buildUnifiedContext(
          prioritizedDocs,
          query,
          maxTokens,
          options
        ));
        break;
      case 'sectioned':
        ({ content, usedDocs, estimatedTokens } = this.buildSectionedContext(
          prioritizedDocs,
          query,
          maxTokens,
          options
        ));
        break;
      case 'hierarchical':
        ({ content, usedDocs, estimatedTokens } = this.buildHierarchicalContext(
          prioritizedDocs,
          query,
          maxTokens,
          options
        ));
        break;
      default:
        ({ content, usedDocs, estimatedTokens } = this.buildUnifiedContext(
          prioritizedDocs,
          query,
          maxTokens,
          options
        ));
    }

    // Calculate overall confidence
    const confidence = this.calculateContextConfidence(usedDocs, query);

    // Add warnings if necessary
    if (usedDocs.length < documents.length) {
      warnings.push(`Context limited to ${usedDocs.length} of ${documents.length} documents due to token constraints`);
    }

    if (confidence < 0.6) {
      warnings.push('Context confidence is below recommended threshold');
    }

    if (estimatedTokens > maxTokens * 0.9) {
      warnings.push('Context is near token limit, may be truncated');
    }

    return {
      content,
      sources: usedDocs,
      totalTokens: estimatedTokens,
      confidence,
      warnings
    };
  }

  /**
   * Prioritize documents based on confidence and relevance
   */
  private prioritizeDocuments(
    documents: ScoredDocument[],
    query: string,
    options: ContextOptions
  ): ScoredDocument[] {
    // Sort by confidence and relevance
    const sorted = [...documents].sort((a, b) => {
      // Primary sort by confidence
      const confidenceDiff = b.confidence - a.confidence;
      if (Math.abs(confidenceDiff) > 0.1) {
        return confidenceDiff;
      }

      // Secondary sort by relevance score
      const relevanceDiff = (b.relevanceScore || 0) - (a.relevanceScore || 0);
      if (Math.abs(relevanceDiff) > 0.1) {
        return relevanceDiff;
      }

      // Tertiary sort by vector score
      return b.score - a.score;
    });

    // Apply time-based prioritization if requested
    if (options.prioritizeRecent) {
      return this.applyTemporalPrioritization(sorted);
    }

    return sorted;
  }

  /**
   * Apply temporal prioritization
   */
  private applyTemporalPrioritization(documents: ScoredDocument[]): ScoredDocument[] {
    const now = Date.now();
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    return documents.map(doc => {
      if (doc.timestamp) {
        const age = now - new Date(doc.timestamp).getTime();
        const recencyBonus = Math.max(0, 1 - (age / oneYearMs)) * 0.1;
        
        return {
          ...doc,
          confidence: Math.min(1, doc.confidence + recencyBonus)
        };
      }
      return doc;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Build unified context (single flowing text)
   */
  private buildUnifiedContext(
    documents: ScoredDocument[],
    query: string,
    maxTokens: number,
    options: ContextOptions
  ): { content: string; usedDocs: ScoredDocument[]; estimatedTokens: number } {
    const usedDocs: ScoredDocument[] = [];
    const sections: string[] = [];
    let estimatedTokens = 0;

    // Add query context
    const queryContext = `Query: ${query}\n\nRelevant information:\n\n`;
    sections.push(queryContext);
    estimatedTokens += this.estimateTokens(queryContext);

    for (const doc of documents) {
      const docSection = this.formatDocumentForUnified(doc, options);
      const docTokens = this.estimateTokens(docSection);

      // Check if we have room for this document
      if (estimatedTokens + docTokens <= maxTokens) {
        sections.push(docSection);
        usedDocs.push(doc);
        estimatedTokens += docTokens;
      } else {
        // Try to include partial content
        const remainingTokens = maxTokens - estimatedTokens;
        if (remainingTokens > this.minTokensPerDoc) {
          const partialSection = this.truncateContent(docSection, remainingTokens);
          sections.push(partialSection);
          usedDocs.push(doc);
          estimatedTokens += this.estimateTokens(partialSection);
        }
        break;
      }
    }

    return {
      content: sections.join('\n'),
      usedDocs,
      estimatedTokens
    };
  }

  /**
   * Build sectioned context (clear document boundaries)
   */
  private buildSectionedContext(
    documents: ScoredDocument[],
    query: string,
    maxTokens: number,
    options: ContextOptions
  ): { content: string; usedDocs: ScoredDocument[]; estimatedTokens: number } {
    const usedDocs: ScoredDocument[] = [];
    const sections: string[] = [];
    let estimatedTokens = 0;

    // Add query context
    const queryContext = `Query: ${query}\n\nRelevant Documents:\n\n`;
    sections.push(queryContext);
    estimatedTokens += this.estimateTokens(queryContext);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      if (!doc) continue;
      
      const docSection = this.formatDocumentForSectioned(doc, i + 1, options);
      const docTokens = this.estimateTokens(docSection);

      if (estimatedTokens + docTokens <= maxTokens) {
        sections.push(docSection);
        usedDocs.push(doc);
        estimatedTokens += docTokens;
      } else {
        break;
      }
    }

    return {
      content: sections.join('\n'),
      usedDocs,
      estimatedTokens
    };
  }

  /**
   * Build hierarchical context (organized by confidence/relevance)
   */
  private buildHierarchicalContext(
    documents: ScoredDocument[],
    query: string,
    maxTokens: number,
    options: ContextOptions
  ): { content: string; usedDocs: ScoredDocument[]; estimatedTokens: number } {
    const usedDocs: ScoredDocument[] = [];
    const sections: string[] = [];
    let estimatedTokens = 0;

    // Add query context
    const queryContext = `Query: ${query}\n\n`;
    sections.push(queryContext);
    estimatedTokens += this.estimateTokens(queryContext);

    // Group documents by confidence level
    const highConfidence = documents.filter(doc => doc.confidence >= 0.8);
    const mediumConfidence = documents.filter(doc => doc.confidence >= 0.6 && doc.confidence < 0.8);
    const lowConfidence = documents.filter(doc => doc.confidence < 0.6);

    // Add high confidence section
    if (highConfidence.length > 0) {
      const highSection = this.buildConfidenceSection(
        'High Confidence Information',
        highConfidence,
        maxTokens - estimatedTokens,
        options
      );
      if (highSection.content) {
        sections.push(highSection.content);
        usedDocs.push(...highSection.usedDocs);
        estimatedTokens += highSection.estimatedTokens;
      }
    }

    // Add medium confidence section if space allows
    if (mediumConfidence.length > 0 && estimatedTokens < maxTokens * 0.7) {
      const mediumSection = this.buildConfidenceSection(
        'Medium Confidence Information',
        mediumConfidence,
        maxTokens - estimatedTokens,
        options
      );
      if (mediumSection.content) {
        sections.push(mediumSection.content);
        usedDocs.push(...mediumSection.usedDocs);
        estimatedTokens += mediumSection.estimatedTokens;
      }
    }

    // Add low confidence section if space allows
    if (lowConfidence.length > 0 && estimatedTokens < maxTokens * 0.8) {
      const lowSection = this.buildConfidenceSection(
        'Additional Information (Lower Confidence)',
        lowConfidence,
        maxTokens - estimatedTokens,
        options
      );
      if (lowSection.content) {
        sections.push(lowSection.content);
        usedDocs.push(...lowSection.usedDocs);
        estimatedTokens += lowSection.estimatedTokens;
      }
    }

    return {
      content: sections.join('\n'),
      usedDocs,
      estimatedTokens
    };
  }

  /**
   * Build confidence-based section
   */
  private buildConfidenceSection(
    title: string,
    documents: ScoredDocument[],
    maxTokens: number,
    options: ContextOptions
  ): { content: string; usedDocs: ScoredDocument[]; estimatedTokens: number } {
    const usedDocs: ScoredDocument[] = [];
    const sections: string[] = [];
    let estimatedTokens = 0;

    // Add section header
    const header = `## ${title}\n\n`;
    sections.push(header);
    estimatedTokens += this.estimateTokens(header);

    for (const doc of documents) {
      const docSection = this.formatDocumentForHierarchical(doc, options);
      const docTokens = this.estimateTokens(docSection);

      if (estimatedTokens + docTokens <= maxTokens) {
        sections.push(docSection);
        usedDocs.push(doc);
        estimatedTokens += docTokens;
      } else {
        break;
      }
    }

    return {
      content: sections.length > 1 ? sections.join('\n') : '',
      usedDocs,
      estimatedTokens
    };
  }

  /**
   * Format document for unified context
   */
  private formatDocumentForUnified(doc: ScoredDocument, options: ContextOptions): string {
    let formatted = doc.content;

    if (options.includeConfidence) {
      formatted += ` (Confidence: ${Math.round(doc.confidence * 100)}%)`;
    }

    return formatted + '\n\n';
  }

  /**
   * Format document for sectioned context
   */
  private formatDocumentForSectioned(doc: ScoredDocument, index: number, options: ContextOptions): string {
    let formatted = `### Document ${index}`;
    
    if (options.includeConfidence) {
      formatted += ` (Confidence: ${Math.round(doc.confidence * 100)}%)`;
    }
    
    formatted += '\n\n' + doc.content;

    if (doc.source) {
      formatted += `\n\n*Source: ${doc.source}*`;
    }

    return formatted + '\n\n';
  }

  /**
   * Format document for hierarchical context
   */
  private formatDocumentForHierarchical(doc: ScoredDocument, options: ContextOptions): string {
    let formatted = doc.content;

    if (options.includeConfidence) {
      formatted += ` (${Math.round(doc.confidence * 100)}% confidence)`;
    }

    if (doc.source) {
      formatted += ` [${doc.source}]`;
    }

    return formatted + '\n\n';
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Truncate content to fit token limit
   */
  private truncateContent(content: string, maxTokens: number): string {
    const maxChars = maxTokens * 4;
    if (content.length <= maxChars) {
      return content;
    }

    // Truncate at word boundary
    const truncated = content.substring(0, maxChars);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxChars * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    }

    return truncated + '...';
  }

  /**
   * Calculate context confidence
   */
  private calculateContextConfidence(documents: ScoredDocument[], query: string): number {
    if (documents.length === 0) return 0;

    // Average confidence of included documents
    const avgConfidence = documents.reduce((sum, doc) => sum + doc.confidence, 0) / documents.length;

    // Adjust based on document count
    const countFactor = Math.min(1, documents.length / 3); // Ideal: 3+ documents

    // Adjust based on query coverage
    const queryTerms = query.toLowerCase().split(/\s+/);
    const contextText = documents.map(doc => doc.content).join(' ').toLowerCase();
    const coveredTerms = queryTerms.filter(term => contextText.includes(term));
    const coverageFactor = coveredTerms.length / queryTerms.length;

    return avgConfidence * 0.6 + countFactor * 0.2 + coverageFactor * 0.2;
  }

  /**
   * Get context summary
   */
  getContextSummary(context: BuiltContext): string {
    const summary = [
      `Context built from ${context.sources.length} documents`,
      `Estimated ${context.totalTokens} tokens`,
      `Overall confidence: ${Math.round(context.confidence * 100)}%`
    ];

    if (context.warnings.length > 0) {
      summary.push(`Warnings: ${context.warnings.length}`);
    }

    return summary.join(', ');
  }
}