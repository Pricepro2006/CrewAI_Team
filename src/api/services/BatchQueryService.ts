/**
 * Batch Query Service - Optimizes database access by batching multiple lookups
 * Reduces N+1 queries and improves performance for bulk operations
 */

import { logger } from "../../utils/logger.js";
import { getDatabaseManager } from "../../database/DatabaseManager.js";
import type Database from "better-sqlite3";
import type { WalmartProduct } from "../../types/walmart-grocery.js";

interface BatchResult<T> {
  data: Map<string, T>;
  errors: Map<string, Error>;
  timing: number;
}

interface ProductBatchOptions {
  includeOutOfStock?: boolean;
  includePricing?: boolean;
  includeInventory?: boolean;
}

export class BatchQueryService {
  private static instance: BatchQueryService;
  private dbManager: any;
  private batchQueue: Map<string, Set<string>> = new Map();
  private batchTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly BATCH_DELAY = 10; // milliseconds
  private readonly MAX_BATCH_SIZE = 1000;

  private constructor() {
    this.dbManager = getDatabaseManager();
  }

  /**
   * Execute a database operation with proper connection handling
   */
  private async executeWithConnection<T>(operation: (db: Database.Database) => T): Promise<T> {
    return this.dbManager.executeQuery(operation);
  }

  static getInstance(): BatchQueryService {
    if (!BatchQueryService.instance) {
      BatchQueryService.instance = new BatchQueryService();
    }
    return BatchQueryService.instance;
  }

  /**
   * Batch fetch products by IDs with automatic batching
   */
  async batchFetchProducts(
    productIds: string[],
    options: ProductBatchOptions = {}
  ): Promise<BatchResult<WalmartProduct>> {
    const startTime = Date.now();
    const result: BatchResult<WalmartProduct> = {
      data: new Map(),
      errors: new Map(),
      timing: 0
    };

    try {
      // Split into chunks if needed
      const chunks = this.chunkArray(productIds, this.MAX_BATCH_SIZE);
      
      for (const chunk of chunks) {
        await this.fetchProductChunk(chunk, options, result);
      }

      result.timing = Date.now() - startTime;

      logger.info("Batch product fetch completed", "BATCH_QUERY", {
        requested: productIds.length,
        fetched: result.data.size,
        errors: result.errors.size,
        timing: result.timing
      });

      return result;
    } catch (error) {
      logger.error("Batch product fetch failed", "BATCH_QUERY", { error });
      throw error;
    }
  }

  /**
   * Fetch a chunk of products
   */
  private async fetchProductChunk(
    productIds: string[],
    options: ProductBatchOptions,
    result: BatchResult<WalmartProduct>
  ): Promise<void> {
    const placeholders = productIds.map(() => '?').join(',');
    let query = `
      SELECT 
        p.*,
        pi.quantity_available as inventory_quantity,
        pi.last_updated as inventory_updated,
        pp.sale_price,
        pp.regular_price,
        pp.discount_percentage,
        pp.price_updated_at
      FROM walmart_products p
      LEFT JOIN product_inventory pi ON p.id = pi.product_id
      LEFT JOIN product_pricing pp ON p.id = pp.product_id
      WHERE p.id IN (${placeholders})
    `;

    if (!options.includeOutOfStock) {
      query += ' AND p.in_stock = 1';
    }

    try {
      const rows = await this.executeWithConnection((db: Database.Database) => {
        const stmt = db.prepare(query);
        return stmt.all(...productIds) as any[];
      });

      for (const row of rows) {
        const product: WalmartProduct = {
          id: row.id,
          walmartId: row.walmart_id || row.id,
          name: row.name,
          brand: row.brand,
          category: row.category,
          description: row.description || '',
          price: options.includePricing ? row.sale_price || row.current_price : row.current_price,
          regularPrice: options.includePricing ? row.regular_price : undefined,
          unit: row.unit,
          imageUrl: row.image_url,
          inStock: row.in_stock === 1,
          stock: options.includeInventory ? row.inventory_quantity : undefined,
          images: [],
          availability: {
            online: row.in_stock === 1,
            stores: []
          },
          metadata: {
            lastUpdated: row.inventory_updated || row.updated_at,
            source: 'batch_query'
          }
        } as unknown as WalmartProduct;

        result.data.set(row.id, product);
      }

      // Track missing products as errors
      for (const id of productIds) {
        if (!result.data.has(id)) {
          result.errors.set(id, new Error(`Product not found: ${id}`));
        }
      }
    } catch (error: any) {
      for (const id of productIds) {
        result.errors.set(id, error);
      }
    }
  }

