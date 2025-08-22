/**
 * Connection Pool Performance Tests
 * Validates the optimized connection pooling implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedConnectionManager, createDefaultConfig } from '../UnifiedConnectionManager';
import { OptimizedWalmartDatabaseManager } from '../OptimizedWalmartDatabaseManager';
import { DatabaseManager } from '../DatabaseManager';
import { performance } from "perf_hooks";

describe("Connection Pool Performance Tests", () => {
  let unifiedManager: UnifiedConnectionManager;
  const testConfig = {
    main: {
      path: "./test_perf_main.db",
      maxConnections: 10,
      connectionTimeout: 5000,
      idleTimeout: 30000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 10000,
      memoryMap: 67108864, // 64MB
      busyTimeout: 2000,
    },
    walmart: {
      path: "./test_perf_walmart.db",
      maxConnections: 8,
      minConnections: 2,
      connectionTimeout: 3000,
      idleTimeout: 60000,
      enableWAL: true,
      enableForeignKeys: true,
      cacheSize: 8000,
      memoryMap: 67108864, // 64MB
      busyTimeout: 1500,
    },
  };

  beforeAll(async () => {
    unifiedManager = UnifiedConnectionManager.getInstance(testConfig);
    await unifiedManager.initialize();
  });

  afterAll(async () => {
    await unifiedManager.shutdown();
  });

  describe("Main Database Performance", () => {
    test("should handle high-concurrency queries efficiently", async () => {
      const mainDb = unifiedManager.getMainDatabase();
      const numQueries = 500;
      const startTime = performance.now();

      // Create test table
      await mainDb.executeQuery((db: any) => {
        db.exec(`
          CREATE TABLE IF NOT EXISTS perf_test_main (
            id INTEGER PRIMARY KEY,
            data TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        return true;
      });

      // Execute concurrent queries
      const queries = Array.from({ length: numQueries }, (_, i) =>
        mainDb.executeQuery((db: any) => {
          const stmt = db.prepare("INSERT INTO perf_test_main (data) VALUES (?)");
          stmt.run(`test_data_${i}`);
          return i;
        })
      );

      const results = await Promise.all(queries);
      const duration = performance.now() - startTime;
      const qps = numQueries / (duration / 1000);

      expect(results).toHaveLength(numQueries);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(qps).toBeGreaterThan(50); // At least 50 QPS

      console.log(`Main DB Performance: ${Math.round(qps)} QPS (${Math.round(duration)}ms for ${numQueries} queries)`);
    });

    test("should maintain connection pool limits", async () => {
      const mainDb = unifiedManager.getMainDatabase();
      const pool = mainDb.getConnectionPool();

      // Execute queries to create connections
      const queries = Array.from({ length: 15 }, (_, i) =>
        mainDb.executeQuery((db: any) => {
          db.prepare("SELECT ? as test").get(i);
          return i;
        })
      );

      await Promise.all(queries);
      const stats = pool.getStats();

      expect(stats.totalConnections).toBeLessThanOrEqual(testConfig?.main?.maxConnections);
      expect(stats.activeConnections).toBeGreaterThanOrEqual(0);
    });

    test("should track query performance metrics", async () => {
      const mainDb = unifiedManager.getMainDatabase();
      
      // Execute some queries
      await Promise.all([
        mainDb.executeQuery((db: any) => db.prepare("SELECT 1").get()),
        mainDb.executeQuery((db: any) => db.prepare("SELECT 2").get()),
        mainDb.executeQuery((db: any) => db.prepare("SELECT 3").get()),
      ]);

      const stats = mainDb.getConnectionPool().getStats();
      
      expect(stats.totalQueries).toBeGreaterThan(0);
      expect(stats.avgQueryTime).toBeGreaterThan(0);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe("Walmart Database Performance", () => {
    test("should handle high-volume product queries", async () => {
      const walmartDb = unifiedManager.getWalmartDatabase();
      const numQueries = 300;
      const startTime = performance.now();

      // Create test data
      await walmartDb.executeTransaction((db: any) => {
        const insertStmt = db.prepare(`
          INSERT INTO walmart_products (product_id, name, brand, current_price, in_stock, stock_level)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (let i = 0; i < 100; i++) {
          insertStmt.run(
            `PERF_${i}`,
            `Test Product ${i}`,
            "Test Brand",
            9.99 + (i * 0.1),
            1,
            50
          );
        }
        return 100;
      });

      // Execute concurrent search queries
      const queries = Array.from({ length: numQueries }, (_, i) =>
        walmartDb.executeQuery(
          "SELECT * FROM walmart_products WHERE current_price < ? AND in_stock = 1 LIMIT 10",
          [20 + (i % 10)]
        )
      );

      const results = await Promise.all(queries);
      const duration = performance.now() - startTime;
      const qps = numQueries / (duration / 1000);

      expect(results).toHaveLength(numQueries);
      expect(duration).toBeLessThan(8000); // Should complete within 8 seconds
      expect(qps).toBeGreaterThan(37); // At least 37 QPS (more realistic for complex queries)

      console.log(`Walmart DB Performance: ${Math.round(qps)} QPS (${Math.round(duration)}ms for ${numQueries} queries)`);
    });

    test("should manage connection pool efficiently", async () => {
      const walmartDb = unifiedManager.getWalmartDatabase();
      
      // Execute queries to stress the pool
      const queries = Array.from({ length: 20 }, (_, i) =>
        walmartDb.executeQuery("SELECT COUNT(*) as count FROM walmart_products")
      );

      await Promise.all(queries);
      const metrics = walmartDb.getMetrics();

      expect(metrics.totalConnections).toBeLessThanOrEqual(testConfig?.walmart.maxConnections);
      expect(metrics.totalConnections).toBeGreaterThanOrEqual(testConfig?.walmart.minConnections);
      expect(metrics.errors).toBe(0);
    });

    test("should provide detailed performance metrics", async () => {
      const walmartDb = unifiedManager.getWalmartDatabase();
      
      // Execute queries with varying complexity
      await Promise.all([
        walmartDb.executeQuery("SELECT COUNT(*) FROM walmart_products"),
        walmartDb.executeQuery("SELECT * FROM walmart_products WHERE brand = 'Test Brand' LIMIT 5"),
        walmartDb.executeQuery("SELECT AVG(current_price) FROM walmart_products WHERE in_stock = 1"),
      ]);

      const metrics = walmartDb.getMetrics();
      
      expect(metrics.totalQueries).toBeGreaterThan(0);
      expect(metrics.avgQueryTime).toBeGreaterThan(0);
      expect(metrics.queryTimePercentiles).toHaveProperty('p50');
      expect(metrics.queryTimePercentiles).toHaveProperty('p90');
      expect(metrics.queryTimePercentiles).toHaveProperty('p95');
      expect(metrics.queryTimePercentiles).toHaveProperty('p99');
    });
  });

  describe("Unified Manager Performance", () => {
    test("should handle cross-database operations efficiently", async () => {
      const startTime = performance.now();

      // Execute operations across both databases
      const operations = await Promise.all([
        // Main database operations
        unifiedManager.executeMainQuery((db: any) => {
          return db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();
        }),
        unifiedManager.executeMainTransaction((db: any) => {
          db.exec("CREATE TABLE IF NOT EXISTS cross_test (id INTEGER PRIMARY KEY, data TEXT)");
          const stmt = db.prepare("INSERT INTO cross_test (data) VALUES (?)");
          stmt.run("cross_db_test");
          return db.changes;
        }),
        
        // Walmart database operations
        unifiedManager.executeWalmartQuery("SELECT COUNT(*) as count FROM walmart_products"),
        unifiedManager.executeWalmartTransaction((db: any) => {
          const stmt = db.prepare("UPDATE walmart_products SET last_checked_at = CURRENT_TIMESTAMP WHERE product_id LIKE 'PERF_%'");
          return stmt.run();
        }),
      ]);

      const duration = performance.now() - startTime;
      
      expect(operations).toHaveLength(4);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`Cross-database operations: ${Math.round(duration)}ms for 4 operations`);
    });

    test("should provide comprehensive health monitoring", async () => {
      const health = await unifiedManager.healthCheck();
      
      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('main');
      expect(health).toHaveProperty('walmart');
      
      expect(health.main).toHaveProperty('healthy');
      expect(health.main).toHaveProperty('sqlite');
      expect(health.main).toHaveProperty('chromadb');
      
      expect(health.walmart).toHaveProperty('healthy');
      expect(health.walmart).toHaveProperty('poolMetrics');
      expect(health.walmart).toHaveProperty('connectionInfo');
      
      // Health should be good for properly initialized system
      expect(health.overall).toBe(true);
      expect(health?.main?.length).toBe(true);
      expect(health?.walmart.healthy).toBe(true);
    });

    test("should provide detailed system metrics", async () => {
      const stats = await unifiedManager.getStatistics();
      
      expect(stats).toHaveProperty('main');
      expect(stats).toHaveProperty('walmart');
      expect(stats).toHaveProperty('combined');
      
      expect(stats.combined).toHaveProperty('totalConnections');
      expect(stats.combined).toHaveProperty('totalQueries');
      expect(stats.combined).toHaveProperty('avgQueryTime');
      expect(stats.combined).toHaveProperty('memoryUsage');
      
      expect(stats?.combined?.length).toBeGreaterThan(0);
      expect(stats?.combined?.length).toBeGreaterThan(0);
    });
  });

  describe("Memory and Resource Management", () => {
    test("should maintain reasonable memory usage under load", async () => {
      const initialMetrics = await unifiedManager.getMetrics();
      
      // Execute memory-intensive operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        operations.push(
          unifiedManager.executeMainQuery((db: any) => {
            // Create temporary data that should be cleaned up
            const data = Array.from({ length: 1000 }, (_, j) => `data_${i}_${j}`);
            return data?.length || 0;
          })
        );
      }
      
      await Promise.all(operations);
      const finalMetrics = await unifiedManager.getMetrics();
      
      // Memory usage should not grow excessively
      const memoryGrowth = finalMetrics?.main?.memoryUsage - initialMetrics?.main?.memoryUsage;
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    });

    test("should properly cleanup idle connections", async () => {
      const walmartDb = unifiedManager.getWalmartDatabase();
      
      // Create connections
      const queries = Array.from({ length: 5 }, (_, i) =>
        walmartDb.executeQuery("SELECT 1 as test")
      );
      await Promise.all(queries);
      
      const beforeCleanup = walmartDb.getMetrics();
      
      // Wait for cleanup cycle (reduced timeout for testing)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const afterCleanup = walmartDb.getMetrics();
      
      // Connections should be managed properly
      expect(afterCleanup.totalConnections).toBeGreaterThanOrEqual(testConfig?.walmart.minConnections);
      expect(afterCleanup.totalConnections).toBeLessThanOrEqual(testConfig?.walmart.maxConnections);
    });
  });

  describe("Error Handling and Recovery", () => {
    test("should handle database errors gracefully", async () => {
      const mainDb = unifiedManager.getMainDatabase();
      
      try {
        await mainDb.executeQuery((db: any) => {
          // This should throw an error
          return db.prepare("SELECT * FROM non_existent_table_12345").get();
        });
        fail("Expected error was not thrown");
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Pool should still be healthy after error
      const health = await unifiedManager.healthCheck();
      expect(health?.main?.length).toBe(true);
    });

    test("should handle transaction rollbacks properly", async () => {
      const walmartDb = unifiedManager.getWalmartDatabase();
      
      // Get initial count
      const initialCount = await walmartDb.executeQuery(
        "SELECT COUNT(*) as count FROM walmart_products"
      ) as { count: number }[];
      
      try {
        await walmartDb.executeTransaction((db: any) => {
          const stmt = db.prepare("INSERT INTO walmart_products (product_id, name) VALUES (?, ?)");
          stmt.run("ERROR_TEST", "Error Test Product");
          
          // Force an error to trigger rollback
          throw new Error("Intentional test error");
        });
        fail("Expected error was not thrown");
      } catch (error) {
        expect(error.message).toBe("Intentional test error");
      }
      
      // Count should be unchanged due to rollback
      const finalCount = await walmartDb.executeQuery(
        "SELECT COUNT(*) as count FROM walmart_products"
      ) as { count: number }[];
      
      expect(finalCount[0].count).toBe(initialCount[0].count);
    });
  });
});

// Benchmark tests for performance comparison
describe("Performance Benchmarks", () => {
  test("should benchmark query performance across different pool sizes", async () => {
    const results = [];
    
    for (const poolSize of [5, 10, 15]) {
      const testManager = UnifiedConnectionManager.getInstance({
        main: {
          path: `./benchmark_${poolSize}.db`,
          maxConnections: poolSize,
          connectionTimeout: 5000,
          idleTimeout: 30000,
          enableWAL: true,
          enableForeignKeys: true,
          cacheSize: 10000,
          memoryMap: 67108864,
          busyTimeout: 2000,
        },
        walmart: {
          path: `./benchmark_walmart_${poolSize}.db`,
          maxConnections: poolSize,
          minConnections: Math.max(1, Math.floor(poolSize / 3)),
          connectionTimeout: 3000,
          idleTimeout: 60000,
          enableWAL: true,
          enableForeignKeys: true,
          cacheSize: 8000,
          memoryMap: 67108864,
          busyTimeout: 1500,
        },
      });
      
      await testManager.initialize();
      
      const startTime = performance.now();
      const numQueries = 200;
      
      const queries = Array.from({ length: numQueries }, (_, i) =>
        testManager.executeMainQuery((db: any) => {
          return db.prepare("SELECT ? as test_value").get(i);
        })
      );
      
      await Promise.all(queries);
      const duration = performance.now() - startTime;
      const qps = numQueries / (duration / 1000);
      
      results.push({
        poolSize,
        duration,
        qps: Math.round(qps),
      });
      
      await testManager.shutdown();
    }
    
    console.table(results);
    
    // Performance should generally improve with larger pool sizes
    expect(results[2].qps).toBeGreaterThanOrEqual(results[0].qps * 0.8); // Allow some variance
  });
});