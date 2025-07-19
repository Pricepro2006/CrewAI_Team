/**
 * CoherenceAnalyzer - Evaluates coherence and logical flow of responses
 * Analyzes response structure, consistency, and readability
 */

import { TokenConfidence } from '../types.js';

export interface CoherenceResult {
  score: number;
  structuralCoherence: number;
  logicalFlow: number;
  linguisticCoherence: number;
  topicConsistency: number;
  readabilityScore: number;
  issues: string[];
}

export class CoherenceAnalyzer {
  /**
   * Analyze response coherence
   */
  analyzeCoherence(response: string, tokenConfidence?: TokenConfidence[]): CoherenceResult {
    // Analyze different aspects of coherence
    const structuralCoherence = this.analyzeStructuralCoherence(response);
    const logicalFlow = this.analyzeLogicalFlow(response);
    const linguisticCoherence = this.analyzeLinguisticCoherence(response, tokenConfidence);
    const topicConsistency = this.analyzeTopicConsistency(response);
    const readabilityScore = this.calculateReadabilityScore(response);
    
    // Identify issues
    const issues = this.identifyCoherenceIssues(response, {
      structuralCoherence,
      logicalFlow,
      linguisticCoherence,
      topicConsistency,
      readabilityScore
    });
    
    // Calculate overall coherence score
    const score = this.calculateOverallCoherence({
      structuralCoherence,
      logicalFlow,
      linguisticCoherence,
      topicConsistency,
      readabilityScore
    });
    
    return {
      score,
      structuralCoherence,
      logicalFlow,
      linguisticCoherence,
      topicConsistency,
      readabilityScore,
      issues
    };
  }

  /**
   * Analyze structural coherence
   */
  private analyzeStructuralCoherence(response: string): number {
    let score = 0.5; // Base score
    
    // Check for proper sentence structure
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    
    // Check sentence length distribution
    const avgSentenceLength = response.length / sentences.length;
    if (avgSentenceLength > 10 && avgSentenceLength < 100) {
      score += 0.2; // Good sentence length
    }
    
    // Check for paragraph structure (simplified)
    const paragraphs = response.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      score += 0.1; // Multiple paragraphs indicate structure
    }
    
    // Check for transition words
    const transitionWords = [
      'however', 'therefore', 'moreover', 'furthermore', 'additionally',
      'consequently', 'meanwhile', 'similarly', 'in contrast', 'on the other hand',
      'for example', 'for instance', 'in addition', 'as a result'
    ];
    
    const transitionCount = transitionWords.filter(word => 
      response.toLowerCase().includes(word)
    ).length;
    
    if (transitionCount > 0) {
      score += Math.min(0.2, transitionCount * 0.05);
    }
    
