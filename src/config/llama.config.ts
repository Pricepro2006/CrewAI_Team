/**
 * Llama.cpp Configuration
 * Primary LLM configuration for the CrewAI Team system
 */

export interface LlamaConfig {
  executablePath: string;
  defaultModel: string;
  contextSize: number;
  threads: number;
  timeout: number;
  maxRetries: number;
  models: {
    [key: string]: {
      path: string;
      description: string;
      contextSize: number;
      temperature: number;
      gpuLayers?: number;
    };
  };
}

const llamaConfig: LlamaConfig = {
  executablePath: process.env.LLAMA_CPP_PATH || "/usr/local/bin/llama-cli",
  defaultModel: "llama3.2-3b", // Primary model for analysis
  contextSize: parseInt(process.env.LLAMA_CONTEXT_SIZE || "8192"),
  threads: parseInt(process.env.LLAMA_THREADS || "8"),
  timeout: parseInt(process.env.LLAMA_TIMEOUT || "60000"),
  maxRetries: parseInt(process.env.LLAMA_MAX_RETRIES || "3"),
  models: {
    // Primary models
    "llama3.2-3b": {
      path: process.env.LLAMA_MODEL_PATH || "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf",
      description: "Meta Llama 3.2 3B - Primary model for analysis",
      contextSize: 8192,
      temperature: 0.3,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0")
    },
    "mistral-7b": {
      path: process.env.MISTRAL_MODEL_PATH || "./models/mistral-7b-instruct-v0.2.Q4_K_M.gguf",
      description: "Mistral 7B Instruct - High-quality analysis model",
      contextSize: 8192,
      temperature: 0.3,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0")
    },
    "phi3-mini": {
      path: process.env.PHI3_MODEL_PATH || "./models/phi-3-mini-4k-instruct-q4.gguf",
      description: "Microsoft Phi-3 Mini - Lightweight model",
      contextSize: 4096,
      temperature: 0.7,
      gpuLayers: parseInt(process.env.LLAMA_GPU_LAYERS || "0")
    }
  }
};

export default llamaConfig;