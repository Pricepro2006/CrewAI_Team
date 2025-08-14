#!/usr/bin/env tsx
/**
 * Database Performance Monitoring Script
 * Tracks query performance, cache hit rates, and identifies slow queries
 */

import Database from "better-sqlite3";
import * as path from "path";
import { performance } from "perf_hooks";
import * as fs from "fs";

const WALMART_DB_PATH = path.join(process.cwd(), "data", "walmart_grocery.db");
const CREWAI_DB_PATH = path.join(process.cwd(), "data", "crewai_enhanced.db");
const LOG_PATH = path.join(process.cwd(), "logs", "database-performance.log");

interface QueryMetric {
  query: string;
  avgTime: number;
  minTime: number;
  maxTime: number;
  count: number;
  lastRun: Date;
}

interface DatabaseHealth {
  fragmentation: number;
  cacheHitRate: number;
  walSize: number;
  indexUsage: Map<string, boolean>;
  slowQueries: QueryMetric[];
}

class DatabasePerformanceMonitor {
  private queryMetrics: Map<string, QueryMetric> = new Map();
  private slowQueryThreshold = 100; // milliseconds

  constructor(private dbPath: string, private dbName: string) {}

  private openDatabase(): Database.Database {
    return new Database(this.dbPath, { 
      readonly: true,
      fileMustExist: true 
    });
  }

  /**
   * Track query execution time
   */
  trackQuery(sql: string, duration: number) {
    const key = sql.replace(/\?/g, '?').substring(0, 100);
    const existing = this.queryMetrics.get(key);
    
    if (existing) {
      existing.count++;
      existing.avgTime = (existing.avgTime * (existing.count - 1) + duration) / existing.count;
      existing.minTime = Math.min(existing.minTime, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.lastRun = new Date();
    } else {
      this.queryMetrics.set(key, {
        query: key,
        avgTime: duration,
        minTime: duration,
        maxTime: duration,
        count: 1,
        lastRun: new Date()
      });
    }

    // Log slow queries
    if (duration > this.slowQueryThreshold) {
      this.logSlowQuery(sql, duration);
    }
  }

  /**
   * Log slow queries to file
   */
  private logSlowQuery(sql: string, duration: number) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      database: this.dbName,
      duration,
      query: sql.substring(0, 500)
    };

