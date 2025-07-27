/**
 * MultiModalEvaluator - Combines multiple evaluation methods for comprehensive assessment
 * Integrates factuality, relevance, and coherence checking with confidence calibration
 */

import { FactualityChecker } from "./evaluators/FactualityChecker";
import { RelevanceScorer } from "./evaluators/RelevanceScorer";
import { CoherenceAnalyzer } from "./evaluators/CoherenceAnalyzer";
import {
  ResponseEvaluationResult,
  ActionType,
  QualityMetrics,
  ScoredDocument,
  TokenConfidence,
  ConfidenceConfig,
} from "./types";
import { getConfidenceConfig } from "../../../config/confidence.config";

export interface EvaluationOptions {
  includeFactuality?: boolean;
  includeRelevance?: boolean;
  includeCoherence?: boolean;
  useLLMJudge?: boolean;
  confidenceConfig?: Partial<ConfidenceConfig>;
}

export class MultiModalEvaluator {
  private factualityChecker: FactualityChecker;
  private relevanceScorer: RelevanceScorer;
  private coherenceAnalyzer: CoherenceAnalyzer;
  private config: ConfidenceConfig;

  constructor(config?: Partial<ConfidenceConfig>) {
    this.factualityChecker = new FactualityChecker();
    this.relevanceScorer = new RelevanceScorer();
    this.coherenceAnalyzer = new CoherenceAnalyzer();
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Evaluate response using multiple modalities
   * @param query Original query
   * @param response Generated response
   * @param sources Source documents used
   * @param tokenConfidence Token-level confidence scores
   * @param options Evaluation options
   * @returns Comprehensive evaluation result
   */
  async evaluate(
    query: string,
    response: string,
    sources: ScoredDocument[],
    tokenConfidence: TokenConfidence[] = [],
    options: EvaluationOptions = {},
  ): Promise<ResponseEvaluationResult> {
    const {
      includeFactuality = true,
      includeRelevance = true,
      includeCoherence = true,
      useLLMJudge = false,
    } = options;

    // Initialize quality metrics
    const qualityMetrics: QualityMetrics = {
      factuality: 0.5,
      relevance: 0.5,
      coherence: 0.5,
    };

    // Perform evaluations
    if (includeFactuality) {
      const factualityResult = this.evaluateFactuality(response, sources);
      qualityMetrics.factuality = factualityResult.score;
    }

    if (includeRelevance) {
      const relevanceResult = this.evaluateRelevance(query, response, sources);
      qualityMetrics.relevance = relevanceResult.score;
    }

    if (includeCoherence) {
      const coherenceResult = this.evaluateCoherence(response);
      qualityMetrics.coherence = coherenceResult.score;
    }

    // Calculate raw confidence
    const rawConfidence = this.calculateRawConfidence(
      qualityMetrics,
      tokenConfidence,
      sources,
    );

    // Apply calibration (placeholder for now - will be implemented in ConfidenceCalibrator)
    const calibratedConfidence = rawConfidence; // TODO: Apply calibration

    // Determine recommended action
    const recommendedAction = this.determineAction(calibratedConfidence);
    const humanReviewNeeded = recommendedAction === ActionType.REVIEW;

    // Calculate source confidence
    const sourceConfidence = sources.map((doc) => doc.confidenceScore);

    // Extract uncertainty markers
    const uncertaintyMarkers = this.extractUncertaintyMarkers(
      response,
      tokenConfidence,
    );

    return {
      overallConfidence: calibratedConfidence,
      qualityMetrics,
      factualityScore: qualityMetrics.factuality,
      relevanceScore: qualityMetrics.relevance,
      coherenceScore: qualityMetrics.coherence,
      recommendedAction,
      humanReviewNeeded,
      query,
      response,
      sources,
      sourceConfidence,
      uncertaintyMarkers,
      tokenConfidence,
      id: this.generateEvaluationId(),
    };
  }

  /**
   * Evaluate factuality of the response
   */
  private evaluateFactuality(
    response: string,
    sources: ScoredDocument[],
  ): { score: number; details: any } {
    // Extract and verify claims
    const claims = this.factualityChecker.extractClaims(response);
    const verificationResult = this.factualityChecker.verifyClaims(
      claims,
      sources,
    );

    return {
      score: verificationResult.score,
      details: verificationResult,
    };
  }

  /**
   * Evaluate relevance of the response
   */
  private evaluateRelevance(
    query: string,
    response: string,
    sources: ScoredDocument[],
  ): { score: number; details: any } {
    const relevanceResult = this.relevanceScorer.calculateRelevance(
      query,
      response,
      sources,
    );

    return {
      score: relevanceResult.score,
      details: relevanceResult,
    };
  }

  /**
   * Evaluate coherence of the response
   */
  private evaluateCoherence(response: string): { score: number; details: any } {
    const coherenceResult = this.coherenceAnalyzer.analyzeCoherence(response);

    return {
      score: coherenceResult.score,
      details: coherenceResult,
    };
  }

  /**
   * Calculate raw confidence score
   */
  private calculateRawConfidence(
    qualityMetrics: QualityMetrics,
    tokenConfidence: TokenConfidence[],
    sources: ScoredDocument[],
  ): number {
    // Base confidence from quality metrics (weighted average)
    const qualityScore =
      qualityMetrics.factuality * 0.4 +
      qualityMetrics.relevance * 0.3 +
      qualityMetrics.coherence * 0.3;

    // Token-level confidence if available
    let tokenScore = 0.7; // Default
    if (tokenConfidence.length > 0) {
      const avgTokenConfidence =
        tokenConfidence.reduce((sum, tc) => sum + tc.confidence, 0) /
        tokenConfidence.length;
      tokenScore = avgTokenConfidence;
    }

    // Source confidence
    const avgSourceConfidence =
      sources.length > 0
        ? sources.reduce((sum, doc) => sum + doc.confidenceScore, 0) /
          sources.length
        : 0.5;

    // Combine scores with weights
    const rawConfidence =
      qualityScore * 0.5 + tokenScore * 0.3 + avgSourceConfidence * 0.2;

    return Math.max(0, Math.min(1, rawConfidence));
  }

  /**
   * Determine recommended action based on confidence
   */
  private determineAction(confidence: number): ActionType {
    if (confidence >= this.config.overall.high) {
      return ActionType.ACCEPT;
    } else if (confidence >= this.config.generation.review) {
      return ActionType.REVIEW;
    } else if (confidence >= this.config.overall.low) {
      return ActionType.REGENERATE;
    } else {
      return ActionType.FALLBACK;
    }
  }

  /**
   * Extract uncertainty markers from response
   */
  private extractUncertaintyMarkers(
    response: string,
    tokenConfidence: TokenConfidence[],
  ): string[] {
    const markers: Set<string> = new Set();

    // Linguistic uncertainty markers
    const uncertainPhrases = [
      "maybe",
      "perhaps",
      "possibly",
      "might",
      "could be",
      "uncertain",
      "not sure",
      "unclear",
      "it seems",
      "appears to be",
    ];

    const responseLower = response.toLowerCase();
    uncertainPhrases.forEach((phrase) => {
      if (responseLower.includes(phrase)) {
        markers.add(phrase);
      }
    });

    // Low confidence tokens
    if (tokenConfidence.length > 0) {
      const lowConfidenceTokens = tokenConfidence
        .filter((tc) => tc.confidence < 0.5)
        .map((tc) => tc.token);

      if (lowConfidenceTokens.length > 3) {
        markers.add(`${lowConfidenceTokens.length} low-confidence tokens`);
      }
    }

    return Array.from(markers);
  }

  /**
   * Generate unique evaluation ID
   */
  private generateEvaluationId(): string {
    return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get detailed evaluation report
   */
  generateDetailedReport(result: ResponseEvaluationResult): string {
    const report: string[] = [
      "# Response Evaluation Report",
      "",
      `**Evaluation ID:** ${result.id}`,
      `**Date:** ${new Date().toISOString()}`,
      "",
      "## Summary",
      `- **Overall Confidence:** ${(result.overallConfidence * 100).toFixed(1)}%`,
      `- **Recommended Action:** ${result.recommendedAction}`,
      `- **Human Review Needed:** ${result.humanReviewNeeded ? "Yes" : "No"}`,
      "",
      "## Quality Metrics",
      `- **Factuality:** ${(result.factualityScore * 100).toFixed(1)}%`,
      `- **Relevance:** ${(result.relevanceScore * 100).toFixed(1)}%`,
      `- **Coherence:** ${(result.coherenceScore * 100).toFixed(1)}%`,
      "",
      "## Source Analysis",
      `- **Number of Sources:** ${result.sources?.length || 0}`,
      `- **Average Source Confidence:** ${this.calculateAverage(result.sourceConfidence || [])}%`,
      "",
      "## Uncertainty Analysis",
      `- **Uncertainty Markers Found:** ${result.uncertaintyMarkers?.length || 0}`,
    ];

    if (result.uncertaintyMarkers && result.uncertaintyMarkers.length > 0) {
      report.push("- **Markers:**");
      result.uncertaintyMarkers.forEach((marker) => {
        report.push(`  - ${marker}`);
      });
    }

    report.push("", "## Recommendations");

    switch (result.recommendedAction) {
      case ActionType.ACCEPT:
        report.push("✅ Response is high quality and can be delivered as-is.");
        break;
      case ActionType.REVIEW:
        report.push(
          "⚠️ Response should be reviewed by a human before delivery.",
        );
        report.push("Consider clarifying uncertain areas or adding caveats.");
        break;
      case ActionType.REGENERATE:
        report.push("🔄 Response quality is low. Consider regenerating with:");
        report.push("- More specific retrieval parameters");
        report.push("- Lower temperature for more focused generation");
        report.push("- Additional context or examples");
        break;
      case ActionType.FALLBACK:
        report.push(
          "❌ Response quality is very low. Use fallback response or",
        );
        report.push("escalate to human support.");
        break;
    }

    return report.join("\n");
  }

  /**
   * Calculate average of an array
   */
  private calculateAverage(values: number[]): string {
    if (values.length === 0) return "0";
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    return (avg * 100).toFixed(1);
  }

  /**
   * Quick evaluation for performance-critical scenarios
   */
  quickEvaluate(
    query: string,
    response: string,
    baseConfidence: number,
  ): ResponseEvaluationResult {
    // Simplified evaluation using heuristics
    const relevanceScore = this.quickRelevanceCheck(query, response);
    const coherenceScore = this.quickCoherenceCheck(response);

    const overallConfidence =
      baseConfidence * 0.5 + relevanceScore * 0.3 + coherenceScore * 0.2;

    return {
      overallConfidence,
      qualityMetrics: {
        factuality: baseConfidence, // Use base as proxy
        relevance: relevanceScore,
        coherence: coherenceScore,
      },
      factualityScore: baseConfidence,
      relevanceScore,
      coherenceScore,
      recommendedAction: this.determineAction(overallConfidence),
      humanReviewNeeded: overallConfidence < this.config.generation.review,
      query,
      response,
      id: this.generateEvaluationId(),
    };
  }

  /**
   * Quick relevance check using term overlap
   */
  private quickRelevanceCheck(query: string, response: string): number {
    const queryTerms = new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 3),
    );
    const responseTerms = new Set(response.toLowerCase().split(/\s+/));

    let matches = 0;
    queryTerms.forEach((term) => {
      if (responseTerms.has(term)) matches++;
    });

    return Math.min(1, matches / queryTerms.size + 0.3); // Base score of 0.3
  }

  /**
   * Quick coherence check
   */
  private quickCoherenceCheck(response: string): number {
    const sentences = response
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 0);

    // Basic checks
    if (sentences.length === 0) return 0.3;
    if (sentences.length === 1) return 0.7;

    // Check for reasonable length
    const avgLength = response.length / sentences.length;
    if (avgLength > 200) return 0.6; // Sentences too long
    if (avgLength < 20) return 0.6; // Sentences too short

    return 0.8; // Default decent coherence
  }
}
