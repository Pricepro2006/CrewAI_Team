/**
 * Confidence-Scored RAG System Exports
 * Central export point for all confidence scoring components
 */

// Core types
export * from "./types";

// Configuration
export { getConfidenceConfig } from "../../../config/confidence.config";

// Query Processing
export { QueryComplexityAnalyzer } from "./QueryComplexityAnalyzer";
export { BERTRanker } from "./BERTRanker";
export { ConfidenceRAGRetriever } from "./ConfidenceRAGRetriever";

// Response Generation
export { ConfidenceContextBuilder } from "./ConfidenceContextBuilder";
export { ConfidenceResponseGenerator } from "./ConfidenceResponseGenerator";
export { ConfidenceExtractor } from "./ConfidenceExtractor";

// Evaluation
export { FactualityChecker } from "./evaluators/FactualityChecker";
export { RelevanceScorer } from "./evaluators/RelevanceScorer";
export { CoherenceAnalyzer } from "./evaluators/CoherenceAnalyzer";
export { MultiModalEvaluator } from "./MultiModalEvaluator";

// Calibration
export { ConfidenceCalibrator } from "./ConfidenceCalibrator";

// Delivery
export { AdaptiveDeliveryManager } from "./AdaptiveDeliveryManager";

// Performance
export { PerformanceOptimizer } from "./PerformanceOptimizer";

// Re-export key types and enums for convenience
export { ActionType } from "./types"; // ActionType is an enum, not a type

export type {
  // Evaluation types
  ResponseEvaluationResult,
  QualityMetrics,

  // Document types
  ScoredDocument,
  DocumentMetadata,

  // Confidence types
  TokenConfidence,
  ConfidenceContext,
  CalibrationOptions,

  // Delivery types
  DeliveryOptions,
  DeliveredResponse,
  Evidence,
  FeedbackCapture,
} from "./types";
