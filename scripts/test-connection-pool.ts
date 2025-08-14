#!/usr/bin/env tsx
/**
 * Connection Pool Performance Testing
 * Tests connection pooling efficiency and concurrent access patterns
 */

import Database from "better-sqlite3";
import { Worker } from "worker_threads";
import { performance } from "perf_hooks";
import { ConnectionPool } from "../src/database/ConnectionPool.js";

const DB_PATH = "./data/walmart_grocery.db";

interface PoolTest {
  name: string;
  concurrency: number;
  queriesPerWorker: number;
  measureMemory?: boolean;
}

async function testDirectConnections(concurrency: number, queries: number) {
  const start = performance.now();
  const startMem = process.memoryUsage();
  
  const promises: Promise<void>[] = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(new Promise<void>((resolve) => {
      const db = new Database(DB_PATH);
      db.pragma("journal_mode = WAL");
      
      for (let j = 0; j < queries; j++) {
        db.prepare("SELECT * FROM walmart_products WHERE current_price < ? LIMIT 10")
          .all(Math.random() * 100);
      }
      
      db.close();
      resolve();
    }));
  }
  
  await Promise.all(promises);
  
  const duration = performance.now() - start;
  const endMem = process.memoryUsage();
  const memDelta = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;
  
  return { duration, memDelta };
}

async function testConnectionPool(concurrency: number, queries: number) {
  const pool = ConnectionPool.getInstance({
    databasePath: DB_PATH,
    maxConnections: 10,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    enableWAL: true,
    enableForeignKeys: true,
    cacheSize: 16,
    memoryMap: 268435456,
    busyTimeout: 5000
  });
  
  const start = performance.now();
  const startMem = process.memoryUsage();
  
  const promises: Promise<void>[] = [];
  
  for (let i = 0; i < concurrency; i++) {
    promises.push(new Promise<void>((resolve) => {
      for (let j = 0; j < queries; j++) {
        const conn = pool.getConnection();
        const db = conn.getDatabase();
        
        db.prepare("SELECT * FROM walmart_products WHERE current_price < ? LIMIT 10")
          .all(Math.random() * 100);
        
        pool.releaseConnection(conn);
      }
      resolve();
    }));
  }
  
  await Promise.all(promises);
  
  const duration = performance.now() - start;
  const endMem = process.memoryUsage();
  const memDelta = (endMem.heapUsed - startMem.heapUsed) / 1024 / 1024;
  
  // Get pool stats
  const stats = pool.getStats();
  
  // Cleanup
  await pool.close();
  
  return { duration, memDelta, stats };
}

async function runPoolTests() {
  console.log("🔄 Connection Pool Performance Analysis");
  console.log("=" .repeat(60));
  
  const tests: PoolTest[] = [
    { name: "Light Load", concurrency: 5, queriesPerWorker: 10 },
    { name: "Medium Load", concurrency: 10, queriesPerWorker: 50 },
    { name: "Heavy Load", concurrency: 20, queriesPerWorker: 100 },
    { name: "Stress Test", concurrency: 50, queriesPerWorker: 200, measureMemory: true }
  ];
  
  console.log("\n📊 Test Configuration:");
  console.log("  Database: walmart_grocery.db");
  console.log("  Pool Size: 10 connections max");
  console.log("  WAL Mode: Enabled");
  console.log("  Cache Size: 16MB per connection");
  
  for (const test of tests) {
    console.log("\n" + "=".repeat(60));
    console.log(`📍 ${test.name}`);
    console.log(`  Concurrency: ${test.concurrency} workers`);
    console.log(`  Queries/Worker: ${test.queriesPerWorker}`);
    console.log(`  Total Queries: ${test.concurrency * test.queriesPerWorker}`);
    
    // Test without pool (direct connections)
    console.log("\n  Without Connection Pool:");
    const directResult = await testDirectConnections(test.concurrency, test.queriesPerWorker);
    const directQPS = (test.concurrency * test.queriesPerWorker) / (directResult.duration / 1000);
    console.log(`    Duration: ${directResult.duration.toFixed(2)}ms`);
    console.log(`    Memory Delta: ${directResult.memDelta.toFixed(2)}MB`);
    console.log(`    Queries/Second: ${directQPS.toFixed(0)}`);
    
    // Test with pool
    console.log("\n  With Connection Pool:");
    const poolResult = await testConnectionPool(test.concurrency, test.queriesPerWorker);
    const poolQPS = (test.concurrency * test.queriesPerWorker) / (poolResult.duration / 1000);
    console.log(`    Duration: ${poolResult.duration.toFixed(2)}ms`);
    console.log(`    Memory Delta: ${poolResult.memDelta.toFixed(2)}MB`);
    console.log(`    Queries/Second: ${poolQPS.toFixed(0)}`);
    
    if (poolResult.stats) {
      console.log("\n  Pool Statistics:");
      console.log(`    Total Connections: ${poolResult.stats.totalConnections}`);
      console.log(`    Active Connections: ${poolResult.stats.activeConnections}`);
      console.log(`    Idle Connections: ${poolResult.stats.idleConnections}`);
      console.log(`    Total Queries: ${poolResult.stats.totalQueries}`);
      console.log(`    Avg Query Time: ${poolResult.stats.avgQueryTime.toFixed(2)}ms`);
    }
    
    // Performance comparison
    const improvement = ((directResult.duration - poolResult.duration) / directResult.duration * 100);
    const memImprovement = ((directResult.memDelta - poolResult.memDelta) / directResult.memDelta * 100);
    
    console.log("\n  Performance Comparison:");
    console.log(`    Speed Improvement: ${improvement.toFixed(1)}%`);
    console.log(`    Memory Improvement: ${memImprovement.toFixed(1)}%`);
    console.log(`    Status: ${improvement > 0 ? "✅ Pool is faster" : "⚠️ Direct is faster"}`);
  }
  
  // Connection reuse test
  console.log("\n" + "=".repeat(60));
  console.log("🔄 Connection Reuse Analysis:");
  
  const pool = ConnectionPool.getInstance({
    databasePath: DB_PATH,
    maxConnections: 5,
    connectionTimeout: 5000,
    idleTimeout: 30000,
    enableWAL: true,
    enableForeignKeys: true,
    cacheSize: 16,
    memoryMap: 268435456,
    busyTimeout: 5000
  });
  
  const connections = [];
  console.log("  Acquiring 5 connections...");
  
  for (let i = 0; i < 5; i++) {
    const conn = pool.getConnection();
    connections.push(conn);
    console.log(`    Connection ${i + 1}: ${conn.getMetrics().id}`);
  }
  
  console.log("  Releasing all connections...");
  connections.forEach(conn => pool.releaseConnection(conn));
  
  console.log("  Re-acquiring 5 connections...");
  const reusedConnections = [];
  for (let i = 0; i < 5; i++) {
    const conn = pool.getConnection();
    reusedConnections.push(conn);
    const isReused = connections.some(c => c.getMetrics().id === conn.getMetrics().id);
    console.log(`    Connection ${i + 1}: ${conn.getMetrics().id} ${isReused ? "(REUSED ✅)" : "(NEW ⚠️)"}`);
  }
  
  await pool.close();
  
  console.log("\n" + "=".repeat(60));
  console.log("✅ Connection Pool Testing Complete");
}

// Run the tests
runPoolTests().catch(console.error);