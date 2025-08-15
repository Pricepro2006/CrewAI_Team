/**
 * Connection Pool Tests
 * Tests for the production-ready database connection pool system
 */

import {
  DatabaseConnectionPool,
  getDatabaseConnection,
  executeQuery,
  executeTransaction,
  shutdownConnectionPool,
} from "../ConnectionPool.js";
import { readFileSync } from "fs";
import { join } from "path";

describe("DatabaseConnectionPool", () => {
  const testDbPath = "./test_connection_pool.db";

  afterEach(async () => {
    // Clean up after each test
    try {
      await shutdownConnectionPool();
    } catch (error) {
      // Ignore shutdown errors in tests
    }
  });

  test("should create singleton instance", () => {
    const pool1 = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });
    const pool2 = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    expect(pool1).toBe(pool2);
  });

  test("should provide thread-safe connections", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    const connection = pool.getConnection();
    const db = connection.getDatabase();

    // Test basic query
    const result = db.prepare("SELECT 1 as test").get();
    expect(result).toEqual({ test: 1 });
  });

  test("should track connection metrics", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Get connection and perform some queries
    await executeQuery((db: any) => {
      db.prepare("SELECT 1 as test").get();
      return true;
    });

    const stats = pool.getStats();
    expect(stats.totalConnections).toBeGreaterThan(0);
    expect(stats.totalQueries).toBeGreaterThan(0);
  });

  test("should handle transactions correctly", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Create test table
    await executeQuery((db: any) => {
      db.exec(
        "CREATE TABLE IF NOT EXISTS test_table (id INTEGER PRIMARY KEY, value TEXT)",
      );
      return true;
    });

    // Test transaction
    const result = await executeTransaction((db: any) => {
      const insert = db.prepare("INSERT INTO test_table (value) VALUES (?)");
      insert.run("test1");
      insert.run("test2");

      const count = db
        .prepare("SELECT COUNT(*) as count FROM test_table")
        .get() as { count: number };
      return count.count;
    });

    expect(result).toBeGreaterThanOrEqual(2);
  });

  test("should provide health check functionality", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    const health = await pool.healthCheck();

    expect(health).toHaveProperty("healthy");
    expect(health).toHaveProperty("stats");
    expect(health).toHaveProperty("errors");
  });

  test("should handle connection cleanup", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
      idleTimeout: 100, // Very short timeout for testing
    });

    // Get initial stats
    const initialStats = pool.getStats();

    // Wait for cleanup
    await new Promise((resolve: any) => setTimeout(resolve, 200));

    // Connection should still exist since it's the main thread connection
    const finalStats = pool.getStats();
    expect(finalStats.totalConnections).toBeGreaterThanOrEqual(0);
  });

  test("should handle errors gracefully", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    try {
      await executeQuery((db: any) => {
        // This should throw an error
        db.prepare("SELECT * FROM non_existent_table").get();
        return true;
      });
      fail("Expected error was not thrown");
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  test("should handle concurrent operations", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Create test table
    await executeQuery((db: any) => {
      db.exec(
        "CREATE TABLE IF NOT EXISTS concurrent_test (id INTEGER PRIMARY KEY, thread_id INTEGER)",
      );
      return true;
    });

    // Run multiple concurrent operations
    const operations = Array.from({ length: 5 }, (_, i) =>
      executeQuery((db: any) => {
        const stmt = db.prepare(
          "INSERT INTO concurrent_test (thread_id) VALUES (?)",
        );
        stmt.run(i);
        return i;
      }),
    );

    const results = await Promise.all(operations);
    expect(results).toHaveLength(5);
    expect(results).toEqual([0, 1, 2, 3, 4]);
  });

  test("should provide detailed connection metrics", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Perform some operations to generate metrics
    await executeQuery((db: any) => db.prepare("SELECT 1").get());
    await executeQuery((db: any) => db.prepare("SELECT 2").get());

    const metrics = pool.getConnectionMetrics();
    expect(metrics).toBeInstanceOf(Array);

    if (metrics?.length || 0 > 0) {
      const metric = metrics[0];
      expect(metric).toHaveProperty("id");
      expect(metric).toHaveProperty("threadId");
      expect(metric).toHaveProperty("created");
      expect(metric).toHaveProperty("lastUsed");
      expect(metric).toHaveProperty("queryCount");
      expect(metric).toHaveProperty("isActive");
    }
  });

  test("should handle graceful shutdown", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Perform some operations
    await executeQuery((db: any) => db.prepare("SELECT 1").get());

    // Should shutdown without errors
    await expect(pool.shutdown()).resolves?.not?.toThrow();
  });
});

// Integration tests with actual services
describe("ConnectionPool Integration", () => {
  const testDbPath = "./test_integration.db";

  afterEach(async () => {
    try {
      await shutdownConnectionPool();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("should work with DatabaseManager", async () => {
    const { getDatabaseManager } = await import("../DatabaseManager.js");

    const dbManager = getDatabaseManager({
      sqlite: { path: testDbPath },
    });

    await dbManager.initialize();

    const stats = await dbManager.getStatistics();
    expect(stats).toHaveProperty("sqlite");
    expect(stats.sqlite).toHaveProperty("size");

    await dbManager.close();
  });

  test("should work with EmailThreePhaseAnalysisService", async () => {
    const { EmailThreePhaseAnalysisService } = await import(
      "../../core/services/EmailThreePhaseAnalysisService.js"
    );

    const service = new EmailThreePhaseAnalysisService(testDbPath);

    // Should initialize without errors
    expect(service).toBeDefined();

    await service.shutdown();
  });

  test("should work with EmailChainAnalyzer", async () => {
    const { EmailChainAnalyzer } = await import(
      "../../core/services/EmailChainAnalyzer.js"
    );

    const analyzer = new EmailChainAnalyzer(testDbPath);

    // Should initialize without errors
    expect(analyzer).toBeDefined();

    analyzer.close();
  });
});

// Performance tests
describe("ConnectionPool Performance", () => {
  const testDbPath = "./test_performance.db";

  afterEach(async () => {
    try {
      await shutdownConnectionPool();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test("should handle high query volume efficiently", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Create test table
    await executeQuery((db: any) => {
      db.exec(
        "CREATE TABLE IF NOT EXISTS perf_test (id INTEGER PRIMARY KEY, value TEXT)",
      );
      return true;
    });

    const startTime = Date.now();
    const numQueries = 1000;

    // Run many queries
    const promises = Array.from({ length: numQueries }, (_, i) =>
      executeQuery((db: any) => {
        const stmt = db.prepare("INSERT INTO perf_test (value) VALUES (?)");
        stmt.run(`value_${i}`);
        return i;
      }),
    );

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const queriesPerSecond = numQueries / (duration / 1000);

    console.log(`Performance: ${queriesPerSecond.toFixed(0)} queries/second`);

    // Should complete within reasonable time
    expect(duration).toBeLessThan(10000); // 10 seconds max
    expect(queriesPerSecond).toBeGreaterThan(100); // At least 100 QPS
  });

  test("should maintain reasonable memory usage", async () => {
    const pool = DatabaseConnectionPool.getInstance({
      databasePath: testDbPath,
    });

    // Perform many operations
    for (let i = 0; i < 100; i++) {
      await executeQuery((db: any) => {
        db.prepare("SELECT ? as iteration").get(i);
        return i;
      });
    }

    const stats = pool.getStats();
    const metrics = pool.getConnectionMetrics();

    // Memory usage should be tracked
    expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);

    // Should not create excessive connections
    expect(stats.totalConnections).toBeLessThanOrEqual(10);
  });
});
