/**
 * ConfidenceExtractor - Extracts confidence scores from model outputs
 * Analyzes various signals to determine response confidence
 */

import type { ScoredDocument } from "./types.js";

export interface ConfidenceSignals {
  modelLogProbs?: number[];
  tokenPerplexity?: number;
  semanticCoherence: number;
  sourceRelevance: number;
  answerCompleteness: number;
  consistencyScore: number;
}

export interface ExtractedConfidence {
  overallScore: number;
  signals: ConfidenceSignals;
  explanation: string;
  reliabilityLevel: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

export class ConfidenceExtractor {
  private readonly thresholds = {
    very_high: 0.9,
    high: 0.75,
    medium: 0.5,
    low: 0.25,
    very_low: 0
  };

  /**
   * Extract confidence from model output and context
   * @param response Generated response text
   * @param sources Source documents used
   * @param modelMetadata Optional model-specific metadata
   * @returns Extracted confidence with detailed signals
   */
  extractConfidence(
    response: string,
    sources: ScoredDocument[],
    modelMetadata?: Record<string, unknown>
  ): ExtractedConfidence {
    // Calculate individual confidence signals
    const signals: ConfidenceSignals = {
      modelLogProbs: this.extractLogProbs(modelMetadata),
      tokenPerplexity: this.calculatePerplexity(modelMetadata),
      semanticCoherence: this.assessSemanticCoherence(response),
      sourceRelevance: this.calculateSourceRelevance(sources),
      answerCompleteness: this.assessCompleteness(response),
      consistencyScore: this.checkConsistency(response, sources)
    };

    // Calculate overall confidence score
    const overallScore = this.aggregateSignals(signals);
    
    // Determine reliability level
    const reliabilityLevel = this.getReliabilityLevel(overallScore);
    
    // Generate explanation
    const explanation = this.generateExplanation(signals, reliabilityLevel);

    return {
      overallScore,
      signals,
      explanation,
      reliabilityLevel
    };
  }

  /**
   * Extract log probabilities from model metadata
   */
  private extractLogProbs(metadata?: Record<string, unknown>): number[] {
    if (!metadata || !metadata.logprobs) {
      return [];
    }
    
    if (Array.isArray(metadata.logprobs)) {
      return metadata.logprobs as number[];
    }
    
    return [];
  }

  /**
   * Calculate token perplexity from model output
   */
  private calculatePerplexity(metadata?: Record<string, unknown>): number {
    const logProbs = this.extractLogProbs(metadata);
    if (logProbs.length === 0) {
      return 1.0; // Default neutral perplexity
    }

    // Calculate perplexity as exp(average negative log probability)
    const avgLogProb = logProbs.reduce((sum, prob) => sum + prob, 0) / logProbs.length;
    return Math.exp(-avgLogProb);
  }

  /**
   * Assess semantic coherence of the response
   */
  private assessSemanticCoherence(response: string): number {
    // Simple heuristics for coherence assessment
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) {
      return 0;
    }

    // Check for proper sentence structure
    let coherenceScore = 0;
    
    // Length consistency
    const avgLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
    const lengthVariance = sentences.reduce((sum, s) => 
      sum + Math.pow(s.length - avgLength, 2), 0) / sentences.length;
    const lengthConsistency = 1 / (1 + lengthVariance / 1000);
    coherenceScore += lengthConsistency * 0.3;

    // Check for transitions and connectors
    const transitionWords = ['however', 'therefore', 'moreover', 'furthermore', 
                           'additionally', 'consequently', 'thus', 'hence'];
    const hasTransitions = sentences.some(s => 
      transitionWords.some(word => s.toLowerCase().includes(word)));
    if (hasTransitions) coherenceScore += 0.3;

    // Check for completeness (ends with proper punctuation)
    const lastChar = response.trim().slice(-1);
    if (['.', '!', '?'].includes(lastChar)) {
      coherenceScore += 0.2;
    }

    // Check for reasonable response length
    if (response.length > 50 && response.length < 2000) {
      coherenceScore += 0.2;
    }

    return Math.min(1, coherenceScore);
  }

  /**
   * Calculate relevance of source documents
   */
  private calculateSourceRelevance(sources: ScoredDocument[]): number {
    if (sources.length === 0) {
      return 0;
    }

    // Average the scores of source documents
    const avgScore = sources.reduce((sum, doc) => sum + (doc.score || 0), 0) / sources.length;
    
    // Normalize to 0-1 range (assuming scores are typically 0-100)
    return Math.min(1, avgScore / 100);
  }

