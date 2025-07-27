/**
 * AdaptiveDeliveryManager - Manages confidence-based response delivery
 * Formats responses based on confidence levels and handles fallback scenarios
 */

import {
  type ResponseEvaluationResult,
  ActionType,
  type ScoredDocument,
  type ConfidenceConfig,
  type TokenConfidence,
} from "./types";
import { getConfidenceConfig } from "../../../config/confidence.config";

export interface DeliveryOptions {
  includeConfidenceScore?: boolean;
  includeSourceAttribution?: boolean;
  includeUncertaintyWarnings?: boolean;
  includeEvidence?: boolean;
  maxEvidenceItems?: number;
  confidenceFormat?: "percentage" | "category" | "detailed";
  fallbackMessage?: string;
}

export interface DeliveredResponse {
  content: string;
  confidence: {
    score: number;
    category: string;
    display: string;
  };
  evidence?: Evidence[];
  warnings?: string[];
  metadata: ResponseMetadata;
  feedbackId: string;
}

export interface Evidence {
  source: string;
  relevance: number;
  excerpt: string;
  confidence: number;
}

export interface ResponseMetadata {
  action: ActionType;
  humanReviewNeeded: boolean;
  uncertaintyAreas: string[];
  processingTime: number;
  modelUsed?: string;
}

export interface FeedbackCapture {
  feedbackId: string;
  timestamp: number;
  helpful?: boolean;
  accurate?: boolean;
  comments?: string;
  corrections?: string;
}

export class AdaptiveDeliveryManager {
  private config: ConfidenceConfig;
  private feedbackStore: Map<string, FeedbackCapture> = new Map();
  private deliveryHistory: DeliveredResponse[] = [];

