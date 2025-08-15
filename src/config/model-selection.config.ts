/**
 * Model Selection Configuration
 * Aligned with three-stage pipeline architecture:
 * Stage 1: pattern-script (local pattern matching)
 * Stage 2: llama3.2:3b (primary analysis)
 * Stage 3: doomgrave/phi-4:14b-tools-Q3_K_S (critical analysis)
 * 
 * Also supports dynamic model selection based on query complexity
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
 * Model configurations aligned with three-stage pipeline
 */
export const MODEL_CONFIGS = {
  // Stage 1: Pattern matching (not an LLM)
  PATTERN: {
    model: "pattern-script",
    temperature: 0,
    maxTokens: 0,
    timeout: 100, // 0.1 seconds
    description: "Local pattern matching for Stage 1 triage",
  } as ModelSelectionConfig,

  // Stage 2: Primary analysis model
  PRIMARY: {
    model: "llama3.2:3b",
    temperature: 0.3,
    maxTokens: 1000,
    timeout: 45000, // 45 seconds for CPU inference
    description: "Primary model for Stage 2 analysis",
  } as ModelSelectionConfig,

  // Stage 3: Critical analysis model
  CRITICAL: {
    model: "doomgrave/phi-4:14b-tools-Q3_K_S",
    temperature: 0.3,
    maxTokens: 4096,
    timeout: 180000, // 180 seconds for CPU inference
    description: "Critical analysis model for Stage 3",
  } as ModelSelectionConfig,

  // Legacy models (kept for backward compatibility)
  COMPLEX: {
    model: "llama3.2:3b", // Use primary model as default complex
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 45000,
    description: "Complex queries default to primary model",
  } as ModelSelectionConfig,

  SIMPLE: {
    model: "llama3.2:3b", // Use primary model for consistency
    temperature: 0.3,
    maxTokens: 512,
    timeout: 30000,
    description: "Simple queries use primary model with lower token limit",
  } as ModelSelectionConfig,

  BALANCED: {
    model: "llama3.2:3b", // Use primary model
    temperature: 0.5,
    maxTokens: 1024,
    timeout: 45000,
    description: "Balanced queries use primary model",
  } as ModelSelectionConfig,

  HIGH_QUALITY: {
    model: "doomgrave/phi-4:14b-tools-Q3_K_S", // Use critical model for high quality
    temperature: 0.6,
    maxTokens: 4096,
    timeout: 180000,
    description: "High quality tasks use Stage 3 critical model",
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
    queryLength: query?.length || 0,
    technicalTerms: technicalKeywords?.filter((term: any) =>
      lowerQuery.includes(term),
    ).length,
    multiStepRequired:
      query.split(/[.!?]/).length > 2 || lowerQuery.includes("then"),
    requiresSearch: searchKeywords.some((term: any) => lowerQuery.includes(term)),
    requiresAnalysis: analysisKeywords.some((term: any) =>
      lowerQuery.includes(term),
    ),
    toolCallRequired: toolKeywords.some((term: any) => lowerQuery.includes(term)),
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
    if (preferredModel.model === MODEL_CONFIGS?.HIGH_QUALITY?.model) {
      return MODEL_CONFIGS.COMPLEX; // Downgrade from 8b to 2b
    }
    if (preferredModel.model === MODEL_CONFIGS?.COMPLEX?.model) {
      return MODEL_CONFIGS.BALANCED; // Downgrade from 2b to 1.7b
    }
    if (preferredModel.model === MODEL_CONFIGS?.BALANCED?.model) {
      return MODEL_CONFIGS.SIMPLE; // Downgrade to fastest
    }
  }

  return preferredModel;
}

/**
 * Model performance metrics aligned with pipeline
 */
export const MODEL_PERFORMANCE = {
  "pattern-script": {
    avgResponseTime: 0.1,
    qualityScore: 0.46, // From models?.config?.ts
    successRate: 0.98,
    bestFor: ["initial_triage", "pattern_matching", "fast_filtering"],
  },
  "llama3.2:3b": {
    avgResponseTime: 45, // CPU inference time
    qualityScore: 0.656, // From models?.config?.ts (6.56/10)
    successRate: 0.92,
    bestFor: ["general_analysis", "structured_responses", "primary_processing"],
  },
  "doomgrave/phi-4:14b-tools-Q3_K_S": {
    avgResponseTime: 180, // CPU inference time
    qualityScore: 0.775, // From models?.config?.ts (7.75/10)
    successRate: 0.95,
    bestFor: ["critical_analysis", "tool_usage", "complex_reasoning"],
  },
  // Legacy models (for reference)
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
};

/**
 * Export configuration for use in other modules
 */
export const defaultModelSelection = {
  // Three-stage pipeline models
  pattern: MODEL_CONFIGS.PATTERN,
  primary: MODEL_CONFIGS.PRIMARY,
  critical: MODEL_CONFIGS.CRITICAL,
  
  // Legacy mappings (point to pipeline models)
  main: MODEL_CONFIGS.PRIMARY,
  simple: MODEL_CONFIGS.SIMPLE,
  balanced: MODEL_CONFIGS.BALANCED,
  highQuality: MODEL_CONFIGS.HIGH_QUALITY,
};

/**
 * Get model for pipeline stage
 */
export function getModelForStage(stage: 1 | 2 | 3): ModelSelectionConfig {
  switch (stage) {
    case 1:
      return MODEL_CONFIGS.PATTERN;
    case 2:
      return MODEL_CONFIGS.PRIMARY;
    case 3:
      return MODEL_CONFIGS.CRITICAL;
    default:
      return MODEL_CONFIGS.PRIMARY;
  }
}

export default {
  selectModel,
  getAgentModel,
  getModelForSystemLoad,
  analyzeQueryComplexity,
  calculateComplexityScore,
  MODEL_CONFIGS,
  MODEL_PERFORMANCE,
};
