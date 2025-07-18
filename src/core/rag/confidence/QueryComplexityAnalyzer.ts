/**
 * QueryComplexityAnalyzer - Analyzes query complexity for confidence-aware processing
 * Based on 2025 best practices for query understanding
 */

export class QueryComplexityAnalyzer {
  // Technical term patterns
  private readonly TECHNICAL_PATTERNS = [
    /\b(API|SDK|JWT|OAuth|REST|GraphQL|SQL|NoSQL|JSON|XML|YAML)\b/i,
    /\b(algorithm|optimize|performance|latency|throughput|scalability)\b/i,
    /\b(machine learning|neural network|deep learning|transformer|embedding)\b/i,
    /\b(kubernetes|docker|microservice|serverless|cloud native)\b/i,
    /\b(encryption|authentication|authorization|security|vulnerability)\b/i
  ];

  // Domain indicators
  private readonly DOMAIN_KEYWORDS: Record<string, string[]> = {
    technical: ['code', 'programming', 'software', 'debug', 'implement', 'architecture'],
    business: ['revenue', 'profit', 'customer', 'market', 'strategy', 'growth'],
    scientific: ['research', 'hypothesis', 'experiment', 'data', 'analysis', 'study'],
    creative: ['design', 'create', 'imagine', 'story', 'art', 'write'],
    educational: ['explain', 'teach', 'learn', 'understand', 'tutorial', 'guide']
  };

  // Question type indicators
  private readonly QUESTION_TYPES = {
    factual: /^(what|who|when|where|which|how many|how much)\s/i,
    explanatory: /^(how|why|explain|describe|elaborate)\s/i,
    comparative: /\b(compare|versus|vs|difference|better|worse)\b/i,
    conditional: /\b(if|when|unless|provided that|assuming)\b/i,
    procedural: /\b(steps|process|procedure|method|approach)\b/i
  };

  /**
   * Assess overall query complexity on a 1-10 scale
   * @param query The user's query
   * @returns Complexity score and analysis details
   */
  assessComplexity(query: string): {
    score: number;
    factors: {
      length: number;
      technicalDepth: number;
      multiIntent: number;
      ambiguity: number;
      domainSpecificity: number;
    };
    analysis: {
      wordCount: number;
      sentenceCount: number;
      technicalTerms: string[];
      detectedIntents: string[];
      domains: string[];
      questionType: string | null;
      ambiguousTerms: string[];
    };
  } {
    const factors = {
      length: this.assessLength(query),
      technicalDepth: this.assessTechnicalDepth(query),
      multiIntent: this.assessMultiIntent(query),
      ambiguity: this.assessAmbiguity(query),
      domainSpecificity: this.assessDomainSpecificity(query)
    };

    const analysis = {
      wordCount: this.countWords(query),
      sentenceCount: this.countSentences(query),
      technicalTerms: this.extractTechnicalTerms(query),
      detectedIntents: this.detectIntents(query),
      domains: this.detectDomains(query),
      questionType: this.detectQuestionType(query),
      ambiguousTerms: this.detectAmbiguousTerms(query)
    };

    // Calculate weighted complexity score
    const score = this.calculateComplexityScore(factors);

    return { score, factors, analysis };
  }

  /**
   * Assess query length complexity (1-10)
   */
  private assessLength(query: string): number {
    const wordCount = this.countWords(query);
    
    if (wordCount <= 5) return 1;
    if (wordCount <= 10) return 2;
    if (wordCount <= 20) return 3;
    if (wordCount <= 30) return 4;
    if (wordCount <= 50) return 5;
    if (wordCount <= 75) return 6;
    if (wordCount <= 100) return 7;
    if (wordCount <= 150) return 8;
    if (wordCount <= 200) return 9;
    return 10;
  }

