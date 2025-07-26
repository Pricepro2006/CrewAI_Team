/**
 * Core types for the Confidence-Scored RAG System
 * Based on 2025 best practices for confidence calibration and RAG evaluation
 */
export var ActionType;
(function (ActionType) {
    ActionType["ACCEPT"] = "accept";
    ActionType["REVIEW"] = "review";
    ActionType["REJECT"] = "reject";
    ActionType["FALLBACK"] = "fallback";
    ActionType["REGENERATE"] = "regenerate";
})(ActionType || (ActionType = {}));
// Error types
export class ConfidenceRAGError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'ConfidenceRAGError';
    }
}
export class RetrievalError extends ConfidenceRAGError {
    constructor(message, details) {
        super(message, 'RETRIEVAL_ERROR', details);
        this.name = 'RetrievalError';
    }
}
export class GenerationError extends ConfidenceRAGError {
    constructor(message, details) {
        super(message, 'GENERATION_ERROR', details);
        this.name = 'GenerationError';
    }
}
export class EvaluationError extends ConfidenceRAGError {
    constructor(message, details) {
        super(message, 'EVALUATION_ERROR', details);
        this.name = 'EvaluationError';
    }
}
// Export utility functions
export function getConfidenceLevel(score) {
    if (score >= 0.9)
        return 'very_high';
    if (score >= 0.8)
        return 'high';
    if (score >= 0.6)
        return 'medium';
    if (score >= 0.4)
        return 'low';
    return 'very_low';
}
export function formatConfidenceScore(score, format) {
    switch (format) {
        case 'percentage':
            return `${Math.round(score * 100)}%`;
        case 'decimal':
            return score.toFixed(2);
        case 'categorical':
            return getConfidenceLevel(score).replace('_', ' ').toUpperCase();
        default:
            return score.toString();
    }
}
export function isHighConfidence(score, threshold = 0.8) {
    return score >= threshold;
}
export function requiresHumanReview(score, threshold = 0.4) {
    return score < threshold;
}
//# sourceMappingURL=types.js.map