  /**
   * Assess completeness of the answer
   */
  private assessCompleteness(response: string): number {
    // Basic completeness heuristics
    let score = 0;

    // Has substantial content
    if (response.length > 100) score += 0.3;
    
    // Contains structured information (lists, points)
    if (response.includes('\n') || response.includes('"') || response.includes('-')) {
      score += 0.2;
    }

    // Contains examples or specifics
    const hasSpecifics = /\d+|\b(for example|such as|including|specifically)\b/i.test(response);
    if (hasSpecifics) score += 0.3;

    // Has conclusion or summary
    const conclusionPatterns = /\b(in conclusion|to summarize|overall|in summary)\b/i;
    if (conclusionPatterns.test(response)) score += 0.2;

    return Math.min(1, score);
  }

  /**
   * Check consistency between response and sources
   */
  private checkConsistency(response: string, sources: ScoredDocument[]): number {
    if (sources.length === 0) {
      return 0.5; // Neutral score when no sources
    }

    // Extract key terms from sources
    const sourceTerms = new Set<string>();
    sources.forEach(doc => {
      const terms = doc.content.toLowerCase()
        .split(/\W+/)
        .filter(term => term.length > 3);
      terms.forEach(term => sourceTerms.add(term));
    });

    // Check how many source terms appear in response
    const responseTerms = response.toLowerCase()
      .split(/\W+/)
      .filter(term => term.length > 3);
    
    const matchedTerms = responseTerms.filter(term => sourceTerms.has(term));
    const matchRatio = matchedTerms.length / Math.max(responseTerms.length, 1);

    return Math.min(1, matchRatio * 2); // Scale up since not all terms need to match
  }

  /**
   * Aggregate all signals into overall confidence score
   */
  private aggregateSignals(signals: ConfidenceSignals): number {
    // Weighted average of different signals
    const weights = {
      perplexity: 0.15,
      semanticCoherence: 0.25,
      sourceRelevance: 0.25,
      answerCompleteness: 0.2,
      consistencyScore: 0.15
    };

    let weightedSum = 0;
    let totalWeight = 0;

    // Add perplexity contribution (inverse relationship)
    if (signals.tokenPerplexity !== undefined) {
      const perplexityScore = 1 / (1 + signals.tokenPerplexity / 10);
      weightedSum += perplexityScore * weights.perplexity;
      totalWeight += weights.perplexity;
    }

    // Add other signals
    weightedSum += signals.semanticCoherence * weights.semanticCoherence;
    weightedSum += signals.sourceRelevance * weights.sourceRelevance;
    weightedSum += signals.answerCompleteness * weights.answerCompleteness;
    weightedSum += signals.consistencyScore * weights.consistencyScore;
    
    totalWeight += weights.semanticCoherence + weights.sourceRelevance + 
                  weights.answerCompleteness + weights.consistencyScore;

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Determine reliability level based on score
   */
  private getReliabilityLevel(score: number): ExtractedConfidence['reliabilityLevel'] {
    if (score >= this.thresholds.very_high) return 'very_high';
    if (score >= this.thresholds.high) return 'high';
    if (score >= this.thresholds.medium) return 'medium';
    if (score >= this.thresholds.low) return 'low';
    return 'very_low';
  }

  /**
   * Generate human-readable explanation of confidence
   */
  private generateExplanation(
    signals: ConfidenceSignals, 
    level: ExtractedConfidence['reliabilityLevel']
  ): string {
    const factors: string[] = [];

    // Analyze each signal
    if (signals.semanticCoherence > 0.7) {
      factors.push('high semantic coherence');
    } else if (signals.semanticCoherence < 0.3) {
      factors.push('low semantic coherence');
    }

    if (signals.sourceRelevance > 0.7) {
      factors.push('highly relevant sources');
    } else if (signals.sourceRelevance < 0.3) {
      factors.push('weakly relevant sources');
    }

    if (signals.answerCompleteness > 0.7) {
      factors.push('comprehensive answer');
    } else if (signals.answerCompleteness < 0.3) {
      factors.push('incomplete answer');
    }

    if (signals.consistencyScore > 0.7) {
      factors.push('strong source consistency');
    } else if (signals.consistencyScore < 0.3) {
      factors.push('weak source consistency');
    }

    // Build explanation
    const levelDescriptions = {
      very_high: 'Very high confidence',
      high: 'High confidence',
      medium: 'Moderate confidence',
      low: 'Low confidence',
      very_low: 'Very low confidence'
    };

    const explanation = `${levelDescriptions[level]} based on ${factors.join(', ') || 'overall signal analysis'}.`;
    
    return explanation;
  }
}