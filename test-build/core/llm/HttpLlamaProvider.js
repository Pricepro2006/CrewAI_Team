/**
 * HTTP-based Llama.cpp Provider - Connects to running llama-server
 */
import axios from 'axios';
import { logger } from '../../utils/logger.js';
export class HttpLlamaProvider {
    client;
    baseUrl;
    modelName;
    isInitialized = false;
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
        this.modelName = 'llama-3.2-3b-instruct';
        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 30000, // 30 second timeout
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    async initialize() {
        try {
            // Test connection
            const response = await this.client.get('/v1/models');
            logger.info(`Connected to llama-server at ${this.baseUrl}`, 'HTTP_LLAMA', {
                models: response.data.models?.length || 0
            });
            this.isInitialized = true;
        }
        catch (error) {
            logger.error(`Failed to connect to llama-server at ${this.baseUrl}`, 'HTTP_LLAMA', { error });
            throw new Error(`Cannot connect to llama-server at ${this.baseUrl}`);
        }
    }
    async generate(prompt, options = {}) {
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
                        content: "You are a helpful AI assistant."
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
        }
        catch (error) {
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
    isReady() {
        return this.isInitialized;
    }
    async cleanup() {
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
