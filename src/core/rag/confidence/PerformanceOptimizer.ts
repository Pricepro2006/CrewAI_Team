/**
 * PerformanceOptimizer - CPU optimization strategies for confidence-scored RAG
 * Implements caching, batching, and resource management
 */

import { LRUCache } from 'lru-cache';
import { ScoredDocument, TokenConfidence } from './types';
import { createHash } from 'crypto';
import { logger } from '../../../utils/logger';
import { loadavg, cpus, totalmem } from 'os';

export interface OptimizationConfig {
  enableCache?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableModelSwitching?: boolean;
  cpuThreshold?: number;
  memoryThreshold?: number;
}

export interface CachedResult<T> {
  data: T;
  timestamp: number;
  hits: number;
}

export interface BatchRequest<T> {
  id: string;
  data: T;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface ResourceMetrics {
  cpuUsage: number;
  memoryUsage: number;
  activeRequests: number;
  cacheHitRate: number;
  averageLatency: number;
}

export class PerformanceOptimizer {
  private config: Required<OptimizationConfig>;
  private cache: LRUCache<string, CachedResult<any>>;
  private batchQueue: Map<string, BatchRequest<any>[]> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private metrics: {
    requests: number;
    cacheHits: number;
    cacheMisses: number;
    totalLatency: number;
  };

  constructor(config: OptimizationConfig = {}) {
    this.config = {
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 1000,
      cacheTTL: config.cacheTTL ?? 300000, // 5 minutes
      enableBatching: config.enableBatching ?? true,
      batchSize: config.batchSize ?? 10,
      batchTimeout: config.batchTimeout ?? 100, // 100ms
      enableModelSwitching: config.enableModelSwitching ?? true,
      cpuThreshold: config.cpuThreshold ?? 0.8,
      memoryThreshold: config.memoryThreshold ?? 0.85,
    };

    this.cache = new LRUCache<string, CachedResult<any>>({
      max: this.config.cacheSize,
      ttl: this.config.cacheTTL,
      updateAgeOnGet: true,
    });

    this.metrics = {
      requests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLatency: 0,
    };

    // Monitor resource usage
    if (this.config.enableModelSwitching) {
      this.startResourceMonitoring();
    }
  }

  /**
   * Cache-aware execution wrapper
   */
  async withCache<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    if (!this.config.enableCache) {
      return fn();
    }

    // Increment request count for statistics
    this.metrics.requests++;
    
    const cachedResult = this.cache.get(key);
    if (cachedResult) {
      this.metrics.cacheHits++;
      cachedResult.hits++;
      this.cache.set(key, cachedResult);
      logger.debug('Cache hit', 'PERFORMANCE', { key, hits: cachedResult.hits });
      return cachedResult.data;
    }

    this.metrics.cacheMisses++;
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const latency = Date.now() - startTime;
      this.metrics.totalLatency += latency;

      this.cache.set(key, {
        data: result,
        timestamp: Date.now(),
        hits: 0,
      }, { ttl: ttl || this.config.cacheTTL });

