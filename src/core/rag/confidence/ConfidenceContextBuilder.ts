/**
 * ConfidenceContextBuilder - Builds context for LLM with confidence indicators
 * Formats retrieved documents with confidence levels for optimal response generation
 */

import type { ScoredDocument, ConfidenceConfig } from "./types";
import { getConfidenceConfig } from "../../../config/confidence.config";

export interface ContextBuildOptions {
  maxContextLength?: number;
  includeMetadata?: boolean;
  includeConfidenceLabels?: boolean;
  confidenceFormat?: "label" | "percentage" | "both";
  separateByConfidence?: boolean;
  mode?: "standard" | "summarized" | "detailed";
}

export class ConfidenceContextBuilder {
  private config: ConfidenceConfig;

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Build context from scored documents with confidence ordering
   * @param documents Scored documents from retrieval
   * @param query Original query for context
   * @param options Context building options
   * @returns Formatted context string
   */
  buildContext(
    documents: ScoredDocument[],
    query: string,
    options: ContextBuildOptions = {},
  ): string {
    const {
      maxContextLength = 4000,
      includeMetadata = true,
      includeConfidenceLabels = true,
      confidenceFormat = "both",
      separateByConfidence = true,
    } = options;

    if (documents.length === 0) {
      return this.buildEmptyContext(query);
    }

    // Sort documents by confidence if not already sorted
    const sortedDocs = [...documents].sort(
      (a, b) => b.confidenceScore - a.confidenceScore,
    );

    // Group documents by confidence level if requested
    if (separateByConfidence) {
      return this.buildSeparatedContext(sortedDocs, query, options);
    }

    // Build unified context
    return this.buildUnifiedContext(sortedDocs, query, options);
  }

  /**
   * Build context with documents separated by confidence level
   */
  private buildSeparatedContext(
    documents: ScoredDocument[],
    query: string,
    options: ContextBuildOptions,
  ): string {
    const { high, medium, low } = this.groupByConfidence(documents);
    const parts: string[] = [];

    // Add query context
    parts.push(this.formatQueryContext(query));
    parts.push("");

    // High confidence documents
    if (high.length > 0) {
      parts.push("## HIGH CONFIDENCE SOURCES");
      parts.push("These sources are highly relevant and reliable:");
      parts.push("");
      high.forEach((doc, index) => {
        parts.push(this.formatDocument(doc, index + 1, options));
        parts.push("");
      });
    }

    // Medium confidence documents
    if (medium.length > 0) {
      parts.push("## MEDIUM CONFIDENCE SOURCES");
      parts.push("These sources are moderately relevant:");
      parts.push("");
      medium.forEach((doc, index) => {
        parts.push(this.formatDocument(doc, index + 1, options));
        parts.push("");
      });
    }

    // Low confidence documents
    if (low.length > 0) {
      parts.push("## LOW CONFIDENCE SOURCES");
      parts.push("These sources may be tangentially related:");
      parts.push("");
      low.forEach((doc, index) => {
        parts.push(this.formatDocument(doc, index + 1, options));
        parts.push("");
      });
    }

    // Add confidence guidance
    parts.push(this.getConfidenceGuidance(documents));

    return this.truncateContext(
      parts.join("\n"),
      options.maxContextLength || 4000,
    );
  }

  /**
   * Build unified context without separation
   */
  private buildUnifiedContext(
    documents: ScoredDocument[],
    query: string,
    options: ContextBuildOptions,
  ): string {
    const parts: string[] = [];

    // Add query context
    parts.push(this.formatQueryContext(query));
    parts.push("");
    parts.push("## RETRIEVED SOURCES");
    parts.push("");

    // Add documents
    documents.forEach((doc, index) => {
      parts.push(this.formatDocument(doc, index + 1, options));
      parts.push("");
    });

    // Add confidence summary
    parts.push(this.getConfidenceSummary(documents));

    return this.truncateContext(
      parts.join("\n"),
      options.maxContextLength || 4000,
    );
  }

  /**
   * Format a single document with confidence indicators
   */
  private formatDocument(
    doc: ScoredDocument,
    index: number,
    options: ContextBuildOptions,
  ): string {
    const parts: string[] = [];

    // Header with confidence
    const confidenceLabel = this.getConfidenceLabel(doc.confidenceScore);
    const confidenceStr = this.formatConfidence(
      doc.confidenceScore,
      options.confidenceFormat || "both",
    );

    parts.push(`### Source ${index} [${confidenceStr}]`);

    // Metadata if requested
    if (options.includeMetadata && doc.metadata) {
      const metaStr = this.formatMetadata(doc.metadata);
      if (metaStr) {
        parts.push(`*${metaStr}*`);
      }
    }

    // Content
    parts.push("");
    parts.push(doc.content);

    // Confidence indicator for low confidence
    if (doc.confidenceScore < this.config.overall.medium) {
      parts.push("");
      parts.push(
        `⚠️ Note: This source has ${confidenceLabel} relevance to your query.`,
      );
    }

    return parts.join("\n");
  }

  /**
   * Format confidence value based on format option
   */
  private formatConfidence(
    score: number,
    format: "label" | "percentage" | "both",
  ): string {
    const label = this.getConfidenceLabel(score);
    const percentage = Math.round(score * 100);

    switch (format) {
      case "label":
        return label.toUpperCase();
      case "percentage":
        return `${percentage}%`;
      case "both":
      default:
        return `${label.toUpperCase()} - ${percentage}%`;
    }
  }

  /**
   * Get confidence label for a score
   */
  private getConfidenceLabel(score: number): string {
    if (score >= this.config.overall.high) return "high";
    if (score >= this.config.overall.medium) return "medium";
    if (score >= this.config.overall.low) return "low";
    return "very low";
  }

