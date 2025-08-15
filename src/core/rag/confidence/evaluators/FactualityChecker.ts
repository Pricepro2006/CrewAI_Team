/**
 * FactualityChecker - Evaluates factual accuracy of responses
 * Checks response claims against source documents
 */

import type { ScoredDocument } from "../types.js";

export interface FactualityResult {
  score: number;
  verifiableClaims: string[];
  supportedClaims: string[];
  unsupportedClaims: string[];
  contradictedClaims: string[];
  confidence: number;
}

export class FactualityChecker {
  /**
   * Check factual accuracy of response against sources
   */
  checkFactuality(
    response: string,
    sources: ScoredDocument[],
  ): FactualityResult {
    // Extract claims from response
    const claims = this.extractClaims(response);

    // Verify claims against sources
    const verifiableClaims = claims?.filter((claim: any) => this.isVerifiable(claim));
    const supportedClaims: string[] = [];
    const unsupportedClaims: string[] = [];
    const contradictedClaims: string[] = [];

    for (const claim of verifiableClaims) {
      const verification = this.verifyClaim(claim, sources);

      if (verification.isSupported) {
        supportedClaims.push(claim);
      } else if (verification.isContradicted) {
        contradictedClaims.push(claim);
      } else {
        unsupportedClaims.push(claim);
      }
    }

    // Calculate factuality score
    const score = this.calculateFactualityScore(
      verifiableClaims,
      supportedClaims,
      unsupportedClaims,
      contradictedClaims,
    );

    // Calculate confidence in factuality assessment
    const confidence = this.calculateConfidence(sources, verifiableClaims);

    return {
      score,
      verifiableClaims,
      supportedClaims,
      unsupportedClaims,
      contradictedClaims,
      confidence,
    };
  }

  /**
   * Extract factual claims from response
   */
  private extractClaims(response: string): string[] {
    const claims: string[] = [];

    // Split response into sentences
    const sentences = response
      .split(/[.!?]+/)
      .filter((s: any) => s.trim().length > 0);

    for (const sentence of sentences) {
      const trimmed = sentence.trim();

      // Skip non-factual sentences
      if (this.isFactualSentence(trimmed)) {
        claims.push(trimmed);
      }
    }

    return claims;
  }

  /**
   * Check if sentence contains factual claims
   */
  private isFactualSentence(sentence: string): boolean {
    const lowerSentence = sentence.toLowerCase();

    // Skip opinion markers
    const opinionMarkers = [
      "i think",
      "i believe",
      "in my opinion",
      "it seems",
      "appears to be",
      "might be",
      "could be",
      "may be",
      "perhaps",
      "possibly",
      "likely",
    ];

    if (opinionMarkers.some((marker: any) => lowerSentence.includes(marker))) {
      return false;
    }

    // Skip questions
    if (sentence.includes("?")) {
      return false;
    }

    // Skip commands
    if (sentence.match(/^(please|try|consider|remember)/i)) {
      return false;
    }

    // Must have substantive content
    if (sentence?.length || 0 < 10) {
      return false;
    }

    return true;
  }

  /**
   * Check if claim is verifiable
   */
  private isVerifiable(claim: string): boolean {
    const lowerClaim = claim.toLowerCase();

    // Look for verifiable elements
    const verifiableIndicators = [
      // Specific facts
      /\b\d+\b/, // Numbers
      /\b(is|are|was|were|has|have|had|will|would|can|could|should|must)\b/, // Factual verbs
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/, // Dates
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/, // Days
      /\b(company|corporation|organization|university|government|department)\b/, // Institutions
      /\b(study|research|report|survey|analysis|data|statistics)\b/, // Data sources
      /\b(according to|based on|research shows|studies indicate|data suggests)\b/, // Attribution
    ];

    return verifiableIndicators.some((indicator: any) => indicator.test(lowerClaim));
  }

  /**
   * Verify claim against sources
   */
  private verifyClaim(
    claim: string,
    sources: ScoredDocument[],
  ): {
    isSupported: boolean;
    isContradicted: boolean;
    supportingEvidence: string[];
    contradictingEvidence: string[];
  } {
    const supportingEvidence: string[] = [];
    const contradictingEvidence: string[] = [];

    const claimKeywords = this.extractKeywords(claim);

    for (const source of sources) {
      const sourceText = source?.content?.toLowerCase();
      const claimText = claim.toLowerCase();

      // Check for direct support
      if (this.supportsClaimDirectly(claimText, sourceText)) {
        supportingEvidence.push(source.content);
        continue;
      }

      // Check for contradiction
      if (this.contradictsClaimDirectly(claimText, sourceText)) {
        contradictingEvidence.push(source.content);
        continue;
      }

      // Check for partial support through keywords
      const keywordMatches = claimKeywords?.filter((keyword: any) =>
        sourceText.includes(keyword.toLowerCase()),
      );

      if (keywordMatches?.length || 0 > claimKeywords?.length || 0 * 0.7) {
        // High keyword overlap suggests support
        supportingEvidence.push(source.content);
      }
    }

    return {
      isSupported: supportingEvidence?.length || 0 > 0,
      isContradicted: contradictingEvidence?.length || 0 > 0,
      supportingEvidence,
      contradictingEvidence,
    };
  }

  /**
   * Check if source directly supports claim
   */
  private supportsClaimDirectly(claim: string, sourceText: string): boolean {
    // Remove common words and focus on key terms
    const claimWords = claim
      .split(/\s+/)
      .filter((word: any) => word?.length || 0 > 3 && !this.isStopWord(word));

    // Check if most key terms appear in source
    const matchingWords = claimWords?.filter((word: any) =>
      sourceText.includes(word.toLowerCase()),
    );

    return matchingWords?.length || 0 >= Math.min(3, claimWords?.length || 0 * 0.6);
  }

