import { Ollama } from "ollama";
import { EventEmitter } from "events";

export interface OllamaJSConfig {
  model: string;
  host?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: "json" | string;
  stream?: boolean;
  keepAlive?: string;
}

export interface OllamaJSResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  eval_count?: number;
}

export class OllamaJSProvider extends EventEmitter {
  private client: Ollama;
  private config: OllamaJSConfig;
  private isInitialized: boolean = false;

  constructor(config: OllamaJSConfig) {
    super();
    this.config = {
      host: "http://localhost:11434",
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      stream: false,
      keepAlive: "15m", // Default 15 minutes keep alive
      ...config,
    };

    this.client = new Ollama({
      host: this.config.host,
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if the model is available
      const models = await this.listModels();
      const modelExists = models.some((m) => m.name === this.config.model);

      if (!modelExists) {
        throw new Error(
          `Model ${this.config.model} not found. Please pull it first.`,
        );
      }

      this.isInitialized = true;
      this.emit("initialized");
    } catch (error) {
      const err = error as any;
      if (err.code === "ECONNREFUSED") {
        throw new Error("Ollama is not running. Please start Ollama first.");
      }
      throw error;
    }
  }

  async generate(
    prompt: string,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxTokens?: number;
      systemPrompt?: string;
      format?: "json" | string;
    },
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestOptions = {
      ...this.config,
      ...options,
    };

    try {
      const response = await this.client.generate({
        model: this.config.model,
        prompt: this.buildPrompt(prompt, requestOptions.systemPrompt),
        stream: false,
        keep_alive: this.config.keepAlive,
        options: {
          temperature: requestOptions.temperature,
          top_p: requestOptions.topP,
          top_k: requestOptions.topK,
          num_predict: requestOptions.maxTokens,
        },
        format: requestOptions.format,
      });

      this.emit("generation", {
        prompt,
        response: response.response,
        duration: response.total_duration,
      });

      return response.response;
    } catch (error: any) {
      this.emit("error", error);

      // If timeout or connection error, provide a fallback response
      if (error.code === "ECONNABORTED" || error.code === "ECONNREFUSED") {
        console.warn(
          `Ollama error for model ${this.config.model}. Providing fallback response.`,
        );
        return this.generateFallbackResponse(prompt, options);
      }

      throw error;
    }
  }

  async generateStream(
    prompt: string,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxTokens?: number;
      systemPrompt?: string;
      format?: "json" | string;
    },
    onChunk?: (chunk: string) => void,
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestOptions = {
      ...this.config,
      ...options,
    };

    try {
      let fullResponse = "";

      const response = await this.client.generate({
        model: this.config.model,
        prompt: this.buildPrompt(prompt, requestOptions.systemPrompt),
        stream: true,
        keep_alive: this.config.keepAlive,
        options: {
          temperature: requestOptions.temperature,
          top_p: requestOptions.topP,
          top_k: requestOptions.topK,
          num_predict: requestOptions.maxTokens,
        },
        format: requestOptions.format,
      });

      for await (const part of response) {
        if (part.response) {
          fullResponse += part.response;
          if (onChunk) {
            onChunk(part.response);
          }
        }
      }

      return fullResponse;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async chat(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
      temperature?: number;
      topP?: number;
      topK?: number;
      maxTokens?: number;
      format?: "json" | string;
      stream?: boolean;
    },
  ): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestOptions = {
      ...this.config,
      ...options,
    };

    try {
      let response;

      if (requestOptions.stream) {
        response = await this.client.chat({
          model: this.config.model,
          messages,
          stream: true,
          keep_alive: this.config.keepAlive,
          options: {
            temperature: requestOptions.temperature,
            top_p: requestOptions.topP,
            top_k: requestOptions.topK,
            num_predict: requestOptions.maxTokens,
          },
          format: requestOptions.format,
        });
      } else {
        response = await this.client.chat({
          model: this.config.model,
          messages,
          stream: false,
          keep_alive: this.config.keepAlive,
          options: {
            temperature: requestOptions.temperature,
            top_p: requestOptions.topP,
            top_k: requestOptions.topK,
            num_predict: requestOptions.maxTokens,
          },
          format: requestOptions.format,
        });
      }

      return response;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.embeddings({
        model: this.config.model,
        prompt: text,
      });

      return response.embedding;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  async listModels(): Promise<any[]> {
    try {
      const response = await this.client.list();
      return response.models || [];
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  private buildPrompt(prompt: string, systemPrompt?: string): string {
    if (systemPrompt || this.config.systemPrompt) {
      return `${systemPrompt || this.config.systemPrompt}\n\n${prompt}`;
    }
    return prompt;
  }

  private generateFallbackResponse(prompt: string, options?: any): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes("plan") || lowerPrompt.includes("steps")) {
      return JSON.stringify({
        steps: [
          {
            id: "fallback-step-1",
            task: "Process the user query",
            description: "Process the user query with available information",
            agentType: "ResearchAgent",
            requiresTool: false,
            ragQuery: prompt.substring(0, 100),
            expectedOutput: "Response to user query",
            dependencies: [],
          },
        ],
      });
    }

    if (lowerPrompt.includes("hello") || lowerPrompt.includes("test")) {
      return "Hello! I'm experiencing technical difficulties with the AI models but I'm still here to help. The system is working on resolving the issue.";
    }

    return "I apologize, but I'm experiencing technical difficulties with the AI models. Please try again in a moment, or contact support if the issue persists.";
  }

  setModel(model: string): void {
    this.config.model = model;
  }

  getConfig(): OllamaJSConfig {
    return { ...this.config };
  }
}
