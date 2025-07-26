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
  defaultModel: process.env.OLLAMA_DEFAULT_MODEL || "llama3.2:3b",
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || "30000"),
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || "3"),
  models: {
    "llama3.2:3b": {
      name: "llama3.2:3b",
      description: "Stage 2 Pipeline Model - proven in production with 33,797 emails",
      contextWindow: 8192,
      temperature: 0.3
    },
    "doomgrave/phi-4:14b-tools-Q3_K_S": {
      name: "doomgrave/phi-4:14b-tools-Q3_K_S",
      description: "Stage 3 Critical Analysis - for top 100 most critical emails",
      contextWindow: 8192,
      temperature: 0.3
    },
    "qwen3:0.6b": {
      name: "qwen3:0.6b",
      description: "Qwen 3 0.6B model",
      contextWindow: 8192,
      temperature: 0.7
    },
    "llama3.1:8b": {
      name: "llama3.1:8b", 
      description: "Meta Llama 3.1 8B model",
      contextWindow: 8192,
      temperature: 0.7
    }
  }
};

export default ollamaConfig;