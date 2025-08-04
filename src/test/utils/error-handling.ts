/**
 * Error handling utilities for tests
 */

import { Logger } from "../../utils/logger.js";

const logger = new Logger("test:error-handling");

export function setupTestErrorHandling(): void {
  // Set up error handling for tests
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  });

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
  });
}

export async function validateTestEnvironment(): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Check NODE_ENV
  if (process.env.NODE_ENV !== "test") {
    issues.push("NODE_ENV is not set to 'test'");
  }

  // Check Ollama
  if (!process.env.OLLAMA_BASE_URL) {
    issues.push("OLLAMA_BASE_URL is not set");
    recommendations.push("Set OLLAMA_BASE_URL to 'http://localhost:11434'");
  }

  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
}

export async function checkOllamaHealth(baseUrl: string): Promise<{
  isHealthy: boolean;
  error?: string;
  latency?: number;
  models?: string[];
}> {
  try {
    const start = Date.now();
    const response = await fetch(`${baseUrl}/api/tags`);
    const latency = Date.now() - start;

    if (!response.ok) {
      return {
        isHealthy: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const models = data.models?.map((m: any) => m.name) || [];

    return {
      isHealthy: true,
      latency,
      models,
    };
  } catch (error) {
    return {
      isHealthy: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function handleTestError(error: unknown, context: string): void {
  logger.error(`Test error in ${context}:`, error);
  
  if (error instanceof Error) {
    logger.error("Stack trace:", error.stack);
  }
}

export const testErrorReporter = {
  errors: [] as Array<{ error: Error; context: string; timestamp: Date }>,
  
  reportError(error: Error, context: string): void {
    this.errors.push({
      error,
      context,
      timestamp: new Date(),
    });
  },
  
  getErrorSummary(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
  } {
    const errorsByType: Record<string, number> = {};
    
    this.errors.forEach(({ error }) => {
      const type = error.constructor.name;
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });
    
    return {
      totalErrors: this.errors.length,
      errorsByType,
    };
  },
};