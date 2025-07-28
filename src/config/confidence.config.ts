/**
 * Confidence Configuration for the Confidence-Scored RAG System
 * Based on 2025 best practices for confidence calibration
 */

import type { ConfidenceConfig } from "../core/rag/confidence/types.js";

/**
 * Default confidence thresholds based on research findings
 * These values are optimized for CPU-based inference on AMD Ryzen 7 PRO 7840HS
 */
export const defaultConfidenceConfig: ConfidenceConfig = {
  retrieval: {
    minimum: 0.6, // Below this, documents are filtered out
    preferred: 0.75, // Target confidence for reliable retrieval
  },
  generation: {
    acceptable: 0.7, // Minimum confidence for automatic acceptance
    review: 0.4, // Below this, always require human review
  },
  overall: {
    high: 0.8, // High confidence - direct delivery
    medium: 0.6, // Medium confidence - deliver with caveats
    low: 0.4, // Low confidence - significant uncertainty
  },
};

/**
 * Performance-optimized configuration for faster response times
 * Use when system load is high or quick responses are prioritized
 */
export const performanceOptimizedConfig: ConfidenceConfig = {
  retrieval: {
    minimum: 0.5, // Lower threshold for broader results
    preferred: 0.7, // Slightly relaxed preference
  },
  generation: {
    acceptable: 0.65, // Slightly lower acceptance threshold
    review: 0.35, // More permissive review threshold
  },
  overall: {
    high: 0.75, // Adjusted for performance
    medium: 0.55,
    low: 0.35,
  },
};

/**
 * High-accuracy configuration for critical queries
 * Use when accuracy is paramount over response time
 */
export const highAccuracyConfig: ConfidenceConfig = {
  retrieval: {
    minimum: 0.7, // Stricter document filtering
    preferred: 0.85, // Only highly relevant documents
  },
  generation: {
    acceptable: 0.8, // High bar for automatic acceptance
    review: 0.5, // More conservative review threshold
  },
  overall: {
    high: 0.85, // Very high confidence required
    medium: 0.7,
    low: 0.5,
  },
};

/**
 * Configuration for different query types
 * Allows dynamic threshold adjustment based on query characteristics
 */
export const queryTypeConfigs: Record<string, Partial<ConfidenceConfig>> = {
  factual: {
    generation: {
      acceptable: 0.75, // Higher bar for factual accuracy
      review: 0.45,
    },
  },
  creative: {
    generation: {
      acceptable: 0.6, // More lenient for creative tasks
      review: 0.3,
    },
  },
  technical: {
    retrieval: {
      minimum: 0.65, // Ensure technical accuracy
      preferred: 0.8,
    },
    generation: {
      acceptable: 0.75,
      review: 0.5,
    },
  },
  conversational: {
    generation: {
      acceptable: 0.6, // More relaxed for chat
      review: 0.35,
    },
  },
};

/**
 * Environment-based configuration selection
 */
export function getEnvironmentConfig(): ConfidenceConfig {
  const env = process.env.CONFIDENCE_MODE || "default";

  switch (env) {
    case "performance":
      return performanceOptimizedConfig;
    case "accuracy":
      return highAccuracyConfig;
    case "default":
    default:
      return defaultConfidenceConfig;
  }
}

/**
 * Merge configurations with custom overrides
 */
export function mergeConfidenceConfigs(
  base: ConfidenceConfig,
  override: Partial<ConfidenceConfig>,
): ConfidenceConfig {
  return {
    retrieval: {
      ...base.retrieval,
      ...(override.retrieval || {}),
    },
    generation: {
      ...base.generation,
      ...(override.generation || {}),
    },
    overall: {
      ...base.overall,
      ...(override.overall || {}),
    },
  };
}

/**
 * Validate confidence configuration
 */
