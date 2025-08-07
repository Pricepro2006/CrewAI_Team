#!/usr/bin/env tsx
/**
 * Performance Benchmark for Walmart Grocery Microservices
 */

import axios from "axios";

const NLP_SERVICE = "http://localhost:3008";
const PRICING_SERVICE = "http://localhost:3007";
const CACHE_SERVICE = "http://localhost:3006";

interface BenchmarkResult {
  service: string;
  endpoint: string;
  requests: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
}

async function benchmarkEndpoint(
  name: string,
  url: string,
  method: "GET" | "POST",
  data?: any,
  requests: number = 100
): Promise<BenchmarkResult> {
  console.log(`Benchmarking ${name}...`);
  
  const latencies: number[] = [];
  let successes = 0;
  let failures = 0;

  for (let i = 0; i < requests; i++) {
    const start = Date.now();
    try {
      if (method === "GET") {
        await axios.get(url, { timeout: 5000 });
      } else {
        await axios.post(url, data, { timeout: 5000 });
      }
      const latency = Date.now() - start;
      latencies.push(latency);
      successes++;
      
      // Show progress
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`  ${i + 1}/${requests} requests completed\r`);
      }
    } catch (error) {
      failures++;
    }
  }
  
  console.log(`  ${requests}/${requests} requests completed`);

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;

  return {
    service: name.split(" - ")[0],
    endpoint: name.split(" - ")[1],
    requests,
    avgLatency: Math.round(avg),
    minLatency: min,
    maxLatency: max,
    p95Latency: p95,
    p99Latency: p99,
    successRate: (successes / requests) * 100
  };
}

async function runBenchmarks() {
  console.log("=== Walmart Microservices Performance Benchmark ===\n");
  console.log("Running 100 requests per endpoint...\n");

  const results: BenchmarkResult[] = [];

  // Benchmark NLP Service
  results.push(await benchmarkEndpoint(
    "NLP - Intent Detection",
    `${NLP_SERVICE}/process`,
    "POST",
    { text: "Add 2 gallons of milk to my list" },
    100
  ));

  // Benchmark Pricing Service
  results.push(await benchmarkEndpoint(
    "Pricing - Single Product",
    `${PRICING_SERVICE}/calculate`,
    "POST",
    { productId: "prod_001", quantity: 1 },
    100
  ));

  results.push(await benchmarkEndpoint(
    "Pricing - Bulk Calculation",
    `${PRICING_SERVICE}/bulk`,
    "POST",
    {
      items: [
        { productId: "prod_001", quantity: 2 },
        { productId: "prod_002", quantity: 3 }
      ]
    },
    100
  ));

  // Benchmark Cache Service
  results.push(await benchmarkEndpoint(
    "Cache - Status Check",
    `${CACHE_SERVICE}/status`,
    "GET",
    undefined,
    100
  ));

  // Display results
  console.log("\n=== Benchmark Results ===\n");
  console.log("Service          | Endpoint         | Avg(ms) | Min(ms) | Max(ms) | P95(ms) | P99(ms) | Success%");
  console.log("-----------------|------------------|---------|---------|---------|---------|---------|----------");
  
  results.forEach(r => {
    console.log(
      `${r.service.padEnd(16)} | ${r.endpoint.padEnd(16)} | ${
        r.avgLatency.toString().padStart(7)
      } | ${
        r.minLatency.toString().padStart(7)
      } | ${
        r.maxLatency.toString().padStart(7)
      } | ${
        r.p95Latency.toString().padStart(7)
      } | ${
        r.p99Latency.toString().padStart(7)
      } | ${
        r.successRate.toFixed(1).padStart(8)}%`
    );
  });

  // Performance analysis
  console.log("\n=== Performance Analysis ===\n");
  
  // Check against targets
  const targets = {
    "NLP": { p95: 200, target: "200ms" },
    "Pricing": { p95: 50, target: "50ms (cached)" },
    "Cache": { p95: 100, target: "100ms" }
  };

  results.forEach(r => {
    const target = targets[r.service as keyof typeof targets];
    if (target) {
      const status = r.p95Latency <= target.p95 ? "✅ PASS" : "❌ FAIL";
      console.log(`${r.service} - ${r.endpoint}:`);
      console.log(`  Target: P95 < ${target.target}`);
      console.log(`  Actual: P95 = ${r.p95Latency}ms`);
      console.log(`  Status: ${status}`);
      console.log("");
    }
  });

  // Concurrent load test
  console.log("=== Concurrent Load Test ===\n");
  console.log("Testing with 50 concurrent requests...\n");

  const concurrentStart = Date.now();
  const concurrentPromises = [];

  for (let i = 0; i < 50; i++) {
    concurrentPromises.push(
      axios.post(`${NLP_SERVICE}/process`, {
        text: `Query ${i}: Add items to list`
      }).catch(() => null)
    );
  }

  const concurrentResults = await Promise.all(concurrentPromises);
  const concurrentDuration = Date.now() - concurrentStart;
  const concurrentSuccess = concurrentResults.filter(r => r !== null).length;

  console.log(`Total Duration: ${concurrentDuration}ms`);
  console.log(`Successful Requests: ${concurrentSuccess}/50`);
  console.log(`Throughput: ${Math.round((50 / concurrentDuration) * 1000)} req/s`);
  console.log(`Success Rate: ${(concurrentSuccess / 50 * 100).toFixed(1)}%`);

  // Summary
  console.log("\n=== Summary ===\n");
  
  const avgLatencies = results.map(r => r.avgLatency);
  const overallAvg = Math.round(avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length);
  
  console.log(`Overall Average Latency: ${overallAvg}ms`);
  console.log(`Best Performing: ${results.sort((a, b) => a.avgLatency - b.avgLatency)[0].service} - ${results[0].endpoint}`);
  console.log(`Slowest Service: ${results.sort((a, b) => b.avgLatency - a.avgLatency)[0].service} - ${results[results.length - 1].endpoint}`);
  
  const allPassing = results.every(r => {
    const target = targets[r.service as keyof typeof targets];
    return !target || r.p95Latency <= target.p95;
  });
  
  console.log(`\nPerformance Targets: ${allPassing ? "✅ ALL PASSING" : "⚠️ SOME FAILING"}`);
}

runBenchmarks().catch(error => {
  console.error("Benchmark failed:", error);
  process.exit(1);
});