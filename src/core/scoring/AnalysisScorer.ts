import type { EmailAnalysis } from "../../types/AnalysisTypes.js";
import { logger } from "../../utils/logger.js";

interface ScoringDimensions {
  contextUnderstanding: number;
  entityExtraction: number;
  businessProcessing: number;
  actionableInsights: number;
  responseQuality: number;
}

interface DetailedScore {
  overall: number;
  dimensions: ScoringDimensions;
  details: string[];
}

export class AnalysisScorer {
  // Scoring weights based on TD SYNNEX business priorities
  private weights = {
    contextUnderstanding: 0.2, // 20% - Understanding the email context
    entityExtraction: 0.25, // 25% - Accurate entity extraction
    businessProcessing: 0.2, // 20% - Correct workflow/process identification
    actionableInsights: 0.2, // 20% - Quality of action items
    responseQuality: 0.15, // 15% - Appropriate response suggestion
  };

  scoreAnalysis(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): DetailedScore {
    const dimensions: ScoringDimensions = {
      contextUnderstanding: this.scoreContextUnderstanding(analysis, baseline),
      entityExtraction: this.scoreEntityExtraction(analysis, baseline),
      businessProcessing: this.scoreBusinessProcessing(analysis, baseline),
      actionableInsights: this.scoreActionableInsights(analysis, baseline),
      responseQuality: this.scoreResponseQuality(analysis, baseline),
    };

    const overall = Object.entries(dimensions).reduce(
      (sum, [key, score]) =>
        sum + score * this.weights[key as keyof ScoringDimensions],
      0,
    );

    const details = this.generateScoringDetails(analysis, baseline, dimensions);

    return {
      overall: Math.round(overall * 10) / 10,
      dimensions,
      details,
    };
  }

  private scoreContextUnderstanding(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): number {
    let score = 0;

    // Check workflow type accuracy (40% of context score)
    if (analysis.workflow_type === baseline.workflow_type) {
      score += 4;
    } else if (
      this.isCloseWorkflowState(
        analysis.workflow_type,
        baseline.workflow_type,
      )
    ) {
      score += 2;
    }

    // Check priority accuracy (30% of context score)
    const analysisPriority = analysis.phase1_results?.basic_classification?.priority;
    const baselinePriority = baseline.phase1_results?.basic_classification?.priority;
    if (analysisPriority === baselinePriority) {
      score += 3;
    } else if (analysisPriority && baselinePriority && this.isClosePriority(analysisPriority, baselinePriority)) {
      score += 1.5;
    }

    // Check urgency indicators (30% of context score)
    const analysisUrgency = analysis.phase1_results?.basic_classification?.urgency;
    const baselineUrgency = baseline.phase1_results?.basic_classification?.urgency;
    if (analysisUrgency === baselineUrgency) {
      score += 3;
    } else {
      // Partial credit if both exist but don't match
      if (analysisUrgency !== undefined && baselineUrgency !== undefined) {
        score += 1;
      }
    }

    return Math.min(10, score);
  }

