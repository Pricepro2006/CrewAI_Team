/**
 * Model Selection Configuration
 * Implements granite3.3:2b as main model and qwen3:0.6b for simple tasks
 * Based on comprehensive testing results
 */

export interface ModelSelectionConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  description: string;
}

export interface QueryComplexityFactors {
  queryLength: number;
  technicalTerms: number;
  multiStepRequired: boolean;
  requiresSearch: boolean;
  requiresAnalysis: boolean;
  toolCallRequired: boolean;
}

/**
 * Model configurations based on testing results
 */
export const MODEL_CONFIGS = {
  // Main model for complex queries
  COMPLEX: {
    model: "granite3.3:2b",
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000, // 30 seconds
    description: "Best overall model for complex queries",
  } as ModelSelectionConfig,

  // Fast model for simple queries and tool selection
  SIMPLE: {
    model: "qwen3:0.6b",
    temperature: 0.3,
    maxTokens: 512,
    timeout: 15000, // 15 seconds
    description: "Fastest model for simple queries and tool selection",
  } as ModelSelectionConfig,

  // Fallback balanced model
  BALANCED: {
    model: "qwen3:1.7b",
    temperature: 0.5,
    maxTokens: 1024,
    timeout: 25000, // 25 seconds
    description: "Balanced model for medium complexity",
  } as ModelSelectionConfig,

  // High quality model for critical tasks
  HIGH_QUALITY: {
    model: "granite3.3:8b",
    temperature: 0.6,
    maxTokens: 4096,
    timeout: 90000, // 90 seconds
    description: "Highest quality for critical analysis",
  } as ModelSelectionConfig,
};

/**
 * Determine query complexity based on various factors
 */
export function analyzeQueryComplexity(query: string): QueryComplexityFactors {
  const technicalKeywords = [
    "implement",
    "architecture",
    "algorithm",
    "optimize",
    "analyze",
    "design",
    "integrate",
    "configure",
    "debug",
    "performance",
    "security",
    "scalability",
    "microservices",
    "distributed",
  ];

  const searchKeywords = ["find", "search", "locate", "list", "lookup"];
  const analysisKeywords = [
    "analyze",
    "compare",
    "evaluate",
    "assess",
    "review",
  ];
  const toolKeywords = [
    "create",
    "write",
    "read",
    "update",
    "delete",
    "execute",
  ];

  const lowerQuery = query.toLowerCase();

  return {
    queryLength: query.length,
    technicalTerms: technicalKeywords.filter((term) =>
      lowerQuery.includes(term),
    ).length,
    multiStepRequired:
      query.split(/[.!?]/).length > 2 || lowerQuery.includes("then"),
    requiresSearch: searchKeywords.some((term) => lowerQuery.includes(term)),
    requiresAnalysis: analysisKeywords.some((term) =>
      lowerQuery.includes(term),
    ),
    toolCallRequired: toolKeywords.some((term) => lowerQuery.includes(term)),
  };
}

/**
 * Calculate complexity score from 0-10
 */
export function calculateComplexityScore(
  factors: QueryComplexityFactors,
): number {
  let score = 0;

  // Length factor (0-2 points)
  if (factors.queryLength > 200) score += 2;
  else if (factors.queryLength > 100) score += 1;

  // Technical terms (0-3 points)
  score += Math.min(3, factors.technicalTerms);

  // Multi-step (0-2 points)
  if (factors.multiStepRequired) score += 2;

  // Search/Analysis (0-2 points)
  if (factors.requiresSearch) score += 1;
  if (factors.requiresAnalysis) score += 1;

  // Tool usage (0-1 point)
  if (factors.toolCallRequired) score += 1;

  return Math.min(10, score);
}

/**
 * Select appropriate model based on query and context
 */
