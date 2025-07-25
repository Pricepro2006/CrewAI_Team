/**
 * Agent Pool Implementation
 * 
 * Manages a pool of pre-initialized AI agents to reduce response time
 * by avoiding the overhead of agent initialization on each request.
 */

import type { BaseAgent } from '../agents/base/BaseAgent';
import { EmailAnalysisAgent } from '../agents/specialized/EmailAnalysisAgent';
import { logger } from '../../utils/logger';

type AgentType = 'email' | 'business' | 'customer' | 'workflow' | 'master';

interface PoolConfig {
  maxAgentsPerType?: number;
  initializeOnStartup?: boolean;
  healthCheckInterval?: number;
  idleTimeout?: number;
}

interface AgentPoolStats {
  totalAgents: number;
  activeAgents: number;
  idleAgents: number;
  requestsServed: number;
  avgInitTime: number;
  agentsByType: Record<AgentType, number>;
}

interface PooledAgent {
  agent: BaseAgent;
  type: AgentType;
  createdAt: Date;
  lastUsed: Date;
  usageCount: number;
  isActive: boolean;
}

export class AgentPool {
  private pools: Map<AgentType, PooledAgent[]> = new Map();
  private config: Required<PoolConfig>;
  private stats: AgentPoolStats;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor(config: PoolConfig = {}) {
    this.config = {
      maxAgentsPerType: config.maxAgentsPerType || 3,
      initializeOnStartup: config.initializeOnStartup || true,
      healthCheckInterval: config.healthCheckInterval || 300000, // 5 minutes
      idleTimeout: config.idleTimeout || 1800000 // 30 minutes
    };

    this.stats = {
      totalAgents: 0,
      activeAgents: 0,
      idleAgents: 0,
      requestsServed: 0,
      avgInitTime: 0,
      agentsByType: {
        email: 0,
        business: 0,
        customer: 0,
        workflow: 0,
        master: 0
      }
    };

    // Initialize pools
    this.initializePools();

    // Start health check if configured
    if (this.config.healthCheckInterval > 0) {
      this.startHealthCheck();
    }

    logger.info('Agent pool initialized', 'AGENT_POOL', {
      maxAgentsPerType: this.config.maxAgentsPerType,
      initializeOnStartup: this.config.initializeOnStartup
    });
  }

  /**
   * Get an agent from the pool or create new one if needed
   */
  async getAgent(type: AgentType): Promise<BaseAgent> {
    const startTime = Date.now();
    let agent: BaseAgent;

    try {
      // Try to get agent from pool
      const pooledAgent = await this.getFromPool(type);
      
      if (pooledAgent) {
        agent = pooledAgent.agent;
        pooledAgent.lastUsed = new Date();
        pooledAgent.usageCount++;
        pooledAgent.isActive = true;
        
        logger.debug('Agent retrieved from pool', 'AGENT_POOL', {
          type,
          usageCount: pooledAgent.usageCount,
          poolSize: this.pools.get(type)?.length || 0
        });
      } else {
        // Create new agent if pool is empty
        agent = await this.createAgent(type);
        
        logger.debug('Agent created (pool empty)', 'AGENT_POOL', {
          type,
          initTime: Date.now() - startTime
        });
      }

      this.stats.requestsServed++;
      this.updateStats();

      return agent;

    } catch (error) {
      logger.error('Failed to get agent from pool', 'AGENT_POOL', error);
      // Fallback: create agent directly
      return await this.createAgent(type);
    }
  }

  /**
   * Return an agent to the pool
   */
  async returnAgent(agent: BaseAgent, type: AgentType): Promise<void> {
    const pool = this.pools.get(type) || [];
    
    // Find the pooled agent
    const pooledAgent = pool.find(p => p.agent === agent);
    
    if (pooledAgent) {
      pooledAgent.isActive = false;
      pooledAgent.lastUsed = new Date();
      
      logger.debug('Agent returned to pool', 'AGENT_POOL', {
        type,
        usageCount: pooledAgent.usageCount,
        poolSize: pool.length
      });
    } else {
      // Agent not from pool, add it if pool has space
      if (pool.length < this.config.maxAgentsPerType) {
        const newPooledAgent: PooledAgent = {
          agent,
          type,
          createdAt: new Date(),
          lastUsed: new Date(),
          usageCount: 1,
          isActive: false
        };
        
        pool.push(newPooledAgent);
        this.pools.set(type, pool);
        
        logger.debug('Agent added to pool', 'AGENT_POOL', {
          type,
          poolSize: pool.length
        });
      } else {
        // Pool is full, cleanup the agent
        await this.cleanupAgent(agent);
        
        logger.debug('Agent cleaned up (pool full)', 'AGENT_POOL', {
          type,
          poolSize: pool.length
        });
      }
    }

    this.updateStats();
  }

