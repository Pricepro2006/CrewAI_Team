/**
 * Performance Tests for LLM Integration
 * Benchmarks response times, throughput, and resource usage
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { LlamaCppHttpProvider } from '../LlamaCppHttpProvider';
import { LLMProviderManager } from '../LLMProviderManager';
import { logger } from '../../../utils/logger';
import os from 'os';
import v8 from 'v8';

// Performance test configuration
const PERF_CONFIG = {
  warmupRuns: 3,
  testRuns: 10,
  concurrentRequests: [1, 5, 10, 20],
  promptSizes: {
    small: 50,    // ~50 tokens
    medium: 500,  // ~500 tokens
    large: 2000   // ~2000 tokens
  },
  maxTokens: {
    small: 50,
    medium: 200,
    large: 500
  },
  acceptableLatency: {
    p50: 1000,  // 50th percentile under 1s
    p95: 3000,  // 95th percentile under 3s
    p99: 5000   // 99th percentile under 5s
  },
  minThroughput: {
    tokensPerSecond: 10,
    requestsPerSecond: 1
  }
};

// Performance metrics collector
class PerformanceMetrics {
  private metrics: Map<string, number[]> = new Map();
  private memorySnapshots: any[] = [];
  
  record(metric: string, value: number) {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    this.metrics.get(metric)!.push(value);
  }
  
  recordMemory() {
    this.memorySnapshots.push({
      timestamp: Date.now(),
      usage: process.memoryUsage(),
      heap: v8.getHeapStatistics()
    });
  }
  
  getStats(metric: string) {
    const values = this.metrics.get(metric) || [];
    if (values.length === 0) return null;
    
    values.sort((a, b) => a - b);
    
    return {
      count: values.length,
      min: values[0],
      max: values[values.length - 1],
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      stdDev: this.calculateStdDev(values)
    };
  }
  
  private calculateStdDev(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }
  
  getMemoryTrend() {
    if (this.memorySnapshots.length < 2) return null;
    
    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    return {
      heapUsedDelta: last.usage.heapUsed - first.usage.heapUsed,
      externalDelta: last.usage.external - first.usage.external,
      totalHeapDelta: last.heap.total_heap_size - first.heap.total_heap_size,
      duration: last.timestamp - first.timestamp
    };
  }
  
  generateReport(): string {
    let report = '\n=== Performance Test Report ===\n\n';
    
    for (const [metric, _] of this.metrics) {
      const stats = this.getStats(metric);
      if (stats) {
        report += `${metric}:\n`;
        report += `  Count: ${stats.count}\n`;
        report += `  Min: ${stats.min.toFixed(2)}ms\n`;
        report += `  Max: ${stats.max.toFixed(2)}ms\n`;
        report += `  Mean: ${stats.mean.toFixed(2)}ms\n`;
        report += `  Median: ${stats.median.toFixed(2)}ms\n`;
        report += `  P95: ${stats.p95.toFixed(2)}ms\n`;
        report += `  P99: ${stats.p99.toFixed(2)}ms\n`;
        report += `  StdDev: ${stats.stdDev.toFixed(2)}ms\n\n`;
      }
    }
    
    const memoryTrend = this.getMemoryTrend();
    if (memoryTrend) {
      report += 'Memory Usage:\n';
      report += `  Heap Delta: ${(memoryTrend.heapUsedDelta / 1024 / 1024).toFixed(2)}MB\n`;
      report += `  External Delta: ${(memoryTrend.externalDelta / 1024 / 1024).toFixed(2)}MB\n`;
      report += `  Duration: ${memoryTrend.duration}ms\n`;
    }
    
    return report;
  }
}

describe('LLM Performance Tests', () => {
  let provider: LlamaCppHttpProvider;
  let manager: LLMProviderManager;
  let metrics: PerformanceMetrics;

  beforeAll(async () => {
    // Initialize provider and manager
    provider = new LlamaCppHttpProvider();
    await provider.initialize();
    
    manager = LLMProviderManager.getInstance();
    await manager.initialize();
    
    // Warmup runs
    console.log('Running warmup...');
    for (let i = 0; i < PERF_CONFIG.warmupRuns; i++) {
      await provider.generate('Warmup prompt', { maxTokens: 50 });
    }
  }, 30000);

  afterAll(async () => {
    await provider.destroy();
    await manager.destroy();
  });

  beforeEach(() => {
    metrics = new PerformanceMetrics();
  });

  describe('Response Time Benchmarks', () => {
    it('should meet latency requirements for small prompts', async () => {
      const prompt = 'x'.repeat(PERF_CONFIG.promptSizes.small);
      
      for (let i = 0; i < PERF_CONFIG.testRuns; i++) {
        const start = performance.now();
        
        await provider.generate(prompt, {
          maxTokens: PERF_CONFIG.maxTokens.small
        });
        
        const duration = performance.now() - start;
        metrics.record('small_prompt_latency', duration);
      }
      
      const stats = metrics.getStats('small_prompt_latency')!;
      
      expect(stats.p50).toBeLessThan(PERF_CONFIG.acceptableLatency.p50);
      expect(stats.p95).toBeLessThan(PERF_CONFIG.acceptableLatency.p95);
      expect(stats.p99).toBeLessThan(PERF_CONFIG.acceptableLatency.p99);
      
      console.log('Small prompt latency:', stats);
    });

    it('should handle medium prompts efficiently', async () => {
      const prompt = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
      
      for (let i = 0; i < PERF_CONFIG.testRuns; i++) {
        const start = performance.now();
        
        await provider.generate(prompt, {
          maxTokens: PERF_CONFIG.maxTokens.medium
        });
        
        const duration = performance.now() - start;
        metrics.record('medium_prompt_latency', duration);
      }
      
      const stats = metrics.getStats('medium_prompt_latency')!;
      
      expect(stats.mean).toBeLessThan(PERF_CONFIG.acceptableLatency.p95);
      
      console.log('Medium prompt latency:', stats);
    });

    it('should process large prompts within acceptable time', async () => {
      const prompt = `
        You are an AI assistant helping with email analysis. 
        Please analyze the following email and extract key information.
        The email contains business discussions about various deals and agreements.
      `.repeat(20);
      
      for (let i = 0; i < 5; i++) { // Fewer runs for large prompts
        const start = performance.now();
        
        await provider.generate(prompt, {
          maxTokens: PERF_CONFIG.maxTokens.large
        });
        
        const duration = performance.now() - start;
        metrics.record('large_prompt_latency', duration);
      }
      
      const stats = metrics.getStats('large_prompt_latency')!;
      
      expect(stats.mean).toBeLessThan(10000); // 10 seconds for large prompts
      
      console.log('Large prompt latency:', stats);
    });
  });

  describe('Throughput Benchmarks', () => {
    it('should maintain minimum tokens per second', async () => {
      const prompt = 'Generate a detailed response about email processing systems.';
      const tokenCounts: number[] = [];
      
      for (let i = 0; i < PERF_CONFIG.testRuns; i++) {
        const start = performance.now();
        
        const result = await provider.generate(prompt, {
          maxTokens: 200
        });
        
        const duration = (performance.now() - start) / 1000; // seconds
        const tokensPerSecond = (result.tokensGenerated || 0) / duration;
        
        tokenCounts.push(tokensPerSecond);
        metrics.record('tokens_per_second', tokensPerSecond);
      }
      
      const avgTokensPerSecond = tokenCounts.reduce((a, b) => a + b, 0) / tokenCounts.length;
      
      expect(avgTokensPerSecond).toBeGreaterThan(PERF_CONFIG.minThroughput.tokensPerSecond);
      
      console.log(`Average tokens/second: ${avgTokensPerSecond.toFixed(2)}`);
    });

    it('should handle concurrent requests efficiently', async () => {
      for (const concurrency of PERF_CONFIG.concurrentRequests) {
        const start = performance.now();
        
        const promises = Array(concurrency).fill(null).map((_, i) =>
          provider.generate(`Concurrent request ${i}`, {
            maxTokens: 50
          })
        );
        
        await Promise.all(promises);
        
        const duration = performance.now() - start;
        const requestsPerSecond = (concurrency / duration) * 1000;
        
        metrics.record(`concurrent_${concurrency}_rps`, requestsPerSecond);
        
        expect(requestsPerSecond).toBeGreaterThan(PERF_CONFIG.minThroughput.requestsPerSecond);
        
        console.log(`Concurrency ${concurrency}: ${requestsPerSecond.toFixed(2)} req/s`);
      }
    });

    it('should scale linearly with concurrent requests', async () => {
      const throughputs: { concurrency: number; rps: number }[] = [];
      
      for (const concurrency of PERF_CONFIG.concurrentRequests) {
        const iterations = 3;
        let totalRps = 0;
        
        for (let iter = 0; iter < iterations; iter++) {
          const start = performance.now();
          
          const promises = Array(concurrency).fill(null).map((_, i) =>
            provider.generate(`Test ${i}`, { maxTokens: 30 })
          );
          
          await Promise.all(promises);
          
          const duration = performance.now() - start;
          totalRps += (concurrency / duration) * 1000;
        }
        
        const avgRps = totalRps / iterations;
        throughputs.push({ concurrency, rps: avgRps });
      }
      
      // Check for reasonable scaling (not necessarily perfectly linear)
      const scalingFactor = throughputs[throughputs.length - 1].rps / throughputs[0].rps;
      const expectedScaling = throughputs[throughputs.length - 1].concurrency / throughputs[0].concurrency;
      
      expect(scalingFactor).toBeGreaterThan(expectedScaling * 0.5); // At least 50% efficient scaling
      
      console.log('Throughput scaling:', throughputs);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory during sustained load', async () => {
      if (global.gc) global.gc(); // Force GC if available
      
      metrics.recordMemory();
      
      // Sustained load test
      for (let i = 0; i < 50; i++) {
        await provider.generate(`Memory test iteration ${i}`, {
          maxTokens: 100
        });
        
        if (i % 10 === 0) {
          metrics.recordMemory();
          if (global.gc) global.gc();
        }
      }
      
      metrics.recordMemory();
      
      const memoryTrend = metrics.getMemoryTrend()!;
      const memoryIncreaseRate = memoryTrend.heapUsedDelta / memoryTrend.duration;
      
      // Memory should not increase more than 1KB per ms (very generous limit)
      expect(memoryIncreaseRate).toBeLessThan(1024);
      
      console.log(`Memory increase: ${(memoryTrend.heapUsedDelta / 1024 / 1024).toFixed(2)}MB over ${memoryTrend.duration}ms`);
    });

    it('should efficiently handle large responses', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Generate large responses
      const responses = await Promise.all(
        Array(10).fill(null).map(() =>
          provider.generate('Write a very detailed explanation', {
            maxTokens: 500
          })
        )
      );
      
      const peakMemory = process.memoryUsage().heapUsed;
      
      // Clear responses
      responses.length = 0;
      if (global.gc) global.gc();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const finalMemory = process.memoryUsage().heapUsed;
      
      // Memory should return close to initial after cleanup
      const memoryRetained = (finalMemory - initialMemory) / (1024 * 1024);
      
      expect(memoryRetained).toBeLessThan(50); // Less than 50MB retained
      
      console.log(`Memory retained after large responses: ${memoryRetained.toFixed(2)}MB`);
    });
  });

  describe('Provider Switching Performance', () => {
    it('should switch providers quickly', async () => {
      const switchTimes: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        await manager.setCurrentProvider(i % 2 === 0 ? 'llama-cpp' : 'ollama');
        
        const switchTime = performance.now() - start;
        switchTimes.push(switchTime);
      }
      
      const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
      
      expect(avgSwitchTime).toBeLessThan(10); // Provider switch under 10ms
      
      console.log(`Average provider switch time: ${avgSwitchTime.toFixed(2)}ms`);
    });

    it('should handle failover without significant delay', async () => {
      // Mock a failure
      const originalGenerate = provider.generate.bind(provider);
      let failCount = 0;
      
      provider.generate = async function(...args) {
        if (failCount++ < 3) {
          throw new Error('Simulated failure');
        }
        return originalGenerate(...args);
      };
      
      const start = performance.now();
      
      try {
        await manager.generate('Test failover performance', {
          maxRetries: 3
        });
      } catch (error) {
        // Expected to fail
      }
      
      const failoverTime = performance.now() - start;
      
      expect(failoverTime).toBeLessThan(5000); // Failover within 5 seconds
      
      console.log(`Failover time: ${failoverTime.toFixed(2)}ms`);
      
      // Restore original function
      provider.generate = originalGenerate;
    });
  });

  describe('CPU and Resource Usage', () => {
    it('should efficiently utilize CPU cores', async () => {
      const cpuCount = os.cpus().length;
      const optimalConcurrency = Math.min(cpuCount * 2, 16);
      
      console.log(`Testing with ${optimalConcurrency} concurrent requests (${cpuCount} CPU cores)`);
      
      const start = performance.now();
      const startCpuUsage = process.cpuUsage();
      
      const promises = Array(optimalConcurrency).fill(null).map((_, i) =>
        provider.generate(`CPU test ${i}`, { maxTokens: 50 })
      );
      
      await Promise.all(promises);
      
      const duration = performance.now() - start;
      const cpuUsage = process.cpuUsage(startCpuUsage);
      
      const cpuPercentage = ((cpuUsage.user + cpuUsage.system) / 1000 / duration) * 100;
      
      // CPU usage should be reasonable (not pegged at 100%)
      expect(cpuPercentage).toBeLessThan(90);
      
      console.log(`CPU usage: ${cpuPercentage.toFixed(2)}%`);
    });

    it('should handle backpressure gracefully', async () => {
      const requestQueue: Promise<any>[] = [];
      const maxQueueSize = 50;
      let completed = 0;
      let errors = 0;
      
      // Generate more requests than can be handled immediately
      for (let i = 0; i < maxQueueSize; i++) {
        const promise = provider.generate(`Queue test ${i}`, {
          maxTokens: 30
        }).then(() => {
          completed++;
        }).catch(() => {
          errors++;
        });
        
        requestQueue.push(promise);
        
        // Add slight delay to simulate continuous load
        if (i % 5 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      await Promise.all(requestQueue);
      
      expect(completed).toBeGreaterThan(maxQueueSize * 0.9); // At least 90% success rate
      expect(errors).toBeLessThan(maxQueueSize * 0.1); // Less than 10% errors
      
      console.log(`Backpressure test: ${completed} completed, ${errors} errors`);
    });
  });

  describe('Streaming Performance', () => {
    it('should stream responses with low latency', async () => {
      const firstTokenTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        let firstTokenReceived = false;
        
        await provider.generate('Stream this response', {
          maxTokens: 100,
          stream: true,
          onToken: (token: string) => {
            if (!firstTokenReceived) {
              firstTokenReceived = true;
              const timeToFirstToken = performance.now() - start;
              firstTokenTimes.push(timeToFirstToken);
            }
          }
        });
      }
      
      const avgTimeToFirstToken = firstTokenTimes.reduce((a, b) => a + b, 0) / firstTokenTimes.length;
      
      expect(avgTimeToFirstToken).toBeLessThan(500); // First token within 500ms
      
      console.log(`Average time to first token: ${avgTimeToFirstToken.toFixed(2)}ms`);
    });

    it('should maintain consistent streaming rate', async () => {
      const tokenIntervals: number[] = [];
      let lastTokenTime = performance.now();
      
      await provider.generate('Generate a long streaming response', {
        maxTokens: 200,
        stream: true,
        onToken: (token: string) => {
          const now = performance.now();
          const interval = now - lastTokenTime;
          if (interval > 0) {
            tokenIntervals.push(interval);
          }
          lastTokenTime = now;
        }
      });
      
      if (tokenIntervals.length > 0) {
        const avgInterval = tokenIntervals.reduce((a, b) => a + b, 0) / tokenIntervals.length;
        const variance = tokenIntervals.reduce((sum, interval) => 
          sum + Math.pow(interval - avgInterval, 2), 0
        ) / tokenIntervals.length;
        const stdDev = Math.sqrt(variance);
        
        // Standard deviation should be reasonable (not too jittery)
        expect(stdDev).toBeLessThan(avgInterval * 2);
        
        console.log(`Streaming consistency - Avg interval: ${avgInterval.toFixed(2)}ms, StdDev: ${stdDev.toFixed(2)}ms`);
      }
    });
  });

  describe('Performance Report', () => {
    it('should generate comprehensive performance report', async () => {
      const testMetrics = new PerformanceMetrics();
      
      // Run comprehensive test suite
      const testCases = [
        { name: 'small', prompt: 'Short', tokens: 30 },
        { name: 'medium', prompt: 'Medium length prompt for testing', tokens: 100 },
        { name: 'large', prompt: 'A very long prompt '.repeat(50), tokens: 200 }
      ];
      
      for (const testCase of testCases) {
        for (let i = 0; i < 10; i++) {
          const start = performance.now();
          
          const result = await provider.generate(testCase.prompt, {
            maxTokens: testCase.tokens
          });
          
          const duration = performance.now() - start;
          
          testMetrics.record(`${testCase.name}_latency`, duration);
          testMetrics.record(`${testCase.name}_tokens`, result.tokensGenerated || 0);
          
          if (result.tokensPerSecond) {
            testMetrics.record(`${testCase.name}_tps`, result.tokensPerSecond);
          }
        }
      }
      
      const report = testMetrics.generateReport();
      console.log(report);
      
      // Verify report contains expected metrics
      expect(report).toContain('small_latency');
      expect(report).toContain('medium_latency');
      expect(report).toContain('large_latency');
      expect(report).toContain('P95');
      expect(report).toContain('P99');
    });
  });
});