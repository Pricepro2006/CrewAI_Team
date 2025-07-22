import { logger } from "../../../utils/logger.js";
import { OllamaProvider } from "../../llm/OllamaProvider.js";
export class BaseAgent {
    constructor(name, description, model = 'qwen3:0.6b') {
        this.name = name;
        this.description = description;
        this.model = model;
        this.tools = new Map();
        this.capabilities = new Set();
        this.initialized = false;
        logger.info(`Initializing agent: ${name}`, 'AGENT');
        // Initialize LLM provider
        this.llm = new OllamaProvider({
            model: this.model,
            baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
        });
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
        logger.debug(`Registered tool ${tool.name} with ${this.name}`, 'AGENT');
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
            logger.debug(`Agent ${this.name} already initialized`, 'AGENT');
            return;
        }
        logger.info(`Initializing agent ${this.name}`, 'AGENT');
        // Initialize any tools (if they have initialization method)
        for (const tool of this.tools.values()) {
            if ('initialize' in tool && typeof tool.initialize === 'function') {
                await tool.initialize();
            }
        }
        this.initialized = true;
        logger.info(`Agent ${this.name} initialized successfully`, 'AGENT');
    }
    handleError(error) {
        logger.error(`Error in agent ${this.name}: ${error.message}`, 'AGENT', { error });
        return {
            success: false,
            error: error.message,
            metadata: {
                agent: this.name,
                timestamp: new Date().toISOString(),
                errorType: error.name || 'UnknownError',
            },
        };
    }
    addCapability(capability) {
        this.capabilities.add(capability);
    }
}
