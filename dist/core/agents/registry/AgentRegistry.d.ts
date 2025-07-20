import type { BaseAgent, AgentFactory, AgentPoolConfig, AgentStatus } from "../base/AgentTypes";
export declare class AgentRegistry {
    private activeAgents;
    private agentPool;
    private config;
    private agentFactories;
    constructor(config?: Partial<AgentPoolConfig>);
    private registerDefaultAgents;
    initialize(): Promise<void>;
    private preloadAgent;
    getAgent(agentType: string): Promise<BaseAgent>;
    releaseAgent(agentType: string, agent: BaseAgent): void;
    private setupIdleTimeout;
    registerAgentType(type: string, factory: AgentFactory): void;
    getRegisteredTypes(): string[];
    getActiveAgents(): AgentStatus[];
    getPoolStatus(): Record<string, number>;
    clearPool(): Promise<void>;
    shutdown(): Promise<void>;
    getConfig(): AgentPoolConfig;
    updateConfig(updates: Partial<AgentPoolConfig>): void;
}
//# sourceMappingURL=AgentRegistry.d.ts.map