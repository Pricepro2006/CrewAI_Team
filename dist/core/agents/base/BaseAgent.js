import { BaseTool } from '../../tools/base/BaseTool';
import { logger } from '../../../utils/logger';
export class BaseAgent {
    name;
    description;
    model;
    tools = new Map();
    capabilities = new Set();
    initialized = false;
    constructor(name, description, model = 'qwen3:0.6b') {
        this.name = name;
        this.description = description;
        this.model = model;
        logger.info(`Initializing agent: ${name}`, 'AGENT');
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
            const result = await tool.execute(parameters, context);
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
        // Initialize any tools
        for (const tool of this.tools.values()) {
            if (tool.initialize) {
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
//# sourceMappingURL=BaseAgent.js.map