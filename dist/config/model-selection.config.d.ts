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
export declare const MODEL_CONFIGS: {
    COMPLEX: ModelSelectionConfig;
    SIMPLE: ModelSelectionConfig;
    BALANCED: ModelSelectionConfig;
    HIGH_QUALITY: ModelSelectionConfig;
};
/**
 * Determine query complexity based on various factors
 */
export declare function analyzeQueryComplexity(query: string): QueryComplexityFactors;
/**
 * Calculate complexity score from 0-10
 */
export declare function calculateComplexityScore(factors: QueryComplexityFactors): number;
/**
 * Select appropriate model based on query and context
 */
export declare function selectModel(query: string, context?: {
    urgency?: "low" | "normal" | "high" | "critical";
    accuracy?: "low" | "normal" | "high" | "critical";
    isToolSelection?: boolean;
    isAgentTask?: boolean;
}): ModelSelectionConfig;
/**
 * Get model for specific agent tasks
 */
export declare function getAgentModel(agentType: string, taskType: string): ModelSelectionConfig;
/**
 * Dynamic model switching based on system load
 */
export declare function getModelForSystemLoad(preferredModel: ModelSelectionConfig, systemLoad: {
    cpu: number;
    memory: number;
    queueLength: number;
}): ModelSelectionConfig;
/**
 * Model performance metrics from testing
 */
export declare const MODEL_PERFORMANCE: {
    "granite3.3:2b": {
        avgResponseTime: number;
        qualityScore: number;
        successRate: number;
        bestFor: string[];
    };
    "qwen3:0.6b": {
        avgResponseTime: number;
        qualityScore: number;
        successRate: number;
        bestFor: string[];
    };
    "qwen3:1.7b": {
        avgResponseTime: number;
        qualityScore: number;
        successRate: number;
        bestFor: string[];
    };
    "granite3.3:8b": {
        avgResponseTime: number;
        qualityScore: number;
        successRate: number;
        bestFor: string[];
    };
};
/**
 * Export configuration for use in other modules
 */
export declare const defaultModelSelection: {
    main: ModelSelectionConfig;
    simple: ModelSelectionConfig;
    balanced: ModelSelectionConfig;
    highQuality: ModelSelectionConfig;
};
declare const _default: {
    selectModel: typeof selectModel;
    getAgentModel: typeof getAgentModel;
    getModelForSystemLoad: typeof getModelForSystemLoad;
    analyzeQueryComplexity: typeof analyzeQueryComplexity;
    calculateComplexityScore: typeof calculateComplexityScore;
    MODEL_CONFIGS: {
        COMPLEX: ModelSelectionConfig;
        SIMPLE: ModelSelectionConfig;
        BALANCED: ModelSelectionConfig;
        HIGH_QUALITY: ModelSelectionConfig;
    };
    MODEL_PERFORMANCE: {
        "granite3.3:2b": {
            avgResponseTime: number;
            qualityScore: number;
            successRate: number;
            bestFor: string[];
        };
        "qwen3:0.6b": {
            avgResponseTime: number;
            qualityScore: number;
            successRate: number;
            bestFor: string[];
        };
        "qwen3:1.7b": {
            avgResponseTime: number;
            qualityScore: number;
            successRate: number;
            bestFor: string[];
        };
        "granite3.3:8b": {
            avgResponseTime: number;
            qualityScore: number;
            successRate: number;
            bestFor: string[];
        };
    };
};
export default _default;
//# sourceMappingURL=model-selection.config.d.ts.map