  /**
   * Batch fetch user purchase history with optimized queries
   */
  async batchFetchPurchaseHistory(
    userId: string,
    productIds?: string[],
    dateRange?: { from: Date; to: Date }
  ): Promise<Map<string, any[]>> {
    const startTime = Date.now();
    
    try {
      let query = `
        SELECT 
          pr.product_id,
          pr.product_name,
          pr.purchase_date,
          pr.quantity,
          pr.unit_price,
          pr.total_price,
          pr.store_id,
          pr.store_location,
          COUNT(*) OVER (PARTITION BY pr.product_id) as total_purchases,
          AVG(pr.unit_price) OVER (PARTITION BY pr.product_id) as avg_price,
          SUM(pr.quantity) OVER (PARTITION BY pr.product_id) as total_quantity
        FROM purchase_records pr
        WHERE pr.user_id = ?
      `;

      const params: any[] = [userId];

      if (productIds && productIds.length > 0) {
        const placeholders = productIds.map(() => '?').join(',');
        query += ` AND pr.product_id IN (${placeholders})`;
        params.push(...productIds);
      }

      if (dateRange) {
        query += ' AND pr.purchase_date BETWEEN ? AND ?';
        params.push(dateRange?.from?.toISOString(), dateRange?.to?.toISOString());
      }

      query += ' ORDER BY pr.product_id, pr.purchase_date DESC';

      const rows = await this.executeWithConnection((db: Database.Database) => {
        const stmt = db.prepare(query);
        return stmt.all(...params) as any[];
      });

      // Group by product ID
      const historyMap = new Map<string, any[]>();
      
      for (const row of rows) {
        if (!historyMap.has(row.product_id)) {
          historyMap.set(row.product_id, []);
        }
        historyMap.get(row.product_id)!.push({
          date: row.purchase_date,
          quantity: row.quantity,
          price: row.unit_price,
          total: row.total_price,
          store: row.store_location,
          stats: {
            totalPurchases: row.total_purchases,
            averagePrice: row.avg_price,
            totalQuantity: row.total_quantity
          }
        });
      }

      const timing = Date.now() - startTime;
      
      logger.info("Batch purchase history fetch completed", "BATCH_QUERY", {
        userId,
        products: historyMap.size,
        records: rows.length,
        timing
      });

      return historyMap;
    } catch (error) {
      logger.error("Batch purchase history fetch failed", "BATCH_QUERY", { error });
      throw error;
    }
  }