  /**
   * Pre-warm agents in the pool
   */
  async preWarmPool(): Promise<void> {
    const agentTypes: AgentType[] = ['email', 'business', 'customer', 'workflow'];
    const warmupPromises: Promise<void>[] = [];

    for (const type of agentTypes) {
      warmupPromises.push(this.preWarmAgentType(type));
    }

    try {
      await Promise.all(warmupPromises);
      logger.info('Agent pool pre-warming completed', 'AGENT_POOL', {
        totalAgents: this.stats.totalAgents
      });
    } catch (error) {
      logger.error('Agent pool pre-warming failed', 'AGENT_POOL', error);
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): AgentPoolStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Clear all pools and cleanup agents
   */
  async clearPools(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    for (const [type, pool] of this.pools.entries()) {
      for (const pooledAgent of pool) {
        cleanupPromises.push(this.cleanupAgent(pooledAgent.agent));
      }
      pool.length = 0;
    }

    try {
      await Promise.all(cleanupPromises);
      this.pools.clear();
      this.updateStats();
      
      logger.info('All agent pools cleared', 'AGENT_POOL');
    } catch (error) {
      logger.error('Failed to clear agent pools', 'AGENT_POOL', error);
    }
  }

  /**
   * Shutdown the agent pool
   */
  async shutdown(): Promise<void> {
    // Stop health check
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    // Clear all pools
    await this.clearPools();

    logger.info('Agent pool shutdown completed', 'AGENT_POOL');
  }

  /**
   * Initialize pools for all agent types
   */
  private initializePools(): void {
    const agentTypes: AgentType[] = ['email', 'business', 'customer', 'workflow', 'master'];
    
    for (const type of agentTypes) {
      this.pools.set(type, []);
    }

    // Pre-warm if configured
    if (this.config.initializeOnStartup) {
      // Don't await - let it run in background
      this.preWarmPool().catch(error => {
        logger.error('Background pre-warming failed', 'AGENT_POOL', error);
      });
    }
  }

  /**
   * Get agent from specific pool
   */
  private async getFromPool(type: AgentType): Promise<PooledAgent | null> {
    const pool = this.pools.get(type) || [];
    
    // Find first available (non-active) agent
    const availableAgent = pool.find(pooled => !pooled.isActive);
    
    if (availableAgent) {
      return availableAgent;
    }

    // If no available agents and pool not full, create new one
    if (pool.length < this.config.maxAgentsPerType) {
      const newAgent = await this.createAgent(type);
      const pooledAgent: PooledAgent = {
        agent: newAgent,
        type,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 0,
        isActive: false
      };
      
      pool.push(pooledAgent);
      this.pools.set(type, pool);
      
      return pooledAgent;
    }

    // Pool is full and no agents available
    return null;
  }

  /**
   * Create new agent of specified type
   */
  private async createAgent(type: AgentType): Promise<BaseAgent> {
    const startTime = Date.now();

    try {
      let agent: BaseAgent;

      switch (type) {
        case 'email':
          agent = new EmailAnalysisAgent();
          break;
        case 'business':
        case 'customer':
        case 'workflow':
        case 'master':
          // For now, use EmailAnalysisAgent as a base
          // TODO: Implement other agent types
          agent = new EmailAnalysisAgent();
          break;
        default:
          throw new Error(`Unknown agent type: ${type}`);
      }

      // Initialize the agent
      await agent.initialize?.();

      const initTime = Date.now() - startTime;
      this.updateAvgInitTime(initTime);

      logger.debug('Agent created and initialized', 'AGENT_POOL', {
        type,
        initTime
      });

      return agent;

    } catch (error) {
      logger.error('Failed to create agent', 'AGENT_POOL', error);
      throw error;
    }
  }

  /**
   * Pre-warm agents for specific type
   */
  private async preWarmAgentType(type: AgentType): Promise<void> {
    const targetCount = Math.min(2, this.config.maxAgentsPerType); // Pre-warm 2 agents per type
    const promises: Promise<BaseAgent>[] = [];

    for (let i = 0; i < targetCount; i++) {
      promises.push(this.createAgent(type));
    }

    try {
      const agents = await Promise.all(promises);
      const pool: PooledAgent[] = [];

      for (const agent of agents) {
        pool.push({
          agent,
          type,
          createdAt: new Date(),
          lastUsed: new Date(),
          usageCount: 0,
          isActive: false
        });
      }

      this.pools.set(type, pool);
      
      logger.debug('Agent type pre-warmed', 'AGENT_POOL', {
        type,
        count: agents.length
      });

    } catch (error) {
      logger.error('Failed to pre-warm agent type', 'AGENT_POOL', { type, error });
    }
  }

  /**
   * Cleanup individual agent
   */
  private async cleanupAgent(agent: BaseAgent): Promise<void> {
    try {
      // Call cleanup method if available
      if (agent.cleanup && typeof agent.cleanup === 'function') {
        await agent.cleanup();
      }
    } catch (error) {
      logger.warn('Agent cleanup failed', 'AGENT_POOL', error);
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    logger.debug('Agent pool health check started', 'AGENT_POOL', {
      interval: this.config.healthCheckInterval
    });
  }

  /**
   * Perform health check and cleanup idle agents
   */
  private performHealthCheck(): void {
    const now = Date.now();
    let cleanedUp = 0;

    for (const [type, pool] of this.pools.entries()) {
      const toRemove: number[] = [];

      for (let i = 0; i < pool.length; i++) {
        const pooledAgent = pool[i];
        if (!pooledAgent) continue; // Type guard for possibly undefined
        
        const idleTime = now - pooledAgent.lastUsed.getTime();

        // Mark idle agents for removal
        if (!pooledAgent.isActive && idleTime > this.config.idleTimeout) {
          toRemove.push(i);
        }
      }

      // Remove idle agents (in reverse order to maintain indices)
      for (let i = toRemove.length - 1; i >= 0; i--) {
        const index = toRemove[i];
        if (index === undefined) continue; // Type guard for possibly undefined
        
        const pooledAgent = pool[index];
        if (!pooledAgent) continue; // Type guard for possibly undefined
        
        // Cleanup agent
        this.cleanupAgent(pooledAgent.agent).catch(error => {
          logger.warn('Health check cleanup failed', 'AGENT_POOL', error);
        });

        pool.splice(index, 1);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) {
      logger.debug('Health check completed', 'AGENT_POOL', {
        agentsCleanedUp: cleanedUp,
        remainingAgents: this.stats.totalAgents - cleanedUp
      });
    }

    this.updateStats();
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    this.stats.totalAgents = 0;
    this.stats.activeAgents = 0;
    this.stats.idleAgents = 0;
    
    // Reset type counts
    for (const type of Object.keys(this.stats.agentsByType) as AgentType[]) {
      this.stats.agentsByType[type] = 0;
    }

    // Count agents by pool
    for (const [type, pool] of this.pools.entries()) {
      this.stats.agentsByType[type] = pool.length;
      this.stats.totalAgents += pool.length;

      for (const pooledAgent of pool) {
        if (pooledAgent.isActive) {
          this.stats.activeAgents++;
        } else {
          this.stats.idleAgents++;
        }
      }
    }
  }

  /**
   * Update average initialization time
   */
  private updateAvgInitTime(newTime: number): void {
    // Simple moving average calculation
    const alpha = 0.1; // Smoothing factor
    this.stats.avgInitTime = this.stats.avgInitTime * (1 - alpha) + newTime * alpha;
  }
}

// Singleton instance
let agentPool: AgentPool | null = null;

/**
 * Get global agent pool instance
 */
export function getAgentPool(): AgentPool {
  if (!agentPool) {
    agentPool = new AgentPool();
  }
  return agentPool;
}