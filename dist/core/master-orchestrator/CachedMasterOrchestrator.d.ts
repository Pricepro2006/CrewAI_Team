/**
 * Cached Master Orchestrator
 *
 * Enhanced version of MasterOrchestrator with integrated caching layers
 * for improved performance through query caching and agent pooling.
 */
import { MasterOrchestrator } from "./MasterOrchestrator";
import { type AgentPoolStats } from "../cache/AgentPool";
import type { Query, ExecutionResult, MasterOrchestratorConfig } from "./types";
export declare class CachedMasterOrchestrator extends MasterOrchestrator {
    private queryCache;
    private agentPool;
    private cachedPerfMonitor;
    constructor(config: MasterOrchestratorConfig);
    /**
     * Process query with caching optimization
     */
    processQuery(query: Query): Promise<ExecutionResult>;
    /**
     * Get orchestrator performance statistics
     */
    getPerformanceStats(): Promise<{
        cache: {
            enabled: boolean;
            hits: number;
            misses: number;
            sets: number;
            errors: number;
            hitRate: number;
        };
        agentPool: AgentPoolStats;
        orchestrator: any;
        performance: {
            cacheHitRate: number;
            avgAgentInitTime: number;
            totalAgentsPooled: number;
            activeAgents: number;
        };
    }>;
    /**
     * Clear all caches
     */
    clearCaches(): Promise<void>;
    /**
     * Pre-warm system for better initial performance
     */
    preWarm(): Promise<void>;
    /**
     * Health check for cached components
     */
    healthCheck(): Promise<{
        status: "healthy" | "degraded" | "unhealthy";
        components: Record<string, any>;
    }>;
    /**
     * Shutdown cached orchestrator
     */
    shutdown(): Promise<void>;
    /**
     * Generate cache key for query
     */
    private generateCacheKey;
    /**
     * Calculate appropriate TTL for cached result
     */
    private calculateCacheTTL;
    /**
     * Get system statistics if parent method exists
     */
    private getStats;
}
export declare function createCachedOrchestrator(config: MasterOrchestratorConfig): CachedMasterOrchestrator;
//# sourceMappingURL=CachedMasterOrchestrator.d.ts.map