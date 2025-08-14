#!/usr/bin/env tsx
/**
 * Performance testing script for Walmart Grocery database
 * Tests query performance after index optimizations
 */

import Database from "better-sqlite3";
import { performance } from "perf_hooks";

const DB_PATH = "./data/walmart_grocery.db";

interface QueryTest {
  name: string;
  query: string;
  params?: any[];
  warmup?: boolean;
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 100) return `${ms.toFixed(2)}ms`;
  return `${ms.toFixed(0)}ms`;
}

async function runPerformanceTests() {
  console.log("🔍 Walmart Grocery Database Performance Analysis");
  console.log("=" .repeat(60));
  
  const db = new Database(DB_PATH);
  
  // Check current configuration
  const pragmas = [
    "journal_mode",
    "synchronous", 
    "cache_size",
    "temp_store",
    "mmap_size",
    "page_size",
    "cache_spill"
  ];
  
  console.log("\n📊 Database Configuration:");
  pragmas.forEach(pragma => {
    const result = db.pragma(pragma);
    console.log(`  ${pragma}: ${JSON.stringify(result)}`);
  });
  
  // Get database stats
  const stats = db.prepare("SELECT COUNT(*) as count FROM walmart_products").get() as any;
  const orderCount = db.prepare("SELECT COUNT(*) as count FROM walmart_order_history").get() as any;
  const itemCount = db.prepare("SELECT COUNT(*) as count FROM walmart_order_items").get() as any;
  
  console.log("\n📈 Database Statistics:");
  console.log(`  Products: ${stats.count}`);
  console.log(`  Orders: ${orderCount.count}`);
  console.log(`  Order Items: ${itemCount.count}`);
  
  // Define test queries
  const queries: QueryTest[] = [
    {
      name: "Simple product search (LIKE)",
      query: "SELECT COUNT(*) as count FROM walmart_products WHERE name LIKE ?",
      params: ["%milk%"],
      warmup: true
    },
    {
      name: "Product by exact name",
      query: "SELECT * FROM walmart_products WHERE name = ? LIMIT 1",
      params: ["Great Value 2% Reduced Fat Milk"]
    },
    {
      name: "Products under price threshold",
      query: "SELECT COUNT(*) as count FROM walmart_products WHERE current_price < ?",
      params: [10]
    },
    {
      name: "In-stock products",
      query: "SELECT COUNT(*) as count FROM walmart_products WHERE in_stock = 1"
    },
    {
      name: "Brand filter",
      query: "SELECT COUNT(*) as count FROM walmart_products WHERE brand = ?",
      params: ["Great Value"]
    },
    {
      name: "Complex search (name + price + stock)",
      query: `
        SELECT * FROM walmart_products 
        WHERE name LIKE ? 
        AND current_price < ? 
        AND in_stock = 1 
        LIMIT 10
      `,
      params: ["%organic%", 20]
    },
    {
      name: "Order history by customer",
      query: `
        SELECT * FROM walmart_order_history 
        WHERE customer_name LIKE ? 
        ORDER BY order_date DESC 
        LIMIT 10
      `,
      params: ["%RICE%"]
    },
    {
      name: "Product with order items join",
      query: `
        SELECT p.*, oi.quantity, oi.unit_price
        FROM walmart_products p
        JOIN walmart_order_items oi ON p.product_id = oi.product_id
        WHERE p.name LIKE ?
        LIMIT 10
      `,
      params: ["%milk%"]
    },
    {
      name: "Aggregate: avg price by category",
      query: `
        SELECT category_path, AVG(current_price) as avg_price
        FROM walmart_products
        WHERE category_path IS NOT NULL
        GROUP BY category_path
        LIMIT 5
      `
    },
    {
      name: "Recent orders with items",
      query: `
        SELECT oh.*, COUNT(oi.id) as item_count
        FROM walmart_order_history oh
        LEFT JOIN walmart_order_items oi ON oh.order_number = oi.order_number
        WHERE oh.order_date > date('now', '-30 days')
        GROUP BY oh.order_number
        LIMIT 10
      `
    }
  ];
  
  console.log("\n⚡ Query Performance Tests:");
  console.log("-".repeat(60));
  
  const results: { name: string; time: number; count?: number }[] = [];
  
  for (const test of queries) {
    // Warmup run if specified
    if (test.warmup) {
      const stmt = db.prepare(test.query);
      stmt.get(...(test.params || []));
    }
    
    // Actual test runs
    const runs = 5;
    const times: number[] = [];
    let resultCount = 0;
    
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      const stmt = db.prepare(test.query);
      const result = test.query.includes("COUNT") 
        ? stmt.get(...(test.params || [])) 
        : stmt.all(...(test.params || []));
      const end = performance.now();
      
      times.push(end - start);
      
      if (i === 0) {
        if (Array.isArray(result)) {
          resultCount = result.length;
        } else if (result && typeof result === 'object' && 'count' in result) {
          resultCount = (result as any).count;
        }
      }
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    results.push({ name: test.name, time: avgTime, count: resultCount });
    
    console.log(`\n📍 ${test.name}`);
    console.log(`  Results: ${resultCount} rows`);
    console.log(`  Avg: ${formatTime(avgTime)} | Min: ${formatTime(minTime)} | Max: ${formatTime(maxTime)}`);
    console.log(`  ${avgTime < 10 ? "✅" : avgTime < 50 ? "⚠️" : "❌"} Performance: ${
      avgTime < 10 ? "Excellent" : avgTime < 50 ? "Good" : avgTime < 100 ? "Acceptable" : "Needs Optimization"
    }`);
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Performance Summary:");
  
  const avgOverall = results.reduce((sum, r) => sum + r.time, 0) / results.length;
  const under10ms = results.filter(r => r.time < 10).length;
  const under50ms = results.filter(r => r.time < 50).length;
  const under100ms = results.filter(r => r.time < 100).length;
  
  console.log(`  Average query time: ${formatTime(avgOverall)}`);
  console.log(`  Queries under 10ms: ${under10ms}/${results.length} (${(under10ms/results.length*100).toFixed(0)}%)`);
  console.log(`  Queries under 50ms: ${under50ms}/${results.length} (${(under50ms/results.length*100).toFixed(0)}%)`);
  console.log(`  Queries under 100ms: ${under100ms}/${results.length} (${(under100ms/results.length*100).toFixed(0)}%)`);
  
  // Compare to previous baseline
  console.log("\n📈 Improvement from Baseline:");
  console.log("  Previous: 200-500ms per search query");
  console.log(`  Current: ${formatTime(avgOverall)} average`);
  console.log(`  Improvement: ${((300 - avgOverall) / 300 * 100).toFixed(0)}% faster`);
  
  // Check index usage
  console.log("\n🔍 Index Analysis:");
  const explainQuery = "SELECT * FROM walmart_products WHERE name LIKE '%milk%'";
  const explanation = db.prepare(`EXPLAIN QUERY PLAN ${explainQuery}`).all();
  console.log("  Query plan for name search:");
  explanation.forEach((row: any) => {
    console.log(`    ${JSON.stringify(row)}`);
  });
  
  db.close();
}

// Run the tests
runPerformanceTests().catch(console.error);