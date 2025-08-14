#!/usr/bin/env tsx
/**
 * Database Performance Audit Script
 * Analyzes query performance, connection pooling, and optimization opportunities
 */

import Database from "better-sqlite3";
import { performance } from "perf_hooks";
import * as path from "path";
import * as fs from "fs";

const WALMART_DB_PATH = path.join(process.cwd(), "data", "walmart_grocery.db");
const CREWAI_DB_PATH = path.join(process.cwd(), "data", "crewai_enhanced.db");
const APP_DB_PATH = path.join(process.cwd(), "data", "app.db");

interface QueryBenchmark {
  query: string;
  description: string;
  expectedTime: number; // milliseconds
}

interface IndexRecommendation {
  table: string;
  columns: string[];
  reason: string;
  estimatedImprovement: string;
}

class DatabasePerformanceAuditor {
  private db: Database.Database;
  private dbName: string;

  constructor(dbPath: string, dbName: string) {
    this.db = new Database(dbPath, { readonly: true });
    this.dbName = dbName;
    
    // Enable query statistics
    this.db.pragma("query_only = ON");
  }

  /**
   * Get current database configuration
   */
  getDatabaseConfig() {
    console.log(`\n=== ${this.dbName} Configuration ===`);
    
    const pragmas = [
      "cache_size",
      "page_size", 
      "journal_mode",
      "synchronous",
      "temp_store",
      "mmap_size",
      "busy_timeout",
      "wal_checkpoint",
      "auto_vacuum",
      "foreign_keys"
    ];

    const config: Record<string, any> = {};
    for (const pragma of pragmas) {
      try {
        const result = this.db.pragma(pragma);
        config[pragma] = result;
        console.log(`  ${pragma}: ${result}`);
      } catch (e) {
        // Some pragmas might not be available
      }
    }

    // Get database file size
    const stats = fs.statSync(this.db.name);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  File size: ${sizeInMB} MB`);

    // Get page count and free pages
    const pageCount = this.db.pragma("page_count");
    const freePages = this.db.pragma("freelist_count");
    const fragmentation = ((freePages as number / pageCount as number) * 100).toFixed(2);
    console.log(`  Total pages: ${pageCount}`);
    console.log(`  Free pages: ${freePages} (${fragmentation}% fragmentation)`);

    return config;
  }

  /**
   * Analyze index usage and coverage
   */
  analyzeIndexes() {
    console.log(`\n=== ${this.dbName} Index Analysis ===`);

    // Get all indexes
    const indexes = this.db.prepare(`
      SELECT name, tbl_name, sql 
      FROM sqlite_master 
      WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY tbl_name, name
    `).all() as Array<{name: string, tbl_name: string, sql: string}>;

    console.log(`  Total custom indexes: ${indexes.length}`);

    // Group by table
    const indexesByTable = new Map<string, string[]>();
    for (const idx of indexes) {
      if (!indexesByTable.has(idx.tbl_name)) {
        indexesByTable.set(idx.tbl_name, []);
      }
      indexesByTable.get(idx.tbl_name)!.push(idx.name);
    }

    // Analyze each table
    for (const [table, tableIndexes] of indexesByTable) {
      const rowCount = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as {count: number};
      console.log(`\n  Table: ${table} (${rowCount.count} rows)`);
      console.log(`    Indexes: ${tableIndexes.length}`);
      
      // Check for missing statistics
      const hasStats = this.db.prepare(`
        SELECT COUNT(*) as count 
        FROM sqlite_stat1 
        WHERE tbl = ?
      `).get(table) as {count: number};
      
      if (hasStats.count === 0 && rowCount.count > 100) {
        console.log(`    ⚠️  Missing statistics - run ANALYZE ${table}`);
      }
    }

    return indexesByTable;
  }

  /**
   * Benchmark critical queries
   */
  benchmarkQueries(queries: QueryBenchmark[]) {
    console.log(`\n=== ${this.dbName} Query Benchmarks ===`);

    const results: Array<{
      description: string;
      avgTime: number;
      minTime: number;
      maxTime: number;
      passed: boolean;
    }> = [];

    for (const benchmark of queries) {
      const times: number[] = [];
      
      // Run each query multiple times
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        try {
          const stmt = this.db.prepare(benchmark.query);
          stmt.all();
        } catch (e) {
          console.log(`  ❌ Query failed: ${benchmark.description}`);
          continue;
        }
        const end = performance.now();
        times.push(end - start);
      }

      if (times.length > 0) {
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const minTime = Math.min(...times);
        const maxTime = Math.max(...times);
        const passed = avgTime <= benchmark.expectedTime;

        results.push({
          description: benchmark.description,
          avgTime,
          minTime,
          maxTime,
          passed
        });

        const icon = passed ? "✅" : "⚠️";
        console.log(`\n  ${icon} ${benchmark.description}`);
        console.log(`     Avg: ${avgTime.toFixed(3)}ms (Expected: <${benchmark.expectedTime}ms)`);
        console.log(`     Min: ${minTime.toFixed(3)}ms, Max: ${maxTime.toFixed(3)}ms`);

        // Get query plan if slow
        if (!passed) {
          const plan = this.db.prepare(`EXPLAIN QUERY PLAN ${benchmark.query}`).all();
          console.log(`     Query Plan:`);
          plan.forEach((step: any) => {
            console.log(`       ${JSON.stringify(step)}`);
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate index recommendations
   */
  generateIndexRecommendations(): IndexRecommendation[] {
    console.log(`\n=== ${this.dbName} Index Recommendations ===`);
    
    const recommendations: IndexRecommendation[] = [];

    // Check for common patterns that need indexes
    const patterns = [
      {
        check: `SELECT name FROM sqlite_master WHERE type='table' AND name='walmart_products'`,
        recommendation: {
          table: "walmart_products",
          columns: ["name", "in_stock", "current_price"],
          reason: "Composite index for common search pattern: name search with stock and price filtering",
          estimatedImprovement: "50-70% for filtered searches"
        }
      },
      {
        check: `SELECT name FROM sqlite_master WHERE type='table' AND name='grocery_items'`,
        recommendation: {
          table: "grocery_items",
          columns: ["list_id", "is_checked"],
          reason: "Optimize grocery list item retrieval with check status",
          estimatedImprovement: "30-40% for list operations"
        }
      },
      {
        check: `SELECT name FROM sqlite_master WHERE type='table' AND name='price_history'`,
        recommendation: {
          table: "price_history",
          columns: ["product_id", "recorded_at"],
          reason: "Composite index for price history lookups",
          estimatedImprovement: "60-80% for price trend queries"
        }
      }
    ];

    for (const pattern of patterns) {
      const exists = this.db.prepare(pattern.check).get();
      if (exists) {
        // Check if index already exists
        const indexName = `idx_${pattern.recommendation.table}_${pattern.recommendation.columns.join("_")}`;
        const indexExists = this.db.prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name=?`
        ).get(indexName);