  private scoreEntityExtraction(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): number {
    const entityTypes = [
      "po_numbers",
      "quotes",
      "cases",
      "parts",
      "companies", 
      "people",
    ];

    let totalScore = 0;
    let totalWeight = 0;

    // Different weights for different entity types
    const typeWeights = {
      po_numbers: 2.0, // Most critical
      quotes: 1.5,
      cases: 1.5,
      parts: 1.0,
      companies: 1.5,
      people: 1.0,
    };

    for (const entityType of entityTypes) {
      const weight = typeWeights[entityType as keyof typeof typeWeights] || 1.0;
      const analysisEntities = analysis.phase1_results?.entities?.[entityType as keyof typeof analysis.phase1_results.entities] || [];
      const baselineEntities = baseline.phase1_results?.entities?.[entityType as keyof typeof baseline.phase1_results.entities] || [];

      const precision = this.calculatePrecision(
        analysisEntities,
        baselineEntities,
      );
      const recall = this.calculateRecall(analysisEntities, baselineEntities);
      const f1Score = this.calculateF1Score(precision, recall);

      totalScore += f1Score * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? (totalScore / totalWeight) * 10 : 0;
  }

  private scoreBusinessProcessing(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): number {
    let score = 0;

    // Business process identification (50%) - using workflow_type as proxy
    if (analysis.workflow_type === baseline.workflow_type) {
      score += 5;
    } else if (
      this.isRelatedProcess(
        analysis.workflow_type,
        baseline.workflow_type,
      )
    ) {
      score += 2.5;
    }

    // SLA and risk assessment (30%) - using risk_level from contextual insights
    const analysisRisk = analysis.phase2_results?.contextual_insights?.risk_level;
    const baselineRisk = baseline.phase2_results?.contextual_insights?.risk_level;
    if (analysisRisk && baselineRisk) {
      if (analysisRisk === baselineRisk) {
        score += 3;
      } else if (
        this.isSimilarSLAStatus(analysisRisk, baselineRisk)
      ) {
        score += 1.5;
      }
    }

    // Business impact assessment (20%) - using business_impact from contextual insights
    const analysisImpact = analysis.phase2_results?.contextual_insights?.business_impact;
    const baselineImpact = baseline.phase2_results?.contextual_insights?.business_impact;
    if (analysisImpact && baselineImpact) {
      const similarity = this.compareBusinessImpact(
        analysisImpact,
        baselineImpact,
      );
      score += similarity * 2;
    }

    return Math.min(10, score);
  }

  private scoreActionableInsights(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): number {
    const analysisActions = analysis.phase2_results?.action_items || [];
    const baselineActions = baseline.phase2_results?.action_items || [];

    if (!baselineActions || baselineActions.length === 0) {
      return (!analysisActions || analysisActions.length === 0) ? 10 : 5;
    }

    let matchedActions = 0;
    let totalQuality = 0;

    for (const baselineAction of baselineActions) {
      const bestMatch = this.findBestActionMatch(
        baselineAction,
        analysisActions,
      );
      if (bestMatch) {
        matchedActions++;
        totalQuality += bestMatch.quality;
      }
    }

    const recall = matchedActions / (baselineActions?.length || 1);
    const precision =
      (analysisActions?.length || 0) > 0 ? matchedActions / (analysisActions?.length || 1) : 0;
    const avgQuality = matchedActions > 0 ? totalQuality / matchedActions : 0;

    return recall * 4 + precision * 3 + avgQuality * 3;
  }

  private scoreResponseQuality(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
  ): number {
    // Use recommended_actions as proxy for response quality
    const analysisResponse = analysis.phase2_results?.contextual_insights?.recommended_actions;
    const baselineResponse = baseline.phase2_results?.contextual_insights?.recommended_actions;
    if (!analysisResponse || !baselineResponse) {
      return (analysisResponse === baselineResponse) ? 10 : 0;
    }

    let score = 0;

    // Convert string arrays to strings for comparison
    const analysisResponseStr = Array.isArray(analysisResponse) ? analysisResponse.join(' ') : analysisResponse;
    const baselineResponseStr = Array.isArray(baselineResponse) ? baselineResponse.join(' ') : baselineResponse;

    // Tone appropriateness (30%)
    const toneSimilarity = this.compareTone(
      analysisResponseStr,
      baselineResponseStr,
    );
    score += toneSimilarity * 3;

    // Key points coverage (40%)
    const keyPointsCoverage = this.compareKeyPoints(
      analysisResponseStr,
      baselineResponseStr,
    );
    score += keyPointsCoverage * 4;

    // Professional quality (30%)
    const professionalQuality = this.assessProfessionalQuality(
      analysisResponseStr,
    );
    score += professionalQuality * 3;

    return Math.min(10, score);
  }

  // Helper methods
  private isCloseWorkflowState(state1: string, state2: string): boolean {
    const stateGroups = {
      START_POINT: ["NEW", "INITIAL"],
      IN_PROGRESS: ["WORKING", "PROCESSING", "WAITING"],
      COMPLETION: ["DONE", "CLOSED", "RESOLVED"],
    };

    for (const [key, values] of Object.entries(stateGroups)) {
      if (
        (state1 === key || values.includes(state1)) &&
        (state2 === key || values.includes(state2))
      ) {
        return true;
      }
    }

    return false;
  }

  private isClosePriority(priority1: string, priority2: string): boolean {
    const priorityLevels = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const index1 = priorityLevels.indexOf(priority1);
    const index2 = priorityLevels.indexOf(priority2);

    return Math.abs(index1 - index2) <= 1;
  }

  private compareUrgencyIndicators(
    indicators1: string[],
    indicators2: string[],
  ): number {
    if (!indicators2 || indicators2.length === 0) return (!indicators1 || indicators1.length === 0) ? 1 : 0;

    const matches = (indicators1 || []).filter((i: any) =>
      indicators2.some(
        (j: any) =>
          i.toLowerCase().includes(j.toLowerCase()) ||
          j.toLowerCase().includes(i.toLowerCase()),
      ),
    ).length;

    return matches / (indicators2?.length || 1);
  }

  private calculatePrecision(predicted: string[], actual: string[]): number {
    if (!predicted || predicted.length === 0) return (!actual || actual.length === 0) ? 1 : 0;
    const correct = predicted.filter((p: any) => actual?.includes(p)).length || 0;
    return correct / (predicted.length || 1);
  }

  private calculateRecall(predicted: string[], actual: string[]): number {
    if (!actual || actual.length === 0) return 1;
    const correct = (predicted || []).filter((p: any) => actual.includes(p)).length;
    return correct / (actual.length || 1);
  }

  private calculateF1Score(precision: number, recall: number): number {
    if (precision + recall === 0) return 0;
    return (2 * (precision * recall)) / (precision + recall);
  }

  private isRelatedProcess(process1: string, process2: string): boolean {
    const processGroups = {
      "Order Management": ["Order Processing", "PO Management", "Sales Order"],
      "Quote Processing": ["Quote Management", "RFQ", "Pricing"],
      "Issue Resolution": ["Case Management", "Support", "Escalation"],
    };

    for (const [key, values] of Object.entries(processGroups)) {
      if (
        (process1 === key || values.includes(process1)) &&
        (process2 === key || values.includes(process2))
      ) {
        return true;
      }
    }

    return false;
  }

  private isSimilarSLAStatus(status1: string, status2: string): boolean {
    const riskLevels = ["ON_TRACK", "AT_RISK", "VIOLATED"];
    const index1 = riskLevels.indexOf(status1);
    const index2 = riskLevels.indexOf(status2);

    return Math.abs(index1 - index2) <= 1;
  }

  private compareBusinessImpact(impact1: string, impact2: string): number {
    // Simple text similarity for now
    const words1 = impact1.toLowerCase().split(/\s+/);
    const words2 = impact2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter((w: any) => words2.includes(w)).length;

    return commonWords / Math.max(words1.length || 1, words2.length || 1);
  }

  private findBestActionMatch(
    baselineAction: any,
    analysisActions: any[],
  ): { action: any; quality: number } | null {
    let bestMatch = null;
    let bestScore = 0;

    for (const action of analysisActions) {
      const score = this.scoreActionMatch(baselineAction, action);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { action, quality: score };
      }
    }

    return bestScore > 0.5 ? bestMatch : null;
  }

