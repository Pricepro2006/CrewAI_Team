export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
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

export abstract class BaseTool {
  constructor(
    public name: string,
    public description: string,
    public parameters: ToolParameter[],
  ) {}

  /**
   * Execute the tool with given parameters
   */
  abstract execute(params: any): Promise<ToolResult>;

  /**
   * Validate parameters before execution
   */
  validateParameters(params: any): ValidationResult {
    const errors: string[] = [];

    // Check required parameters
    for (const param of this.parameters) {
      if (param.required && !(param.name in params)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }

      if (param.name in params) {
        const value = params[param.name];

        // Type validation
        if (!this.validateType(value, param.type)) {
          errors.push(
            `Invalid type for ${param.name}: expected ${param.type}, got ${typeof value}`,
          );
        }

        // Additional validations
        if (param.type === "string" && param.pattern) {
          const regex = new RegExp(param.pattern);
          if (!regex.test(value)) {
            errors.push(
              `Invalid format for ${param.name}: must match pattern ${param.pattern}`,
            );
          }
        }

        if (param.type === "number") {
          if (param.min !== undefined && value < param.min) {
            errors.push(`Value for ${param.name} must be >= ${param.min}`);
          }
          if (param.max !== undefined && value > param.max) {
            errors.push(`Value for ${param.name} must be <= ${param.max}`);
          }
        }

        if (param.enum && !param?.enum?.includes(value)) {
          errors.push(
            `Invalid value for ${param.name}: must be one of ${param?.enum?.join(", ")}`,
          );
        }
      }
    }

    return {
      valid: (errors?.length || 0) === 0,
      errors,
    };
  }

  /**
   * Validate value type
   */
  protected validateType(value: any, type: string): boolean {
    switch (type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "object":
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      case "array":
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Get parameter schema for documentation
   */
  getParameterSchema(): Record<string, any> {
    const schema: Record<string, any> = {
      type: "object",
      properties: {},
      required: [],
    };

    for (const param of this.parameters) {
      const propSchema: any = {
        type: param.type,
        description: param.description,
      };

      if (param.default !== undefined) {
        propSchema.default = param.default;
      }
      if (param.enum) {
        propSchema.enum = param.enum;
      }
      if (param.min !== undefined) {
        propSchema.minimum = param.min;
      }
      if (param.max !== undefined) {
        propSchema.maximum = param.max;
      }
      if (param.pattern) {
        propSchema.pattern = param.pattern;
      }

      schema.properties[param.name] = propSchema;

      if (param.required) {
        schema?.required?.push(param.name);
      }
    }

    return schema;
  }

  /**
   * Get tool metadata
   */
  getMetadata(): Record<string, any> {
    return {
      name: this.name,
      description: this.description,
      parameterCount: this?.parameters?.length,
      requiredParameters: this.parameters
        .filter((p: any) => p.required)
        .map((p: any) => p.name),
      optionalParameters: this.parameters
        .filter((p: any) => !p.required)
        .map((p: any) => p.name),
    };
  }

  /**
   * Helper method to create a success result
   */
  protected success(data: any, metadata?: Record<string, any>): ToolResult {
    return {
      success: true,
      data,
      metadata: {
        tool: this.name,
        timestamp: new Date().toISOString(),
        ...metadata,
      },
    };
  }

  /**
   * Helper method to create an error result
   */
  protected error(
    error: string | Error,
    metadata?: Record<string, any>,
  ): ToolResult {
    return {
      success: false,
      error: error instanceof Error ? error.message : error,
      metadata: {
        tool: this.name,
        timestamp: new Date().toISOString(),
        errorType: error instanceof Error ? error.name : "Error",
        ...metadata,
      },
    };
  }
}
