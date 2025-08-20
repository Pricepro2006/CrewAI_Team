import { logger } from "../../../utils/logger.js";
import { LLMProviderManager } from "../../llm/LLMProviderManager.js";
import { getModelConfig, getModelTimeout, } from "../../../config/models.config.js";
export class BaseAgent {
    name;
    description;
    model;
    tools = new Map();
    capabilities = new Set();
    initialized = false;
    llm = null;
    timeout;
    ragSystem = null;
    ragEnabled = true; // Can be overridden by subclasses
    constructor(name, description, model = getModelConfig("primary")) {
        this.name = name;
        this.description = description;
        this.model = model;
        logger.info(`Initializing agent: ${name} with model: ${model}`, "AGENT");
        // Get timeout for this model
        this.timeout = getModelTimeout("primary");
        // LLM provider will be initialized in initialize() method
    }
    async executeWithTool(params) {
        const { tool, context, parameters, guidance } = params;
        try {
            if (!this.hasTool(tool.name)) {
                return {
                    success: false,
                    error: `Tool ${tool.name} not registered with this agent`,
                };
            }
            const result = await tool.execute(parameters);
            return {
                success: true,
                data: result,
                metadata: {
                    agent: this.name,
                    tool: tool.name,
                    timestamp: new Date().toISOString(),
                },
            };
        }
        catch (error) {
            return this.handleError(error);
        }
    }
    registerTool(tool) {
        this.tools.set(tool.name, tool);
        logger.debug(`Registered tool ${tool.name} with ${this.name}`, "AGENT");
    }
    getTools() {
        return Array.from(this.tools.values());
    }
    getTool(name) {
        return this.tools.get(name);
    }
    hasTool(name) {
        return this.tools.has(name);
    }
    hasCapability(capability) {
        return this.capabilities.has(capability);
    }
    async initialize() {
        if (this.initialized) {
            logger.debug(`Agent ${this.name} already initialized`, "AGENT");
            return;
        }
        logger.info(`Initializing agent ${this.name}`, "AGENT");
        // Initialize LLM provider using singleton manager
        try {
            this.llm = new LLMProviderManager();
            await this.llm.initialize();
            logger.debug(`LLM provider initialized successfully for ${this.name}`, "AGENT", {
                isUsingFallback: this.llm.isUsingFallback ? this.llm.isUsingFallback() : false,
                modelInfo: this.llm.getModelInfo()
            });
        }
        catch (error) {
            logger.warn(`LLM initialization failed for ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}. Continuing with fallback responses.`, "AGENT");
            // Create a fallback LLM that provides basic responses
            this.llm = this.createFallbackLLM();
        }
        // Register default tools first
        if (typeof this.registerDefaultTools === "function") {
            this.registerDefaultTools();
            logger.debug(`Registered default tools for ${this.name}`, "AGENT");
        }
        // Initialize any tools (if they have initialization method)
        for (const tool of this.tools.values()) {
            if ("initialize" in tool &&
                typeof tool.initialize === "function") {
                await tool.initialize();
            }
        }
        this.initialized = true;
        logger.info(`Agent ${this.name} initialized successfully with ${this.tools.size} tools`, "AGENT");
    }
    createFallbackLLM() {
        const name = this.name;
        return {
            async generate(prompt, options) {
                logger.warn(`Fallback LLM used for agent ${name}`, "AGENT");
                return {
                    response: "I apologize, but I'm experiencing technical difficulties with the AI models. Please try again later or contact support.",
                    model: "fallback",
                    timestamp: new Date().toISOString()
                };
            },
            async initialize() {
                // No-op for fallback
            },
            isReady() {
                return true; // Fallback is always ready
            },
            async cleanup() {
                // No-op for fallback
            },
            getModelInfo() {
                return {
                    model: "fallback",
                    contextSize: 0,
                    loaded: true,
                    processCount: 0
                };
            }
        };
    }
    async generateLLMResponse(prompt, options) {
        if (!this.llm) {
            throw new Error(`LLM not initialized for agent ${this.name}`);
        }
        try {
            return await this.llm.generate(prompt, options);
        }
        catch (error) {
            logger.error(`LLM generation failed for agent ${this.name}`, "AGENT", { error });
            throw error;
        }
    }
    handleError(error) {
        logger.error(`Error in agent ${this.name}: ${error.message}`, "AGENT", {
            error,
        });
        return {
            success: false,
            error: error.message,
            metadata: {
                agent: this.name,
                timestamp: new Date().toISOString(),
                errorType: error.name || "UnknownError",
            },
        };
    }
    addCapability(capability) {
        this.capabilities.add(capability);
    }
    /**
     * Set the RAG system for this agent
     * Called by MasterOrchestrator during agent initialization
     */
    setRAGSystem(ragSystem) {
        if (!this.ragEnabled) {
            logger.debug(`RAG system disabled for agent ${this.name}`, "AGENT");
            return;
        }
        this.ragSystem = ragSystem;
        logger.info(`RAG system integrated with agent ${this.name}`, "AGENT");
    }
    /**
     * Query the RAG system for relevant context
     * @param query The query to search for
     * @param options Search options
     * @returns Relevant context from RAG system
     */
    async queryRAG(query, options = {}) {
        if (!this.ragSystem || !this.ragEnabled) {
            logger.debug(`RAG system not available for agent ${this.name}`, "AGENT");
            return "";
        }
        try {
            const context = await this.ragSystem.getContextForPrompt(query, {
                limit: options.limit || 5,
                filter: {
                    ...options.filter,
                    // Add agent-specific filter to get relevant knowledge for this agent type
                    agentType: this.name,
                },
                includeMetadata: options.includeMetadata !== false,
                formatForLLM: options.formatForLLM !== false,
            });
            if (context) {
                logger.debug(`Retrieved RAG context for agent ${this.name}: ${context.length} characters`, "AGENT");
            }
            return context;
        }
        catch (error) {
            logger.error(`Failed to query RAG system for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, "AGENT");
            return "";
        }
    }
    /**
     * Search RAG system for specific documents
     * @param query Search query
     * @param limit Number of results
     * @returns Array of search results
     */
    async searchRAG(query, limit = 5) {
        if (!this.ragSystem || !this.ragEnabled) {
            return [];
        }
        try {
            return await this.ragSystem.search(query, limit);
        }
        catch (error) {
            logger.error(`RAG search failed for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, "AGENT");
            return [];
        }
    }
    /**
     * Index knowledge specific to this agent in the RAG system
     * @param documents Documents to index
     */
    async indexAgentKnowledge(documents) {
        if (!this.ragSystem || !this.ragEnabled) {
            return;
        }
        try {
            await this.ragSystem.indexAgentKnowledge(this.name, documents);
            logger.info(`Indexed ${documents.length} documents for agent ${this.name}`, "AGENT");
        }
        catch (error) {
            logger.error(`Failed to index knowledge for agent ${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`, "AGENT");
        }
    }
    /**
     * Generate LLM response with RAG context enhancement
     * @param prompt The prompt to send to LLM
     * @param options Generation options
     * @returns LLM response with optional RAG enhancement
     */
    async generateLLMResponseWithRAG(prompt, options) {
        const useRAG = options?.useRAG !== false && this.ragEnabled && this.ragSystem;
        let ragContext = "";
        if (useRAG) {
            // Use custom RAG query or extract from prompt
            const ragQuery = options?.ragQuery || prompt;
            ragContext = await this.queryRAG(ragQuery, { limit: options?.ragLimit || 5 });
        }
        // Enhance prompt with RAG context if available
        let enhancedPrompt = prompt;
        if (ragContext) {
            enhancedPrompt = `${ragContext}\n\n## Query\n${prompt}`;
            logger.debug(`Enhanced prompt with RAG context for agent ${this.name}`, "AGENT");
        }
        // Generate response using base method
        const response = await this.generateLLMResponse(enhancedPrompt, options);
        // Include context in response if requested
        if (options?.includeContext && ragContext) {
            return {
                ...response,
                context: ragContext,
            };
        }
        return response;
    }
}
