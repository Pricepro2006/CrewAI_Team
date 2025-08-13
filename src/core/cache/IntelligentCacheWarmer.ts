import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { z } from 'zod';
import cron from 'node-cron';
import { LLMResponseCache } from './LLMResponseCache.js';
import { RedisCacheManager } from './RedisCacheManager.js';
import { logger } from '../../utils/logger.js';
import { metrics } from '../../api/monitoring/metrics.js';
import Database from 'better-sqlite3';
import path from 'path';

/**
 * IntelligentCacheWarmer - Proactive cache warming for frequently accessed items
 * 
 * Features:
 * - Analytics-driven cache warming based on access patterns
 * - Predictive pre-loading of related items
 * - Time-based warming strategies (peak hours, daily patterns)
 * - Memory-aware warming with configurable limits
 * - Priority-based warming for critical items
 * - Background warming without blocking operations
 * - Incremental warming to prevent memory spikes
 * - Ollama-specific optimizations for NLP queries
 * - Walmart grocery item pre-caching for common products
 */

// Configuration schemas
export const CacheWarmingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  redis: z.object({
    keyPrefix: z.string().default('cache_warmer:'),
    analyticsPrefix: z.string().default('analytics:'),
    db: z.number().default(2)
  }),
  warming: z.object({
    batchSize: z.number().default(10),
    concurrency: z.number().default(3),
    interval: z.number().default(300000), // 5 minutes
    maxItemsPerRun: z.number().default(100),
    ttlExtension: z.number().default(3600000), // 1 hour
    memoryLimit: z.number().default(100 * 1024 * 1024), // 100MB
    priorityThreshold: z.number().default(0.7) // 0-1 score
  }),
  analytics: z.object({
    enabled: z.boolean().default(true),
    sampleRate: z.number().default(1), // 100% sampling
    retentionDays: z.number().default(7),
    minAccessCount: z.number().default(5), // Min accesses to consider "frequent"
    decayFactor: z.number().default(0.95) // Daily decay for access scores
  }),
  strategies: z.object({
    timeBasedWarming: z.boolean().default(true),
    patternBasedWarming: z.boolean().default(true),
    relatedItemsWarming: z.boolean().default(true),
    predictiveWarming: z.boolean().default(true)
  }),
  schedules: z.array(z.object({
    name: z.string(),
    cron: z.string(), // Cron expression
    items: z.array(z.string()), // Specific items to warm
    strategy: z.enum(['full', 'partial', 'related'])
  })).default([
    { name: 'morning_peak', cron: '0 7 * * *', items: [], strategy: 'full' },
    { name: 'lunch_peak', cron: '0 11 * * *', items: [], strategy: 'partial' },
    { name: 'evening_peak', cron: '0 17 * * *', items: [], strategy: 'full' }
  ])
});

export type CacheWarmingConfig = z.infer<typeof CacheWarmingConfigSchema>;

// Analytics tracking
export interface AccessPattern {
  itemId: string;
  accessCount: number;
  lastAccessed: number;
  averageLoadTime: number;
  hitRate: number;
  score: number; // Calculated importance score
  category?: string;
  relatedItems?: string[];
  peakHours?: number[]; // Hours of day with most accesses
}

export interface WarmingCandidate {
  itemId: string;
  priority: number;
  reason: string;
  estimatedSize: number;
  dependencies?: string[];
  metadata?: Record<string, any>;
}

export interface WarmingResult {
  totalCandidates: number;
  warmedItems: number;
  failedItems: number;
  memoryUsed: number;
  duration: number;
  strategy: string;
  errors: string[];
}

export class IntelligentCacheWarmer extends EventEmitter {
  private config: CacheWarmingConfig;
  private redis: Redis;
  private analyticsRedis: Redis; // Separate connection for analytics (DB 2)
  private cacheManager: RedisCacheManager;
  private llmCache: LLMResponseCache;
  private sqliteDb?: Database.Database;
  
  // State management
  private isWarming = false;
  private accessPatterns = new Map<string, AccessPattern>();
  private warmingQueue: WarmingCandidate[] = [];
  private memoryUsage = 0;
  private lastWarmingRun?: Date;
  
  // Ollama-specific tracking
  private ollamaQueryPatterns = new Map<string, {
    query: string;
    frequency: number;
    avgResponseTime: number;
    lastUsed: number;
    embeddings?: number[];
  }>();
  
  // Walmart grocery-specific data
  private commonGroceryItems = new Set<string>();
  private categoryAssociations = new Map<string, string[]>();
  
  // Scheduled tasks
  private scheduledTasks: cron.ScheduledTask[] = [];
  private analyticsTimer?: NodeJS.Timeout;
  private warmingTimer?: NodeJS.Timeout;

