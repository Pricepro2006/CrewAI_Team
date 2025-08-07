#!/usr/bin/env tsx
/**
 * Comprehensive Load Testing Suite for Walmart Grocery Agent Microservices
 * 
 * This suite tests the complete microservices architecture including:
 * - Natural language processing through Ollama
 * - Price comparison across services  
 * - Cache performance under load
 * - WebSocket connection scaling
 * - Database query performance
 * - Circuit breaker behavior
 * - Service resilience and recovery
 */

import * as http from 'http';
import * as https from 'https';
import * as WebSocket from 'ws';
import { performance } from 'perf_hooks';
import { cpus } from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import { EventEmitter } from 'events';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  BASE_URL: process.env.LOAD_TEST_URL || 'http://grocery.local',
  SERVICES: {
    nlp: 'http://localhost:3001',
    pricing: 'http://localhost:3002',
    matching: 'http://localhost:3003',
    cache: 'http://localhost:3004',
    queue: 'http://localhost:3005',
    analytics: 'http://localhost:3006'
  },
  WEBSOCKET_URL: 'ws://grocery.local/ws',
  RESULTS_DIR: path.join(process.cwd(), 'tests/load/results'),
  PROMETHEUS_URL: 'http://localhost:9090',
  GRAFANA_URL: 'http://localhost:3030'
};

// Test scenarios
enum TestScenario {
  BASELINE = 'baseline',
  CONCURRENT_USERS = 'concurrent_users',
  MIXED_WORKLOAD = 'mixed_workload',
  SUSTAINED_LOAD = 'sustained_load',
  SPIKE_TEST = 'spike_test',
  STRESS_TEST = 'stress_test',
  SOAK_TEST = 'soak_test',
  CHAOS_TEST = 'chaos_test'
}

// Metrics collector
class MetricsCollector extends EventEmitter {
  private metrics: Map<string, any[]> = new Map();
  private startTime: number = 0;
  private endTime: number = 0;

  start() {
    this.startTime = performance.now();
    this.metrics.clear();
  }

  stop() {
    this.endTime = performance.now();
  }

  record(metric: string, value: any) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push({
      timestamp: performance.now() - this.startTime,
      value
    });
    this.emit('metric', { metric, value });
  }

  getMetrics() {
    return {
      duration: this.endTime - this.startTime,
      metrics: Object.fromEntries(this.metrics)
    };
  }

  calculatePercentiles(values: number[]): Record<string, number> {
    const sorted = values.sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p90 = sorted[Math.floor(sorted.length * 0.9)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    return { min, avg, p50, p90, p95, p99, max };
  }
}

// HTTP client with timing
class TimedHttpClient {
  async request(options: http.RequestOptions): Promise<{
    statusCode: number;
    body: string;
    timing: {
      dns?: number;
      tcp?: number;
      firstByte: number;
      total: number;
    };
  }> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      let firstByteTime: number;

      const req = http.request(options, (res) => {
        firstByteTime = performance.now() - startTime;
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            body,
            timing: {
              firstByte: firstByteTime,
              total: performance.now() - startTime
            }
          });
        });
      });

      req.on('error', reject);
      
      if (options.method === 'POST' && options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }
}

// WebSocket tester
class WebSocketTester {
  private connections: WebSocket[] = [];

  async testConcurrentConnections(count: number): Promise<{
    successful: number;
    failed: number;
    avgConnectionTime: number;
  }> {
    const results = await Promise.allSettled(
      Array.from({ length: count }, () => this.createConnection())
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const timings = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as any).value);

    return {
      successful,
      failed,
      avgConnectionTime: timings.reduce((a, b) => a + b, 0) / timings.length
    };
  }

  private createConnection(): Promise<number> {
    return new Promise((resolve, reject) => {
      const startTime = performance.now();
      const ws = new WebSocket(CONFIG.WEBSOCKET_URL);

      ws.on('open', () => {
        const connectionTime = performance.now() - startTime;
        this.connections.push(ws);
        resolve(connectionTime);
      });

      ws.on('error', reject);
    });
  }

  cleanup() {
    this.connections.forEach(ws => ws.close());
    this.connections = [];
  }
}

