/**
 * Output sanitizer for LLM responses
 * Removes sensitive information and ensures clean output
 */
export interface SanitizedOutput {
    content: string;
    metadata?: {
        sanitized: boolean;
        removedItems?: string[];
        warnings?: string[];
    };
}
/**
 * Sanitize LLM output to remove sensitive information and ensure clean responses
 */
export declare function sanitizeLLMOutput(content: string): SanitizedOutput;
/**
 * Quick sanitization for simple cases
 */
export declare function quickSanitize(content: string): string;
/**
 * Sanitize and validate JSON output
 */
export declare function sanitizeJSONOutput(content: string): {
    valid: boolean;
    content: string;
    parsed?: any;
};
/**
 * Sanitize output for specific contexts
 */
export declare function sanitizeForContext(content: string, context: 'email' | 'web' | 'api' | 'general'): SanitizedOutput;
//# sourceMappingURL=output-sanitizer.d.ts.map