  constructor(
    config: Partial<CacheWarmingConfig> = {},
    redis: Redis,
    cacheManager: RedisCacheManager,
    llmCache: LLMResponseCache
  ) {
    super();
    
    this.config = CacheWarmingConfigSchema.parse(config);
    this.redis = redis;
    
    // Create separate Redis connection for analytics (DB 2)
    this.analyticsRedis = redis.duplicate();
    this.analyticsRedis.select(2);
    
    this.cacheManager = cacheManager;
    this.llmCache = llmCache;
    
    // Initialize SQLite for persistent analytics
    this.initializeSQLite();
    
    // Load common grocery items
    this.initializeGroceryData();
    
    if (this.config.enabled) {
      this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    // Load existing analytics
    await this.loadAnalytics();
    
    // Setup scheduled warming tasks
    this.setupScheduledTasks();
    
    // Start continuous warming process
    this.startContinuousWarming();
    
    // Start analytics collection
    this.startAnalyticsCollection();
    
    this.emit('initialized', {
      patternsLoaded: this.accessPatterns.size,
      scheduledTasks: this.scheduledTasks.length
    });
    
    console.log(`IntelligentCacheWarmer initialized with ${this.accessPatterns.size} patterns`);
  }

  // Analytics collection and tracking
  public recordAccess(
    itemId: string,
    loadTime: number,
    hit: boolean,
    metadata?: {
      category?: string;
      relatedItems?: string[];
      size?: number;
    }
  ): void {
    if (!this.config.analytics.enabled) return;
    
    // Sample based on configured rate
    if (Math.random() > this.config.analytics.sampleRate) return;
    
    const pattern = this.accessPatterns.get(itemId) || {
      itemId,
      accessCount: 0,
      lastAccessed: Date.now(),
      averageLoadTime: loadTime,
      hitRate: 0,
      score: 0,
      peakHours: []
    };
    
    // Update pattern metrics
    pattern.accessCount++;
    pattern.lastAccessed = Date.now();
    pattern.averageLoadTime = (pattern.averageLoadTime + loadTime) / 2;
    pattern.hitRate = (pattern.hitRate * (pattern.accessCount - 1) + (hit ? 1 : 0)) / pattern.accessCount;
    
    // Track peak hours
    const currentHour = new Date().getHours();
    if (!pattern.peakHours) pattern.peakHours = [];
    pattern.peakHours.push(currentHour);
    
    // Add metadata
    if (metadata) {
      if (metadata.category) pattern.category = metadata.category;
      if (metadata.relatedItems) pattern.relatedItems = metadata.relatedItems;
    }
    
    // Calculate importance score
    pattern.score = this.calculateImportanceScore(pattern);
    
    this.accessPatterns.set(itemId, pattern);
    
    // Persist to Redis periodically
    this.scheduleAnalyticsPersistence();
  }

  private calculateImportanceScore(pattern: AccessPattern): number {
    const recencyScore = this.calculateRecencyScore(pattern.lastAccessed);
    const frequencyScore = Math.min(pattern.accessCount / 100, 1); // Normalize to 0-1
    const performanceScore = 1 - Math.min(pattern.averageLoadTime / 5000, 1); // Faster = higher score
    const hitRateScore = pattern.hitRate;
    
    // Weighted combination
    return (
      recencyScore * 0.3 +
      frequencyScore * 0.3 +
      performanceScore * 0.2 +
      hitRateScore * 0.2
    );
  }

  private calculateRecencyScore(lastAccessed: number): number {
    const hoursSinceAccess = (Date.now() - lastAccessed) / (1000 * 60 * 60);
    return Math.exp(-hoursSinceAccess / 24); // Exponential decay over 24 hours
  }

  // Warming strategies
  private async identifyWarmingCandidates(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    
    // Strategy 1: Frequently accessed items
    if (this.config.strategies.patternBasedWarming) {
      const frequentItems = await this.getFrequentlyAccessedItems();
      candidates.push(...frequentItems);
    }
    
    // Strategy 2: Time-based predictions
    if (this.config.strategies.timeBasedWarming) {
      const timeBasedItems = await this.getTimeBasedPredictions();
      candidates.push(...timeBasedItems);
    }
    
    // Strategy 3: Related items
    if (this.config.strategies.relatedItemsWarming) {
      const relatedItems = await this.getRelatedItems(
        candidates.map(c => c.itemId)
      );
      candidates.push(...relatedItems);
    }
    
    // Strategy 4: Predictive warming based on patterns
    if (this.config.strategies.predictiveWarming) {
      const predictedItems = await this.getPredictiveItems();
      candidates.push(...predictedItems);
    }
    
    // Strategy 5: Ollama query predictions (NEW)
    const ollamaQueries = await this.getPredictedOllamaQueries();
    candidates.push(...ollamaQueries);
    
    // Strategy 6: Grocery item predictions (NEW)
    const groceryItems = await this.getPredictedGroceryItems();
    candidates.push(...groceryItems);
    
    // Sort by priority and deduplicate
    const uniqueCandidates = this.deduplicateCandidates(candidates);
    uniqueCandidates.sort((a, b) => b.priority - a.priority);
    
    // Apply memory limits
    return this.applyMemoryLimits(uniqueCandidates);
  }

  private async getFrequentlyAccessedItems(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    
    for (const [itemId, pattern] of this.accessPatterns) {
      if (pattern.accessCount >= this.config.analytics.minAccessCount &&
          pattern.score >= this.config.warming.priorityThreshold) {
        candidates.push({
          itemId,
          priority: pattern.score,
          reason: 'frequently_accessed',
          estimatedSize: 1024 * 10, // 10KB estimate
          metadata: {
            accessCount: pattern.accessCount,
            hitRate: pattern.hitRate
          }
        });
      }
    }
    
    return candidates;
  }

  private async getTimeBasedPredictions(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    const currentHour = new Date().getHours();
    
    // Find items frequently accessed at this hour
    for (const [itemId, pattern] of this.accessPatterns) {
      if (!pattern.peakHours || pattern.peakHours.length === 0) continue;
      
      // Calculate hour frequency
      const hourFrequency = pattern.peakHours.filter(h => 
        Math.abs(h - currentHour) <= 1 // Within 1 hour window
      ).length / pattern.peakHours.length;
      
      if (hourFrequency > 0.3) { // 30% of accesses in this time window
        candidates.push({
          itemId,
          priority: pattern.score * hourFrequency,
          reason: 'time_based_prediction',
          estimatedSize: 1024 * 10,
          metadata: {
            currentHour,
            hourFrequency
          }
        });
      }
    }
    
    return candidates;
  }

  private async getRelatedItems(primaryItems: string[]): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    const processedRelated = new Set<string>();
    
    for (const itemId of primaryItems) {
      const pattern = this.accessPatterns.get(itemId);
      if (!pattern?.relatedItems) continue;
      
      for (const relatedId of pattern.relatedItems) {
        if (processedRelated.has(relatedId)) continue;
        processedRelated.add(relatedId);
        
        const relatedPattern = this.accessPatterns.get(relatedId);
        candidates.push({
          itemId: relatedId,
          priority: (relatedPattern?.score || 0.5) * 0.7, // 70% of original priority
          reason: 'related_item',
          estimatedSize: 1024 * 10,
          dependencies: [itemId],
          metadata: {
            primaryItem: itemId
          }
        });
      }
    }
    
    return candidates;
  }

