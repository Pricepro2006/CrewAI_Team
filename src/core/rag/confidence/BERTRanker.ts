/**
 * BERTRanker - Neural re-ranking of documents using BERT-style embeddings
 * Provides advanced semantic ranking beyond keyword matching
 */

import type { ScoredDocument } from "./types";

export interface RankingConfig {
  maxDocuments?: number;
  minScore?: number;
  useSemanticSimilarity?: boolean;
  useCrossAttention?: boolean;
  temperature?: number;
}

export interface RankedDocument extends ScoredDocument {
  bertScore: number;
  originalScore: number;
  semanticRelevance: number;
  crossAttentionScore?: number;
}

export interface RankingResult {
  documents: RankedDocument[];
  processingTime: number;
  reRankingApplied: boolean;
  averageScoreImprovement: number;
}

export class BERTRanker {
  private readonly defaultConfig: Required<RankingConfig> = {
    maxDocuments: 20,
    minScore: 0.1,
    useSemanticSimilarity: true,
    useCrossAttention: false,
    temperature: 1.0
  };

  private config: Required<RankingConfig>;
  private embeddingCache: Map<string, Float32Array>;

  constructor(config?: RankingConfig) {
    this.config = { ...this.defaultConfig, ...config };
    this.embeddingCache = new Map();
  }

  /**
   * Re-rank documents using BERT-style scoring
   * @param query User query string
   * @param documents Initial retrieved documents
   * @param config Optional ranking configuration
   * @returns Re-ranked documents with BERT scores
   */
  async rank(
    query: string,
    documents: ScoredDocument[],
    config?: RankingConfig
  ): Promise<RankingResult> {
    const startTime = Date.now();
    const mergedConfig = { ...this.config, ...config };

    // Filter documents by minimum score
    const eligibleDocs = documents.filter(
      doc => (doc.score || 0) >= mergedConfig.minScore
    );

    if (eligibleDocs.length === 0) {
      return {
        documents: [],
        processingTime: Date.now() - startTime,
        reRankingApplied: false,
        averageScoreImprovement: 0
      };
    }

    // Compute query embedding
    const queryEmbedding = await this.computeEmbedding(query);

    // Compute BERT scores for each document
    const rankedDocs: RankedDocument[] = await Promise.all(
      eligibleDocs.slice(0, mergedConfig.maxDocuments).map(async doc => {
        const bertScore = await this.computeBERTScore(
          query,
          queryEmbedding,
          doc,
          mergedConfig
        );

        const semanticRelevance = mergedConfig.useSemanticSimilarity
          ? await this.computeSemanticRelevance(queryEmbedding, doc.content)
          : 0;

        const crossAttentionScore = mergedConfig.useCrossAttention
          ? await this.computeCrossAttention(query, doc.content)
          : undefined;

        // Combine scores
        const combinedScore = this.combineScores(
          doc.score || 0,
          bertScore,
          semanticRelevance,
          crossAttentionScore,
          mergedConfig
        );

        return {
          ...doc,
          originalScore: doc.score || 0,
          score: combinedScore,
          bertScore,
          semanticRelevance,
          crossAttentionScore
        };
      })
    );

    // Sort by combined score
    rankedDocs.sort((a, b) => b.score - a.score);

    // Calculate average score improvement
    const avgImprovement = this.calculateAverageImprovement(
      eligibleDocs,
      rankedDocs
    );

    return {
      documents: rankedDocs,
      processingTime: Date.now() - startTime,
      reRankingApplied: true,
      averageScoreImprovement: avgImprovement
    };
  }

  /**
   * Compute BERT-style score for a document
   */
  private async computeBERTScore(
    query: string,
    queryEmbedding: Float32Array,
    document: ScoredDocument,
    config: Required<RankingConfig>
  ): Promise<number> {
    // Get document embedding
    const docEmbedding = await this.computeEmbedding(document.content);

    // Calculate cosine similarity
    const cosineSim = this.cosineSimilarity(queryEmbedding, docEmbedding);

    // Apply temperature scaling
    const scaledScore = Math.tanh(cosineSim * config.temperature);

    // Consider document metadata if available
    const metadataBoost = this.getMetadataBoost(document);

    // Combine with length normalization
    const lengthFactor = this.getLengthNormalization(query, document.content);

    return scaledScore * lengthFactor * (1 + metadataBoost);
  }

  /**
   * Compute semantic relevance using embeddings
   */
  private async computeSemanticRelevance(
    queryEmbedding: Float32Array,
    content: string
  ): Promise<number> {
    // Split content into sentences for fine-grained matching
    const sentences = this.splitIntoSentences(content);
    
    if (sentences.length === 0) {
      return 0;
    }

    // Compute embedding for each sentence and find best match
    const sentenceScores = await Promise.all(
      sentences.map(async sentence => {
        const sentEmbedding = await this.computeEmbedding(sentence);
        return this.cosineSimilarity(queryEmbedding, sentEmbedding);
      })
    );

    // Use combination of max and average scores
    const maxScore = Math.max(...sentenceScores);
    const avgScore = sentenceScores.reduce((a, b) => a + b, 0) / sentenceScores.length;
    
    // Weighted combination favoring max score
    return 0.7 * maxScore + 0.3 * avgScore;
  }

  /**
   * Compute cross-attention score (simplified simulation)
   */
  private async computeCrossAttention(
    query: string,
    content: string
  ): Promise<number> {
    // Tokenize both texts
    const queryTokens = this.tokenize(query);
    const contentTokens = this.tokenize(content);

    // Compute attention matrix (simplified)
    const attentionScores: number[] = [];
    
    for (const qToken of queryTokens) {
      let maxAttention = 0;
      for (const cToken of contentTokens) {
        const attention = this.computeTokenSimilarity(qToken, cToken);
        maxAttention = Math.max(maxAttention, attention);
      }
      attentionScores.push(maxAttention);
    }

    // Average attention scores
    return attentionScores.length > 0
      ? attentionScores.reduce((a, b) => a + b, 0) / attentionScores.length
      : 0;
  }

