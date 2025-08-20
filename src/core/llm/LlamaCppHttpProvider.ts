/**
 * LlamaCppHttpProvider - Enhanced HTTP provider for llama.cpp server
 * Integrates with llama-cpp-optimized.config.ts for configuration
 * Connects to llama-server on port 8081 (avoiding WebSocket conflict on 8080)
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../../utils/logger.js';
import { getOptimizedConfig, type LlamaCppOptimizedConfig } from '../../config/llama-cpp-optimized.config.js';
import { llamaCppService } from '../../services/llama-cpp.service.js';
import { 
  SecurityValidator, 
  ResourceLimiter, 
  SecurityAuditLogger,
  GenerateOptionsSchema,
  SECURITY_LIMITS 
} from '../../config/llama-cpp-security.config.js';
import type { LlamaCppResponse, LlamaCppGenerateOptions } from './SafeLlamaCppProvider.js';
import type { LLMProvider } from './LLMProviderManager.js';

export interface LlamaCppHttpResponse extends LlamaCppResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  tokensGenerated?: number;
  totalDuration?: number;
  tokensPerSecond?: number;
}

export interface LlamaCppRequestContext {
  clientId?: string;  // Unique client identifier (user ID, session ID, or IP)
  ip?: string;        // Client IP address for fallback identification
  userId?: string;    // Authenticated user ID if available
  sessionId?: string; // Session identifier for tracking
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  top_k?: number;
  repeat_penalty?: number;
  stream?: boolean;
  seed?: number;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    total_duration?: number;
  };
}

export class LlamaCppHttpProvider implements LLMProvider {
  private client: AxiosInstance;
  private baseUrl: string;
  private config: LlamaCppOptimizedConfig | null = null;
  private isInitialized: boolean = false;
  private currentModel: string = 'llama-3.2-3b';
  private serverStarted: boolean = false;
  private processCount: number = 0;

  constructor(baseUrl: string = 'http://localhost:8081') {
    // SECURITY: Validate URL to ensure it's localhost only
    const url = new URL(baseUrl);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      throw new Error('Security: Only localhost connections are allowed');
    }
    if (url.port !== '8081') {
      throw new Error('Security: Only port 8081 is allowed');
    }
    
    this.baseUrl = baseUrl;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60 second timeout for larger models
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize the provider and optionally start the server
   */
  public async initialize(): Promise<void> {
    try {
      // Load optimized configuration
      this.config = await getOptimizedConfig();
      
      // Try to connect to existing server
      await this.testConnection();
      
    } catch (error) {
      // If connection fails, try to start the server
      logger.warn('llama-server not running, attempting to start it', 'LLAMA_CPP_HTTP');
      
      try {
        await this.startServer();
        // Wait a bit for server to fully initialize
        await new Promise(resolve => setTimeout(resolve, 3000));
        await this.testConnection();
      } catch (startError) {
        logger.error('Failed to start llama-server', 'LLAMA_CPP_HTTP', { error: startError });
        throw new Error(`Cannot connect to or start llama-server at ${this.baseUrl}`);
      }
    }
  }

  /**
   * Test connection to the server
   */
  private async testConnection(): Promise<void> {
    try {
      // Try OpenAI-compatible endpoint first
      const response = await this.client.get('/v1/models');
      
      logger.info(`Connected to llama-server at ${this.baseUrl}`, 'LLAMA_CPP_HTTP', {
        models: response.data.data?.length || 0,
        endpoint: 'OpenAI-compatible'
      });
      
      this.isInitialized = true;
    } catch (error) {
      // Fallback to llama.cpp native endpoint
      try {
        const healthResponse = await this.client.get('/health');
        
        logger.info(`Connected to llama-server at ${this.baseUrl}`, 'LLAMA_CPP_HTTP', {
          status: healthResponse.data.status || 'ok',
          endpoint: 'llama.cpp native'
        });
        
        this.isInitialized = true;
      } catch (fallbackError) {
        throw new Error(`Cannot connect to llama-server at ${this.baseUrl}`);
      }
    }
  }

  /**
   * Start the llama-server using the service
   */
  private async startServer(): Promise<void> {
    if (this.serverStarted) {
      return;
    }

    try {
      // Use the llama-cpp service to start the server on port 8081
      await llamaCppService.startServer(this.currentModel, 8081);
      this.serverStarted = true;
      
      logger.info('Started llama-server on port 8081', 'LLAMA_CPP_HTTP');
    } catch (error) {
      logger.error('Failed to start llama-server', 'LLAMA_CPP_HTTP', { error });
      throw error;
    }
  }

  /**
   * Generate text using the llama-server
   */
  public async generate(
    prompt: string,
    options: LlamaCppGenerateOptions & { context?: LlamaCppRequestContext } = {}
  ): Promise<LlamaCppHttpResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // SECURITY: Extract and validate context for client identification
    const context = options.context || {};
    delete options.context; // Remove context from options before validation
    
    // SECURITY: Build unique client identifier with fallback hierarchy
    // Priority: userId > sessionId > ip > 'anonymous'
    const clientId = this.generateClientId(context);
    
    // SECURITY: Input sanitization MUST happen BEFORE rate limiting
    // This prevents bypassing rate limits with malformed input
    const sanitizedPrompt = SecurityValidator.sanitizeText(prompt, SECURITY_LIMITS.MAX_PROMPT_LENGTH);
    
    // SECURITY: Validate options BEFORE rate limiting
    // Prevents DOS through invalid option spam
    let validatedOptions: LlamaCppGenerateOptions;
    try {
      validatedOptions = GenerateOptionsSchema.parse(options);
    } catch (error) {
      SecurityAuditLogger.log('error', 'Invalid options provided', { 
        error,
        clientId,
        ip: context.ip 
      });
      throw new Error('Invalid generation options');
    }
    
    // SECURITY: Rate limiting with proper client identification
    if (!SecurityValidator.checkRateLimit(clientId)) {
      SecurityAuditLogger.log('warn', 'Rate limit exceeded', { 
        clientId,
        userId: context.userId,
        ip: context.ip,
        sessionId: context.sessionId
      });
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    
    // SECURITY: Resource limiting
    const estimatedMemoryGB = 1; // Estimate based on model size
    if (!(await ResourceLimiter.checkResources(estimatedMemoryGB))) {
      SecurityAuditLogger.log('warn', 'Resource limit exceeded', { 
        estimatedMemoryGB,
        clientId 
      });
      throw new Error('Server is at capacity. Please try again later.');
    }
    
    ResourceLimiter.acquireResources(estimatedMemoryGB);
    this.processCount++;

    try {
      // Get model configuration
      const modelConfig = this.config?.models[this.currentModel];
      
      // Build request for OpenAI-compatible chat endpoint
      const requestBody: ChatCompletionRequest = {
        model: this.currentModel,
        messages: [
          {
            role: 'system',
            content: validatedOptions.systemPrompt || 'You are a helpful AI assistant specializing in business intelligence and data analysis.'
          },
          {
            role: 'user',
            content: sanitizedPrompt
          }
        ],
        temperature: validatedOptions.temperature ?? modelConfig?.temperature ?? 0.7,
        max_tokens: validatedOptions.maxTokens ?? this.config?.maxTokens ?? 2048,
        top_p: validatedOptions.topP ?? this.config?.topP ?? 0.9,
        top_k: validatedOptions.topK ?? this.config?.topK ?? 40,
        repeat_penalty: validatedOptions.repeatPenalty ?? this.config?.repeatPenalty ?? 1.1,
        stream: false,
        seed: validatedOptions.seed ?? this.config?.seed ?? -1
      };

      logger.debug('Sending request to llama-server', 'LLAMA_CPP_HTTP', {
        promptLength: prompt.length,
        maxTokens: requestBody.max_tokens,
        temperature: requestBody.temperature
      });

      const startTime = Date.now();
      const response = await this.client.post<ChatCompletionResponse>('/v1/chat/completions', requestBody);
      const duration = Date.now() - startTime;

      // Extract response data
      const text = response.data.choices?.[0]?.message?.content || '';
      const tokensGenerated = response.data.usage?.completion_tokens || 0;
      const totalTokens = response.data.usage?.total_tokens || 0;
      const tokensPerSecond = tokensGenerated > 0 && duration > 0
        ? (tokensGenerated / (duration / 1000))
        : 0;

      logger.debug('Received response from llama-server', 'LLAMA_CPP_HTTP', {
        responseLength: text.length,
        tokensGenerated,
        duration,
        tokensPerSecond: tokensPerSecond.toFixed(2)
      });

      this.processCount--;
      ResourceLimiter.releaseResources(estimatedMemoryGB);
      
      // SECURITY: Log successful generation with client context
      SecurityAuditLogger.log('info', 'Text generation completed', {
        model: this.currentModel,
        promptLength: sanitizedPrompt.length,
        responseLength: text.length,
        duration,
        clientId,
        userId: context.userId,
        ip: context.ip
      });

      return {
        model: this.currentModel,
        created_at: new Date().toISOString(),
        response: text.trim(),
        done: true,
        tokensGenerated,
        totalDuration: duration,
        tokensPerSecond
      };

    } catch (error) {
      this.processCount--;
      ResourceLimiter.releaseResources(estimatedMemoryGB);
      
      // SECURITY: Log error
      SecurityAuditLogger.log('error', 'Text generation failed', { error });
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.code === 'ECONNREFUSED') {
          // Try to restart the server
          this.isInitialized = false;
          this.serverStarted = false;
          
          logger.warn('llama-server connection lost, attempting to restart', 'LLAMA_CPP_HTTP');
          
          try {
            await this.initialize();
            // Retry the request with original options including context
            return this.generate(prompt, { ...validatedOptions, context });
          } catch (restartError) {
            throw new Error('llama-server is not running. Please start it manually with: ./llama.cpp/build/bin/llama-server -m ./models/llama-3.2-3b-instruct.Q4_K_M.gguf --host 0.0.0.0 --port 8081');
          }
        }
        
        if (axiosError.response?.status === 503) {
          throw new Error('llama-server is busy or model is loading. Please wait and try again.');
        }
        
        throw new Error(`HTTP request failed: ${axiosError.message}`);
      }
      
      logger.error('Failed to generate text', 'LLAMA_CPP_HTTP', { error });
      throw error;
    }
  }

  /**
   * Check if the provider is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    if (this.serverStarted) {
      try {
        await llamaCppService.stopServer();
        this.serverStarted = false;
      } catch (error) {
        logger.warn('Failed to stop llama-server', 'LLAMA_CPP_HTTP', { error });
      }
    }
    
    this.isInitialized = false;
    this.processCount = 0;
  }

  /**
   * Generate unique client identifier from context
   * Priority: userId > sessionId > ip > 'anonymous'
   */
  private generateClientId(context: LlamaCppRequestContext): string {
    // Prefer authenticated user ID for most accurate rate limiting
    if (context.userId) {
      return `user:${context.userId}`;
    }
    
    // Fall back to session ID for anonymous but tracked users
    if (context.sessionId) {
      return `session:${context.sessionId}`;
    }
    
    // Use IP address as last resort for identification
    if (context.ip) {
      // Normalize IPv6 addresses for consistent rate limiting
      const normalizedIp = this.normalizeIpAddress(context.ip);
      return `ip:${normalizedIp}`;
    }
    
    // Anonymous fallback - shared rate limit pool
    // Log this as it may indicate misconfiguration
    logger.warn('No client identification available, using anonymous pool', 'LLAMA_CPP_HTTP');
    return 'anonymous';
  }
  
  /**
   * Normalize IP addresses for consistent identification
   * Handles IPv4, IPv6, and IPv4-mapped IPv6 addresses
   */
  private normalizeIpAddress(ip: string): string {
    // Handle IPv6 localhost variations first
    if (ip === '::1' || ip === '0:0:0:0:0:0:0:1' || ip === '::') {
      return '127.0.0.1';
    }
    
    // Handle IPv4-mapped IPv6 (::ffff:192.168.1.1)
    if (ip.startsWith('::ffff:')) {
      return ip.substring(7);
    }
    
    // For IPv6 addresses, check if it contains port (last colon followed by numbers)
    // IPv6 addresses in brackets like [::1]:3000
    if (ip.startsWith('[') && ip.includes(']:')) {
      const bracketEnd = ip.indexOf(']');
      return ip.substring(1, bracketEnd);
    }
    
    // For regular IPv4 addresses, remove port if present
    if (ip.includes('.') && ip.includes(':')) {
      const portIndex = ip.lastIndexOf(':');
      const possiblePort = ip.substring(portIndex + 1);
      // Check if what follows the colon is actually a port (all digits)
      if (/^\d+$/.test(possiblePort)) {
        return ip.substring(0, portIndex);
      }
    }
    
    return ip;
  }

  /**
   * Get model information
   */
  public getModelInfo(): {
    model: string;
    contextSize: number;
    loaded: boolean;
    processCount: number;
  } {
    const modelConfig = this.config?.models[this.currentModel];
    
    return {
      model: this.currentModel,
      contextSize: modelConfig?.contextWindow ?? 8192,
      loaded: this.isInitialized,
      processCount: this.processCount
    };
  }

  /**
   * Switch to a different model
   */
  public async switchModel(modelName: string): Promise<void> {
    if (!this.config?.models[modelName]) {
      throw new Error(`Model ${modelName} not found in configuration`);
    }

    // If server is running with a different model, restart it
    if (this.serverStarted && this.currentModel !== modelName) {
      logger.info(`Switching model from ${this.currentModel} to ${modelName}`, 'LLAMA_CPP_HTTP');
      
      await this.cleanup();
      this.currentModel = modelName;
      await this.initialize();
    } else {
      this.currentModel = modelName;
    }
  }

  /**
   * Get available models from configuration
   */
  public getAvailableModels(): string[] {
    return Object.keys(this.config?.models || {});
  }

  /**
   * Generate with streaming support (returns async generator)
   */
  public async *generateStream(
    prompt: string,
    options: LlamaCppGenerateOptions & { context?: LlamaCppRequestContext } = {}
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Extract context for client identification
    const context = options.context || {};
    const clientId = this.generateClientId(context);
    delete options.context;
    
    // SECURITY: Input validation and sanitization BEFORE rate limiting
    const sanitizedPrompt = SecurityValidator.sanitizeText(prompt, SECURITY_LIMITS.MAX_PROMPT_LENGTH);
    
    // SECURITY: Check rate limit with proper client ID
    if (!SecurityValidator.checkRateLimit(clientId)) {
      SecurityAuditLogger.log('warn', 'Rate limit exceeded for streaming', { 
        clientId,
        userId: context.userId,
        ip: context.ip 
      });
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    const modelConfig = this.config?.models[this.currentModel];
    
    const requestBody: ChatCompletionRequest = {
      model: this.currentModel,
      messages: [
        {
          role: 'system',
          content: options.systemPrompt || 'You are a helpful AI assistant.'
        },
        {
          role: 'user',
          content: sanitizedPrompt
        }
      ],
      temperature: options.temperature ?? modelConfig?.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? this.config?.maxTokens ?? 2048,
      stream: true // Enable streaming
    };

    try {
      const response = await this.client.post('/v1/chat/completions', requestBody, {
        responseType: 'stream'
      });

      let buffer = '';
      
      for await (const chunk of response.data) {
        buffer += chunk.toString();
        
        // Process complete SSE messages
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              
              if (content) {
                yield content;
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }
    } catch (error) {
      logger.error('Streaming generation failed', 'LLAMA_CPP_HTTP', { error });
      throw error;
    }
  }
}

// Export singleton instance for backward compatibility
export const llamaCppHttpProvider = new LlamaCppHttpProvider();

export default LlamaCppHttpProvider;