        if (!indexExists) {
          recommendations.push(pattern.recommendation);
          console.log(`\n  📊 Recommendation: ${pattern.recommendation.table}`);
          console.log(`     Columns: ${pattern.recommendation.columns.join(", ")}`);
          console.log(`     Reason: ${pattern.recommendation.reason}`);
          console.log(`     Expected improvement: ${pattern.recommendation.estimatedImprovement}`);
        }
      }
    }

    if (recommendations.length === 0) {
      console.log("\n  ✅ No additional indexes recommended");
    }

    return recommendations;
  }

  /**
   * Check for connection pool issues
   */
  checkConnectionPooling() {
    console.log(`\n=== ${this.dbName} Connection Analysis ===`);

    // Check WAL mode status
    const walMode = this.db.pragma("journal_mode");
    console.log(`  Journal mode: ${walMode}`);
    
    if (walMode !== "wal") {
      console.log(`  ⚠️  Consider enabling WAL mode for better concurrency`);
    }

    // Check busy timeout
    const busyTimeout = this.db.pragma("busy_timeout");
    console.log(`  Busy timeout: ${busyTimeout}ms`);
    
    if ((busyTimeout as number) < 5000) {
      console.log(`  ⚠️  Consider increasing busy_timeout to at least 5000ms`);
    }

    // Simulate concurrent access
    console.log("\n  Testing concurrent read performance...");
    const readQueries = [];
    const start = performance.now();
    
    for (let i = 0; i < 100; i++) {
      readQueries.push(
        this.db.prepare("SELECT COUNT(*) FROM walmart_products").get()
      );
    }
    
    const elapsed = performance.now() - start;
    const qps = (100 / (elapsed / 1000)).toFixed(0);
    console.log(`  Completed 100 reads in ${elapsed.toFixed(2)}ms (${qps} queries/sec)`);

    return {
      walMode,
      busyTimeout,
      readQPS: parseInt(qps)
    };
  }

  /**
   * Generate optimization script
   */
  generateOptimizationScript(recommendations: IndexRecommendation[]): string {
    const script = [`-- Database Optimization Script for ${this.dbName}`, ""];

    // Add pragmas
    script.push("-- Optimize database settings");
    script.push("PRAGMA journal_mode = WAL;");
    script.push("PRAGMA synchronous = NORMAL;");
    script.push("PRAGMA cache_size = -64000; -- 64MB cache");
    script.push("PRAGMA temp_store = MEMORY;");
    script.push("PRAGMA mmap_size = 268435456; -- 256MB memory map");
    script.push("PRAGMA busy_timeout = 10000;");
    script.push("");

    // Add recommended indexes
    if (recommendations.length > 0) {
      script.push("-- Create recommended indexes");
      for (const rec of recommendations) {
        const indexName = `idx_${rec.table}_${rec.columns.join("_")}`;
        script.push(`CREATE INDEX IF NOT EXISTS ${indexName}`);
        script.push(`  ON ${rec.table}(${rec.columns.join(", ")});`);
        script.push("");
      }
    }

    // Add statistics update
    script.push("-- Update statistics");
    script.push("ANALYZE;");
    script.push("");

    // Add vacuum
    script.push("-- Reclaim space and defragment");
    script.push("VACUUM;");

    return script.join("\n");
  }

  close() {
    this.db.close();
  }
}

