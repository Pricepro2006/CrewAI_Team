/**
 * Confidence Configuration for the Confidence-Scored RAG System
 * Based on 2025 best practices for confidence calibration
 */
import type { ConfidenceConfig } from "../core/rag/confidence/types";
/**
 * Default confidence thresholds based on research findings
 * These values are optimized for CPU-based inference on AMD Ryzen 7 PRO 7840HS
 */
export declare const defaultConfidenceConfig: ConfidenceConfig;
/**
 * Performance-optimized configuration for faster response times
 * Use when system load is high or quick responses are prioritized
 */
export declare const performanceOptimizedConfig: ConfidenceConfig;
/**
 * High-accuracy configuration for critical queries
 * Use when accuracy is paramount over response time
 */
export declare const highAccuracyConfig: ConfidenceConfig;
/**
 * Configuration for different query types
 * Allows dynamic threshold adjustment based on query characteristics
 */
export declare const queryTypeConfigs: Record<string, Partial<ConfidenceConfig>>;
/**
 * Environment-based configuration selection
 */
export declare function getEnvironmentConfig(): ConfidenceConfig;
/**
 * Merge configurations with custom overrides
 */
export declare function mergeConfidenceConfigs(base: ConfidenceConfig, override: Partial<ConfidenceConfig>): ConfidenceConfig;
/**
 * Validate confidence configuration
 */
export declare function validateConfidenceConfig(config: ConfidenceConfig): boolean;
/**
 * Get configuration from environment variables
 */
export declare function getConfidenceConfigFromEnv(): Partial<ConfidenceConfig>;
/**
 * Main configuration getter that combines all sources
 */
export declare function getConfidenceConfig(queryType?: string, customOverride?: Partial<ConfidenceConfig>): ConfidenceConfig;
export { defaultConfidenceConfig as DEFAULT_CONFIDENCE_CONFIG, performanceOptimizedConfig as PERFORMANCE_CONFIG, highAccuracyConfig as HIGH_ACCURACY_CONFIG, };
//# sourceMappingURL=confidence.config.d.ts.map