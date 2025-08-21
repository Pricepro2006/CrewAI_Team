// Note: This file maintains the name ollama.config.ts for backward compatibility
/**
// but actually configures llama.cpp on port 8081
 * LLM Configuration (llama.cpp)
 * Aligned with three-stage pipeline architecture from models?.config?.ts
 */

export interface OllamaConfig {
  baseUrl: string;
  defaultModel: string;
  timeout: number;
  maxRetries: number;
  models: {
    [key: string]: {
      name: string;
      description: string;
      contextWindow: number;
      temperature: number;
    };
  };
}

const ollamaConfig: OllamaConfig = {
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:8081", // Updated to llama.cpp port
  defaultModel: process.env.OLLAMA_DEFAULT_MODEL || "llama3.2:3b", // Stage 2 primary model
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || "45000"), // Increased for CPU inference
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || "3"),
  models: {
    // Stage 2: Primary analysis model
    "llama3.2:3b": {
      name: "llama3.2:3b",
      description: "Meta Llama 3.2 3B - Primary model for Stage 2 analysis",
      contextWindow: 8192,
      temperature: 0.3 // Low temperature for consistency
    },
    // Stage 3: Critical analysis model
    "doomgrave/phi-4:14b-tools-Q3_K_S": {
      name: "doomgrave/phi-4:14b-tools-Q3_K_S",
      description: "Phi-4 14B Tools (Q3_K_S) - Critical analysis for Stage 3",
      contextWindow: 16384,
      temperature: 0.3
    },
    // Legacy models for backward compatibility (to be phased out)
    "phi3:mini": {
      name: "phi3:mini",
      description: "[DEPRECATED] Microsoft Phi-3 Mini model",
      contextWindow: 8192,
      temperature: 0.7
    },
    "qwen3:0.6b": {
      name: "qwen3:0.6b",
      description: "[DEPRECATED] Qwen 3 0.6B model",
      contextWindow: 8192,
      temperature: 0.7
    },
    // Models from model-selection?.config?.ts (for potential integration)
    "granite3.3:2b": {
      name: "granite3.3:2b",
      description: "IBM Granite 3.3 2B - Alternative for complex queries",
      contextWindow: 8192,
      temperature: 0.7
    },
    "granite3.3:8b": {
      name: "granite3.3:8b",
      description: "IBM Granite 3.3 8B - High quality alternative",
      contextWindow: 8192,
      temperature: 0.6
    },
    "qwen3:1.7b": {
      name: "qwen3:1.7b",
      description: "Qwen 3 1.7B - Balanced alternative",
      contextWindow: 8192,
      temperature: 0.5
    }
  }
};

export default ollamaConfig;