// Load patterns
class LoadPatterns {
  static async constant(rps: number, duration: number, fn: () => Promise<any>) {
    const interval = 1000 / rps;
    const endTime = Date.now() + duration * 1000;
    const results = [];

    while (Date.now() < endTime) {
      const startTime = performance.now();
      results.push(fn());
      
      const elapsed = performance.now() - startTime;
      if (elapsed < interval) {
        await new Promise(resolve => setTimeout(resolve, interval - elapsed));
      }
    }

    return Promise.all(results);
  }

  static async rampUp(startRps: number, endRps: number, duration: number, fn: () => Promise<any>) {
    const steps = 10;
    const stepDuration = duration / steps;
    const rpsIncrement = (endRps - startRps) / steps;
    const results = [];

    for (let i = 0; i < steps; i++) {
      const currentRps = startRps + (rpsIncrement * i);
      results.push(...await this.constant(currentRps, stepDuration, fn));
    }

    return results;
  }

  static async spike(normalRps: number, spikeRps: number, normalDuration: number, spikeDuration: number, fn: () => Promise<any>) {
    const results = [];
    
    // Normal load
    results.push(...await this.constant(normalRps, normalDuration, fn));
    
    // Spike
    results.push(...await this.constant(spikeRps, spikeDuration, fn));
    
    // Back to normal
    results.push(...await this.constant(normalRps, normalDuration, fn));
    
    return results;
  }
}

// Test scenarios implementation
class LoadTestScenarios {
  private client = new TimedHttpClient();
  private metrics = new MetricsCollector();
  private wsTest = new WebSocketTester();

  // 1. Baseline single user test
  async runBaseline(): Promise<any> {
    console.log(chalk.blue('🏃 Running Baseline Test...'));
    this.metrics.start();

    const operations = [
      this.testNLPProcessing('Buy milk, eggs, and bread'),
      this.testPriceComparison(['milk', 'eggs', 'bread']),
      this.testProductMatching('organic whole milk'),
      this.testCachePerformance(),
      this.testDatabaseQuery('SELECT * FROM products LIMIT 10')
    ];

    const results = await Promise.all(operations);
    this.metrics.stop();

    return {
      scenario: TestScenario.BASELINE,
      results,
      metrics: this.metrics.getMetrics()
    };
  }

  // 2. Concurrent users test
  async runConcurrentUsers(userCounts: number[] = [10, 50, 100, 500]): Promise<any> {
    console.log(chalk.blue('👥 Running Concurrent Users Test...'));
    const results = [];

    for (const userCount of userCounts) {
      console.log(chalk.gray(`Testing with ${userCount} concurrent users...`));
      this.metrics.start();

      const userPromises = Array.from({ length: userCount }, (_, i) => 
        this.simulateUser(`user_${i}`)
      );

      const userResults = await Promise.all(userPromises);
      this.metrics.stop();

      results.push({
        userCount,
        results: userResults,
        metrics: this.metrics.getMetrics()
      });
    }

    return {
      scenario: TestScenario.CONCURRENT_USERS,
      results
    };
  }

  // 3. Mixed workload test
  async runMixedWorkload(duration: number = 300): Promise<any> {
    console.log(chalk.blue('🔀 Running Mixed Workload Test...'));
    this.metrics.start();

    const workloadDistribution = {
      read: 0.6,    // 60% read operations
      write: 0.3,   // 30% write operations
      complex: 0.1  // 10% complex operations
    };

    const endTime = Date.now() + duration * 1000;
    const results = [];

    while (Date.now() < endTime) {
      const rand = Math.random();
      
      if (rand < workloadDistribution.read) {
        results.push(this.performReadOperation());
      } else if (rand < workloadDistribution.read + workloadDistribution.write) {
        results.push(this.performWriteOperation());
      } else {
        results.push(this.performComplexOperation());
      }

      await new Promise(resolve => setTimeout(resolve, 100)); // 10 ops/sec
    }

    const allResults = await Promise.all(results);
    this.metrics.stop();

    return {
      scenario: TestScenario.MIXED_WORKLOAD,
      duration,
      distribution: workloadDistribution,
      results: allResults,
      metrics: this.metrics.getMetrics()
    };
  }

