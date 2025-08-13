#!/usr/bin/env tsx
/**
 * Comprehensive Performance Benchmark Suite for Walmart Grocery Agent System
 * Analyzes performance after recent fixes: CSRF middleware ordering, ChromaDB resilience, error handling
 */

import axios, { AxiosResponse } from "axios";
import { performance } from "perf_hooks";
import { createWriteStream, existsSync } from "fs";
import { mkdir } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";

// Configuration
const SERVICES = {
  frontend: { url: "http://localhost:5178", name: "Frontend" },
  api: { url: "http://localhost:3000", name: "Main API" },
  nlp: { url: "http://localhost:3008", name: "NLP Service" },
  pricing: { url: "http://localhost:3007", name: "Pricing Service" },
  cache: { url: "http://localhost:3006", name: "Cache Service" },
  websocket: { url: "http://localhost:8080", name: "WebSocket Server" }
};

const BENCHMARK_CONFIG = {
  warmupRequests: 10,
  testRequests: 100,
  concurrentUsers: [1, 5, 10, 25, 50],
  timeout: 10000,
  resultsDir: "benchmark-results"
};

interface BenchmarkResult {
  service: string;
  endpoint: string;
  timestamp: string;
  requests: number;
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p50Latency: number;
  p90Latency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
  throughput: number;
  memoryUsage?: NodeJS.MemoryUsage;
  errors: string[];
}

interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  processes: {
    node: number;
    ollama: number;
  };
}

