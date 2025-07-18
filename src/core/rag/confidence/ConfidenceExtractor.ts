/**
 * ConfidenceExtractor - Extracts and processes confidence scores from LLM outputs
 * Based on 2025 best practices for confidence calibration
 */

import { TokenConfidence, GenerationMetrics } from './types';

export class ConfidenceExtractor {
  private readonly EPSILON = 1e-10; // Small value to avoid log(0)
  private readonly UNCERTAINTY_PHRASES = [
    'maybe', 'perhaps', 'possibly', 'might', 'could be', 
    'uncertain', 'not sure', 'i think', 'i believe', 'probably',
    'it seems', 'appears to be', 'likely', 'unlikely', 'sometimes'
  ];
  
  /**
   * Extract token-level confidence from log probabilities
   * @param tokens Array of tokens
   * @param logProbs Array of log probabilities
   * @returns Array of TokenConfidence objects
   */
  extractTokenConfidence(
    tokens: string[], 
    logProbs: number[]
  ): TokenConfidence[] {
    if (!tokens || !logProbs || tokens.length !== logProbs.length) {
      throw new Error('Tokens and log probabilities must have the same length');
    }

    return tokens.map((token, index) => ({
      token,
      logProbability: logProbs[index],
      confidence: this.logProbToConfidence(logProbs[index]),
      position: index
    }));
  }

