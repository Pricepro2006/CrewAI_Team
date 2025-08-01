/**
 * Middleware exports for GROUP 2B WebSearch Enhancement
 */

export { BusinessSearchMiddleware } from "./BusinessSearchMiddleware.js";
export type {
  MiddlewareMetrics,
  MiddlewareConfig,
} from "./BusinessSearchMiddleware.js";

// Re-export feature flag service for convenience
export { FeatureFlagService } from "../../config/features/FeatureFlagService.js";
export type {
  FeatureFlag,
  FeatureFlagConfig,
} from "../../config/features/FeatureFlagService.js";
