/**
 * CoherenceAnalyzer - Evaluates response coherence and structure
 * Analyzes logical flow, consistency, and readability
 */

export interface CoherenceResult {
  score: number;
  logicalFlow: number;
  consistency: number;
  readability: number;
  issues: CoherenceIssue[];
}

export interface CoherenceIssue {
  type: 'contradiction' | 'repetition' | 'discontinuity' | 'unclear' | 'grammatical';
  description: string;
  location?: string;
  severity: 'low' | 'medium' | 'high';
}

export class CoherenceAnalyzer {
  /**
   * Analyze overall coherence of the response
   * @param response Generated response text
   * @returns Coherence analysis result
   */
  analyzeCoherence(response: string): CoherenceResult {
    const issues: CoherenceIssue[] = [];

    // Analyze different aspects
    const logicalFlow = this.assessLogicalFlow(response, issues);
    const consistency = this.assessConsistency(response, issues);
    const readability = this.assessReadability(response, issues);

    // Calculate overall score
    const score = (logicalFlow * 0.4 + consistency * 0.3 + readability * 0.3);

    return {
      score,
      logicalFlow,
      consistency,
      readability,
      issues
    };
  }

  /**
   * Assess logical flow of the response
   */
  private assessLogicalFlow(response: string, issues: CoherenceIssue[]): number {
    let score = 1.0;
    const sentences = this.splitIntoSentences(response);

    if (sentences.length < 2) {
      return score; // Too short to assess flow
    }

    // Check for logical connectors
    const connectors = this.countLogicalConnectors(response);
    const expectedConnectors = Math.floor(sentences.length / 3);
    
    if (connectors < expectedConnectors) {
      score -= 0.1;
      issues.push({
        type: 'discontinuity',
        description: 'Response lacks logical connectors between ideas',
        severity: 'low'
      });
    }

    // Check for abrupt topic changes
    const topicShifts = this.detectTopicShifts(sentences);
    if (topicShifts > sentences.length / 4) {
      score -= 0.2;
      issues.push({
        type: 'discontinuity',
        description: 'Response contains abrupt topic changes',
        severity: 'medium'
      });
    }

    // Check for proper introduction and conclusion
    if (!this.hasProperIntroduction(sentences[0])) {
      score -= 0.1;
    }

    if (sentences.length > 3 && !this.hasProperConclusion(sentences[sentences.length - 1])) {
      score -= 0.1;
    }

    return Math.max(0, score);
  }

  /**
   * Assess consistency in the response
   */
  private assessConsistency(response: string, issues: CoherenceIssue[]): number {
    let score = 1.0;

    // Check for contradictions
    const contradictions = this.detectContradictions(response);
    for (const contradiction of contradictions) {
      score -= 0.2;
      issues.push({
        type: 'contradiction',
        description: contradiction,
        severity: 'high'
      });
    }

    // Check for repetitions
    const repetitions = this.detectRepetitions(response);
    for (const repetition of repetitions) {
      score -= 0.1;
      issues.push({
        type: 'repetition',
        description: repetition,
        severity: 'low'
      });
    }

    // Check for tense consistency
    if (!this.hasTenseConsistency(response)) {
      score -= 0.1;
      issues.push({
        type: 'consistency',
        description: 'Inconsistent verb tenses throughout response',
        severity: 'medium'
      });
    }

    return Math.max(0, score);
  }

