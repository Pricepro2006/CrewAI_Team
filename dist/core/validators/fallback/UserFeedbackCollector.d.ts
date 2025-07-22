export interface UserFeedback {
    id: string;
    timestamp: Date;
    query: string;
    validationResult: {
        isValid: boolean;
        hasActionableInfo: boolean;
        confidence: number;
    };
    userRating: 1 | 2 | 3 | 4 | 5;
    feedbackType: 'missing_info' | 'incorrect_info' | 'incomplete' | 'perfect' | 'other';
    specificIssues?: {
        incorrectPhone?: boolean;
        incorrectAddress?: boolean;
        missingHours?: boolean;
        wrongBusiness?: boolean;
        other?: string;
    };
    suggestedCorrection?: {
        phone?: string;
        address?: string;
        hours?: string;
        businessName?: string;
    };
    additionalComments?: string;
}
export interface FeedbackStats {
    totalFeedback: number;
    averageRating: number;
    commonIssues: {
        issue: string;
        count: number;
    }[];
    improvementTrend: {
        date: string;
        rating: number;
    }[];
}
export declare class UserFeedbackCollector {
    private feedback;
    private improvementSuggestions;
    /**
     * Collect user feedback for a validation result
     */
    collectFeedback(feedback: Omit<UserFeedback, 'id' | 'timestamp'>): UserFeedback;
    /**
     * Get feedback statistics
     */
    getStats(timeRange?: {
        start: Date;
        end: Date;
    }): FeedbackStats;
    /**
     * Get feedback for a specific query
     */
    getFeedbackForQuery(query: string): UserFeedback[];
    /**
     * Get improvement suggestions for a query
     */
    getSuggestions(query: string): string[];
    /**
     * Generate feedback form structure
     */
    generateFeedbackForm(query: string, validationResult: UserFeedback['validationResult']): {
        fields: Array<{
            name: string;
            type: string;
            label: string;
            required: boolean;
            options?: string[];
        }>;
        prefilled: Partial<UserFeedback>;
    };
    /**
     * Process suggested corrections to improve future results
     */
    private processSuggestedCorrections;
    /**
     * Learn from user feedback to improve future validations
     */
    private learnFromFeedback;
    /**
     * Export feedback data for analysis
     */
    exportFeedback(format?: 'json' | 'csv'): string;
    /**
     * Generate unique ID for feedback
     */
    private generateId;
    /**
     * Get feedback insights for improving validation
     */
    getInsights(): {
        lowConfidencePatterns: string[];
        frequentlyIncorrectFields: string[];
        reliableDataSources: string[];
        suggestedPatternImprovements: Array<{
            field: string;
            currentPattern: string;
            suggestedPattern: string;
            confidence: number;
        }>;
    };
}
//# sourceMappingURL=UserFeedbackCollector.d.ts.map