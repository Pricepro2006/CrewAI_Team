/**
 * FactualityChecker - Evaluates factual accuracy of generated responses
 * Checks claims against source documents
 */

import type { ScoredDocument } from "../types";

export interface Claim {
  text: string;
  confidence: number;
  supportingEvidence?: string[];
  contradictingEvidence?: string[];
}

export interface FactualityResult {
  score: number;
  claims: Claim[];
  supportedClaims: number;
  unsupportedClaims: number;
  contradictedClaims: number;
  unverifiableClaims: number;
}

export class FactualityChecker {
  /**
   * Extract claims from response text
   * @param response Generated response
   * @returns Array of extracted claims
   */
  extractClaims(response: string): Claim[] {
    const claims: Claim[] = [];

    // Split into sentences
    const sentences = this.splitIntoSentences(response);

    for (const sentence of sentences) {
      // Skip questions and meta-statements
      if (this.isQuestion(sentence) || this.isMetaStatement(sentence)) {
        continue;
      }

      // Extract factual claims
      if (this.containsFactualClaim(sentence)) {
        claims.push({
          text: sentence.trim(),
          confidence: this.assessClaimConfidence(sentence),
        });
      }
    }

    return claims;
  }

  /**
   * Verify claims against source documents
   * @param claims Extracted claims
   * @param sources Source documents
   * @returns Factuality result
   */
  verifyClaims(claims: Claim[], sources: ScoredDocument[]): FactualityResult {
    let supportedClaims = 0;
    let unsupportedClaims = 0;
    let contradictedClaims = 0;
    let unverifiableClaims = 0;

    // Build searchable content from sources
    const sourceContent = this.buildSourceContent(sources);

    // Verify each claim
    for (const claim of claims) {
      const verification = this.verifyClaimAgainstSources(
        claim,
        sourceContent,
        sources,
      );

      claim.supportingEvidence = verification.supporting;
      claim.contradictingEvidence = verification.contradicting;

      if (verification.contradicting.length > 0) {
        contradictedClaims++;
      } else if (verification.supporting.length > 0) {
        supportedClaims++;
      } else if (verification.isVerifiable) {
        unsupportedClaims++;
      } else {
        unverifiableClaims++;
      }
    }

    // Calculate factuality score
    const totalVerifiableClaims =
      supportedClaims + unsupportedClaims + contradictedClaims;
    let score = 0;

    if (totalVerifiableClaims > 0) {
      // Supported claims get full credit
      // Unsupported get partial credit (they're not contradicted)
      // Contradicted claims reduce score
      score =
        (supportedClaims + unsupportedClaims * 0.5 - contradictedClaims) /
        totalVerifiableClaims;
      score = Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
    } else if (unverifiableClaims > 0) {
      // If all claims are unverifiable, give neutral score
      score = 0.5;
    }

    return {
      score,
      claims,
      supportedClaims,
      unsupportedClaims,
      contradictedClaims,
      unverifiableClaims,
    };
  }

  /**
   * Calculate overall factuality score
   * @param result Factuality check result
   * @returns Score between 0 and 1
   */
  calculateFactualityScore(result: FactualityResult): number {
    return result.score;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - can be enhanced with NLP
    return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  }

  /**
   * Check if sentence is a question
   */
  private isQuestion(sentence: string): boolean {
    return sentence.trim().endsWith("?");
  }

  /**
   * Check if sentence is a meta-statement (about the response itself)
   */
  private isMetaStatement(sentence: string): boolean {
    const metaPatterns = [
      /^(Based on|According to|From) (the|these) (sources?|documents?|information)/i,
      /^I (found|can see|notice|observe)/i,
      /^The (sources?|documents?|information) (shows?|indicates?|suggests?)/i,
      /^(Please note|Note that|Keep in mind)/i,
    ];

    return metaPatterns.some((pattern) => pattern.test(sentence));
  }

  /**
   * Check if sentence contains a factual claim
   */
  private containsFactualClaim(sentence: string): boolean {
    // Look for statements with factual content
    const factualPatterns = [
      /\b(is|are|was|were|has|have|had)\b/i,
      /\b(contains?|includes?|consists?|comprises?)\b/i,
      /\b(means?|refers? to|defines?|describes?)\b/i,
      /\b\d+\b/, // Numbers often indicate facts
      /\b(always|never|all|none|every)\b/i, // Absolute statements
    ];

    return factualPatterns.some((pattern) => pattern.test(sentence));
  }

