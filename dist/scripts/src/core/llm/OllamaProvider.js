import axios from 'axios';
import { EventEmitter } from 'events';
import { sanitizeLLMOutput } from "../../utils/output-sanitizer.js";
export class OllamaProvider extends EventEmitter {
    constructor(config) {
        super();
        this.isInitialized = false;
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
            timeout: 300000, // 5 minutes timeout for large models
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
    async initialize() {
        if (this.isInitialized)
            return;
        try {
            // Check if Ollama is running
            await this.client.get('/api/tags', { timeout: 5000 });
            // Check if the model is available
            const models = await this.listModels();
            const modelExists = models.some(m => m.name === this.config.model);
            if (!modelExists) {
                throw new Error(`Model ${this.config.model} not found. Please pull it first.`);
            }
            this.isInitialized = true;
            this.emit('initialized');
        }
        catch (error) {
            const err = error;
            if (err.code === 'ECONNREFUSED') {
                throw new Error('Ollama is not running. Please start Ollama first.');
            }
            throw error;
        }
    }
    async generate(prompt, options) {
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
            keep_alive: '15m', // Keep model loaded for 15 minutes
            options: {
                temperature: requestOptions.temperature,
                top_p: requestOptions.topP,
                top_k: requestOptions.topK,
                num_predict: requestOptions.maxTokens,
                // Include log probs if requested
                logits_all: requestOptions.extractLogProbs || false
            },
            format: requestOptions.format,
            context: requestOptions.context || this.context
        };
        try {
            const response = await this.client.post('/api/generate', payload, {
                timeout: 300000 // 5 minutes timeout for large model generation
            });
            // Store context for conversation continuity
            if (response.data.context) {
                this.context = response.data.context;
            }
            const sanitizedResponse = sanitizeLLMOutput(response.data.response);
            this.emit('generation', {
                prompt,
                response: sanitizedResponse.content,
                duration: response.data.total_duration,
                tokens: response.data.tokens,
                logprobs: response.data.token_logprobs
            });
            return sanitizedResponse.content;
        }
        catch (error) {
            this.emit('error', error);
            // If timeout or connection error, provide a fallback response
            if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED') {
                console.warn(`Ollama timeout/connection error for model ${this.config.model}. Providing fallback response.`);
                return this.generateFallbackResponse(prompt, options);
            }
            throw error;
        }
    }
    /**
     * Generate text with log probabilities for confidence scoring
     * This method returns both the generated text and token-level confidence data
     */
    async generateWithLogProbs(prompt, options) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        const requestOptions = {
            ...this.config,
            ...options,
            extractLogProbs: true
        };
        const payload = {
            model: this.config.model,
            prompt: this.buildPrompt(prompt, requestOptions.systemPrompt),
            stream: false,
            keep_alive: '15m',
            options: {
                temperature: requestOptions.temperature || this.config.temperature,
                top_p: requestOptions.topP || this.config.topP,
                top_k: requestOptions.topK || this.config.topK,
                num_predict: requestOptions.maxTokens || this.config.maxTokens,
                // Request log probabilities
                logits_all: true,
                num_ctx: 8192 // Ensure sufficient context for Phi-2
            },
            format: requestOptions.format,
            context: requestOptions.context || this.context
        };
        try {
            const response = await this.client.post('/api/generate', payload, {
                timeout: 300000
            });
            // Store context for conversation continuity
            if (response.data.context) {
                this.context = response.data.context;
            }
            // Extract log probabilities if available
            let logProbs;
            if (response.data.token_logprobs) {
                logProbs = response.data.token_logprobs;
            }
            else if (response.data.logprobs && response.data.logprobs.length > 0) {
                // Take the top log prob for each token
                logProbs = response.data.logprobs.map(probs => probs[0] || -10);
            }
            const result = {
                text: sanitizeLLMOutput(response.data.response).content,
                tokens: response.data.tokens,
                logProbs: logProbs,
                metadata: {
                    model: response.data.model,
                    duration: response.data.total_duration || 0,
                    tokenCount: response.data.eval_count || 0,
                    tokensPerSecond: response.data.eval_count && response.data.eval_duration
                        ? (response.data.eval_count / (response.data.eval_duration / 1000000000))
                        : undefined
                }
            };
            this.emit('generation_with_logprobs', result);
            return result;
        }
        catch (error) {
            this.emit('error', error);
            // Fallback if log probs not supported
            if (error.response?.status === 400 && error.response?.data?.error?.includes('logits')) {
                console.warn('Log probabilities not supported by this Ollama version. Falling back to standard generation.');
                // Fall back to regular generation
                const text = await this.generate(prompt, options);
                return {
                    text: sanitizeLLMOutput(text).content,
                    tokens: undefined,
                    logProbs: undefined,
                    metadata: {
                        model: this.config.model,
                        duration: 0,
                        tokenCount: text.split(/\s+/).length // Rough estimate
                    }
                };
            }
            throw error;
        }
    }
    generateFallbackResponse(prompt, options) {
        // Provide a basic fallback response based on the prompt
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('plan') || lowerPrompt.includes('steps')) {
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
                        dependencies: []
                    }
                ]
            });
        }
        if (lowerPrompt.includes('hello') || lowerPrompt.includes('test')) {
            return "Hello! I'm experiencing technical difficulties with the AI models but I'm still here to help. The system is working on resolving the issue.";
        }
        return "I apologize, but I'm experiencing technical difficulties with the AI models. Please try again in a moment, or contact support if the issue persists.";
    }
    async generateStream(prompt, options, onChunk) {
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
            keep_alive: '15m', // Keep model loaded for 15 minutes
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
            const response = await this.client.post('/api/generate', payload, {
                responseType: 'stream',
                timeout: 300000 // 5 minutes timeout for streaming
            });
            let fullResponse = '';
            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk) => {
                    try {
                        const lines = chunk.toString().split('\n').filter(line => line.trim());
                        for (const line of lines) {
                            const parsed = JSON.parse(line);
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
                    }
                    catch (error) {
                        reject(error);
                    }
                });
                response.data.on('error', reject);
            });
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async embed(text) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            const response = await this.client.post('/api/embeddings', {
                model: this.config.model,
                prompt: text
            }, {
                timeout: 300000 // 5 minutes timeout for embeddings
            });
            return response.data.embedding;
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async listModels() {
        try {
            const response = await this.client.get('/api/tags', { timeout: 5000 });
            return response.data.models || [];
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    async pullModel(modelName) {
        try {
            await this.client.post('/api/pull', {
                name: modelName,
                stream: false
            }, {
                timeout: 600000 // 10 minutes for model pulling
            });
        }
        catch (error) {
            this.emit('error', error);
            throw error;
        }
    }
    buildPrompt(prompt, systemPrompt) {
        if (systemPrompt || this.config.systemPrompt) {
            return `${systemPrompt || this.config.systemPrompt}\n\n${prompt}`;
        }
        return prompt;
    }
    clearContext() {
        this.context = undefined;
    }
    getContext() {
        return this.context;
    }
    setModel(model) {
        this.config.model = model;
        this.clearContext();
    }
    getConfig() {
        return { ...this.config };
    }
}