export function validateConfidenceConfig(config: ConfidenceConfig): boolean {
  // Ensure all values are between 0 and 1
  const allValues = [
    config.retrieval.minimum,
    config.retrieval.preferred,
    config.generation.acceptable,
    config.generation.review,
    config.overall.high,
    config.overall.medium,
    config.overall.low,
  ];

  if (!allValues.every((v) => v >= 0 && v <= 1)) {
    return false;
  }

  // Ensure logical ordering
  if (config.retrieval.minimum > config.retrieval.preferred) {
    return false;
  }

  if (config.generation.review > config.generation.acceptable) {
    return false;
  }

  if (
    config.overall.low > config.overall.medium ||
    config.overall.medium > config.overall.high
  ) {
    return false;
  }

  return true;
}

/**
 * Get configuration from environment variables
 */
export function getConfidenceConfigFromEnv(): Partial<ConfidenceConfig> {
  const config: any = {};

  // Retrieval thresholds
  if (process.env.CONFIDENCE_RETRIEVAL_MIN || process.env.CONFIDENCE_RETRIEVAL_PREFERRED) {
    config.retrieval = {};
    if (process.env.CONFIDENCE_RETRIEVAL_MIN) {
      config.retrieval.minimum = parseFloat(process.env.CONFIDENCE_RETRIEVAL_MIN);
    }
    if (process.env.CONFIDENCE_RETRIEVAL_PREFERRED) {
      config.retrieval.preferred = parseFloat(process.env.CONFIDENCE_RETRIEVAL_PREFERRED);
    }
  }

  // Generation thresholds
  if (process.env.CONFIDENCE_GENERATION_ACCEPTABLE || process.env.CONFIDENCE_GENERATION_REVIEW) {
    config.generation = {};
    if (process.env.CONFIDENCE_GENERATION_ACCEPTABLE) {
      config.generation.acceptable = parseFloat(process.env.CONFIDENCE_GENERATION_ACCEPTABLE);
    }
    if (process.env.CONFIDENCE_GENERATION_REVIEW) {
      config.generation.review = parseFloat(process.env.CONFIDENCE_GENERATION_REVIEW);
    }
  }

  // Overall thresholds
  if (process.env.CONFIDENCE_OVERALL_HIGH || process.env.CONFIDENCE_OVERALL_MEDIUM || process.env.CONFIDENCE_OVERALL_LOW) {
    config.overall = {};
    if (process.env.CONFIDENCE_OVERALL_HIGH) {
      config.overall.high = parseFloat(process.env.CONFIDENCE_OVERALL_HIGH);
    }
    if (process.env.CONFIDENCE_OVERALL_MEDIUM) {
      config.overall.medium = parseFloat(process.env.CONFIDENCE_OVERALL_MEDIUM);
    }
    if (process.env.CONFIDENCE_OVERALL_LOW) {
      config.overall.low = parseFloat(process.env.CONFIDENCE_OVERALL_LOW);
    }
  }

  return config as Partial<ConfidenceConfig>;
}

/**
 * Main configuration getter that combines all sources
 */
export function getConfidenceConfig(
  queryType?: string,
  customOverride?: Partial<ConfidenceConfig>,
): ConfidenceConfig {
  // Start with environment-based config
  let config = getEnvironmentConfig();

  // Apply query type specific overrides if available
  if (queryType && queryTypeConfigs[queryType]) {
    config = mergeConfidenceConfigs(config, queryTypeConfigs[queryType]);
  }

  // Apply environment variable overrides
  const envOverrides = getConfidenceConfigFromEnv();
  if (Object.keys(envOverrides).length > 0) {
    config = mergeConfidenceConfigs(config, envOverrides);
  }

  // Apply custom overrides if provided
  if (customOverride) {
    config = mergeConfidenceConfigs(config, customOverride);
  }

  // Validate final configuration
  if (!validateConfidenceConfig(config)) {
    console.warn("Invalid confidence configuration detected, using defaults");
    return defaultConfidenceConfig;
  }

  return config;
}

// Export individual configs for direct access
export {
  defaultConfidenceConfig as DEFAULT_CONFIDENCE_CONFIG,
  performanceOptimizedConfig as PERFORMANCE_CONFIG,
  highAccuracyConfig as HIGH_ACCURACY_CONFIG,
};
