#!/usr/bin/env node
/**
 * Grocery Performance Optimization Script
 * 
 * This script applies comprehensive database optimizations for the Walmart Grocery Agent
 * to improve query performance and reduce database bottlenecks.
 * 
 * Performance Goals:
 * - Reduce product search queries from >100ms to <10ms
 * - Optimize JOIN operations for purchase history
 * - Speed up analytics queries for cache warming
 * - Enable efficient full-text search on product names
 * 
 * Usage: npm run optimize:grocery-db
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

interface OptimizationResult {
  operation: string;
  success: boolean;
  duration: number;
  error?: string;
  rowsAffected?: number;
}

interface QueryBenchmark {
  query: string;
  description: string;
  beforeTime?: number;
  afterTime?: number;
  improvement?: number;
}

class GroceryDatabaseOptimizer {
  private db: Database.Database;
  private results: OptimizationResult[] = [];
  private benchmarks: QueryBenchmark[] = [];

  constructor(dbPath: string) {
    console.log(chalk.blue('🚀 Initializing Grocery Database Optimizer...'));
    this.db = new Database(dbPath, { 
      verbose: process.env.DEBUG ? console.log : undefined 
    });
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -2000000'); // 2GB cache
    this.db.pragma('temp_store = MEMORY');
  }

  /**
   * Run benchmark queries before optimization
   */
  private async runBenchmarksBefore(): Promise<void> {
    console.log(chalk.yellow('\n📊 Running pre-optimization benchmarks...'));
    
    this.benchmarks = [
      {
        query: `SELECT * FROM grocery_items WHERE product_name LIKE '%milk%' LIMIT 100`,
        description: 'Product name search (LIKE)'
      },
      {
        query: `
          SELECT gi.*, ph.unit_price, ph.purchase_date 
          FROM grocery_items gi 
          LEFT JOIN purchase_history ph ON gi.product_name = ph.product_name 
          WHERE gi.user_id = 'test_user' 
          ORDER BY ph.purchase_date DESC 
          LIMIT 50
        `,
        description: 'Join with purchase history'
      },
      {
        query: `
          SELECT product_category, COUNT(*) as count, AVG(estimated_price) as avg_price 
          FROM grocery_items 
          GROUP BY product_category
        `,
        description: 'Category aggregation'
      },
      {
        query: `
          SELECT DISTINCT product_name, product_brand, MIN(unit_price) as best_price 
          FROM purchase_history 
          WHERE purchase_date >= date('now', '-30 days') 
          GROUP BY product_name, product_brand 
          ORDER BY best_price
        `,
        description: 'Price analysis query'
      },
      {
        query: `
          SELECT * FROM grocery_items 
          WHERE upc_code = '012345678901'
        `,
        description: 'Barcode lookup'
      }
    ];

    for (const benchmark of this.benchmarks) {
      try {
        const start = performance.now();
        this.db.prepare(benchmark.query).all();
        benchmark.beforeTime = performance.now() - start;
        console.log(chalk.gray(`  ${benchmark.description}: ${benchmark.beforeTime.toFixed(2)}ms`));
      } catch (error) {
        console.log(chalk.red(`  ${benchmark.description}: Failed`));
      }
    }
  }

  /**
   * Run benchmark queries after optimization
   */
  private async runBenchmarksAfter(): Promise<void> {
    console.log(chalk.yellow('\n📊 Running post-optimization benchmarks...'));
    
    for (const benchmark of this.benchmarks) {
      try {
        const start = performance.now();
        this.db.prepare(benchmark.query).all();
        benchmark.afterTime = performance.now() - start;
        
        if (benchmark.beforeTime && benchmark.afterTime) {
          benchmark.improvement = ((benchmark.beforeTime - benchmark.afterTime) / benchmark.beforeTime) * 100;
          const improvementStr = benchmark.improvement > 0 
            ? chalk.green(`+${benchmark.improvement.toFixed(1)}%`)
            : chalk.red(`${benchmark.improvement.toFixed(1)}%`);
          
          console.log(chalk.gray(
            `  ${benchmark.description}: ${benchmark.afterTime.toFixed(2)}ms (${improvementStr})`
          ));
        }
      } catch (error) {
        console.log(chalk.red(`  ${benchmark.description}: Failed`));
      }
    }
  }

  /**
   * Apply a single optimization step
   */
  private applyOptimization(name: string, sql: string): OptimizationResult {
    const start = performance.now();
    const result: OptimizationResult = {
      operation: name,
      success: false,
      duration: 0
    };

    try {
      const stmt = this.db.prepare(sql);
      const info = stmt.run();
      
      result.success = true;
      result.duration = performance.now() - start;
      result.rowsAffected = info.changes;
      
      console.log(chalk.green(`✓ ${name} (${result.duration.toFixed(2)}ms)`));
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.duration = performance.now() - start;
      
      // Some indexes might already exist, which is okay
      if (result.error.includes('already exists')) {
        result.success = true;
        console.log(chalk.gray(`○ ${name} (already exists)`));
      } else {
        console.log(chalk.red(`✗ ${name}: ${result.error}`));
      }
    }

    this.results.push(result);
    return result;
  }

  /**
   * Create full-text search capabilities
   */
  private createFullTextSearch(): void {
    console.log(chalk.cyan('\n🔍 Creating full-text search indexes...'));

    // Check if FTS table already exists
    const ftsExists = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='grocery_items_fts'"
    ).get();

    if (!ftsExists) {
      this.applyOptimization(
        'Create FTS5 virtual table',
        `CREATE VIRTUAL TABLE grocery_items_fts USING fts5(
          product_name,
          product_brand,
          product_category,
          product_subcategory,
          product_description,
          content=grocery_items,
          content_rowid=id,
          tokenize='porter unicode61'
        )`
      );

      // Check if grocery_items table has data
      const itemCount = this.db.prepare('SELECT COUNT(*) as count FROM grocery_items').get() as { count: number };
      
      if (itemCount.count > 0) {
        this.applyOptimization(
          'Populate FTS table',
          `INSERT INTO grocery_items_fts(rowid, product_name, product_brand, product_category, product_subcategory, product_description)
           SELECT id, product_name, product_brand, product_category, product_subcategory, special_instructions 
           FROM grocery_items`
        );
      }

      // Create triggers to keep FTS in sync
      this.applyOptimization(
        'Create FTS insert trigger',
        `CREATE TRIGGER grocery_items_fts_insert 
         AFTER INSERT ON grocery_items BEGIN
           INSERT INTO grocery_items_fts(
             rowid, product_name, product_brand, product_category, 
             product_subcategory, product_description
           ) VALUES (
             new.id, new.product_name, new.product_brand, new.product_category,
             new.product_subcategory, new.special_instructions
           );
         END`
      );

      this.applyOptimization(
        'Create FTS update trigger',
        `CREATE TRIGGER grocery_items_fts_update 
         AFTER UPDATE ON grocery_items BEGIN
           UPDATE grocery_items_fts SET 
             product_name = new.product_name,
             product_brand = new.product_brand,
             product_category = new.product_category,
             product_subcategory = new.product_subcategory,
             product_description = new.special_instructions
           WHERE rowid = new.id;
         END`
      );

      this.applyOptimization(
        'Create FTS delete trigger',
        `CREATE TRIGGER grocery_items_fts_delete 
         AFTER DELETE ON grocery_items BEGIN
           DELETE FROM grocery_items_fts WHERE rowid = old.id;
         END`
      );
    } else {
      console.log(chalk.gray('○ FTS table already exists'));
    }
  }

  /**
   * Create performance indexes
   */
  private createPerformanceIndexes(): void {
    console.log(chalk.cyan('\n⚡ Creating performance indexes...'));

    const indexes = [
      // Product search indexes
      {
        name: 'Product search covering index',
        sql: `CREATE INDEX IF NOT EXISTS idx_grocery_items_search_covering ON grocery_items(
          product_name COLLATE NOCASE,
          product_brand COLLATE NOCASE,
          product_category,
          estimated_price,
          id,
          list_id,
          user_id,
          status,
          quantity
        )`
      },
      {
        name: 'UPC barcode lookup index',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_grocery_items_upc_lookup ON grocery_items(upc_code) 
              WHERE upc_code IS NOT NULL`
      },
      
      // Purchase history indexes
      {
        name: 'Purchase history user-product index',
        sql: `CREATE INDEX IF NOT EXISTS idx_purchase_history_user_product_date ON purchase_history(
          user_id,
          product_name COLLATE NOCASE,
          product_brand COLLATE NOCASE,
          purchase_date DESC,
          unit_price,
          final_price
        )`
      },
      {
        name: 'Price trends covering index',
        sql: `CREATE INDEX IF NOT EXISTS idx_purchase_history_price_trends_covering ON purchase_history(
          upc_code,
          store_name,
          purchase_date DESC,
          unit_price,
          discount_amount,
          final_price
        ) WHERE upc_code IS NOT NULL`
      },
      {
        name: 'Basket analysis index',
        sql: `CREATE INDEX IF NOT EXISTS idx_purchase_history_basket_analysis ON purchase_history(
          shopping_trip_id,
          user_id,
          product_category,
          product_name,
          quantity
        ) WHERE shopping_trip_id IS NOT NULL`
      },
      {
        name: 'Recent purchases partial index',
        sql: `CREATE INDEX IF NOT EXISTS idx_purchase_history_recent ON purchase_history(
          user_id,
          purchase_date DESC,
          product_name,
          product_brand,
          unit_price
        ) WHERE purchase_date >= date('now', '-90 days')`
      },
      
      // User preferences indexes
      {
        name: 'User preferences recommendations index',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_preferences_recommendations ON user_preferences(
          user_id,
          overall_price_sensitivity,
          shopping_frequency,
          preferred_shopping_method
        )`
      },
      {
        name: 'Dietary preferences index',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_preferences_dietary ON user_preferences(
          user_id,
          dietary_restrictions,
          allergens
        ) WHERE dietary_restrictions IS NOT NULL OR allergens IS NOT NULL`
      },
      
      // Brand preferences index
      {
        name: 'Brand preferences lookup index',
        sql: `CREATE INDEX IF NOT EXISTS idx_brand_preferences_lookup ON brand_preferences(
          user_id,
          preference_type,
          preference_strength DESC,
          brand_name COLLATE NOCASE,
          category
        )`
      },
      
      // Deal alerts indexes
      {
        name: 'Deal alerts matching engine index',
        sql: `CREATE INDEX IF NOT EXISTS idx_deal_alerts_matching_engine ON deal_alerts(
          status,
          user_id,
          product_category,
          target_price,
          price_drop_percentage
        ) WHERE status = 'active'`
      },
      {
        name: 'Deal notifications delivery index',
        sql: `CREATE INDEX IF NOT EXISTS idx_deal_notifications_delivery ON deal_notifications(
          user_id,
          sent_at DESC,
          delivery_status,
          was_clicked,
          was_purchased
        )`
      }
    ];

    for (const index of indexes) {
      this.applyOptimization(index.name, index.sql);
    }
  }

  /**
   * Create cache tables for expensive operations
   */
  private createCacheTables(): void {
    console.log(chalk.cyan('\n💾 Creating cache tables...'));

    // Price history cache
    this.applyOptimization(
      'Create price history cache table',
      `CREATE TABLE IF NOT EXISTS price_history_cache (
        id TEXT PRIMARY KEY,
        upc_code TEXT NOT NULL,
        store_name TEXT NOT NULL,
        min_price DECIMAL(10,2),
        max_price DECIMAL(10,2),
        avg_price DECIMAL(10,2),
        current_price DECIMAL(10,2),
        last_price DECIMAL(10,2),
        price_trend TEXT CHECK (price_trend IN ('up', 'down', 'stable')),
        volatility_score DECIMAL(5,2),
        sample_count INTEGER,
        first_seen TEXT,
        last_seen TEXT,
        last_updated TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(upc_code, store_name)
      )`
    );

    this.applyOptimization(
      'Price cache lookup index',
      `CREATE INDEX IF NOT EXISTS idx_price_history_cache_lookup ON price_history_cache(
        upc_code,
        store_name,
        current_price,
        last_updated DESC
      )`
    );

    // Inventory cache
    this.applyOptimization(
      'Create inventory cache table',
      `CREATE TABLE IF NOT EXISTS inventory_cache (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        stock_level INTEGER,
        availability_status TEXT CHECK (availability_status IN ('in_stock', 'low_stock', 'out_of_stock')),
        last_restocked TEXT,
        restock_frequency_days INTEGER,
        avg_daily_sales DECIMAL(10,2),
        days_until_outage INTEGER,
        last_updated TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(product_id, store_id)
      )`
    );

    this.applyOptimization(
      'Inventory availability index',
      `CREATE INDEX IF NOT EXISTS idx_inventory_cache_availability ON inventory_cache(
        store_id,
        availability_status,
        stock_level DESC
      )`
    );

    // Cache analytics
    this.applyOptimization(
      'Create cache analytics table',
      `CREATE TABLE IF NOT EXISTS cache_analytics (
        id TEXT PRIMARY KEY,
        cache_key TEXT NOT NULL,
        cache_type TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        hit_count INTEGER DEFAULT 0,
        miss_count INTEGER DEFAULT 0,
        avg_response_time_ms DECIMAL(10,2),
        last_accessed TEXT,
        data_size_bytes INTEGER,
        ttl_seconds INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT,
        metadata TEXT
      )`
    );

    this.applyOptimization(
      'Cache key lookup index',
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_cache_analytics_key ON cache_analytics(cache_key)`
    );

    // User shopping stats
    this.applyOptimization(
      'Create user shopping stats table',
      `CREATE TABLE IF NOT EXISTS user_shopping_stats (
        user_id TEXT PRIMARY KEY,
        total_spent_30d DECIMAL(10,2),
        total_spent_90d DECIMAL(10,2),
        avg_basket_size DECIMAL(10,2),
        shopping_frequency_days DECIMAL(5,2),
        favorite_store TEXT,
        favorite_category TEXT,
        favorite_brand TEXT,
        price_sensitivity_score DECIMAL(3,2),
        loyalty_score DECIMAL(3,2),
        last_updated TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    );
  }

  /**
   * Analyze and optimize database
   */
  private analyzeDatabase(): void {
    console.log(chalk.cyan('\n📈 Analyzing database...'));
    
    const start = performance.now();
    this.db.exec('ANALYZE');
    const duration = performance.now() - start;
    
    console.log(chalk.green(`✓ Database analysis complete (${duration.toFixed(2)}ms)`));
    
    // Vacuum if needed
    const pageCount = this.db.pragma('page_count')[0] as { page_count: number };
    const freePages = this.db.pragma('freelist_count')[0] as { freelist_count: number };
    const fragmentation = (freePages.freelist_count / pageCount.page_count) * 100;
    
    if (fragmentation > 10) {
      console.log(chalk.yellow(`⚠️  Database fragmentation: ${fragmentation.toFixed(1)}%`));
      console.log(chalk.cyan('🔧 Running VACUUM to optimize storage...'));
      
      const vacuumStart = performance.now();
      this.db.exec('VACUUM');
      const vacuumDuration = performance.now() - vacuumStart;
      
      console.log(chalk.green(`✓ VACUUM complete (${vacuumDuration.toFixed(2)}ms)`));
    }
  }

  /**
   * Generate optimization report
   */
  private generateReport(): void {
    console.log(chalk.cyan('\n📋 Optimization Report'));
    console.log(chalk.gray('─'.repeat(60)));
    
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(chalk.white(`Total operations: ${this.results.length}`));
    console.log(chalk.green(`Successful: ${successful}`));
    if (failed > 0) {
      console.log(chalk.red(`Failed: ${failed}`));
    }
    console.log(chalk.white(`Total time: ${totalDuration.toFixed(2)}ms`));
    
    console.log(chalk.cyan('\n📊 Performance Improvements'));
    console.log(chalk.gray('─'.repeat(60)));
    
    for (const benchmark of this.benchmarks) {
      if (benchmark.improvement !== undefined) {
        const color = benchmark.improvement > 0 ? chalk.green : chalk.red;
        const symbol = benchmark.improvement > 0 ? '↑' : '↓';
        console.log(
          `${benchmark.description}:\n` +
          `  Before: ${benchmark.beforeTime?.toFixed(2)}ms\n` +
          `  After: ${benchmark.afterTime?.toFixed(2)}ms\n` +
          color(`  ${symbol} ${Math.abs(benchmark.improvement).toFixed(1)}% ${benchmark.improvement > 0 ? 'faster' : 'slower'}`)
        );
      }
    }
    
    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      benchmarks: this.benchmarks,
      summary: {
        totalOperations: this.results.length,
        successful,
        failed,
        totalDuration
      }
    };
    
    const reportPath = path.join(process.cwd(), 'grocery-optimization-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`\nReport saved to: ${reportPath}`));
  }

  /**
   * Run the complete optimization process
   */
  async optimize(): Promise<void> {
    console.log(chalk.bold.cyan('\n🚀 Starting Grocery Database Optimization\n'));
    
    try {
      // Run benchmarks before optimization
      await this.runBenchmarksBefore();
      
      // Begin transaction for atomic operations
      this.db.exec('BEGIN TRANSACTION');
      
      // Apply optimizations
      this.createFullTextSearch();
      this.createPerformanceIndexes();
      this.createCacheTables();
      
      // Commit transaction
      this.db.exec('COMMIT');
      
      // Analyze database
      this.analyzeDatabase();
      
      // Run benchmarks after optimization
      await this.runBenchmarksAfter();
      
      // Generate report
      this.generateReport();
      
      console.log(chalk.bold.green('\n✅ Optimization complete!'));
    } catch (error) {
      console.error(chalk.red('\n❌ Optimization failed:'), error);
      
      // Rollback transaction on error
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error(chalk.red('Failed to rollback:'), rollbackError);
      }
      
      process.exit(1);
    } finally {
      this.db.close();
    }
  }
}

// Main execution
async function main() {
  const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'app.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error(chalk.red(`Database not found at: ${dbPath}`));
    process.exit(1);
  }
  
  console.log(chalk.gray(`Database path: ${dbPath}`));
  
  const optimizer = new GroceryDatabaseOptimizer(dbPath);
  await optimizer.optimize();
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { GroceryDatabaseOptimizer };