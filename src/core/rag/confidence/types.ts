/**
 * Core types for the Confidence-Scored RAG System
 * Based on 2025 best practices for confidence calibration and RAG evaluation
 */

// Document types
export interface Document {
  id: string;
  content: string;
  metadata: Record<string, any>;
  source?: string;
  timestamp?: Date;
}

export interface ScoredDocument extends Document {
  score: number;
  confidence: number;
  relevanceScore?: number;
  chunkIndex?: number;
}

// Query analysis types
export interface QueryComplexity {
  score: number; // 0-10 scale
  factors: {
    syntacticComplexity: number;
    semanticComplexity: number;
    domainSpecificity: number;
    multiIntent: boolean;
    ambiguity: number;
  };
  classification: "simple" | "medium" | "complex";
  reasoning: string;
}

// Retrieval types
export interface RetrievalOptions {
  topK: number;
  minConfidence: number;
  includeMetadata?: boolean;
  rerank?: boolean;
}

export interface RetrievalResult {
  documents: ScoredDocument[];
  query: string;
  totalMatches: number;
  averageConfidence: number;
  retrievalTime: number;
}

// Context building types
export interface ContextOptions {
  mode: "unified" | "sectioned" | "hierarchical";
  includeConfidence: boolean;
  maxTokens?: number;
  prioritizeRecent?: boolean;
}

export interface BuiltContext {
  content: string;
  sources: ScoredDocument[];
  totalTokens: number;
  confidence: number;
  warnings: string[];
}

// Generation types
export interface GenerationRequest {
  query: string;
  retrievedDocuments: ScoredDocument[];
  complexity: number;
  context: BuiltContext;
  options?: GenerationOptions;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  includeUncertainty?: boolean;
  format?: "text" | "json" | "markdown";
}

export interface TokenConfidence {
  token: string;
  confidence: number;
  logprob: number;
  alternatives?: Array<{
    token: string;
    confidence: number;
    logprob: number;
  }>;
}

export interface GenerationResult {
  response: string;
  rawConfidence: number;
  tokenConfidence: TokenConfidence[];
  reasoning: string;
  uncertaintyAreas: string[];
  generationTime: number;
}

// Evaluation types
export interface EvaluationMetrics {
  factuality: number;
  relevance: number;
  coherence: number;
  completeness: number;
  consistency: number;
}

export interface ResponseEvaluationResult {
  id: string;
  query: string;
  response: string;
  overallConfidence: number;
  qualityMetrics: EvaluationMetrics;
  factualityScore: number;
  relevanceScore: number;
  coherenceScore: number;
  recommendedAction: ActionType;
  humanReviewNeeded: boolean;
  uncertaintyAreas?: string[];
  supportingEvidence?: string[];
  contradictoryEvidence?: string[];
  metadata?: Record<string, any>;
}

export enum ActionType {
  ACCEPT = "accept",
  REVIEW = "review",
  REJECT = "reject",
  FALLBACK = "fallback",
  REGENERATE = "regenerate",
}

// Calibration types
export interface CalibrationOptions {
  method: "temperature_scaling" | "platt_scaling" | "isotonic_regression";
  validationData?: CalibrationDataPoint[];
  crossValidation?: boolean;
}

export interface CalibrationDataPoint {
  predictedConfidence: number;
  actualAccuracy: number;
  metadata?: Record<string, any>;
}

export interface CalibrationResult {
  calibratedScore: number;
  originalScore: number;
  calibrationMethod: string;
  reliability: number;
  parameters: Record<string, number>;
}

// Delivery types
export interface DeliveryOptions {
  includeConfidenceScore: boolean;
  includeSourceAttribution?: boolean;
  includeUncertaintyWarnings?: boolean;
  includeEvidence?: boolean;
  confidenceFormat: "percentage" | "detailed" | "categorical";
  maxLength?: number;
}

export interface ConfidenceDisplay {
  score: number;
  category: "very_high" | "high" | "medium" | "low" | "very_low";
  display: string;
  explanation?: string;
}

export interface DeliveredResponse {
  content: string;
  confidence: ConfidenceDisplay;
  sources?: ScoredDocument[];
  warnings: string[];
  evidence?: string[];
  metadata: {
    action: ActionType;
    humanReviewNeeded: boolean;
    uncertaintyAreas: string[];
    processingTime: number;
    [key: string]: any;
  };
  feedbackId: string;
}

// Performance optimization types
export interface PerformanceMetrics {
  queryProcessingTime: number;
  retrievalTime: number;
  generationTime: number;
  evaluationTime: number;
  totalTime: number;
  tokensGenerated: number;
  documentsRetrieved: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface SystemLoad {
  cpu: number;
  memory: number;
  modelLoad: number;
  queueLength: number;
}

// Configuration types
export interface ConfidenceConfig {
  retrieval: {
    minimum: number;
    preferred: number;
  };
  generation: {
    acceptable: number;
    review: number;
  };
  overall: {
    high: number;
    medium: number;
    low: number;
  };
}

export interface PerformanceOptimizerConfig {
  enableCache: boolean;
  cacheSize: number;
  cacheTTL: number;
  enableBatching: boolean;
  batchSize: number;
  batchTimeout: number;
  enableModelSwitching: boolean;
  cpuThreshold: number;
  memoryThreshold: number;
}

// Error types
export class ConfidenceRAGError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>,
  ) {
    super(message);
    this.name = "ConfidenceRAGError";
  }
}

export class RetrievalError extends ConfidenceRAGError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "RETRIEVAL_ERROR", details);
    this.name = "RetrievalError";
  }
}

export class GenerationError extends ConfidenceRAGError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "GENERATION_ERROR", details);
    this.name = "GenerationError";
  }
}

export class EvaluationError extends ConfidenceRAGError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, "EVALUATION_ERROR", details);
    this.name = "EvaluationError";
  }
}

// Event types for real-time updates
export interface ConfidenceUpdateEvent {
  stage:
    | "query-analysis"
    | "retrieval"
    | "generation"
    | "evaluation"
    | "calibration"
    | "delivery";
  confidence: number;
  details: Record<string, any>;
  timestamp: Date;
}

export interface ProcessingCompleteEvent {
  query: string;
  confidence: number;
  processingPath: string;
  duration: number;
  timestamp: Date;
}

// Utility types
export type ConfidenceLevel =
  | "very_high"
  | "high"
  | "medium"
  | "low"
  | "very_low";

export interface TimestampedEntry<T> {
  data: T;
  timestamp: Date;
  id: string;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: Date;
  ttl: number;
  hits: number;
}

// Export utility functions
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.9) return "very_high";
  if (score >= 0.8) return "high";
  if (score >= 0.6) return "medium";
  if (score >= 0.4) return "low";
  return "very_low";
}

export function formatConfidenceScore(
  score: number,
  format: "percentage" | "decimal" | "categorical",
): string {
  switch (format) {
    case "percentage":
      return `${Math.round(score * 100)}%`;
    case "decimal":
      return score.toFixed(2);
    case "categorical":
      return getConfidenceLevel(score).replace("_", " ").toUpperCase();
    default:
      return score.toString();
  }
}

export function isHighConfidence(
  score: number,
  threshold: number = 0.8,
): boolean {
  return score >= threshold;
}

export function requiresHumanReview(
  score: number,
  threshold: number = 0.4,
): boolean {
  return score < threshold;
}
