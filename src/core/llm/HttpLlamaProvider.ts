/**
 * HTTP-based Llama.cpp Provider - Connects to running llama-server
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger.js';
import type { LlamaCppResponse, LlamaCppGenerateOptions } from './SafeLlamaCppProvider.js';

import type { LLMProviderInterface } from './LLMProviderFactory.js';

export class HttpLlamaProvider implements LLMProviderInterface {
  private client: AxiosInstance;
  private baseUrl: string;
  private modelName: string;
  private isInitialized: boolean = false;

  constructor(baseUrl: string = 'http://localhost:8081') {
    this.baseUrl = baseUrl;
    this.modelName = 'llama-3.2-3b-instruct';
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for complex prompts
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
    options: any = {}
  ): Promise<{ response: string; [key: string]: any }> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Use chat completions endpoint with proper message format
      const requestBody = {
        model: "llama-3.2-3b-instruct",
        messages: [
          {
            role: "system",
            content: options.systemPrompt || "You are an AI assistant in the CrewAI Team system, a multi-agent framework with specialized agents for research, coding, data analysis, writing, and tool execution. Be helpful, specific, and informative about the system's capabilities when asked."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2048,
        top_p: options.topP || 0.9,
        stream: false,
      };

      // Simplified logging to avoid PIIRedactor issues
      console.log(`[HTTP_LLAMA] Sending request: prompt length=${prompt.length}, max_tokens=${requestBody.max_tokens}`);

      const response = await this.client.post('/v1/chat/completions', requestBody);

      // Extract content from chat completion response format
      const text = response.data.choices?.[0]?.message?.content || '';
      const tokensGenerated = response.data.usage?.completion_tokens || 0;
      const totalTokens = response.data.usage?.total_tokens || 0;

      // Simplified logging to avoid PIIRedactor issues
      console.log(`[HTTP_LLAMA] Received response: length=${text.length}, tokens=${tokensGenerated}`);

      return {
        model: "llama-3.2-3b-instruct",
        created_at: new Date().toISOString(),
        response: text.trim(),
        done: true,
        tokensGenerated,
        totalDuration: response.data.usage?.total_duration || 0,
        tokensPerSecond: tokensGenerated > 0 && response.data.usage?.total_duration > 0
          ? (tokensGenerated / (response.data.usage.total_duration / 1000))
          : 0,
      };
    } catch (error) {
      // Enhanced error logging
      if (axios.isAxiosError(error)) {
        logger.error('HTTP request failed', 'HTTP_LLAMA', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method
        });
        
        if (error.code === 'ECONNREFUSED') {
          throw new Error('Llama server is not running. Please start it with: ./llama.cpp/build/bin/llama-server -m ./models/llama-3.2-3b-instruct.Q4_K_M.gguf --host 0.0.0.0 --port 8081');
        }
        
        // Include response data in error message if available
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
        throw new Error(`HTTP request failed: ${errorMessage} (status: ${error.response?.status})`);
      }
      
      logger.error('Failed to generate text', 'HTTP_LLAMA', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
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
      model: this.modelName,
      contextSize: 8192,
      loaded: this.isInitialized,
      processCount: 0, // Not applicable for HTTP
    };
  }
}