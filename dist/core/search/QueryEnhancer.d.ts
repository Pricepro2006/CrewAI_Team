/**
 * Query Enhancement Module for GROUP 2B WebSearch Enhancement
 * Integrates location correction, service expansion, and operator application
 */
import { type QueryComponents, UrgencyLevel } from './types';
export interface EnhancedQuery {
    primary: string;
    alternatives: string[];
    metadata: {
        hasLocation: boolean;
        hasTimeConstraint: boolean;
        serviceCategory: string;
        urgencyLevel: UrgencyLevel;
        searchOperators: string[];
    };
}
export declare class QueryEnhancer {
    /**
     * Enhance a query with location correction and service expansion
     */
    static enhance(query: string): EnhancedQuery;
    /**
     * Enhance location with corrections and metadata
     */
    private static enhanceLocation;
    /**
     * Enhance service terms with regional variations
     */
    private static enhanceService;
    /**
     * Build multiple enhanced query variations
     */
    private static buildEnhancedQueries;
    /**
     * Create empty enhancement for security-flagged queries
     */
    private static createEmptyEnhancement;
    /**
     * Format query for specific search engines
     */
    static formatForSearchEngine(query: string, engine: 'google' | 'bing' | 'ddg'): string;
    /**
     * Generate structured query for APIs
     */
    static generateStructuredQuery(components: QueryComponents): any;
}
//# sourceMappingURL=QueryEnhancer.d.ts.map