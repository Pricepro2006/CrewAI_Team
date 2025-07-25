/**
 * Cached Master Orchestrator
 *
 * Enhanced version of MasterOrchestrator with integrated caching layers
 * for improved performance through query caching and agent pooling.
 */

import { MasterOrchestrator } from "./MasterOrchestrator";
import { getQueryCache } from "../cache/QueryCache";
import { getAgentPool, type AgentPoolStats } from "../cache/AgentPool";
import type { Query, ExecutionResult, MasterOrchestratorConfig } from "./types";
import { logger, createPerformanceMonitor } from "../../utils/logger";

export class CachedMasterOrchestrator extends MasterOrchestrator {
  private queryCache = getQueryCache();
  private agentPool = getAgentPool();
  private cachedPerfMonitor = createPerformanceMonitor(
    "CachedMasterOrchestrator",
  );

  constructor(config: MasterOrchestratorConfig) {
    super(config);
    logger.info(
      "Cached MasterOrchestrator initialized",
      "CACHED_ORCHESTRATOR",
      {
        cacheEnabled: this.queryCache.isEnabled(),
        poolEnabled: true,
      },
    );
  }

  /**
   * Process query with caching optimization
   */
  override async processQuery(query: Query): Promise<ExecutionResult> {
    const perf = this.cachedPerfMonitor.start("processQuery");
    const cacheKey = this.generateCacheKey(query);

    logger.info("Processing query with caching", "CACHED_ORCHESTRATOR", {
      query: query.text.substring(0, 100),
      conversationId: query.conversationId,
      cacheEnabled: this.queryCache.isEnabled(),
    });

    try {
      // Step 1: Check cache first
      if (this.queryCache.isEnabled()) {
        const cachedResult =
          await this.queryCache.get<ExecutionResult>(cacheKey);

        if (cachedResult) {
          logger.info(
            "Cache hit - returning cached result",
            "CACHED_ORCHESTRATOR",
            {
              cacheKey: cacheKey.substring(0, 20) + "...",
              processingTime: 0,
            },
          );

          // Update metadata to show it was cached
          cachedResult.metadata = {
            ...cachedResult.metadata,
            cached: true,
            cacheHit: true,
            processingTimeMs: 0,
          };

          perf.end();
          return cachedResult;
        }

        logger.debug("Cache miss - processing query", "CACHED_ORCHESTRATOR", {
          cacheKey: cacheKey.substring(0, 20) + "...",
        });
      }

      // Step 2: Process query using parent implementation
      const result = await super.processQuery(query);

      // Step 3: Cache the result if successful
      if (this.queryCache.isEnabled() && result.success) {
        const cacheTTL = this.calculateCacheTTL(query, result);
        await this.queryCache.set(cacheKey, result, cacheTTL);

        logger.debug("Result cached", "CACHED_ORCHESTRATOR", {
          cacheKey: cacheKey.substring(0, 20) + "...",
          ttl: cacheTTL,
        });
      }

      // Update metadata to show caching info
      result.metadata = {
        ...result.metadata,
        cached: false,
        cacheHit: false,
        cachingEnabled: this.queryCache.isEnabled(),
      };

      perf.end();
      return result;
    } catch (error) {
      perf.end();
      logger.error(
        "Cached query processing failed",
        "CACHED_ORCHESTRATOR",
        error as Record<string, any>,
      );
      throw error;
    }
  }

  /**
   * Get orchestrator performance statistics
   */
  async getPerformanceStats() {
    const [cacheStats, poolStats, baseStats] = await Promise.all([
      this.queryCache.getStats(),
      this.agentPool.getStats(),
      this.getStats(), // Call parent getStats if available
    ]);

    return {
      cache: {
        ...cacheStats,
        enabled: this.queryCache.isEnabled(),
      },
      agentPool: poolStats,
      orchestrator: baseStats || {
        queriesProcessed: 0,
        avgProcessingTime: 0,
        errorRate: 0,
      },
      performance: {
        cacheHitRate: cacheStats.hitRate,
        avgAgentInitTime: poolStats.avgInitTime,
        totalAgentsPooled: poolStats.totalAgents,
        activeAgents: poolStats.activeAgents,
      },
    };
  }

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    const promises: Promise<void>[] = [];

    if (this.queryCache.isEnabled()) {
      promises.push(this.queryCache.clearAll());
    }

    promises.push(this.agentPool.clearPools());

    await Promise.all(promises);