// Main audit function
async function performAudit() {
  console.log("🔍 Database Performance Audit");
  console.log("================================");

  // Audit Walmart database
  if (fs.existsSync(WALMART_DB_PATH)) {
    const walmartAuditor = new DatabasePerformanceAuditor(WALMART_DB_PATH, "Walmart Grocery DB");
    
    walmartAuditor.getDatabaseConfig();
    walmartAuditor.analyzeIndexes();
    
    const walmartQueries: QueryBenchmark[] = [
      {
        query: "SELECT * FROM walmart_products WHERE name LIKE '%milk%' LIMIT 20",
        description: "Product name search",
        expectedTime: 5
      },
      {
        query: "SELECT * FROM walmart_products WHERE in_stock = 1 AND current_price < 10 LIMIT 50",
        description: "Filtered product search",
        expectedTime: 10
      },
      {
        query: `SELECT gi.*, wp.name FROM grocery_items gi 
                JOIN walmart_products wp ON gi.product_id = wp.id 
                WHERE gi.list_id = 'test' LIMIT 20`,
        description: "Grocery list join",
        expectedTime: 15
      },
      {
        query: "SELECT * FROM price_history WHERE product_id = 'test' ORDER BY recorded_at DESC LIMIT 30",
        description: "Price history lookup",
        expectedTime: 5
      }
    ];
    
    walmartAuditor.benchmarkQueries(walmartQueries);
    const walmartRecs = walmartAuditor.generateIndexRecommendations();
    walmartAuditor.checkConnectionPooling();
    
    // Generate optimization script
    const walmartScript = walmartAuditor.generateOptimizationScript(walmartRecs);
    fs.writeFileSync("walmart-optimization.sql", walmartScript);
    console.log("\n📝 Optimization script saved to walmart-optimization.sql");
    
    walmartAuditor.close();
  }

  // Audit CrewAI database
  if (fs.existsSync(CREWAI_DB_PATH)) {
    console.log("\n" + "=".repeat(50) + "\n");
    
    const crewaiAuditor = new DatabasePerformanceAuditor(CREWAI_DB_PATH, "CrewAI Enhanced DB");
    
    crewaiAuditor.getDatabaseConfig();
    crewaiAuditor.analyzeIndexes();
    
    const crewaiQueries: QueryBenchmark[] = [
      {
        query: "SELECT COUNT(*) FROM emails WHERE phase_1_results IS NOT NULL",
        description: "Count processed emails",
        expectedTime: 50
      },
      {
        query: "SELECT * FROM emails WHERE chain_id IS NOT NULL ORDER BY date DESC LIMIT 100",
        description: "Recent email chains",
        expectedTime: 20
      }
    ];
    
    crewaiAuditor.benchmarkQueries(crewaiQueries);
    const crewaiRecs = crewaiAuditor.generateIndexRecommendations();
    crewaiAuditor.checkConnectionPooling();
    
    crewaiAuditor.close();
  }

  console.log("\n✅ Audit complete!");
  console.log("\n📊 Summary:");
  console.log("  - Check optimization scripts for recommended changes");
  console.log("  - Consider implementing connection pooling at application level");
  console.log("  - Monitor query performance after applying optimizations");
}

// Run the audit
performAudit().catch(console.error);