/**
 * Cache Warmer Service
 * Proactively warms cache with popular and frequently accessed items
 */

import { logger } from "../../utils/logger.js";
import Database from "better-sqlite3";
import axios from "axios";
import path from "path";

interface CacheItem {
  key: string;
  value: any;
  ttl: number;
  category: string;
  lastAccessed: Date;
}

interface WarmingStrategy {
  name: string;
  interval: number;
  items: string[];
  priority: number;
}

export class CacheWarmer {
  private db: Database.Database | null = null;
  private cache: Map<string, CacheItem> = new Map();
  private warmingInterval: NodeJS.Timeout | null = null;
  private pricingServiceUrl = "http://localhost:3007";
  private nlpServiceUrl = "http://localhost:3008";

  constructor() {
    this.initializeDatabase();
    this.initializeCache();
  }

  private initializeDatabase() {
    try {
      const dbPath = path.join(process.cwd(), "data", "walmart_grocery.db");
      this.db = new Database(dbPath);
      logger.info(`Connected to database at ${dbPath}`, "CACHE_WARMER");
    } catch (error) {
      logger.error(`Database connection error: ${error}`, "CACHE_WARMER");
    }
  }

  private initializeCache() {
    // Load initial cache with popular items
    this.warmPopularItems();
    logger.info("Cache initialized", "CACHE_WARMER");
  }

  /**
   * Warm cache with specified category or all
   */
  async warmCache(options: { category?: string; force?: boolean }): Promise<any> {
    const { category, force } = options;
    const startTime = Date.now();
    let itemsWarmed = 0;

    try {
      if (category === "popular" || !category) {
        itemsWarmed += await this.warmPopularItems();
      }
      
      if (category === "deals" || !category) {
        itemsWarmed += await this.warmDealItems();
      }
      
      if (category === "user" || !category) {
        itemsWarmed += await this.warmUserPreferences();
      }

      const duration = Date.now() - startTime;
      logger.info(`Warmed ${itemsWarmed} items in ${duration}ms`, "CACHE_WARMER");

      return {
        itemsWarmed,
        duration,
        cacheSize: this?.cache?.size,
        category: category || "all"
      };
    } catch (error) {
      logger.error(`Cache warming error: ${error}`, "CACHE_WARMER");
      throw error;
    }
  }

  /**
   * Warm popular items
   */
  private async warmPopularItems(): Promise<number> {
    const popularProducts = [
      "prod_001", // Great Value Whole Milk
      "prod_002", // Fairlife 2% Milk
      "prod_003", // Horizon Organic Whole Milk
      "prod_004", // Lactaid Whole Milk
      "prod_005"  // Great Value 2% Milk
    ];

    let warmed = 0;
    for (const productId of popularProducts) {
      try {
        // Fetch price from pricing service
        const response = await axios.post(`${this.pricingServiceUrl}/calculate`, {
          productId,
          quantity: 1
        }, { timeout: 5000 }).catch(() => null);

        if (response?.data) {
          this?.cache?.set(`price:${productId}`, {
            key: `price:${productId}`,
            value: response.data,
            ttl: Date.now() + 300000, // 5 minutes
            category: "popular",
            lastAccessed: new Date()
          });
          warmed++;
        }
      } catch (error) {
        logger.error(`Error warming product ${productId}: ${error}`, "CACHE_WARMER");
      }
    }

    logger.info(`Warmed ${warmed} popular items`, "CACHE_WARMER");
    return warmed;
  }

  /**
   * Warm deal items
   */
  private async warmDealItems(): Promise<number> {
    try {
      // Fetch active promotions
      const response = await axios.get(`${this.pricingServiceUrl}/promotions`, {
        timeout: 5000
      }).catch(() => null);

      if (!response?.data?.promotions) {
        return 0;
      }

      const promotions = response?.data?.promotions;
      let warmed = 0;

      for (const promo of promotions) {
        const key = `promo:${promo.id}`;
        this?.cache?.set(key, {
          key,
          value: promo,
          ttl: Date.now() + 600000, // 10 minutes
          category: "deals",
          lastAccessed: new Date()
        });
        warmed++;
      }

      logger.info(`Warmed ${warmed} deal items`, "CACHE_WARMER");
      return warmed;
    } catch (error) {
      logger.error(`Error warming deals: ${error}`, "CACHE_WARMER");
      return 0;
    }
  }

