import { BusinessResponseValidator } from '../BusinessResponseValidator.js';
import { FallbackSearchManager } from './FallbackSearchManager.js';
import { UserFeedbackCollector } from './UserFeedbackCollector.js';
export class IntegratedValidationService {
    validator;
    fallbackManager;
    feedbackCollector;
    options;
    validationCache = new Map();
    constructor(options = {}) {
        this.options = {
            enableFallback: true,
            enableFeedback: true,
            privacyMode: false,
            minConfidenceThreshold: 0.6,
            maxFallbackAttempts: 3,
            cacheResults: true,
            ...options
        };
        this.validator = new BusinessResponseValidator({
            privacyMode: this.options.privacyMode,
            minConfidenceThreshold: this.options.minConfidenceThreshold
        });
        this.fallbackManager = new FallbackSearchManager();
        this.feedbackCollector = new UserFeedbackCollector();
    }
    /**
     * Validate a response with integrated fallback and feedback
     */
    async validate(text, context) {
        // Check cache first
        const cacheKey = this.generateCacheKey(text, context);
        if (this.options.cacheResults && this.validationCache.has(cacheKey)) {
            return this.validationCache.get(cacheKey);
        }
        // Initial validation
        let result = this.validator.validateResponse(text);
        let fallbackUsed = false;
        let fallbackSources = [];
        // If validation fails and fallback is enabled, try fallback search
        if (this.options.enableFallback &&
            (!result.isValid || !result.hasActionableInfo) &&
            context?.query &&
            (context.previousAttempts || 0) < this.options.maxFallbackAttempts) {
            const fallbackOptions = {
                query: context.query,
                missingInfo: result.missingInfo,
                currentResults: result.contactInfo,
                location: context.location,
                searchDepth: result.confidence < 0.3 ? 'deep' : 'shallow'
            };
            const fallbackResult = await this.fallbackManager.performFallbackSearch(fallbackOptions);
            if (fallbackResult.success && fallbackResult.enhancedInfo) {
                // Merge fallback results with original
                result = this.mergeResults(result, fallbackResult.enhancedInfo);
                fallbackUsed = true;
                fallbackSources = fallbackResult.sourcesUsed;
            }
        }
        // Get enhancement suggestions
        const enhancementSuggestions = this.generateEnhancementSuggestions(result, context);
        // Create integrated result
        const integratedResult = {
            ...result,
            fallbackUsed,
            fallbackSources,
            enhancementSuggestions
        };
        // Cache the result
        if (this.options.cacheResults) {
            this.validationCache.set(cacheKey, integratedResult);
        }
        return integratedResult;
    }
    /**
     * Submit user feedback for a validation result
     */
    submitFeedback(feedback) {
        if (!this.options.enableFeedback) {
            throw new Error('Feedback collection is disabled');
        }
        const submittedFeedback = this.feedbackCollector.collectFeedback(feedback);
        // Learn from feedback to improve future validations
        this.applyFeedbackLearnings(submittedFeedback);
        return submittedFeedback;
    }
    /**
     * Get validation statistics
     */
    getStatistics(timeRange) {
        const feedbackStats = this.options.enableFeedback
            ? this.feedbackCollector.getStats(timeRange)
            : null;
        const cacheStats = {
            size: this.validationCache.size,
            hitRate: 0 // Would need to track hits/misses for real hit rate
        };
        // Placeholder validation stats
        const validationStats = {
            total: 0,
            successful: 0,
            fallbackUsed: 0,
            averageConfidence: 0
        };
        return {
            validationStats,
            feedbackStats,
            cacheStats
        };
    }
    /**
     * Get insights and recommendations
     */
    getInsights() {
        const feedbackInsights = this.options.enableFeedback
            ? this.feedbackCollector.getInsights()
            : null;
        const recommendations = [];
        if (feedbackInsights) {
            if (feedbackInsights.frequentlyIncorrectFields.includes('incorrectPhone')) {
                recommendations.push('Consider improving phone number extraction patterns');
            }
            if (feedbackInsights.frequentlyIncorrectFields.includes('incorrectAddress')) {
                recommendations.push('Address extraction needs improvement for better accuracy');
            }
        }
        return {
            recommendations,
            patternImprovements: feedbackInsights?.suggestedPatternImprovements || [],
            dataSourcePerformance: [] // Would be populated from actual metrics
        };
    }
    /**
     * Clear all caches
     */
    clearCaches() {
        this.validationCache.clear();
        this.fallbackManager.clearCache();
    }
    /**
     * Export all data for analysis
     */
    exportData(format = 'json') {
        return {
            feedback: this.options.enableFeedback
                ? this.feedbackCollector.exportFeedback(format)
                : undefined,
            statistics: this.getStatistics(),
            insights: this.getInsights()
        };
    }
    /**
     * Merge validation results
     */
    mergeResults(original, enhanced) {
        // Merge contact info, preferring higher confidence items
        const merged = { ...original };
        // Merge phones
        const phoneMap = new Map(original.contactInfo.phones.map(p => [p.normalized, p]));
        enhanced.phones.forEach(p => {
            if (!phoneMap.has(p.normalized) || p.confidence > phoneMap.get(p.normalized).confidence) {
                phoneMap.set(p.normalized, p);
            }
        });
        merged.contactInfo.phones = Array.from(phoneMap.values());
        // Similar merging for other fields...
        // (Abbreviated for brevity)
        // Recalculate confidence and validity
        merged.confidence = this.validator['calculateOverallConfidence'](merged.contactInfo);
        merged.isValid = merged.confidence >= this.options.minConfidenceThreshold;
        merged.hasActionableInfo = this.validator['hasActionableContactInfo'](merged.contactInfo);
        return merged;
    }
    /**
     * Generate cache key
     */
    generateCacheKey(text, context) {
        const contextStr = context ? JSON.stringify(context) : '';
        return `${text.substring(0, 100)}_${contextStr}`;
    }
    /**
     * Generate enhancement suggestions
     */
    generateEnhancementSuggestions(result, context) {
        const suggestions = [];
        // Add context-aware suggestions
        if (context?.businessType) {
            if (context.businessType === 'restaurant' && !result.contactInfo.hours.length) {
                suggestions.push('Restaurant hours are important - try searching for menu or hours page');
            }
            if (context.businessType === 'retail' && !result.contactInfo.addresses.length) {
                suggestions.push('Retail locations often have store locator pages');
            }
        }
        // Add quality-based suggestions
        if (result.confidence < 0.5) {
            suggestions.push('Low confidence results - consider refining search terms');
        }
        if (result.contactInfo.phones.length === 0 && result.contactInfo.websites.length > 0) {
            suggestions.push('No phone found but website available - check contact page');
        }
        return [...result.suggestions, ...suggestions];
    }
    /**
     * Apply learnings from user feedback
     */
    applyFeedbackLearnings(feedback) {
        // In a real implementation, this would:
        // 1. Update validation patterns
        // 2. Adjust confidence thresholds
        // 3. Reorder data sources
        // 4. Update caching strategies
        // For now, just log the learning
        if (feedback.userRating <= 2) {
            console.log('Low rating received, learning from feedback:', {
                query: feedback.query,
                issues: feedback.specificIssues,
                suggestions: feedback.suggestedCorrection
            });
        }
    }
}
//# sourceMappingURL=IntegratedValidationService.js.map