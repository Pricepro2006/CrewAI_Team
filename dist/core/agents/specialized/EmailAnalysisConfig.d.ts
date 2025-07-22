/**
 * Email Analysis Configuration
 * Based on comprehensive testing results
 */
export interface EmailAnalysisModelConfig {
    primaryModel: string;
    criticalBackup?: string;
    entityExtraction?: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
}
export interface TDSynnexPriorityRules {
    patterns: Array<{
        pattern: RegExp | string;
        priority: 'Critical' | 'High' | 'Medium' | 'Low';
        confidence: number;
    }>;
    workflowRules: Array<{
        workflow: string;
        condition: (email: any) => boolean;
        priority: 'Critical' | 'High' | 'Medium' | 'Low';
    }>;
}
/**
 * Production configuration based on testing results
 * granite3.3:2b identified as best overall model
 */
export declare const PRODUCTION_EMAIL_CONFIG: EmailAnalysisModelConfig;
/**
 * TD SYNNEX-specific priority rules based on real email analysis
 */
export declare const TD_SYNNEX_PRIORITY_RULES: TDSynnexPriorityRules;
/**
 * Enhanced priority detection using TD SYNNEX rules
 */
export declare function enhancePriorityDetection(email: any, modelPrediction: string): {
    priority: string;
    confidence: number;
    source: string;
};
/**
 * Configuration for different analysis scenarios
 */
export declare const ANALYSIS_SCENARIOS: {
    highVolume: {
        primaryModel: string;
        maxTokens: number;
        timeout: number;
        criticalBackup?: string;
        entityExtraction?: string;
        temperature: number;
    };
    qualityFocus: {
        primaryModel: string;
        maxTokens: number;
        timeout: number;
        criticalBackup?: string;
        entityExtraction?: string;
        temperature: number;
    };
    balanced: EmailAnalysisModelConfig;
};
declare const _default: {
    PRODUCTION_EMAIL_CONFIG: EmailAnalysisModelConfig;
    TD_SYNNEX_PRIORITY_RULES: TDSynnexPriorityRules;
    enhancePriorityDetection: typeof enhancePriorityDetection;
    ANALYSIS_SCENARIOS: {
        highVolume: {
            primaryModel: string;
            maxTokens: number;
            timeout: number;
            criticalBackup?: string;
            entityExtraction?: string;
            temperature: number;
        };
        qualityFocus: {
            primaryModel: string;
            maxTokens: number;
            timeout: number;
            criticalBackup?: string;
            entityExtraction?: string;
            temperature: number;
        };
        balanced: EmailAnalysisModelConfig;
    };
};
export default _default;
//# sourceMappingURL=EmailAnalysisConfig.d.ts.map