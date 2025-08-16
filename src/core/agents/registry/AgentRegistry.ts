import type {
  BaseAgent,
  AgentFactory,
  AgentPoolConfig,
  AgentStatus,
} from "../base/AgentTypes.js";
import { ResearchAgent } from "../specialized/ResearchAgent.js";
import { CodeAgent } from "../specialized/CodeAgent.js";
import { DataAnalysisAgent } from "../specialized/DataAnalysisAgent.js";
import { WriterAgent } from "../specialized/WriterAgent.js";
import { ToolExecutorAgent } from "../specialized/ToolExecutorAgent.js";
import { EmailAnalysisAgent } from "../specialized/EmailAnalysisAgent.js";
import type { RAGSystem } from "../../rag/RAGSystem.js";

export class AgentRegistry {
  private activeAgents: Map<string, BaseAgent>;
  private agentPool: Map<string, BaseAgent[]>;
  private config: AgentPoolConfig;
  private agentFactories: Map<string, AgentFactory>;
  private ragSystem: RAGSystem | null = null;

  constructor(config?: Partial<AgentPoolConfig>) {
    this.activeAgents = new Map();
    this.agentPool = new Map();
    this.config = {
      maxAgents: 10,
      idleTimeout: 300000, // 5 minutes
      preloadAgents: ["ResearchAgent", "CodeAgent", "EmailAnalysisAgent"],
      ...config,
    };

    this.agentFactories = new Map();
    this.registerDefaultAgents();
  }

  /**
   * Set the RAG system for all agents
   * This should be called by MasterOrchestrator after RAG initialization
   */
  setRAGSystem(ragSystem: RAGSystem): void {
    this.ragSystem = ragSystem;
    
    // Update all existing agents with RAG system
    for (const agent of this.activeAgents.values()) {
      if ('setRAGSystem' in agent && typeof (agent as any).setRAGSystem === 'function') {
        (agent as any).setRAGSystem(ragSystem);
      }
    }
    
    // Update pooled agents
    for (const agents of this.agentPool.values()) {
      for (const agent of agents) {
        if ('setRAGSystem' in agent && typeof (agent as any).setRAGSystem === 'function') {
          (agent as any).setRAGSystem(ragSystem);
        }
      }
    }
  }

  private registerDefaultAgents(): void {
    // Register agent factories
    this?.agentFactories?.set(
      "ResearchAgent",
      () => new ResearchAgent() as unknown as BaseAgent,
    );
    this?.agentFactories?.set(
      "CodeAgent",
      () => new CodeAgent() as unknown as BaseAgent,
    );
    this?.agentFactories?.set(
      "DataAnalysisAgent",
      () => new DataAnalysisAgent() as unknown as BaseAgent,
    );
    this?.agentFactories?.set(
      "WriterAgent",
      () => new WriterAgent() as unknown as BaseAgent,
    );
    this?.agentFactories?.set(
      "ToolExecutorAgent",
      () => new ToolExecutorAgent() as unknown as BaseAgent,
    );
    this?.agentFactories?.set(
      "EmailAnalysisAgent",
      () => new EmailAnalysisAgent() as unknown as BaseAgent,
    );
  }

  async initialize(): Promise<void> {
    // Preload specified agents
    if (this?.config?.preloadAgents) {
      for (const agentType of this?.config?.preloadAgents) {
        await this.preloadAgent(agentType);
      }
    }
  }

  private async preloadAgent(agentType: string): Promise<void> {
    const factory = this?.agentFactories?.get(agentType);
    if (!factory) {
      console.warn(`Agent factory not found for type: ${agentType}`);
      return;
    }

    try {
      const agent = factory();
      await agent.initialize();

      // Integrate RAG system if available
      if (this.ragSystem && 'setRAGSystem' in agent && typeof (agent as any).setRAGSystem === 'function') {
        (agent as any).setRAGSystem(this.ragSystem);
        console.log(`RAG system integrated with preloaded agent: ${agentType}`);
      }

      if (!this?.agentPool?.has(agentType)) {
        this?.agentPool?.set(agentType, []);
      }

      this?.agentPool?.get(agentType)!.push(agent);
    } catch (error) {
      console.error(`Failed to preload agent ${agentType}:`, error);
    }
  }

  async getAgent(agentType: string): Promise<BaseAgent> {
    // Check if agent is already active
    const activeKey = `${agentType}-${Date.now()}`;
    const activeAgent = this?.activeAgents?.get(agentType);
    if (activeAgent) {
      return activeAgent;
    }

    // Check agent pool
    const pooledAgents = this.agentPool?.get(agentType);
    if (pooledAgents && (pooledAgents?.length || 0) > 0) {
      const agent = pooledAgents.pop()!;
      this.activeAgents?.set(activeKey, agent);
      return agent;
    }

    // Create new agent
    const factory = this?.agentFactories?.get(agentType);
    if (!factory) {
      throw new Error(`Agent type not registered: ${agentType}`);
    }

    const agent = factory();
    await agent.initialize();
    
    // Integrate RAG system if available
    if (this.ragSystem && 'setRAGSystem' in agent && typeof (agent as any).setRAGSystem === 'function') {
      (agent as any).setRAGSystem(this.ragSystem);
      console.log(`RAG system integrated with new agent: ${agentType}`);
    }
    
    this?.activeAgents?.set(activeKey, agent);

    // Set up idle timeout
    this.setupIdleTimeout(activeKey, agentType);

    return agent;
  }

  releaseAgent(agentType: string, agent: BaseAgent): void {
    // Find and remove from active agents
    let keyToRemove: string | undefined;
    for (const [key, activeAgent] of this?.activeAgents?.entries()) {
      if (activeAgent === agent && key.startsWith(agentType)) {
        keyToRemove = key;
        break;
      }
    }

    if (keyToRemove) {
      this?.activeAgents?.delete(keyToRemove);

      // Return to pool if not at capacity
      const pool = this?.agentPool?.get(agentType) || [];
      if (
        pool?.length || 0 <
        Math.ceil(this?.config?.maxAgents / this?.agentFactories?.size)
      ) {
        pool.push(agent);
        this?.agentPool?.set(agentType, pool);
      }
    }
  }

  private setupIdleTimeout(key: string, agentType: string): void {
    setTimeout(() => {
      const agent = this?.activeAgents?.get(key);
      if (agent) {
        this.releaseAgent(agentType, agent);
      }
    }, this?.config?.idleTimeout);
  }

  registerAgentType(type: string, factory: AgentFactory): void {
    this?.agentFactories?.set(type, factory);
  }

  getRegisteredTypes(): string[] {
    return Array.from(this?.agentFactories?.keys());
  }

  getActiveAgents(): AgentStatus[] {
    const statuses: AgentStatus[] = [];

    for (const [key] of this?.activeAgents?.entries()) {
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

  getPoolStatus(): Record<string, number> {
    const status: Record<string, number> = {};

    for (const [type, agents] of this?.agentPool?.entries()) {
      status[type] = agents?.length || 0;
    }

    return status;
  }

  async clearPool(): Promise<void> {
    // Clear all pooled agents
    this?.agentPool?.clear();

    // Clear active agents
    this?.activeAgents?.clear();
  }

  async shutdown(): Promise<void> {
    await this.clearPool();
  }

  getConfig(): AgentPoolConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AgentPoolConfig>): void {
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