      logger.debug('Cache miss - cached result', 'PERFORMANCE', { key, latency });
      return result;
    } catch (error) {
      logger.error('Cache execution failed', 'PERFORMANCE', { key }, error as Error);
      throw error;
    }
  }

  /**
   * Batch execution for similar operations
   */
  async withBatching<T, R>(
    batchKey: string,
    data: T,
    batchFn: (items: T[]) => Promise<R[]>
  ): Promise<R> {
    if (!this.config.enableBatching) {
      const results = await batchFn([data]);
      return results[0];
    }

    return new Promise((resolve, reject) => {
      const request: BatchRequest<T> = {
        id: Math.random().toString(36).substr(2, 9),
        data,
        resolve,
        reject,
      };

      // Add to batch queue
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, []);
      }
      this.batchQueue.get(batchKey)!.push(request);

      // Process if batch is full
      const queue = this.batchQueue.get(batchKey)!;
      if (queue.length >= this.config.batchSize) {
        this.processBatch(batchKey, batchFn);
      } else {
        // Set timeout for partial batch
        this.scheduleBatch(batchKey, batchFn);
      }
    });
  }

  /**
   * Process a batch of requests
   */
  private async processBatch<T, R>(
    batchKey: string,
    batchFn: (items: T[]) => Promise<R[]>
  ): Promise<void> {
    const queue = this.batchQueue.get(batchKey);
    if (!queue || queue.length === 0) return;

    // Clear any pending timer
    const timer = this.batchTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(batchKey);
    }

    // Extract requests
    const requests = [...queue];
    this.batchQueue.set(batchKey, []);

    const items = requests.map(r => r.data);
    
    try {
      const results = await batchFn(items);
      
      // Resolve individual requests
      requests.forEach((request, index) => {
        if (results[index] !== undefined) {
          request.resolve(results[index]);
        } else {
          request.reject(new Error('No result for batch item'));
        }
      });
    } catch (error) {
      // Reject all requests
      requests.forEach(request => {
        request.reject(error as Error);
      });
    }
  }

  /**
   * Schedule batch processing
   */
  private scheduleBatch<T, R>(
    batchKey: string,
    batchFn: (items: T[]) => Promise<R[]>
  ): void {
    // Clear existing timer
    const existingTimer = this.batchTimers.get(batchKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.processBatch(batchKey, batchFn);
    }, this.config.batchTimeout);

    this.batchTimers.set(batchKey, timer);
  }

  /**
   * Generate cache key for queries
   */
  generateQueryKey(query: string, options?: any): string {
    const data = { query, options };
    return createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  /**
   * Generate cache key for documents
   */
  generateDocumentKey(documents: ScoredDocument[]): string {
    const ids = documents.map(d => d.id).sort().join(':');
    return createHash('sha256').update(ids).digest('hex');
  }

  /**
   * Optimize document retrieval
   */
  async optimizeRetrieval(
    documents: ScoredDocument[],
    topK: number
  ): Promise<ScoredDocument[]> {
    // Sort by confidence score
    const sorted = [...documents].sort((a, b) => 
      b.confidenceScore - a.confidenceScore
    );

    // Apply early stopping if confidence drops significantly
    const threshold = sorted[0]?.confidenceScore * 0.5;
    const filtered = sorted.filter(doc => 
      doc.confidenceScore >= threshold
    );

    return filtered.slice(0, topK);
  }

  /**
   * Optimize token processing
   */
  optimizeTokenConfidence(
    tokens: TokenConfidence[],
    maxTokens: number = 1000
  ): TokenConfidence[] {
    if (tokens.length <= maxTokens) return tokens;

    // Keep high confidence tokens and sample low confidence ones
    const highConfidence = tokens.filter(t => t.confidence >= 0.8);
    const lowConfidence = tokens.filter(t => t.confidence < 0.8);

    // Sample low confidence tokens
    const sampleSize = Math.max(0, maxTokens - highConfidence.length);
    const sampled = this.sampleArray(lowConfidence, sampleSize);

    return [...highConfidence, ...sampled];
  }

  /**
   * Sample array elements
   */
  private sampleArray<T>(array: T[], size: number): T[] {
    if (size >= array.length) return array;
    
    const sampled: T[] = [];
    const indices = new Set<number>();
    
    while (sampled.length < size) {
      const index = Math.floor(Math.random() * array.length);
      if (!indices.has(index)) {
        indices.add(index);
        sampled.push(array[index]);
      }
    }
    
    return sampled;
  }

  /**
   * Get resource usage metrics
   */
  async getResourceMetrics(): Promise<ResourceMetrics> {
    const cpuUsage = await this.getCPUUsage();
    const memoryUsage = this.getMemoryUsage();
    const cacheHitRate = this.metrics.requests > 0
      ? this.metrics.cacheHits / this.metrics.requests
      : 0;
    const averageLatency = this.metrics.requests > 0
      ? this.metrics.totalLatency / this.metrics.requests
      : 0;

    return {
      cpuUsage,
      memoryUsage,
      activeRequests: this.getActiveRequests(),
      cacheHitRate,
      averageLatency,
    };
  }

  /**
   * Get CPU usage (simplified)
   */
  private async getCPUUsage(): Promise<number> {
    // In production, use proper CPU monitoring
    // This is a simplified version
    const loadAvg = loadavg();
    const cpuCount = cpus().length;
    return Math.min(1, loadAvg[0] / cpuCount);
  }

  /**
   * Get memory usage
   */
  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    const total = totalmem();
    return used.heapUsed / total;
  }

  /**
   * Get active request count
   */
  private getActiveRequests(): number {
    let count = 0;
    this.batchQueue.forEach(queue => {
      count += queue.length;
    });
    return count;
  }

  /**
   * Monitor resources and adapt
   */
  private startResourceMonitoring(): void {
    setInterval(async () => {
      const metrics = await this.getResourceMetrics();
      
      if (metrics.cpuUsage > this.config.cpuThreshold) {
        logger.warn('High CPU usage detected', 'PERFORMANCE', { 
          cpuUsage: metrics.cpuUsage 
        });
        // Could trigger model switching or request throttling
      }

      if (metrics.memoryUsage > this.config.memoryThreshold) {
        logger.warn('High memory usage detected', 'PERFORMANCE', { 
          memoryUsage: metrics.memoryUsage 
        });
        // Could trigger cache clearing or garbage collection
        this.cache.clear();
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Suggest optimal model based on complexity
   */
  suggestModel(complexity: number): string {
    if (!this.config.enableModelSwitching) {
      return 'qwen3:8b'; // Default
    }

    const metrics = this.getResourceMetrics();
    
    // Use smaller models under high load
    if (metrics.cpuUsage > this.config.cpuThreshold) {
      return 'qwen2.5:0.5b';
    }

    // Use model based on complexity
    if (complexity <= 3) {
      return 'qwen2.5:0.5b'; // Simple queries
    } else if (complexity <= 7) {
      return 'qwen3:8b'; // Medium queries
    } else {
      return 'qwen3:14b'; // Complex queries
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.requests = 0;
    this.metrics.totalLatency = 0;
    logger.info('Cache cleared', 'PERFORMANCE');
  }

  /**
   * Get system load for model selection
   */
  getSystemLoad(): { cpu: number; memory: number; queueLength: number } {
    const cpuCount = cpus().length;
    const loadAvg = loadavg();
    const used = process.memoryUsage();
    const total = totalmem();
    
    return {
      cpu: Math.min(100, (loadAvg[0] / cpuCount) * 100),
      memory: Math.min(100, (used.heapUsed / total) * 100),
      queueLength: this.getActiveRequests()
    };
  }

  /**
   * Get performance statistics
   */
  async getStatistics() {
    const metrics = await this.getResourceMetrics();
    
    return {
      cache: {
        size: this.cache.size,
        maxSize: this.config.cacheSize,
        hitRate: metrics.cacheHitRate,
        hits: this.metrics.cacheHits,
        misses: this.metrics.cacheMisses,
      },
      batching: {
        enabled: this.config.enableBatching,
        activeQueues: this.batchQueue.size,
        pendingRequests: metrics.activeRequests,
      },
      performance: {
        averageLatency: metrics.averageLatency,
        totalRequests: this.metrics.requests,
      },
      resources: {
        cpu: metrics.cpuUsage,
        memory: metrics.memoryUsage,
      },
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    // Clear all batch timers
    this.batchTimers.forEach(timer => clearTimeout(timer));
    this.batchTimers.clear();
    this.batchQueue.clear();
    this.cache.clear();
  }
}