export interface ToolParameter {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description: string;
    default?: any;
    enum?: any[];
    min?: number;
    max?: number;
    pattern?: string;
}
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
    metadata?: Record<string, any>;
}
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}
export declare abstract class BaseTool {
    name: string;
    description: string;
    parameters: ToolParameter[];
    constructor(name: string, description: string, parameters: ToolParameter[]);
    /**
     * Execute the tool with given parameters
     */
    abstract execute(params: any): Promise<ToolResult>;
    /**
     * Validate parameters before execution
     */
    validateParameters(params: any): ValidationResult;
    /**
     * Validate value type
     */
    protected validateType(value: any, type: string): boolean;
    /**
     * Get parameter schema for documentation
     */
    getParameterSchema(): Record<string, any>;
    /**
     * Get tool metadata
     */
    getMetadata(): Record<string, any>;
    /**
     * Helper method to create a success result
     */
    protected success(data: any, metadata?: Record<string, any>): ToolResult;
    /**
     * Helper method to create an error result
     */
    protected error(error: string | Error, metadata?: Record<string, any>): ToolResult;
}
//# sourceMappingURL=BaseTool.d.ts.map