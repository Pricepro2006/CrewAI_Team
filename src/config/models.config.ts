/**
 * Global Model Configuration for Three-Stage Pipeline
 * Primary Model: Llama 3.2:3b
 * Updated: July 23, 2025
 */

export const MODEL_CONFIG = {
  // Model definitions
  models: {
    primary: "llama3.2:3b",
    fallback: "llama3.2:3b", // Same model for consistency
    critical: "doomgrave/phi-4:14b-tools-Q3_K_S",
    embedding: process.env.OLLAMA_MODEL_EMBEDDING || "nomic-embed-text", // Optimized embedding model
    pattern: "iteration-script", // Local pattern matching
  },

  // Timeout configurations (milliseconds) - Increased for CPU inference reliability
  timeouts: {
    pattern: 100, // 0.1 seconds for pattern matching
    primary: 45000, // 45 seconds per email for Llama 3.2:3b (CPU inference)
    critical: 180000, // 180 seconds for Phi-4 (increased for CPU inference)
    fallback: 45000, // 45 seconds for Llama fallback (CPU inference)
    embedding: 15000, // 15 seconds for embeddings (increased for CPU inference)
    batch: 900000, // 15 minutes for batch operations (5 emails × 45s × 3 + buffer = 675s + 225s buffer)
  },

  // Batch size configurations - Optimized for CPU inference
  batchSizes: {
    pattern: 100, // Process 100 emails at once
    primary: 5, // 5 emails per batch (5 × 45s = 225s per batch max)
    critical: 1, // Process 1 email at a time
    embedding: 20, // Process 20 texts for embeddings
  },

  // Memory configurations
  memory: {
    modelSizes: {
      "llama3.2:3b": 4 * 1024 * 1024 * 1024, // 4GB
      "doomgrave/phi-4:14b-tools-Q3_K_S": 8 * 1024 * 1024 * 1024, // 8GB estimated
    },
    maxMemoryUsage: 50 * 1024 * 1024 * 1024, // 50GB limit
    reservedMemory: 10 * 1024 * 1024 * 1024, // 10GB reserved for system
  },

  // API configurations
  api: {
    ollamaUrl: "http://localhost:11434",
    endpoints: {
      generate: "/api/generate",
      embeddings: "/api/embeddings",
      tags: "/api/tags",
    },
  },

  // Generation parameters
  generation: {
    temperature: 0.3, // Low temperature for consistency
    numPredict: 1000, // Max tokens to generate
    topK: 40, // Top-k sampling
    topP: 0.9, // Top-p sampling
    repeatPenalty: 1.1, // Penalty for repetition
  },

  // Pipeline stage configurations
  pipeline: {
    stages: {
      triage: {
        model: "pattern",
        targetEmails: 33797,
        expectedTime: 60, // < 1 minute in seconds (pattern matching only)
      },
      priority: {
        model: "primary",
        targetEmails: 1000, // Reduced from 5000 for practical CPU inference
        expectedTime: 12600, // ~3.5 hours in seconds (1000 emails × 45s)
      },
      critical: {
        model: "critical",
        fallbackModel: "primary",
        targetEmails: 100, // Reduced from 500 for practical CPU inference
        expectedTime: 7200, // ~2 hours in seconds (100 emails × 45-180s)
      },
    },
  },

  // Quality thresholds
  quality: {
    minAcceptableScore: 6.0,
    targetScore: 8.5,
    currentScores: {
      "llama3.2:3b": 6.56,
      "doomgrave/phi-4:14b-tools-Q3_K_S": 7.75, // Estimated
      pattern: 4.6,
    },
  },
};

// Helper function to get model configuration
export function getModelConfig(modelType: keyof typeof MODEL_CONFIG.models) {
  return MODEL_CONFIG.models[modelType];
}

// Helper function to get timeout for a model
export function getModelTimeout(modelType: keyof typeof MODEL_CONFIG.models) {
  return (
    MODEL_CONFIG.timeouts[modelType as keyof typeof MODEL_CONFIG.timeouts] ||
    MODEL_CONFIG?.timeouts?.primary
  );
}

// Helper function to get batch size for a model
export function getModelBatchSize(modelType: keyof typeof MODEL_CONFIG.models) {
  return (
    MODEL_CONFIG.batchSizes[
      modelType as keyof typeof MODEL_CONFIG.batchSizes
    ] || MODEL_CONFIG?.batchSizes?.primary
  );
}

// Helper function to check if we have enough memory for a model
export function canRunModel(modelName: string): boolean {
  const modelSize =
    MODEL_CONFIG?.memory?.modelSizes[
      modelName as keyof typeof MODEL_CONFIG.memory.modelSizes
    ] || 4 * 1024 * 1024 * 1024; // Default 4GB
  const availableMemory =
    MODEL_CONFIG?.memory?.maxMemoryUsage - MODEL_CONFIG?.memory?.reservedMemory;
  return modelSize <= availableMemory;
}

// Export type definitions
export type ModelType = keyof typeof MODEL_CONFIG.models;
export type PipelineStage = keyof typeof MODEL_CONFIG.pipeline.stages;
