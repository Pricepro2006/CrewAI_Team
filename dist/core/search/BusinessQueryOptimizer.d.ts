/**
 * Business Query Optimizer for GROUP 2B WebSearch Enhancement
 * Implements security best practices and query optimization
 */
import type { QueryOptimizationResult } from './types';
export declare class BusinessQueryOptimizer {
    private static readonly DANGEROUS_PATTERNS;
    private static readonly LOCATION_PATTERNS;
    private static readonly TIME_PATTERNS;
    private static readonly SERVICE_MAPPINGS;
    /**
     * Optimize a natural language query for business search
     */
    static optimize(query: string): QueryOptimizationResult;
    /**
     * Validate query for security threats
     */
    private static validateSecurity;
    /**
     * Parse query into components
     */
    private static parseQuery;
    /**
     * Sanitize input to prevent injection attacks
     */
    private static sanitizeInput;
    /**
     * Extract service type from query
     */
    private static extractServiceType;
    /**
     * Extract location information
     */
    private static extractLocation;
    /**
     * Extract urgency level
     */
    private static extractUrgency;
    /**
     * Extract time constraints
     */
    private static extractTimeConstraints;
    /**
     * Parse schedule string
     */
    private static parseSchedule;
    /**
     * Expand search terms with synonyms
     */
    private static expandTerms;
    /**
     * Extract business indicators
     */
    private static extractBusinessIndicators;
    /**
     * Extract search operators
     */
    private static extractSearchOperators;
    /**
     * Build optimized search query
     */
    private static buildOptimizedQuery;
    /**
     * Generate search suggestions
     */
    private static generateSuggestions;
    /**
     * Calculate confidence score
     */
    private static calculateConfidence;
    /**
     * Get security type from pattern
     */
    private static getSecurityType;
    /**
     * Create empty components for rejected queries
     */
    private static createEmptyComponents;
}
//# sourceMappingURL=BusinessQueryOptimizer.d.ts.map