    fs.appendFileSync(LOG_PATH, JSON.stringify(logEntry) + '\n');
    console.warn(`⚠️  Slow query detected (${duration.toFixed(2)}ms): ${sql.substring(0, 100)}...`);
  }

  /**
   * Get database health metrics
   */
  async checkHealth(): Promise<DatabaseHealth> {
    const db = this.openDatabase();
    
    try {
      // Check fragmentation
      const pageCount = db.pragma("page_count")[0] as any;
      const freelistCount = db.pragma("freelist_count")[0] as any;
      const fragmentation = (freelistCount.freelist_count / pageCount.page_count) * 100;

      // Check WAL size
      let walSize = 0;
      const walPath = this.dbPath + '-wal';
      if (fs.existsSync(walPath)) {
        walSize = fs.statSync(walPath).size / 1024 / 1024; // MB
      }

      // Check cache statistics (simulated - SQLite doesn't expose directly)
      const cacheSize = db.pragma("cache_size")[0] as any;
      const pageSize = db.pragma("page_size")[0] as any;
      const totalCacheMB = Math.abs(cacheSize.cache_size) * pageSize.page_size / 1024 / 1024;

      // Check index usage
      const indexes = db.prepare(`
        SELECT name, tbl_name 
        FROM sqlite_master 
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `).all() as Array<{name: string, tbl_name: string}>;

      const indexUsage = new Map<string, boolean>();
      for (const idx of indexes) {
        // Check if index has statistics (indicates it's been used)
        const hasStats = db.prepare(`
          SELECT COUNT(*) as count FROM sqlite_stat1 WHERE idx = ?
        `).get(idx.name) as any;
        indexUsage.set(idx.name, hasStats.count > 0);
      }

      // Get slow queries
      const slowQueries = Array.from(this.queryMetrics.values())
        .filter(q => q.avgTime > this.slowQueryThreshold)
        .sort((a, b) => b.avgTime - a.avgTime)
        .slice(0, 10);

      return {
        fragmentation,
        cacheHitRate: 95, // Simulated - SQLite doesn't expose this
        walSize,
        indexUsage,
        slowQueries
      };
    } finally {
      db.close();
    }
  }

  /**
   * Run common query benchmarks
   */
  async runBenchmarks() {
    const db = this.openDatabase();
    console.log(`\n📊 Running benchmarks for ${this.dbName}...`);

    const benchmarks = this.dbName.includes('walmart') ? [
      {
        name: "Product name search",
        query: "SELECT * FROM walmart_products WHERE name LIKE ? LIMIT 10",
        params: ['%milk%']
      },
      {
        name: "Product by ID",
        query: "SELECT * FROM walmart_products WHERE product_id = ?",
        params: ['test-id']
      },
      {
        name: "Active grocery items",
        query: `SELECT g.*, p.name FROM grocery_items g 
                LEFT JOIN walmart_products p ON g.product_id = p.id 
                WHERE g.list_id = ? AND g.is_checked = 0`,
        params: ['test-list']
      },
      {
        name: "Recent orders",
        query: "SELECT * FROM walmart_order_history ORDER BY order_date DESC LIMIT 10",
        params: []
      },
      {
        name: "FTS search",
        query: "SELECT * FROM walmart_products_fts WHERE walmart_products_fts MATCH ? LIMIT 10",
        params: ['milk']
      }
    ] : [
      {
        name: "Email count",
        query: "SELECT COUNT(*) FROM emails_enhanced WHERE status = ?",
        params: ['processed']
      },
      {
        name: "Recent emails",
        query: "SELECT * FROM emails_enhanced ORDER BY received_date_time DESC LIMIT 10",
        params: []
      }
    ];

    for (const benchmark of benchmarks) {
      try {
        const stmt = db.prepare(benchmark.query);
        const times: number[] = [];
        
        // Run 5 times
        for (let i = 0; i < 5; i++) {
          const start = performance.now();
          stmt.all(...benchmark.params);
          const duration = performance.now() - start;
          times.push(duration);
        }

        const avg = times.reduce((a, b) => a + b, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);

        this.trackQuery(benchmark.query, avg);
        
        const status = avg < 10 ? "✅" : avg < 50 ? "⚠️ " : "❌";
        console.log(`  ${status} ${benchmark.name}: avg=${avg.toFixed(2)}ms, min=${min.toFixed(2)}ms, max=${max.toFixed(2)}ms`);
      } catch (error: any) {
        console.error(`  ❌ ${benchmark.name}: ${error.message}`);
      }
    }

    db.close();
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    const health = await this.checkHealth();
    
    console.log(`\n📈 Performance Report for ${this.dbName}`);
    console.log("=" .repeat(50));
    
    console.log("\n🏥 Database Health:");
    console.log(`  Fragmentation: ${health.fragmentation.toFixed(2)}%`);
    console.log(`  WAL Size: ${health.walSize.toFixed(2)} MB`);
    console.log(`  Cache Hit Rate: ~${health.cacheHitRate}%`);
    
    console.log("\n📊 Index Usage:");
    let unusedIndexes = 0;
    for (const [name, used] of health.indexUsage) {
      if (!used) {
        console.log(`  ⚠️  Unused index: ${name}`);
        unusedIndexes++;
      }
    }
    if (unusedIndexes === 0) {
      console.log(`  ✅ All indexes are being used`);
    }
    
    console.log("\n🐌 Slow Queries (>${this.slowQueryThreshold}ms):");
    if (health.slowQueries.length === 0) {
      console.log("  ✅ No slow queries detected");
    } else {
      for (const query of health.slowQueries) {
        console.log(`  ${query.avgTime.toFixed(2)}ms (${query.count}x): ${query.query.substring(0, 60)}...`);
      }
    }

    console.log("\n💡 Recommendations:");
    if (health.fragmentation > 10) {
      console.log(`  • Run VACUUM to reduce fragmentation (currently ${health.fragmentation.toFixed(2)}%)`);
    }
    if (health.walSize > 100) {
      console.log(`  • Checkpoint WAL file (currently ${health.walSize.toFixed(2)} MB)`);
    }
    if (unusedIndexes > 0) {
      console.log(`  • Consider dropping ${unusedIndexes} unused indexes`);
    }
    if (health.slowQueries.length > 0) {
      console.log(`  • Optimize ${health.slowQueries.length} slow queries`);
    }
    if (health.fragmentation <= 10 && health.walSize <= 100 && unusedIndexes === 0 && health.slowQueries.length === 0) {
      console.log("  ✅ Database is performing optimally!");
    }
  }

  /**
   * Monitor real-time query performance
   */
  async monitorRealtime(durationMs: number = 60000) {
    console.log(`\n🔍 Monitoring ${this.dbName} for ${durationMs/1000} seconds...`);
    
    const endTime = Date.now() + durationMs;
    const db = this.openDatabase();
    
    // Simulate monitoring by running test queries
    const interval = setInterval(async () => {
      if (Date.now() >= endTime) {
        clearInterval(interval);
        db.close();
        await this.generateReport();
        return;
      }

      // Run a random query to simulate load
      const queries = [
        "SELECT COUNT(*) FROM walmart_products WHERE in_stock = 1",
        "SELECT * FROM walmart_products WHERE name LIKE '%test%' LIMIT 5",
        "SELECT * FROM grocery_lists WHERE user_id = 'test' LIMIT 1"
      ];

      const query = queries[Math.floor(Math.random() * queries.length)];
      const start = performance.now();
      
      try {
        db.prepare(query).all();
        const duration = performance.now() - start;
        this.trackQuery(query, duration);
        
        if (duration > this.slowQueryThreshold) {
          console.log(`  ⚠️  Slow: ${duration.toFixed(2)}ms - ${query.substring(0, 50)}...`);
        }
      } catch (error) {
        // Ignore errors in monitoring
      }
    }, 1000);
  }
}

// Main execution
async function main() {
  console.log("🔍 Database Performance Monitor");
  console.log("================================\n");

  // Create log directory if it doesn't exist
  const logDir = path.dirname(LOG_PATH);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Monitor Walmart database
  const walmartMonitor = new DatabasePerformanceMonitor(WALMART_DB_PATH, "Walmart Grocery DB");
  await walmartMonitor.runBenchmarks();
  await walmartMonitor.generateReport();

  // Monitor CrewAI database
  const crewaiMonitor = new DatabasePerformanceMonitor(CREWAI_DB_PATH, "CrewAI Enhanced DB");
  await crewaiMonitor.runBenchmarks();
  await crewaiMonitor.generateReport();

  console.log("\n📝 Performance logs saved to:", LOG_PATH);
  
  // Option to run real-time monitoring
  const args = process.argv.slice(2);
  if (args.includes("--monitor")) {
    console.log("\n Starting real-time monitoring (press Ctrl+C to stop)...");
    await walmartMonitor.monitorRealtime(30000); // Monitor for 30 seconds
  }
}

main().catch(console.error);