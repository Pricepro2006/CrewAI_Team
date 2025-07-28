import { BaseTool } from "./BaseTool.js";
import type { ToolParameter, ToolResult } from "./BaseTool.js";

/**
 * ValidatedTool extends BaseTool with additional validation capabilities
 */
export abstract class ValidatedTool extends BaseTool {
  constructor(
    name: string,
    description: string,
    parameters: ToolParameter[] = [],
  ) {
    super(name, description, parameters);
  }

  /**
   * Validate execution parameters before running the tool
   */
  async validateExecution(
    params: any,
  ): Promise<{ valid: boolean; errors?: string[] }> {
    const validation = this.validateParameters(params);
    return {
      valid: validation.valid,
      errors: validation.errors.length > 0 ? validation.errors : undefined,
    };
  }

  /**
   * Get timeout for this tool's execution
   */
  getTimeout(): number {
    return 30000; // Default 30 seconds
  }

  /**
   * Perform the actual execution (to be implemented by subclasses)
   */
  abstract performExecution(params: any): Promise<ToolResult>;

  /**
   * Execute with validation
   */
  async execute(params: any): Promise<ToolResult> {
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
