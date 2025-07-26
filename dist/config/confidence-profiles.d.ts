/**
 * Confidence scoring profiles for different use cases
 * Allows users to select between conservative, balanced, or permissive settings
 */
import type { ConfidenceConfig } from "../core/rag/confidence/types";
export interface ConfidenceProfile {
    name: string;
    description: string;
    config: ConfidenceConfig;
    complexityThresholds: {
        simple: number;
        medium: number;
    };
    deliveryOptions: {
        alwaysIncludeConfidence: boolean;
        alwaysIncludeEvidence: boolean;
        defaultWarnings: boolean;
    };
}
export declare const CONFIDENCE_PROFILES: Record<string, ConfidenceProfile>;
/**
 * Get confidence profile by name
 */
export declare function getConfidenceProfile(profileName?: string): ConfidenceProfile;
/**
 * Get profile based on environment
 */
export declare function getEnvironmentProfile(): ConfidenceProfile;
/**
 * Create custom profile
 */
export declare function createCustomProfile(name: string, baseProfile: string, overrides: Partial<ConfidenceProfile>): ConfidenceProfile;
/**
 * Profile recommendation based on use case
 */
export declare function recommendProfile(useCase: {
    domain?: string;
    criticality?: "low" | "medium" | "high";
    userExpertise?: "novice" | "intermediate" | "expert";
    responseTime?: "fast" | "balanced" | "thorough";
}): string;
//# sourceMappingURL=confidence-profiles.d.ts.map