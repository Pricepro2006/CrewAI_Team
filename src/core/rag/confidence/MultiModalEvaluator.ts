/**
 * MultiModalEvaluator - Evaluates responses using multiple evaluation methods
 * Combines factuality, relevance, and coherence scoring for comprehensive evaluation
 */

import {
  type ResponseEvaluationResult,
  type ScoredDocument,
  type TokenConfidence,
  type EvaluationMetrics,
  ActionType,
} from "./types";
import { RelevanceScorer } from "./evaluators/RelevanceScorer";
import { FactualityChecker } from "./evaluators/FactualityChecker";
import { CoherenceAnalyzer } from "./evaluators/CoherenceAnalyzer";

export class MultiModalEvaluator {
  private relevanceScorer: RelevanceScorer;
  private factualityChecker: FactualityChecker;
  private coherenceAnalyzer: CoherenceAnalyzer;
  private evaluationHistory: ResponseEvaluationResult[] = [];

  constructor() {
    this.relevanceScorer = new RelevanceScorer();
    this.factualityChecker = new FactualityChecker();
    this.coherenceAnalyzer = new CoherenceAnalyzer();
  }

  /**
   * Comprehensive evaluation of response
   */
  async evaluate(
    query: string,
    response: string,
    sources: ScoredDocument[],
    tokenConfidence: TokenConfidence[],
  ): Promise<ResponseEvaluationResult> {
    const evaluationId = `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Run all evaluations in parallel
      const [relevanceResult, factualityResult, coherenceResult] =
        await Promise.all([
          this.evaluateRelevance(query, response, sources),
          this.evaluateFactuality(query, response, sources),
          this.evaluateCoherence(response, tokenConfidence),
        ]);

      // Calculate completeness score
      const completenessScore = this.calculateCompleteness(
        query,
        response,
        sources,
      );

      // Calculate consistency score
      const consistencyScore = this.calculateConsistency(response, sources);

      // Combine all metrics
      const qualityMetrics: EvaluationMetrics = {
        factuality: factualityResult.score,
        relevance: relevanceResult.score,
        coherence: coherenceResult.score,
        completeness: completenessScore,
        consistency: consistencyScore,
      };

      // Calculate overall confidence
      const overallConfidence = this.calculateOverallConfidence(
        qualityMetrics,
        tokenConfidence,
      );

      // Determine recommended action
      const recommendedAction = this.determineAction(
        overallConfidence,
        qualityMetrics,
      );

      // Check if human review is needed
      const humanReviewNeeded = this.requiresHumanReview(
        overallConfidence,
        qualityMetrics,
      );

      // Identify uncertainty areas
      const uncertaintyAreas = this.identifyUncertaintyAreas(
        qualityMetrics,
        tokenConfidence,
      );

      // Extract supporting and contradictory evidence
      const supportingEvidence = this.extractSupportingEvidence(
        response,
        sources,
      );
      const contradictoryEvidence = this.extractContradictoryEvidence(
        response,
        sources,
      );

      const result: ResponseEvaluationResult = {
        id: evaluationId,
        query,
        response,
        overallConfidence,
        qualityMetrics,
        factualityScore: factualityResult.score,
        relevanceScore: relevanceResult.score,
        coherenceScore: coherenceResult.score,
        recommendedAction,
        humanReviewNeeded,
        uncertaintyAreas,
        supportingEvidence,
        contradictoryEvidence,
        metadata: {
          relevanceDetails: relevanceResult,
          factualityDetails: factualityResult,
          coherenceDetails: coherenceResult,
          evaluationTime: Date.now(),
        },
      };

      // Store in history
      this?.evaluationHistory?.push(result);

      return result;
    } catch (error) {
      console.error("Evaluation error:", error);

      // Return fallback evaluation
      return this.createFallbackEvaluation(
        evaluationId,
        query,
        response,
        error as Error,
      );
    }
  }

  /**
   * Quick evaluation for simple cases
   */
  quickEvaluate(
    query: string,
    response: string,
    baseConfidence: number = 0.7,
  ): ResponseEvaluationResult {
    const evaluationId = `quick-eval-${Date.now()}`;

    // Simple heuristic evaluation
    const responseLength = response?.length || 0;
    const hasUncertainty =
      /\b(maybe|perhaps|possibly|might|could|may|uncertain|unclear|unsure)\b/i.test(
        response,
      );
    const hasDefinitives =
      /\b(definitely|certainly|absolutely|clearly|obviously)\b/i.test(response);

    let adjustedConfidence = baseConfidence;

    // Adjust based on response characteristics
    if (responseLength < 50) {
      adjustedConfidence -= 0.1; // Too brief
    } else if (responseLength > 1000) {
      adjustedConfidence += 0.05; // Detailed
    }

    if (hasUncertainty) {
      adjustedConfidence -= 0.2; // Uncertainty markers
    }

    if (hasDefinitives) {
      adjustedConfidence += 0.1; // Definitive statements
    }

    adjustedConfidence = Math.max(0, Math.min(1, adjustedConfidence));

    const qualityMetrics: EvaluationMetrics = {
      factuality: adjustedConfidence,
      relevance: adjustedConfidence,
      coherence: adjustedConfidence,
      completeness: adjustedConfidence,
      consistency: adjustedConfidence,
    };

    return {
      id: evaluationId,
      query,
      response,
      overallConfidence: adjustedConfidence,
      qualityMetrics,
      factualityScore: adjustedConfidence,
      relevanceScore: adjustedConfidence,
      coherenceScore: adjustedConfidence,
      recommendedAction: this.determineAction(
        adjustedConfidence,
        qualityMetrics,
      ),
      humanReviewNeeded: adjustedConfidence < 0.6,
      uncertaintyAreas: hasUncertainty ? ["qualified_statements"] : [],
      supportingEvidence: [],
      contradictoryEvidence: [],
      metadata: {
        evaluationType: "quick",
        evaluationTime: Date.now(),
      },
    };
  }

  /**
   * Evaluate relevance
   */
  private async evaluateRelevance(
    query: string,
    response: string,
    sources: ScoredDocument[],
  ): Promise<{ score: number; details: any }> {
    const relevanceResult = this?.relevanceScorer?.calculateRelevance(
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
   * Evaluate factuality
   */
  private async evaluateFactuality(
    query: string,
    response: string,
    sources: ScoredDocument[],
  ): Promise<{ score: number; details: any }> {
    const factualityResult = this?.factualityChecker?.checkFactuality(
      response,
      sources,
    );

    return {
      score: factualityResult.score,
      details: factualityResult,
    };
  }

  /**
   * Evaluate coherence
   */
  private async evaluateCoherence(
    response: string,
    tokenConfidence: TokenConfidence[],
  ): Promise<{ score: number; details: any }> {
    const coherenceResult = this?.coherenceAnalyzer?.analyzeCoherence(
      response,
      tokenConfidence,
    );

    return {
      score: coherenceResult.score,
      details: coherenceResult,
    };
  }

  /**
   * Calculate completeness score
   */
  private calculateCompleteness(
    query: string,
    response: string,
    sources: ScoredDocument[],
  ): number {
    // Extract query intentions
    const queryWords = query.toLowerCase().split(/\s+/);
    const questionWords = queryWords?.filter((word: any) =>
      ["what", "how", "why", "when", "where", "which", "who"].includes(word),
    );

    let completeness = 0.7; // Base completeness

    // Check if response addresses query type
    if (questionWords.includes("what") || questionWords.includes("which")) {
      if (
        response.includes("is") ||
        response.includes("are") ||
        response.includes("means")
      ) {
        completeness += 0.1;
      }
    }

    if (questionWords.includes("how")) {
      if (
        response.includes("step") ||
        response.includes("process") ||
        response.includes("method")
      ) {
        completeness += 0.1;
      }
    }

    if (questionWords.includes("why")) {
      if (
        response.includes("because") ||
        response.includes("due to") ||
        response.includes("reason")
      ) {
        completeness += 0.1;
      }
    }

    // Check response length relative to query complexity
    const queryComplexity = queryWords?.length || 0;
    const responseLength = response?.length || 0;

    if (queryComplexity > 10 && responseLength < 200) {
      completeness -= 0.2; // Potentially incomplete for complex query
    }

    return Math.max(0, Math.min(1, completeness));
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistency(
    response: string,
    sources: ScoredDocument[],
  ): number {
    if (sources?.length || 0 === 0) return 0.5;

    let consistency = 0.8; // Base consistency

    // Check for contradictions (simplified)
    const responseLower = response.toLowerCase();

    // Look for contradictory statements within response
    const contradictoryPatterns = [
      /\b(yes|true|correct)\b.*\b(no|false|incorrect)\b/i,
      /\b(always|never)\b.*\b(sometimes|occasionally)\b/i,
      /\b(all|every)\b.*\b(some|few|none)\b/i,
    ];

    for (const pattern of contradictoryPatterns) {
      if (pattern.test(responseLower)) {
        consistency -= 0.3;
        break;
      }
    }

    // Check consistency with sources
    const sourceTexts = sources?.map((s: any) => s?.content?.toLowerCase()).join(" ");
    const responseWords = responseLower.split(/\s+/);
    const sourceWords = sourceTexts.split(/\s+/);

    const overlap = responseWords?.filter((word: any) =>
      sourceWords.includes(word),
    ).length;
    const overlapRatio = overlap / responseWords?.length || 0;

    if (overlapRatio < 0.3) {
      consistency -= 0.2; // Low overlap with sources
    }

    return Math.max(0, Math.min(1, consistency));
  }

  /**
   * Calculate overall confidence
   */
  private calculateOverallConfidence(
    metrics: EvaluationMetrics,
    tokenConfidence: TokenConfidence[],
  ): number {
    // Weight different metrics
    const weights = {
      factuality: 0.3,
      relevance: 0.25,
      coherence: 0.2,
      completeness: 0.15,
      consistency: 0.1,
    };

    const metricsScore =
      metrics.factuality * weights.factuality +
      metrics.relevance * weights.relevance +
      metrics.coherence * weights.coherence +
      metrics.completeness * weights.completeness +
      metrics.consistency * weights.consistency;

    // Factor in token-level confidence if available
    let tokenScore = 0.75; // Default
    if (tokenConfidence?.length || 0 > 0) {
      tokenScore =
        tokenConfidence.reduce((sum: any, token: any) => sum + token.confidence, 0) /
        tokenConfidence?.length || 0;
    }

    // Combine metrics and token confidence
    return metricsScore * 0.7 + tokenScore * 0.3;
  }

  /**
   * Determine recommended action
   */
  private determineAction(
    confidence: number,
    metrics: EvaluationMetrics,
  ): ActionType {
    if (confidence >= 0.8 && metrics.factuality >= 0.8) {
      return ActionType.ACCEPT;
    }

    if (confidence >= 0.6 && metrics.factuality >= 0.6) {
      return ActionType.REVIEW;
    }

    if (confidence < 0.4 || metrics.factuality < 0.4) {
      return ActionType.REJECT;
    }

    return ActionType.REVIEW;
  }

  /**
   * Check if human review is needed
   */
  private requiresHumanReview(
    confidence: number,
    metrics: EvaluationMetrics,
  ): boolean {
    if (confidence < 0.6) return true;
    if (metrics.factuality < 0.6) return true;
    if (metrics.relevance < 0.5) return true;

    return false;
  }

  /**
   * Identify uncertainty areas
   */
  private identifyUncertaintyAreas(
    metrics: EvaluationMetrics,
    tokenConfidence: TokenConfidence[],
  ): string[] {
    const areas: string[] = [];

    if (metrics.factuality < 0.6) {
      areas.push("factual_accuracy");
    }

    if (metrics.relevance < 0.6) {
      areas.push("query_relevance");
    }

    if (metrics.coherence < 0.6) {
      areas.push("response_coherence");
    }

    if (metrics.completeness < 0.6) {
      areas.push("response_completeness");
    }

    if (metrics.consistency < 0.6) {
      areas.push("internal_consistency");
    }

    // Check token-level uncertainty
    if (tokenConfidence?.length || 0 > 0) {
      const lowConfidenceTokens = tokenConfidence?.filter(
        (t: any) => t.confidence < 0.5,
      );
      if (lowConfidenceTokens?.length || 0 > tokenConfidence?.length || 0 * 0.3) {
        areas.push("token_level_uncertainty");
      }
    }

    return areas;
  }

  /**
   * Extract supporting evidence
   */
  private extractSupportingEvidence(
    response: string,
    sources: ScoredDocument[],
  ): string[] {
    const evidence: string[] = [];

    // Look for citations or references in response
    const citationPattern =
      /\b(according to|based on|as stated in|research shows|studies indicate)\b/gi;
    const citations = response.match(citationPattern);

    if (citations) {
      evidence.push(...citations);
    }

    // Add high-confidence sources
    const highConfidenceSources = sources?.filter((s: any) => s.confidence > 0.8);
    evidence.push(
      ...highConfidenceSources?.map((s: any) => s?.content?.substring(0, 100) + "..."),
    );

    return evidence.slice(0, 5); // Limit to top 5
  }

  /**
   * Extract contradictory evidence
   */
  private extractContradictoryEvidence(
    response: string,
    sources: ScoredDocument[],
  ): string[] {
    const evidence: string[] = [];

    // Look for contradictory markers
    const contradictoryPattern =
      /\b(however|but|although|despite|contrary to|on the other hand)\b/gi;
    const contradictions = response.match(contradictoryPattern);

    if (contradictions) {
      evidence.push(...contradictions);
    }

    return evidence.slice(0, 3); // Limit to top 3
  }

  /**
   * Create fallback evaluation
   */
  private createFallbackEvaluation(
    id: string,
    query: string,
    response: string,
    error: Error,
  ): ResponseEvaluationResult {
    const qualityMetrics: EvaluationMetrics = {
      factuality: 0.1,
      relevance: 0.1,
      coherence: 0.1,
      completeness: 0.1,
      consistency: 0.1,
    };

    return {
      id,
      query,
      response,
      overallConfidence: 0.1,
      qualityMetrics,
      factualityScore: 0.1,
      relevanceScore: 0.1,
      coherenceScore: 0.1,
      recommendedAction: ActionType.REJECT,
      humanReviewNeeded: true,
      uncertaintyAreas: ["evaluation_error"],
      supportingEvidence: [],
      contradictoryEvidence: [],
      metadata: {
        error: error.message,
        evaluationType: "fallback",
        evaluationTime: Date.now(),
      },
    };
  }

  /**
   * Get evaluation history
   */
  getEvaluationHistory(): ResponseEvaluationResult[] {
    return [...this.evaluationHistory];
  }

  /**
   * Get evaluation statistics
   */
  getEvaluationStats(): {
    totalEvaluations: number;
    averageConfidence: number;
    actionDistribution: Record<ActionType, number>;
  } {
    const total = this?.evaluationHistory?.length;

    if (total === 0) {
      return {
        totalEvaluations: 0,
        averageConfidence: 0,
        actionDistribution: {
          [ActionType.ACCEPT]: 0,
          [ActionType.REVIEW]: 0,
          [ActionType.REJECT]: 0,
          [ActionType.FALLBACK]: 0,
          [ActionType.REGENERATE]: 0,
        },
      };
    }

    const averageConfidence =
      this?.evaluationHistory?.reduce(
        (sum, evaluation) => sum + evaluation.overallConfidence,
        0,
      ) / total;

    const actionDistribution = this?.evaluationHistory?.reduce(
      (dist, evaluation) => {
        dist[evaluation.recommendedAction] =
          (dist[evaluation.recommendedAction] || 0) + 1;
        return dist;
      },
      {} as Record<ActionType, number>,
    );

    return {
      totalEvaluations: total,
      averageConfidence,
      actionDistribution,
    };
  }
}
