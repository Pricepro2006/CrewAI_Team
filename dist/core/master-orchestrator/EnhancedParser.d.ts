import type { OllamaProvider } from "../llm/OllamaProvider";
import type { Query } from "./types";
import type { QueryAnalysis } from "./enhanced-types";
/**
 * Enhanced parser for structured query analysis
 * Based on master_orchestrator_instructions.md patterns
 */
export declare class EnhancedParser {
    private llm;
    private entityPatterns;
    private intentClassifier;
    constructor(llm: OllamaProvider);
    private initializePatterns;
    parseQuery(query: Query, context?: Record<string, any>): Promise<QueryAnalysis>;
    private extractEntities;
    private classifyIntent;
    private classifyIntentByPatterns;
    private assessComplexity;
    private identifyRequiredDomains;
    private assessPriority;
    private estimateDuration;
    private analyzeResourceRequirements;
    private extractTechnicalTerms;
    private extractProgrammingLanguages;
    private extractFrameworks;
}
//# sourceMappingURL=EnhancedParser.d.ts.map