    logger.info("All caches cleared", "CACHED_ORCHESTRATOR");
  }

  /**
   * Pre-warm system for better initial performance
   */
  async preWarm(): Promise<void> {
    logger.info("Pre-warming cached orchestrator", "CACHED_ORCHESTRATOR");

    try {
      // Pre-warm agent pool
      await this.agentPool.preWarmPool();

      // Pre-warm RAG system if available
      if ((this.ragSystem as any)?.preWarm) {
        await (this.ragSystem as any).preWarm();
      }

      logger.info("Pre-warming completed", "CACHED_ORCHESTRATOR");
    } catch (error) {
      logger.error(
        "Pre-warming failed",
        "CACHED_ORCHESTRATOR",
        error as Record<string, any>,
      );
      // Don't throw - system can still work without pre-warming
    }
  }

  /**
   * Health check for cached components
   */
  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    components: Record<string, any>;
  }> {
    const components: Record<string, any> = {};
    let healthyCount = 0;
    let totalCount = 0;

    // Check cache health
    totalCount++;
    components.cache = await this.queryCache.getHealth();
    if (components.cache.status === "healthy") healthyCount++;

    // Check agent pool health
    totalCount++;
    const poolStats = this.agentPool.getStats();
    components.agentPool = {
      status: poolStats.totalAgents > 0 ? "healthy" : "degraded",
      totalAgents: poolStats.totalAgents,
      activeAgents: poolStats.activeAgents,
    };
    if (components.agentPool.status === "healthy") healthyCount++;

    // Check RAG system health if available
    if ((this.ragSystem as any)?.healthCheck) {
      totalCount++;
      components.ragSystem = await (this.ragSystem as any).healthCheck();
      if (components.ragSystem.status === "healthy") healthyCount++;
    }

    // Determine overall health
    let status: "healthy" | "degraded" | "unhealthy";
    const healthRatio = healthyCount / totalCount;

    if (healthRatio >= 1.0) {
      status = "healthy";
    } else if (healthRatio >= 0.5) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return { status, components };
  }

  /**
   * Shutdown cached orchestrator
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down cached orchestrator", "CACHED_ORCHESTRATOR");

    const shutdownPromises: Promise<void>[] = [];

    // Close cache
    shutdownPromises.push(this.queryCache.close());

    // Shutdown agent pool
    shutdownPromises.push(this.agentPool.shutdown());

    // Shutdown parent components if available
    if ((this as any).cleanup) {
      shutdownPromises.push((this as any).cleanup());
    }

    try {
      await Promise.all(shutdownPromises);
      logger.info(
        "Cached orchestrator shutdown completed",
        "CACHED_ORCHESTRATOR",
      );
    } catch (error) {
      logger.error(
        "Cached orchestrator shutdown failed",
        "CACHED_ORCHESTRATOR",
        error as Record<string, any>,
      );
      throw error;
    }
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: Query): string {
    // Include relevant query properties for cache key
    const keyComponents = [
      query.text,
      query.conversationId || "",
      JSON.stringify(query.metadata || {}),
      // Add any other relevant factors that affect response
    ].join("|");

    return keyComponents;
  }

  /**
   * Calculate appropriate TTL for cached result
   */
  private calculateCacheTTL(query: Query, result: ExecutionResult): number {
    const baseTime = 3600; // 1 hour default

    // Adjust TTL based on query characteristics
    let ttl = baseTime;

    // Longer TTL for informational queries
    if (
      query.text.toLowerCase().includes("help") ||
      query.text.toLowerCase().includes("how to") ||
      query.text.toLowerCase().includes("what is")
    ) {
      ttl = baseTime * 4; // 4 hours
    }

    // Shorter TTL for time-sensitive queries
    if (
      query.text.toLowerCase().includes("today") ||
      query.text.toLowerCase().includes("now") ||
      query.text.toLowerCase().includes("current")
    ) {
      ttl = 300; // 5 minutes
    }

    // Shorter TTL for queries that return results
    if (result.results && result.results.length > 0) {
      ttl = Math.min(ttl, 1800); // Max 30 minutes for data queries
    }

    return ttl;
  }

  /**
   * Get system statistics if parent method exists
   */
  private async getStats(): Promise<any> {
    try {
      // Try to call parent getStats method if it exists
      if ((this as any).getSystemStats) {
        return await (this as any).getSystemStats();
      }
      return null;
    } catch (error) {
      logger.debug("No base stats available", "CACHED_ORCHESTRATOR");
      return null;
    }
  }
}

// Factory function for creating cached orchestrator
export function createCachedOrchestrator(
  config: MasterOrchestratorConfig,
): CachedMasterOrchestrator {
  const orchestrator = new CachedMasterOrchestrator(config);

  // Pre-warm in background
  orchestrator.preWarm().catch((error) => {
    logger.warn("Background pre-warming failed", "CACHED_ORCHESTRATOR", error);
  });

  return orchestrator;
}
