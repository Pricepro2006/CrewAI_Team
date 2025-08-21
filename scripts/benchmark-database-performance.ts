/**
 * Database Performance Benchmark Script
 * 
 * Tests and compares performance between direct Database instantiation
 * and optimized DatabaseManager with connection pooling.
 */

import { performance } from 'perf_hooks';
import Database from 'better-sqlite3';
import { databaseManager, executeQuery, executeTransaction } from '../src/core/database/DatabaseManager.js';
import { logger } from '../src/utils/logger.js';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface BenchmarkResult {
  name: string;
  method: 'direct' | 'pooled';
  operations: number;
  totalTime: number;
  avgTime: number;
  opsPerSecond: number;
  memoryUsage: number;
  errors: number;
}

interface BenchmarkSuite {
  suiteName: string;
  results: BenchmarkResult[];
  summary: {
    directTotal: number;
    pooledTotal: number;
    improvementPercent: number;
    winner: 'direct' | 'pooled' | 'tie';
  };
}

class DatabaseBenchmark {
  private testDbPath: string;
  private results: BenchmarkSuite[] = [];

  constructor() {
    this.testDbPath = './data/benchmark_test.db';
  }

  /**
   * Run comprehensive database performance benchmarks
   */
  public async runBenchmarks(): Promise<void> {
    console.log('🚀 Starting Database Performance Benchmarks\n');

    // Initialize test data
    await this.setupTestData();

    // Run benchmark suites
    await this.runQueryBenchmarks();
    await this.runTransactionBenchmarks();
    await this.runConcurrencyBenchmarks();
    await this.runConnectionManagementBenchmarks();

    // Generate report
    this.generateReport();
  }

  /**
   * Setup test database with sample data
   */
  private async setupTestData(): Promise<void> {
    console.log('🔧 Setting up test data...');

    // Create test data using DatabaseManager
    await executeQuery('main', (db) => {
      // Create test tables
      db.exec(`
        DROP TABLE IF EXISTS benchmark_test;
        CREATE TABLE benchmark_test (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_benchmark_name ON benchmark_test(name);
        CREATE INDEX IF NOT EXISTS idx_benchmark_value ON benchmark_test(value);
      `);

      // Insert test data
      const insertStmt = db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)');
      const insertMany = db.transaction((rows: Array<[string, number]>) => {
        for (const row of rows) {
          insertStmt.run(row[0], row[1]);
        }
      });

      const testData: Array<[string, number]> = [];
      for (let i = 0; i < 10000; i++) {
        testData.push([`test_record_${i}`, Math.floor(Math.random() * 1000)]);
      }

      insertMany(testData);
      return true;
    });

