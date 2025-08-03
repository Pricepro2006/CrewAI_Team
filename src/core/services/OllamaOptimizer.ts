/**
 * Ollama Performance Optimizer
 * Implements high-throughput optimizations for local LLM inference
 * Target: 60+ emails/minute (1+ email/second)
 */

import axios from "axios";
import type { AxiosInstance } from "axios";
import { EventEmitter } from "events";
import { logger } from "../../utils/logger.js";
import PQueue from "p-queue";
import { performance } from "perf_hooks";
import { Agent } from "http";

interface OptimizationConfig {
  // Connection pooling
  maxSockets: number;
  keepAliveTimeout: number;

  // Model management
  preloadModels: string[];
  modelKeepAlive: number; // seconds to keep model in memory

  // Batch processing
  enableBatching: boolean;
  maxBatchSize: number;
  batchTimeout: number; // ms to wait for batch to fill

  // Concurrency
  maxConcurrentInference: number;
  queueConcurrency: number;

  // Performance
  enableGPU: boolean;
  numThreads: number;
  numGPULayers?: number;

  // Fallback
  enableFallback: boolean;
  fallbackModels: string[];

  // Monitoring
  enableMetrics: boolean;
  metricsInterval: number; // ms
}

interface ModelStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  throughput: number; // requests per second
}

interface BatchRequest {
  id: string;
  prompt: string;
  model: string;
  options: any;
  resolve: (value: string) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

export class OllamaOptimizer extends EventEmitter {
  private config: OptimizationConfig;
  private axiosInstance: AxiosInstance;
  private inferenceQueue: PQueue;
  private batchQueue: Map<string, BatchRequest[]> = new Map();
  private modelStats: Map<string, ModelStats> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();
  private warmModels: Set<string> = new Set();
  private metricsTimer?: NodeJS.Timer;

  constructor(
    baseUrl: string = "http://localhost:11434",
    config?: Partial<OptimizationConfig>,
  ) {
    super();

    this.config = {
      // Optimized defaults for high throughput
      maxSockets: 50,
      keepAliveTimeout: 600000, // 10 minutes
      preloadModels: ["llama3.2:3b", "doomgrave/phi-4:14b-tools-Q3_K_S"],
      modelKeepAlive: 300, // 5 minutes
      enableBatching: true,
      maxBatchSize: 10,
      batchTimeout: 100, // 100ms
      maxConcurrentInference: 20,
      queueConcurrency: 15,
      enableGPU: true,
      numThreads: 8,
      numGPULayers: 35, // Adjust based on GPU memory
      enableFallback: true,
      fallbackModels: ["qwen3:0.6b", "phi3:mini"],
      enableMetrics: true,
      metricsInterval: 10000, // 10 seconds
      ...config,
    };

    // Create optimized axios instance with connection pooling
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 second timeout
      httpAgent: new Agent({
        keepAlive: true,
        keepAliveMsecs: this.config.keepAliveTimeout,
        maxSockets: this.config.maxSockets,
        maxFreeSockets: 10,
      }),
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Initialize inference queue with optimized concurrency
    this.inferenceQueue = new PQueue({
      concurrency: this.config.queueConcurrency,
      interval: 100, // Process every 100ms
      intervalCap: this.config.maxConcurrentInference,
    });

    // Optimization processes will be started manually
  }

  /**
   * Initialize optimizer components
   */
  async initialize(): Promise<void> {
    try {
      logger.info("Initializing Ollama Optimizer", "OLLAMA_OPTIMIZER");

      // Preload models for faster inference
      await this.preloadModels();

      // Start batch processing timer
      if (this.config.enableBatching) {
        this.startBatchProcessor();
      }

      // Start metrics collection
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }

      // Set up model keep-alive
      this.startModelKeepAlive();

      logger.info(
        "Ollama Optimizer initialized successfully",
        "OLLAMA_OPTIMIZER",
      );
    } catch (error) {
      logger.error(
        "Failed to initialize Ollama Optimizer",
        "OLLAMA_OPTIMIZER",
        { error },
      );
    }
  }

  /**
   * Preload models into memory for faster inference
   */
  private async preloadModels(): Promise<void> {
    logger.info("Preloading models", "OLLAMA_OPTIMIZER", {
      models: this.config.preloadModels,
    });

    for (const model of this.config.preloadModels) {
      try {
        // Pull model if not available
        await this.axiosInstance.post("/api/pull", { name: model });

        // Load model into memory with a simple prompt
        await this.axiosInstance.post("/api/generate", {
          model,
          prompt: "Hello",
          stream: false,
          options: {
            num_predict: 1,
            temperature: 0,
          },
        });

        this.warmModels.add(model);
        logger.info(
          `Model ${model} preloaded successfully`,
          "OLLAMA_OPTIMIZER",
        );
      } catch (error) {
        logger.error(`Failed to preload model ${model}`, "OLLAMA_OPTIMIZER", {
          error,
        });
      }
    }
  }

