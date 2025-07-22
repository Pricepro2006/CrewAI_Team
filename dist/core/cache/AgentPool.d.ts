/**
 * Agent Pool Implementation
 *
 * Manages a pool of pre-initialized AI agents to reduce response time
 * by avoiding the overhead of agent initialization on each request.
 */
import type { BaseAgent } from "../agents/base/BaseAgent";
type AgentType = "email" | "business" | "customer" | "workflow" | "master";
interface PoolConfig {
    maxAgentsPerType?: number;
    initializeOnStartup?: boolean;
    healthCheckInterval?: number;
    idleTimeout?: number;
}
export interface AgentPoolStats {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    requestsServed: number;
    avgInitTime: number;
    agentsByType: Record<AgentType, number>;
}
export declare class AgentPool {
    private pools;
    private config;
    private stats;
    private healthCheckTimer;
    constructor(config?: PoolConfig);
    /**
     * Get an agent from the pool or create new one if needed
     */
    getAgent(type: AgentType): Promise<BaseAgent>;
    /**
     * Return an agent to the pool
     */
    returnAgent(agent: BaseAgent, type: AgentType): Promise<void>;
    /**
     * Pre-warm agents in the pool
     */
    preWarmPool(): Promise<void>;
    /**
     * Get pool statistics
     */
    getStats(): AgentPoolStats;
    /**
     * Clear all pools and cleanup agents
     */
    clearPools(): Promise<void>;
    /**
     * Shutdown the agent pool
     */
    shutdown(): Promise<void>;
    /**
     * Initialize pools for all agent types
     */
    private initializePools;
    /**
     * Get agent from specific pool
     */
    private getFromPool;
    /**
     * Create new agent of specified type
     */
    private createAgent;
    /**
     * Pre-warm agents for specific type
     */
    private preWarmAgentType;
    /**
     * Cleanup individual agent
     */
    private cleanupAgent;
    /**
     * Start periodic health check
     */
    private startHealthCheck;
    /**
     * Perform health check and cleanup idle agents
     */
    private performHealthCheck;
    /**
     * Update pool statistics
     */
    private updateStats;
    /**
     * Update average initialization time
     */
    private updateAvgInitTime;
}
/**
 * Get global agent pool instance
 */
export declare function getAgentPool(): AgentPool;
export {};
//# sourceMappingURL=AgentPool.d.ts.map