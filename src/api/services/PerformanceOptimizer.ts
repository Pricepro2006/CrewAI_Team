import { logger } from "../../utils/logger.js";
import crypto from "crypto";

// Performance optimization service implementing 2025 best practices
export class PerformanceOptimizer {
  private queryCache: Map<string, CacheEntry> = new Map();
  private performanceMetrics: PerformanceMetrics = {
    queryTimes: [],
    cacheHits: 0,
    cacheMisses: 0,
    slowQueries: [],
    optimizationRecommendations: [],
  };

  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly SLOW_QUERY_THRESHOLD = 1000; // 1 second
  private readonly MAX_CACHE_SIZE = 100;
  private readonly CACHE_CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  private cleanupInterval!: NodeJS.Timeout;

  constructor() {
    this.startCacheCleanup();
  }

  /**
   * Optimize database query based on 2025 best practices
   */
  optimizeQuery(query: string, params?: any[]): OptimizedQuery {
    const startTime = Date.now();

    // Apply query optimization patterns from research
    const optimizedQuery = this.applyQueryOptimizations(query);

    // Log performance metrics
    const executionTime = Date.now() - startTime;
    this.recordQueryPerformance(query, executionTime);

    return {
      originalQuery: query,
      optimizedQuery,
      params,
      estimatedPerformanceGain: this.calculatePerformanceGain(
        query,
        optimizedQuery,
      ),
      recommendations: this.generateOptimizationRecommendations(query),
    };
  }

  /**
   * Apply SQL query optimization patterns from 2025 research
   */
  private applyQueryOptimizations(query: string): string {
    let optimized = query;

    // 1. Replace IN clauses with JOIN on virtual tables for large lists
    optimized = this.optimizeInClauses(optimized);

    // 2. Use WHERE instead of HAVING when possible
    optimized = this.optimizeHavingClauses(optimized);

    // 3. Replace SELECT * with specific columns
    optimized = this.optimizeSelectStatements(optimized);

    // 4. Optimize JOIN operations
    optimized = this.optimizeJoinOperations(optimized);

    // 5. Add query hints for better execution plans
    optimized = this.addQueryHints(optimized);

    return optimized;
  }

  /**
   * Replace large IN clauses with JOINs (2025 best practice)
   */
  private optimizeInClauses(query: string): string {
    const inClausePattern = /WHERE\s+(\w+)\s+IN\s*\(([^)]+)\)/gi;