  /**
   * Optimized inference with batching and fallback
   */
  async generate(
    prompt: string,
    model: string = "llama3.2:3b",
    options: any = {},
  ): Promise<string> {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = performance.now();

    // Check if batching is enabled and applicable
    if (this.config.enableBatching && this.shouldBatch(prompt, options)) {
      return this.addToBatch(requestId, prompt, model, options);
    }

    // Direct inference through queue
    return this.inferenceQueue.add(async () => {
      try {
        const response = await this.performInference(prompt, model, options);
        this.recordLatency(model, performance.now() - startTime);
        return response;
      } catch (error) {
        // Try fallback models if enabled
        if (this.config.enableFallback) {
          for (const fallbackModel of this.config.fallbackModels) {
            try {
              logger.warn(
                `Falling back to ${fallbackModel}`,
                "OLLAMA_OPTIMIZER",
              );
              const response = await this.performInference(
                prompt,
                fallbackModel,
                options,
              );
              this.recordLatency(fallbackModel, performance.now() - startTime);
              return response;
            } catch (fallbackError) {
              continue;
            }
          }
        }
        throw error;
      }
    });
  }

  /**
   * Perform actual inference with optimized settings
   */
  private async performInference(
    prompt: string,
    model: string,
    options: any,
  ): Promise<string> {
    const optimizedOptions = {
      ...options,
      // Optimization settings
      num_ctx: options.num_ctx || 2048, // Reduce context for speed
      num_batch: 512, // Larger batch size
      num_threads: this.config.numThreads,
      num_gpu: this.config.enableGPU ? this.config.numGPULayers || 35 : 0,
      f16_kv: true, // Use 16-bit for key/value cache
      use_mlock: true, // Lock model in memory
      use_mmap: true, // Memory-mapped files for efficiency
      // Model-specific optimizations
      repeat_penalty: 1.1,
      temperature: options.temperature || 0.1,
      top_k: 10,
      top_p: 0.9,
      // Output control
      stop: options.stop || ["\n\n", "```", "</"],
      seed: 42, // Consistent seed for caching benefits
    };

    try {
      const response = await this.axiosInstance.post(
        "/api/generate",
        {
          model,
          prompt,
          stream: false,
          format: options.format || "json",
          options: optimizedOptions,
          keep_alive: this.config.modelKeepAlive,
        },
        {
          timeout: 20000, // 20 second timeout
        },
      );

      if (!response.data?.response) {
        throw new Error("Empty response from Ollama");
      }

      return response.data.response;
    } catch (error: any) {
      logger.error(`Inference failed for model ${model}`, "OLLAMA_OPTIMIZER", {
        error: error.message,
        model,
        promptLength: prompt.length,
      });
      throw error;
    }
  }

  /**
   * Batch processing for similar requests
   */
  private shouldBatch(prompt: string, options: any): boolean {
    // Don't batch if prompt is too long or has specific requirements
    return (
      prompt.length < 1000 &&
      !options.stream &&
      (!options.temperature || options.temperature < 0.3)
    );
  }

  /**
   * Add request to batch queue
   */
  private async addToBatch(
    id: string,
    prompt: string,
    model: string,
    options: any,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id,
        prompt,
        model,
        options,
        resolve,
        reject,
        timestamp: Date.now(),
      };

      // Get or create batch for this model
      const batch = this.batchQueue.get(model) || [];
      batch.push(request);
      this.batchQueue.set(model, batch);