  private async getPredictiveItems(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    
    // Analyze access sequences to predict next items
    // This is a simplified implementation - could use ML models in production
    
    // Group patterns by category
    const categoryGroups = new Map<string, AccessPattern[]>();
    for (const pattern of this.accessPatterns.values()) {
      if (!pattern.category) continue;
      
      const group = categoryGroups.get(pattern.category) || [];
      group.push(pattern);
      categoryGroups.set(pattern.category, group);
    }
    
    // Find trending categories
    for (const [category, patterns] of categoryGroups) {
      const recentAccesses = patterns.filter(p => 
        Date.now() - p.lastAccessed < 3600000 // Last hour
      );
      
      if (recentAccesses.length > patterns.length * 0.3) { // 30% accessed recently
        // Add top items from trending category
        const topItems = patterns
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);
        
        for (const pattern of topItems) {
          candidates.push({
            itemId: pattern.itemId,
            priority: pattern.score * 0.8,
            reason: 'predictive_trending',
            estimatedSize: 1024 * 10,
            metadata: {
              category,
              trendingScore: recentAccesses.length / patterns.length
            }
          });
        }
      }
    }
    
    return candidates;
  }

  // Cache warming execution
  public async warmCache(strategy: string = 'auto'): Promise<WarmingResult> {
    if (this.isWarming) {
      return {
        totalCandidates: 0,
        warmedItems: 0,
        failedItems: 0,
        memoryUsed: 0,
        duration: 0,
        strategy,
        errors: ['Warming already in progress']
      };
    }
    
    this.isWarming = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let warmedItems = 0;
    let failedItems = 0;
    
    try {
      // Identify candidates based on strategy
      const candidates = await this.identifyWarmingCandidates();
      
      this.emit('warming_started', {
        candidatesCount: candidates.length,
        strategy,
        memoryLimit: this.config.warming.memoryLimit
      });
      
      // Process in batches
      const batches = this.createBatches(candidates, this.config.warming.batchSize);
      
      for (const batch of batches) {
        const batchResults = await Promise.allSettled(
          batch.map(candidate => this.warmItem(candidate))
        );
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            warmedItems++;
          } else {
            failedItems++;
            if (result.status === 'rejected') {
              errors.push(result.reason?.message || 'Unknown error');
            }
          }
        }
        
        // Check memory limit
        if (this.memoryUsage >= this.config.warming.memoryLimit) {
          errors.push('Memory limit reached');
          break;
        }
        
        // Small delay between batches
        await this.sleep(100);
      }
      
      const result: WarmingResult = {
        totalCandidates: candidates.length,
        warmedItems,
        failedItems,
        memoryUsed: this.memoryUsage,
        duration: Date.now() - startTime,
        strategy,
        errors
      };
      
      this.emit('warming_completed', result);
      this.lastWarmingRun = new Date();
      
      return result;
      
    } finally {
      this.isWarming = false;
    }
  }

  private async warmItem(candidate: WarmingCandidate): Promise<boolean> {
    try {
      // Check if item is already cached
      const exists = await this.cacheManager.exists(candidate.itemId);
      if (exists) {
        // Extend TTL if needed
        await this.cacheManager.expire(candidate.itemId, this.config.warming.ttlExtension);
        return true;
      }
      
      // Load item based on type
      let data: any;
      let size = 0;
      
      if (candidate.itemId.startsWith('grocery:')) {
        // Warm grocery item data
        data = await this.loadGroceryItem(candidate.itemId);
        size = JSON.stringify(data).length;
      } else if (candidate.itemId.startsWith('ollama:')) {
        // Warm Ollama response from SQLite cache
        const queryHash = candidate.itemId.replace('ollama:', '');
        if (this.sqliteDb && candidate.metadata?.query) {
          try {
            const stmt = this.sqliteDb.prepare(`
              SELECT cached_response FROM ollama_queries WHERE query_hash = ?
            `);
            const row = stmt.get(queryHash) as any;
            if (row?.cached_response) {
              data = {
                query: candidate.metadata.query,
                response: row.cached_response,
                cached: true,
                warmedAt: Date.now()
              };
              size = row.cached_response.length;
              
              // Also warm in LLM cache
              await this.llmCache.cacheLLMResponse(
                candidate.metadata.query,
                row.cached_response,
                'llama3.2:3b',
                { ttl: 7200 } // 2 hour TTL for warmed items
              );
            }
          } catch (error) {
            logger.warn('Failed to warm Ollama query', 'CACHE_WARMER', { queryHash, error });
          }
        }
      } else if (candidate.itemId.startsWith('llm:')) {
        // Warm LLM response (legacy support)
        const prompt = candidate.metadata?.prompt;
        if (prompt) {
          const cached = await this.llmCache.getCachedLLMResponse(prompt, 'llama3.2:3b');
          if (cached) {
            data = cached;
            size = JSON.stringify(cached).length;
          }
        }
      } else {
        // Generic warming
        data = await this.loadGenericItem(candidate.itemId);
        size = JSON.stringify(data).length;
      }
      
      if (data) {
        // Cache the warmed data with appropriate namespace
        const namespace = candidate.itemId.startsWith('grocery:') ? 'grocery' :
                         candidate.itemId.startsWith('ollama:') ? 'llm' :
                         'default';
        
        await this.cacheManager.set(
          candidate.itemId,
          data,
          {
            ttl: this.config.warming.ttlExtension / 1000,
            namespace,
            tags: [candidate.reason, `priority:${candidate.priority}`]
          }
        );
        
        this.memoryUsage += size;
        
        this.emit('item_warmed', {
          itemId: candidate.itemId,
          size,
          priority: candidate.priority,
          reason: candidate.reason
        });
        
        metrics.increment('cache_warmer.item_warmed');
        metrics.increment(`cache_warmer.warmed.${candidate.reason}`);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      this.emit('warming_error', {
        itemId: candidate.itemId,
        error: error instanceof Error ? error.message : String(error)
      });
      metrics.increment('cache_warmer.warming_error');
      return false;
    }
  }

  /**
   * Initialize SQLite database for persistent analytics
   */
  private initializeSQLite(): void {
    try {
      const dbPath = path.join(process.cwd(), 'data', 'cache-analytics.db');
      this.sqliteDb = new Database(dbPath);
      
      // Create analytics tables
      this.sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS access_patterns (
          item_id TEXT PRIMARY KEY,
          access_count INTEGER DEFAULT 0,
          last_accessed INTEGER,
          avg_load_time REAL,
          hit_rate REAL,
          score REAL,
          category TEXT,
          related_items TEXT,
          peak_hours TEXT,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS ollama_queries (
          query_hash TEXT PRIMARY KEY,
          query TEXT,
          frequency INTEGER DEFAULT 0,
          avg_response_time REAL,
          last_used INTEGER,
          embeddings TEXT,
          cached_response TEXT,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE TABLE IF NOT EXISTS grocery_analytics (
          item_name TEXT PRIMARY KEY,
          walmart_id TEXT,
          category TEXT,
          search_count INTEGER DEFAULT 0,
          purchase_count INTEGER DEFAULT 0,
          avg_price REAL,
          price_history TEXT,
          related_items TEXT,
          seasonal_pattern TEXT,
          updated_at INTEGER DEFAULT (strftime('%s', 'now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_access_score ON access_patterns(score DESC);
        CREATE INDEX IF NOT EXISTS idx_ollama_frequency ON ollama_queries(frequency DESC);
        CREATE INDEX IF NOT EXISTS idx_grocery_search ON grocery_analytics(search_count DESC);
      `);
      
      logger.info('SQLite analytics database initialized', 'CACHE_WARMER');
    } catch (error) {
      logger.error('Failed to initialize SQLite', 'CACHE_WARMER', { error });
    }
  }
  
  /**
   * Initialize common grocery items and categories
   */
  private async initializeGroceryData(): Promise<void> {
    // Top 100 most common grocery items at Walmart
    const topGroceryItems = [
      // Dairy
      'milk', 'eggs', 'butter', 'cheese', 'yogurt', 'cream cheese', 'sour cream',
      // Bread & Bakery
      'bread', 'bagels', 'tortillas', 'rolls', 'muffins', 'croissants',
      // Meat & Seafood
      'chicken breast', 'ground beef', 'bacon', 'sausage', 'ham', 'turkey', 'salmon', 'shrimp',
      // Produce
      'bananas', 'apples', 'oranges', 'grapes', 'strawberries', 'lettuce', 'tomatoes', 
      'onions', 'potatoes', 'carrots', 'broccoli', 'bell peppers', 'avocados',
      // Pantry Staples
      'rice', 'pasta', 'cereal', 'oatmeal', 'flour', 'sugar', 'salt', 'pepper',
      'olive oil', 'vegetable oil', 'peanut butter', 'jelly', 'honey', 'coffee', 'tea',
      // Canned Goods
      'canned tomatoes', 'tomato sauce', 'canned beans', 'soup', 'tuna', 'corn', 'green beans',
      // Frozen
      'frozen pizza', 'ice cream', 'frozen vegetables', 'frozen fruit', 'frozen meals',
      // Snacks
      'chips', 'crackers', 'cookies', 'pretzels', 'popcorn', 'nuts', 'granola bars',
      // Beverages
      'water', 'soda', 'juice', 'sports drinks', 'energy drinks', 'beer', 'wine',
      // Household
      'paper towels', 'toilet paper', 'dish soap', 'laundry detergent', 'trash bags'
    ];
    
    topGroceryItems.forEach(item => this.commonGroceryItems.add(item));
    
    // Category associations for predictive warming
    this.categoryAssociations.set('dairy', ['milk', 'eggs', 'butter', 'cheese', 'yogurt']);
    this.categoryAssociations.set('bakery', ['bread', 'bagels', 'tortillas', 'rolls']);
    this.categoryAssociations.set('meat', ['chicken', 'beef', 'pork', 'turkey', 'bacon']);
    this.categoryAssociations.set('produce', ['bananas', 'apples', 'lettuce', 'tomatoes']);
    this.categoryAssociations.set('breakfast', ['eggs', 'bacon', 'bread', 'milk', 'cereal', 'coffee']);
    this.categoryAssociations.set('dinner', ['chicken', 'pasta', 'rice', 'vegetables', 'sauce']);
    
    logger.info('Grocery data initialized', 'CACHE_WARMER', {
      commonItems: this.commonGroceryItems.size,
      categories: this.categoryAssociations.size
    });
  }
  
  /**
   * Record Ollama query for pattern analysis
   */
  public recordOllamaQuery(
    query: string,
    responseTime: number,
    cached: boolean,
    response?: string
  ): void {
    const queryHash = this.hashQuery(query);
    const pattern = this.ollamaQueryPatterns.get(queryHash) || {
      query,
      frequency: 0,
      avgResponseTime: 0,
      lastUsed: Date.now()
    };
    
    pattern.frequency++;
    pattern.avgResponseTime = (pattern.avgResponseTime * (pattern.frequency - 1) + responseTime) / pattern.frequency;
    pattern.lastUsed = Date.now();
    
    this.ollamaQueryPatterns.set(queryHash, pattern);
    
    // Persist to SQLite
    if (this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          INSERT INTO ollama_queries (query_hash, query, frequency, avg_response_time, last_used, cached_response)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(query_hash) DO UPDATE SET
            frequency = frequency + 1,
            avg_response_time = (avg_response_time * frequency + ?) / (frequency + 1),
            last_used = ?,
            cached_response = COALESCE(?, cached_response),
            updated_at = strftime('%s', 'now')
        `);
        
        stmt.run(
          queryHash,
          query,
          1,
          responseTime,
          pattern.lastUsed,
          cached && response ? response : null,
          responseTime,
          pattern.lastUsed,
          cached && response ? response : null
        );
      } catch (error) {
        logger.error('Failed to persist Ollama query', 'CACHE_WARMER', { error });
      }
    }
    
    // Track in metrics
    metrics.increment('cache_warmer.ollama_query_recorded');
    if (!cached) {
      metrics.increment('cache_warmer.ollama_cache_miss');
    }
  }
  
  /**
   * Get predicted Ollama queries for warming
   */
  private async getPredictedOllamaQueries(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    
    if (!this.sqliteDb) return candidates;
    
    try {
      // Get top frequent queries from last 24 hours
      const stmt = this.sqliteDb.prepare(`
        SELECT query_hash, query, frequency, avg_response_time, cached_response
        FROM ollama_queries
        WHERE last_used > ? AND cached_response IS NOT NULL
        ORDER BY frequency DESC, avg_response_time DESC
        LIMIT 50
      `);
      
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      const rows = stmt.all(oneDayAgo) as any[];
      
      for (const row of rows) {
        candidates.push({
          itemId: `ollama:${row.query_hash}`,
          priority: Math.min(row.frequency / 10, 1), // Normalize to 0-1
          reason: 'frequent_ollama_query',
          estimatedSize: row.cached_response ? row.cached_response.length : 5000,
          metadata: {
            query: row.query,
            frequency: row.frequency,
            avgResponseTime: row.avg_response_time
          }
        });
      }
      
      logger.debug('Predicted Ollama queries for warming', 'CACHE_WARMER', {
        candidateCount: candidates.length
      });
    } catch (error) {
      logger.error('Failed to get predicted Ollama queries', 'CACHE_WARMER', { error });
    }
    
    return candidates;
  }
  
  /**
   * Get grocery items for predictive warming based on patterns
   */
  private async getPredictedGroceryItems(): Promise<WarmingCandidate[]> {
    const candidates: WarmingCandidate[] = [];
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    // Morning (6-10am): Breakfast items
    if (currentHour >= 6 && currentHour <= 10) {
      const breakfastItems = this.categoryAssociations.get('breakfast') || [];
      for (const item of breakfastItems) {
        candidates.push({
          itemId: `grocery:${item}`,
          priority: 0.9,
          reason: 'time_based_breakfast',
          estimatedSize: 2048,
          metadata: { category: 'breakfast', timeSlot: 'morning' }
        });
      }
    }
    
    // Lunch (11am-2pm): Quick meal items
    if (currentHour >= 11 && currentHour <= 14) {
      const lunchItems = ['bread', 'deli meat', 'cheese', 'chips', 'soda'];
      for (const item of lunchItems) {
        if (this.commonGroceryItems.has(item)) {
          candidates.push({
            itemId: `grocery:${item}`,
            priority: 0.8,
            reason: 'time_based_lunch',
            estimatedSize: 2048,
            metadata: { category: 'lunch', timeSlot: 'midday' }
          });
        }
      }
    }
    
    // Dinner prep (4-7pm): Dinner ingredients
    if (currentHour >= 16 && currentHour <= 19) {
      const dinnerItems = this.categoryAssociations.get('dinner') || [];
      for (const item of dinnerItems) {
        candidates.push({
          itemId: `grocery:${item}`,
          priority: 0.95,
          reason: 'time_based_dinner',
          estimatedSize: 2048,
          metadata: { category: 'dinner', timeSlot: 'evening' }
        });
      }
    }
    
    // Weekend shopping patterns (Saturday/Sunday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Add bulk items and weekly essentials
      const weekendItems = ['milk', 'bread', 'eggs', 'toilet paper', 'paper towels'];
      for (const item of weekendItems) {
        candidates.push({
          itemId: `grocery:${item}`,
          priority: 0.85,
          reason: 'weekend_shopping',
          estimatedSize: 2048,
          metadata: { pattern: 'weekly_essentials' }
        });
      }
    }
    
    // Always warm top 10 most common items
    const topItems = Array.from(this.commonGroceryItems).slice(0, 10);
    for (const item of topItems) {
      candidates.push({
        itemId: `grocery:${item}`,
        priority: 0.7,
        reason: 'common_item',
        estimatedSize: 2048,
        metadata: { rank: 'top10' }
      });
    }
    
    return candidates;
  }
  
  private hashQuery(query: string): string {
    return require('crypto')
      .createHash('sha256')
      .update(query.toLowerCase().trim())
      .digest('hex')
      .substring(0, 16);
  }
  
  private async loadGroceryItem(itemId: string): Promise<any> {
    const itemKey = itemId.replace('grocery:', '');
    
    // Try to load from database first
    if (this.sqliteDb) {
      try {
        const stmt = this.sqliteDb.prepare(`
          SELECT * FROM grocery_analytics WHERE item_name = ?
        `);
        const row = stmt.get(itemKey) as any;
        
        if (row) {
          return {
            name: row.item_name,
            walmartId: row.walmart_id,
            category: row.category,
            avgPrice: row.avg_price,
            searchCount: row.search_count,
            relatedItems: row.related_items ? JSON.parse(row.related_items) : []
          };
        }
      } catch (error) {
        logger.warn('Failed to load grocery item from DB', 'CACHE_WARMER', { itemKey, error });
      }
    }
    
    // Fallback to common items with realistic Walmart data
    const commonItems: Record<string, any> = {
      'milk': { 
        name: 'Great Value Whole Milk', 
        category: 'Dairy', 
        price: 3.98, 
        unit: 'gallon',
        walmartId: '10450114',
        brand: 'Great Value'
      },
      'bread': { 
        name: 'Wonder Bread Classic White', 
        category: 'Bakery', 
        price: 2.48, 
        unit: 'loaf',
        walmartId: '10403055',
        brand: 'Wonder'
      },
      'eggs': { 
        name: 'Great Value Large White Eggs', 
        category: 'Dairy', 
        price: 4.92, 
        unit: '18 count',
        walmartId: '145038337',
        brand: 'Great Value'
      },
      'chicken': { 
        name: 'Tyson Boneless Skinless Chicken Breasts', 
        category: 'Meat', 
        price: 11.97, 
        unit: '2.5 lb',
        walmartId: '10309170',
        brand: 'Tyson'
      },
      'bananas': { 
        name: 'Fresh Bananas', 
        category: 'Produce', 
        price: 0.58, 
        unit: 'lb',
        walmartId: '44390948',
        brand: 'Fresh Produce'
      },
      'bacon': {
        name: 'Oscar Mayer Naturally Hardwood Smoked Bacon',
        category: 'Meat',
        price: 6.98,
        unit: '16 oz',
        walmartId: '13923235',
        brand: 'Oscar Mayer'
      },
      'cheese': {
        name: 'Kraft Singles American Cheese Slices',
        category: 'Dairy',
        price: 4.98,
        unit: '16 slices',
        walmartId: '10295577',
        brand: 'Kraft'
      }
    };
    
    return commonItems[itemKey] || null;
  }

  private async loadGenericItem(itemId: string): Promise<any> {
    // Generic item loading logic
    return { id: itemId, timestamp: Date.now() };
  }

  // Utility methods
  private deduplicateCandidates(candidates: WarmingCandidate[]): WarmingCandidate[] {
    const seen = new Map<string, WarmingCandidate>();
    
    for (const candidate of candidates) {
      const existing = seen.get(candidate.itemId);
      if (!existing || candidate.priority > existing.priority) {
        seen.set(candidate.itemId, candidate);
      }
    }
    
    return Array.from(seen.values());
  }

  private applyMemoryLimits(candidates: WarmingCandidate[]): WarmingCandidate[] {
    const limited: WarmingCandidate[] = [];
    let estimatedMemory = this.memoryUsage;
    
    for (const candidate of candidates) {
      if (estimatedMemory + candidate.estimatedSize > this.config.warming.memoryLimit) {
        break;
      }
      
      limited.push(candidate);
      estimatedMemory += candidate.estimatedSize;
      
      if (limited.length >= this.config.warming.maxItemsPerRun) {
        break;
      }
    }
    
    return limited;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Scheduled tasks
  private setupScheduledTasks(): void {
    for (const schedule of this.config.schedules) {
      try {
        const task = cron.schedule(schedule.cron, async () => {
          console.log(`Running scheduled warming: ${schedule.name}`);
          
          if (schedule.items.length > 0) {
            // Warm specific items
            const candidates = schedule.items.map(itemId => ({
              itemId,
              priority: 1,
              reason: `scheduled_${schedule.name}`,
              estimatedSize: 1024 * 10
            }));
            
            for (const candidate of candidates) {
              await this.warmItem(candidate);
            }
          } else {
            // Run strategy-based warming
            await this.warmCache(schedule.strategy);
          }
        });
        
        this.scheduledTasks.push(task);
        
      } catch (error) {
        console.error(`Failed to setup schedule ${schedule.name}:`, error);
      }
    }
  }

  private startContinuousWarming(): void {
    if (!this.config.warming.interval) return;
    
    this.warmingTimer = setInterval(async () => {
      if (!this.isWarming) {
        await this.warmCache('continuous');
      }
    }, this.config.warming.interval);
  }

  private startAnalyticsCollection(): void {
    // Periodically decay old patterns
    setInterval(() => {
      this.decayPatterns();
    }, 24 * 60 * 60 * 1000); // Daily
    
    // Periodically persist analytics
    this.analyticsTimer = setInterval(() => {
      this.persistAnalytics();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private decayPatterns(): void {
    const cutoffTime = Date.now() - (this.config.analytics.retentionDays * 24 * 60 * 60 * 1000);
    
    for (const [itemId, pattern] of this.accessPatterns) {
      // Remove very old patterns
      if (pattern.lastAccessed < cutoffTime) {
        this.accessPatterns.delete(itemId);
        continue;
      }
      
      // Decay scores
      pattern.score *= this.config.analytics.decayFactor;
      pattern.accessCount = Math.floor(pattern.accessCount * this.config.analytics.decayFactor);
      
      // Trim peak hours array
      if (pattern.peakHours && pattern.peakHours.length > 168) { // Keep 1 week of hourly data
        pattern.peakHours = pattern.peakHours.slice(-168);
      }
    }
  }

  private scheduleAnalyticsPersistence(): void {
    // Debounced persistence
    if (this.analyticsTimer) return;
    
    this.analyticsTimer = setTimeout(() => {
      this.persistAnalytics();
      this.analyticsTimer = undefined;
    }, 1000);
  }

  private async persistAnalytics(): Promise<void> {
    try {
      const analyticsKey = `${this.config.redis.analyticsPrefix}patterns`;
      const data = Array.from(this.accessPatterns.entries());
      
      await this.redis.set(
        analyticsKey,
        JSON.stringify(data),
        'EX',
        this.config.analytics.retentionDays * 24 * 60 * 60
      );
      
    } catch (error) {
      console.error('Failed to persist analytics:', error);
    }
  }

  private async loadAnalytics(): Promise<void> {
    try {
      const analyticsKey = `${this.config.redis.analyticsPrefix}patterns`;
      const data = await this.redis.get(analyticsKey);
      
      if (data) {
        const patterns = JSON.parse(data) as Array<[string, AccessPattern]>;
        this.accessPatterns = new Map(patterns);
      }
      
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  // Public API
  public getStatistics(): {
    patternsTracked: number;
    memoryUsage: number;
    lastWarmingRun?: Date;
    isWarming: boolean;
    topItems: Array<{ itemId: string; score: number; accessCount: number }>;
    ollamaStats: {
      queriesTracked: number;
      avgResponseTime: number;
      cacheHitRate: number;
    };
    groceryStats: {
      itemsTracked: number;
      categoriesLoaded: number;
      commonItemsCached: number;
    };
  } {
    const topItems = Array.from(this.accessPatterns.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({
        itemId: p.itemId,
        score: p.score,
        accessCount: p.accessCount
      }));
    
    // Calculate Ollama stats
    let totalOllamaResponseTime = 0;
    let ollamaHits = 0;
    this.ollamaQueryPatterns.forEach(pattern => {
      totalOllamaResponseTime += pattern.avgResponseTime * pattern.frequency;
      if (pattern.frequency > 1) ollamaHits++;
    });
    
    const avgOllamaResponseTime = this.ollamaQueryPatterns.size > 0 
      ? totalOllamaResponseTime / Array.from(this.ollamaQueryPatterns.values())
          .reduce((sum, p) => sum + p.frequency, 0)
      : 0;
    
    const ollamaCacheHitRate = this.ollamaQueryPatterns.size > 0
      ? ollamaHits / this.ollamaQueryPatterns.size
      : 0;
    
    return {
      patternsTracked: this.accessPatterns.size,
      memoryUsage: this.memoryUsage,
      lastWarmingRun: this.lastWarmingRun,
      isWarming: this.isWarming,
      topItems,
      ollamaStats: {
        queriesTracked: this.ollamaQueryPatterns.size,
        avgResponseTime: avgOllamaResponseTime,
        cacheHitRate: ollamaCacheHitRate
      },
      groceryStats: {
        itemsTracked: this.commonGroceryItems.size,
        categoriesLoaded: this.categoryAssociations.size,
        commonItemsCached: Array.from(this.commonGroceryItems).filter(item => 
          this.accessPatterns.has(`grocery:${item}`)
        ).length
      }
    };
  }
  
  /**
   * Warm specific grocery categories
   */
  public async warmGroceryCategory(category: string): Promise<WarmingResult> {
    const items = this.categoryAssociations.get(category.toLowerCase()) || [];
    const candidates = items.map(item => ({
      itemId: `grocery:${item}`,
      priority: 1,
      reason: `category_${category}`,
      estimatedSize: 2048
    }));
    
    return this.processWarmingCandidates(candidates, `category_${category}`);
  }
  
  /**
   * Pre-warm common NLP queries for grocery items
   */
  public async warmCommonNLPQueries(): Promise<WarmingResult> {
    const commonQueries = [
      "Add milk to my list",
      "What's the price of eggs?",
      "Show me deals on chicken",
      "Find organic vegetables",
      "Compare prices for bread",
      "Add bananas to cart",
      "What's on sale today?",
      "Show me gluten-free options",
      "Find dairy alternatives",
      "Search for breakfast items"
    ];
    
    const candidates: WarmingCandidate[] = commonQueries.map(query => ({
      itemId: `ollama:${this.hashQuery(query)}`,
      priority: 0.8,
      reason: 'common_nlp_query',
      estimatedSize: 5000,
      metadata: { query }
    }));
    
    return this.processWarmingCandidates(candidates, 'common_nlp');
  }
  
  /**
   * Process a list of warming candidates
   */
  private async processWarmingCandidates(
    candidates: WarmingCandidate[],
    strategy: string
  ): Promise<WarmingResult> {
    const startTime = Date.now();
    let warmedItems = 0;
    let failedItems = 0;
    const errors: string[] = [];
    
    for (const candidate of candidates) {
      const success = await this.warmItem(candidate);
      if (success) {
        warmedItems++;
      } else {
        failedItems++;
      }
      
      // Check memory limit
      if (this.memoryUsage >= this.config.warming.memoryLimit) {
        errors.push('Memory limit reached');
        break;
      }
    }
    
    return {
      totalCandidates: candidates.length,
      warmedItems,
      failedItems,
      memoryUsed: this.memoryUsage,
      duration: Date.now() - startTime,
      strategy,
      errors
    };
  }

  public async forceWarm(itemIds: string[]): Promise<WarmingResult> {
    const candidates = itemIds.map(itemId => ({
      itemId,
      priority: 1,
      reason: 'manual',
      estimatedSize: 1024 * 10
    }));
    
    const startTime = Date.now();
    let warmedItems = 0;
    let failedItems = 0;
    
    for (const candidate of candidates) {
      const success = await this.warmItem(candidate);
      if (success) {
        warmedItems++;
      } else {
        failedItems++;
      }
    }
    
    return {
      totalCandidates: candidates.length,
      warmedItems,
      failedItems,
      memoryUsed: this.memoryUsage,
      duration: Date.now() - startTime,
      strategy: 'manual',
      errors: []
    };
  }

  public clearCache(): void {
    this.accessPatterns.clear();
    this.warmingQueue = [];
    this.memoryUsage = 0;
    
    this.emit('cache_cleared');
  }

  public async shutdown(): Promise<void> {
    // Stop scheduled tasks
    for (const task of this.scheduledTasks) {
      task.stop();
    }
    
    // Clear timers
    if (this.warmingTimer) {
      clearInterval(this.warmingTimer);
    }
    
    if (this.analyticsTimer) {
      clearTimeout(this.analyticsTimer);
    }
    
    // Final analytics persistence
    await this.persistAnalytics();
    
    this.emit('shutdown');
  }
}

export default IntelligentCacheWarmer;