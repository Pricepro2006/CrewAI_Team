#!/usr/bin/env tsx
/**
 * Test script for MetricsCollectionService
 * Demonstrates comprehensive metrics collection capabilities
 */

import { metricsCollectionService } from '../src/monitoring/MetricsCollectionService.js';
import { groceryAgentMetrics } from '../src/monitoring/GroceryAgentMetrics.js';
import { getGroceryNLPQueue } from '../src/api/services/GroceryNLPQueue.js';
import { performance } from 'perf_hooks';
import { logger } from '../src/utils/logger.js';

async function simulateOllamaRequests() {
  console.log('\n📊 Simulating Ollama NLP requests...');
  
  const nlpQueue = getGroceryNLPQueue();
  
  // Simulate various NLP requests
  const requests = [
    { query: 'Add 2 pounds of organic bananas', priority: 'high' as const },
    { query: 'Find best deals on milk', priority: 'normal' as const },
    { query: 'Compare prices for bread', priority: 'normal' as const },
    { query: 'Add chicken breast to list', priority: 'high' as const },
    { query: 'What are today\'s specials?', priority: 'low' as const }
  ];
  
  const promises = requests.map(async (req, index) => {
    const delay = Math.random() * 2000; // Random processing time
    
    return nlpQueue.enqueue(
      async () => {
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Record metrics
        groceryAgentMetrics.recordNLPParsing(
          Math.random() > 0.1, // 90% success rate
          0.85 + Math.random() * 0.15, // Confidence 0.85-1.0
          delay,
          req.query,
          Math.random() > 0.9 ? 'parse_error' : undefined
        );
        
        return { parsed: true, query: req.query };
      },
      req.priority,
      5000,
      req.query
    );
  });
  
  await Promise.allSettled(promises);
  console.log('✅ Ollama requests completed');
}