  /**
   * Batch fetch price history for multiple products
   */
  async batchFetchPriceHistory(
    productIds: string[],
    days: number = 30
  ): Promise<Map<string, any[]>> {
    const startTime = Date.now();
    
    try {
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const chunks = this.chunkArray(productIds, 100); // Smaller chunks for price history
      const priceMap = new Map<string, any[]>();

      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        const query = `
          SELECT 
            product_id,
            price,
            recorded_at,
            store_id,
            promotion_type,
            promotion_value
          FROM price_history
          WHERE product_id IN (${placeholders})
          AND recorded_at >= ?
          ORDER BY product_id, recorded_at DESC
        `;

        const rows = await this.executeWithConnection((db: Database.Database) => {
          const stmt = db.prepare(query);
          return stmt.all(...chunk, cutoffDate) as any[];
        });

        for (const row of rows) {
          if (!priceMap.has(row.product_id)) {
            priceMap.set(row.product_id, []);
          }
          priceMap.get(row.product_id)!.push({
            price: row.price,
            date: row.recorded_at,
            store: row.store_id,
            promotion: row.promotion_type ? {
              type: row.promotion_type,
              value: row.promotion_value
            } : null
          });
        }
      }

      const timing = Date.now() - startTime;
      
      logger.info("Batch price history fetch completed", "BATCH_QUERY", {
        products: priceMap.size,
        days,
        timing
      });

      return priceMap;
    } catch (error) {
      logger.error("Batch price history fetch failed", "BATCH_QUERY", { error });
      throw error;
    }
  }

  /**
   * Batch update product prices
   */
  async batchUpdatePrices(
    updates: Array<{ productId: string; price: number; store?: string }>
  ): Promise<{ success: number; failed: number }> {
    const startTime = Date.now();
    let success = 0;
    let failed = 0;

    try {
      await this.executeWithConnection((db: Database.Database) => {
        const transaction = db.transaction((updates: any) => {
          for (const update of updates) {
            try {
              // Update current price
              const updateStmt = db.prepare(`
                UPDATE walmart_products 
                SET current_price = ?, updated_at = datetime('now')
                WHERE id = ?
              `);
              updateStmt.run(update.price, update.productId);

              // Insert price history
              const historyStmt = db.prepare(`
                INSERT INTO price_history (product_id, price, store_id, recorded_at)
                VALUES (?, ?, ?, datetime('now'))
              `);
              historyStmt.run(update.productId, update.price, update.store || null);

              success++;
            } catch (error) {
              failed++;
              logger.warn("Failed to update price", "BATCH_QUERY", { 
                productId: update.productId, 
                error 
              });
            }
          }
        });

        return transaction(updates);
      });
      
      const timing = Date.now() - startTime;
      
      logger.info("Batch price update completed", "BATCH_QUERY", {
        total: updates.length,
        success,
        failed,
        timing
      });

      return { success, failed };
    } catch (error) {
      logger.error("Batch price update transaction failed", "BATCH_QUERY", { error });
      throw error;
    }
  }

  /**
   * Batch check product availability
   */
  async batchCheckAvailability(
    productIds: string[],
    storeId?: string
  ): Promise<Map<string, boolean>> {
    const startTime = Date.now();
    const availabilityMap = new Map<string, boolean>();

    try {
      const chunks = this.chunkArray(productIds, 500);

      for (const chunk of chunks) {
        const placeholders = chunk.map(() => '?').join(',');
        let query = `
          SELECT 
            p.id,
            p.in_stock,
            COALESCE(si.quantity_available, 0) as store_quantity
          FROM walmart_products p
          LEFT JOIN store_inventory si ON p.id = si.product_id
          WHERE p.id IN (${placeholders})
        `;

        const params: any[] = [...chunk];

        if (storeId) {
          query += ' AND (si.store_id = ? OR si.store_id IS NULL)';
          params.push(storeId);
        }

        const rows = await this.executeWithConnection((db: Database.Database) => {
          const stmt = db.prepare(query);
          return stmt.all(...params) as any[];
        });

        for (const row of rows) {
          const available = storeId 
            ? row.store_quantity > 0 
            : row.in_stock === 1;
          availabilityMap.set(row.id, available);
        }
      }

      // Set false for missing products
      for (const id of productIds) {
        if (!availabilityMap.has(id)) {
          availabilityMap.set(id, false);
        }
      }

      const timing = Date.now() - startTime;
      
      logger.info("Batch availability check completed", "BATCH_QUERY", {
        products: productIds.length,
        available: Array.from(availabilityMap.values()).filter(v => v).length,
        storeId,
        timing
      });

      return availabilityMap;
    } catch (error) {
      logger.error("Batch availability check failed", "BATCH_QUERY", { error });
      throw error;
    }
  }

  /**
   * Helper to chunk arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Queue a batch operation for delayed execution
   */
  async queueBatchOperation<T>(
    batchKey: string,
    ids: string[],
    operation: (ids: string[]) => Promise<T>
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      // Add IDs to batch queue
      if (!this.batchQueue.has(batchKey)) {
        this.batchQueue.set(batchKey, new Set());
      }
      
      const queue = this.batchQueue.get(batchKey)!;
      ids.forEach(id => queue.add(id));

      // Clear existing timer
      if (this.batchTimers.has(batchKey)) {
        clearTimeout(this.batchTimers.get(batchKey)!);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        const batchIds = Array.from(queue);
        queue.clear();
        this.batchTimers.delete(batchKey);

        try {
          const result = await operation(batchIds);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, this.BATCH_DELAY);

      this.batchTimers.set(batchKey, timer);
    });
  }
}

export default BatchQueryService;