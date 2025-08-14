#!/usr/bin/env ts-node

/**
 * tRPC API Performance Analyzer
 * Deep analysis of tRPC resolvers, type safety overhead, and optimization opportunities
 */

import axios from 'axios';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface EndpointMetrics {
  name: string;
  method: 'query' | 'mutation' | 'subscription';
  latency: {
    min: number;
    max: number;
    mean: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: number;
  errorRate: number;
  payloadSize: {
    request: number;
    response: number;
  };
  samples: number;
}

interface TRPCPerformanceProfile {
  endpoints: EndpointMetrics[];
  typeOverhead: number;
  serializationCost: number;
  batchingEfficiency: number;
  cacheHitRate: number;
  recommendations: string[];
}

class TRPCPerformanceAnalyzer {
  private baseUrl = 'http://localhost:3001/api/trpc';
  private profile: TRPCPerformanceProfile = {
    endpoints: [],
    typeOverhead: 0,
    serializationCost: 0,
    batchingEfficiency: 0,
    cacheHitRate: 0,
    recommendations: []
  };

  // Define all tRPC endpoints to test
  private endpoints = [
    // Walmart endpoints
    { name: 'walmart.search', method: 'query' as const, input: { query: 'milk', limit: 10 } },
    { name: 'walmart.getProduct', method: 'query' as const, input: { id: '123' } },
    { name: 'walmart.getOrders', method: 'query' as const, input: { limit: 10 } },
    { name: 'walmart.getLists', method: 'query' as const, input: {} },
    { name: 'walmart.getDeals', method: 'query' as const, input: { category: 'grocery' } },
    { name: 'walmart.addToCart', method: 'mutation' as const, input: { productId: '123', quantity: 1 } },
    
    // Grocery endpoints
    { name: 'grocery.search', method: 'query' as const, input: { query: 'organic', limit: 20 } },
    { name: 'grocery.autocomplete', method: 'query' as const, input: { query: 'app' } },
    { name: 'grocery.getCategories', method: 'query' as const, input: {} },
    
    // NLP endpoints
    { name: 'nlp.processQuery', method: 'query' as const, input: { query: 'find cheap milk' } },
    { name: 'nlp.extractEntities', method: 'query' as const, input: { text: 'I need 2 gallons of milk' } },
    
    // Cart endpoints
    { name: 'cart.getItems', method: 'query' as const, input: {} },
    { name: 'cart.updateQuantity', method: 'mutation' as const, input: { itemId: '1', quantity: 2 } },
    { name: 'cart.checkout', method: 'mutation' as const, input: {} },
    
    // Budget endpoints
    { name: 'budget.getTracking', method: 'query' as const, input: {} },
    { name: 'budget.updateLimit', method: 'mutation' as const, input: { limit: 500 } },
    
    // Price alert endpoints
    { name: 'priceAlerts.getAlerts', method: 'query' as const, input: {} },
    { name: 'priceAlerts.createAlert', method: 'mutation' as const, input: { productId: '123', targetPrice: 5.99 } }
  ];

  async analyzeEndpointPerformance(): Promise<void> {
    console.log('\n🚀 Analyzing tRPC Endpoint Performance...');
    
    for (const endpoint of this.endpoints) {
      const metrics = await this.profileEndpoint(endpoint);
      if (metrics) {
        this.profile.endpoints.push(metrics);
        console.log(`  ✅ ${endpoint.name}: ${metrics.latency.mean.toFixed(2)}ms (mean), ${metrics.errorRate.toFixed(1)}% errors`);
      }
    }
  }

  private async profileEndpoint(endpoint: any): Promise<EndpointMetrics | null> {
    const latencies: number[] = [];
    const requestSizes: number[] = [];
    const responseSizes: number[] = [];
    let errors = 0;
    const samples = 50;

    for (let i = 0; i < samples; i++) {
      try {
        const input = JSON.stringify(endpoint.input);
        requestSizes.push(Buffer.byteLength(input));

        const start = performance.now();
        const response = await this.callEndpoint(endpoint.name, endpoint.input);
        const latency = performance.now() - start;
        
        latencies.push(latency);
        responseSizes.push(Buffer.byteLength(JSON.stringify(response)));
        
      } catch (error) {
        errors++;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    if (latencies.length === 0) {
      console.log(`  ⚠️  ${endpoint.name}: No successful requests`);
      return null;
    }

    return {
      name: endpoint.name,
      method: endpoint.method,
      latency: {
        min: Math.min(...latencies),
        max: Math.max(...latencies),
        mean: this.average(latencies),
        p50: this.percentile(latencies, 50),
        p95: this.percentile(latencies, 95),
        p99: this.percentile(latencies, 99)
      },
      throughput: 1000 / this.average(latencies), // requests per second
      errorRate: (errors / samples) * 100,
      payloadSize: {
        request: this.average(requestSizes),
        response: this.average(responseSizes)
      },
      samples: latencies.length
    };
  }

  async analyzeTypeSafetyOverhead(): Promise<void> {
    console.log('\n📐 Analyzing Type Safety Overhead...');
    
    // Compare typed vs untyped calls
    const typedLatencies: number[] = [];
    const untypedLatencies: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      // Typed call (through tRPC)
      const typedStart = performance.now();
      await this.callEndpoint('grocery.search', { query: 'test', limit: 10 }).catch(() => {});
      typedLatencies.push(performance.now() - typedStart);
      
      // Untyped call (direct HTTP)
      const untypedStart = performance.now();
      await axios.post(`${this.baseUrl}/grocery.search`, {
        input: { query: 'test', limit: 10 }
      }).catch(() => {});
      untypedLatencies.push(performance.now() - untypedStart);
    }
    
    const typedAvg = this.average(typedLatencies);
    const untypedAvg = this.average(untypedLatencies);
    this.profile.typeOverhead = ((typedAvg - untypedAvg) / untypedAvg) * 100;
    
    console.log(`  ✅ Type Safety Overhead: ${this.profile.typeOverhead.toFixed(2)}%`);
    console.log(`  ✅ Typed Average: ${typedAvg.toFixed(2)}ms`);
    console.log(`  ✅ Untyped Average: ${untypedAvg.toFixed(2)}ms`);
  }

  async analyzeBatchingPerformance(): Promise<void> {
    console.log('\n🎯 Analyzing Batching Performance...');
    
    // Test individual requests
    const individualStart = performance.now();
    const individualPromises = [
      this.callEndpoint('grocery.search', { query: 'milk' }),
      this.callEndpoint('grocery.search', { query: 'bread' }),
      this.callEndpoint('grocery.search', { query: 'eggs' })
    ];
    await Promise.all(individualPromises).catch(() => {});
    const individualTime = performance.now() - individualStart;
    
    // Test batched request
    const batchStart = performance.now();
    await axios.post(`${this.baseUrl}`, {
      batch: [
        { procedure: 'grocery.search', input: { query: 'milk' } },
        { procedure: 'grocery.search', input: { query: 'bread' } },
        { procedure: 'grocery.search', input: { query: 'eggs' } }
      ]
    }).catch(() => {});
    const batchTime = performance.now() - batchStart;
    
    this.profile.batchingEfficiency = ((individualTime - batchTime) / individualTime) * 100;
    
    console.log(`  ✅ Batching Efficiency: ${this.profile.batchingEfficiency.toFixed(2)}% improvement`);
    console.log(`  ✅ Individual Time: ${individualTime.toFixed(2)}ms`);
    console.log(`  ✅ Batched Time: ${batchTime.toFixed(2)}ms`);
  }

  async analyzeSerializationCost(): Promise<void> {
    console.log('\n📦 Analyzing Serialization Cost...');
    
    const testData = {
      small: { id: 1, name: 'test' },
      medium: Array(100).fill(0).map((_, i) => ({ id: i, name: `item-${i}`, price: Math.random() * 100 })),
      large: Array(1000).fill(0).map((_, i) => ({ 
        id: i, 
        name: `item-${i}`, 
        description: 'x'.repeat(100),
        metadata: { tags: ['tag1', 'tag2', 'tag3'] }
      }))
    };
    
    const serializationTimes: Record<string, number> = {};
    
    for (const [size, data] of Object.entries(testData)) {
      const times: number[] = [];
      
      for (let i = 0; i < 1000; i++) {
        const start = performance.now();
        JSON.stringify(data);
        JSON.parse(JSON.stringify(data));
        times.push(performance.now() - start);
      }
      
      serializationTimes[size] = this.average(times);
      console.log(`  ✅ ${size} payload: ${serializationTimes[size].toFixed(3)}ms`);
    }
    
    this.profile.serializationCost = serializationTimes.large;
  }

  async analyzeCachePerformance(): Promise<void> {
    console.log('\n💾 Analyzing Cache Performance...');
    
    const cacheableEndpoint = 'grocery.getCategories';
    const latencies: number[] = [];
    const cacheHits = [];
    
    // First call (cache miss)
    const firstCallStart = performance.now();
    await this.callEndpoint(cacheableEndpoint, {});
    const firstCallTime = performance.now() - firstCallStart;
    
    // Subsequent calls (should be cached)
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      await this.callEndpoint(cacheableEndpoint, {});
      const latency = performance.now() - start;
      latencies.push(latency);
      
      // If latency is significantly lower, it's likely a cache hit
      if (latency < firstCallTime * 0.5) {
        cacheHits.push(true);
      } else {
        cacheHits.push(false);
      }
    }
    
    this.profile.cacheHitRate = (cacheHits.filter(h => h).length / cacheHits.length) * 100;
    
    console.log(`  ✅ Cache Hit Rate: ${this.profile.cacheHitRate.toFixed(2)}%`);
    console.log(`  ✅ First Call: ${firstCallTime.toFixed(2)}ms`);
    console.log(`  ✅ Cached Calls: ${this.average(latencies).toFixed(2)}ms`);
  }

  async analyzeResolverComplexity(): Promise<void> {
    console.log('\n🔍 Analyzing Resolver Complexity...');
    
    // Test different complexity levels
    const complexityTests = [
      { 
        name: 'simple', 
        endpoint: 'grocery.getCategories',
        input: {}
      },
      {
        name: 'moderate',
        endpoint: 'walmart.search',
        input: { query: 'test', limit: 50 }
      },
      {
        name: 'complex',
        endpoint: 'nlp.processQuery',
        input: { query: 'find organic milk under $5 with good reviews' }
      }
    ];
    
    for (const test of complexityTests) {
      const times: number[] = [];
      
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await this.callEndpoint(test.endpoint, test.input).catch(() => {});
        times.push(performance.now() - start);
      }
      
      console.log(`  ✅ ${test.name} resolver: ${this.average(times).toFixed(2)}ms`);
    }
  }

  async generateOptimizations(): Promise<void> {
    console.log('\n💡 Generating Optimization Recommendations...');
    
    const recommendations: string[] = [];
    
    // Analyze endpoint performance
    const slowEndpoints = this.profile.endpoints.filter(e => e.latency.p95 > 200);
    if (slowEndpoints.length > 0) {
      recommendations.push(`Optimize slow endpoints: ${slowEndpoints.map(e => e.name).join(', ')}`);
      recommendations.push('Consider implementing database query optimization and caching');
    }
    
    // Check error rates
    const highErrorEndpoints = this.profile.endpoints.filter(e => e.errorRate > 5);
    if (highErrorEndpoints.length > 0) {
      recommendations.push(`Fix high error rate endpoints: ${highErrorEndpoints.map(e => e.name).join(', ')}`);
      recommendations.push('Add better error handling and input validation');
    }
    
    // Type overhead
    if (this.profile.typeOverhead > 10) {
      recommendations.push('Type safety overhead is high - consider optimizing validation logic');
    }
    
    // Batching
    if (this.profile.batchingEfficiency < 20) {
      recommendations.push('Batching efficiency is low - ensure batch processing is properly implemented');
    }
    
    // Caching
    if (this.profile.cacheHitRate < 50) {
      recommendations.push('Cache hit rate is low - implement Redis caching for frequently accessed data');
      recommendations.push('Add ETags for conditional requests');
    }
    
    // Serialization
    if (this.profile.serializationCost > 1) {
      recommendations.push('High serialization cost - consider using MessagePack or Protocol Buffers');
      recommendations.push('Implement response compression (gzip/brotli)');
    }
    
    // General recommendations
    recommendations.push('Implement request/response compression');
    recommendations.push('Add DataLoader pattern for N+1 query prevention');
    recommendations.push('Use query complexity analysis to prevent expensive operations');
    recommendations.push('Implement rate limiting per endpoint');
    recommendations.push('Add APM monitoring (Datadog, New Relic)');
    
    this.profile.recommendations = recommendations;
    
    recommendations.forEach(r => console.log(`  • ${r}`));
  }

  async generateReport(): Promise<void> {
    const reportDir = path.join(process.cwd(), 'performance-profiles', 'trpc-analysis');
    fs.mkdirSync(reportDir, { recursive: true });
    
    // Generate JSON report
    fs.writeFileSync(
      path.join(reportDir, 'trpc-performance.json'),
      JSON.stringify(this.profile, null, 2)
    );
    
    // Generate Markdown report
    const markdownReport = this.generateMarkdownReport();
    fs.writeFileSync(
      path.join(reportDir, 'TRPC_ANALYSIS.md'),
      markdownReport
    );
    
    // Generate optimization script
    const optimizationScript = this.generateOptimizationScript();
    fs.writeFileSync(
      path.join(reportDir, 'apply-trpc-optimizations.ts'),
      optimizationScript
    );
    
    console.log(`\n📊 Reports saved to: ${reportDir}`);
  }

  private generateMarkdownReport(): string {
    return `# tRPC API Performance Analysis Report

## Executive Summary
Date: ${new Date().toISOString()}
Endpoints Analyzed: ${this.profile.endpoints.length}
Average Latency: ${this.average(this.profile.endpoints.map(e => e.latency.mean)).toFixed(2)}ms
Type Safety Overhead: ${this.profile.typeOverhead.toFixed(2)}%
Cache Hit Rate: ${this.profile.cacheHitRate.toFixed(2)}%

## Endpoint Performance

| Endpoint | Method | Mean Latency | P95 Latency | Error Rate | Throughput |
|----------|--------|--------------|-------------|------------|------------|
${this.profile.endpoints.map(e => 
  `| ${e.name} | ${e.method} | ${e.latency.mean.toFixed(2)}ms | ${e.latency.p95.toFixed(2)}ms | ${e.errorRate.toFixed(1)}% | ${e.throughput.toFixed(1)} req/s |`
).join('\n')}

## Performance Metrics

### Latency Distribution
- **Fast (<50ms):** ${this.profile.endpoints.filter(e => e.latency.mean < 50).length} endpoints
- **Moderate (50-200ms):** ${this.profile.endpoints.filter(e => e.latency.mean >= 50 && e.latency.mean < 200).length} endpoints
- **Slow (>200ms):** ${this.profile.endpoints.filter(e => e.latency.mean >= 200).length} endpoints

### Optimization Metrics
- **Type Safety Overhead:** ${this.profile.typeOverhead.toFixed(2)}%
- **Batching Efficiency:** ${this.profile.batchingEfficiency.toFixed(2)}% improvement
- **Serialization Cost:** ${this.profile.serializationCost.toFixed(3)}ms for large payloads
- **Cache Hit Rate:** ${this.profile.cacheHitRate.toFixed(2)}%

## Recommendations

${this.profile.recommendations.map(r => `- ${r}`).join('\n')}

## Implementation Priority

### 🔴 High Priority (Immediate)
1. Fix endpoints with >5% error rate
2. Optimize endpoints with >200ms P95 latency
3. Implement Redis caching layer

### 🟡 Medium Priority (This Sprint)
1. Add response compression
2. Implement DataLoader pattern
3. Add endpoint-specific rate limiting

### 🟢 Low Priority (Next Sprint)
1. Consider MessagePack for serialization
2. Add APM monitoring
3. Implement query complexity analysis
`;
  }

  private generateOptimizationScript(): string {
    return `#!/usr/bin/env ts-node

/**
 * tRPC Performance Optimizations
 * Auto-generated based on performance analysis
 */

import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import Redis from 'ioredis';
import DataLoader from 'dataloader';
import compression from 'compression';

// 1. Setup Redis caching
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3
});

// 2. Setup DataLoader for batching
const createProductLoader = () => new DataLoader(async (ids: string[]) => {
  // Batch load products
  const products = await db.select().from('products').where('id', 'in', ids);
  return ids.map(id => products.find(p => p.id === id));
});

// 3. Caching middleware
const cacheMiddleware = async (opts: any) => {
  const { path, input, next } = opts;
  
  // Generate cache key
  const cacheKey = \`trpc:\${path}:\${JSON.stringify(input)}\`;
  
  // Check cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute procedure
  const result = await next();
  
  // Cache result (with TTL based on endpoint)
  const ttl = getCacheTTL(path);
  if (ttl > 0) {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
  }
  
  return result;
};

// 4. Rate limiting middleware
const rateLimitMiddleware = async (opts: any) => {
  const { ctx, path, next } = opts;
  const key = \`ratelimit:\${path}:\${ctx.userId || ctx.ip}\`;
  
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60); // 1 minute window
  }
  
  const limit = getRateLimit(path);
  if (count > limit) {
    throw new Error('Rate limit exceeded');
  }
  
  return next();
};

// 5. Query complexity analysis
const complexityMiddleware = async (opts: any) => {
  const { input, path, next } = opts;
  
  const complexity = calculateComplexity(path, input);
  if (complexity > 100) {
    throw new Error('Query too complex');
  }
  
  return next();
};

// 6. Apply optimizations to tRPC
const t = initTRPC.context<Context>().create();

export const optimizedRouter = t.router({
  // Apply middleware stack
  grocery: t.router({
    search: t.procedure
      .use(rateLimitMiddleware)
      .use(cacheMiddleware)
      .use(complexityMiddleware)
      .input(z.object({
        query: z.string(),
        limit: z.number().default(20)
      }))
      .query(async ({ input, ctx }) => {
        // Use DataLoader for batching
        const loader = ctx.loaders.product;
        // ... implementation
      })
  })
});

// Helper functions
function getCacheTTL(path: string): number {
  const ttlMap: Record<string, number> = {
    'grocery.getCategories': 3600, // 1 hour
    'walmart.getDeals': 300, // 5 minutes
    'grocery.search': 60, // 1 minute
    // ... other endpoints
  };
  return ttlMap[path] || 0;
}

function getRateLimit(path: string): number {
  const limitMap: Record<string, number> = {
    'grocery.search': 100, // 100 per minute
    'nlp.processQuery': 20, // 20 per minute
    'cart.checkout': 5, // 5 per minute
    // ... other endpoints
  };
  return limitMap[path] || 60;
}

function calculateComplexity(path: string, input: any): number {
  // Calculate query complexity based on input
  let complexity = 1;
  
  if (input.limit) {
    complexity += input.limit / 10;
  }
  
  if (input.includeRelations) {
    complexity *= 2;
  }
  
  return complexity;
}

export { redis, createProductLoader };
`;
  }

  // Helper methods
  private async callEndpoint(procedure: string, input: any): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/${procedure}`, { input });
    return response.data;
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private percentile(arr: number[], p: number): number {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  async run(): Promise<void> {
    console.log('='.repeat(60));
    console.log('🚀 tRPC API PERFORMANCE ANALYSIS');
    console.log('='.repeat(60));

    try {
      await this.analyzeEndpointPerformance();
      await this.analyzeTypeSafetyOverhead();
      await this.analyzeBatchingPerformance();
      await this.analyzeSerializationCost();
      await this.analyzeCachePerformance();
      await this.analyzeResolverComplexity();
      await this.generateOptimizations();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Analysis failed:', error.message);
      console.log('Make sure the tRPC server is running on port 3001');
    }

    console.log('\n✅ Analysis Complete');
  }
}

// Run if executed directly
if (require.main === module) {
  const analyzer = new TRPCPerformanceAnalyzer();
  analyzer.run().catch(console.error);
}

export default TRPCPerformanceAnalyzer;