  constructor(config?: Partial<ConfidenceConfig>) {
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Deliver response based on evaluation results
   * @param evaluation Response evaluation result
   * @param options Delivery options
   * @returns Delivered response with appropriate formatting
   */
  async deliver(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions = {},
  ): Promise<DeliveredResponse> {
    const startTime = Date.now();

    // Determine delivery strategy based on action
    let deliveredResponse: DeliveredResponse;

    switch (evaluation.recommendedAction) {
      case ActionType.ACCEPT:
        deliveredResponse = this.deliverHighConfidence(evaluation, options);
        break;

      case ActionType.REVIEW:
        deliveredResponse = this.deliverWithCaveats(evaluation, options);
        break;

      case ActionType.REGENERATE:
        deliveredResponse = this.deliverLowConfidence(evaluation, options);
        break;

      case ActionType.FALLBACK:
        deliveredResponse = this.deliverFallback(evaluation, options);
        break;

      default:
        deliveredResponse = this.deliverWithCaveats(evaluation, options);
    }

    // Add processing time
    deliveredResponse.metadata.processingTime = Date.now() - startTime;

    // Store for history and feedback
    this.deliveryHistory.push(deliveredResponse);

    return deliveredResponse;
  }

  /**
   * Deliver high confidence response
   */
  private deliverHighConfidence(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions,
  ): DeliveredResponse {
    const confidence = this.formatConfidence(
      evaluation.overallConfidence,
      options,
    );
    const evidence = this.prepareEvidence(evaluation, options);
    const feedbackId = this.generateFeedbackId();

    let content = evaluation.response;

    // Add confidence indicator if requested
    if (options.includeConfidenceScore) {
      content = `${content}\n\n_Confidence: ${confidence.display}_`;
    }

    // Add source attribution if requested
    if (options.includeSourceAttribution && evidence.length > 0) {
      content += "\n\n**Sources:**";
      evidence.forEach((ev, idx) => {
        content += `\n${idx + 1}. ${ev.source}`;
      });
    }

    return {
      content,
      confidence,
      evidence: options.includeEvidence ? evidence : undefined,
      warnings: [],
      metadata: {
        action: ActionType.ACCEPT,
        humanReviewNeeded: false,
        uncertaintyAreas: evaluation.uncertaintyMarkers || [],
        processingTime: 0,
        modelUsed: evaluation.modelUsed,
      },
      feedbackId,
    };
  }

  /**
   * Deliver response with caveats for medium confidence
   */
  private deliverWithCaveats(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions,
  ): DeliveredResponse {
    const confidence = this.formatConfidence(
      evaluation.overallConfidence,
      options,
    );
    const evidence = this.prepareEvidence(evaluation, options);
    const warnings = this.generateWarnings(evaluation);
    const feedbackId = this.generateFeedbackId();

    let content = evaluation.response;

    // Add uncertainty warnings
    if (options.includeUncertaintyWarnings && warnings.length > 0) {
      content = `⚠️ **Please note:** ${warnings[0]}\n\n${content}`;
    }

    // Always include confidence for medium confidence
    content += `\n\n_Confidence: ${confidence.display}_`;

    // Add evidence with confidence scores
    if (options.includeEvidence && evidence.length > 0) {
      content += "\n\n**Supporting Evidence:**";
      evidence.forEach((ev, idx) => {
        content += `\n${idx + 1}. [${Math.round(ev.confidence * 100)}%] ${ev.excerpt}`;
        content += `\n   _Source: ${ev.source}_`;
      });
    }

    // Add feedback request
    content +=
      "\n\n_This response may benefit from human review. Your feedback helps improve accuracy._";

    return {
      content,
      confidence,
      evidence: options.includeEvidence ? evidence : undefined,
      warnings,
      metadata: {
        action: ActionType.REVIEW,
        humanReviewNeeded: true,
        uncertaintyAreas: evaluation.uncertaintyMarkers || [],
        processingTime: 0,
        modelUsed: evaluation.modelUsed,
      },
      feedbackId,
    };
  }

  /**
   * Deliver low confidence response
   */
  private deliverLowConfidence(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions,
  ): DeliveredResponse {
    const confidence = this.formatConfidence(
      evaluation.overallConfidence,
      options,
    );
    const evidence = this.prepareEvidence(evaluation, options);
    const warnings = this.generateWarnings(evaluation);
    const feedbackId = this.generateFeedbackId();

    // Start with strong disclaimer
    let content = "⚠️ **Low Confidence Response**\n\n";
    content +=
      "The following response has low confidence and may contain inaccuracies:\n\n";
    content += `---\n${evaluation.response}\n---`;

    // Add specific uncertainty areas
    if (
      evaluation.uncertaintyMarkers &&
      evaluation.uncertaintyMarkers.length > 0
    ) {
      content += "\n\n**Areas of Uncertainty:**";
      evaluation.uncertaintyMarkers.forEach((marker, idx) => {
        content += `\n${idx + 1}. ${marker}`;
      });
    }

    // Add evidence if available
    if (evidence.length > 0) {
      content += "\n\n**Limited Evidence Found:**";
      evidence.forEach((ev, idx) => {
        content += `\n${idx + 1}. [${Math.round(ev.confidence * 100)}%] ${ev.excerpt}`;
      });
    }

    // Suggest alternatives
    content += "\n\n**Recommended Actions:**";
    content += "\n- Try rephrasing your question for better results";
    content += "\n- Provide more context or specific details";
    content += "\n- Consult additional sources or human experts";

    return {
      content,
      confidence,
      evidence: options.includeEvidence ? evidence : undefined,
      warnings,
      metadata: {
        action: ActionType.REGENERATE,
        humanReviewNeeded: true,
        uncertaintyAreas: evaluation.uncertaintyMarkers || [],
        processingTime: 0,
        modelUsed: evaluation.modelUsed,
      },
      feedbackId,
    };
  }

  /**
   * Deliver fallback response
   */
  private deliverFallback(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions,
  ): DeliveredResponse {
    const feedbackId = this.generateFeedbackId();
    const fallbackMessage =
      options.fallbackMessage || this.getDefaultFallbackMessage();

    return {
      content: fallbackMessage,
      confidence: {
        score: 0,
        category: "very_low",
        display: "Unable to generate confident response",
      },
      warnings: ["Unable to generate a reliable response for this query"],
      metadata: {
        action: ActionType.FALLBACK,
        humanReviewNeeded: true,
        uncertaintyAreas: ["entire_response"],
        processingTime: 0,
        modelUsed: evaluation.modelUsed,
      },
      feedbackId,
    };
  }

  /**
   * Format confidence for display
   */
  private formatConfidence(
    score: number,
    options: DeliveryOptions,
  ): DeliveredResponse["confidence"] {
    const category = this.getConfidenceCategory(score);

    let display: string;
    switch (options.confidenceFormat) {
      case "percentage":
        display = `${Math.round(score * 100)}%`;
        break;

      case "detailed":
        display = `${Math.round(score * 100)}% (${category})`;
        break;

      case "category":
      default:
        display = category.replace("_", " ");
    }

    return { score, category, display };
  }

  /**
   * Get confidence category
   */
  private getConfidenceCategory(score: number): string {
    if (score >= this.config.overall.high) return "high";
    if (score >= this.config.overall.medium) return "medium";
    if (score >= this.config.overall.low) return "low";
    return "very_low";
  }

  /**
   * Prepare evidence from sources
   */
  private prepareEvidence(
    evaluation: ResponseEvaluationResult,
    options: DeliveryOptions,
  ): Evidence[] {
    if (!evaluation.sources || evaluation.sources.length === 0) {
      return [];
    }

    const maxItems = options.maxEvidenceItems || 3;

    // Sort by confidence and relevance
    const sortedSources = [...evaluation.sources].sort(
      (a, b) => b.confidenceScore - a.confidenceScore,
    );

    return sortedSources.slice(0, maxItems).map((source) => ({
      source:
        source.metadata?.title || source.metadata?.source || "Unknown source",
      relevance: source.score,
      excerpt: this.extractExcerpt(source.content, evaluation.query),
      confidence: source.confidenceScore,
    }));
  }

  /**
   * Extract relevant excerpt from source
   */
  private extractExcerpt(content: string, query: string): string {
    const maxLength = 150;
    const queryTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 3);

    // Find first occurrence of any query term
    let bestIndex = -1;
    for (const term of queryTerms) {
      const index = content.toLowerCase().indexOf(term);
      if (index !== -1 && (bestIndex === -1 || index < bestIndex)) {
        bestIndex = index;
      }
    }

    if (bestIndex === -1) {
      // No query terms found, use beginning
      return content.substring(0, maxLength) + "...";
    }

    // Extract around the found term
    const start = Math.max(0, bestIndex - 50);
    const end = Math.min(content.length, bestIndex + 100);
    let excerpt = content.substring(start, end);

    // Clean up
    if (start > 0) excerpt = "..." + excerpt;
    if (end < content.length) excerpt = excerpt + "...";

    return excerpt;
  }

