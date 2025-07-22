/**
 * Query Components Interface for Business Search Optimization
 * GROUP 2B WebSearch Enhancement
 */
export interface QueryComponents {
    serviceType: string;
    location: LocationInfo;
    urgency: UrgencyLevel;
    timeConstraints: TimeConstraint[];
    originalQuery: string;
    expandedTerms: string[];
    businessIndicators: string[];
    searchOperators: SearchOperator[];
}
export interface LocationInfo {
    rawLocation: string;
    city?: string;
    state?: string;
    stateAbbr?: string;
    zipCode?: string;
    address?: string;
    coordinates?: {
        lat: number;
        lon: number;
    };
    confidence: number;
}
export declare enum UrgencyLevel {
    NORMAL = "normal",
    URGENT = "urgent",
    EMERGENCY = "emergency"
}
export interface TimeConstraint {
    type: 'availability' | 'schedule' | 'immediate';
    value: string;
    parsed?: {
        days?: string[];
        hours?: string;
        isNow?: boolean;
    };
}
export interface SearchOperator {
    type: 'near' | 'open_now' | 'rated' | 'licensed';
    value?: string;
}
export interface QueryOptimizationResult {
    optimizedQuery: string;
    components: QueryComponents;
    searchSuggestions: string[];
    confidence: number;
    securityFlags: SecurityFlag[];
}
export interface SecurityFlag {
    type: 'sql_injection' | 'xss' | 'suspicious_pattern';
    severity: 'low' | 'medium' | 'high';
    detail: string;
}
export interface ServiceMapping {
    category: string;
    aliases: string[];
    keywords: string[];
    businessIndicators: string[];
}
export interface LocationMapping {
    correct: string;
    variations: string[];
    type: 'city' | 'state' | 'region';
}
//# sourceMappingURL=types.d.ts.map