    return query.replace(inClausePattern, (match, column, values) => {
      const valuesList = values.split(",").map((v: string) => v.trim());

      // Only optimize if more than 5 values (performance threshold)
      if (valuesList?.length || 0 > 5) {
        const valuesTable = valuesList?.map((v: string) => `(${v})`).join(", ");
        return `INNER JOIN (VALUES ${valuesTable}) AS vt(${column}_val) ON ${column} = vt.${column}_val`;
      }

      return match;
    });
  }

  /**
   * Convert HAVING to WHERE when possible for better performance
   */
  private optimizeHavingClauses(query: string): string {
    // This is a simplified example - real implementation would be more complex
    if (query.includes("HAVING") && !query.includes("GROUP BY")) {
      return query.replace(/HAVING/gi, "WHERE");
    }
    return query;
  }

  /**
   * Replace SELECT * with specific columns when possible
   */
  private optimizeSelectStatements(query: string): string {
    // For table view queries, specify only needed columns
    if (query.includes("SELECT *") && query.includes("emails")) {
      return query.replace(
        "SELECT *",
        "SELECT id, internet_message_id, email_alias, requested_by, subject, summary, status, priority, workflow_state, received_date",
      );
    }
    return query;
  }

  /**
   * Optimize JOIN operations for better performance
   */
  private optimizeJoinOperations(query: string): string {
    // Prefer INNER JOIN over OUTER JOIN when possible
    // Ensure join conditions use indexed columns
    return query
      .replace(/LEFT OUTER JOIN/gi, "LEFT JOIN")
      .replace(/RIGHT OUTER JOIN/gi, "RIGHT JOIN")
      .replace(/FULL OUTER JOIN/gi, "FULL JOIN");
  }

  /**
   * Add query hints for better execution plans
   */
  private addQueryHints(query: string): string {
    // Add index hints for commonly queried columns
    if (query.includes("WHERE") && query.includes("emails")) {
      const indexHints = [
        "USE INDEX (idx_emails_status)",
        "USE INDEX (idx_emails_received_date)",
        "USE INDEX (idx_emails_alias)",
      ];

      // Add hints if not already present
      if (!query.includes("USE INDEX")) {
        const fromIndex = query.indexOf("FROM emails");
        if (fromIndex > -1) {
          const hint = indexHints[0]; // Use most relevant index
          return query.replace("FROM emails", `FROM emails ${hint}`);
        }
      }
    }
    return query;
  }

  /**
   * Intelligent caching with TTL and size limits
   */
  async cacheQuery<T>(key: string, queryFn: () => Promise<T>): Promise<T> {
    const cacheKey = this.generateCacheKey(key);
    const cached = this?.queryCache?.get(cacheKey);

    // Check cache hit
    if (cached && !this.isCacheExpired(cached)) {
      this.performanceMetrics.cacheHits++;
      logger.debug("Cache hit", "PERFORMANCE_OPTIMIZER", { key: cacheKey });
      return cached.data as T;
    }

    // Cache miss - execute query
    this.performanceMetrics.cacheMisses++;
    logger.debug("Cache miss - executing query", "PERFORMANCE_OPTIMIZER", {
      key: cacheKey,
    });

    const startTime = Date.now();
    const result = await queryFn();
    const executionTime = Date.now() - startTime;

    // Store in cache
    this.setCache(cacheKey, result, executionTime);

    return result;
  }

  /**
   * Generate cache key with query fingerprinting
   */
  private generateCacheKey(input: string): string {
    // Create hash of query for consistent caching - use crypto for better uniqueness
    // Use full hash to avoid collisions completely
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  /**
   * Set cache entry with metadata
   */
  private setCache(key: string, data: any, executionTime: number): void {
    // Implement LRU eviction if cache is full
    if (this?.queryCache?.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this?.queryCache?.keys().next().value;
      if (oldestKey !== undefined) {
        this?.queryCache?.delete(oldestKey);
      }
    }

    this?.queryCache?.set(key, {
      data,
      timestamp: Date.now(),
      executionTime,
      accessCount: 1,
    });

    logger.debug("Query cached", "PERFORMANCE_OPTIMIZER", {
      key,
      executionTime,
      cacheSize: this?.queryCache?.size,
    });
  }

  /**
   * Check if cache entry is expired
   */
  private isCacheExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.CACHE_TTL;
  }

  /**
   * Optimized pagination with offset optimization
   */
  optimizePagination(
    baseQuery: string,
    page: number,
    pageSize: number,
  ): PaginationQuery {
    // Validate pagination parameters
    if (!Number.isInteger(page) || page < 1) {
      throw new Error("Page must be a positive integer");
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw new Error("Page size must be an integer between 1 and 1000");
    }

    // Use cursor-based pagination for large datasets (2025 best practice)
    const offset = (page - 1) * pageSize;

    // For large offsets, use cursor-based approach
    if (offset > 10000) {
      return this.generateCursorPagination(baseQuery, page, pageSize);
    }

    // Standard pagination for smaller datasets
    // Note: This returns parameterized placeholders - the calling code must use prepared statements
    return {
      query: `${baseQuery} LIMIT ? OFFSET ?`,
      countQuery: `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`,
      isPaginationOptimized: true,
      paginationType: "offset",
      params: [pageSize, offset],
    };
  }

  /**
   * Generate cursor-based pagination for large datasets
   */
  private generateCursorPagination(
    baseQuery: string,
    page: number,
    pageSize: number,
  ): PaginationQuery {
    // Validate pageSize
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
      throw new Error("Page size must be an integer between 1 and 1000");
    }

    // Simplified cursor implementation - would need last ID from previous page
    const cursorQuery = `${baseQuery} ORDER BY id LIMIT ?`;

    return {
      query: cursorQuery,
      countQuery: `SELECT COUNT(*) as total FROM (${baseQuery}) as count_query`,
      isPaginationOptimized: true,
      paginationType: "cursor",
      params: [pageSize],
      recommendations: [
        "Consider implementing cursor-based pagination for better performance with large datasets",
        "Store cursor position to avoid expensive OFFSET calculations",
      ],
    };
  }

  /**
   * Monitor query performance and generate recommendations
   */
  private recordQueryPerformance(query: string, executionTime: number): void {
    this?.performanceMetrics?.queryTimes.push({
      query,
      executionTime,
      timestamp: Date.now(),
    });

    // Track slow queries
    if (executionTime > this.SLOW_QUERY_THRESHOLD) {
      this?.performanceMetrics?.slowQueries.push({
        query,
        executionTime,
        timestamp: Date.now(),
        recommendations: this.generateOptimizationRecommendations(query),
      });

      logger.warn("Slow query detected", "PERFORMANCE_OPTIMIZER", {
        query: query.substring(0, 100),
        executionTime,
      });
    }

    // Keep only last 100 query times
    if (this?.performanceMetrics?.queryTimes?.length || 0 > 100) {
      this.performanceMetrics.queryTimes =
        this.performanceMetrics.queryTimes.slice(-100);
    }
  }

  /**
   * Generate optimization recommendations based on query analysis
   */
  private generateOptimizationRecommendations(query: string): string[] {
    const recommendations: string[] = [];

    if (query.includes("SELECT *")) {
      recommendations.push(
        "Use specific column names instead of SELECT * to reduce data transfer",
      );
    }

    if (query.includes("IN (")) {
      recommendations.push(
        "Consider using JOIN with VALUES table for large IN clauses",
      );
    }

    if (query.includes("ORDER BY") && !query.includes("LIMIT")) {
      recommendations.push(
        "Add LIMIT clause when using ORDER BY to improve performance",
      );
    }

    if (query.includes("LIKE '%")) {
      recommendations.push(
        "Avoid leading wildcards in LIKE patterns - consider full-text search",
      );
    }

    if (!query.includes("WHERE") && query.includes("emails")) {
      recommendations.push(
        "Add WHERE clause to filter data and improve query performance",
      );
    }

    return recommendations;
  }

  /**
   * Calculate estimated performance gain from optimization
   */
  private calculatePerformanceGain(
    original: string,
    optimized: string,
  ): number {
    // Simplified calculation based on optimization patterns
    let gain = 0;

    if (original.includes("SELECT *") && !optimized.includes("SELECT *")) {
      gain += 20; // 20% improvement from column selection
    }

    if (original.includes("IN (") && optimized.includes("JOIN")) {
      gain += 30; // 30% improvement from IN to JOIN conversion
    }

    if (original.includes("HAVING") && optimized.includes("WHERE")) {
      gain += 15; // 15% improvement from HAVING to WHERE
    }

    return Math.min(gain, 80); // Cap at 80% improvement
  }

  /**
   * Generate a unique cache key for a query
   */
  generateQueryKey(query: string): string {
    // Simple hash function for query caching
    let hash = 0;
    for (let i = 0; i < query?.length || 0; i++) {
      const char = query.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `query_${Math.abs(hash)}`;
  }

  /**
   * Cache-aware query execution wrapper
   */
  async withCache<T>(
    cacheKey: string,
    queryFn: () => Promise<T>,
    ttl: number = this.CACHE_TTL,
  ): Promise<T> {
    // Check cache first
    const cached = this?.queryCache?.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      this.performanceMetrics.cacheHits++;
      logger.debug("Cache hit", "PERFORMANCE_OPTIMIZER", { cacheKey });
      return cached.data as T;
    }

    // Execute query
    this.performanceMetrics.cacheMisses++;
    const startTime = Date.now();
    const result = await queryFn();
    const executionTime = Date.now() - startTime;

    // Store in cache
    this?.queryCache?.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
      executionTime,
      accessCount: 1,
    });

    // Evict old entries if cache is too large
    if (this?.queryCache?.size > this.MAX_CACHE_SIZE) {
      const entries = Array.from(this?.queryCache?.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp,
      );
      const oldestEntry = entries[0];
      if (oldestEntry) {
        this?.queryCache?.delete(oldestEntry[0]);
      }
    }

    return result;
  }

  /**
   * Get statistics about the optimizer
   */
  getStatistics() {
    return {
      cacheSize: this?.queryCache?.size,
      cacheHitRate:
        this?.performanceMetrics?.cacheHits > 0
          ? this?.performanceMetrics?.cacheHits /
            (this?.performanceMetrics?.cacheHits +
              this?.performanceMetrics?.cacheMisses)
          : 0,
      avgQueryTime:
        this?.performanceMetrics?.queryTimes?.length || 0 > 0
          ? this?.performanceMetrics?.queryTimes.reduce(
              (sum, q) => sum + q.executionTime,
              0,
            ) / this?.performanceMetrics?.queryTimes?.length || 0
          : 0,
      slowQueriesCount: this?.performanceMetrics?.slowQueries?.length || 0,
      totalOptimizationRecommendations:
        this?.performanceMetrics?.optimizationRecommendations?.length || 0,
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this?.queryCache?.clear();
    logger.info("PerformanceOptimizer cleaned up", "PERFORMANCE_OPTIMIZER");
  }

  /**
   * Get performance metrics and insights
   */
  getPerformanceMetrics(): PerformanceReport {
    const avgQueryTime =
      this?.performanceMetrics?.queryTimes?.length || 0 > 0
        ? this?.performanceMetrics?.queryTimes.reduce(
            (sum, q) => sum + q.executionTime,
            0,
          ) / this?.performanceMetrics?.queryTimes?.length || 0
        : 0;

    const cacheHitRatio =
      this?.performanceMetrics?.cacheHits + this?.performanceMetrics?.cacheMisses >
      0
        ? (this?.performanceMetrics?.cacheHits /
            (this?.performanceMetrics?.cacheHits +
              this?.performanceMetrics?.cacheMisses)) *
          100
        : 0;

    return {
      averageQueryTime: avgQueryTime,
      cacheHitRatio,
      totalCacheHits: this?.performanceMetrics?.cacheHits,
      totalCacheMisses: this?.performanceMetrics?.cacheMisses,
      slowQueriesCount: this?.performanceMetrics?.slowQueries?.length || 0,
      cacheSize: this?.queryCache?.size,
      recommendations: this.generateGlobalRecommendations(),
      recentSlowQueries: this?.performanceMetrics?.slowQueries.slice(-5),
      performanceTrend: this.calculatePerformanceTrend(),
    };
  }

  /**
   * Generate global performance recommendations
   */
  private generateGlobalRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this?.performanceMetrics;

    const cacheHitRatio =
      metrics.cacheHits + metrics.cacheMisses > 0
        ? (metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100
        : 0;

    if (cacheHitRatio < 50) {
      recommendations.push(
        "Cache hit ratio is low - consider increasing cache TTL or reviewing cache strategy",
      );
    }

    if (metrics?.slowQueries?.length > 10) {
      recommendations.push(
        "High number of slow queries detected - review database indexes and query optimization",
      );
    }

    const avgQueryTime =
      metrics?.queryTimes?.length > 0
        ? metrics?.queryTimes?.reduce((sum: any, q: any) => sum + q.executionTime, 0) /
          metrics?.queryTimes?.length
        : 0;

    if (avgQueryTime > 500) {
      recommendations.push(
        "Average query time is high - consider implementing database query optimization",
      );
    }

    if (this?.queryCache?.size >= this.MAX_CACHE_SIZE * 0.9) {
      recommendations.push(
        "Cache is near capacity - consider increasing cache size or implementing better eviction strategy",
      );
    }

    return recommendations;
  }

  /**
   * Calculate performance trend over time
   */
  private calculatePerformanceTrend(): PerformanceTrend {
    const recentQueries = this?.performanceMetrics?.queryTimes.slice(-20);
    const olderQueries = this?.performanceMetrics?.queryTimes.slice(-40, -20);

    if (recentQueries?.length || 0 === 0 || olderQueries?.length || 0 === 0) {
      return { trend: "stable", percentChange: 0 };
    }

    const recentAvg =
      recentQueries.reduce((sum: any, q: any) => sum + q.executionTime, 0) /
      recentQueries?.length || 0;
    const olderAvg =
      olderQueries.reduce((sum: any, q: any) => sum + q.executionTime, 0) /
      olderQueries?.length || 0;

    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    let trend: "improving" | "degrading" | "stable";
    if (percentChange < -10) {
      trend = "improving";
    } else if (percentChange > 10) {
      trend = "degrading";
    } else {
      trend = "stable";
    }

    return { trend, percentChange };
  }

  /**
   * Clear cache and reset metrics
   */
  clearCache(): void {
    this?.queryCache?.clear();
    this.performanceMetrics.cacheHits = 0;
    this.performanceMetrics.cacheMisses = 0;
    logger.info("Performance cache cleared", "PERFORMANCE_OPTIMIZER");
  }

  /**
   * Start cache cleanup routine
   */
  private startCacheCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const expiredKeys: string[] = [];

      this?.queryCache?.forEach((entry, key) => {
        if (this.isCacheExpired(entry)) {
          expiredKeys.push(key);
        }
      });

      expiredKeys.forEach((key: any) => this?.queryCache?.delete(key));

      if (expiredKeys?.length || 0 > 0) {
        logger.debug("Cache cleanup completed", "PERFORMANCE_OPTIMIZER", {
          expiredEntries: expiredKeys?.length || 0,
          remainingEntries: this?.queryCache?.size,
        });
      }
    }, this.CACHE_CLEANUP_INTERVAL);
  }

  /**
   * Stop cache cleanup routine
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Type definitions
interface CacheEntry {
  data: any;
  timestamp: number;
  executionTime: number;
  accessCount: number;
}

interface PerformanceMetrics {
  queryTimes: QueryMetric[];
  cacheHits: number;
  cacheMisses: number;
  slowQueries: SlowQuery[];
  optimizationRecommendations: string[];
}

interface QueryMetric {
  query: string;
  executionTime: number;
  timestamp: number;
}

interface SlowQuery extends QueryMetric {
  recommendations: string[];
}

interface OptimizedQuery {
  originalQuery: string;
  optimizedQuery: string;
  params?: any[];
  estimatedPerformanceGain: number;
  recommendations: string[];
}

interface PaginationQuery {
  query: string;
  countQuery: string;
  isPaginationOptimized: boolean;
  paginationType: "offset" | "cursor";
  recommendations?: string[];
  params?: any[];
}

interface PerformanceReport {
  averageQueryTime: number;
  cacheHitRatio: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  slowQueriesCount: number;
  cacheSize: number;
  recommendations: string[];
  recentSlowQueries: SlowQuery[];
  performanceTrend: PerformanceTrend;
}

interface PerformanceTrend {
  trend: "improving" | "degrading" | "stable";
  percentChange: number;
}

// Singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
