/**
 * Core types for the Confidence-Scored RAG System
 * Based on 2025 best practices for confidence calibration and RAG evaluation
 */
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
export interface QueryComplexity {
    score: number;
    factors: {
        syntacticComplexity: number;
        semanticComplexity: number;
        domainSpecificity: number;
        multiIntent: boolean;
        ambiguity: number;
    };
    classification: 'simple' | 'medium' | 'complex';
    reasoning: string;
}
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
export interface ContextOptions {
    mode: 'unified' | 'sectioned' | 'hierarchical';
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
    format?: 'text' | 'json' | 'markdown';
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
export declare enum ActionType {
    ACCEPT = "accept",
    REVIEW = "review",
    REJECT = "reject",
    FALLBACK = "fallback",
    REGENERATE = "regenerate"
}
export interface CalibrationOptions {
    method: 'temperature_scaling' | 'platt_scaling' | 'isotonic_regression';
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
export interface DeliveryOptions {
    includeConfidenceScore: boolean;
    includeSourceAttribution?: boolean;
    includeUncertaintyWarnings?: boolean;
    includeEvidence?: boolean;
    confidenceFormat: 'percentage' | 'detailed' | 'categorical';
    maxLength?: number;
}
export interface ConfidenceDisplay {
    score: number;
    category: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
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
export declare class ConfidenceRAGError extends Error {
    code: string;
    details?: Record<string, any> | undefined;
    constructor(message: string, code: string, details?: Record<string, any> | undefined);
}
export declare class RetrievalError extends ConfidenceRAGError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class GenerationError extends ConfidenceRAGError {
    constructor(message: string, details?: Record<string, any>);
}
export declare class EvaluationError extends ConfidenceRAGError {
    constructor(message: string, details?: Record<string, any>);
}
export interface ConfidenceUpdateEvent {
    stage: 'query-analysis' | 'retrieval' | 'generation' | 'evaluation' | 'calibration' | 'delivery';
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
export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
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
export declare function getConfidenceLevel(score: number): ConfidenceLevel;
export declare function formatConfidenceScore(score: number, format: 'percentage' | 'decimal' | 'categorical'): string;
export declare function isHighConfidence(score: number, threshold?: number): boolean;
export declare function requiresHumanReview(score: number, threshold?: number): boolean;
//# sourceMappingURL=types.d.ts.map