  /**
   * Convert log probability to confidence score (0-1)
   * Uses sigmoid transformation for smooth mapping
   * @param logProb Log probability value
   * @returns Confidence score between 0 and 1
   */
  logProbToConfidence(logProb: number): number {
    // Handle edge cases
    if (logProb >= 0) return 1.0; // Perfect confidence
    if (logProb <= -10) return 0.0; // No confidence
    
    // Sigmoid transformation: confidence = 1 / (1 + e^(-k*logProb))
    // k=0.5 provides good scaling for typical log prob ranges
    const k = 0.5;
    const confidence = 1 / (1 + Math.exp(-k * logProb));
    
    // Ensure result is in [0, 1]
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate aggregated confidence using harmonic mean
   * Harmonic mean penalizes low confidence tokens more than arithmetic mean
   * @param tokenConfidences Array of token confidence objects
   * @returns Aggregated confidence score
   */
  aggregateConfidence(tokenConfidences: TokenConfidence[]): number {
    if (!tokenConfidences || tokenConfidences.length === 0) {
      return 0;
    }

    // Filter out tokens with very low confidence (< 0.1)
    const validConfidences = tokenConfidences
      .map(tc => tc.confidence)
      .filter(c => c >= 0.1);

    if (validConfidences.length === 0) {
      return 0;
    }

    // Calculate harmonic mean
    const harmonicMean = validConfidences.length / 
      validConfidences.reduce((sum, conf) => sum + 1 / (conf + this.EPSILON), 0);

    return harmonicMean;
  }

  /**
   * Calculate weighted confidence giving more importance to content tokens
   * @param tokenConfidences Array of token confidence objects
   * @returns Weighted confidence score
   */
  calculateWeightedConfidence(tokenConfidences: TokenConfidence[]): number {
    if (!tokenConfidences || tokenConfidences.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalWeight = 0;

    tokenConfidences.forEach(tc => {
      // Assign weights based on token importance
      let weight = 1.0;
      
      // Punctuation and short tokens get lower weight
      if (tc.token.length <= 2 || /^[.,!?;:]$/.test(tc.token)) {
        weight = 0.3;
      }
      // Common stop words get medium weight
      else if (this.isStopWord(tc.token)) {
        weight = 0.5;
      }
      // Content words get full weight
      else {
        weight = 1.0;
      }

      weightedSum += tc.confidence * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Detect uncertainty markers in text
   * @param text Generated text
   * @param tokenConfidences Token confidence data
   * @returns Array of uncertainty markers found
   */
  detectUncertaintyMarkers(
    text: string, 
    tokenConfidences?: TokenConfidence[]
  ): string[] {
    const uncertaintyMarkers: Set<string> = new Set();
    const lowerText = text.toLowerCase();

    // Check for uncertainty phrases
    this.UNCERTAINTY_PHRASES.forEach(phrase => {
      if (lowerText.includes(phrase)) {
        uncertaintyMarkers.add(phrase);
      }
    });

    // Check for low confidence regions if token data available
    if (tokenConfidences && tokenConfidences.length > 0) {
      const lowConfidenceRegions = this.findLowConfidenceRegions(tokenConfidences);
      lowConfidenceRegions.forEach(region => {
        uncertaintyMarkers.add(`Low confidence region: tokens ${region.start}-${region.end}`);
      });
    }

    // Check for contradictions or alternatives
    if (/\b(or|alternatively|however|but|although)\b/i.test(text)) {
      uncertaintyMarkers.add('Contains alternatives or contradictions');
    }

    return Array.from(uncertaintyMarkers);
  }

  /**
   * Calculate generation metrics
   * @param tokenConfidences Token confidence data
   * @returns Generation metrics object
   */
  calculateGenerationMetrics(tokenConfidences: TokenConfidence[]): GenerationMetrics {
    if (!tokenConfidences || tokenConfidences.length === 0) {
      return {
        tokensGenerated: 0,
        averageConfidence: 0,
        minConfidence: 0,
        maxConfidence: 0,
        uncertaintyRatio: 1
      };
    }

    const confidences = tokenConfidences.map(tc => tc.confidence);
    const uncertainTokens = confidences.filter(c => c < 0.6).length;

    return {
      tokensGenerated: tokenConfidences.length,
      averageConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
      minConfidence: Math.min(...confidences),
      maxConfidence: Math.max(...confidences),
      uncertaintyRatio: uncertainTokens / tokenConfidences.length
    };
  }

  /**
   * Find regions of consecutive low-confidence tokens
   * @param tokenConfidences Token confidence data
   * @param threshold Confidence threshold (default 0.5)
   * @returns Array of low confidence regions
   */
  private findLowConfidenceRegions(
    tokenConfidences: TokenConfidence[], 
    threshold: number = 0.5
  ): Array<{ start: number; end: number; avgConfidence: number }> {
    const regions: Array<{ start: number; end: number; avgConfidence: number }> = [];
    let currentRegion: { start: number; end: number; confidences: number[] } | null = null;

    tokenConfidences.forEach((tc, index) => {
      if (tc.confidence < threshold) {
        if (!currentRegion) {
          currentRegion = { start: index, end: index, confidences: [tc.confidence] };
        } else {
          currentRegion.end = index;
          currentRegion.confidences.push(tc.confidence);
        }
      } else if (currentRegion) {
        // End of low confidence region
        if (currentRegion.confidences.length >= 3) { // Only report regions of 3+ tokens
          regions.push({
            start: currentRegion.start,
            end: currentRegion.end,
            avgConfidence: currentRegion.confidences.reduce((a, b) => a + b, 0) / currentRegion.confidences.length
          });
        }
        currentRegion = null;
      }
    });

    // Handle region that extends to the end
    if (currentRegion && currentRegion.confidences.length >= 3) {
      regions.push({
        start: currentRegion.start,
        end: currentRegion.end,
        avgConfidence: currentRegion.confidences.reduce((a, b) => a + b, 0) / currentRegion.confidences.length
      });
    }

    return regions;
  }

  /**
   * Check if a token is a common stop word
   * @param token Token to check
   * @returns True if stop word
   */
  private isStopWord(token: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'cannot'
    ]);
    
    return stopWords.has(token.toLowerCase());
  }

  /**
   * Estimate confidence when log probabilities are not available
   * Uses heuristic methods based on text analysis
   * @param text Generated text
   * @returns Estimated confidence score
   */
  estimateConfidenceFromText(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }

    let confidence = 0.7; // Start with neutral confidence

    // Penalize for uncertainty markers
    const uncertaintyMarkers = this.detectUncertaintyMarkers(text);
    confidence -= uncertaintyMarkers.length * 0.1;

    // Boost for assertive language
    if (/\b(definitely|certainly|clearly|obviously|undoubtedly)\b/i.test(text)) {
      confidence += 0.1;
    }

    // Penalize for questions in response
    const questionCount = (text.match(/\?/g) || []).length;
    confidence -= questionCount * 0.05;

    // Penalize for very short responses
    if (text.trim().split(/\s+/).length < 10) {
      confidence -= 0.1;
    }

    // Ensure confidence is in valid range
    return Math.max(0.1, Math.min(0.9, confidence));
  }
}