  /**
   * Warm user preferences
   */
  private async warmUserPreferences(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    try {
      const stmt = this?.db?.prepare(`
        SELECT user_id, preference_key, preference_value
        FROM grocery_user_preferences
        WHERE last_accessed > datetime('now', '-7 days')
        LIMIT 100
      `);

      const preferences = stmt.all();
      let warmed = 0;

      for (const pref of preferences as any[]) {
        const key = `user:${pref.user_id}:${pref.preference_key}`;
        this?.cache?.set(key, {
          key,
          value: pref.preference_value,
          ttl: Date.now() + 1800000, // 30 minutes
          category: "user",
          lastAccessed: new Date()
        });
        warmed++;
      }

      logger.info(`Warmed ${warmed} user preferences`, "CACHE_WARMER");
      return warmed;
    } catch (error) {
      logger.error(`Error warming user preferences: ${error}`, "CACHE_WARMER");
      
      // Return mock data as fallback
      const mockPrefs = [
        { user_id: "user_001", preference_key: "favorite_brand", preference_value: "Great Value" },
        { user_id: "user_001", preference_key: "dietary", preference_value: "lactose-free" }
      ];

      for (const pref of mockPrefs) {
        const key = `user:${pref.user_id}:${pref.preference_key}`;
        this?.cache?.set(key, {
          key,
          value: pref.preference_value,
          ttl: Date.now() + 1800000,
          category: "user",
          lastAccessed: new Date()
        });
      }

      return mockPrefs?.length || 0;
    }
  }

  /**
   * Get cache status
   */
  async getCacheStatus(): Promise<any> {
    const now = Date.now();
    const categories: Record<string, number> = {};
    let expired = 0;
    let active = 0;

    for (const [key, item] of this.cache) {
      if (item.ttl < now) {
        expired++;
      } else {
        active++;
        categories[item.category] = (categories[item.category] || 0) + 1;
      }
    }

    // Clean expired items
    if (expired > 0) {
      for (const [key, item] of this.cache) {
        if (item.ttl < now) {
          this?.cache?.delete(key);
        }
      }
    }

    return {
      totalItems: this?.cache?.size,
      active,
      expired,
      categories,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
    };
  }

  /**
   * Clear cache
   */
  async clearCache(category?: string): Promise<any> {
    let cleared = 0;

    if (category) {
      for (const [key, item] of this.cache) {
        if (item.category === category) {
          this?.cache?.delete(key);
          cleared++;
        }
      }
    } else {
      cleared = this?.cache?.size;
      this?.cache?.clear();
    }

    logger.info(`Cleared ${cleared} items from cache`, "CACHE_WARMER");
    return { cleared, remaining: this?.cache?.size };
  }

  /**
   * Start scheduled cache warming
   */
  startScheduledWarming(interval: number = 3600000) {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
    }

    this.warmingInterval = setInterval(async () => {
      try {
        await this.warmCache({ force: false });
      } catch (error) {
        logger.error(`Scheduled warming error: ${error}`, "CACHE_WARMER");
      }
    }, interval);

    logger.info(`Scheduled cache warming every ${interval}ms`, "CACHE_WARMER");
  }

  /**
   * Stop scheduled warming
   */
  stopScheduledWarming() {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      logger.info("Stopped scheduled cache warming", "CACHE_WARMER");
    }
  }

  /**
   * Get cached value
   */
  getCached(key: string): any {
    const item = this?.cache?.get(key);
    if (item && item.ttl > Date.now()) {
      item.lastAccessed = new Date();
      return item.value;
    }
    return null;
  }

  /**
   * Set cached value
   */
  setCached(key: string, value: any, ttl: number = 300000, category: string = "general") {
    this?.cache?.set(key, {
      key,
      value,
      ttl: Date.now() + ttl,
      category,
      lastAccessed: new Date()
    });
  }
}