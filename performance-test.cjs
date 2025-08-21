#!/usr/bin/env node

/**
 * Performance Testing Suite for CrewAI Team
 * 
 * Tests:
 * 1. Agent response times
 * 2. Concurrent request handling
 * 3. Memory usage patterns
 * 4. Database query performance
 * 5. WebSocket latency
 */

const axios = require('axios');
const WebSocket = require('ws');
const { performance } = require('perf_hooks');

const BASE_URL = 'http://localhost:3001';
const WS_URL = 'ws://localhost:3001/ws';

// Performance metrics collector
class PerformanceCollector {
  constructor() {
    this.metrics = {
      responseTime: [],
      memoryUsage: [],
      errorRate: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      throughput: 0
    };
  }

  recordResponse(duration, success = true) {
    this.metrics.totalRequests++;
    this.metrics.responseTime.push(duration);
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    this.metrics.maxResponseTime = Math.max(this.metrics.maxResponseTime, duration);
    this.metrics.minResponseTime = Math.min(this.metrics.minResponseTime, duration);
  }

  calculateStats() {
    const sorted = [...this.metrics.responseTime].sort((a, b) => a - b);
    const len = sorted.length;
    
    if (len > 0) {
      this.metrics.avgResponseTime = sorted.reduce((a, b) => a + b, 0) / len;
      this.metrics.p95ResponseTime = sorted[Math.floor(len * 0.95)];
      this.metrics.p99ResponseTime = sorted[Math.floor(len * 0.99)];
      this.metrics.errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
    }
    
    return this.metrics;
  }
}

