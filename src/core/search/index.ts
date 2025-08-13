/**
 * Search Module Exports for GROUP 2B WebSearch Enhancement
 */

export * from "./types.js";
export { BusinessQueryOptimizer } from "./BusinessQueryOptimizer.js";
export { LocationDatabase } from "./data/locationDatabase.js";
export { QueryEnhancer } from "./QueryEnhancer.js";
export type { EnhancedQuery } from "./QueryEnhancer.js";

// Re-export commonly used types for convenience
export type {
  QueryComponents,
  LocationInfo,
  UrgencyLevel,
  TimeConstraint,
  SearchOperator,
  QueryOptimizationResult,
  SecurityFlag,
  ServiceMapping,
  LocationMapping,
} from "./types.js";
