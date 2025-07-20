/**
 * QueryComplexityAnalyzer - Analyzes query complexity for confidence scoring
 * Determines routing strategy based on query characteristics
 */

import type { QueryComplexity } from './types.js';

export class QueryComplexityAnalyzer {
  private complexityCache = new Map<string, QueryComplexity>();
  private readonly cacheSize = 1000;

  /**
   * Assess the complexity of a query
   */
  async assessComplexity(query: string): Promise<QueryComplexity> {
    const cacheKey = this.getCacheKey(query);
    
    // Check cache first
    if (this.complexityCache.has(cacheKey)) {
      return this.complexityCache.get(cacheKey)!;
    }

    const complexity = this.calculateComplexity(query);
    
    // Cache the result
    this.cacheResult(cacheKey, complexity);
    
    return complexity;
  }

  /**
   * Calculate complexity score and factors
   */
  private calculateComplexity(query: string): QueryComplexity {
    const factors = {
      syntacticComplexity: this.calculateSyntacticComplexity(query),
      semanticComplexity: this.calculateSemanticComplexity(query),
      domainSpecificity: this.calculateDomainSpecificity(query),
      multiIntent: this.detectMultiIntent(query),
      ambiguity: this.calculateAmbiguity(query)
    };

    // Calculate overall score (0-10)
    const score = this.calculateOverallScore(factors);
    
    const classification = this.classifyComplexity(score);
    const reasoning = this.generateReasoning(factors, score);

    return {
      score,
      factors,
      classification,
      reasoning
    };
  }

  /**
   * Calculate syntactic complexity
   */
  private calculateSyntacticComplexity(query: string): number {
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = query.split(/\s+/).length;
    const avgWordsPerSentence = words / Math.max(sentences.length, 1);
    
    // Score based on sentence length and structure
    let score = 0;
    
    // Length factor
    if (avgWordsPerSentence > 20) score += 0.4;
    else if (avgWordsPerSentence > 10) score += 0.2;
    
    // Multiple sentences
    if (sentences.length > 2) score += 0.2;
    
    // Complex punctuation
    if (/[;:,]/.test(query)) score += 0.1;
    
    // Nested structures
    if (/\([^)]*\)/.test(query)) score += 0.1;
    
    // Question complexity
    if (query.includes('?') && query.split('?').length > 2) score += 0.2;
    