  /**
   * Generate warnings based on evaluation
   */
  private generateWarnings(evaluation: ResponseEvaluationResult): string[] {
    const warnings: string[] = [];

    // Low factuality warning
    if (evaluation.factualityScore < 0.6) {
      warnings.push(
        "Some claims in this response could not be verified against available sources",
      );
    }

    // Low relevance warning
    if (evaluation.relevanceScore < 0.6) {
      warnings.push("This response may not fully address your question");
    }

    // Low coherence warning
    if (evaluation.coherenceScore < 0.6) {
      warnings.push(
        "This response may contain inconsistencies or unclear sections",
      );
    }

    // Uncertainty markers
    if (
      evaluation.uncertaintyMarkers &&
      evaluation.uncertaintyMarkers.length > 2
    ) {
      warnings.push(
        "This response contains multiple uncertain or qualified statements",
      );
    }

    return warnings;
  }

  /**
   * Get default fallback message
   */
  private getDefaultFallbackMessage(): string {
    return `I apologize, but I'm unable to provide a reliable response to your question at this time.

This could be due to:
- The question being outside my knowledge base
- Insufficient context to provide an accurate answer
- Technical limitations in processing your request

**What you can do:**
1. **Rephrase your question** - Sometimes a different wording helps
2. **Provide more context** - Additional details can improve response quality
3. **Break down complex questions** - Try asking simpler, more specific questions
4. **Consult human experts** - For critical or specialized information

Would you like to try rephrasing your question, or would you prefer assistance with a different topic?`;
  }

  /**
   * Generate unique feedback ID
   */
  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Capture user feedback
   */
  captureFeedback(
    feedbackId: string,
    feedback: Partial<FeedbackCapture>,
  ): void {
    const existing = this.feedbackStore.get(feedbackId) || {
      feedbackId,
      timestamp: Date.now(),
    };

    this.feedbackStore.set(feedbackId, {
      ...existing,
      ...feedback,
    });
  }