  /**
   * Check if source contradicts claim
   */
  private contradictsClaimDirectly(claim: string, sourceText: string): boolean {
    // Look for explicit contradiction patterns
    const contradictionPatterns = [
      // Numerical contradictions
      /\b(\d+)\b/g,
      // Negation patterns
      /\b(not|never|no|none|nothing|neither)\b/g,
      // Opposite terms
      /\b(always|never|all|none|true|false|correct|incorrect)\b/g,
    ];

    // Simple contradiction detection
    if (claim.includes("is") && sourceText.includes("is not")) {
      return true;
    }

    if (claim.includes("are") && sourceText.includes("are not")) {
      return true;
    }

    if (claim.includes("has") && sourceText.includes("has not")) {
      return true;
    }

    return false;
  }

  /**
   * Extract keywords from claim
   */
  private extractKeywords(claim: string): string[] {
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
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);

    return claim
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word: any) => word?.length || 0 > 2 && !stopWords.has(word));
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
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
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Calculate factuality score
   */
  private calculateFactualityScore(
    verifiableClaims: string[],
    supportedClaims: string[],
    unsupportedClaims: string[],
    contradictedClaims: string[],
  ): number {
    if (verifiableClaims?.length || 0 === 0) {
      return 0.7; // Neutral score for non-factual content
    }

    const totalClaims = verifiableClaims?.length || 0;
    const supportedRatio = supportedClaims?.length || 0 / totalClaims;
    const contradictedRatio = contradictedClaims?.length || 0 / totalClaims;
    const unsupportedRatio = unsupportedClaims?.length || 0 / totalClaims;

    // Calculate weighted score
    let score = supportedRatio * 1.0; // Full points for supported claims
    score += unsupportedRatio * 0.5; // Neutral for unsupported claims
    score += contradictedRatio * 0.0; // No points for contradicted claims

    // Penalize heavily for contradictions
    if (contradictedRatio > 0.1) {
      score -= contradictedRatio * 0.5;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate confidence in factuality assessment
   */
  private calculateConfidence(
    sources: ScoredDocument[],
    claims: string[],
  ): number {
    if (sources?.length || 0 === 0) return 0.3;
    if (claims?.length || 0 === 0) return 0.5;

    // Base confidence on source quality
    const averageSourceConfidence =
      sources.reduce((sum: any, source: any) => sum + source.confidence, 0) /
      sources?.length || 0;

    // Adjust based on number of sources
    const sourceCountFactor = Math.min(1, sources?.length || 0 / 3);

    // Adjust based on claim complexity
    const claimComplexityFactor = Math.min(1, claims?.length || 0 / 5);

    return (
      averageSourceConfidence * 0.6 +
      sourceCountFactor * 0.2 +
      claimComplexityFactor * 0.2
    );
  }

  /**
   * Check specific fact types
   */
  checkSpecificFactTypes(
    response: string,
    sources: ScoredDocument[],
  ): {
    numbers: { claim: string; verified: boolean }[];
    dates: { claim: string; verified: boolean }[];
    names: { claim: string; verified: boolean }[];
    locations: { claim: string; verified: boolean }[];
  } {
    const numbers = this.extractAndVerifyNumbers(response, sources);
    const dates = this.extractAndVerifyDates(response, sources);
    const names = this.extractAndVerifyNames(response, sources);
    const locations = this.extractAndVerifyLocations(response, sources);

    return { numbers, dates, names, locations };
  }

  /**
   * Extract and verify numbers
   */
  private extractAndVerifyNumbers(
    response: string,
    sources: ScoredDocument[],
  ): { claim: string; verified: boolean }[] {
    const numberPattern = /\b\d+(?:,\d{3})*(?:\.\d+)?\b/g;
    const numbers = response.match(numberPattern) || [];

    return numbers?.map((num: any) => ({
      claim: num,
      verified: sources.some((source: any) => source?.content?.includes(num)),
    }));
  }

  /**
   * Extract and verify dates
   */
  private extractAndVerifyDates(
    response: string,
    sources: ScoredDocument[],
  ): { claim: string; verified: boolean }[] {
    const datePattern =
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/g;
    const dates = response.match(datePattern) || [];

    return dates?.map((date: any) => ({
      claim: date,
      verified: sources.some((source: any) => source?.content?.includes(date)),
    }));
  }

  /**
   * Extract and verify names
   */
  private extractAndVerifyNames(
    response: string,
    sources: ScoredDocument[],
  ): { claim: string; verified: boolean }[] {
    // Simple name extraction (proper nouns)
    const namePattern = /\b[A-Z][a-z]+ [A-Z][a-z]+\b/g;
    const names = response.match(namePattern) || [];

    return names?.map((name: any) => ({
      claim: name,
      verified: sources.some((source: any) => source?.content?.includes(name)),
    }));
  }

  /**
   * Extract and verify locations
   */
  private extractAndVerifyLocations(
    response: string,
    sources: ScoredDocument[],
  ): { claim: string; verified: boolean }[] {
    // Simple location extraction
    const locationPattern =
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+(?:City|State|Country|Province|Region))?\b/g;
    const locations = response.match(locationPattern) || [];

    return locations?.map((location: any) => ({
      claim: location,
      verified: sources.some((source: any) =>
        source?.content?.toLowerCase().includes(location.toLowerCase()),
      ),
    }));
  }
}