  /**
   * Group documents by confidence level
   */
  private groupByConfidence(documents: ScoredDocument[]): {
    high: ScoredDocument[];
    medium: ScoredDocument[];
    low: ScoredDocument[];
  } {
    const high: ScoredDocument[] = [];
    const medium: ScoredDocument[] = [];
    const low: ScoredDocument[] = [];

    documents.forEach((doc) => {
      if (doc.confidenceScore >= this.config.overall.high) {
        high.push(doc);
      } else if (doc.confidenceScore >= this.config.overall.medium) {
        medium.push(doc);
      } else {
        low.push(doc);
      }
    });

    return { high, medium, low };
  }

  /**
   * Format metadata for display
   */
  private formatMetadata(metadata: Record<string, any>): string {
    const relevant = [];

    if (metadata.source) {
      relevant.push(`Source: ${metadata.source}`);
    }
    if (metadata.sourceId) {
      relevant.push(`ID: ${metadata.sourceId}`);
    }
    if (metadata.timestamp) {
      relevant.push(
        `Updated: ${new Date(metadata.timestamp).toLocaleDateString()}`,
      );
    }
    if (metadata.chunkIndex !== undefined && metadata.totalChunks) {
      relevant.push(
        `Part ${metadata.chunkIndex + 1} of ${metadata.totalChunks}`,
      );
    }

    return relevant.join(" | ");
  }

  /**
   * Format query context
   */
  private formatQueryContext(query: string): string {
    return `## QUERY CONTEXT\n\nUser Query: "${query}"`;
  }

  /**
   * Build context for empty results
   */
  private buildEmptyContext(query: string): string {
    return `## QUERY CONTEXT

User Query: "${query}"

## NO RELEVANT SOURCES FOUND

I couldn't find any relevant information in the knowledge base for your query. 
I'll provide a response based on my general knowledge, but please note that 
this information may not be specific to your context or may be outdated.

If you're looking for specific documentation or recent information, please try:
- Rephrasing your query with different keywords
- Being more specific about what you're looking for
- Checking if the topic exists in the knowledge base`;
  }

  /**
   * Get confidence guidance based on document distribution
   */
  private getConfidenceGuidance(documents: ScoredDocument[]): string {
    const { high, medium, low } = this.groupByConfidence(documents);
    const total = documents.length;

    if (high.length === total) {
      return "✅ All sources are highly relevant to your query.";
    }

    if (high.length === 0 && medium.length === 0) {
      return "⚠️ Only low-confidence sources were found. The response may not fully address your query.";
    }

    if (high.length > 0) {
      return `ℹ️ Found ${high.length} highly relevant source${high.length > 1 ? "s" : ""} and ${total - high.length} additional reference${total - high.length > 1 ? "s" : ""}.`;
    }

    return `ℹ️ Found ${medium.length} moderately relevant source${medium.length > 1 ? "s" : ""} for your query.`;
  }

  /**
   * Get confidence summary
   */
  private getConfidenceSummary(documents: ScoredDocument[]): string {
    const avgConfidence =
      documents.reduce((sum, doc) => sum + doc.confidenceScore, 0) /
      documents.length;
    const { high, medium, low } = this.groupByConfidence(documents);

    return `## CONFIDENCE SUMMARY

- Average relevance: ${Math.round(avgConfidence * 100)}%
- High confidence sources: ${high.length}
- Medium confidence sources: ${medium.length}
- Low confidence sources: ${low.length}

${this.getConfidenceGuidance(documents)}`;
  }

  /**
   * Truncate context to maximum length
   */
  private truncateContext(context: string, maxLength: number): string {
    if (context.length <= maxLength) {
      return context;
    }

    // Find a good truncation point (end of sentence or paragraph)
    let truncateAt = maxLength;

    // Try to find end of sentence
    const sentenceEnd = context.lastIndexOf(".", maxLength);
    if (sentenceEnd > maxLength * 0.8) {
      truncateAt = sentenceEnd + 1;
    } else {
      // Try to find end of paragraph
      const paragraphEnd = context.lastIndexOf("\n\n", maxLength);
      if (paragraphEnd > maxLength * 0.8) {
        truncateAt = paragraphEnd;
      }
    }

    return (
      context.substring(0, truncateAt) +
      "\n\n[Context truncated due to length limits]"
    );
  }

  /**
   * Build specialized context for different response types
   */
  buildSpecializedContext(
    documents: ScoredDocument[],
    query: string,
    responseType: "factual" | "explanatory" | "creative" | "analytical",
  ): string {
    const baseOptions: ContextBuildOptions = {
      includeConfidenceLabels: true,
      includeMetadata: true,
    };

    switch (responseType) {
      case "factual":
        // For factual queries, prioritize high confidence and include warnings
        return this.buildContext(
          documents.filter(
            (d) => d.confidenceScore >= this.config.overall.medium,
          ),
          query,
          {
            ...baseOptions,
            confidenceFormat: "percentage",
            separateByConfidence: true,
          },
        );

      case "explanatory":
        // For explanations, include all sources but clearly separate by confidence
        return this.buildContext(documents, query, {
          ...baseOptions,
          separateByConfidence: true,
          confidenceFormat: "both",
        });

      case "creative":
        // For creative tasks, confidence is less critical
        return this.buildContext(documents, query, {
          ...baseOptions,
          separateByConfidence: false,
          confidenceFormat: "label",
        });

      case "analytical":
        // For analysis, include all data with detailed confidence metrics
        return this.buildContext(documents, query, {
          ...baseOptions,
          separateByConfidence: true,
          confidenceFormat: "both",
          includeMetadata: true,
        });

      default:
        return this.buildContext(documents, query, baseOptions);
    }
  }
}