async function simulateCacheOperations() {
  console.log('\n📊 Simulating cache operations...');
  
  const cacheTypes = ['redis', 'memory', 'cdn'];
  
  for (let i = 0; i < 20; i++) {
    const cacheType = cacheTypes[Math.floor(Math.random() * cacheTypes.length)];
    const isHit = Math.random() > 0.3; // 70% hit rate
    const responseTime = isHit ? Math.random() * 10 : Math.random() * 100; // Hits are faster
    
    metricsCollectionService.recordAPIMetric(
      isHit ? 'CACHE_HIT' : 'CACHE_MISS',
      cacheType,
      200,
      responseTime
    );
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('✅ Cache operations completed');
}

async function simulateAPIRequests() {
  console.log('\n📊 Simulating API requests...');
  
  const endpoints = [
    { method: 'GET', path: '/api/grocery/search', successRate: 0.95 },
    { method: 'POST', path: '/api/grocery/add', successRate: 0.9 },
    { method: 'GET', path: '/api/grocery/prices', successRate: 0.85 },
    { method: 'DELETE', path: '/api/grocery/remove', successRate: 0.98 },
    { method: 'GET', path: '/api/deals', successRate: 0.92 }
  ];
  
  for (let i = 0; i < 50; i++) {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const isSuccess = Math.random() < endpoint.successRate;
    const status = isSuccess ? 200 : (Math.random() > 0.5 ? 400 : 500);
    const duration = 50 + Math.random() * 500; // 50-550ms
    
    metricsCollectionService.recordAPIMetric(
      endpoint.method,
      endpoint.path,
      status,
      duration
    );
    
    // Record product matching metrics
    if (endpoint.path.includes('search')) {
      const matchType = Math.random() > 0.7 ? 'exact' : 
                       Math.random() > 0.3 ? 'fuzzy' : 'none';
      
      groceryAgentMetrics.recordProductMatching(
        matchType,
        0.7 + Math.random() * 0.3,
        duration,
        `product_${i}`,
        'Grocery'
      );
    }
    
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  
  console.log('✅ API requests completed');
}

async function simulateDatabaseQueries() {
  console.log('\n📊 Simulating database queries...');
  
  const queryTypes = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];
  const tables = ['products', 'prices', 'deals', 'users', 'sessions'];
  
  for (let i = 0; i < 30; i++) {
    const queryType = queryTypes[Math.floor(Math.random() * queryTypes.length)];
    const table = tables[Math.floor(Math.random() * tables.length)];
    const duration = 5 + Math.random() * 100; // 5-105ms
    const success = Math.random() > 0.05; // 95% success rate
    
    metricsCollectionService.recordDatabaseMetric(
      queryType,
      table,
      duration,
      success
    );
    
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  
  console.log('✅ Database queries completed');
}

async function simulateWebSocketActivity() {
  console.log('\n📊 Simulating WebSocket activity...');
  
  // Simulate connections
  for (let i = 0; i < 5; i++) {
    metricsCollectionService.recordWebSocketMetric('connect');
    
    // Record grocery session
    groceryAgentMetrics.recordWebSocketEvent('connect', `ws_${i}`);
  }
  
  // Simulate messages
  for (let i = 0; i < 20; i++) {
    metricsCollectionService.recordWebSocketMetric('message', {
      direction: Math.random() > 0.5 ? 'inbound' : 'outbound',
      messageType: 'grocery_update'
    });
    
    groceryAgentMetrics.recordWebSocketEvent(
      Math.random() > 0.5 ? 'message_sent' : 'message_received'
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Simulate some errors
  for (let i = 0; i < 2; i++) {
    metricsCollectionService.recordWebSocketMetric('error');
    groceryAgentMetrics.recordWebSocketEvent('error');
  }
  
  // Simulate disconnections
  for (let i = 0; i < 3; i++) {
    metricsCollectionService.recordWebSocketMetric('disconnect');
    groceryAgentMetrics.recordWebSocketEvent('disconnect', `ws_${i}`, 30000);
  }
  
  console.log('✅ WebSocket activity completed');
}

async function simulateDistributedTracing() {
  console.log('\n📊 Simulating distributed tracing...');
  
  const correlationId = `trace-${Date.now()}`;
  
  // Simulate a request flowing through multiple services
  const services = [
    { name: 'api-gateway', endpoint: '/api/grocery/search', latency: 5 },
    { name: 'nlp-service', endpoint: '/parse', latency: 150 },
    { name: 'product-matcher', endpoint: '/match', latency: 75 },
    { name: 'price-fetcher', endpoint: '/fetch', latency: 200 },
    { name: 'cache-service', endpoint: '/get', latency: 10 }
  ];
  
  for (const service of services) {
    metricsCollectionService.recordTrace(
      correlationId,
      service.name,
      service.endpoint,
      service.latency
    );
    
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log('✅ Distributed tracing completed');
}

async function simulateDealDetection() {
  console.log('\n📊 Simulating deal detection...');
  
  for (let i = 0; i < 10; i++) {
    const dealsFound = Math.floor(Math.random() * 5);
    const dealTypes = ['BOGO', 'Percentage', 'Dollar Off', 'Clearance'];
    const selectedTypes = dealTypes.slice(0, Math.floor(Math.random() * dealTypes.length) + 1);
    
    groceryAgentMetrics.recordDealDetection(
      dealsFound,
      selectedTypes,
      100 + Math.random() * 400, // 100-500ms detection time
      5 + Math.random() * 20, // $5-$25 average savings
      Math.floor(Math.random() * 2), // 0-1 false positives
      Math.floor(Math.random() * 2) // 0-1 missed deals
    );
    
    // Record price fetch
    groceryAgentMetrics.recordPriceFetch(
      Math.random() > 0.1, // 90% success
      50 + Math.random() * 200, // 50-250ms
      `product_${i}`,
      'walmart',
      Math.random() > 0.9 ? 'timeout' : undefined,
      Math.random() > 0.8 // 20% price unavailable
    );
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('✅ Deal detection completed');
}

async function simulateUserSessions() {
  console.log('\n📊 Simulating user sessions...');
  
  for (let i = 0; i < 5; i++) {
    const sessionDuration = 60000 + Math.random() * 240000; // 1-5 minutes
    const queryCount = Math.floor(5 + Math.random() * 20); // 5-25 queries
    const bounced = Math.random() > 0.7; // 30% bounce rate
    const converted = !bounced && Math.random() > 0.4; // 60% conversion of non-bounced
    const features = ['search', 'add_item', 'price_check', 'deals'];
    const usedFeatures = features.slice(0, Math.floor(Math.random() * features.length) + 1);
    const deviceType = Math.random() > 0.6 ? 'mobile' : 'desktop';
    
    groceryAgentMetrics.recordUserSession(
      sessionDuration,
      queryCount,
      bounced,
      converted,
      usedFeatures,
      deviceType
    );
    
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  console.log('✅ User sessions completed');
}

async function displayMetrics() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 METRICS SUMMARY');
  console.log('='.repeat(80));
  
  // Get comprehensive metrics
  const summary = metricsCollectionService.getMetricsSummary();
  const groceryMetrics = groceryAgentMetrics.exportAllMetrics();
  
  // Display Ollama metrics
  console.log('\n🤖 Ollama Queue Metrics:');
  console.log(`  Queue Depth: ${summary.ollama.queueDepth}`);
  console.log(`  Processing: ${summary.ollama.queueProcessing}`);
  console.log(`  Completed: ${summary.ollama.queueCompleted}`);
  console.log(`  Avg Processing Time: ${summary.ollama.avgProcessingTime.toFixed(2)}ms`);
  console.log(`  Error Rate: ${(summary.ollama.errorRate * 100).toFixed(2)}%`);
  console.log(`  Timeout Rate: ${(summary.ollama.timeoutRate * 100).toFixed(2)}%`);
  console.log(`  Throughput (1m/5m/15m): ${summary.ollama.throughput.last1min}/${summary.ollama.throughput.last5min}/${summary.ollama.throughput.last15min}`);
  
  // Display cache metrics
  console.log('\n💾 Cache Metrics:');
  Object.entries(summary.cache).forEach(([type, metrics]: [string, any]) => {
    if (type !== 'cdn') {
      console.log(`  ${type.toUpperCase()}:`);
      console.log(`    Hit Rate: ${(metrics.hitRate * 100).toFixed(2)}%`);
      console.log(`    Miss Rate: ${(metrics.missRate * 100).toFixed(2)}%`);
    }
  });
  
  // Display API metrics
  console.log('\n🌐 API Metrics:');
  console.log(`  Total Endpoints: ${Object.keys(summary.api.requestRate).length}`);
  Object.entries(summary.api.requestRate).forEach(([endpoint, count]) => {
    console.log(`    ${endpoint}: ${count} requests`);
  });
  
  // Display system metrics
  console.log('\n💻 System Metrics:');
  console.log(`  CPU Usage: ${(summary.system.cpuUsage * 100).toFixed(2)}%`);
  console.log(`  Memory Usage: ${(summary.system.memoryUsage.percentage * 100).toFixed(2)}%`);
  console.log(`  Memory: ${(summary.system.memoryUsage.used / 1024 / 1024 / 1024).toFixed(2)}GB / ${(summary.system.memoryUsage.total / 1024 / 1024 / 1024).toFixed(2)}GB`);
  console.log(`  Load Average: ${summary.system.loadAverage.map(l => l.toFixed(2)).join(', ')}`);
  console.log(`  Uptime: ${(summary.system.uptime / 3600).toFixed(2)} hours`);
  
  // Display grocery-specific metrics
  console.log('\n🛒 Grocery Agent Metrics:');
  console.log(`  NLP Success Rate: ${((groceryMetrics.nlp.successfulParses / Math.max(groceryMetrics.nlp.totalQueries, 1)) * 100).toFixed(2)}%`);
  console.log(`  Product Match Rate: ${(((groceryMetrics.product.exactMatches + groceryMetrics.product.fuzzyMatches) / Math.max(groceryMetrics.product.totalSearches, 1)) * 100).toFixed(2)}%`);
  console.log(`  Price Fetch Success: ${((groceryMetrics.price.successfulFetches / Math.max(groceryMetrics.price.totalRequests, 1)) * 100).toFixed(2)}%`);
  console.log(`  Deals Found: ${groceryMetrics.deal.dealsFound}`);
  console.log(`  Active WebSocket Connections: ${groceryMetrics.websocket.activeConnections}`);
  console.log(`  Session Bounce Rate: ${(groceryMetrics.session.bounceRate * 100).toFixed(2)}%`);
  
  // Display trace metrics
  console.log('\n🔍 Distributed Traces:');
  const traces = summary.traces;
  Object.entries(traces).forEach(([id, trace]: [string, any]) => {
    console.log(`  Trace ${id}:`);
    console.log(`    Total Latency: ${trace.totalLatency}ms`);
    console.log(`    Services: ${trace.serviceCount}`);
  });
}

async function exportPrometheusMetrics() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 PROMETHEUS METRICS EXPORT');
  console.log('='.repeat(80));
  
  const prometheusMetrics = metricsCollectionService.exportPrometheusMetrics();
  
  // Display first 20 lines of Prometheus metrics
  const lines = prometheusMetrics.split('\n');
  const preview = lines.slice(0, 20).join('\n');
  
  console.log(preview);
  if (lines.length > 20) {
    console.log(`... and ${lines.length - 20} more lines`);
  }
  
  console.log('\n✅ Metrics available at: http://localhost:3000/metrics');
}

async function main() {
  console.log('🚀 Starting Metrics Collection Test');
  console.log('This will simulate various operations and collect metrics\n');
  
  try {
    // Run simulations
    await simulateOllamaRequests();
    await simulateCacheOperations();
    await simulateAPIRequests();
    await simulateDatabaseQueries();
    await simulateWebSocketActivity();
    await simulateDistributedTracing();
    await simulateDealDetection();
    await simulateUserSessions();
    
    // Wait for metrics to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Display results
    await displayMetrics();
    await exportPrometheusMetrics();
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Metrics Collection Test Complete!');
    console.log('='.repeat(80));
    
    // Get Grafana config
    const grafanaConfig = metricsCollectionService.getGrafanaDashboardConfig();
    console.log('\n📊 Grafana Dashboard Config:');
    console.log(`  Panels: ${grafanaConfig.dashboard.panels.length}`);
    grafanaConfig.dashboard.panels.forEach((panel: any) => {
    console.log(`    - ${panel.title}`);
    });
    
    // Get Prometheus alert rules
    const alertRules = metricsCollectionService.getPrometheusAlertRules();
    console.log('\n🚨 Prometheus Alert Rules:');
    alertRules.groups.forEach((group: any) => {
      console.log(`  Group: ${group.name}`);
      group.rules.forEach((rule: any) => {
        console.log(`    - ${rule.alert}: ${rule.annotations.summary}`);
      });
    });
    
  } catch (error) {
    console.error('❌ Error during metrics test:', error);
    process.exit(1);
  } finally {
    // Cleanup
    metricsCollectionService.shutdown();
    process.exit(0);
  }
}

// Run the test
main().catch(console.error);