  /**
   * Assess confidence in a claim based on language
   */
  private assessClaimConfidence(sentence: string): number {
    let confidence = 0.8; // Base confidence

    // High confidence indicators
    if (
      /\b(definitely|certainly|clearly|obviously|undoubtedly)\b/i.test(sentence)
    ) {
      confidence += 0.1;
    }

    // Low confidence indicators
    if (
      /\b(maybe|perhaps|possibly|might|could|seems?|appears?)\b/i.test(sentence)
    ) {
      confidence -= 0.3;
    }

    // Hedging language
    if (/\b(generally|typically|usually|often|sometimes)\b/i.test(sentence)) {
      confidence -= 0.1;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  /**
   * Build searchable content from sources
   */
  private buildSourceContent(sources: ScoredDocument[]): Map<string, string[]> {
    const content = new Map<string, string[]>();

    for (const source of sources) {
      if (!source.content || source.content.trim().length === 0) continue;

      // Split source content into searchable chunks
      const sentences = this.splitIntoSentences(source.content);
      if (sentences.length > 0) {
        content.set(source.id, sentences);
      }
    }

    return content;
  }

  /**
   * Verify a claim against source content
   */
  private verifyClaimAgainstSources(
    claim: Claim,
    sourceContent: Map<string, string[]>,
    sources: ScoredDocument[],
  ): {
    supporting: string[];
    contradicting: string[];
    isVerifiable: boolean;
  } {
    const supporting: string[] = [];
    const contradicting: string[] = [];
    let isVerifiable = false;

    // Extract key terms from claim
    const claimTerms = this.extractKeyTerms(claim.text);

    if (
      claimTerms.length === 0 ||
      !claim.text ||
      claim.text.trim().length === 0
    ) {
      return { supporting, contradicting, isVerifiable: false };
    }

    // Search each source
    for (const [sourceId, sentences] of sourceContent.entries()) {
      if (!sentences || sentences.length === 0) continue;

      for (const sentence of sentences) {
        if (!sentence || sentence.trim().length === 0) continue;

        const relevance = this.calculateRelevance(claimTerms, sentence);

        if (relevance > 0.3) {
          // Relevant to claim
          isVerifiable = true;

          if (this.supportsClaimBool(claim.text, sentence)) {
            supporting.push(`[Source ${sourceId}]: ${sentence}`);
          } else if (this.contradictsClaimBool(claim.text, sentence)) {
            contradicting.push(`[Source ${sourceId}]: ${sentence}`);
          }
        }
      }
    }

    return { supporting, contradicting, isVerifiable };
  }

  /**
   * Extract key terms from text
   */
  private extractKeyTerms(text: string): string[] {
    // Remove common words and extract meaningful terms
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
      "was",
      "are",
      "were",
      "been",
      "be",
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
      "must",
      "shall",
      "can",
      "cannot",
    ]);

    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((term) => term.length > 2 && !stopWords.has(term));
  }

  /**
   * Calculate relevance between claim terms and sentence
   */
  private calculateRelevance(claimTerms: string[], sentence: string): number {
    if (claimTerms.length === 0 || !sentence || sentence.trim().length === 0) {
      return 0;
    }

    const sentenceLower = sentence.toLowerCase();
    let matches = 0;

    for (const term of claimTerms) {
      if (term && sentenceLower.includes(term)) {
        matches++;
      }
    }

    return matches / claimTerms.length;
  }

  /**
   * Check if source sentence supports the claim
   */
  private supportsClaimBool(claim: string, sourceSentence: string): boolean {
    if (
      !claim ||
      !sourceSentence ||
      claim.trim().length === 0 ||
      sourceSentence.trim().length === 0
    ) {
      return false;
    }

    // This is a simplified check - in production, use NLP similarity
    const claimLower = claim.toLowerCase();
    const sourceLower = sourceSentence.toLowerCase();

    // Check for semantic agreement
    const agreementPatterns = [
      { claim: /is|are/, source: /is|are/ },
      { claim: /was|were/, source: /was|were/ },
    ];

    // Check key term overlap
    const claimTerms = this.extractKeyTerms(claim);
    const sourceTerms = this.extractKeyTerms(sourceSentence);

    if (claimTerms.length === 0 || sourceTerms.length === 0) {
      return false;
    }

    const overlap = claimTerms.filter((term) =>
      sourceTerms.includes(term),
    ).length;

    return overlap >= Math.min(3, claimTerms.length * 0.5);
  }

  /**
   * Check if source sentence contradicts the claim
   */
  private contradictsClaimBool(claim: string, sourceSentence: string): boolean {
    if (
      !claim ||
      !sourceSentence ||
      claim.trim().length === 0 ||
      sourceSentence.trim().length === 0
    ) {
      return false;
    }

    // Look for contradictory patterns
    const contradictionIndicators = [
      /\bnot\b/i,
      /\bno\b/i,
      /\bnever\b/i,
      /\bincorrect\b/i,
      /\bfalse\b/i,
      /\binstead\b/i,
      /\bhowever\b/i,
      /\bcontrary\b/i,
    ];

    // Check if source contains contradiction indicators
    const hasContradiction = contradictionIndicators.some((pattern) =>
      pattern.test(sourceSentence),
    );

    if (!hasContradiction) {
      return false;
    }

    // Verify it's about the same topic
    const claimTerms = this.extractKeyTerms(claim);
    const sourceTerms = this.extractKeyTerms(sourceSentence);

    if (claimTerms.length === 0 || sourceTerms.length === 0) {
      return false;
    }

    const overlap = claimTerms.filter((term) =>
      sourceTerms.includes(term),
    ).length;

    return overlap >= 2; // At least 2 common terms for contradiction
  }
}
