#!/usr/bin/env node

/**
 * CrewAI Team Performance Analysis Suite
 * Comprehensive performance testing across all layers
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import os from 'os';
import v8 from 'v8';
import { Worker } from 'worker_threads';
import WebSocket from 'ws';

const BASE_URL = 'http://localhost:3005';
const WS_URL = 'ws://localhost:8080';

// Performance Metrics Collection
class PerformanceAnalyzer {
  constructor() {
    this.metrics = {
      api: {
        latency: [],
        throughput: [],
        errors: [],
        responseTime: []
      },
      database: {
        queryTime: [],
        connectionPool: [],
        cacheHitRate: 0
      },
      memory: {
        heapUsed: [],
        heapTotal: [],
        external: [],
        rss: []
      },
      websocket: {
        connectionTime: [],
        messageLatency: [],
        reconnects: 0
      },
      llm: {
        inferenceTime: [],
        tokenThroughput: [],
        contextWindowUsage: []
      }
    };
    
    this.severityLevels = {
      CRITICAL: [],
      HIGH: [],
      MEDIUM: [],
      LOW: [],
      INFO: []
    };
  }

  // 1. API Layer Performance Testing
  async testAPIPerformance() {
    console.log('\n📊 Testing API Layer Performance...\n');
    
    const endpoints = [
      { path: '/health', method: 'GET' },
      { path: '/trpc/agent.list', method: 'GET' },
      { path: '/trpc/rag.search', method: 'POST', body: { query: 'test' } },
      { path: '/api/emails', method: 'GET' },
      { path: '/api/metrics', method: 'GET' }
    ];

    for (const endpoint of endpoints) {
      const results = await this.measureEndpoint(endpoint);
      this.analyzeAPIResults(endpoint.path, results);
    }
  }

  async measureEndpoint(endpoint, iterations = 100) {
    const measurements = [];
    let errors = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      try {
        const response = await axios({
          method: endpoint.method,
          url: `${BASE_URL}${endpoint.path}`,
          data: endpoint.body,
          timeout: 5000
        });
        const end = performance.now();
        measurements.push(end - start);
      } catch (error) {
        errors++;
        if (i === 0) {
          console.error(`❌ Error testing ${endpoint.path}:`, error.message);
        }
      }
    }

    return {
      measurements,
      errors,
      errorRate: (errors / iterations) * 100
    };
  }

  analyzeAPIResults(endpoint, results) {
    const { measurements, errorRate } = results;
    
    if (measurements.length === 0) {
      this.addFinding('CRITICAL', `${endpoint}: Endpoint completely unavailable (100% error rate)`);
      return;
    }

    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    const p95 = this.percentile(measurements, 95);
    const p99 = this.percentile(measurements, 99);

    console.log(`📍 ${endpoint}:`);
    console.log(`   Average: ${avg.toFixed(2)}ms`);
    console.log(`   P95: ${p95.toFixed(2)}ms`);
    console.log(`   P99: ${p99.toFixed(2)}ms`);
    console.log(`   Error Rate: ${errorRate.toFixed(1)}%`);

    // Severity Assessment
    if (avg > 1000) {
      this.addFinding('CRITICAL', `${endpoint}: Average response time ${avg.toFixed(0)}ms exceeds 1000ms threshold`);
    } else if (avg > 500) {
      this.addFinding('HIGH', `${endpoint}: Average response time ${avg.toFixed(0)}ms exceeds 500ms threshold`);
    } else if (avg > 200) {
      this.addFinding('MEDIUM', `${endpoint}: Average response time ${avg.toFixed(0)}ms exceeds 200ms threshold`);
    }

    if (p99 > 2000) {
      this.addFinding('HIGH', `${endpoint}: P99 latency ${p99.toFixed(0)}ms indicates performance instability`);
    }

    if (errorRate > 10) {
      this.addFinding('CRITICAL', `${endpoint}: Error rate ${errorRate.toFixed(1)}% exceeds reliability threshold`);
    } else if (errorRate > 5) {
      this.addFinding('HIGH', `${endpoint}: Error rate ${errorRate.toFixed(1)}% indicates reliability issues`);
    }

    this.metrics.api.latency.push({ endpoint, avg, p95, p99 });
    this.metrics.api.responseTime.push(...measurements);
  }

  // 2. Database Performance Testing
  async testDatabasePerformance() {
    console.log('\n💾 Testing Database Performance...\n');

    try {
      const response = await axios.get(`${BASE_URL}/api/database-performance`);
      const dbMetrics = response.data;

      console.log('Database Metrics:');
      console.log(`   Connection Pool Size: ${dbMetrics.connectionPool?.size || 'N/A'}`);
      console.log(`   Active Connections: ${dbMetrics.connectionPool?.active || 'N/A'}`);
      console.log(`   Cache Hit Rate: ${dbMetrics.cacheHitRate || 'N/A'}%`);
      console.log(`   Average Query Time: ${dbMetrics.averageQueryTime || 'N/A'}ms`);

      // Assess database performance
      if (dbMetrics.averageQueryTime > 100) {
        this.addFinding('HIGH', `Database average query time ${dbMetrics.averageQueryTime}ms exceeds 100ms threshold`);
      }

      if (dbMetrics.cacheHitRate < 80) {
        this.addFinding('MEDIUM', `Cache hit rate ${dbMetrics.cacheHitRate}% below optimal 80% threshold`);
      }

      this.metrics.database = { ...this.metrics.database, ...dbMetrics };
    } catch (error) {
      this.addFinding('CRITICAL', 'Database performance metrics unavailable');
    }
  }

  // 3. Memory Usage Analysis
  async testMemoryUsage() {
    console.log('\n🧠 Testing Memory Usage...\n');

    const memUsage = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();
    const systemMem = os.totalmem();
    const freeMem = os.freemem();

    console.log('Memory Statistics:');
    console.log(`   Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   System Free: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB / ${(systemMem / 1024 / 1024 / 1024).toFixed(2)} GB`);

    // Memory leak detection
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsedMB > 1024) {
      this.addFinding('HIGH', `Heap memory usage ${heapUsedMB.toFixed(0)}MB exceeds 1GB threshold`);
    }

    if (heapUsagePercent > 90) {
      this.addFinding('CRITICAL', `Heap usage at ${heapUsagePercent.toFixed(1)}% - potential memory leak`);
    }

    const systemMemUsagePercent = ((systemMem - freeMem) / systemMem) * 100;
    if (systemMemUsagePercent > 90) {
      this.addFinding('HIGH', `System memory usage at ${systemMemUsagePercent.toFixed(1)}%`);
    }

    this.metrics.memory = {
      heapUsed: heapUsedMB,
      heapTotal: heapTotalMB,
      rss: memUsage.rss / 1024 / 1024,
      external: memUsage.external / 1024 / 1024,
      systemUsage: systemMemUsagePercent
    };
  }

  // 4. WebSocket Performance Testing
  async testWebSocketPerformance() {
    console.log('\n🔌 Testing WebSocket Performance...\n');

    return new Promise((resolve) => {
      const startTime = performance.now();
      const ws = new WebSocket(WS_URL);
      let messageCount = 0;
      const latencies = [];

      ws.on('open', () => {
        const connectionTime = performance.now() - startTime;
        console.log(`   Connection Time: ${connectionTime.toFixed(2)}ms`);
        
        if (connectionTime > 1000) {
          this.addFinding('HIGH', `WebSocket connection time ${connectionTime.toFixed(0)}ms exceeds 1000ms`);
        }

        // Test message latency
        const testMessage = JSON.stringify({
          type: 'ping',
          timestamp: Date.now()
        });

        const interval = setInterval(() => {
          if (messageCount >= 10) {
            clearInterval(interval);
            ws.close();
            return;
          }
          const sendTime = performance.now();
          ws.send(testMessage);
          messageCount++;
        }, 100);
      });

      ws.on('message', (data) => {
        const receiveTime = performance.now();
        try {
          const message = JSON.parse(data);
          if (message.type === 'pong') {
            const latency = receiveTime - message.timestamp;
            latencies.push(latency);
          }
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.on('error', (error) => {
        this.addFinding('CRITICAL', `WebSocket error: ${error.message}`);
        resolve();
      });

      ws.on('close', () => {
        if (latencies.length > 0) {
          const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
          console.log(`   Average Message Latency: ${avgLatency.toFixed(2)}ms`);
          
          if (avgLatency > 100) {
            this.addFinding('MEDIUM', `WebSocket message latency ${avgLatency.toFixed(0)}ms exceeds 100ms`);
          }
        }
        resolve();
      });

      setTimeout(() => {
        ws.close();
        resolve();
      }, 5000);
    });
  }

  // 5. Load Testing
  async runLoadTest() {
    console.log('\n🔥 Running Load Test...\n');

    const concurrentUsers = [1, 10, 50, 100];
    const requestsPerUser = 10;

    for (const users of concurrentUsers) {
      console.log(`\nTesting with ${users} concurrent users:`);
      const start = performance.now();
      
      const promises = [];
      for (let i = 0; i < users; i++) {
        for (let j = 0; j < requestsPerUser; j++) {
          promises.push(
            axios.get(`${BASE_URL}/health`, { timeout: 5000 })
              .catch(e => ({ error: true }))
          );
        }
      }

      const results = await Promise.all(promises);
      const end = performance.now();
      
      const errors = results.filter(r => r.error).length;
      const totalRequests = users * requestsPerUser;
      const duration = (end - start) / 1000;
      const throughput = totalRequests / duration;
      const errorRate = (errors / totalRequests) * 100;

      console.log(`   Total Requests: ${totalRequests}`);
      console.log(`   Duration: ${duration.toFixed(2)}s`);
      console.log(`   Throughput: ${throughput.toFixed(2)} req/s`);
      console.log(`   Error Rate: ${errorRate.toFixed(1)}%`);

      // Assess load test results
      if (users === 100) {
        if (throughput < 100) {
          this.addFinding('HIGH', `Throughput ${throughput.toFixed(0)} req/s below 100 req/s target at 100 users`);
        }
        if (errorRate > 5) {
          this.addFinding('CRITICAL', `Error rate ${errorRate.toFixed(1)}% at 100 concurrent users indicates scalability issues`);
        }
      }
    }
  }

  // 6. Cache Effectiveness Testing
  async testCacheEffectiveness() {
    console.log('\n💰 Testing Cache Effectiveness...\n');

    // Test cache hit rates for common queries
    const testQueries = [
      'What are the recent orders?',
      'Show me the latest email analysis',
      'Get agent status'
    ];

    for (const query of testQueries) {
      // First request (cache miss)
      const firstStart = performance.now();
      await axios.post(`${BASE_URL}/trpc/rag.search`, 
        { query }, 
        { timeout: 5000 }
      ).catch(() => {});
      const firstTime = performance.now() - firstStart;

      // Second request (should be cached)
      const secondStart = performance.now();
      await axios.post(`${BASE_URL}/trpc/rag.search`, 
        { query }, 
        { timeout: 5000 }
      ).catch(() => {});
      const secondTime = performance.now() - secondStart;

      const improvement = ((firstTime - secondTime) / firstTime) * 100;
      console.log(`   Query: "${query.substring(0, 30)}..."`);
      console.log(`   First: ${firstTime.toFixed(2)}ms, Cached: ${secondTime.toFixed(2)}ms`);
      console.log(`   Cache Improvement: ${improvement.toFixed(1)}%`);

      if (improvement < 50 && secondTime > 100) {
        this.addFinding('MEDIUM', `Cache ineffective for query "${query.substring(0, 30)}..." - only ${improvement.toFixed(0)}% improvement`);
      }
    }
  }

  // Utility Functions
  percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  addFinding(severity, message) {
    this.severityLevels[severity].push(message);
  }

  // Generate Final Report
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 PERFORMANCE ANALYSIS REPORT - CrewAI Team');
    console.log('='.repeat(80));
    
    console.log('\n🎯 PRODUCTION READINESS ASSESSMENT\n');
    
    const criticalCount = this.severityLevels.CRITICAL.length;
    const highCount = this.severityLevels.HIGH.length;
    const mediumCount = this.severityLevels.MEDIUM.length;
    
    let readinessScore = 100;
    readinessScore -= criticalCount * 20;
    readinessScore -= highCount * 10;
    readinessScore -= mediumCount * 5;
    readinessScore = Math.max(0, readinessScore);

    console.log(`Production Readiness Score: ${readinessScore}/100`);
    
    if (readinessScore >= 90) {
      console.log('✅ Status: PRODUCTION READY');
    } else if (readinessScore >= 70) {
      console.log('⚠️  Status: NEEDS OPTIMIZATION');
    } else if (readinessScore >= 50) {
      console.log('⚠️  Status: SIGNIFICANT ISSUES');
    } else {
      console.log('❌ Status: NOT PRODUCTION READY');
    }

    console.log('\n📋 FINDINGS BY SEVERITY:\n');

    if (this.severityLevels.CRITICAL.length > 0) {
      console.log('🔴 CRITICAL Issues (Must Fix):');
      this.severityLevels.CRITICAL.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    if (this.severityLevels.HIGH.length > 0) {
      console.log('\n🟠 HIGH Priority Issues:');
      this.severityLevels.HIGH.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    if (this.severityLevels.MEDIUM.length > 0) {
      console.log('\n🟡 MEDIUM Priority Issues:');
      this.severityLevels.MEDIUM.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    if (this.severityLevels.LOW.length > 0) {
      console.log('\n🟢 LOW Priority Issues:');
      this.severityLevels.LOW.forEach(finding => {
        console.log(`   • ${finding}`);
      });
    }

    console.log('\n📈 PERFORMANCE METRICS SUMMARY:\n');
    
    // API Metrics
    if (this.metrics.api.latency.length > 0) {
      console.log('API Performance:');
      this.metrics.api.latency.forEach(metric => {
        console.log(`   ${metric.endpoint}: Avg ${metric.avg.toFixed(0)}ms, P95 ${metric.p95.toFixed(0)}ms`);
      });
    }

    // Memory Metrics
    if (this.metrics.memory.heapUsed) {
      console.log('\nMemory Usage:');
      console.log(`   Heap: ${this.metrics.memory.heapUsed.toFixed(0)}MB / ${this.metrics.memory.heapTotal.toFixed(0)}MB`);
      console.log(`   System: ${this.metrics.memory.systemUsage.toFixed(1)}% utilized`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`Report generated at: ${new Date().toISOString()}`);
    console.log('='.repeat(80) + '\n');

    return {
      readinessScore,
      findings: this.severityLevels,
      metrics: this.metrics
    };
  }

  // Main execution
  async run() {
    console.log('Starting CrewAI Team Performance Analysis...');
    console.log('Target: ' + BASE_URL);
    console.log('Time: ' + new Date().toISOString());
    
    try {
      // Check if server is running
      try {
        await axios.get(`${BASE_URL}/health`, { timeout: 2000 });
      } catch (error) {
        console.error('\n❌ Server is not responding at ' + BASE_URL);
        console.error('Please ensure the server is running: npm run dev\n');
        process.exit(1);
      }

      await this.testMemoryUsage();
      await this.testAPIPerformance();
      await this.testDatabasePerformance();
      await this.testWebSocketPerformance();
      await this.testCacheEffectiveness();
      await this.runLoadTest();
      
      const report = this.generateReport();
      
      // Exit with appropriate code
      process.exit(report.readinessScore >= 70 ? 0 : 1);
      
    } catch (error) {
      console.error('Fatal error during performance analysis:', error);
      process.exit(1);
    }
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const analyzer = new PerformanceAnalyzer();
  analyzer.run();
}

export default PerformanceAnalyzer;