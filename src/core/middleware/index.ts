/**
 * Middleware exports for GROUP 2B WebSearch Enhancement
 */

export { BusinessSearchMiddleware } from "./BusinessSearchMiddleware";
export type {
  MiddlewareMetrics,
  MiddlewareConfig,
} from "./BusinessSearchMiddleware";

// Re-export feature flag service for convenience
export { FeatureFlagService } from "../../config/features/FeatureFlagService";
export type {
  FeatureFlag,
  FeatureFlagConfig,
} from "../../config/features/FeatureFlagService";