      // Process immediately if batch is full
      if (batch.length >= this.config.maxBatchSize) {
        this.processBatch(model);
      }
    });
  }

  /**
   * Start batch processing timer
   */
  private startBatchProcessor(): void {
    setInterval(() => {
      for (const [model, batch] of this.batchQueue.entries()) {
        if (batch.length > 0) {
          const oldestRequest = Math.min(...batch.map((r) => r.timestamp));
          if (Date.now() - oldestRequest > this.config.batchTimeout) {
            this.processBatch(model);
          }
        }
      }
    }, 50); // Check every 50ms
  }

  /**
   * Process a batch of requests
   */
  private async processBatch(model: string): Promise<void> {
    const batch = this.batchQueue.get(model) || [];
    if (batch.length === 0) return;

    // Clear the batch
    this.batchQueue.set(model, []);

    // Process in parallel with limited concurrency
    const batchPromises = batch.map((request) =>
      this.inferenceQueue.add(async () => {
        try {
          const response = await this.performInference(
            request.prompt,
            request.model,
            request.options,
          );
          request.resolve(response);
        } catch (error) {
          request.reject(error as Error);
        }
      }),
    );

    await Promise.all(batchPromises);
  }

  /**
   * Keep models warm in memory
   */
  private startModelKeepAlive(): void {
    setInterval(
      async () => {
        for (const model of this.warmModels) {
          try {
            await this.axiosInstance.post("/api/generate", {
              model,
              prompt: "",
              keep_alive: this.config.modelKeepAlive,
            });
          } catch (error) {
            logger.debug(`Keep-alive failed for ${model}`, "OLLAMA_OPTIMIZER");
          }
        }
      },
      (this.config.modelKeepAlive * 1000) / 2,
    ); // Refresh at half the keep-alive time
  }

  /**
   * Record latency metrics
   */
  private recordLatency(model: string, latency: number): void {
    let history = this.latencyHistory.get(model) || [];
    history.push(latency);

    // Keep only last 1000 measurements
    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    this.latencyHistory.set(model, history);

    // Update stats
    const stats = this.modelStats.get(model) || {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageLatency: 0,
      p95Latency: 0,
      p99Latency: 0,
      throughput: 0,
    };

    stats.totalRequests++;
    stats.successfulRequests++;
    stats.averageLatency = history.reduce((a, b) => a + b, 0) / history.length;

    // Calculate percentiles
    const sorted = [...history].sort((a, b) => a - b);
    stats.p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0;
    stats.p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0;

    // Calculate throughput (requests per second)
    stats.throughput = 1000 / stats.averageLatency;

    this.modelStats.set(model, stats);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      const metrics = this.getMetrics();
      this.emit("metrics", metrics);

      // Log summary
      logger.info("Ollama Performance Metrics", "OLLAMA_OPTIMIZER", {
        totalThroughput: metrics.totalThroughput,
        queueSize: metrics.queueSize,
        activeModels: metrics.modelMetrics.length,
      });
    }, this.config.metricsInterval);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    totalThroughput: number;
    queueSize: number;
    pendingBatches: number;
    modelMetrics: Array<{
      model: string;
      stats: ModelStats;
    }>;
  } {
    let totalThroughput = 0;
    const modelMetrics: Array<{ model: string; stats: ModelStats }> = [];

    for (const [model, stats] of this.modelStats.entries()) {
      totalThroughput += stats.throughput;
      modelMetrics.push({ model, stats });
    }

    let pendingBatches = 0;
    for (const batch of this.batchQueue.values()) {
      pendingBatches += batch.length;
    }

    return {
      totalThroughput,
      queueSize: this.inferenceQueue.size,
      pendingBatches,
      modelMetrics,
    };
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update queue concurrency
    if (newConfig.queueConcurrency) {
      this.inferenceQueue.concurrency = newConfig.queueConcurrency;
    }

    logger.info("Configuration updated", "OLLAMA_OPTIMIZER", newConfig);
  }

  /**
   * Optimize for specific workload patterns
   */
  async optimizeForWorkload(
    pattern: "batch" | "realtime" | "mixed",
  ): Promise<void> {
    switch (pattern) {
      case "batch":
        this.updateConfig({
          enableBatching: true,
          maxBatchSize: 20,
          batchTimeout: 200,
          maxConcurrentInference: 30,
          queueConcurrency: 25,
        });
        break;

      case "realtime":
        this.updateConfig({
          enableBatching: false,
          maxConcurrentInference: 15,
          queueConcurrency: 10,
          numThreads: 4,
        });
        break;

      case "mixed":
        this.updateConfig({
          enableBatching: true,
          maxBatchSize: 10,
          batchTimeout: 100,
          maxConcurrentInference: 20,
          queueConcurrency: 15,
        });
        break;
    }

    logger.info(`Optimized for ${pattern} workload`, "OLLAMA_OPTIMIZER");
  }

  /**
   * Shutdown optimizer
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down Ollama Optimizer", "OLLAMA_OPTIMIZER");

    // Clear timers
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    // Clear queues
    await this.inferenceQueue.onEmpty();
    this.batchQueue.clear();

    // Remove listeners
    this.removeAllListeners();

    logger.info("Ollama Optimizer shutdown complete", "OLLAMA_OPTIMIZER");
  }
}

// Export singleton instance
export const ollamaOptimizer = new OllamaOptimizer();
