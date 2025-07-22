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
  baseUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  defaultModel: process.env.OLLAMA_DEFAULT_MODEL || "granite3.3:2b",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || "3"),
  models: {
    "phi3:mini": {
      name: "phi3:mini",
      description: "Microsoft Phi-3 Mini model",
      contextWindow: 8192,
      temperature: 0.7,
    },
    "qwen3:0.6b": {
      name: "qwen3:0.6b",
      description: "Qwen 3 0.6B model",
      contextWindow: 8192,
      temperature: 0.7,
    },
    "llama3.1:8b": {
      name: "llama3.1:8b",
      description: "Meta Llama 3.1 8B model",
      contextWindow: 8192,
      temperature: 0.7,
    },
    "granite3.3:2b": {
      name: "granite3.3:2b",
      description: "IBM Granite 3.3 2B model - Optimized for accuracy",
      contextWindow: 8192,
      temperature: 0.7,
    },
  },
};

export default ollamaConfig;