  // 4. Sustained load test
  async runSustainedLoad(rps: number, durations: number[]): Promise<any> {
    console.log(chalk.blue('⏱️ Running Sustained Load Test...'));
    const results = [];

    for (const duration of durations) {
      console.log(chalk.gray(`Testing ${rps} RPS for ${duration} minutes...`));
      this.metrics.start();

      const loadResults = await LoadPatterns.constant(
        rps,
        duration * 60,
        () => this.simulateUser('sustained_user')
      );

      this.metrics.stop();

      results.push({
        rps,
        duration,
        results: loadResults,
        metrics: this.metrics.getMetrics()
      });
    }

    return {
      scenario: TestScenario.SUSTAINED_LOAD,
      results
    };
  }

  // 5. Spike test
  async runSpikeTest(): Promise<any> {
    console.log(chalk.blue('📈 Running Spike Test...'));
    this.metrics.start();

    const results = await LoadPatterns.spike(
      10,   // Normal RPS
      100,  // Spike RPS
      60,   // Normal duration (seconds)
      30,   // Spike duration (seconds)
      () => this.simulateUser('spike_user')
    );

    this.metrics.stop();

    return {
      scenario: TestScenario.SPIKE_TEST,
      results,
      metrics: this.metrics.getMetrics()
    };
  }

  // 6. Stress test
  async runStressTest(): Promise<any> {
    console.log(chalk.blue('💪 Running Stress Test...'));
    this.metrics.start();

    const results = await LoadPatterns.rampUp(
      10,   // Start RPS
      500,  // End RPS
      300,  // Duration (5 minutes)
      () => this.simulateUser('stress_user')
    );

    this.metrics.stop();

    // Also test WebSocket limits
    const wsResults = await this.wsTest.testConcurrentConnections(1000);
    this.wsTest.cleanup();

    return {
      scenario: TestScenario.STRESS_TEST,
      httpResults: results,
      wsResults,
      metrics: this.metrics.getMetrics()
    };
  }

  // 7. Soak test (long duration)
  async runSoakTest(hours: number = 1): Promise<any> {
    console.log(chalk.blue(`🛁 Running Soak Test for ${hours} hour(s)...`));
    this.metrics.start();

    const rps = 20; // Moderate load
    const duration = hours * 3600; // Convert to seconds
    
    const results = await LoadPatterns.constant(
      rps,
      duration,
      () => this.simulateUser('soak_user')
    );

    this.metrics.stop();

    return {
      scenario: TestScenario.SOAK_TEST,
      duration: hours,
      rps,
      results,
      metrics: this.metrics.getMetrics()
    };
  }

  // 8. Chaos engineering test
  async runChaosTest(): Promise<any> {
    console.log(chalk.blue('🔥 Running Chaos Engineering Test...'));
    const results = [];

    // Test 1: Kill random service
    console.log(chalk.yellow('Killing random service...'));
    const service = this.getRandomService();
    await this.killService(service);
    results.push(await this.measureRecovery(service));

    // Test 2: Network latency injection
    console.log(chalk.yellow('Injecting network latency...'));
    await this.injectNetworkLatency();
    results.push(await this.measurePerformanceUnderLatency());
    await this.removeNetworkLatency();

    // Test 3: Database connection pool exhaustion
    console.log(chalk.yellow('Exhausting database connections...'));
    results.push(await this.exhaustDatabaseConnections());

    // Test 4: Redis failure
    console.log(chalk.yellow('Simulating Redis failure...'));
    await this.killRedis();
    results.push(await this.measureCacheFailover());
    await this.startRedis();

    // Test 5: Memory pressure
    console.log(chalk.yellow('Creating memory pressure...'));
    results.push(await this.createMemoryPressure());

    return {
      scenario: TestScenario.CHAOS_TEST,
      results
    };
  }

