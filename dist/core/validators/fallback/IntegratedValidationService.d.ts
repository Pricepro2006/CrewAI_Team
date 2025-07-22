import { type ValidationResult } from '../BusinessResponseValidator.js';
import { type UserFeedback } from './UserFeedbackCollector.js';
export interface IntegratedValidationOptions {
    enableFallback?: boolean;
    enableFeedback?: boolean;
    privacyMode?: boolean;
    minConfidenceThreshold?: number;
    maxFallbackAttempts?: number;
    cacheResults?: boolean;
}
export interface IntegratedValidationResult extends ValidationResult {
    fallbackUsed: boolean;
    fallbackSources?: string[];
    feedbackId?: string;
    enhancementSuggestions?: string[];
}
export declare class IntegratedValidationService {
    private validator;
    private fallbackManager;
    private feedbackCollector;
    private options;
    private validationCache;
    constructor(options?: IntegratedValidationOptions);
    /**
     * Validate a response with integrated fallback and feedback
     */
    validate(text: string, context?: {
        query?: string;
        location?: string;
        businessType?: string;
        previousAttempts?: number;
    }): Promise<IntegratedValidationResult>;
    /**
     * Submit user feedback for a validation result
     */
    submitFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback;
    /**
     * Get validation statistics
     */
    getStatistics(timeRange?: {
        start: Date;
        end: Date;
    }): {
        validationStats: {
            total: number;
            successful: number;
            fallbackUsed: number;
            averageConfidence: number;
        };
        feedbackStats: any;
        cacheStats: {
            size: number;
            hitRate: number;
        };
    };
    /**
     * Get insights and recommendations
     */
    getInsights(): {
        recommendations: string[];
        patternImprovements: any[];
        dataSourcePerformance: Array<{
            source: string;
            successRate: number;
            averageLatency: number;
        }>;
    };
    /**
     * Clear all caches
     */
    clearCaches(): void;
    /**
     * Export all data for analysis
     */
    exportData(format?: 'json' | 'csv'): {
        feedback?: string;
        statistics: any;
        insights: any;
    };
    /**
     * Merge validation results
     */
    private mergeResults;
    /**
     * Generate cache key
     */
    private generateCacheKey;
    /**
     * Generate enhancement suggestions
     */
    private generateEnhancementSuggestions;
    /**
     * Apply learnings from user feedback
     */
    private applyFeedbackLearnings;
}
//# sourceMappingURL=IntegratedValidationService.d.ts.map