/**
 * HTTP-based Llama.cpp Provider - Connects to running llama-server
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import type { LlamaCppResponse, LlamaCppGenerateOptions } from './SafeLlamaCppProvider.js';

export class HttpLlamaProvider {
  private client: AxiosInstance;
  private baseUrl: string;
  private modelPath: string;
  private isInitialized: boolean = false;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.modelPath = './models/llama-3.2-3b-instruct.Q4_K_M.gguf';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const response = await this.client.get('/v1/models');
      logger.info(`Connected to llama-server at ${this.baseUrl}`, 'HTTP_LLAMA', {
        models: response.data.models?.length || 0
      });
      this.isInitialized = true;
    } catch (error) {
      logger.error(`Failed to connect to llama-server at ${this.baseUrl}`, 'HTTP_LLAMA', { error });
      throw new Error(`Cannot connect to llama-server at ${this.baseUrl}`);
    }
  }

  async generate(
    prompt: string,
    options: LlamaCppGenerateOptions = {}
  ): Promise<LlamaCppResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const requestBody = {
        model: this.modelPath,
        prompt: prompt,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
        top_p: options.topP || 0.9,
        top_k: options.topK || 40,
        repeat_penalty: options.repeatPenalty || 1.1,
        stop: options.stopWords || [],
        stream: false,
      };

      // Simplified logging to avoid PIIRedactor issues
      console.log(`[HTTP_LLAMA] Sending request: prompt length=${prompt.length}, max_tokens=${requestBody.max_tokens}`);

      const response = await this.client.post('/v1/completions', requestBody);

      const text = response.data.choices?.[0]?.text || '';
      const tokensGenerated = response.data.usage?.completion_tokens || 0;
      const totalTokens = response.data.usage?.total_tokens || 0;

      // Simplified logging to avoid PIIRedactor issues
      console.log(`[HTTP_LLAMA] Received response: length=${text.length}, tokens=${tokensGenerated}`);

      return {
        text: text.trim(),
        tokensGenerated,
        totalTokens,
        timings: {
          promptMs: response.data.usage?.prompt_eval_duration || 0,
          generationMs: response.data.usage?.total_duration || 0,
          tokensPerSecond: tokensGenerated > 0 && response.data.usage?.total_duration > 0
            ? (tokensGenerated / (response.data.usage.total_duration / 1000))
            : 0,
        },
      };
    } catch (error) {
      logger.error('Failed to generate text', 'HTTP_LLAMA', { error });
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Llama server is not running. Please start it with: ./llama.cpp/build/bin/llama-server -m ./models/llama-3.2-3b-instruct.Q4_K_M.gguf --host 0.0.0.0 --port 11434');
        }
        throw new Error(`HTTP request failed: ${error.message}`);
      }
      
      throw error;
    }
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async cleanup(): Promise<void> {
    // No cleanup needed for HTTP client
    this.isInitialized = false;
  }

  getModelInfo() {
    return {
      model: this.modelPath,
      contextSize: 8192,
      loaded: this.isInitialized,
      processCount: 0, // Not applicable for HTTP
    };
  }
}