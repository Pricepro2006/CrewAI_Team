import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

export interface OllamaConfig {
  model: string;
  baseUrl?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: 'json' | string;
  stream?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_duration?: number;
  eval_duration?: number;
  eval_count?: number;
}

export interface OllamaGenerateOptions {
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  systemPrompt?: string;
  format?: 'json' | string;
  context?: number[];
}

export class OllamaProvider extends EventEmitter {
  private client: AxiosInstance;
  private config: OllamaConfig;
  private isInitialized: boolean = false;
  private context?: number[] | undefined;

  constructor(config: OllamaConfig) {
    super();
    this.config = {
      baseUrl: 'http://localhost:11434',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      stream: false,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl || 'http://localhost:11434',
      timeout: 300000, // 5 minutes timeout for long generations
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if Ollama is running
      await this.client.get('/api/tags');
      
      // Check if the model is available
      const models = await this.listModels();
      const modelExists = models.some(m => m.name === this.config.model);
      
      if (!modelExists) {
        throw new Error(`Model ${this.config.model} not found. Please pull it first.`);
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      const err = error as any;
      if (err.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Please start Ollama first.');
      }
      throw error;
    }
  }

  async generate(
    prompt: string, 
    options?: OllamaGenerateOptions
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestOptions = {
      ...this.config,
      ...options
    };

    const payload = {
      model: this.config.model,
      prompt: this.buildPrompt(prompt, requestOptions.systemPrompt),
      stream: false,
      options: {
        temperature: requestOptions.temperature,
        top_p: requestOptions.topP,
        top_k: requestOptions.topK,
        num_predict: requestOptions.maxTokens
      },
      format: requestOptions.format,
      context: requestOptions.context || this.context
    };

    try {
      const response = await this.client.post<OllamaResponse>(
        '/api/generate',
        payload
      );

      // Store context for conversation continuity
      if (response.data.context) {
        this.context = response.data.context;
      }

      this.emit('generation', {
        prompt,
        response: response.data.response,
        duration: response.data.total_duration
      });

      return response.data.response;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async generateStream(
    prompt: string,
    options?: OllamaGenerateOptions,
    onChunk?: (chunk: string) => void
  ): Promise<string> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const requestOptions = {
      ...this.config,
      ...options
    };

    const payload = {
      model: this.config.model,
      prompt: this.buildPrompt(prompt, requestOptions.systemPrompt),
      stream: true,
      options: {
        temperature: requestOptions.temperature,
        top_p: requestOptions.topP,
        top_k: requestOptions.topK,
        num_predict: requestOptions.maxTokens
      },
      format: requestOptions.format,
      context: requestOptions.context || this.context
    };

    try {
      const response = await this.client.post(
        '/api/generate',
        payload,
        {
          responseType: 'stream'
        }
      );

      let fullResponse = '';
      
      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk: Buffer) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            
            for (const line of lines) {
              const parsed = JSON.parse(line) as OllamaResponse;
              
              if (parsed.response) {
                fullResponse += parsed.response;
                if (onChunk) {
                  onChunk(parsed.response);
                }
              }
              
              if (parsed.done) {
                if (parsed.context) {
                  this.context = parsed.context;
                }
                resolve(fullResponse);
              }
            }
          } catch (error) {
            reject(error);
          }
        });

        response.data.on('error', reject);
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const response = await this.client.post('/api/embeddings', {
        model: this.config.model,
        prompt: text
      });

      return response.data.embedding;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.get('/api/tags');
      return response.data.models || [];
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async pullModel(modelName: string): Promise<void> {
    try {
      await this.client.post('/api/pull', {
        name: modelName,
        stream: false
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  private buildPrompt(prompt: string, systemPrompt?: string): string {
    if (systemPrompt || this.config.systemPrompt) {
      return `${systemPrompt || this.config.systemPrompt}\n\n${prompt}`;
    }
    return prompt;
  }

  clearContext(): void {
    this.context = undefined;
  }

  getContext(): number[] | undefined {
    return this.context;
  }

  setModel(model: string): void {
    this.config.model = model;
    this.clearContext();
  }

  getConfig(): OllamaConfig {
    return { ...this.config };
  }
}

interface ModelInfo {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}