  /**
   * Assess technical depth of the query (1-10)
   */
  private assessTechnicalDepth(query: string): number {
    const technicalTerms = this.extractTechnicalTerms(query);
    const technicalRatio = technicalTerms.length / Math.max(this.countWords(query), 1);
    
    // Check for technical patterns
    let patternMatches = 0;
    this.TECHNICAL_PATTERNS.forEach(pattern => {
      if (pattern.test(query)) patternMatches++;
    });

    // Calculate score based on term count and ratio
    let score = Math.min(technicalTerms.length * 2, 5); // Up to 5 points for term count
    score += Math.min(technicalRatio * 10, 3); // Up to 3 points for ratio
    score += Math.min(patternMatches, 2); // Up to 2 points for patterns
    
    return Math.min(Math.round(score), 10);
  }

  /**
   * Assess multi-intent complexity (1-10)
   */
  private assessMultiIntent(query: string): number {
    const intents = this.detectIntents(query);
    const connectives = (query.match(/\b(and|also|additionally|furthermore|moreover|plus)\b/gi) || []).length;
    const questions = (query.match(/\?/g) || []).length;
    
    let score = intents.length * 2; // 2 points per intent
    score += connectives; // 1 point per connective
    score += questions > 1 ? questions : 0; // Points for multiple questions
    
    return Math.min(score, 10);
  }

  /**
   * Assess query ambiguity (1-10)
   */
  private assessAmbiguity(query: string): number {
    const ambiguousTerms = this.detectAmbiguousTerms(query);
    const pronouns = (query.match(/\b(it|this|that|these|those|they|them)\b/gi) || []).length;
    const vagueTerms = (query.match(/\b(thing|stuff|something|anything|whatever)\b/gi) || []).length;
    const missingContext = this.detectMissingContext(query);
    
    let score = ambiguousTerms.length * 2;
    score += pronouns * 1.5;
    score += vagueTerms * 2;
    score += missingContext ? 2 : 0;
    
    return Math.min(Math.round(score), 10);
  }

  /**
   * Assess domain specificity (1-10)
   */
  private assessDomainSpecificity(query: string): number {
    const domains = this.detectDomains(query);
    const technicalTerms = this.extractTechnicalTerms(query);
    const domainOverlap = domains.length > 1 ? 2 : 0; // Penalty for multiple domains
    
    let score = 0;
    if (domains.length === 1) {
      score = 5 + Math.min(technicalTerms.length, 5); // Single domain bonus
    } else if (domains.length > 1) {
      score = 3 + Math.min(technicalTerms.length, 4) + domainOverlap;
    } else {
      score = 2; // No clear domain
    }
    
    return Math.min(score, 10);
  }

  /**
   * Calculate weighted complexity score
   */
  private calculateComplexityScore(factors: {
    length: number;
    technicalDepth: number;
    multiIntent: number;
    ambiguity: number;
    domainSpecificity: number;
  }): number {
    // Weighted average with emphasis on technical depth and multi-intent
    const weights = {
      length: 0.15,
      technicalDepth: 0.3,
      multiIntent: 0.25,
      ambiguity: 0.15,
      domainSpecificity: 0.15
    };

    const weightedSum = 
      factors.length * weights.length +
      factors.technicalDepth * weights.technicalDepth +
      factors.multiIntent * weights.multiIntent +
      factors.ambiguity * weights.ambiguity +
      factors.domainSpecificity * weights.domainSpecificity;

    return Math.round(Math.min(Math.max(weightedSum, 1), 10));
  }