  /**
   * Combine multiple scoring signals
   */
  private combineScores(
    originalScore: number,
    bertScore: number,
    semanticRelevance: number,
    crossAttentionScore: number | undefined,
    config: Required<RankingConfig>
  ): number {
    // Weights for different components
    const weights = {
      original: 0.2,
      bert: 0.4,
      semantic: 0.3,
      crossAttention: 0.1
    };

    let totalScore = 0;
    let totalWeight = 0;

    // Add original score contribution
    totalScore += originalScore * weights.original;
    totalWeight += weights.original;

    // Add BERT score
    totalScore += bertScore * weights.bert;
    totalWeight += weights.bert;

    // Add semantic relevance if enabled
    if (config.useSemanticSimilarity) {
      totalScore += semanticRelevance * weights.semantic;
      totalWeight += weights.semantic;
    }

    // Add cross-attention if available
    if (crossAttentionScore !== undefined) {
      totalScore += crossAttentionScore * weights.crossAttention;
      totalWeight += weights.crossAttention;
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * Compute embedding for text (simulated - would use actual model in production)
   */
  private async computeEmbedding(text: string): Promise<Float32Array> {
    // Check cache
    const cacheKey = this.hashText(text);
    const cached = this.embeddingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Simulate embedding computation
    // In production, this would call a real embedding model
    const embedding = new Float32Array(768); // BERT dimension
    
    // Simple simulation: hash-based pseudo-random embeddings
    const tokens = this.tokenize(text);
    for (let i = 0; i < 768; i++) {
      let value = 0;
      for (const token of tokens) {
        const hash = this.simpleHash(token + i.toString());
        value += (hash % 1000) / 1000 - 0.5;
      }
      embedding[i] = value / Math.sqrt(tokens.length);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    for (let i = 0; i < embedding.length; i++) {
      const currentValue = embedding[i];
      if (currentValue !== undefined) {
        embedding[i] = currentValue / (norm || 1);
      }
    }

    // Cache the result
    if (this.embeddingCache) {
      this.embeddingCache.set(cacheKey, embedding);
    }
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between embeddings
   */
  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      const aVal = a[i];
      const bVal = b[i];
      
      if (aVal !== undefined && bVal !== undefined) {
        dotProduct += aVal * bVal;
        normA += aVal * aVal;
        normB += bVal * bVal;
      }
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * Get metadata boost for special document types
   */
  private getMetadataBoost(document: ScoredDocument): number {
    let boost = 0;

    // Boost for document type
    if (document.metadata?.type === 'documentation') boost += 0.1;
    if (document.metadata?.type === 'tutorial') boost += 0.05;
    
    // Boost for recency
    if (document.metadata?.timestamp) {
      const timestampValue = document.metadata.timestamp;
      if (timestampValue) {
        try {
          const age = Date.now() - new Date(timestampValue as string).getTime();
          const daysSinceUpdate = age / (1000 * 60 * 60 * 24);
          if (daysSinceUpdate < 7) boost += 0.1;
          else if (daysSinceUpdate < 30) boost += 0.05;
        } catch {
          // Invalid timestamp, skip boost
        }
      }
    }

    // Boost for verified sources
    if (document.metadata?.verified === true) boost += 0.15;

    return Math.min(boost, 0.3); // Cap maximum boost
  }

  /**
   * Calculate length normalization factor
   */
  private getLengthNormalization(query: string, content: string): number {
    const queryLength = query.split(/\s+/).length;
    const contentLength = content.split(/\s+/).length;
    
    // Penalize very short or very long documents
    if (contentLength < queryLength * 2) return 0.8;
    if (contentLength > queryLength * 100) return 0.7;
    
    // Optimal length ratio
    const ratio = contentLength / queryLength;
    if (ratio >= 10 && ratio <= 50) return 1.0;
    
    return 0.9;
  }

  /**
   * Calculate average score improvement
   */
  private calculateAverageImprovement(
    original: ScoredDocument[],
    reranked: RankedDocument[]
  ): number {
    const originalMap = new Map(
      original.map(doc => [doc.id, doc.score || 0])
    );

    let totalImprovement = 0;
    let count = 0;

    for (const doc of reranked) {
      const originalScore = originalMap.get(doc.id) ?? 0;
      const improvement = doc.score - originalScore;
      totalImprovement += improvement;
      count++;
    }

    return count > 0 ? totalImprovement / count : 0;
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10);
  }

  /**
   * Tokenize text (simplified)
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter(token => token.length > 0);
  }

  /**
   * Compute similarity between two tokens
   */
  private computeTokenSimilarity(token1: string, token2: string): number {
    if (token1 === token2) return 1.0;
    
    // Check for common prefixes
    const minLen = Math.min(token1.length, token2.length);
    let commonPrefix = 0;
    for (let i = 0; i < minLen; i++) {
      if (token1[i] === token2[i]) commonPrefix++;
      else break;
    }
    
    // Check for edit distance (simplified)
    const similarity = commonPrefix / Math.max(token1.length, token2.length);
    
    return similarity;
  }

  /**
   * Simple hash function for text
   */
  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * Simple numeric hash
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Clear embedding cache
   */
  clearCache(): void {
    if (this.embeddingCache) {
      this.embeddingCache.clear();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RankingConfig>): void {
    this.config = { ...this.config, ...config };
  }
}