export function selectModel(
  query: string,
  context?: {
    urgency?: "low" | "normal" | "high" | "critical";
    accuracy?: "low" | "normal" | "high" | "critical";
    isToolSelection?: boolean;
    isAgentTask?: boolean;
  },
): ModelSelectionConfig {
  // Override for tool selection - always use fast model
  if (context?.isToolSelection || context?.isAgentTask) {
    return MODEL_CONFIGS.SIMPLE;
  }

  // Critical accuracy requirements
  if (context?.accuracy === "critical") {
    return MODEL_CONFIGS.HIGH_QUALITY;
  }

  // Critical urgency - use fastest model
  if (context?.urgency === "critical") {
    return MODEL_CONFIGS.SIMPLE;
  }

  // Analyze query complexity
  const factors = analyzeQueryComplexity(query);
  const complexityScore = calculateComplexityScore(factors);

  // Select based on complexity score
  if (complexityScore >= 7) {
    // Complex queries - use main model
    return MODEL_CONFIGS.COMPLEX;
  } else if (complexityScore >= 4) {
    // Medium complexity
    if (context?.urgency === "high") {
      return MODEL_CONFIGS.BALANCED;
    }
    return MODEL_CONFIGS.COMPLEX;
  } else {
    // Simple queries - use fast model
    return MODEL_CONFIGS.SIMPLE;
  }
}

/**
 * Get model for specific agent tasks
 */
export function getAgentModel(
  agentType: string,
  taskType: string,
): ModelSelectionConfig {
  // Tool selection and simple agent tasks use fast model
  const simpleTaskTypes = [
    "tool_selection",
    "parameter_extraction",
    "simple_response",
    "status_check",
    "list_items",
  ];

  if (simpleTaskTypes.includes(taskType)) {
    return MODEL_CONFIGS.SIMPLE;
  }

  // Research and analysis tasks need better models
  const complexAgentTypes = ["ResearchAgent", "DataAnalysisAgent", "CodeAgent"];
  if (complexAgentTypes.includes(agentType)) {
    return MODEL_CONFIGS.COMPLEX;
  }

  // Default to balanced
  return MODEL_CONFIGS.BALANCED;
}

/**
 * Dynamic model switching based on system load
 */
export function getModelForSystemLoad(
  preferredModel: ModelSelectionConfig,
  systemLoad: {
    cpu: number; // 0-100%
    memory: number; // 0-100%
    queueLength: number;
  },
): ModelSelectionConfig {
  // High system load - switch to faster models
  if (
    systemLoad.cpu > 80 ||
    systemLoad.memory > 85 ||
    systemLoad.queueLength > 10
  ) {
    if (preferredModel.model === MODEL_CONFIGS.HIGH_QUALITY.model) {
      return MODEL_CONFIGS.COMPLEX; // Downgrade from 8b to 2b
    }
    if (preferredModel.model === MODEL_CONFIGS.COMPLEX.model) {
      return MODEL_CONFIGS.BALANCED; // Downgrade from 2b to 1.7b
    }
    if (preferredModel.model === MODEL_CONFIGS.BALANCED.model) {
      return MODEL_CONFIGS.SIMPLE; // Downgrade to fastest
    }
  }

  return preferredModel;
}

/**
 * Model performance metrics from testing
 */
export const MODEL_PERFORMANCE = {
  "granite3.3:2b": {
    avgResponseTime: 26.01,
    qualityScore: 0.85,
    successRate: 0.95,
    bestFor: ["complex_queries", "structured_responses", "multi_step_analysis"],
  },
  "qwen3:0.6b": {
    avgResponseTime: 10.29,
    qualityScore: 0.7,
    successRate: 0.9,
    bestFor: ["simple_queries", "tool_selection", "quick_responses"],
  },
  "qwen3:1.7b": {
    avgResponseTime: 21.44,
    qualityScore: 0.75,
    successRate: 0.92,
    bestFor: ["balanced_tasks", "medium_complexity"],
  },
  "granite3.3:8b": {
    avgResponseTime: 64.7,
    qualityScore: 0.9,
    successRate: 0.93,
    bestFor: ["critical_analysis", "deep_understanding", "high_accuracy"],
  },
};

/**
 * Export configuration for use in other modules
 */
export const defaultModelSelection = {
  main: MODEL_CONFIGS.COMPLEX,
  simple: MODEL_CONFIGS.SIMPLE,
  balanced: MODEL_CONFIGS.BALANCED,
  highQuality: MODEL_CONFIGS.HIGH_QUALITY,
};

export default {
  selectModel,
  getAgentModel,
  getModelForSystemLoad,
  analyzeQueryComplexity,
  calculateComplexityScore,
  MODEL_CONFIGS,
  MODEL_PERFORMANCE,
};
