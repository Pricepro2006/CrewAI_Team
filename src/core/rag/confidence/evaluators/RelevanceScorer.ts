/**
 * RelevanceScorer - Evaluates response relevance to the query
 * Measures semantic similarity and intent fulfillment
 */

import type { ScoredDocument } from "../types.js";

export interface RelevanceResult {
  score: number;
  semanticSimilarity: number;
  termCoverage: number;
  intentFulfillment: number;
  keyTermsMatched: string[];
  missingKeyTerms: string[];
}

export class RelevanceScorer {
  /**
   * Calculate overall relevance score
   * @param query Original user query
   * @param response Generated response
   * @param sources Source documents used
   * @returns Relevance result with detailed metrics
   */
  calculateRelevance(
    query: string,
    response: string,
    _sources: ScoredDocument[],
  ): RelevanceResult {
    // Extract key components
    const queryTerms = this.extractQueryTerms(query);
    const queryIntent = this.identifyQueryIntent(query);
    const responseTerms = this.extractResponseTerms(response);

    // Calculate individual metrics
    const semanticSimilarity = this.calculateSemanticSimilarity(
      query,
      response,
    );
    const termCoverage = this.calculateTermCoverage(queryTerms, responseTerms);
    const intentFulfillment = this.assessIntentFulfillment(
      queryIntent,
      response,
    );

    // Identify matched and missing terms
    const keyTermsMatched = queryTerms.filter((term) =>
      responseTerms.some((rTerm) => this.termsMatch(term, rTerm)),
    );
    const missingKeyTerms = queryTerms.filter(
      (term) => !keyTermsMatched.includes(term),
    );

    // Calculate overall score (weighted average)
    const score =
      semanticSimilarity * 0.4 + termCoverage * 0.3 + intentFulfillment * 0.3;

    return {
      score,
      semanticSimilarity,
      termCoverage,
      intentFulfillment,
      keyTermsMatched,
      missingKeyTerms,
    };
  }

