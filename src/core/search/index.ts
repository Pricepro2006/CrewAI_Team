/**
 * Search Module Exports for GROUP 2B WebSearch Enhancement
 */

export * from './types';
export { BusinessQueryOptimizer } from './BusinessQueryOptimizer';
export { LocationDatabase } from './data/locationDatabase';
export { QueryEnhancer } from './QueryEnhancer';
export type { EnhancedQuery } from './QueryEnhancer';

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
  LocationMapping
} from './types';