  // Helper methods for operations
  private async testNLPProcessing(input: string): Promise<any> {
    const startTime = performance.now();
    
    try {
      const response = await this.client.request({
        hostname: 'localhost',
        port: 3001,
        path: '/api/nlp/process',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: input })
      });

      const responseTime = performance.now() - startTime;
      this.metrics.record('nlp_response_time', responseTime);
      
      return {
        operation: 'nlp_processing',
        success: response.statusCode === 200,
        responseTime,
        timing: response.timing
      };
    } catch (error) {
      this.metrics.record('nlp_errors', 1);
      return {
        operation: 'nlp_processing',
        success: false,
        error: error.message
      };
    }
  }

  private async testPriceComparison(products: string[]): Promise<any> {
    const startTime = performance.now();
    
    try {
      const response = await this.client.request({
        hostname: 'localhost',
        port: 3002,
        path: '/api/prices/compare',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ products })
      });

      const responseTime = performance.now() - startTime;
      this.metrics.record('price_comparison_time', responseTime);
      
      return {
        operation: 'price_comparison',
        success: response.statusCode === 200,
        responseTime,
        timing: response.timing
      };
    } catch (error) {
      this.metrics.record('price_errors', 1);
      return {
        operation: 'price_comparison',
        success: false,
        error: error.message
      };
    }
  }

  private async testProductMatching(query: string): Promise<any> {
    const startTime = performance.now();
    
    try {
      const response = await this.client.request({
        hostname: 'localhost',
        port: 3003,
        path: '/api/match',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const responseTime = performance.now() - startTime;
      this.metrics.record('matching_time', responseTime);
      
      return {
        operation: 'product_matching',
        success: response.statusCode === 200,
        responseTime,
        timing: response.timing
      };
    } catch (error) {
      this.metrics.record('matching_errors', 1);
      return {
        operation: 'product_matching',
        success: false,
        error: error.message
      };
    }
  }

  private async testCachePerformance(): Promise<any> {
    const startTime = performance.now();
    const key = `test_key_${Date.now()}`;
    
    try {
      // Write to cache
      await this.client.request({
        hostname: 'localhost',
        port: 3004,
        path: '/api/cache/set',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value: 'test_value' })
      });

      // Read from cache
      const response = await this.client.request({
        hostname: 'localhost',
        port: 3004,
        path: `/api/cache/get/${key}`,
        method: 'GET'
      });

      const responseTime = performance.now() - startTime;
      this.metrics.record('cache_operation_time', responseTime);
      
      return {
        operation: 'cache_performance',
        success: response.statusCode === 200,
        responseTime,
        timing: response.timing
      };
    } catch (error) {
      this.metrics.record('cache_errors', 1);
      return {
        operation: 'cache_performance',
        success: false,
        error: error.message
      };
    }
  }

  private async testDatabaseQuery(query: string): Promise<any> {
    const startTime = performance.now();
    
    try {
      const response = await this.client.request({
        hostname: 'localhost',
        port: 3006,
        path: '/api/query',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const responseTime = performance.now() - startTime;
      this.metrics.record('db_query_time', responseTime);
      
      return {
        operation: 'database_query',
        success: response.statusCode === 200,
        responseTime,
        timing: response.timing
      };
    } catch (error) {
      this.metrics.record('db_errors', 1);
      return {
        operation: 'database_query',
        success: false,
        error: error.message
      };
    }
  }

  private async simulateUser(userId: string): Promise<any> {
    const groceryList = this.generateRandomGroceryList();
    const operations = [];

    // User journey
    operations.push(this.testNLPProcessing(groceryList));
    operations.push(this.testPriceComparison(groceryList.split(', ')));
    operations.push(this.testProductMatching(groceryList.split(', ')[0]));
    
    const results = await Promise.all(operations);
    
    return {
      userId,
      operations: results,
      success: results.every(r => r.success),
      totalTime: results.reduce((sum, r) => sum + (r.responseTime || 0), 0)
    };
  }

  private async performReadOperation(): Promise<any> {
    const operations = [
      () => this.testDatabaseQuery('SELECT * FROM products LIMIT 10'),
      () => this.testCachePerformance(),
      () => this.testPriceComparison(['milk'])
    ];

    const operation = operations[Math.floor(Math.random() * operations.length)];
    return operation();
  }

  private async performWriteOperation(): Promise<any> {
    const groceryList = this.generateRandomGroceryList();
    return this.testNLPProcessing(groceryList);
  }

  private async performComplexOperation(): Promise<any> {
    const groceryList = this.generateRandomGroceryList();
    const items = groceryList.split(', ');
    
    const operations = [
      this.testNLPProcessing(groceryList),
      this.testPriceComparison(items),
      ...items.map(item => this.testProductMatching(item))
    ];

    return Promise.all(operations);
  }

  private generateRandomGroceryList(): string {
    const items = [
      'milk', 'eggs', 'bread', 'cheese', 'yogurt',
      'apples', 'bananas', 'oranges', 'grapes', 'strawberries',
      'chicken', 'beef', 'pork', 'fish', 'tofu',
      'rice', 'pasta', 'cereal', 'oatmeal', 'quinoa',
      'tomatoes', 'lettuce', 'onions', 'peppers', 'carrots'
    ];

    const count = Math.floor(Math.random() * 5) + 3;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      const item = items[Math.floor(Math.random() * items.length)];
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }

    return selected.join(', ');
  }

  // Chaos engineering helpers
  private getRandomService(): string {
    const services = Object.keys(CONFIG.SERVICES);
    return services[Math.floor(Math.random() * services.length)];
  }

  private async killService(service: string): Promise<void> {
    await execAsync(`sudo systemctl stop grocery-${service}.service`);
  }

  private async measureRecovery(service: string): Promise<any> {
    const startTime = performance.now();
    let recovered = false;
    let attempts = 0;
    const maxAttempts = 30;

    while (!recovered && attempts < maxAttempts) {
      try {
        const response = await this.client.request({
          hostname: 'localhost',
          port: this.getServicePort(service),
          path: '/health',
          method: 'GET'
        });
        
        if (response.statusCode === 200) {
          recovered = true;
        }
      } catch (error) {
        // Service still down
      }

      if (!recovered) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
    }

    const recoveryTime = performance.now() - startTime;
    
    return {
      service,
      recovered,
      recoveryTime,
      attempts
    };
  }

  private getServicePort(service: string): number {
    const ports = {
      nlp: 3001,
      pricing: 3002,
      matching: 3003,
      cache: 3004,
      queue: 3005,
      analytics: 3006
    };
    return ports[service] || 3000;
  }

  private async injectNetworkLatency(): Promise<void> {
    await execAsync('sudo tc qdisc add dev lo root netem delay 100ms 20ms');
  }

  private async removeNetworkLatency(): Promise<void> {
    await execAsync('sudo tc qdisc del dev lo root netem');
  }

  private async measurePerformanceUnderLatency(): Promise<any> {
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      results.push(await this.simulateUser(`latency_user_${i}`));
    }

    return {
      condition: 'network_latency',
      results
    };
  }

  private async exhaustDatabaseConnections(): Promise<any> {
    const connections = [];
    const startTime = performance.now();
    let exhausted = false;

    try {
      // Try to create many connections
      for (let i = 0; i < 1000; i++) {
        connections.push(this.testDatabaseQuery('SELECT 1'));
      }

      await Promise.all(connections);
    } catch (error) {
      exhausted = true;
    }

    return {
      condition: 'db_pool_exhaustion',
      exhausted,
      connectionsAttempted: connections.length,
      time: performance.now() - startTime
    };
  }

  private async killRedis(): Promise<void> {
    await execAsync('sudo systemctl stop redis');
  }

  private async startRedis(): Promise<void> {
    await execAsync('sudo systemctl start redis');
  }

  private async measureCacheFailover(): Promise<any> {
    const results = [];
    
    // Test operations without cache
    for (let i = 0; i < 10; i++) {
      results.push(await this.testPriceComparison(['milk', 'eggs']));
    }

    return {
      condition: 'cache_unavailable',
      results,
      fallbackSuccess: results.some(r => r.success)
    };
  }

  private async createMemoryPressure(): Promise<any> {
    const startTime = performance.now();
    const arrays = [];
    let oomKilled = false;

    try {
      // Allocate memory until OOM or limit reached
      for (let i = 0; i < 100; i++) {
        arrays.push(new Array(10000000).fill(0));
        
        // Test service responsiveness
        const response = await this.testNLPProcessing('test');
        if (!response.success) {
          break;
        }
      }
    } catch (error) {
      oomKilled = true;
    }

    // Clean up
    arrays.length = 0;

    return {
      condition: 'memory_pressure',
      oomKilled,
      duration: performance.now() - startTime
    };
  }
}

