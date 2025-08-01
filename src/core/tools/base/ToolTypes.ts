// Re-export tool types for convenience
export type {
  ToolParameter,
  ToolResult,
  ValidationResult,
} from "./BaseTool.js";

// Additional tool-specific types
export interface ToolExecutionContext {
  agentId?: string;
  taskId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ToolMetrics {
  executionTime: number;
  success: boolean;
  errorType?: string;
  resourceUsage?: {
    memory?: number;
    cpu?: number;
  };
}
