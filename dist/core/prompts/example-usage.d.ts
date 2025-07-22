/**
 * Example usage of BusinessSearchPromptEnhancer
 * Demonstrates integration with existing CrewAI system
 * Part of GROUP 2B WebSearch Enhancement
 */
export declare function basicEnhancementExample(): void;
export declare function ollamaIntegrationExample(): Promise<void>;
export declare class BusinessSearchAgent {
    private promptEnhancer;
    private ollama;
    constructor();
    processBusinessQuery(query: string, context?: any): Promise<any>;
    private determineEnhancementLevel;
    private buildCustomInstructions;
    private parseBusinessResponse;
}
export declare function batchProcessingExample(): Promise<void>;
export declare function dynamicEnhancementExample(userQuery: string): Promise<string>;
export declare function promptAnalysisExample(): void;
export declare function debugEnhancementExample(): void;
export declare function customBusinessCategoriesExample(): void;
//# sourceMappingURL=example-usage.d.ts.map