// Results analyzer
class ResultsAnalyzer {
  async analyze(results: any): Promise<void> {
    console.log(chalk.green('\n📊 Load Test Results Analysis\n'));

    // Calculate overall statistics
    const stats = this.calculateStatistics(results);
    
    // Print summary
    this.printSummary(stats);
    
    // Generate detailed report
    await this.generateReport(results, stats);
    
    // Check against SLA thresholds
    this.checkSLAs(stats);
    
    // Provide recommendations
    this.provideRecommendations(stats);
  }

  private calculateStatistics(results: any): any {
    const responseTimes = [];
    const errorRates = [];
    const throughput = [];

    // Extract metrics from different test scenarios
    Object.values(results).forEach((scenario: any) => {
      if (scenario.metrics) {
        // Extract response times
        const times = scenario.metrics.metrics?.nlp_response_time || [];
        responseTimes.push(...times.map(t => t.value));
        
        // Calculate error rate
        const errors = scenario.metrics.metrics?.nlp_errors || [];
        const total = times.length + errors.length;
        if (total > 0) {
          errorRates.push(errors.length / total);
        }
      }
    });

    return {
      responseTimes: this.calculatePercentiles(responseTimes),
      errorRate: errorRates.reduce((a, b) => a + b, 0) / errorRates.length,
      throughput: this.calculateThroughput(results)
    };
  }

