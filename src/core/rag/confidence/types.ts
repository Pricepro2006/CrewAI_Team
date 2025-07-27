/**
 * Core types and interfaces for the Confidence-Scored RAG System
 * Based on 2025 best practices for LLM confidence calibration
 */

// Configuration types
export interface ConfidenceConfig {
  retrieval: {
    minimum: number; // Minimum confidence threshold for document retrieval (0.6)
    preferred: number; // Preferred confidence threshold (0.75)
  };
  generation: {
    acceptable: number; // Acceptable confidence for response generation (0.7)
    review: number; // Threshold below which human review is needed (0.4)
  };
  overall: {
    high: number; // High confidence threshold (0.8)
    medium: number; // Medium confidence threshold (0.6)
    low: number; // Low confidence threshold (0.4)
  };
}

// Document types
export interface DocumentMetadata {
  source: string;
  sourceId: string;
  quality?: number;
  timestamp?: Date;
  chunkIndex?: number;
  totalChunks?: number;
  [key: string]: any;
}

export interface ScoredDocument {
  id: string;
  content: string;
  retrievalScore: number; // Semantic similarity score
  confidenceScore: number; // Overall confidence in document reliability
  source: string;
  metadata: DocumentMetadata;
}

// Token confidence types
export interface TokenConfidence {
  token: string;
  logProbability: number;
  confidence: number; // Normalized 0-1 score
  position: number;
}

// Query processing types
export interface QueryProcessingResult {
  processedQuery: string;
  queryComplexity: number; // 1-10 scale
  expectedDomains: string[];
  retrievalConfidence: number;
  averageConfidence: number;
  documents: ScoredDocument[];
}

// Response generation types
export interface GenerationMetrics {
  tokensGenerated: number;
  averageConfidence: number;
  minConfidence: number;
  maxConfidence: number;
  uncertaintyRatio: number; // Ratio of uncertain tokens
}

export interface ResponseGenerationResult {
  response: string;
  tokenLevelConfidence: TokenConfidence[];
  rawConfidence: number;
  tokenConfidence: TokenConfidence[];
  aggregatedConfidence: number;
  uncertaintyMarkers: string[];
  generationMetrics: GenerationMetrics;
}

// Evaluation types
export interface QualityMetrics {
  factuality: number;
  relevance: number;
  coherence: number;
}

export enum ActionType {
  ACCEPT = "accept", // High confidence (80%+)
  REVIEW = "human_review", // Medium confidence (40-80%)
  REGENERATE = "regenerate", // Low confidence (<40%)
  FALLBACK = "fallback_mode", // System fallback
}

export interface ResponseEvaluationResult {
  overallConfidence: number; // Calibrated final score
  qualityMetrics: QualityMetrics;
  factualityScore: number;
  relevanceScore: number;
  coherenceScore: number;
  recommendedAction: ActionType;
  humanReviewNeeded: boolean;
  query?: string;
  response?: string;
  sources?: ScoredDocument[];
  sourceConfidence?: number[];
  uncertaintyMarkers?: string[];
  tokenConfidence?: TokenConfidence[];
  id?: string;
  modelUsed?: string; // Model used for generation
}

// Delivery types
export enum ConfidenceLevel {
  HIGH = "high", // 80-100%
  MEDIUM = "medium", // 60-80%
  LOW = "low", // 40-60%
  VERY_LOW = "very_low", // <40%
}

export interface Source {
  id: string;
  content: string;
  confidence: number;
  url?: string;
  title?: string;
}

export interface FeedbackData {
  id: string;
  collectUrl: string;
  expectedType: string;
}

export interface ResponseDeliveryResult {
  finalResponse: string;
  confidenceIndicator: ConfidenceLevel;
  evidenceSources: Source[];
  uncertaintyAreas: string[];
  improvementSuggestions: string[];
  feedbackLoop: FeedbackData;
}

// Calibration types
export interface CalibrationOptions {
  method: "temperature_scaling" | "isotonic_regression" | "platt_scaling";
  parameters?: Record<string, any>;
}

// Re-export delivery types from AdaptiveDeliveryManager for backwards compatibility
export type {
  DeliveryOptions,
  DeliveredResponse,
  Evidence,
  FeedbackCapture,
} from "./AdaptiveDeliveryManager";

// Ollama-specific types
export interface OllamaGenerateOptions {
  prompt: string;
  extractLogProbs?: boolean;
  temperature?: number;
  topK?: number;
  topP?: number;
  repeatPenalty?: number;
  seed?: number;
  numPredict?: number;
}

export interface OllamaGenerateResponse {
  text: string;
  tokens?: string[];
  logProbs?: number[];
  metadata?: {
    model: string;
    duration: number;
    tokenCount: number;
    tokensPerSecond?: number;
  };
}

// System-wide types
export interface ConfidenceContext {
  query: string;
  documents: ScoredDocument[];
  retrievedDocuments: ScoredDocument[];
  retrievalConfidence: number;
  queryComplexity: number;
}

export interface ConfidencePipeline {
  process(query: string): Promise<ResponseDeliveryResult>;
}

// Error types
export class ConfidenceError extends Error {
  constructor(
    message: string,
    public code: string,
    public confidence?: number,
  ) {
    super(message);
    this.name = "ConfidenceError";
  }
}

// Feedback types
export interface UserFeedback {
  rating: number; // 1-5 scale
  helpful: boolean;
  accurate: boolean;
  comments?: string;
  suggestedCorrection?: string;
}

// Cache types
export interface CachedResult {
  result: any;
  confidence: number;
  timestamp: number;
  ttl: number;
  hits: number;
}
