/**
 * BERTRanker - Semantic re-ranking using BERT models
 * Uses @xenova/transformers for CPU-optimized inference
 */

import { pipeline, env, Pipeline } from "@xenova/transformers";
import type { ScoredDocument } from "./types";

// Configure Xenova Transformers for optimal CPU performance
env.allowRemoteModels = true;
env.localURL = "/models/"; // Local model cache directory

export interface RerankResult {
  document: ScoredDocument;
  semanticScore: number;
  combinedScore: number;
}

export class BERTRanker {
  private rerankerPipeline: Pipeline | null = null;
  private isInitialized = false;
  private readonly modelName = "Xenova/ms-marco-MiniLM-L-6-v2"; // Optimized for CPU

  constructor() {
    // Model will be loaded on first use
  }

  /**
   * Initialize the BERT reranking pipeline
   * Uses lazy loading for better performance
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      console.log("Initializing BERT reranker with model:", this.modelName);

      // Create a feature extraction pipeline for semantic similarity
      // Note: For reranking, we'll use feature extraction and compute similarity
      this.rerankerPipeline = await pipeline(
        "feature-extraction",
        this.modelName,
        {
          // Optimization options for CPU
          quantized: true, // Use quantized model for faster CPU inference
        },
      );

      this.isInitialized = true;
      console.log("BERT reranker initialized successfully");
    } catch (error) {
      console.error("Failed to initialize BERT reranker:", error);
      throw new Error(`BERT initialization failed: ${error}`);
    }
  }

  /**
   * Rerank documents based on semantic similarity to query
   * @param query The user's query
   * @param documents Documents to rerank
   * @param topK Number of top documents to return
   * @returns Reranked documents with combined scores
   */
  async rerank(
    query: string,
    documents: ScoredDocument[],
    topK?: number,
  ): Promise<RerankResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.rerankerPipeline) {
      console.warn("BERT reranker not available, returning original order");
      return documents.map((doc) => ({
        document: doc,
        semanticScore: doc.retrievalScore,
        combinedScore: doc.retrievalScore,
      }));
    }

    try {
      // Compute embeddings for query
      const queryEmbedding = await this.getEmbedding(query);

      // Compute semantic scores for all documents
      const rerankResults = await Promise.all(
        documents.map(async (doc) => {
          const docEmbedding = await this.getEmbedding(doc.content);
          const semanticScore = this.cosineSimilarity(
            queryEmbedding,
            docEmbedding,
          );

          // Combine retrieval score and semantic score
          // Using weighted geometric mean for better balance
          const combinedScore = this.combineScores(
            doc.retrievalScore,
            semanticScore,
            0.4, // Weight for retrieval score
            0.6, // Weight for semantic score (higher weight for BERT)
          );

          return {
            document: doc,
            semanticScore,
            combinedScore,
          };
        }),
      );

      // Sort by combined score
      rerankResults.sort((a, b) => b.combinedScore - a.combinedScore);

      // Return top K if specified
      return topK ? rerankResults.slice(0, topK) : rerankResults;
    } catch (error) {
      console.error("Error during reranking:", error);
      // Fallback to original scores
      return documents.map((doc) => ({
        document: doc,
        semanticScore: doc.retrievalScore,
        combinedScore: doc.retrievalScore,
      }));
    }
  }

  /**
   * Get embedding for a text using the BERT model
   * @param text Text to embed
   * @returns Embedding vector
   */
  private async getEmbedding(text: string): Promise<Float32Array> {
    if (!this.rerankerPipeline) {
      throw new Error("BERT pipeline not initialized");
    }

    // Truncate text if too long (BERT has token limits)
    const truncatedText = text.substring(0, 512);

    // Get embeddings
    const output = await this.rerankerPipeline(truncatedText, {
      pooling: "mean", // Mean pooling for sentence embeddings
      normalize: true, // Normalize embeddings
    });

    // Extract the embedding array
    // The output format depends on the transformers.js version
    if (Array.isArray(output)) {
      return new Float32Array(output);
    } else if (output.data) {
      return new Float32Array(output.data);
    } else {
      throw new Error("Unexpected embedding output format");
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param embedding1 First embedding
   * @param embedding2 Second embedding
   * @returns Similarity score between 0 and 1
   */
  private cosineSimilarity(
    embedding1: Float32Array,
    embedding2: Float32Array,
  ): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error("Embeddings must have the same length");
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    // Cosine similarity is between -1 and 1, normalize to 0-1
    const similarity = dotProduct / (norm1 * norm2);
    return (similarity + 1) / 2;
  }

  /**
   * Combine retrieval and semantic scores using weighted geometric mean
   * Geometric mean penalizes low scores more than arithmetic mean
   * @param retrievalScore Original retrieval score
   * @param semanticScore BERT semantic similarity score
   * @param retrievalWeight Weight for retrieval score
   * @param semanticWeight Weight for semantic score
   * @returns Combined score
   */
  private combineScores(
    retrievalScore: number,
    semanticScore: number,
    retrievalWeight: number,
    semanticWeight: number,
  ): number {
    // Ensure scores are positive
    const epsilon = 1e-6;
    retrievalScore = Math.max(retrievalScore, epsilon);
    semanticScore = Math.max(semanticScore, epsilon);

    // Weighted geometric mean
    const combinedScore = Math.pow(
      Math.pow(retrievalScore, retrievalWeight) *
        Math.pow(semanticScore, semanticWeight),
      1 / (retrievalWeight + semanticWeight),
    );

    return combinedScore;
  }

  /**
   * Batch rerank for efficiency
   * Processes multiple queries at once
   */
  async batchRerank(
    queries: string[],
    documentSets: ScoredDocument[][],
    topK?: number,
  ): Promise<RerankResult[][]> {
    if (queries.length !== documentSets.length) {
      throw new Error("Number of queries must match number of document sets");
    }

    const results = await Promise.all(
      queries.map((query, index) =>
        this.rerank(query, documentSets[index], topK),
      ),
    );

    return results;
  }

  /**
   * Calculate confidence in reranking
   * Based on score distribution and semantic coherence
   */
  calculateRerankingConfidence(results: RerankResult[]): number {
    if (results.length === 0) return 0;

    // Calculate score statistics
    const scores = results.map((r) => r.combinedScore);
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    const scoreRange = maxScore - minScore;

    // Higher confidence when there's clear separation
    const separation = scoreRange > 0.3 ? 1.0 : scoreRange / 0.3;

    // Check semantic score distribution
    const semanticScores = results.map((r) => r.semanticScore);
    const avgSemanticScore =
      semanticScores.reduce((a, b) => a + b, 0) / semanticScores.length;

    // Higher confidence when semantic scores are high
    const semanticConfidence = Math.min(avgSemanticScore * 1.2, 1.0);

    // Combined confidence
    return separation * 0.6 + semanticConfidence * 0.4;
  }

  /**
   * Check if the reranker is available
   */
  isAvailable(): boolean {
    return this.isInitialized && this.rerankerPipeline !== null;
  }

  /**
   * Get model information
   */
  getModelInfo(): { name: string; initialized: boolean; type: string } {
    return {
      name: this.modelName,
      initialized: this.isInitialized,
      type: "feature-extraction",
    };
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    if (this.rerankerPipeline) {
      // Transformers.js doesn't have explicit dispose, but we can clear the reference
      this.rerankerPipeline = null;
      this.isInitialized = false;
    }
  }
}