  private calculatePercentiles(values: number[]): Record<string, number> {
    if (values.length === 0) return {};
    
    const sorted = values.sort((a, b) => a - b);
    return {
      min: sorted[0],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      max: sorted[sorted.length - 1],
      avg: values.reduce((a, b) => a + b, 0) / values.length
    };
  }

  private calculateThroughput(results: any): number {
    let totalRequests = 0;
    let totalDuration = 0;

    Object.values(results).forEach((scenario: any) => {
      if (scenario.metrics) {
        totalRequests += scenario.results?.length || 0;
        totalDuration += scenario.metrics.duration || 0;
      }
    });

    return totalDuration > 0 ? (totalRequests / totalDuration) * 1000 : 0;
  }

  private printSummary(stats: any): void {
    console.log(chalk.blue('Response Time Statistics:'));
    console.log(`  Min: ${stats.responseTimes.min?.toFixed(2)}ms`);
    console.log(`  P50: ${stats.responseTimes.p50?.toFixed(2)}ms`);
    console.log(`  P90: ${stats.responseTimes.p90?.toFixed(2)}ms`);
    console.log(`  P95: ${stats.responseTimes.p95?.toFixed(2)}ms`);
    console.log(`  P99: ${stats.responseTimes.p99?.toFixed(2)}ms`);
    console.log(`  Max: ${stats.responseTimes.max?.toFixed(2)}ms`);
    console.log(`  Avg: ${stats.responseTimes.avg?.toFixed(2)}ms`);
    
    console.log(chalk.blue('\nThroughput:'));
    console.log(`  ${stats.throughput.toFixed(2)} req/s`);
    
    console.log(chalk.blue('\nError Rate:'));
    console.log(`  ${(stats.errorRate * 100).toFixed(2)}%`);
  }

