import {
  AppError,
  ErrorCode,
  OllamaConnectionError,
  OllamaModelNotFoundError,
  ServiceUnavailableError,
  withAsyncErrorHandler,
  CircuitBreaker,
  withTimeout,
} from "../../utils/error-handling/index.js";
import { logger } from "../../utils/logger.js";
import type {
  OllamaProvider,
  OllamaGenerateOptions,
  OllamaGenerateWithLogProbsResponse,
} from "./OllamaProvider.js";

/**
 * Enhanced Ollama provider with comprehensive error handling
 */
export class ErrorHandlingOllamaProvider {
  private circuitBreaker: CircuitBreaker;
  private retryAttempts = 0;
  private maxRetries = 3;

  constructor(
    private provider: OllamaProvider,
    private options: {
      timeout?: number;
      maxRetries?: number;
      circuitBreakerThreshold?: number;
      circuitBreakerTimeout?: number;
    } = {},
  ) {
    this.maxRetries = options.maxRetries ?? 3;
    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerThreshold ?? 5,
      options.circuitBreakerTimeout ?? 60000,
    );
  }

  /**
   * Initialize with error handling
   */
  async initialize(): Promise<void> {
    const initWithErrorHandling = withAsyncErrorHandler(
      async () => {
        try {
          await withTimeout(
            this.provider.initialize(),
            this.options.timeout ?? 10000,
            "Ollama initialization timed out",
          );
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes("ECONNREFUSED")) {
              throw OllamaConnectionError({
                originalError: error.message,
                suggestion: "Ensure Ollama is running: ollama serve",
              });
            }
            if (error.message.includes("not found")) {
              const modelMatch = error.message.match(/Model (\S+) not found/);
              const model = modelMatch ? modelMatch[1] : "unknown";
              throw OllamaModelNotFoundError(model ?? "unknown", {
                suggestion: `Pull the model first: ollama pull ${model}`,
              });
            }
          }
          throw error;
        }
      },
      {
        retries: this.maxRetries,
        retryDelay: 1000,
        context: "OllamaProvider.initialize",
        onError: (error) => {
          logger.error("Failed to initialize Ollama provider", "OLLAMA", {
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
    );

    await initWithErrorHandling();
  }

  /**
   * Generate text with comprehensive error handling
   */
  async generate(
    prompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<string> {
    return this.circuitBreaker.execute(
      async () => {
        const generateWithErrorHandling = withAsyncErrorHandler(
          async () => {
            try {
              const response = await withTimeout(
                this.provider.generate(prompt, options),
                this.options.timeout ?? 30000,
                "Ollama generation timed out",
              );

              // Reset retry counter on success
              this.retryAttempts = 0;

              return response;
            } catch (error) {
              this.handleGenerationError(error, prompt, options);
              throw error; // Re-throw after handling
            }
          },
          {
            retries: this.maxRetries,
            retryDelay: 2000,
            context: "OllamaProvider.generate",
            onError: (error) => {
              this.retryAttempts++;
              logger.warn(
                `Ollama generation retry ${this.retryAttempts}/${this.maxRetries}`,
                "OLLAMA",
                {
                  error: error instanceof Error ? error.message : String(error),
                  model: this.provider.getModel(),
                },
              );
            },
          },
        );

        return await generateWithErrorHandling();
      },
      // Fallback function
      async () => {
        logger.error("Circuit breaker open, returning fallback response");
        return "Service temporarily unavailable. Please try again later.";
      },
    );
  }

  /**
   * Generate with log probabilities and error handling
   */
  async generateWithLogProbs(
    prompt: string,
    options?: OllamaGenerateOptions,
  ): Promise<OllamaGenerateWithLogProbsResponse> {
    return this.circuitBreaker.execute(
      async () => {
        const generateWithErrorHandling = withAsyncErrorHandler(
          async () => {
            try {
              const response = await withTimeout(
                this.provider.generateWithLogProbs(prompt, options),
                this.options.timeout ?? 30000,
                "Ollama generation with log probs timed out",
              );

              return response;
            } catch (error) {
              this.handleGenerationError(error, prompt, options);
              throw error;
            }
          },
          {
            retries: this.maxRetries,
            retryDelay: 2000,
            context: "OllamaProvider.generateWithLogProbs",
          },
        );

        return await generateWithErrorHandling();
      },
      // Fallback
      async () => ({
        text: "Service temporarily unavailable.",
        metadata: {
          model: this.provider.getModel(),
          duration: 0,
          tokenCount: 0,
        },
      }),
    );
  }

  /**
   * List models with error handling
   */
  async listModels(): Promise<Array<{ name: string; size: number }>> {
    const listWithErrorHandling = withAsyncErrorHandler(
      async () => {
        try {
          return await withTimeout(
            this.provider.listModels(),
            this.options.timeout ?? 5000,
            "Listing models timed out",
          );
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes("ECONNREFUSED")
          ) {
            throw OllamaConnectionError({
              action: "list models",
              suggestion: "Check if Ollama is running",
            });
          }
          throw error;
        }
      },
      {
        retries: 2,
        retryDelay: 500,
        context: "OllamaProvider.listModels",
        fallbackValue: [], // Return empty array on failure
      },
    );

    return await listWithErrorHandling();
  }

  /**
   * Pull model with progress tracking and error handling
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: number) => void,
  ): Promise<void> {
    const pullWithErrorHandling = withAsyncErrorHandler(
      async () => {
        try {
          await this.provider.pullModel(modelName, onProgress);
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes("ECONNREFUSED")) {
              throw OllamaConnectionError({
                action: "pull model",
                model: modelName,
              });
            }
            if (error.message.includes("manifest unknown")) {
              throw OllamaModelNotFoundError(modelName, {
                suggestion: "Check the model name and try again",
              });
            }
          }
          throw error;
        }
      },
      {
        retries: 1, // Only retry once for model pulls
        retryDelay: 5000,
        context: `OllamaProvider.pullModel(${modelName})`,
        critical: true, // This is a critical operation
      },
    );

    await pullWithErrorHandling();
  }

  /**
   * Health check with circuit breaker
   */
  async healthCheck(): Promise<boolean> {
    try {
      await withTimeout(
        this.provider.listModels(),
        3000,
        "Health check timed out",
      );
      return true;
    } catch (error) {
      logger.warn("Ollama health check failed", "OLLAMA", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get circuit breaker state
   */
  getCircuitState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuit(): void {
    this.circuitBreaker.reset();
    this.retryAttempts = 0;
  }

  /**
   * Get the underlying provider
   */
  getProvider(): OllamaProvider {
    return this.provider;
  }

  /**
   * Handle generation errors with specific error mapping
   */
  private handleGenerationError(
    error: unknown,
    prompt: string,
    options?: OllamaGenerateOptions,
  ): void {
    if (!(error instanceof Error)) return;

    const errorContext = {
      prompt: prompt.substring(0, 100) + "...",
      model: this.provider.getModel(),
      options,
    };

    // Connection errors
    if (
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      throw OllamaConnectionError({
        ...errorContext,
        suggestion: "Check Ollama service status",
      });
    }

    // Model not loaded
    if (
      error.message.includes("model not found") ||
      error.message.includes("no such model")
    ) {
      throw OllamaModelNotFoundError(this.provider.getModel(), errorContext);
    }

    // Out of memory
    if (
      error.message.includes("out of memory") ||
      error.message.includes("OOM")
    ) {
      throw ServiceUnavailableError("Ollama", {
        ...errorContext,
        reason: "Out of memory",
        suggestion: "Try a smaller model or reduce context size",
      });
    }

    // Context length exceeded
    if (
      error.message.includes("context length") ||
      error.message.includes("token limit")
    ) {
      throw new AppError(
        "VALIDATION_ERROR" as ErrorCode,
        "Input exceeds model context length",
        422,
        {
          ...errorContext,
          suggestion: "Reduce input size or use a model with larger context",
        },
      );
    }

    // Rate limiting (if implemented by Ollama)
    if (
      error.message.includes("rate limit") ||
      error.message.includes("too many requests")
    ) {
      throw new AppError(
        "RATE_LIMIT_EXCEEDED" as ErrorCode,
        "Ollama rate limit exceeded",
        429,
        errorContext,
      );
    }
  }
}

/**
 * Create an error-handling wrapper for an existing Ollama provider
 */
export function withOllamaErrorHandling(
  provider: OllamaProvider,
  options?: {
    timeout?: number;
    maxRetries?: number;
    circuitBreakerThreshold?: number;
    circuitBreakerTimeout?: number;
  },
): ErrorHandlingOllamaProvider {
  return new ErrorHandlingOllamaProvider(provider, options);
}