class PerformanceMonitor {
  private results: BenchmarkResult[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private logStream: any;

  constructor() {
    this.setupResultsDirectory();
  }

  private async setupResultsDirectory() {
    const resultsPath = join(process.cwd(), BENCHMARK_CONFIG.resultsDir);
    if (!existsSync(resultsPath)) {
      await mkdir(resultsPath, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logStream = createWriteStream(join(resultsPath, `benchmark-${timestamp}.log`));
    this.log(`Performance benchmark started at ${new Date().toISOString()}`);
  }

  private log(message: string) {
    const timestamped = `[${new Date().toISOString()}] ${message}`;
    console.log(timestamped);
    if (this.logStream) {
      this.logStream.write(timestamped + '\n');
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  private async getSystemMetrics(): Promise<SystemMetrics> {
    return new Promise((resolve) => {
      const metrics: SystemMetrics = {
        cpu: 0,
        memory: { used: 0, total: 0, percentage: 0 },
        processes: { node: 0, ollama: 0 }
      };

      // Get memory info
      const memInfo = spawn('free', ['-m']);
      let memOutput = '';
      
      memInfo.stdout.on('data', (data) => {
        memOutput += data.toString();
      });

      memInfo.on('close', () => {
        const memLines = memOutput.split('\n');
        if (memLines.length > 1) {
          const memData = memLines[1].split(/\s+/);
          if (memData.length >= 3) {
            metrics.memory.total = parseInt(memData[1]);
            metrics.memory.used = parseInt(memData[2]);
            metrics.memory.percentage = (metrics.memory.used / metrics.memory.total) * 100;
          }
        }

        // Get process counts
        const processCount = spawn('pgrep', ['-c', 'node']);
        processCount.stdout.on('data', (data) => {
          metrics.processes.node = parseInt(data.toString().trim()) || 0;
        });

        const ollamaCount = spawn('pgrep', ['-c', 'ollama']);
        ollamaCount.stdout.on('data', (data) => {
          metrics.processes.ollama = parseInt(data.toString().trim()) || 0;
        });

        setTimeout(() => resolve(metrics), 100);
      });
    });
  }

  private async checkServiceHealth(service: any): Promise<boolean> {
    try {
      const response = await axios.get(`${service.url}/health`, { 
        timeout: 2000,
        validateStatus: () => true
      });
      return response.status < 500;
    } catch (error) {
      // Try alternative endpoints
      const alternatives = [
        `${service.url}/`,
        `${service.url}/status`,
        `${service.url}/api/health`
      ];

      for (const alt of alternatives) {
        try {
          const response = await axios.get(alt, { 
            timeout: 2000,
            validateStatus: () => true
          });
          if (response.status < 500) return true;
        } catch {}
      }
      
      return false;
    }
  }

  private async warmupService(service: any, endpoint: string): Promise<void> {
    this.log(`Warming up ${service.name}...`);
    
    for (let i = 0; i < BENCHMARK_CONFIG.warmupRequests; i++) {
      try {
        await axios.get(`${service.url}${endpoint}`, { 
          timeout: BENCHMARK_CONFIG.timeout,
          validateStatus: () => true
        });
      } catch (error) {
        // Ignore warmup errors
      }
    }
  }

  private async benchmarkEndpoint(
    service: any,
    endpoint: string,
    method: "GET" | "POST" = "GET",
    data?: any,
    requests: number = BENCHMARK_CONFIG.testRequests
  ): Promise<BenchmarkResult> {
    
    this.log(`Benchmarking ${service.name} - ${endpoint} (${requests} requests)...`);
    
    // Warmup
    await this.warmupService(service, endpoint);
    
    const latencies: number[] = [];
    const errors: string[] = [];
    let successes = 0;
    
    const startTime = performance.now();
    const promises: Promise<void>[] = [];

    // Sequential requests for accuracy
    for (let i = 0; i < requests; i++) {
      const requestStart = performance.now();
      
      try {
        let response: AxiosResponse;
        if (method === "GET") {
          response = await axios.get(`${service.url}${endpoint}`, {
            timeout: BENCHMARK_CONFIG.timeout,
            validateStatus: () => true
          });
        } else {
          response = await axios.post(`${service.url}${endpoint}`, data, {
            timeout: BENCHMARK_CONFIG.timeout,
            validateStatus: () => true
          });
        }
        
        const requestEnd = performance.now();
        const latency = requestEnd - requestStart;
        latencies.push(latency);
        
        if (response.status < 400) {
          successes++;
        } else {
          errors.push(`HTTP ${response.status}: ${response.statusText}`);
        }
        
      } catch (error: any) {
        const requestEnd = performance.now();
        latencies.push(requestEnd - requestStart);
        errors.push(error.message || 'Unknown error');
      }
      
      // Progress indicator
      if ((i + 1) % Math.max(1, Math.floor(requests / 10)) === 0) {
        process.stdout.write(`  Progress: ${i + 1}/${requests}\r`);
      }
    }
    
    const totalTime = performance.now() - startTime;
    console.log(''); // New line after progress
    
    // Calculate statistics
    latencies.sort((a, b) => a - b);
    
    const result: BenchmarkResult = {
      service: service.name,
      endpoint,
      timestamp: new Date().toISOString(),
      requests,
      avgLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      minLatency: latencies[0] || 0,
      maxLatency: latencies[latencies.length - 1] || 0,
      p50Latency: this.calculatePercentile(latencies, 50),
      p90Latency: this.calculatePercentile(latencies, 90),
      p95Latency: this.calculatePercentile(latencies, 95),
      p99Latency: this.calculatePercentile(latencies, 99),
      successRate: (successes / requests) * 100,
      throughput: (successes / totalTime) * 1000,
      memoryUsage: process.memoryUsage(),
      errors: [...new Set(errors)].slice(0, 5) // Unique errors, max 5
    };
    
    this.results.push(result);
    return result;
  }

  private async concurrentLoadTest(service: any, endpoint: string, concurrentUsers: number): Promise<BenchmarkResult> {
    this.log(`Load testing ${service.name} with ${concurrentUsers} concurrent users...`);
    
    const startTime = performance.now();
    const promises: Promise<{ latency: number, success: boolean, error?: string }>[] = [];
    
    for (let i = 0; i < concurrentUsers; i++) {
      promises.push(
        (async () => {
          const requestStart = performance.now();
          try {
            const response = await axios.get(`${service.url}${endpoint}`, {
              timeout: BENCHMARK_CONFIG.timeout,
              validateStatus: () => true
            });
            const requestEnd = performance.now();
            return {
              latency: requestEnd - requestStart,
              success: response.status < 400
            };
          } catch (error: any) {
            const requestEnd = performance.now();
            return {
              latency: requestEnd - requestStart,
              success: false,
              error: error.message
            };
          }
        })()
      );
    }
    
    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;
    
    const latencies = results.map(r => r.latency);
    const successes = results.filter(r => r.success).length;
    const errors = results.filter(r => r.error).map(r => r.error!);
    
    latencies.sort((a, b) => a - b);
    
    return {
      service: service.name,
      endpoint: `${endpoint} (${concurrentUsers} concurrent)`,
      timestamp: new Date().toISOString(),
      requests: concurrentUsers,
      avgLatency: latencies.reduce((sum, l) => sum + l, 0) / latencies.length,
      minLatency: latencies[0],
      maxLatency: latencies[latencies.length - 1],
      p50Latency: this.calculatePercentile(latencies, 50),
      p90Latency: this.calculatePercentile(latencies, 90),
      p95Latency: this.calculatePercentile(latencies, 95),
      p99Latency: this.calculatePercentile(latencies, 99),
      successRate: (successes / concurrentUsers) * 100,
      throughput: (successes / totalTime) * 1000,
      errors: [...new Set(errors)].slice(0, 5)
    };
  }

  private displayResults() {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE BENCHMARK RESULTS');
    console.log('='.repeat(80));
    
    // Group results by service
    const serviceResults = this.results.reduce((acc, result) => {
      if (!acc[result.service]) acc[result.service] = [];
      acc[result.service].push(result);
      return acc;
    }, {} as Record<string, BenchmarkResult[]>);
    
    for (const [serviceName, results] of Object.entries(serviceResults)) {
      console.log(`\n📊 ${serviceName.toUpperCase()}`);
      console.log('-'.repeat(50));
      
      results.forEach(result => {
        console.log(`\n🔹 ${result.endpoint}`);
        console.log(`   Avg Latency: ${result.avgLatency.toFixed(2)}ms`);
        console.log(`   P95 Latency: ${result.p95Latency.toFixed(2)}ms`);
        console.log(`   P99 Latency: ${result.p99Latency.toFixed(2)}ms`);
        console.log(`   Success Rate: ${result.successRate.toFixed(1)}%`);
        console.log(`   Throughput: ${result.throughput.toFixed(2)} req/s`);
        
        if (result.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${result.errors.join(', ')}`);
        }
      });
    }
    
    // Performance analysis
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE ANALYSIS');
    console.log('='.repeat(80));
    
    const performanceTargets = {
      'Frontend': { p95: 100, description: 'Static content delivery' },
      'Main API': { p95: 200, description: 'Database queries + business logic' },
      'NLP Service': { p95: 500, description: 'AI model inference' },
      'Pricing Service': { p95: 50, description: 'Simple calculations (cached)' },
      'Cache Service': { p95: 20, description: 'In-memory operations' },
      'WebSocket Server': { p95: 50, description: 'Real-time messaging' }
    };
    
    for (const [serviceName, target] of Object.entries(performanceTargets)) {
      const serviceResults = this.results.filter(r => r.service === serviceName);
      if (serviceResults.length === 0) {
        console.log(`\n❌ ${serviceName}: NO DATA (Service not running)`);
        continue;
      }
      
      const avgP95 = serviceResults.reduce((sum, r) => sum + r.p95Latency, 0) / serviceResults.length;
      const avgSuccessRate = serviceResults.reduce((sum, r) => sum + r.successRate, 0) / serviceResults.length;
      
      const latencyStatus = avgP95 <= target.p95 ? '✅' : '❌';
      const reliabilityStatus = avgSuccessRate >= 99 ? '✅' : avgSuccessRate >= 95 ? '⚠️' : '❌';
      
      console.log(`\n${latencyStatus} ${serviceName}`);
      console.log(`   Target: P95 < ${target.p95}ms (${target.description})`);
      console.log(`   Actual: P95 = ${avgP95.toFixed(2)}ms`);
      console.log(`   Reliability: ${avgSuccessRate.toFixed(1)}% ${reliabilityStatus}`);
    }
    
    // System recommendations
    console.log('\n' + '='.repeat(80));
    console.log('OPTIMIZATION RECOMMENDATIONS');
    console.log('='.repeat(80));
    
    const recommendations = [];
    
    // Check for high latency services
    for (const result of this.results) {
      const target = performanceTargets[result.service as keyof typeof performanceTargets];
      if (target && result.p95Latency > target.p95 * 1.5) {
        recommendations.push({
          priority: 'HIGH',
          service: result.service,
          issue: `P95 latency (${result.p95Latency.toFixed(2)}ms) exceeds target by 50%`,
          recommendation: this.getOptimizationRecommendation(result.service, 'latency')
        });
      }
      
      if (result.successRate < 95) {
        recommendations.push({
          priority: 'CRITICAL',
          service: result.service,
          issue: `Low success rate: ${result.successRate.toFixed(1)}%`,
          recommendation: this.getOptimizationRecommendation(result.service, 'reliability')
        });
      }
    }
    
    // Display recommendations by priority
    const priorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    for (const priority of priorities) {
      const priorityRecs = recommendations.filter(r => r.priority === priority);
      if (priorityRecs.length === 0) continue;
      
      console.log(`\n🔴 ${priority} PRIORITY:`);
      priorityRecs.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.service}: ${rec.issue}`);
        console.log(`   💡 Recommendation: ${rec.recommendation}`);
      });
    }
    
    if (recommendations.length === 0) {
      console.log('\n✅ All services are performing within acceptable ranges!');
    }
    
    // Memory analysis
    const memoryResults = this.results.filter(r => r.memoryUsage);
    if (memoryResults.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('MEMORY USAGE ANALYSIS');
      console.log('='.repeat(80));
      
      const avgMemory = memoryResults.reduce((sum, r) => sum + (r.memoryUsage?.heapUsed || 0), 0) / memoryResults.length;
      const maxMemory = Math.max(...memoryResults.map(r => r.memoryUsage?.heapUsed || 0));
      
      console.log(`\nAverage Heap Usage: ${(avgMemory / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Peak Heap Usage: ${(maxMemory / 1024 / 1024).toFixed(2)} MB`);
      
      if (maxMemory > 1024 * 1024 * 1024) { // > 1GB
        console.log('⚠️  High memory usage detected - consider memory optimization');
      }
    }
  }
  
  private getOptimizationRecommendation(service: string, issue: 'latency' | 'reliability'): string {
    const recommendations = {
      'Frontend': {
        latency: 'Enable compression, optimize bundle size, implement CDN caching',
        reliability: 'Add health checks, implement proper error boundaries, configure retry logic'
      },
      'Main API': {
        latency: 'Optimize database queries, add query caching, implement connection pooling',
        reliability: 'Add circuit breakers, improve error handling, implement graceful degradation'
      },
      'NLP Service': {
        latency: 'Implement model caching, optimize batch processing, consider GPU acceleration',
        reliability: 'Add model fallbacks, implement timeout handling, add health monitoring'
      },
      'Pricing Service': {
        latency: 'Implement aggressive caching, optimize calculation algorithms, add pre-computation',
        reliability: 'Add input validation, implement error recovery, add monitoring alerts'
      },
      'Cache Service': {
        latency: 'Optimize cache algorithms, implement connection pooling, tune memory allocation',
        reliability: 'Add cache warmup, implement fallback strategies, add monitoring'
      },
      'WebSocket Server': {
        latency: 'Optimize message serialization, implement connection pooling, tune buffer sizes',
        reliability: 'Add connection resilience, implement reconnection logic, add heartbeat monitoring'
      }
    };
    
    return recommendations[service as keyof typeof recommendations]?.[issue] || 
           'Review logs for specific issues and implement standard optimization practices';
  }

  private async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsPath = join(process.cwd(), BENCHMARK_CONFIG.resultsDir, `results-${timestamp}.json`);
    
    const reportData = {
      timestamp: new Date().toISOString(),
      config: BENCHMARK_CONFIG,
      systemMetrics: this.systemMetrics,
      results: this.results,
      summary: {
        totalTests: this.results.length,
        servicesActive: [...new Set(this.results.map(r => r.service))].length,
        avgLatency: this.results.reduce((sum, r) => sum + r.avgLatency, 0) / this.results.length,
        avgSuccessRate: this.results.reduce((sum, r) => sum + r.successRate, 0) / this.results.length
      }
    };
    
    await require('fs/promises').writeFile(resultsPath, JSON.stringify(reportData, null, 2));
    this.log(`Results saved to: ${resultsPath}`);
  }

  public async runBenchmarks() {
    this.log('🚀 Starting comprehensive performance benchmark...');
    
    // 1. Check service health
    this.log('\n🔍 Checking service health...');
    const healthResults = {};
    for (const [key, service] of Object.entries(SERVICES)) {
      const isHealthy = await this.checkServiceHealth(service);
      healthResults[key] = isHealthy;
      this.log(`${isHealthy ? '✅' : '❌'} ${service.name}: ${isHealthy ? 'HEALTHY' : 'UNAVAILABLE'}`);
    }
    
    // 2. Collect initial system metrics
    this.systemMetrics.push(await this.getSystemMetrics());
    
    // 3. Frontend performance tests (if running)
    if (healthResults['frontend']) {
      await this.benchmarkEndpoint(SERVICES.frontend, '/');
      await this.benchmarkEndpoint(SERVICES.frontend, '/walmart');
      await this.benchmarkEndpoint(SERVICES.frontend, '/static/js/main.js');
    }
    
    // 4. API performance tests (if running)
    if (healthResults['api']) {
      await this.benchmarkEndpoint(SERVICES.api, '/health');
      await this.benchmarkEndpoint(SERVICES.api, '/api/trpc/health');
      await this.benchmarkEndpoint(SERVICES.api, '/api/grocery/status', 'POST', { test: true });
    }
    
    // 5. NLP service tests (if running)
    if (healthResults['nlp']) {
      await this.benchmarkEndpoint(SERVICES.nlp, '/health');
      await this.benchmarkEndpoint(SERVICES.nlp, '/process', 'POST', { 
        text: 'Add 2 gallons of milk to my shopping list' 
      });
    }
    
    // 6. Microservice tests (if running)
    if (healthResults['pricing']) {
      await this.benchmarkEndpoint(SERVICES.pricing, '/health');
      await this.benchmarkEndpoint(SERVICES.pricing, '/calculate', 'POST', { 
        productId: 'prod_001', 
        quantity: 2 
      });
    }
    
    if (healthResults['cache']) {
      await this.benchmarkEndpoint(SERVICES.cache, '/status');
    }
    
    // 7. Concurrent load tests for healthy services
    this.log('\n🔄 Running concurrent load tests...');
    for (const users of BENCHMARK_CONFIG.concurrentUsers) {
      if (healthResults['api']) {
        const loadResult = await this.concurrentLoadTest(SERVICES.api, '/health', users);
        this.results.push(loadResult);
      }
      
      if (healthResults['nlp']) {
        const nlpLoadResult = await this.concurrentLoadTest(SERVICES.nlp, '/health', Math.min(users, 10)); // Limit NLP concurrency
        this.results.push(nlpLoadResult);
      }
    }
    
    // 8. Final system metrics
    this.systemMetrics.push(await this.getSystemMetrics());
    
    // 9. Display and save results
    this.displayResults();
    await this.saveResults();
    
    this.log('\n✅ Performance benchmark completed!');
    
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// Main execution
async function main() {
  const monitor = new PerformanceMonitor();
  
  try {
    await monitor.runBenchmarks();
  } catch (error) {
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Benchmark interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Benchmark terminated');
  process.exit(0);
});

// Run if this is the main module
const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main();
}

export { PerformanceMonitor, BenchmarkResult, SystemMetrics };