  private async generateReport(results: any, stats: any): Promise<void> {
    const reportPath = path.join(CONFIG.RESULTS_DIR, `report-${Date.now()}.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      environment: {
        cpus: cpus().length,
        memory: process.memoryUsage(),
        platform: process.platform
      },
      results,
      statistics: stats
    };

    await fs.mkdir(CONFIG.RESULTS_DIR, { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.green(`\n✅ Detailed report saved to: ${reportPath}`));
  }

  private checkSLAs(stats: any): void {
    const slas = {
      responseTimeP95: 500, // 500ms
      errorRate: 0.01,      // 1%
      throughput: 100       // 100 req/s
    };

    console.log(chalk.yellow('\n🎯 SLA Compliance:'));
    
    if (stats.responseTimes.p95 <= slas.responseTimeP95) {
      console.log(chalk.green(`  ✓ Response Time P95: ${stats.responseTimes.p95?.toFixed(2)}ms <= ${slas.responseTimeP95}ms`));
    } else {
      console.log(chalk.red(`  ✗ Response Time P95: ${stats.responseTimes.p95?.toFixed(2)}ms > ${slas.responseTimeP95}ms`));
    }

    if (stats.errorRate <= slas.errorRate) {
      console.log(chalk.green(`  ✓ Error Rate: ${(stats.errorRate * 100).toFixed(2)}% <= ${slas.errorRate * 100}%`));
    } else {
      console.log(chalk.red(`  ✗ Error Rate: ${(stats.errorRate * 100).toFixed(2)}% > ${slas.errorRate * 100}%`));
    }

    if (stats.throughput >= slas.throughput) {
      console.log(chalk.green(`  ✓ Throughput: ${stats.throughput.toFixed(2)} req/s >= ${slas.throughput} req/s`));
    } else {
      console.log(chalk.red(`  ✗ Throughput: ${stats.throughput.toFixed(2)} req/s < ${slas.throughput} req/s`));
    }
  }

  private provideRecommendations(stats: any): void {
    console.log(chalk.magenta('\n💡 Performance Recommendations:\n'));

    const recommendations = [];

    // Response time recommendations
    if (stats.responseTimes.p95 > 500) {
      recommendations.push('- Consider implementing request caching for frequently accessed data');
      recommendations.push('- Optimize database queries with proper indexing');
      recommendations.push('- Review Ollama model loading and inference optimization');
    }

    if (stats.responseTimes.p99 > 1000) {
      recommendations.push('- Investigate timeout configurations and circuit breaker thresholds');
      recommendations.push('- Consider implementing request prioritization');
    }

    // Error rate recommendations
    if (stats.errorRate > 0.01) {
      recommendations.push('- Improve error handling and retry mechanisms');
      recommendations.push('- Implement proper circuit breakers for failing services');
      recommendations.push('- Review service health check configurations');
    }

    // Throughput recommendations
    if (stats.throughput < 100) {
      recommendations.push('- Scale out services horizontally');
      recommendations.push('- Optimize connection pooling configurations');
      recommendations.push('- Consider implementing request batching');
    }

    if (recommendations.length === 0) {
      console.log(chalk.green('✨ System is performing within acceptable parameters!'));
    } else {
      recommendations.forEach(rec => console.log(rec));
    }
  }
}

// Main test runner
class LoadTestRunner {
  private scenarios = new LoadTestScenarios();
  private analyzer = new ResultsAnalyzer();

  async run(testType?: string): Promise<void> {
    console.log(chalk.bold.cyan(`
╔══════════════════════════════════════════════════════════════╗
║     Walmart Grocery Agent - Microservices Load Test Suite    ║
╚══════════════════════════════════════════════════════════════╝
    `));

    const results: any = {};

    try {
      // Check service health first
      await this.checkServicesHealth();

      if (!testType || testType === 'all') {
        // Run all tests
        results.baseline = await this.scenarios.runBaseline();
        results.concurrent = await this.scenarios.runConcurrentUsers();
        results.mixed = await this.scenarios.runMixedWorkload(60);
        results.sustained = await this.scenarios.runSustainedLoad(50, [1, 5]);
        results.spike = await this.scenarios.runSpikeTest();
        results.stress = await this.scenarios.runStressTest();
        
        // Optional long-running tests
        if (process.env.RUN_SOAK_TEST === 'true') {
          results.soak = await this.scenarios.runSoakTest(1);
        }
        
        if (process.env.RUN_CHAOS_TEST === 'true') {
          results.chaos = await this.scenarios.runChaosTest();
        }
      } else {
        // Run specific test
        switch (testType) {
          case 'baseline':
            results.baseline = await this.scenarios.runBaseline();
            break;
          case 'concurrent':
            results.concurrent = await this.scenarios.runConcurrentUsers();
            break;
          case 'mixed':
            results.mixed = await this.scenarios.runMixedWorkload();
            break;
          case 'sustained':
            results.sustained = await this.scenarios.runSustainedLoad(50, [5]);
            break;
          case 'spike':
            results.spike = await this.scenarios.runSpikeTest();
            break;
          case 'stress':
            results.stress = await this.scenarios.runStressTest();
            break;
          case 'soak':
            results.soak = await this.scenarios.runSoakTest(1);
            break;
          case 'chaos':
            results.chaos = await this.scenarios.runChaosTest();
            break;
          default:
            throw new Error(`Unknown test type: ${testType}`);
        }
      }

      // Analyze results
      await this.analyzer.analyze(results);

    } catch (error) {
      console.error(chalk.red('❌ Load test failed:'), error);
      process.exit(1);
    }
  }

  private async checkServicesHealth(): Promise<void> {
    console.log(chalk.blue('🏥 Checking service health...'));
    
    const services = Object.entries(CONFIG.SERVICES);
    const healthChecks = services.map(async ([name, url]) => {
      try {
        const urlObj = new URL(url);
        const response = await new TimedHttpClient().request({
          hostname: urlObj.hostname,
          port: parseInt(urlObj.port),
          path: '/health',
          method: 'GET'
        });
        
        return {
          name,
          healthy: response.statusCode === 200,
          responseTime: response.timing.total
        };
      } catch (error) {
        return {
          name,
          healthy: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(healthChecks);
    
    results.forEach(result => {
      if (result.healthy) {
        console.log(chalk.green(`  ✓ ${result.name}: Healthy (${result.responseTime?.toFixed(2)}ms)`));
      } else {
        console.log(chalk.red(`  ✗ ${result.name}: Unhealthy - ${result.error || 'Service down'}`));
      }
    });

    const unhealthy = results.filter(r => !r.healthy);
    if (unhealthy.length > 0) {
      console.log(chalk.yellow(`\n⚠️ Warning: ${unhealthy.length} service(s) are unhealthy`));
      console.log(chalk.yellow('Continue anyway? Some tests may fail.'));
    }
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const testType = args[0];
  
  const runner = new LoadTestRunner();
  runner.run(testType).catch(console.error);
}

export { LoadTestRunner, LoadTestScenarios, ResultsAnalyzer, MetricsCollector };