  /**
   * Extract meaningful terms from query
   */
  private extractQueryTerms(query: string): string[] {
    // Remove question words and extract key terms
    const questionWords = [
      "what",
      "how",
      "why",
      "when",
      "where",
      "which",
      "who",
    ];
    const stopWords = new Set([
      ...questionWords,
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
    ]);

    const terms = query
      .toLowerCase()
      .replace(/[?.,!]/g, "")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));

    // Also extract important phrases
    const phrases = this.extractPhrases(query);

    return [...new Set([...terms, ...phrases])];
  }

  /**
   * Extract terms from response
   */
  private extractResponseTerms(response: string): string[] {
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "as",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
    ]);

    return response
      .toLowerCase()
      .replace(/[.,!]/g, "")
      .split(/\s+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));
  }

  /**
   * Extract meaningful phrases (e.g., "machine learning", "artificial intelligence")
   */
  private extractPhrases(text: string): string[] {
    const phrases: string[] = [];

    // Common technical phrases
    const phrasePatterns = [
      /machine learning/gi,
      /artificial intelligence/gi,
      /deep learning/gi,
      /neural network/gi,
      /natural language/gi,
      /software engineering/gi,
      /web development/gi,
      /data structure/gi,
      /design pattern/gi,
      /best practice/gi,
    ];

    phrasePatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches.map((m) => m.toLowerCase()));
      }
    });

    return phrases;
  }

  /**
   * Identify the intent of the query
   */
  private identifyQueryIntent(query: string): {
    type: string;
    expectedElements: string[];
  } {
    const _lowerQuery = query.toLowerCase();

    // Definition/Explanation queries
    if (/^(what|explain|describe|define)\s/i.test(query)) {
      return {
        type: "definition",
        expectedElements: ["is", "means", "refers to", "defined as"],
      };
    }

    // How-to queries
    if (/^(how|how to|how do)\s/i.test(query)) {
      return {
        type: "procedural",
        expectedElements: ["steps", "first", "then", "finally", "process"],
      };
    }

    // Comparison queries
    if (/\b(compare|versus|vs|difference|between)\b/i.test(query)) {
      return {
        type: "comparison",
        expectedElements: [
          "while",
          "whereas",
          "however",
          "on the other hand",
          "unlike",
        ],
      };
    }

    // Why queries
    if (/^why\s/i.test(query)) {
      return {
        type: "reasoning",
        expectedElements: ["because", "due to", "reason", "since", "therefore"],
      };
    }

    // List queries
    if (/\b(list|enumerate|examples?|types?)\b/i.test(query)) {
      return {
        type: "enumeration",
        expectedElements: [
          "first",
          "second",
          "includes",
          "such as",
          "for example",
        ],
      };
    }

    // Default
    return {
      type: "general",
      expectedElements: [],
    };
  }

  /**
   * Calculate semantic similarity between query and response
   * Simplified version - in production, use embeddings
   */
  private calculateSemanticSimilarity(query: string, response: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const responseWords = new Set(response.toLowerCase().split(/\s+/));

    // Calculate Jaccard similarity
    const intersection = new Set(
      [...queryWords].filter((x) => responseWords.has(x)),
    );
    const union = new Set([...queryWords, ...responseWords]);

    const jaccardSimilarity = intersection.size / union.size;

    // Boost score if response is substantially longer (more detailed)
    const lengthBonus = Math.min(0.2, (response.length / query.length) * 0.02);

    return Math.min(1, jaccardSimilarity + lengthBonus);
  }

  /**
   * Calculate term coverage
   */
  private calculateTermCoverage(
    queryTerms: string[],
    responseTerms: string[],
  ): number {
    if (queryTerms.length === 0) return 1;

    const coveredTerms = queryTerms.filter((term) =>
      responseTerms.some((rTerm) => this.termsMatch(term, rTerm)),
    );

    return coveredTerms.length / queryTerms.length;
  }

  /**
   * Check if terms match (including variations)
   */
  private termsMatch(term1: string, term2: string): boolean {
    // Exact match
    if (term1 === term2) return true;

    // Stem matching (simple version)
    if (this.simpleStem(term1) === this.simpleStem(term2)) return true;

    // Substring matching for longer terms
    if (term1.length > 5 && term2.length > 5) {
      return term1.includes(term2) || term2.includes(term1);
    }

    return false;
  }

  /**
   * Simple stemming function
   */
  private simpleStem(word: string): string {
    // Remove common suffixes
    return word
      .replace(/ing$/, "")
      .replace(/ed$/, "")
      .replace(/s$/, "")
      .replace(/ly$/, "")
      .replace(/tion$/, "t")
      .replace(/ment$/, "");
  }

  /**
   * Assess intent fulfillment
   */
  private assessIntentFulfillment(
    intent: { type: string; expectedElements: string[] },
    response: string,
  ): number {
    const responseLower = response.toLowerCase();

    // Check for expected elements based on intent type
    if (intent.expectedElements.length === 0) {
      return 0.7; // Default score for general queries
    }

    const foundElements = intent.expectedElements.filter((element) =>
      responseLower.includes(element),
    );

    const fulfillmentRatio =
      foundElements.length / intent.expectedElements.length;

    // Additional checks based on intent type
    switch (intent.type) {
      case "definition":
        // Check if response provides a clear definition
        if (/\b(is|means|refers to|defined as)\b/.test(responseLower)) {
          return Math.max(0.8, fulfillmentRatio);
        }
        break;

      case "procedural":
        // Check for step-by-step structure
        if (/\b(step|first|then|next|finally)\b/.test(responseLower)) {
          return Math.max(0.8, fulfillmentRatio);
        }
        break;

      case "comparison":
        // Check for comparative language
        if (
          /\b(while|whereas|unlike|similar|different)\b/.test(responseLower)
        ) {
          return Math.max(0.8, fulfillmentRatio);
        }
        break;

      case "reasoning":
        // Check for causal language
        if (/\b(because|due to|reason|therefore|thus)\b/.test(responseLower)) {
          return Math.max(0.8, fulfillmentRatio);
        }
        break;

      case "enumeration": {
        // Check for list markers
        const listMarkers = response.match(
          /(\d+[.)]\s|[-*]\s|\b(first|second|third)\b)/gi,
        );
        if (listMarkers && listMarkers.length > 1) {
          return Math.max(0.8, fulfillmentRatio);
        }
        break;
      }
    }

    return fulfillmentRatio;
  }

  /**
   * Check if response directly addresses the query
   */
  isDirectlyRelevant(relevanceResult: RelevanceResult): boolean {
    return (
      relevanceResult.score >= 0.7 &&
      relevanceResult.intentFulfillment >= 0.7 &&
      relevanceResult.missingKeyTerms.length <= 1
    );
  }

  /**
   * Get relevance category
   */
  getRelevanceCategory(score: number): "high" | "medium" | "low" | "off-topic" {
    if (score >= 0.8) return "high";
    if (score >= 0.6) return "medium";
    if (score >= 0.4) return "low";
    return "off-topic";
  }
}