  /**
   * Get feedback for analysis
   */
  getFeedback(feedbackId: string): FeedbackCapture | undefined {
    return this.feedbackStore.get(feedbackId);
  }

  /**
   * Get all feedback for learning
   */
  getAllFeedback(): FeedbackCapture[] {
    return Array.from(this.feedbackStore.values());
  }

  /**
   * Get delivery statistics
   */
  getDeliveryStats(): {
    total: number;
    byAction: Record<ActionType, number>;
    averageConfidence: number;
    feedbackRate: number;
  } {
    const stats = {
      total: this.deliveryHistory.length,
      byAction: {
        [ActionType.ACCEPT]: 0,
        [ActionType.REVIEW]: 0,
        [ActionType.REGENERATE]: 0,
        [ActionType.FALLBACK]: 0,
      },
      averageConfidence: 0,
      feedbackRate: 0,
    };

    if (stats.total === 0) return stats;

    let totalConfidence = 0;
    let feedbackCount = 0;

    this.deliveryHistory.forEach((delivery) => {
      stats.byAction[delivery.metadata.action]++;
      totalConfidence += delivery.confidence.score;

      if (this.feedbackStore.has(delivery.feedbackId)) {
        feedbackCount++;
      }
    });

    stats.averageConfidence = totalConfidence / stats.total;
    stats.feedbackRate = feedbackCount / stats.total;

    return stats;
  }

  /**
   * Generate performance report
   */
  generatePerformanceReport(): string {
    const stats = this.getDeliveryStats();
    const feedback = this.getAllFeedback();

    const helpfulCount = feedback.filter((f) => f.helpful === true).length;
    const accurateCount = feedback.filter((f) => f.accurate === true).length;

    const report: string[] = [
      "# Adaptive Delivery Performance Report",
      "",
      `**Total Deliveries:** ${stats.total}`,
      `**Average Confidence:** ${(stats.averageConfidence * 100).toFixed(1)}%`,
      `**Feedback Rate:** ${(stats.feedbackRate * 100).toFixed(1)}%`,
      "",
      "## Delivery Breakdown",
      `- High Confidence (Accept): ${stats.byAction[ActionType.ACCEPT]} (${this.getPercentage(stats.byAction[ActionType.ACCEPT], stats.total)}%)`,
      `- Medium Confidence (Review): ${stats.byAction[ActionType.REVIEW]} (${this.getPercentage(stats.byAction[ActionType.REVIEW], stats.total)}%)`,
      `- Low Confidence (Regenerate): ${stats.byAction[ActionType.REGENERATE]} (${this.getPercentage(stats.byAction[ActionType.REGENERATE], stats.total)}%)`,
      `- Fallback: ${stats.byAction[ActionType.FALLBACK]} (${this.getPercentage(stats.byAction[ActionType.FALLBACK], stats.total)}%)`,
      "",
      "## User Feedback",
      `- Total Feedback: ${feedback.length}`,
      `- Helpful: ${helpfulCount} (${this.getPercentage(helpfulCount, feedback.length)}%)`,
      `- Accurate: ${accurateCount} (${this.getPercentage(accurateCount, feedback.length)}%)`,
      "",
      "## Recommendations",
    ];

    // Add recommendations based on stats
    if (stats.averageConfidence < 0.6) {
      report.push(
        "- ⚠️ Low average confidence - consider improving retrieval and generation quality",
      );
    }

    if (stats.feedbackRate < 0.1) {
      report.push(
        "- 📊 Low feedback rate - encourage more user feedback for improvements",
      );
    }

    if (stats.byAction[ActionType.FALLBACK] > stats.total * 0.1) {
      report.push(
        "- ❌ High fallback rate - investigate common failure patterns",
      );
    }

    return report.join("\n");
  }

  /**
   * Calculate percentage
   */
  private getPercentage(value: number, total: number): string {
    if (total === 0) return "0";
    return ((value / total) * 100).toFixed(1);
  }

  /**
   * Export delivery history for analysis
   */
  exportHistory(): DeliveredResponse[] {
    return [...this.deliveryHistory];
  }

  /**
   * Clear history and feedback
   */
  clearHistory(): void {
    this.deliveryHistory = [];
    this.feedbackStore.clear();
  }
}
