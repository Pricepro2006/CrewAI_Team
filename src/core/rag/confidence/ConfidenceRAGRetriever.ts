/**
 * ConfidenceRAGRetriever - Multi-stage retrieval with confidence scoring
 * Integrates with existing VectorStore and adds confidence-aware filtering
 */

import { VectorStore } from "../VectorStore";
import { BERTRanker } from "./BERTRanker";
import { QueryComplexityAnalyzer } from "./QueryComplexityAnalyzer";
import {
  ScoredDocument,
  QueryProcessingResult,
  ConfidenceConfig,
} from "./types";
import { getConfidenceConfig } from "../../../config/confidence.config";

export interface RetrievalOptions {
  topK?: number;
  minScore?: number;
  minConfidence?: number;
  includeMetadata?: boolean;
  useBERTReranking?: boolean;
  confidenceConfig?: Partial<ConfidenceConfig>;
}

export class ConfidenceRAGRetriever {
  private vectorStore: VectorStore;
  private bertRanker: BERTRanker;
  private queryAnalyzer: QueryComplexityAnalyzer;
  private config: ConfidenceConfig;

  constructor(vectorStore: VectorStore, config?: Partial<ConfidenceConfig>) {
    this.vectorStore = vectorStore;
    this.bertRanker = new BERTRanker();
    this.queryAnalyzer = new QueryComplexityAnalyzer();
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Initialize the retriever and its components
   */
  async initialize(): Promise<void> {
    // Initialize BERT ranker if available
    try {
      await this.bertRanker.initialize();
      console.log("BERT reranker initialized for confidence-aware retrieval");
    } catch (error) {
      console.warn(
        "BERT reranker initialization failed, will use retrieval scores only:",
        error,
      );
    }
  }

  /**
   * Perform multi-stage retrieval with confidence scoring
   * @param query User query
   * @param options Retrieval options
   * @returns Query processing result with scored documents
   */
  async retrieve(
    query: string,
    options: RetrievalOptions = {},
  ): Promise<QueryProcessingResult> {
    // Analyze query complexity
    const complexityAnalysis = this.queryAnalyzer.assessComplexity(query);

    // Adjust retrieval parameters based on complexity
    const adjustedOptions = this.adjustRetrievalOptions(
      options,
      complexityAnalysis.score,
    );

    // Stage 1: Initial vector retrieval
    const initialDocuments = await this.performVectorRetrieval(
      query,
      adjustedOptions,
    );

    // Stage 2: Confidence filtering
    const filteredDocuments = this.filterByConfidence(
      initialDocuments,
      adjustedOptions,
    );

    // Stage 3: BERT reranking (if available and enabled)
    let finalDocuments: ScoredDocument[];
    if (adjustedOptions.useBERTReranking && this.bertRanker.isAvailable()) {
      const rerankResults = await this.bertRanker.rerank(
        query,
        filteredDocuments,
        adjustedOptions.topK,
      );

      // Update confidence scores based on reranking
      finalDocuments = rerankResults.map((result) => ({
        ...result.document,
        confidenceScore: this.calculateFinalConfidence(
          result.document.retrievalScore,
          result.semanticScore,
          result.combinedScore,
        ),
      }));
    } else {
      finalDocuments = filteredDocuments.slice(0, adjustedOptions.topK || 5);
    }

    // Calculate overall retrieval confidence
    const retrievalConfidence = this.calculateRetrievalConfidence(
      finalDocuments,
      complexityAnalysis.score,
    );

    return {
      processedQuery: query,
      queryComplexity: complexityAnalysis.score,
      expectedDomains: complexityAnalysis.analysis.domains,
      retrievalConfidence,
      documents: finalDocuments,
    };
  }

  /**
   * Perform vector retrieval from the store
   */
  private async performVectorRetrieval(
    query: string,
    options: RetrievalOptions,
  ): Promise<ScoredDocument[]> {
    try {
      // Query the vector store
      const results = await this.vectorStore.query(
        query,
        options.topK ? options.topK * 2 : 10, // Get more for filtering
      );

      // Convert to ScoredDocument format
      return results.map((result, index) => ({
        id: result.id || `doc_${index}`,
        content: result.content,
        retrievalScore: result.score || 0,
        confidenceScore: result.score || 0, // Initial confidence equals retrieval score
        source: result.metadata?.source || "unknown",
        metadata: {
          ...result.metadata,
          retrievalRank: index + 1,
        },
      }));
    } catch (error) {
      console.error("Vector retrieval failed:", error);
      return [];
    }
  }

  /**
   * Filter documents by confidence thresholds
   */
  private filterByConfidence(
    documents: ScoredDocument[],
    options: RetrievalOptions,
  ): ScoredDocument[] {
    const minConfidence = options.minScore || this.config.retrieval.minimum;

    return documents.filter((doc) => {
      // Apply minimum confidence threshold
      if (doc.retrievalScore < minConfidence) {
        return false;
      }

      // Additional quality checks
      if (this.isLowQualityDocument(doc)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if document is low quality
   */
  private isLowQualityDocument(doc: ScoredDocument): boolean {
    // Check content length
    if (doc.content.trim().length < 50) {
      return true;
    }

    // Check for repetitive content
    const words = doc.content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const uniqueRatio = uniqueWords.size / words.length;

    if (uniqueRatio < 0.3) {
      // Too repetitive
      return true;
    }

    return false;
  }

  /**
   * Calculate final confidence score for a document
   */
  private calculateFinalConfidence(
    retrievalScore: number,
    semanticScore: number,
    combinedScore: number,
  ): number {
    // Weight the scores based on reliability
    const weights = {
      retrieval: 0.3,
      semantic: 0.4,
      combined: 0.3,
    };

    const finalScore =
      retrievalScore * weights.retrieval +
      semanticScore * weights.semantic +
      combinedScore * weights.combined;

    return Math.min(Math.max(finalScore, 0), 1);
  }

  /**
   * Calculate overall retrieval confidence
   */
  private calculateRetrievalConfidence(
    documents: ScoredDocument[],
    queryComplexity: number,
  ): number {
    if (documents.length === 0) {
      return 0;
    }

    // Factor 1: Document quality
    const avgConfidence =
      documents.reduce((sum, doc) => sum + doc.confidenceScore, 0) /
      documents.length;

    // Factor 2: Score distribution
    const scores = documents.map((d) => d.confidenceScore);
    const maxScore = Math.max(...scores);
    const scoreSpread = scores.length > 1 ? maxScore - Math.min(...scores) : 0;

    // Factor 3: Query complexity penalty
    const complexityPenalty = Math.max(0, 1 - (queryComplexity - 5) * 0.1);

    // Factor 4: Document count adequacy
    const countScore = Math.min(documents.length / 3, 1); // At least 3 docs is good

    // Combine factors
    const confidence =
      avgConfidence * 0.4 +
      (scoreSpread > 0.2 ? 0.2 : scoreSpread) + // Bonus for clear winner
      complexityPenalty * 0.2 +
      countScore * 0.2;

    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Adjust retrieval options based on query complexity
   */
  private adjustRetrievalOptions(
    options: RetrievalOptions,
    complexity: number,
  ): RetrievalOptions {
    const adjusted = { ...options };

    // Complex queries need more documents
    if (complexity > 7 && !adjusted.topK) {
      adjusted.topK = 8;
    } else if (complexity > 5 && !adjusted.topK) {
      adjusted.topK = 6;
    } else if (!adjusted.topK) {
      adjusted.topK = 5;
    }

    // Complex queries may need lower minimum scores
    if (complexity > 7 && !adjusted.minScore) {
      adjusted.minScore = this.config.retrieval.minimum * 0.9;
    }

    // Always use BERT reranking for complex queries if available
    if (complexity > 5 && adjusted.useBERTReranking === undefined) {
      adjusted.useBERTReranking = true;
    }

    return adjusted;
  }

  /**
   * Batch retrieval for multiple queries
   */
  async batchRetrieve(
    queries: string[],
    options: RetrievalOptions = {},
  ): Promise<QueryProcessingResult[]> {
    const results = await Promise.all(
      queries.map((query) => this.retrieve(query, options)),
    );
    return results;
  }

  /**
   * Get retrieval statistics
   */
  getRetrievalStats(result: QueryProcessingResult): {
    totalDocuments: number;
    avgConfidence: number;
    maxConfidence: number;
    minConfidence: number;
    confidenceDistribution: Record<string, number>;
  } {
    const docs = result.documents;

    if (docs.length === 0) {
      return {
        totalDocuments: 0,
        avgConfidence: 0,
        maxConfidence: 0,
        minConfidence: 0,
        confidenceDistribution: { low: 0, medium: 0, high: 0 },
      };
    }

    const confidences = docs.map((d) => d.confidenceScore);

    // Calculate distribution
    const distribution = {
      low: docs.filter((d) => d.confidenceScore < this.config.overall.low)
        .length,
      medium: docs.filter(
        (d) =>
          d.confidenceScore >= this.config.overall.low &&
          d.confidenceScore < this.config.overall.high,
      ).length,
      high: docs.filter((d) => d.confidenceScore >= this.config.overall.high)
        .length,
    };

    return {
      totalDocuments: docs.length,
      avgConfidence: confidences.reduce((a, b) => a + b, 0) / docs.length,
      maxConfidence: Math.max(...confidences),
      minConfidence: Math.min(...confidences),
      confidenceDistribution: distribution,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ConfidenceConfig>): void {
    this.config = getConfidenceConfig(undefined, config);
  }

  /**
   * Check if BERT reranking is available
   */
  isBERTRankingAvailable(): boolean {
    return this.bertRanker.isAvailable();
  }
}