    return Math.min(1, score);
  }

  /**
   * Analyze logical flow
   */
  private analyzeLogicalFlow(response: string): number {
    let score = 0.6; // Base score
    
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    // Check for logical progression markers
    const progressionMarkers = [
      'first', 'second', 'third', 'finally', 'lastly',
      'initially', 'then', 'next', 'subsequently',
      'before', 'after', 'during', 'while'
    ];
    
    const hasProgression = progressionMarkers.some(marker => 
      response.toLowerCase().includes(marker)
    );
    
    if (hasProgression) {
      score += 0.15;
    }
    
    // Check for cause-effect relationships
    const causalMarkers = [
      'because', 'since', 'due to', 'as a result', 'therefore',
      'consequently', 'thus', 'hence', 'leads to', 'causes'
    ];
    
    const hasCausal = causalMarkers.some(marker => 
      response.toLowerCase().includes(marker)
    );
    
    if (hasCausal) {
      score += 0.15;
    }
    
    // Check for contradictions (negative impact)
    const contradictionMarkers = [
      'but then', 'however then', 'although but', 'despite however'
    ];
    
    const hasContradictions = contradictionMarkers.some(marker => 
      response.toLowerCase().includes(marker)
    );
    
    if (hasContradictions) {
      score -= 0.2;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Analyze linguistic coherence
   */
  private analyzeLinguisticCoherence(response: string, tokenConfidence?: TokenConfidence[]): number {
    let score = 0.7; // Base score
    
    // Check for repetitive language
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = uniqueWords.size / words.length;
    
    if (repetitionRatio > 0.7) {
      score += 0.1; // Good lexical diversity
    } else if (repetitionRatio < 0.5) {
      score -= 0.2; // Too repetitive
    }
    
    // Check for pronouns with unclear antecedents
    const pronouns = ['it', 'this', 'that', 'they', 'them', 'these', 'those'];
    const sentences = response.split(/[.!?]+/);
    
    let unclearPronouns = 0;
    sentences.forEach((sentence, index) => {
      if (index === 0) return; // Skip first sentence
      
      const sentenceLower = sentence.toLowerCase();
      const hasPronouns = pronouns.some(pronoun => sentenceLower.includes(pronoun));
      
      if (hasPronouns && sentence.length < 50) {
        unclearPronouns++;
      }
    });
    
    if (unclearPronouns > 0) {
      score -= unclearPronouns * 0.05;
    }
    
    // Factor in token confidence if available
    if (tokenConfidence && tokenConfidence.length > 0) {
      const avgTokenConfidence = tokenConfidence.reduce((sum, token) => sum + token.confidence, 0) / tokenConfidence.length;
      score = score * 0.7 + avgTokenConfidence * 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Analyze topic consistency
   */
  private analyzeTopicConsistency(response: string): number {
    let score = 0.8; // Base score
    
    // Extract potential topics/themes
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length < 2) return score;
    
    // Look for topic shifts (simplified approach)
    const topicWords = this.extractTopicWords(response);
    
    // Check if response maintains focus on key topics
    const firstSentenceWords = this.extractTopicWords(sentences[0]);
    const lastSentenceWords = this.extractTopicWords(sentences[sentences.length - 1]);
    
    // Calculate topic overlap between beginning and end
    const overlap = firstSentenceWords.filter(word => lastSentenceWords.includes(word));
    const overlapRatio = overlap.length / Math.max(firstSentenceWords.length, lastSentenceWords.length);
    
    if (overlapRatio > 0.3) {
      score += 0.1; // Good topic consistency
    } else if (overlapRatio < 0.1) {
      score -= 0.2; // Topic drift
    }
    
    // Check for abrupt topic changes
    let topicShifts = 0;
    for (let i = 1; i < sentences.length; i++) {
      const currentWords = this.extractTopicWords(sentences[i]);
      const prevWords = this.extractTopicWords(sentences[i - 1]);
      
      const sentenceOverlap = currentWords.filter(word => prevWords.includes(word));
      const sentenceOverlapRatio = sentenceOverlap.length / Math.max(currentWords.length, prevWords.length);
      
      if (sentenceOverlapRatio < 0.1 && currentWords.length > 3 && prevWords.length > 3) {
        topicShifts++;
      }
    }
    
    if (topicShifts > sentences.length * 0.3) {
      score -= 0.3; // Too many topic shifts
    }
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate readability score
   */
  private calculateReadabilityScore(response: string): number {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = response.split(/\s+/).filter(w => w.trim().length > 0);
    
    if (sentences.length === 0 || words.length === 0) return 0;
    
    // Calculate average sentence length
    const avgSentenceLength = words.length / sentences.length;
    
    // Calculate average word length
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    
    // Simple readability formula (higher is harder to read)
    const complexity = (avgSentenceLength * 0.4) + (avgWordLength * 0.6);
    
    // Convert to score (0-1, where 1 is most readable)
    let readability = 1;
    
    if (complexity > 25) {
      readability = 0.3; // Very difficult
    } else if (complexity > 20) {
      readability = 0.5; // Difficult
    } else if (complexity > 15) {
      readability = 0.7; // Moderate
    } else if (complexity > 10) {
      readability = 0.9; // Easy
    }
    
    return readability;
  }

  /**
   * Extract topic words from text
   */
  private extractTopicWords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be',
      'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their'
    ]);
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word))
      .slice(0, 10); // Limit to top 10 topic words
  }

  /**
   * Calculate overall coherence score
   */
  private calculateOverallCoherence(metrics: {
    structuralCoherence: number;
    logicalFlow: number;
    linguisticCoherence: number;
    topicConsistency: number;
    readabilityScore: number;
  }): number {
    const weights = {
      structuralCoherence: 0.2,
      logicalFlow: 0.25,
      linguisticCoherence: 0.25,
      topicConsistency: 0.2,
      readabilityScore: 0.1
    };
    
    return (
      metrics.structuralCoherence * weights.structuralCoherence +
      metrics.logicalFlow * weights.logicalFlow +
      metrics.linguisticCoherence * weights.linguisticCoherence +
      metrics.topicConsistency * weights.topicConsistency +
      metrics.readabilityScore * weights.readabilityScore
    );
  }

  /**
   * Identify specific coherence issues
   */
  private identifyCoherenceIssues(response: string, metrics: {
    structuralCoherence: number;
    logicalFlow: number;
    linguisticCoherence: number;
    topicConsistency: number;
    readabilityScore: number;
  }): string[] {
    const issues: string[] = [];
    
    if (metrics.structuralCoherence < 0.5) {
      issues.push('Poor sentence structure and organization');
    }
    
    if (metrics.logicalFlow < 0.5) {
      issues.push('Weak logical progression between ideas');
    }
    
    if (metrics.linguisticCoherence < 0.5) {
      issues.push('Unclear pronoun references or repetitive language');
    }
    
    if (metrics.topicConsistency < 0.5) {
      issues.push('Topic drift or inconsistent focus');
    }
    
    if (metrics.readabilityScore < 0.4) {
      issues.push('Difficult to read due to complex sentences or vocabulary');
    }
    
    // Check for specific patterns
    if (response.includes('...') || response.includes('etc.')) {
      issues.push('Incomplete thoughts or trailing off');
    }
    
    if (response.split(/[.!?]+/).some(s => s.trim().length > 200)) {
      issues.push('Some sentences are too long and complex');
    }
    
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length > 0 && sentences.some(s => s.trim().length < 5)) {
      issues.push('Some sentences are too short or fragmented');
    }
    
    return issues;
  }

  /**
   * Get coherence category
   */
  getCoherenceCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 0.8) return 'excellent';
    if (score >= 0.65) return 'good';
    if (score >= 0.5) return 'fair';
    return 'poor';
  }

  /**
   * Suggest improvements
   */
  suggestImprovements(result: CoherenceResult): string[] {
    const suggestions: string[] = [];
    
    if (result.structuralCoherence < 0.6) {
      suggestions.push('Use clear paragraph breaks and transition words');
      suggestions.push('Ensure each sentence has a clear subject and predicate');
    }
    
    if (result.logicalFlow < 0.6) {
      suggestions.push('Add logical connectors (therefore, however, for example)');
      suggestions.push('Present information in a more sequential order');
    }
    
    if (result.linguisticCoherence < 0.6) {
      suggestions.push('Avoid repetitive language and vary sentence structure');
      suggestions.push('Ensure pronouns have clear antecedents');
    }
    
    if (result.topicConsistency < 0.6) {
      suggestions.push('Maintain focus on the main topic throughout');
      suggestions.push('Use consistent terminology');
    }
    
    if (result.readabilityScore < 0.5) {
      suggestions.push('Break up long sentences into shorter ones');
      suggestions.push('Use simpler vocabulary where appropriate');
    }
    
    return suggestions;
  }
}