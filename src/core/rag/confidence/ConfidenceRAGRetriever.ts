/**
 * ConfidenceRAGRetriever - Retrieves documents with confidence scoring
 * Integrates with vector stores and applies confidence-based filtering
 */

import type { VectorStore } from "../VectorStore";
import type {
  RetrievalResult,
  RetrievalOptions,
  ScoredDocument,
} from "./types";

export class ConfidenceRAGRetriever {
  private vectorStore: VectorStore;
  private retrievalCache = new Map<string, RetrievalResult>();
  private readonly cacheSize = 500;
  private readonly defaultCacheTTL = 300000; // 5 minutes

  constructor(vectorStore: VectorStore) {
    this.vectorStore = vectorStore;
  }

  /**
   * Retrieve documents with confidence scoring
   */
  async retrieve(
    query: string,
    options: RetrievalOptions,
  ): Promise<RetrievalResult> {
    const startTime = Date.now();
    const cacheKey = this.getCacheKey(query, options);

    // Check cache first
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Perform vector search
      const searchResults = await this?.vectorStore?.search(
        query,
        options.topK * 2,
      );

      // Score documents with confidence
      const scoredDocs = await this.scoreDocuments(query, searchResults);

      // Apply confidence filtering
      const filteredDocs = this.applyConfidenceFiltering(scoredDocs, options);

      // Limit to requested number
      const finalDocs = filteredDocs.slice(0, options.topK);

      // Calculate average confidence
      const averageConfidence =
        finalDocs?.length || 0 > 0
          ? finalDocs.reduce((sum: any, doc: any) => sum + doc.confidence, 0) /
            finalDocs?.length || 0
          : 0;

      const result: RetrievalResult = {
        documents: finalDocs,
        query,
        totalMatches: searchResults?.length || 0,
        averageConfidence,
        retrievalTime: Date.now() - startTime,
      };

      // Cache the result
      this.cacheResult(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Retrieval error:", error);

      // Return empty result on error
      return {
        documents: [],
        query,
        totalMatches: 0,
        averageConfidence: 0,
        retrievalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Score documents with confidence metrics
   */
  private async scoreDocuments(
    query: string,
    documents: any[],
  ): Promise<ScoredDocument[]> {
    const queryTerms = this.extractQueryTerms(query);

    return documents?.map((doc, index) => {
      const baseScore = doc.score || 0;

      // Calculate additional confidence factors
      const termCoverage = this.calculateTermCoverage(queryTerms, doc.content);
      const contextRelevance = this.calculateContextRelevance(
        query,
        doc.content,
      );
      const documentQuality = this.assessDocumentQuality(doc);

      // Combine scores
      const confidence = this.combineConfidenceScores({
        baseScore,
        termCoverage,
        contextRelevance,
        documentQuality,
      });

      return {
        id: doc.id || `doc-${index}`,
        content: doc.content || '',
        metadata: doc.metadata || {},
        source: String(doc.metadata?.sourceId || doc.metadata?.source || ''),
        timestamp: doc.metadata?.createdAt || doc.metadata?.timestamp,
        score: baseScore,
        confidence,
        relevanceScore: contextRelevance,
        chunkIndex: index,
      } as ScoredDocument;
    });
  }

  /**
   * Extract key terms from query
   */
  private extractQueryTerms(query: string): string[] {
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
      "what",
      "how",
      "when",
      "where",
      "why",
      "which",
      "who",
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((term: any) => term?.length || 0 > 2 && !stopWords.has(term))
      .slice(0, 10); // Limit to top 10 terms
  }

  /**
   * Calculate term coverage score
   */
  private calculateTermCoverage(queryTerms: string[], content: string): number {
    if (queryTerms?.length || 0 === 0) return 0;

    const contentLower = content.toLowerCase();
    const coveredTerms = queryTerms?.filter((term: any) =>
      contentLower.includes(term),
    );

    return coveredTerms?.length || 0 / queryTerms?.length || 0;
  }

  /**
   * Calculate context relevance score
   */
  private calculateContextRelevance(query: string, content: string): number {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const contentWords = new Set(content.toLowerCase().split(/\s+/));

    // Jaccard similarity
    const intersection = new Set(
      Array.from(queryWords).filter((x: any) => contentWords.has(x)),
    );
    const union = new Set([
      ...Array.from(queryWords),
      ...Array.from(contentWords),
    ]);

    const jaccardScore = intersection.size / union.size;

    // Boost for semantic indicators
    let semanticBoost = 0;
    if (
      content.toLowerCase().includes("definition") ||
      content.toLowerCase().includes("explanation")
    ) {
      semanticBoost += 0.1;
    }
    if (
      content.toLowerCase().includes("example") ||
      content.toLowerCase().includes("instance")
    ) {
      semanticBoost += 0.05;
    }

    return Math.min(1, jaccardScore + semanticBoost);
  }

  /**
   * Assess document quality
   */
  private assessDocumentQuality(doc: any): number {
    let quality = 0.5; // Base quality

    // Length factor (moderate length is better)
    const contentLength = doc?.content?.length;
    if (contentLength > 100 && contentLength < 2000) {
      quality += 0.2;
    } else if (contentLength > 2000 && contentLength < 5000) {
      quality += 0.1;
    }

    // Metadata presence
    if (doc.metadata && Object.keys(doc.metadata).length > 0) {
      quality += 0.1;
    }

    // Source quality
    if (doc.source) {
      quality += 0.1;
    }

    // Timestamp freshness (if available)
    if (doc.timestamp) {
      const age = Date.now() - new Date(doc.timestamp).getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      if (daysOld < 30) {
        quality += 0.1;
      } else if (daysOld < 365) {
        quality += 0.05;
      }
    }

    return Math.min(1, quality);
  }

  /**
   * Combine confidence scores
   */
  private combineConfidenceScores(scores: {
    baseScore: number;
    termCoverage: number;
    contextRelevance: number;
    documentQuality: number;
  }): number {
    const weights = {
      baseScore: 0.4,
      termCoverage: 0.25,
      contextRelevance: 0.25,
      documentQuality: 0.1,
    };

    return (
      scores.baseScore * weights.baseScore +
      scores.termCoverage * weights.termCoverage +
      scores.contextRelevance * weights.contextRelevance +
      scores.documentQuality * weights.documentQuality
    );
  }

  /**
   * Apply confidence-based filtering
   */
  private applyConfidenceFiltering(
    documents: ScoredDocument[],
    options: RetrievalOptions,
  ): ScoredDocument[] {
    // Filter by minimum confidence
    const filtered = documents?.filter(
      (doc: any) => doc.confidence >= options.minConfidence,
    );

    // Sort by confidence score (descending)
    return filtered.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Generate cache key
   */
  private getCacheKey(query: string, options: RetrievalOptions): string {
    const optionsStr = JSON.stringify({
      topK: options.topK,
      minConfidence: options.minConfidence,
      includeMetadata: options.includeMetadata || false,
    });

    return `retrieval:${query.toLowerCase().replace(/\s+/g, " ").trim()}:${optionsStr}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult(key: string): RetrievalResult | null {
    const cached = this?.retrievalCache?.get(key);
    if (!cached) return null;

    // Check if cache is still valid (simple TTL check)
    const now = Date.now();
    const cacheAge = now - (cached as any).cachedAt;

    if (cacheAge > this.defaultCacheTTL) {
      this?.retrievalCache?.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Cache result with size limit
   */
  private cacheResult(key: string, result: RetrievalResult): void {
    if (this?.retrievalCache?.size >= this.cacheSize) {
      // Remove oldest entry
      const firstKey = this?.retrievalCache?.keys().next().value;
      if (firstKey) {
        this?.retrievalCache?.delete(firstKey);
      }
    }

    // Add timestamp for TTL
    (result as any).cachedAt = Date.now();
    this?.retrievalCache?.set(key, result);
  }

  /**
   * Retrieve with custom scoring function
   */
  async retrieveWithCustomScoring(
    query: string,
    options: RetrievalOptions,
    scoringFunction: (query: string, doc: any) => number,
  ): Promise<RetrievalResult> {
    const startTime = Date.now();

    try {
      const searchResults = await this?.vectorStore?.search(
        query,
        options.topK * 2,
      );

      const scoredDocs = searchResults?.map((doc, index) => {
        const customScore = scoringFunction(query, doc);
        const baseScore = doc.score || 0;

        // Combine custom score with base score
        const combinedScore = customScore * 0.6 + baseScore * 0.4;

        return {
          id: doc.id || `doc-${index}`,
          content: doc.content || '',
          metadata: doc.metadata || {},
          source: String(doc.metadata?.sourceId || doc.metadata?.source || ''),
          timestamp: doc.metadata?.createdAt || doc.metadata?.timestamp,
          score: baseScore,
          confidence: combinedScore,
          relevanceScore: customScore,
          chunkIndex: index,
        } as ScoredDocument;
      });

      // Filter and sort
      const filtered = scoredDocs
        .filter((doc: any) => doc.confidence >= options.minConfidence)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, options.topK);

      const averageConfidence =
        filtered?.length || 0 > 0
          ? filtered.reduce((sum: any, doc: any) => sum + doc.confidence, 0) /
            filtered?.length || 0
          : 0;

      return {
        documents: filtered,
        query,
        totalMatches: searchResults?.length || 0,
        averageConfidence,
        retrievalTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("Custom retrieval error:", error);
      return {
        documents: [],
        query,
        totalMatches: 0,
        averageConfidence: 0,
        retrievalTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this?.retrievalCache?.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this?.retrievalCache?.size,
      maxSize: this.cacheSize,
      hitRate: 0, // Would need tracking to implement
    };
  }
}
