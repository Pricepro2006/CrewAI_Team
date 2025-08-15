#!/usr/bin/env tsx
/**
 * Database Performance Benchmark for Walmart Grocery Agent
 * Analyzes SQLite database performance, query optimization, and index usage
 */

import Database from "better-sqlite3";
import { performance } from "perf_hooks";
import { existsSync, statSync } from "fs";
import { writeFile } from "fs/promises";
import { join } from "path";

interface QueryBenchmark {
  query: string;
  description: string;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  p95ExecutionTime: number;
  iterations: number;
  rowsAffected: number;
  success: boolean;
  error?: string;
}

interface DatabaseMetrics {
  file: string;
  size: number;
  sizeHuman: string;
  tableCount: number;
  indexCount: number;
  pageSize: number;
  pageCount: number;
  freePages: number;
  unusedSpace: number;
}

interface TableAnalysis {
  tableName: string;
  rowCount: number;
  indexCount: number;
  avgRowSize: number;
  totalSize: number;
  indexes: IndexAnalysis[];
}

interface IndexAnalysis {
  indexName: string;
  tableName: string;
  columns: string[];
  unique: boolean;
  size: number;
  usage: 'high' | 'medium' | 'low' | 'unused';
}

class DatabasePerformanceBenchmark {
  private databases: { name: string; path: string; db?: Database.Database }[] = [
    { name: 'Main Database', path: 'data/app.db' },
    { name: 'Walmart Grocery', path: 'data/walmart_grocery.db' },
    { name: 'CrewAI Enhanced', path: 'data/crewai_enhanced.db' }
  ];

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted?.length || 0) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private async benchmarkQuery(
    db: Database.Database,
    query: string,
    description: string,
    iterations: number = 100
  ): Promise<QueryBenchmark> {
    console.log(`  Testing: ${description} (${iterations} iterations)...`);
    
    const executionTimes: number[] = [];
    let rowsAffected = 0;
    let success = true;
    let error: string | undefined;
    
    try {
      // Prepare the statement for better performance
      const stmt = db.prepare(query);
      
      // Warmup run
      try {
        const warmupResult = stmt.all();
        rowsAffected = Array.isArray(warmupResult) ? warmupResult?.length || 0 : 0;
      } catch (e) {
        // Query might be an action query (INSERT, UPDATE, DELETE)
        try {
          const info = stmt.run();
          rowsAffected = info.changes || 0;
        } catch (e2) {
          throw e; // Use original error
        }
      }
      
      // Benchmark runs
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        try {
          const result = stmt.all();
        } catch (e) {
          // Try as action query
          stmt.run();
        }
        
        const end = performance.now();
        executionTimes.push(end - start);
        
        // Progress indicator for slow queries
        if ((i + 1) % Math.max(1, Math.floor(iterations / 10)) === 0) {
          process?.stdout?.write(`    ${i + 1}/${iterations}\r`);
        }
      }
      
      stmt.finalize();
      console.log(''); // New line after progress
      
    } catch (e: any) {
      success = false;
      error = e.message;
      console.log(`    ❌ Error: ${error}`);
      
      // Add a dummy time to avoid division by zero
      executionTimes.push(0);
    }
    
    executionTimes.sort((a, b) => a - b);
    
    return {
      query: query.replace(/\s+/g, ' ').trim(),
      description,
      avgExecutionTime: executionTimes.reduce((sum: any, time: any) => sum + time, 0) / executionTimes?.length || 0,
      minExecutionTime: executionTimes[0] || 0,
      maxExecutionTime: executionTimes[executionTimes?.length || 0 - 1] || 0,
      p95ExecutionTime: this.calculatePercentile(executionTimes, 95),
      iterations,
      rowsAffected,
      success,
      error
    };
  }

  private async analyzeDatabaseMetrics(dbPath: string): Promise<DatabaseMetrics | null> {
    if (!existsSync(dbPath)) {
      return null;
    }
    
    const stats = statSync(dbPath);
    
    try {
      const db = new Database(dbPath, { readonly: true });
      
      const pragmaInfo = {
        pageSize: db.prepare("PRAGMA page_size").get() as any,
        pageCount: db.prepare("PRAGMA page_count").get() as any,
        freeListCount: db.prepare("PRAGMA freelist_count").get() as any
      };
      
      const tables = db.prepare(`
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      `).get() as any;
      
      const indexes = db.prepare(`
        SELECT COUNT(*) as count 
        FROM sqlite_master 
        WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      `).get() as any;
      
      db.close();
      
      return {
        file: dbPath,
        size: stats.size,
        sizeHuman: this.formatBytes(stats.size),
        tableCount: tables.count,
        indexCount: indexes.count,
        pageSize: pragmaInfo?.pageSize?.page_size,
        pageCount: pragmaInfo?.pageCount?.page_count,
        freePages: pragmaInfo?.freeListCount?.freelist_count,
        unusedSpace: pragmaInfo?.freeListCount?.freelist_count * pragmaInfo?.pageSize?.page_size
      };
      
    } catch (error) {
      console.log(`⚠️ Could not analyze ${dbPath}: ${error}`);
      return null;
    }
  }

  private async analyzeTablePerformance(db: Database.Database, tableName: string): Promise<TableAnalysis | null> {
    try {
      // Get row count
      const rowCountResult = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as any;
      const rowCount = rowCountResult?.count;
      
      if (rowCount === 0) {
        return null; // Skip empty tables
      }
      
      // Get table info
      const tableInfo = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
      
      // Get indexes for this table
      const indexList = db.prepare(`PRAGMA index_list(${tableName})`).all() as any[];
      
      const indexes: IndexAnalysis[] = [];
      for (const index of indexList) {
        if (!index?.name?.startsWith('sqlite_')) {
          const indexInfo = db.prepare(`PRAGMA index_info(${index.name})`).all() as any[];
          
          indexes.push({
            indexName: index.name,
            tableName,
            columns: indexInfo?.map(col => col.name),
            unique: index.unique === 1,
            size: 0, // SQLite doesn't provide easy way to get index size
            usage: 'medium' // We'll classify this based on query patterns
          });
        }
      }
      
      // Estimate average row size
      const sampleRows = db.prepare(`SELECT * FROM ${tableName} LIMIT 100`).all() as any[];
      let avgRowSize = 0;
      if (sampleRows?.length || 0 > 0) {
        const sampleRowSizes = sampleRows?.map(row => 
          JSON.stringify(row).length
        );
        avgRowSize = sampleRowSizes.reduce((sum: any, size: any) => sum + size, 0) / sampleRowSizes?.length || 0;
      }
      
      return {
        tableName,
        rowCount,
        indexCount: indexes?.length || 0,
        avgRowSize,
        totalSize: rowCount * avgRowSize,
        indexes
      };
      
    } catch (error) {
      console.log(`⚠️ Could not analyze table ${tableName}: ${error}`);
      return null;
    }
  }

  public async benchmarkDatabase(dbName: string, dbPath: string): Promise<{
    metrics: DatabaseMetrics | null;
    benchmarks: QueryBenchmark[];
    tableAnalyses: TableAnalysis[];
  }> {
    console.log(`\n🗄️ Benchmarking ${dbName}...`);
    
    if (!existsSync(dbPath)) {
      console.log(`❌ Database not found: ${dbPath}`);
      return { metrics: null, benchmarks: [], tableAnalyses: [] };
    }
    
    const db = new Database(dbPath, { readonly: true });
    const metrics = await this.analyzeDatabaseMetrics(dbPath);
    const benchmarks: QueryBenchmark[] = [];
    const tableAnalyses: TableAnalysis[] = [];
    
    try {
      // Get all table names
      const tables = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
        ORDER BY name
      `).all() as any[];
      
      console.log(`  Found ${tables?.length || 0} tables`);
      
      // Analyze each table
      for (const table of tables.slice(0, 10)) { // Limit to first 10 tables
        const analysis = await this.analyzeTablePerformance(db, table.name);
        if (analysis) {
          tableAnalyses.push(analysis);
        }
      }
      
      // Define test queries based on common patterns
      const testQueries = [
        {
          query: "SELECT COUNT(*) FROM sqlite_master",
          description: "Schema metadata query"
        },
        {
          query: "SELECT name FROM sqlite_master WHERE type = 'table'",
          description: "Table enumeration"
        }
      ];
      
      // Add table-specific queries for the largest tables
      const largestTables = tableAnalyses
        .sort((a, b) => b.rowCount - a.rowCount)
        .slice(0, 3);
      
      for (const table of largestTables) {
        testQueries.push(
          {
            query: `SELECT COUNT(*) FROM ${table.tableName}`,
            description: `Count rows in ${table.tableName}`
          },
          {
            query: `SELECT * FROM ${table.tableName} LIMIT 100`,
            description: `Select first 100 rows from ${table.tableName}`
          },
          {
            query: `SELECT * FROM ${table.tableName} ORDER BY rowid DESC LIMIT 10`,
            description: `Select latest 10 rows from ${table.tableName}`
          }
        );
        
        // Add index-based queries if indexes exist
        if (table?.indexes?.length > 0) {
          const firstIndex = table.indexes[0];
          const firstColumn = firstIndex.columns[0];
          if (firstColumn) {
            testQueries.push({
              query: `SELECT COUNT(*) FROM ${table.tableName} WHERE ${firstColumn} IS NOT NULL`,
              description: `Indexed query on ${table.tableName}.${firstColumn}`
            });
          }
        }
      }
      
      // Run benchmarks
      for (const testQuery of testQueries) {
        const benchmark = await this.benchmarkQuery(
          db,
          testQuery.query,
          testQuery.description,
          50 // Fewer iterations for complex queries
        );
        benchmarks.push(benchmark);
      }
      
    } catch (error) {
      console.log(`⚠️ Error during benchmarking: ${error}`);
    } finally {
      db.close();
    }
    
    return { metrics, benchmarks, tableAnalyses };
  }

  public displayResults(results: Array<{
    name: string;
    metrics: DatabaseMetrics | null;
    benchmarks: QueryBenchmark[];
    tableAnalyses: TableAnalysis[];
  }>) {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80));
    
    for (const result of results) {
      if (!result.metrics) {
        console.log(`\n❌ ${result.name}: Database not found or inaccessible`);
        continue;
      }
      
      console.log(`\n🗄️ ${result?.name?.toUpperCase()}`);
      console.log('-'.repeat(50));
      
      // Database metrics
      console.log('\n📊 Database Metrics:');
      console.log(`  File: ${result?.metrics?.file}`);
      console.log(`  Size: ${result?.metrics?.sizeHuman}`);
      console.log(`  Tables: ${result?.metrics?.tableCount}`);
      console.log(`  Indexes: ${result?.metrics?.indexCount}`);
      console.log(`  Page Size: ${result?.metrics?.pageSize} bytes`);
      console.log(`  Total Pages: ${result?.metrics?.pageCount}`);
      console.log(`  Free Pages: ${result?.metrics?.freePages}`);
      
      if (result?.metrics?.unusedSpace > 0) {
        console.log(`  Unused Space: ${this.formatBytes(result?.metrics?.unusedSpace)}`);
        if (result?.metrics?.unusedSpace > result?.metrics?.size * 0.1) {
          console.log(`  ⚠️ Consider running VACUUM to reclaim space`);
        }
      }
      
      // Table analysis
      if (result?.tableAnalyses?.length > 0) {
        console.log('\n📋 Table Analysis:');
        
        const sortedTables = result.tableAnalyses
          .sort((a, b) => b.rowCount - a.rowCount)
          .slice(0, 5);
        
        for (const table of sortedTables) {
          console.log(`\n  ${table.tableName}:`);
          console.log(`    Rows: ${table?.rowCount?.toLocaleString()}`);
          console.log(`    Indexes: ${table.indexCount}`);
          console.log(`    Avg Row Size: ${table?.avgRowSize?.toFixed(0)} bytes`);
          console.log(`    Est. Total Size: ${this.formatBytes(table.totalSize)}`);
          
          if (table?.indexes?.length > 0) {
            console.log(`    Indexes: ${table?.indexes?.map(idx => idx.indexName).join(', ')}`);
          }
        }
      }
      
      // Query benchmarks
      if (result?.benchmarks?.length > 0) {
        console.log('\n⚡ Query Performance:');
        
        const successfulBenchmarks = result?.benchmarks?.filter(b => b.success);
        const failedBenchmarks = result?.benchmarks?.filter(b => !b.success);
        
        if (successfulBenchmarks?.length || 0 > 0) {
          console.log('\n  Successful Queries:');
          successfulBenchmarks.forEach(benchmark => {
            const avgMs = benchmark?.avgExecutionTime;
            const p95Ms = benchmark?.p95ExecutionTime;
            const status = avgMs < 10 ? '🟢' : avgMs < 50 ? '🟡' : '🔴';
            
            console.log(`\n  ${status} ${benchmark.description}`);
            console.log(`    Average: ${avgMs.toFixed(2)}ms`);
            console.log(`    P95: ${p95Ms.toFixed(2)}ms`);
            console.log(`    Rows: ${benchmark?.rowsAffected?.toLocaleString()}`);
          });
        }
        
        if (failedBenchmarks?.length || 0 > 0) {
          console.log('\n  Failed Queries:');
          failedBenchmarks.forEach(benchmark => {
            console.log(`\n  ❌ ${benchmark.description}`);
            console.log(`    Error: ${benchmark.error}`);
          });
        }
      }
    }
    
    // Performance Analysis
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE ANALYSIS & RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    const recommendations = [];
    
    for (const result of results) {
      if (!result.metrics) continue;
      
      // Large database warning
      if (result?.metrics?.size > 1024 * 1024 * 1024) { // > 1GB
        recommendations.push({
          priority: 'HIGH',
          database: result.name,
          issue: `Large database size: ${result?.metrics?.sizeHuman}`,
          solution: 'Consider archiving old data, partitioning, or optimizing storage'
        });
      }
      
      // Unused space warning
      if (result?.metrics?.unusedSpace > result?.metrics?.size * 0.2) {
        recommendations.push({
          priority: 'MEDIUM',
          database: result.name,
          issue: `High unused space: ${this.formatBytes(result?.metrics?.unusedSpace)}`,
          solution: 'Run VACUUM command to reclaim space'
        });
      }
      
      // Slow query warnings
      const slowQueries = result?.benchmarks?.filter(b => b.success && b.avgExecutionTime > 100);
      if (slowQueries?.length || 0 > 0) {
        recommendations.push({
          priority: 'HIGH',
          database: result.name,
          issue: `${slowQueries?.length || 0} slow queries detected (>100ms average)`,
          solution: 'Add indexes, optimize queries, consider query caching'
        });
      }
      
      // Table without indexes
      const tablesWithoutIndexes = result?.tableAnalyses?.filter(t => 
        t.rowCount > 1000 && t.indexCount === 0
      );
      if (tablesWithoutIndexes?.length || 0 > 0) {
        recommendations.push({
          priority: 'MEDIUM',
          database: result.name,
          issue: `Large tables without indexes: ${tablesWithoutIndexes?.map(t => t.tableName).join(', ')}`,
          solution: 'Add appropriate indexes based on query patterns'
        });
      }
    }
    
    // Display recommendations
    const priorities = ['HIGH', 'MEDIUM', 'LOW'];
    for (const priority of priorities) {
      const priorityRecs = recommendations?.filter(r => r.priority === priority);
      if (priorityRecs?.length || 0 === 0) continue;
      
      console.log(`\n🔴 ${priority} PRIORITY:`);
      priorityRecs.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.database}: ${rec.issue}`);
        console.log(`   💡 Solution: ${rec.solution}`);
      });
    }
    
    if (recommendations?.length || 0 === 0) {
      console.log('\n✅ All databases are performing well within acceptable ranges!');
    }
    
    // Overall statistics
    const totalDatabases = results?.filter(r => r.metrics).length;
    const totalSize = results.reduce((sum: any, r: any) => sum + (r.metrics?.size || 0), 0);
    const totalTables = results.reduce((sum: any, r: any) => sum + (r.metrics?.tableCount || 0), 0);
    const totalIndexes = results.reduce((sum: any, r: any) => sum + (r.metrics?.indexCount || 0), 0);
    
    console.log('\n📊 OVERALL STATISTICS');
    console.log('-'.repeat(30));
    console.log(`Active Databases: ${totalDatabases}`);
    console.log(`Total Size: ${this.formatBytes(totalSize)}`);
    console.log(`Total Tables: ${totalTables}`);
    console.log(`Total Indexes: ${totalIndexes}`);
    console.log(`Avg Indexes per Table: ${totalTables > 0 ? (totalIndexes / totalTables).toFixed(1) : 'N/A'}`);
  }

  public async saveResults(results: Array<{
    name: string;
    metrics: DatabaseMetrics | null;
    benchmarks: QueryBenchmark[];
    tableAnalyses: TableAnalysis[];
  }>) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = `benchmark-results/database-benchmark-${timestamp}.json`;
    
    const report = {
      timestamp: new Date().toISOString(),
      results,
      summary: {
        totalDatabases: results?.filter(r => r.metrics).length,
        totalSize: results.reduce((sum: any, r: any) => sum + (r.metrics?.size || 0), 0),
        totalTables: results.reduce((sum: any, r: any) => sum + (r.metrics?.tableCount || 0), 0),
        totalIndexes: results.reduce((sum: any, r: any) => sum + (r.metrics?.indexCount || 0), 0),
        avgQueryTime: results.reduce((sum: any, r: any) => {
          const successfulQueries = r?.benchmarks?.filter(b => b.success);
          const avgTime = successfulQueries.reduce((s: any, b: any) => s + b.avgExecutionTime, 0) / successfulQueries?.length || 0;
          return sum + (avgTime || 0);
        }, 0) / results?.length || 0
      }
    };
    
    try {
      await writeFile(resultsPath, JSON.stringify(report, null, 2));
      console.log(`\n📄 Results saved to: ${resultsPath}`);
    } catch (error) {
      console.log(`⚠️ Could not save results: ${error}`);
    }
  }

  public async runBenchmarks(): Promise<void> {
    console.log('🚀 Starting database performance benchmarks...');
    
    const results = [];
    
    for (const database of this.databases) {
      const result = await this.benchmarkDatabase(database.name, database.path);
      results.push({
        name: database.name,
        ...result
      });
    }
    
    this.displayResults(results);
    await this.saveResults(results);
    
    console.log('\n✅ Database performance benchmarks completed!');
  }
}

// Main execution
async function main() {
  const benchmark = new DatabasePerformanceBenchmark();
  
  try {
    await benchmark.runBenchmarks();
  } catch (error) {
    console.error('Database benchmark failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main();
}

export { DatabasePerformanceBenchmark, QueryBenchmark, DatabaseMetrics, TableAnalysis };