  /**
   * Assess readability of the response
   */
  private assessReadability(response: string, issues: CoherenceIssue[]): number {
    let score = 1.0;

    // Check sentence length variation
    const sentenceLengths = this.getSentenceLengths(response);
    const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;

    if (avgLength > 25) {
      score -= 0.1;
      issues.push({
        type: 'unclear',
        description: 'Sentences are too long on average',
        severity: 'low'
      });
    }

    // Check for overly complex sentences
    const complexSentences = sentenceLengths.filter(len => len > 40).length;
    if (complexSentences > sentenceLengths.length * 0.2) {
      score -= 0.15;
      issues.push({
        type: 'unclear',
        description: 'Too many complex sentences reduce readability',
        severity: 'medium'
      });
    }

    // Check paragraph structure
    const paragraphs = response.split(/\n\n+/);
    if (paragraphs.length === 1 && response.length > 500) {
      score -= 0.1;
      issues.push({
        type: 'unclear',
        description: 'Long response lacks paragraph breaks',
        severity: 'low'
      });
    }

    // Check for unclear pronouns
    const unclearPronouns = this.countUnclearPronouns(response);
    if (unclearPronouns > 2) {
      score -= 0.1;
      issues.push({
        type: 'unclear',
        description: 'Multiple unclear pronoun references',
        severity: 'medium'
      });
    }

    return Math.max(0, score);
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);
  }

  /**
   * Count logical connectors in text
   */
  private countLogicalConnectors(text: string): number {
    const connectors = [
      /\b(therefore|thus|hence|consequently)\b/gi,
      /\b(however|nevertheless|nonetheless|but)\b/gi,
      /\b(furthermore|moreover|additionally|also)\b/gi,
      /\b(for example|for instance|such as)\b/gi,
      /\b(in contrast|on the other hand|conversely)\b/gi,
      /\b(first|second|third|finally|lastly)\b/gi
    ];

    let count = 0;
    connectors.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) count += matches.length;
    });

    return count;
  }

  /**
   * Detect topic shifts between sentences
   */
  private detectTopicShifts(sentences: string[]): number {
    let shifts = 0;

    for (let i = 1; i < sentences.length; i++) {
      const prevTerms = this.extractKeyTerms(sentences[i - 1]);
      const currTerms = this.extractKeyTerms(sentences[i]);

      // Calculate overlap
      const overlap = prevTerms.filter(term => currTerms.includes(term)).length;
      const minOverlap = Math.min(prevTerms.length, currTerms.length) * 0.2;

      if (overlap < minOverlap) {
        shifts++;
      }
    }

    return shifts;
  }

  /**
   * Extract key terms from a sentence
   */
  private extractKeyTerms(sentence: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be'
    ]);

    return sentence
      .toLowerCase()
      .split(/\W+/)
      .filter(term => term.length > 3 && !stopWords.has(term));
  }

  /**
   * Check if sentence has proper introduction characteristics
   */
  private hasProperIntroduction(sentence: string): boolean {
    const introPatterns = [
      /^(To answer|In response to|Regarding)/i,
      /^[A-Z]\w+\s+(is|are|refers to|means)/i,
      /^(The|This|These)\s+\w+/i
    ];

    return introPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Check if sentence has proper conclusion characteristics
   */
  private hasProperConclusion(sentence: string): boolean {
    const conclusionPatterns = [
      /\b(in conclusion|in summary|to summarize|therefore|thus)\b/i,
      /\b(overall|in general|essentially)\b/i
    ];

    return conclusionPatterns.some(pattern => pattern.test(sentence));
  }

  /**
   * Detect contradictions in the response
   */
  private detectContradictions(response: string): string[] {
    const contradictions: string[] = [];
    const sentences = this.splitIntoSentences(response);

    // Look for explicit contradictions
    const contradictionPatterns = [
      /\bbut\s+(?:also|instead|rather)\b/i,
      /\bhowever\s+(?:also|actually)\b/i,
      /\bon the contrary\b/i
    ];

    contradictionPatterns.forEach(pattern => {
      if (pattern.test(response)) {
        contradictions.push('Response contains contradictory statements');
      }
    });

    // Look for numerical contradictions
    const numbers = response.match(/\b\d+\b/g);
    if (numbers && numbers.length > 1) {
      const uniqueNumbers = [...new Set(numbers)];
      if (uniqueNumbers.length !== numbers.length) {
        // Same thing described with different numbers
        const contexts = numbers.map(num => {
          const index = response.indexOf(num);
          return response.substring(Math.max(0, index - 20), index + 20);
        });
        
        // Check if contexts are similar
        if (this.contextsSimilar(contexts)) {
          contradictions.push('Inconsistent numerical values for the same concept');
        }
      }
    }

    return contradictions;
  }

  /**
   * Check if contexts are similar
   */
  private contextsSimilar(contexts: string[]): boolean {
    if (contexts.length < 2) return false;

    for (let i = 0; i < contexts.length - 1; i++) {
      for (let j = i + 1; j < contexts.length; j++) {
        const terms1 = this.extractKeyTerms(contexts[i]);
        const terms2 = this.extractKeyTerms(contexts[j]);
        
        const overlap = terms1.filter(term => terms2.includes(term)).length;
        if (overlap >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Detect repetitions in the response
   */
  private detectRepetitions(response: string): string[] {
    const repetitions: string[] = [];
    const sentences = this.splitIntoSentences(response);

    // Check for repeated sentences
    const uniqueSentences = new Set(sentences.map(s => s.toLowerCase().trim()));
    if (uniqueSentences.size < sentences.length) {
      repetitions.push('Response contains repeated sentences');
    }

    // Check for repeated phrases (more than 4 words)
    const phrases = this.extractPhrases(response, 4);
    const phraseCounts = new Map<string, number>();

    phrases.forEach(phrase => {
      const count = (phraseCounts.get(phrase) || 0) + 1;
      phraseCounts.set(phrase, count);
    });

    phraseCounts.forEach((count, phrase) => {
      if (count > 2) {
        repetitions.push(`Phrase "${phrase}" is repeated ${count} times`);
      }
    });

    return repetitions;
  }

  /**
   * Extract phrases of given length
   */
  private extractPhrases(text: string, length: number): string[] {
    const words = text.toLowerCase().split(/\s+/);
    const phrases: string[] = [];

    for (let i = 0; i <= words.length - length; i++) {
      phrases.push(words.slice(i, i + length).join(' '));
    }

    return phrases;
  }

  /**
   * Check for tense consistency
   */
  private hasTenseConsistency(response: string): boolean {
    // Simple check for tense markers
    const pastMarkers = (response.match(/\b(was|were|had|did)\b/gi) || []).length;
    const presentMarkers = (response.match(/\b(is|are|has|does)\b/gi) || []).length;
    const futureMarkers = (response.match(/\b(will|shall|going to)\b/gi) || []).length;

    const totalMarkers = pastMarkers + presentMarkers + futureMarkers;
    if (totalMarkers === 0) return true;

    // Check if one tense dominates (at least 70%)
    const maxMarkers = Math.max(pastMarkers, presentMarkers, futureMarkers);
    return maxMarkers / totalMarkers >= 0.7;
  }

  /**
   * Get sentence lengths
   */
  private getSentenceLengths(response: string): number[] {
    return this.splitIntoSentences(response)
      .map(sentence => sentence.split(/\s+/).length);
  }

  /**
   * Count unclear pronoun references
   */
  private countUnclearPronouns(response: string): number {
    const pronouns = ['it', 'this', 'that', 'these', 'those', 'they'];
    let unclearCount = 0;

    const sentences = this.splitIntoSentences(response);
    
    sentences.forEach((sentence, index) => {
      pronouns.forEach(pronoun => {
        const regex = new RegExp(`\\b${pronoun}\\b`, 'gi');
        if (regex.test(sentence)) {
          // Check if there's a clear antecedent in current or previous sentence
          const prevSentence = index > 0 ? sentences[index - 1] : '';
          const combined = prevSentence + ' ' + sentence;
          
          // Simple heuristic: if no noun before pronoun, it's unclear
          const beforePronoun = combined.substring(0, combined.toLowerCase().indexOf(pronoun));
          const nouns = beforePronoun.match(/\b[A-Z][a-z]+\b/g);
          
          if (!nouns || nouns.length === 0) {
            unclearCount++;
          }
        }
      });
    });

    return unclearCount;
  }

  /**
   * Get coherence category
   */
  getCoherenceCategory(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 0.9) return 'excellent';
    if (score >= 0.7) return 'good';
    if (score >= 0.5) return 'fair';
    return 'poor';
  }
}