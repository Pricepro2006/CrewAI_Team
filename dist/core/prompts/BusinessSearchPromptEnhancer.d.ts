/**
 * BusinessSearchPromptEnhancer - Transforms base prompts to explicitly instruct models to use WebSearch for business queries
 * Part of GROUP 2B WebSearch Enhancement
 */
export interface BusinessSearchEnhancementOptions {
    enhancementLevel?: 'minimal' | 'standard' | 'aggressive';
    includeExamples?: boolean;
    preserveOriginalMarkers?: boolean;
    customInstructions?: string;
}
export interface BusinessSearchExample {
    good: string;
    bad: string;
    explanation: string;
}
export declare class BusinessSearchPromptEnhancer {
    private static readonly BUSINESS_SEARCH_MARKER;
    private static readonly BUSINESS_SEARCH_INSTRUCTION_MARKER;
    private static readonly DEFAULT_BUSINESS_EXAMPLES;
    private static readonly ENHANCEMENT_TEMPLATES;
    /**
     * Enhances a prompt with business search instructions
     */
    enhance(prompt: string | null | undefined, options?: BusinessSearchEnhancementOptions): string;
    /**
     * Returns a default business search prompt if input is invalid
     */
    getDefaultBusinessPrompt(): string;
    /**
     * Checks if a prompt is already enhanced
     */
    isAlreadyEnhanced(prompt: string): boolean;
    /**
     * Extracts business search instructions from an enhanced prompt
     */
    extractInstructions(prompt: string): string | null;
    /**
     * Validates enhancement level
     */
    isValidEnhancementLevel(level: string): boolean;
    private sanitizeInput;
    private getEnhancementTemplate;
    private injectCustomInstructions;
    private addExamples;
    private generateExamplesSection;
    private combinePrompts;
    private addMetadata;
    /**
     * Removes enhancement from a prompt
     */
    removeEnhancement(prompt: string): string;
    /**
     * Analyzes a prompt to determine if it needs business search enhancement
     */
    needsEnhancement(prompt: string): boolean;
}
export declare const businessSearchPromptEnhancer: BusinessSearchPromptEnhancer;
//# sourceMappingURL=BusinessSearchPromptEnhancer.d.ts.map