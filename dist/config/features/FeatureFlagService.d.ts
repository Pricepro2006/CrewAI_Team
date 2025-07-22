/**
 * Feature Flag Service for GROUP 2B WebSearch Enhancement
 *
 * Provides:
 * - Environment-based configuration
 * - A/B testing with percentage rollout
 * - Dynamic toggling without restart
 * - Integration with existing config system
 */
import { EventEmitter } from 'events';
export interface FeatureFlag {
    name: string;
    enabled: boolean;
    description: string;
    rolloutPercentage: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface FeatureFlagConfig {
    flags: FeatureFlag[];
    defaultRolloutPercentage: number;
    configFilePath?: string;
    refreshIntervalMs?: number;
}
export declare class FeatureFlagService extends EventEmitter {
    private static instance;
    private flags;
    private config;
    private refreshInterval?;
    private userAssignments;
    private constructor();
    static getInstance(): FeatureFlagService;
    private initialize;
    /**
     * Load feature flags from environment variables
     * Format: FEATURE_FLAG_<FLAG_NAME>=true|false|<percentage>
     */
    private loadFromEnvironment;
    /**
     * Load feature flags from JSON file
     */
    private loadFromFile;
    /**
     * Save current flags to file
     */
    private saveToFile;
    /**
     * Ensure business search enhancement flag exists
     */
    private ensureBusinessSearchFlag;
    /**
     * Start automatic refresh interval
     */
    private startRefreshInterval;
    /**
     * Refresh flags from sources
     */
    refresh(): void;
    /**
     * Check if a feature flag is enabled (simple check)
     */
    isEnabled(flagName: string): boolean;
    /**
     * Check if a feature is enabled for a specific user (A/B testing)
     */
    isEnabledForUser(flagName: string, userId: string): boolean;
    /**
     * Get user's percentage bucket (for A/B testing)
     */
    getUserPercentage(flagName: string): number;
    /**
     * Simple hash function for userId to ensure consistent assignment
     */
    private hashUserId;
    /**
     * Get a feature flag
     */
    getFlag(flagName: string): FeatureFlag | undefined;
    /**
     * Get all feature flags
     */
    getAllFlags(): FeatureFlag[];
    /**
     * Update a feature flag
     */
    updateFlag(flagName: string, updates: Partial<FeatureFlag>): void;
    /**
     * Create a new feature flag
     */
    createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>): void;
    /**
     * Delete a feature flag
     */
    deleteFlag(flagName: string): void;
    /**
     * Enable a feature flag
     */
    enableFlag(flagName: string, rolloutPercentage?: number): void;
    /**
     * Disable a feature flag
     */
    disableFlag(flagName: string): void;
    /**
     * Set rollout percentage for a flag
     */
    setRolloutPercentage(flagName: string, percentage: number): void;
    /**
     * Clear user assignments (useful for testing)
     */
    clearUserAssignments(): void;
    /**
     * Export current state (for debugging/monitoring)
     */
    exportState(): {
        flags: FeatureFlag[];
        userAssignmentCount: number;
        config: FeatureFlagConfig;
    };
    /**
     * Cleanup
     */
    destroy(): void;
}
//# sourceMappingURL=FeatureFlagService.d.ts.map