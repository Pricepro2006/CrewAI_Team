import { BaseAgent, } from "../base/AgentTypes";
import { ResearchAgent } from "../specialized/ResearchAgent";
import { CodeAgent } from "../specialized/CodeAgent";
import { DataAnalysisAgent } from "../specialized/DataAnalysisAgent";
import { WriterAgent } from "../specialized/WriterAgent";
import { ToolExecutorAgent } from "../specialized/ToolExecutorAgent";
import { EmailAnalysisAgent } from "../specialized/EmailAnalysisAgent";
export class AgentRegistry {
    activeAgents;
    agentPool;
    config;
    agentFactories;
    constructor(config) {
        this.activeAgents = new Map();
        this.agentPool = new Map();
        this.config = {
            maxAgents: 10,
            idleTimeout: 300000, // 5 minutes
            preloadAgents: ["ResearchAgent", "CodeAgent"],
            ...config,
        };
        this.agentFactories = new Map();
        this.registerDefaultAgents();
    }
    registerDefaultAgents() {
        // Register agent factories
        this.agentFactories.set("ResearchAgent", () => new ResearchAgent());
        this.agentFactories.set("CodeAgent", () => new CodeAgent());
        this.agentFactories.set("DataAnalysisAgent", () => new DataAnalysisAgent());
        this.agentFactories.set("WriterAgent", () => new WriterAgent());
        this.agentFactories.set("ToolExecutorAgent", () => new ToolExecutorAgent());
        this.agentFactories.set("EmailAnalysisAgent", () => new EmailAnalysisAgent());
    }
    async initialize() {
        // Preload specified agents
        if (this.config.preloadAgents) {
            for (const agentType of this.config.preloadAgents) {
                await this.preloadAgent(agentType);
            }
        }
    }
    async preloadAgent(agentType) {
        const factory = this.agentFactories.get(agentType);
        if (!factory) {
            console.warn(`Agent factory not found for type: ${agentType}`);
            return;
        }
        try {
            const agent = factory();
            await agent.initialize();
            if (!this.agentPool.has(agentType)) {
                this.agentPool.set(agentType, []);
            }
            this.agentPool.get(agentType).push(agent);
        }
        catch (error) {
            console.error(`Failed to preload agent ${agentType}:`, error);
        }
    }
    async getAgent(agentType) {
        // Check if agent is already active
        const activeKey = `${agentType}-${Date.now()}`;
        const activeAgent = this.activeAgents.get(agentType);
        if (activeAgent) {
            return activeAgent;
        }
        // Check agent pool
        const pooledAgents = this.agentPool.get(agentType);
        if (pooledAgents && pooledAgents.length > 0) {
            const agent = pooledAgents.pop();
            this.activeAgents.set(activeKey, agent);
            return agent;
        }
        // Create new agent
        const factory = this.agentFactories.get(agentType);
        if (!factory) {
            throw new Error(`Agent type not registered: ${agentType}`);
        }
        const agent = factory();
        await agent.initialize();
        this.activeAgents.set(activeKey, agent);
        // Set up idle timeout
        this.setupIdleTimeout(activeKey, agentType);
        return agent;
    }
    releaseAgent(agentType, agent) {
        // Find and remove from active agents
        let keyToRemove;
        for (const [key, activeAgent] of this.activeAgents.entries()) {
            if (activeAgent === agent && key.startsWith(agentType)) {
                keyToRemove = key;
                break;
            }
        }
        if (keyToRemove) {
            this.activeAgents.delete(keyToRemove);
            // Return to pool if not at capacity
            const pool = this.agentPool.get(agentType) || [];
            if (pool.length <
                Math.ceil(this.config.maxAgents / this.agentFactories.size)) {
                pool.push(agent);
                this.agentPool.set(agentType, pool);
            }
        }
    }
    setupIdleTimeout(key, agentType) {
        setTimeout(() => {
            const agent = this.activeAgents.get(key);
            if (agent) {
                this.releaseAgent(agentType, agent);
            }
        }, this.config.idleTimeout);
    }
    registerAgentType(type, factory) {
        this.agentFactories.set(type, factory);
    }
    getRegisteredTypes() {
        return Array.from(this.agentFactories.keys());
    }
    getActiveAgents() {
        const statuses = [];
        for (const [key] of this.activeAgents.entries()) {
            const [type] = key.split("-");
            statuses.push({
                id: key,
                type: type || "unknown",
                status: "busy",
                currentTask: "Active",
                lastActivity: new Date(),
                tasksCompleted: 0,
                errors: 0,
            });
        }
        return statuses;
    }
    getPoolStatus() {
        const status = {};
        for (const [type, agents] of this.agentPool.entries()) {
            status[type] = agents.length;
        }
        return status;
    }
    async clearPool() {
        // Clear all pooled agents
        this.agentPool.clear();
        // Clear active agents
        this.activeAgents.clear();
    }
    async shutdown() {
        await this.clearPool();
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        // Update configuration
        this.config = {
            ...this.config,
            ...updates,
        };
        // If preloadAgents changed, preload new agents
        if (updates.preloadAgents) {
            const currentPreloaded = new Set(Object.keys(this.agentPool));
            const newPreload = new Set(updates.preloadAgents);
            // Preload new agents that weren't preloaded before
            for (const agentType of newPreload) {
                if (!currentPreloaded.has(agentType)) {
                    this.preloadAgent(agentType).catch(console.error);
                }
            }
        }
    }
}
//# sourceMappingURL=AgentRegistry.js.map