    console.log('✅ Test data setup complete\n');
  }

  /**
   * Benchmark basic query operations
   */
  private async runQueryBenchmarks(): Promise<void> {
    console.log('📊 Running Query Benchmarks...');

    const suite: BenchmarkSuite = {
      suiteName: 'Query Operations',
      results: [],
      summary: { directTotal: 0, pooledTotal: 0, improvementPercent: 0, winner: 'tie' }
    };

    // SELECT queries
    suite.results.push(await this.benchmarkSelect('direct', 1000));
    suite.results.push(await this.benchmarkSelect('pooled', 1000));

    // INSERT queries
    suite.results.push(await this.benchmarkInsert('direct', 100));
    suite.results.push(await this.benchmarkInsert('pooled', 100));

    // UPDATE queries
    suite.results.push(await this.benchmarkUpdate('direct', 100));
    suite.results.push(await this.benchmarkUpdate('pooled', 100));

    // DELETE queries
    suite.results.push(await this.benchmarkDelete('direct', 50));
    suite.results.push(await this.benchmarkDelete('pooled', 50));

    this.calculateSuiteSummary(suite);
    this.results.push(suite);
  }

  /**
   * Benchmark transaction operations
   */
  private async runTransactionBenchmarks(): Promise<void> {
    console.log('🔄 Running Transaction Benchmarks...');

    const suite: BenchmarkSuite = {
      suiteName: 'Transaction Operations',
      results: [],
      summary: { directTotal: 0, pooledTotal: 0, improvementPercent: 0, winner: 'tie' }
    };

    // Batch insert transactions
    suite.results.push(await this.benchmarkBatchInsert('direct', 10, 100));
    suite.results.push(await this.benchmarkBatchInsert('pooled', 10, 100));

    // Complex transactions
    suite.results.push(await this.benchmarkComplexTransaction('direct', 50));
    suite.results.push(await this.benchmarkComplexTransaction('pooled', 50));

    this.calculateSuiteSummary(suite);
    this.results.push(suite);
  }

  /**
   * Benchmark concurrent operations
   */
  private async runConcurrencyBenchmarks(): Promise<void> {
    console.log('🔀 Running Concurrency Benchmarks...');

    const suite: BenchmarkSuite = {
      suiteName: 'Concurrency Operations',
      results: [],
      summary: { directTotal: 0, pooledTotal: 0, improvementPercent: 0, winner: 'tie' }
    };

    // Concurrent reads
    suite.results.push(await this.benchmarkConcurrentReads('direct', 50, 10));
    suite.results.push(await this.benchmarkConcurrentReads('pooled', 50, 10));

    // Mixed read/write operations
    suite.results.push(await this.benchmarkMixedOperations('direct', 30, 5));
    suite.results.push(await this.benchmarkMixedOperations('pooled', 30, 5));

    this.calculateSuiteSummary(suite);
    this.results.push(suite);
  }

  /**
   * Benchmark connection management overhead
   */
  private async runConnectionManagementBenchmarks(): Promise<void> {
    console.log('🔌 Running Connection Management Benchmarks...');

    const suite: BenchmarkSuite = {
      suiteName: 'Connection Management',
      results: [],
      summary: { directTotal: 0, pooledTotal: 0, improvementPercent: 0, winner: 'tie' }
    };

    // Connection creation overhead
    suite.results.push(await this.benchmarkConnectionCreation('direct', 100));
    suite.results.push(await this.benchmarkConnectionCreation('pooled', 100));

    // Rapid open/close cycles
    suite.results.push(await this.benchmarkRapidConnections('direct', 50));
    suite.results.push(await this.benchmarkRapidConnections('pooled', 50));

    this.calculateSuiteSummary(suite);
    this.results.push(suite);
  }

  // Individual benchmark implementations
  private async benchmarkSelect(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db', { readonly: true });
          db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1);
          db.close();
        } else {
          await executeQuery('main', (db) => 
            db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1)
          );
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `SELECT queries (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkInsert(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db');
          db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`benchmark_${i}`, i);
          db.close();
        } else {
          await executeQuery('main', (db) =>
            db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`benchmark_${i}`, i)
          );
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `INSERT queries (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkUpdate(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db');
          db.prepare('UPDATE benchmark_test SET value = ? WHERE id = ?').run(
            Math.floor(Math.random() * 1000),
            Math.floor(Math.random() * 1000) + 1
          );
          db.close();
        } else {
          await executeQuery('main', (db) =>
            db.prepare('UPDATE benchmark_test SET value = ? WHERE id = ?').run(
              Math.floor(Math.random() * 1000),
              Math.floor(Math.random() * 1000) + 1
            )
          );
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `UPDATE queries (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkDelete(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db');
          db.prepare('DELETE FROM benchmark_test WHERE id = ?').run(Math.floor(Math.random() * 1000) + 1);
          db.close();
        } else {
          await executeQuery('main', (db) =>
            db.prepare('DELETE FROM benchmark_test WHERE id = ?').run(Math.floor(Math.random() * 1000) + 1)
          );
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `DELETE queries (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkBatchInsert(method: 'direct' | 'pooled', batches: number, batchSize: number): Promise<BenchmarkResult> {
    const operations = batches * batchSize;
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let batch = 0; batch < batches; batch++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db');
          const transaction = db.transaction((rows: Array<[string, number]>) => {
            const stmt = db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)');
            for (const row of rows) {
              stmt.run(row[0], row[1]);
            }
          });

          const rows: Array<[string, number]> = [];
          for (let i = 0; i < batchSize; i++) {
            rows.push([`batch_${batch}_${i}`, Math.floor(Math.random() * 1000)]);
          }
          transaction(rows);
          db.close();
        } else {
          const rows: Array<[string, number]> = [];
          for (let i = 0; i < batchSize; i++) {
            rows.push([`batch_${batch}_${i}`, Math.floor(Math.random() * 1000)]);
          }

          await executeTransaction('main', (db) => {
            const stmt = db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)');
            for (const row of rows) {
              stmt.run(row[0], row[1]);
            }
            return true;
          });
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Batch INSERT (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkComplexTransaction(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db');
          const transaction = db.transaction(() => {
            db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`complex_${i}`, i);
            db.prepare('UPDATE benchmark_test SET value = ? WHERE name = ?').run(i + 100, `complex_${i}`);
            db.prepare('SELECT * FROM benchmark_test WHERE name = ?').get(`complex_${i}`);
          });
          transaction();
          db.close();
        } else {
          await executeTransaction('main', (db) => {
            db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`complex_${i}`, i);
            db.prepare('UPDATE benchmark_test SET value = ? WHERE name = ?').run(i + 100, `complex_${i}`);
            db.prepare('SELECT * FROM benchmark_test WHERE name = ?').get(`complex_${i}`);
            return true;
          });
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Complex transactions (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkConcurrentReads(method: 'direct' | 'pooled', operations: number, concurrency: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    const promises: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push((async () => {
        for (let j = 0; j < Math.floor(operations / concurrency); j++) {
          try {
            if (method === 'direct') {
              const db = new Database('./data/crewai_enhanced.db', { readonly: true });
              db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1);
              db.close();
            } else {
              await executeQuery('main', (db) =>
                db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1)
              );
            }
          } catch (error) {
            errors++;
          }
        }
      })());
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Concurrent reads (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkMixedOperations(method: 'direct' | 'pooled', operations: number, concurrency: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    const promises: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      promises.push((async () => {
        for (let j = 0; j < Math.floor(operations / concurrency); j++) {
          try {
            const operation = Math.random();
            if (operation < 0.7) {
              // 70% reads
              if (method === 'direct') {
                const db = new Database('./data/crewai_enhanced.db', { readonly: true });
                db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1);
                db.close();
              } else {
                await executeQuery('main', (db) =>
                  db.prepare('SELECT * FROM benchmark_test WHERE id = ?').get(Math.floor(Math.random() * 1000) + 1)
                );
              }
            } else {
              // 30% writes
              if (method === 'direct') {
                const db = new Database('./data/crewai_enhanced.db');
                db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`mixed_${i}_${j}`, j);
                db.close();
              } else {
                await executeQuery('main', (db) =>
                  db.prepare('INSERT INTO benchmark_test (name, value) VALUES (?, ?)').run(`mixed_${i}_${j}`, j)
                );
              }
            }
          } catch (error) {
            errors++;
          }
        }
      })());
    }

    await Promise.all(promises);

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Mixed operations (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkConnectionCreation(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db = new Database('./data/crewai_enhanced.db', { readonly: true });
          db.pragma('journal_mode'); // Simple operation to ensure connection is established
          db.close();
        } else {
          await executeQuery('main', (db) => {
            db.pragma('journal_mode');
            return true;
          });
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Connection creation (${method})`,
      method,
      operations,
      totalTime,
      avgTime: totalTime / operations,
      opsPerSecond: (operations / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private async benchmarkRapidConnections(method: 'direct' | 'pooled', operations: number): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    let errors = 0;

    const startTime = performance.now();

    for (let i = 0; i < operations; i++) {
      try {
        if (method === 'direct') {
          const db1 = new Database('./data/crewai_enhanced.db', { readonly: true });
          const db2 = new Database('./data/crewai_enhanced.db', { readonly: true });
          db1.prepare('SELECT 1').get();
          db2.prepare('SELECT 1').get();
          db1.close();
          db2.close();
        } else {
          await Promise.all([
            executeQuery('main', (db) => db.prepare('SELECT 1').get()),
            executeQuery('main', (db) => db.prepare('SELECT 1').get())
          ]);
        }
      } catch (error) {
        errors++;
      }
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    const totalTime = endTime - startTime;

    return {
      name: `Rapid connections (${method})`,
      method,
      operations: operations * 2, // Two operations per iteration
      totalTime,
      avgTime: totalTime / (operations * 2),
      opsPerSecond: ((operations * 2) / totalTime) * 1000,
      memoryUsage: endMemory - startMemory,
      errors
    };
  }

  private calculateSuiteSummary(suite: BenchmarkSuite): void {
    const directResults = suite.results.filter(r => r.method === 'direct');
    const pooledResults = suite.results.filter(r => r.method === 'pooled');

    suite.summary.directTotal = directResults.reduce((sum, r) => sum + r.totalTime, 0);
    suite.summary.pooledTotal = pooledResults.reduce((sum, r) => sum + r.totalTime, 0);
    
    if (suite.summary.directTotal > 0) {
      suite.summary.improvementPercent = 
        ((suite.summary.directTotal - suite.summary.pooledTotal) / suite.summary.directTotal) * 100;
    }

    if (suite.summary.pooledTotal < suite.summary.directTotal) {
      suite.summary.winner = 'pooled';
    } else if (suite.summary.directTotal < suite.summary.pooledTotal) {
      suite.summary.winner = 'direct';
    } else {
      suite.summary.winner = 'tie';
    }
  }

  private generateReport(): void {
    console.log('\n📊 Database Performance Benchmark Report');
    console.log('==========================================\n');

    let overallDirectTotal = 0;
    let overallPooledTotal = 0;

    for (const suite of this.results) {
      console.log(`\n🔍 ${suite.suiteName}`);
      console.log('-'.repeat(50));
      
      for (const result of suite.results) {
        console.log(`${result.name}:`);
        console.log(`  Total time: ${result.totalTime.toFixed(2)}ms`);
        console.log(`  Avg time: ${result.avgTime.toFixed(3)}ms`);
        console.log(`  Ops/sec: ${result.opsPerSecond.toFixed(0)}`);
        console.log(`  Memory: ${(result.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
        if (result.errors > 0) {
          console.log(`  Errors: ${result.errors}`);
        }
        console.log();
      }

      console.log(`Suite Summary:`);
      console.log(`  Direct total: ${suite.summary.directTotal.toFixed(2)}ms`);
      console.log(`  Pooled total: ${suite.summary.pooledTotal.toFixed(2)}ms`);
      console.log(`  Winner: ${suite.summary.winner.toUpperCase()}`);
      if (suite.summary.improvementPercent !== 0) {
        console.log(`  Improvement: ${suite.summary.improvementPercent > 0 ? '+' : ''}${suite.summary.improvementPercent.toFixed(1)}%`);
      }

      overallDirectTotal += suite.summary.directTotal;
      overallPooledTotal += suite.summary.pooledTotal;
    }

    console.log('\n🏆 Overall Results');
    console.log('==================');
    console.log(`Direct database total: ${overallDirectTotal.toFixed(2)}ms`);
    console.log(`Pooled database total: ${overallPooledTotal.toFixed(2)}ms`);
    
    const overallImprovement = ((overallDirectTotal - overallPooledTotal) / overallDirectTotal) * 100;
    console.log(`Overall improvement: ${overallImprovement > 0 ? '+' : ''}${overallImprovement.toFixed(1)}%`);
    
    if (overallPooledTotal < overallDirectTotal) {
      console.log('🎉 DatabaseManager with connection pooling is FASTER!');
    } else if (overallDirectTotal < overallPooledTotal) {
      console.log('⚠️  Direct database connections are faster');
    } else {
      console.log('🤝 Performance is roughly equivalent');
    }

    // Save detailed report to file
    const reportData = {
      timestamp: new Date().toISOString(),
      suites: this.results,
      summary: {
        overallDirectTotal,
        overallPooledTotal,
        overallImprovement,
        winner: overallPooledTotal < overallDirectTotal ? 'pooled' : 'direct'
      }
    };

    const reportPath = join('./reports', `database-benchmark-${Date.now()}.json`);
    writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Main execution
async function main() {
  try {
    const benchmark = new DatabaseBenchmark();
    await benchmark.runBenchmarks();
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  } finally {
    // Shutdown DatabaseManager to ensure clean exit
    try {
      await databaseManager.shutdown();
    } catch (error) {
      console.warn('Warning: Error shutting down DatabaseManager:', error);
    }
  }
}

// Run benchmarks if this script is executed directly
if (import.meta.url.endsWith(process.argv[1])) {
  main();
}

export { DatabaseBenchmark };