  private scoreActionMatch(action1: any, action2: any): number {
    let score = 0;

    // Task similarity (50%)
    if (action1.task && action2.task) {
      const taskSimilarity = this.textSimilarity(action1.task, action2.task);
      score += taskSimilarity * 0.5;
    }

    // Owner match (25%)
    if (
      action1.owner &&
      action2.owner &&
      action1.owner?.toLowerCase() === action2.owner?.toLowerCase()
    ) {
      score += 0.25;
    }

    // Deadline similarity (25%)
    if (action1.deadline && action2.deadline) {
      const deadlineSimilarity = this.compareDeadlines(
        action1.deadline,
        action2.deadline,
      );
      score += deadlineSimilarity * 0.25;
    }

    return score;
  }

  private textSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter((w: any) => words2.includes(w)).length;

    return commonWords / Math.max(words1.length || 1, words2.length || 1);
  }

  private compareDeadlines(deadline1: string, deadline2: string): number {
    // Check for exact match
    if (deadline1.toLowerCase() === deadline2.toLowerCase()) return 1;

    // Check for similar urgency
    const urgentTerms = ["today", "immediate", "asap", "urgent"];
    const nearTerms = ["tomorrow", "24 hours", "1 day", "next day"];

    const isUrgent1 = urgentTerms.some((t: any) =>
      deadline1.toLowerCase().includes(t),
    );
    const isUrgent2 = urgentTerms.some((t: any) =>
      deadline2.toLowerCase().includes(t),
    );

    if (isUrgent1 === isUrgent2) return 0.8;

    const isNear1 = nearTerms.some((t: any) => deadline1.toLowerCase().includes(t));
    const isNear2 = nearTerms.some((t: any) => deadline2.toLowerCase().includes(t));

    if (isNear1 === isNear2) return 0.6;

    return 0.2;
  }

  private compareTone(response1: string, response2: string): number {
    const toneIndicators = {
      professional: ["acknowledge", "assist", "ensure", "provide"],
      urgent: ["immediate", "asap", "urgent", "priority"],
      apologetic: ["apologize", "sorry", "regret", "inconvenience"],
      informative: ["update", "inform", "notify", "advise"],
    };

    let matchScore = 0;
    let totalChecks = 0;

    for (const [tone, keywords] of Object.entries(toneIndicators)) {
      const has1 = keywords.some((k: any) => response1.toLowerCase().includes(k));
      const has2 = keywords.some((k: any) => response2.toLowerCase().includes(k));

      if (has1 === has2) matchScore++;
      totalChecks++;
    }

    return matchScore / totalChecks;
  }

  private compareKeyPoints(response1: string, response2: string): number {
    // Extract key points (simplified - in production would use NLP)
    const extractKeyPoints = (text: string): string[] => {
      return text
        .split(/[.!?]/)
        .filter((s: any) => s.trim().length > 10)
        .map((s: any) => s.trim().toLowerCase());
    };

    const points1 = extractKeyPoints(response1);
    const points2 = extractKeyPoints(response2);

    if (!points2 || points2.length === 0) return (!points1 || points1.length === 0) ? 1 : 0;

    let covered = 0;
    for (const point2 of points2) {
      if (points1.some((p1: any) => this.textSimilarity(p1, point2) > 0.6)) {
        covered++;
      }
    }

    return covered / (points2?.length || 1);
  }

  private assessProfessionalQuality(response: string): number {
    let score = 5; // Base score

    // Check for professional language
    const professionalTerms = [
      "acknowledge",
      "assist",
      "ensure",
      "appreciate",
      "confirm",
      "review",
      "process",
      "update",
    ];

    const hasProfessionalTerms = professionalTerms.some((t: any) =>
      response.toLowerCase().includes(t),
    );

    if (hasProfessionalTerms) score += 2;

    // Check for proper structure
    const responseLength = response?.length || 0;
    if (responseLength > 30 && responseLength < 300) score += 1.5;

    // Check for action commitment
    const hasActionCommitment = /will|shall|going to/i.test(response);
    if (hasActionCommitment) score += 1.5;

    return Math.min(10, score);
  }

  private generateScoringDetails(
    analysis: EmailAnalysis,
    baseline: EmailAnalysis,
    dimensions: ScoringDimensions,
  ): string[] {
    const details: string[] = [];

    // Context understanding details
    if (analysis.workflow_type !== baseline.workflow_type) {
      details.push(
        `Workflow type mismatch: ${analysis.workflow_type} vs ${baseline.workflow_type}`,
      );
    }

    // Entity extraction details
    const entityTypes = ["po_numbers", "quotes", "cases"] as const;
    for (const type of entityTypes) {
      const analysisCount = analysis.phase1_results?.entities?.[type]?.length || 0;
      const baselineCount = baseline.phase1_results?.entities?.[type]?.length || 0;

      if (analysisCount !== baselineCount) {
        details.push(
          `${type}: found ${analysisCount}, expected ${baselineCount}`,
        );
      }
    }

    // Action items details
    const analysisActionCount = analysis.phase2_results?.action_items?.length || 0;
    const baselineActionCount = baseline.phase2_results?.action_items?.length || 0;

    if (analysisActionCount !== baselineActionCount) {
      details.push(
        `Action items: found ${analysisActionCount}, expected ${baselineActionCount}`,
      );
    }

    return details;
  }
}

// Export convenience function
export function scoreAnalysis(
  analysis: EmailAnalysis,
  baseline: EmailAnalysis,
): number {
  const scorer = new AnalysisScorer();
  const result = scorer.scoreAnalysis(analysis, baseline);
  return result.overall;
}

export function getDetailedScore(
  analysis: EmailAnalysis,
  baseline: EmailAnalysis,
): DetailedScore {
  const scorer = new AnalysisScorer();
  return scorer.scoreAnalysis(analysis, baseline);
}
