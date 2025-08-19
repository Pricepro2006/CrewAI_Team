import { BaseTool } from "./BaseTool.js";
/**
 * ValidatedTool extends BaseTool with additional validation capabilities
 */
export class ValidatedTool extends BaseTool {
    constructor(name, description, parameters = []) {
        super(name, description, parameters);
    }
    /**
     * Validate execution parameters before running the tool
     */
    async validateExecution(params) {
        const validation = this.validateParameters(params);
        return {
            valid: validation.valid,
            errors: validation?.errors?.length > 0 ? validation.errors : undefined,
        };
    }
    /**
     * Get timeout for this tool's execution
     */
    getTimeout() {
        return 30000; // Default 30 seconds
    }
    /**
     * Execute with validation
     */
    async execute(params) {
        const validation = await this.validateExecution(params);
        if (!validation.valid) {
            return {
                success: false,
                error: `Validation failed: ${validation.errors?.join(", ")}`,
            };
        }
        return this.performExecution(params);
    }
}