  /**
   * Extract technical terms from query
   */
  private extractTechnicalTerms(query: string): string[] {
    const terms: Set<string> = new Set();
    
    // Check against technical patterns
    this.TECHNICAL_PATTERNS.forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) {
        matches.forEach(match => terms.add(match.toLowerCase()));
      }
    });

    // Add domain-specific technical terms
    const words = query.toLowerCase().split(/\s+/);
    const technicalWords = [
      'api', 'database', 'server', 'client', 'frontend', 'backend',
      'framework', 'library', 'function', 'method', 'class', 'object',
      'array', 'string', 'integer', 'boolean', 'null', 'undefined',
      'async', 'await', 'promise', 'callback', 'event', 'listener'
    ];

    words.forEach(word => {
      if (technicalWords.includes(word)) {
        terms.add(word);
      }
    });

    return Array.from(terms);
  }

  /**
   * Detect intents in the query
   */
  private detectIntents(query: string): string[] {
    const intents: string[] = [];
    const sentences = this.splitIntoSentences(query);

    sentences.forEach(sentence => {
      // Check for question patterns
      Object.entries(this.QUESTION_TYPES).forEach(([type, pattern]) => {
        if (pattern.test(sentence)) {
          intents.push(`question:${type}`);
        }
      });

      // Check for action verbs
      const actionVerbs = [
        'create', 'build', 'implement', 'design', 'develop',
        'analyze', 'evaluate', 'compare', 'explain', 'describe',
        'fix', 'debug', 'optimize', 'improve', 'refactor'
      ];

      actionVerbs.forEach(verb => {
        if (new RegExp(`\\b${verb}\\b`, 'i').test(sentence)) {
          intents.push(`action:${verb}`);
        }
      });
    });

    return [...new Set(intents)]; // Remove duplicates
  }

  /**
   * Detect domains in the query
   */
  private detectDomains(query: string): string[] {
    const detectedDomains: string[] = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(this.DOMAIN_KEYWORDS).forEach(([domain, keywords]) => {
      const matchCount = keywords.filter(keyword => 
        lowerQuery.includes(keyword)
      ).length;
      
      if (matchCount >= 2 || (matchCount === 1 && keywords.some(k => 
        new RegExp(`\\b${k}\\b`, 'i').test(query)
      ))) {
        detectedDomains.push(domain);
      }
    });

    return detectedDomains;
  }

  /**
   * Detect question type
   */
  private detectQuestionType(query: string): string | null {
    for (const [type, pattern] of Object.entries(this.QUESTION_TYPES)) {
      if (pattern.test(query)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Detect ambiguous terms
   */
  private detectAmbiguousTerms(query: string): string[] {
    const ambiguous: string[] = [];
    
    // Pronouns without clear antecedents
    const pronouns = ['it', 'this', 'that', 'these', 'those', 'they', 'them'];
    const words = query.split(/\s+/);
    
    words.forEach((word, index) => {
      if (pronouns.includes(word.toLowerCase())) {
        // Check if there's a clear noun before the pronoun
        const precedingWords = words.slice(Math.max(0, index - 5), index);
        const hasNoun = precedingWords.some(w => 
          w.length > 3 && !pronouns.includes(w.toLowerCase())
        );
        
        if (!hasNoun) {
          ambiguous.push(word);
        }
      }
    });

    // Vague quantifiers
    const vagueQuantifiers = query.match(/\b(some|many|few|several|various)\b/gi);
    if (vagueQuantifiers) {
      ambiguous.push(...vagueQuantifiers);
    }

    return [...new Set(ambiguous)];
  }

  /**
   * Detect missing context
   */
  private detectMissingContext(query: string): boolean {
    // Check for references to external context
    const contextualPhrases = [
      /\bthe (previous|last|above|below)\b/i,
      /\bas (mentioned|discussed|stated)\b/i,
      /\bthis (code|example|solution)\b/i,
      /\bmy (project|application|system)\b/i
    ];

    return contextualPhrases.some(pattern => pattern.test(query));
  }

  /**
   * Count words in the query
   */
  private countWords(query: string): number {
    return query.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Count sentences in the query
   */
  private countSentences(query: string): number {
    const sentences = this.splitIntoSentences(query);
    return sentences.length;
  }

  /**
   * Split query into sentences
   */
  private splitIntoSentences(query: string): string[] {
    // Simple sentence splitting - can be enhanced with NLP libraries
    return query
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Get expected domains based on query analysis
   */
  getExpectedDomains(query: string): string[] {
    const analysis = this.assessComplexity(query);
    return analysis.analysis.domains;
  }

  /**
   * Get query complexity category
   */
  getComplexityCategory(score: number): 'simple' | 'moderate' | 'complex' | 'very_complex' {
    if (score <= 2) return 'simple';
    if (score <= 5) return 'moderate';
    if (score <= 8) return 'complex';
    return 'very_complex';
  }
}