    return Math.min(1, score);
  }

  /**
   * Calculate semantic complexity
   */
  private calculateSemanticComplexity(query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    
    // Technical terms
    const technicalTerms = [
      'algorithm', 'implementation', 'architecture', 'optimization',
      'synchronization', 'authentication', 'encryption', 'methodology',
      'configuration', 'integration', 'deployment', 'scalability'
    ];
    const techCount = technicalTerms.filter(term => lowerQuery.includes(term)).length;
    score += Math.min(0.3, techCount * 0.1);
    
    // Abstract concepts
    const abstractConcepts = [
      'concept', 'principle', 'theory', 'philosophy', 'strategy',
      'approach', 'methodology', 'framework', 'paradigm', 'best practice'
    ];
    const abstractCount = abstractConcepts.filter(term => lowerQuery.includes(term)).length;
    score += Math.min(0.2, abstractCount * 0.1);
    
    // Comparative language
    if (/\b(compare|contrast|difference|similar|versus|vs|between)\b/.test(lowerQuery)) {
      score += 0.2;
    }
    
    // Causal relationships
    if (/\b(why|because|cause|effect|reason|due to|result)\b/.test(lowerQuery)) {
      score += 0.1;
    }
    
    // Conditional logic
    if (/\b(if|when|unless|provided|given)\b/.test(lowerQuery)) {
      score += 0.1;
    }
    
    // Temporal complexity
    if (/\b(before|after|during|while|meanwhile|simultaneously)\b/.test(lowerQuery)) {
      score += 0.1;
    }
    
    return Math.min(1, score);
  }

  /**
   * Calculate domain specificity
   */
  private calculateDomainSpecificity(query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    
    // Programming/Tech domains
    const techDomains = [
      'javascript', 'python', 'java', 'typescript', 'react', 'nodejs',
      'database', 'sql', 'api', 'rest', 'graphql', 'microservices',
      'kubernetes', 'docker', 'aws', 'azure', 'cloud', 'devops'
    ];
    const techMatches = techDomains.filter(term => lowerQuery.includes(term)).length;
    if (techMatches > 0) score += 0.3;
    
    // Business domains
    const businessDomains = [
      'finance', 'accounting', 'marketing', 'sales', 'hr', 'legal',
      'compliance', 'audit', 'strategy', 'operations', 'logistics'
    ];
    const businessMatches = businessDomains.filter(term => lowerQuery.includes(term)).length;
    if (businessMatches > 0) score += 0.2;
    
    // Scientific domains
    const scienceDomains = [
      'physics', 'chemistry', 'biology', 'mathematics', 'statistics',
      'research', 'experiment', 'hypothesis', 'analysis', 'methodology'
    ];
    const scienceMatches = scienceDomains.filter(term => lowerQuery.includes(term)).length;
    if (scienceMatches > 0) score += 0.3;
    
    // Acronyms and abbreviations (high specificity)
    const acronyms = query.match(/\b[A-Z]{2,}\b/g);
    if (acronyms && acronyms.length > 0) {
      score += Math.min(0.2, acronyms.length * 0.05);
    }
    
    return Math.min(1, score);
  }

  /**
   * Detect multi-intent queries
   */
  private detectMultiIntent(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    
    // Multiple question words
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'];
    const questionCount = questionWords.filter(word => lowerQuery.includes(word)).length;
    if (questionCount > 1) return true;
    
    // Conjunctions suggesting multiple requests
    const conjunctions = ['and', 'also', 'additionally', 'furthermore', 'moreover'];
    const conjunctionCount = conjunctions.filter(word => lowerQuery.includes(word)).length;
    if (conjunctionCount > 1) return true;
    
    // Multiple action verbs
    const actionVerbs = ['explain', 'show', 'demonstrate', 'compare', 'analyze', 'evaluate'];
    const actionCount = actionVerbs.filter(verb => lowerQuery.includes(verb)).length;
    if (actionCount > 1) return true;
    
    // Multiple questions
    const questionMarks = (query.match(/\?/g) || []).length;
    if (questionMarks > 1) return true;
    
    return false;
  }

  /**
   * Calculate ambiguity score
   */
  private calculateAmbiguity(query: string): number {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    
    // Vague terms
    const vagueTerms = [
      'something', 'anything', 'things', 'stuff', 'some', 'any',
      'better', 'good', 'bad', 'right', 'wrong', 'best', 'worst'
    ];
    const vagueCount = vagueTerms.filter(term => lowerQuery.includes(term)).length;
    score += Math.min(0.3, vagueCount * 0.1);
    
    // Pronouns without clear antecedents
    const pronouns = ['it', 'this', 'that', 'these', 'those', 'they', 'them'];
    const pronounCount = pronouns.filter(pronoun => lowerQuery.includes(pronoun)).length;
    score += Math.min(0.2, pronounCount * 0.05);
    
    // Incomplete sentences
    if (!query.trim().endsWith('?') && !query.trim().endsWith('.') && !query.trim().endsWith('!')) {
      score += 0.1;
    }
    
    // Very short queries (potentially ambiguous)
    if (query.trim().split(/\s+/).length < 3) {
      score += 0.2;
    }
    
    // Modal verbs suggesting uncertainty
    const modalVerbs = ['might', 'could', 'would', 'should', 'may', 'can'];
    const modalCount = modalVerbs.filter(modal => lowerQuery.includes(modal)).length;
    score += Math.min(0.1, modalCount * 0.03);
    
    return Math.min(1, score);
  }

  /**
   * Calculate overall complexity score
   */
  private calculateOverallScore(factors: QueryComplexity['factors']): number {
    const weights = {
      syntacticComplexity: 0.2,
      semanticComplexity: 0.3,
      domainSpecificity: 0.2,
      multiIntent: 0.15,
      ambiguity: 0.15
    };
    
    const score = 
      factors.syntacticComplexity * weights.syntacticComplexity +
      factors.semanticComplexity * weights.semanticComplexity +
      factors.domainSpecificity * weights.domainSpecificity +
      (factors.multiIntent ? 1 : 0) * weights.multiIntent +
      factors.ambiguity * weights.ambiguity;
    
    // Scale to 0-10
    return Math.round(score * 10 * 100) / 100;
  }

  /**
   * Classify complexity level
   */
  private classifyComplexity(score: number): 'simple' | 'medium' | 'complex' {
    if (score <= 3) return 'simple';
    if (score <= 7) return 'medium';
    return 'complex';
  }

  /**
   * Generate reasoning explanation
   */
  private generateReasoning(factors: QueryComplexity['factors'], score: number): string {
    const reasons: string[] = [];
    
    if (factors.syntacticComplexity > 0.5) {
      reasons.push('complex sentence structure');
    }
    
    if (factors.semanticComplexity > 0.5) {
      reasons.push('technical or abstract concepts');
    }
    
    if (factors.domainSpecificity > 0.5) {
      reasons.push('domain-specific terminology');
    }
    
    if (factors.multiIntent) {
      reasons.push('multiple intents or questions');
    }
    
    if (factors.ambiguity > 0.5) {
      reasons.push('ambiguous or vague language');
    }
    
    if (reasons.length === 0) {
      return 'Simple, straightforward query';
    }
    
    return `Query classified as ${this.classifyComplexity(score)} due to: ${reasons.join(', ')}.`;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string): string {
    return `complexity:${query.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  }

  /**
   * Cache result with size limit
   */
  private cacheResult(key: string, complexity: QueryComplexity): void {
    if (this.complexityCache.size >= this.cacheSize) {
      // Remove oldest entry
      const firstKey = this.complexityCache.keys().next().value;
      if (firstKey) {
        this.complexityCache.delete(firstKey);
      }
    }
    
    this.complexityCache.set(key, complexity);
  }

  /**
   * Get cached complexity analysis
   */
  getCachedComplexity(query: string): QueryComplexity | null {
    const key = this.getCacheKey(query);
    return this.complexityCache.get(key) || null;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.complexityCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.complexityCache.size,
      maxSize: this.cacheSize,
      hitRate: 0 // Would need tracking to implement
    };
  }
}