// Test 1: Simple Agent Query Performance
async function testAgentResponseTime() {
  console.log('\n📊 Test 1: Agent Response Time (Target: <2s)');
  console.log('=' .repeat(50));
  
  const collector = new PerformanceCollector();
  const queries = [
    "What are the recent email trends?",
    "Analyze customer feedback from last week",
    "Generate a summary of project updates",
    "Find all high-priority tasks",
    "Search for security vulnerabilities"
  ];
  
  for (const query of queries) {
    const start = performance.now();
    try {
      const response = await axios.post(`${BASE_URL}/trpc/chat.sendMessage`, {
        json: {
          conversationId: 'test-' + Date.now(),
          message: query
        }
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const duration = performance.now() - start;
      collector.recordResponse(duration, true);
      console.log(`✅ Query: "${query.substring(0, 30)}..." - ${duration.toFixed(2)}ms`);
    } catch (error) {
      const duration = performance.now() - start;
      collector.recordResponse(duration, false);
      console.log(`❌ Query failed: ${error.message} - ${duration.toFixed(2)}ms`);
    }
  }
  
  const stats = collector.calculateStats();
  console.log('\n📈 Results:');
  console.log(`  Average: ${stats.avgResponseTime.toFixed(2)}ms`);
  console.log(`  P95: ${stats.p95ResponseTime.toFixed(2)}ms`);
  console.log(`  P99: ${stats.p99ResponseTime.toFixed(2)}ms`);
  console.log(`  Min/Max: ${stats.minResponseTime.toFixed(2)}ms / ${stats.maxResponseTime.toFixed(2)}ms`);
  console.log(`  Success Rate: ${((stats.successfulRequests / stats.totalRequests) * 100).toFixed(1)}%`);
  
  return stats;
}

// Test 2: Concurrent Request Handling
async function testConcurrentRequests() {
  console.log('\n📊 Test 2: Concurrent Request Handling');
  console.log('=' .repeat(50));
  
  const collector = new PerformanceCollector();
  const concurrencyLevels = [5, 10, 20];
  
  for (const concurrency of concurrencyLevels) {
    console.log(`\n🔄 Testing with ${concurrency} concurrent requests...`);
    
    const promises = [];
    const startTime = performance.now();
    
    for (let i = 0; i < concurrency; i++) {
      promises.push(
        axios.post(`${BASE_URL}/trpc/chat.sendMessage`, {
          json: {
            conversationId: `concurrent-${i}`,
            message: `Test query ${i}`
          }
        }, {
          timeout: 30000,
          headers: { 'Content-Type': 'application/json' }
        }).then(() => {
          const duration = performance.now() - startTime;
          collector.recordResponse(duration, true);
          return { success: true, duration };
        }).catch((error) => {
          const duration = performance.now() - startTime;
          collector.recordResponse(duration, false);
          return { success: false, duration, error: error.message };
        })
      );
    }
    
    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    
    console.log(`  ✅ Success: ${successful}/${concurrency}`);
    console.log(`  ⏱️  Avg Duration: ${avgDuration.toFixed(2)}ms`);
    console.log(`  📊 Throughput: ${(concurrency / (avgDuration / 1000)).toFixed(2)} req/s`);
  }
  
  return collector.calculateStats();
}

// Test 3: Memory Usage Under Load
async function testMemoryUsage() {
  console.log('\n📊 Test 3: Memory Usage Patterns');
  console.log('=' .repeat(50));
  
  const memorySnapshots = [];
  const iterations = 10;
  
  // Get initial memory baseline
  const initialMemory = await getServerMemoryUsage();
  console.log(`📈 Initial Memory: ${formatMemory(initialMemory)}`);
  
  for (let i = 0; i < iterations; i++) {
    // Send a batch of requests
    const promises = [];
    for (let j = 0; j < 5; j++) {
      promises.push(
        axios.post(`${BASE_URL}/trpc/chat.sendMessage`, {
          json: {
            conversationId: `memory-test-${i}-${j}`,
            message: `Memory test query with some longer text to increase payload size ${j}`
          }
        }, {
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => null)
      );
    }
    
    await Promise.all(promises);
    
    // Check memory after batch
    const currentMemory = await getServerMemoryUsage();
    memorySnapshots.push(currentMemory);
    console.log(`  Iteration ${i + 1}: ${formatMemory(currentMemory)} (Δ ${formatMemory(currentMemory - initialMemory)})`);
    
    // Small delay between iterations
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Check for memory leaks
  const memoryGrowth = memorySnapshots[memorySnapshots.length - 1] - initialMemory;
  const avgGrowthPerIteration = memoryGrowth / iterations;
  
  console.log('\n📈 Memory Analysis:');
  console.log(`  Total Growth: ${formatMemory(memoryGrowth)}`);
  console.log(`  Avg Growth/Iteration: ${formatMemory(avgGrowthPerIteration)}`);
  console.log(`  Potential Leak: ${avgGrowthPerIteration > 1024 * 1024 ? '⚠️ YES' : '✅ NO'}`);
  
  return { memoryGrowth, avgGrowthPerIteration };
}

// Test 4: Database Query Performance
async function testDatabasePerformance() {
  console.log('\n📊 Test 4: Database Query Performance');
  console.log('=' .repeat(50));
  
  const collector = new PerformanceCollector();
  const operations = [
    { name: 'List Conversations', endpoint: '/trpc/chat.listConversations' },
    { name: 'Get Messages', endpoint: '/trpc/chat.getMessages' },
    { name: 'Search Emails', endpoint: '/trpc/dataCollection.searchEmails' }
  ];
  
  for (const op of operations) {
    const start = performance.now();
    try {
      await axios.get(`${BASE_URL}${op.endpoint}`, {
        timeout: 5000,
        params: { limit: 100 }
      });
      
      const duration = performance.now() - start;
      collector.recordResponse(duration, true);
      console.log(`  ✅ ${op.name}: ${duration.toFixed(2)}ms`);
    } catch (error) {
      const duration = performance.now() - start;
      collector.recordResponse(duration, false);
      console.log(`  ❌ ${op.name}: Failed - ${duration.toFixed(2)}ms`);
    }
  }
  
  return collector.calculateStats();
}

// Test 5: WebSocket Latency
async function testWebSocketLatency() {
  console.log('\n📊 Test 5: WebSocket Real-time Performance');
  console.log('=' .repeat(50));
  
  return new Promise((resolve) => {
    const ws = new WebSocket(WS_URL);
    const latencies = [];
    let messageCount = 0;
    const maxMessages = 10;
    
    ws.on('open', () => {
      console.log('  ✅ WebSocket connected');
      
      // Send test messages
      const interval = setInterval(() => {
        if (messageCount >= maxMessages) {
          clearInterval(interval);
          ws.close();
          return;
        }
        
        const timestamp = Date.now();
        ws.send(JSON.stringify({
          type: 'ping',
          timestamp,
          id: messageCount++
        }));
      }, 100);
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'pong' && message.timestamp) {
          const latency = Date.now() - message.timestamp;
          latencies.push(latency);
          console.log(`  📡 Message ${message.id}: ${latency}ms`);
        }
      } catch (error) {
        // Ignore non-JSON messages
      }
    });
    
    ws.on('close', () => {
      if (latencies.length > 0) {
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const minLatency = Math.min(...latencies);
        
        console.log('\n📈 WebSocket Results:');
        console.log(`  Average Latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`  Min/Max: ${minLatency}ms / ${maxLatency}ms`);
        
        resolve({ avgLatency, minLatency, maxLatency });
      } else {
        resolve(null);
      }
    });
    
    ws.on('error', (error) => {
      console.log(`  ❌ WebSocket error: ${error.message}`);
      resolve(null);
    });
  });
}

// Helper function to get server memory usage
async function getServerMemoryUsage() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    return response.data?.memory?.heapUsed || 0;
  } catch {
    // Fallback to process memory if health endpoint not available
    return process.memoryUsage().heapUsed;
  }
}

// Helper function to format memory in MB
function formatMemory(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

// Main test runner
async function runPerformanceTests() {
  console.log('🚀 CrewAI Team Performance Testing Suite');
  console.log('=' .repeat(50));
  console.log(`📍 Target: ${BASE_URL}`);
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log('=' .repeat(50));
  
  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
  } catch (error) {
    console.error('❌ Server is not responding. Please start the server first.');
    process.exit(1);
  }
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: {}
  };
  
  // Run tests sequentially
  results.tests.agentResponseTime = await testAgentResponseTime();
  results.tests.concurrentRequests = await testConcurrentRequests();
  results.tests.memoryUsage = await testMemoryUsage();
  results.tests.databasePerformance = await testDatabasePerformance();
  results.tests.webSocketLatency = await testWebSocketLatency();
  
  // Generate summary report
  console.log('\n' + '=' .repeat(50));
  console.log('📊 PERFORMANCE SUMMARY');
  console.log('=' .repeat(50));
  
  // Calculate overall score
  let score = 100;
  const issues = [];
  
  // Check agent response time (target: <2s)
  if (results.tests.agentResponseTime.avgResponseTime > 2000) {
    score -= 20;
    issues.push(`⚠️ Agent response time (${results.tests.agentResponseTime.avgResponseTime.toFixed(0)}ms) exceeds target of 2000ms`);
  }
  
  // Check memory growth
  if (results.tests.memoryUsage.avgGrowthPerIteration > 1024 * 1024) {
    score -= 30;
    issues.push(`⚠️ Potential memory leak detected (${formatMemory(results.tests.memoryUsage.avgGrowthPerIteration)}/iteration)`);
  }
  
  // Check error rate
  if (results.tests.agentResponseTime.errorRate > 5) {
    score -= 25;
    issues.push(`⚠️ High error rate (${results.tests.agentResponseTime.errorRate.toFixed(1)}%)`);
  }
  
  // Check WebSocket latency (target: <100ms)
  if (results.tests.webSocketLatency && results.tests.webSocketLatency.avgLatency > 100) {
    score -= 15;
    issues.push(`⚠️ WebSocket latency (${results.tests.webSocketLatency.avgLatency.toFixed(0)}ms) exceeds target of 100ms`);
  }
  
  console.log(`\n🏆 Performance Score: ${score}/100`);
  
  if (issues.length > 0) {
    console.log('\n⚠️ Issues Found:');
    issues.forEach(issue => console.log(`  ${issue}`));
  } else {
    console.log('\n✅ All performance targets met!');
  }
  
  // Save results to file
  const fs = require('fs');
  const reportPath = `performance-report-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📝 Detailed report saved to: ${reportPath}`);
  
  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runPerformanceTests()
    .then(() => {
      console.log('\n✅ Performance testing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Performance testing failed:', error);
      process.exit(1);
    });
}

module.exports = { runPerformanceTests, PerformanceCollector };