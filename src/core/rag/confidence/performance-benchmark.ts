#!/usr/bin/env tsx
/**
 * Performance Benchmark for Confidence-Scored RAG System
 * Measures the impact of performance optimizations
 */

import { PerformanceOptimizer } from './PerformanceOptimizer';
import { QueryComplexityAnalyzer } from './QueryComplexityAnalyzer';
import { logger } from '../../../utils/logger';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  operation: string;
  withOptimization: number;
  withoutOptimization: number;
  improvement: number;
  improvementPercent: string;
}

class PerformanceBenchmark {
  private optimizer: PerformanceOptimizer;
  private analyzer: QueryComplexityAnalyzer;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.optimizer = new PerformanceOptimizer({
      enableCache: true,
      enableBatching: true,
      enableModelSwitching: true
    });
    this.analyzer = new QueryComplexityAnalyzer();
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks() {
    logger.info('Starting performance benchmarks', 'BENCHMARK');

    await this.benchmarkQueryComplexityAnalysis();
    await this.benchmarkCachedOperations();
    await this.benchmarkBatchProcessing();
    await this.benchmarkModelSwitching();

    this.printResults();
  }

  /**
   * Benchmark query complexity analysis with caching
   */
  async benchmarkQueryComplexityAnalysis() {
    const queries = [
      "What is the weather today?",
      "Explain the theory of relativity and its implications for modern physics",
      "How do I create a REST API with authentication in Node.js?",
      "What are the best practices for microservices architecture?",
      "Compare quantum computing with classical computing"
    ];

    // Without optimization (no cache)
    const startWithout = performance.now();
    for (let i = 0; i < 100; i++) {
      for (const query of queries) {
        this.analyzer.assessComplexity(query);
      }
    }
    const timeWithout = performance.now() - startWithout;

    // With optimization (cached)
    const startWith = performance.now();
    for (let i = 0; i < 100; i++) {
      for (const query of queries) {
        await this.optimizer.withCache(
          `complexity:${query}`,
          async () => this.analyzer.assessComplexity(query)
        );
      }
    }
    const timeWith = performance.now() - startWith;

    this.addResult('Query Complexity Analysis (500 calls)', timeWith, timeWithout);
  }

  /**
   * Benchmark cached operations
   */
  async benchmarkCachedOperations() {
    const expensiveOperation = async () => {
      // Simulate expensive computation
      let result = 0;
      for (let i = 0; i < 1000000; i++) {
        result += Math.sqrt(i);
      }
      return result;
    };

    // Without cache
    const startWithout = performance.now();
    for (let i = 0; i < 10; i++) {
      await expensiveOperation();
    }
    const timeWithout = performance.now() - startWithout;

    // With cache
    const startWith = performance.now();
    for (let i = 0; i < 10; i++) {
      await this.optimizer.withCache('expensive-op', expensiveOperation);
    }
    const timeWith = performance.now() - startWith;

    this.addResult('Expensive Operation (10 calls)', timeWith, timeWithout);
  }

  /**
   * Benchmark batch processing
   */
  async benchmarkBatchProcessing() {
    const processItem = async (items: number[]): Promise<number[]> => {
      // Simulate API call or heavy processing
      await new Promise(resolve => setTimeout(resolve, 10));
      return items.map(i => i * 2);
    };

    // Without batching
    const startWithout = performance.now();
    const resultsWithout: number[] = [];
    for (let i = 0; i < 20; i++) {
      const [result] = await processItem([i]);
      resultsWithout.push(result);
    }
    const timeWithout = performance.now() - startWithout;

    // With batching
    const startWith = performance.now();
    const promises: Promise<number>[] = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        this.optimizer.withBatching('batch-test', i, processItem)
      );
    }
    await Promise.all(promises);
    const timeWith = performance.now() - startWith;

    this.addResult('Batch Processing (20 items)', timeWith, timeWithout);
  }

  /**
   * Benchmark model switching
   */
  async benchmarkModelSwitching() {
    const complexities = [1, 3, 5, 7, 9, 2, 4, 6, 8, 10];
    const modelSwitchTime = 50; // Simulated model switch overhead

    // Without smart switching (always use large model)
    const startWithout = performance.now();
    const switchesWithout = 0;
    let currentModel = 'qwen3:14b';
    for (const complexity of complexities) {
      // Simulate processing with large model
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const timeWithout = performance.now() - startWithout;

    // With smart switching
    const startWith = performance.now();
    let switchesWith = 0;
    currentModel = '';
    for (const complexity of complexities) {
      const suggestedModel = this.optimizer.suggestModel(complexity);
      if (suggestedModel !== currentModel) {
        currentModel = suggestedModel;
        switchesWith++;
        await new Promise(resolve => setTimeout(resolve, modelSwitchTime));
      }
      // Simulate processing with appropriate model
      const processingTime = suggestedModel === 'qwen2.5:0.5b' ? 30 :
                             suggestedModel === 'qwen3:8b' ? 60 : 100;
      await new Promise(resolve => setTimeout(resolve, processingTime));
    }
    const timeWith = performance.now() - startWith;

    this.addResult('Model Switching (10 queries)', timeWith, timeWithout);
    logger.info('Model switches', 'BENCHMARK', { 
      withOptimization: switchesWith, 
      withoutOptimization: 0 
    });
  }

  /**
   * Add benchmark result
   */
  private addResult(operation: string, withOpt: number, withoutOpt: number) {
    const improvement = withoutOpt - withOpt;
    const improvementPercent = ((improvement / withoutOpt) * 100).toFixed(1);
    
    this.results.push({
      operation,
      withOptimization: withOpt,
      withoutOptimization: withoutOpt,
      improvement,
      improvementPercent: `${improvementPercent}%`
    });
  }

  /**
   * Print formatted results
   */
  private printResults() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              Performance Benchmark Results                            ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');
    console.log('║ Operation                        │ Without │   With  │ Improvement   ║');
    console.log('╠══════════════════════════════════════════════════════════════════════╣');

    for (const result of this.results) {
      const op = result.operation.padEnd(32);
      const without = `${result.withoutOptimization.toFixed(0)}ms`.padStart(7);
      const withOpt = `${result.withOptimization.toFixed(0)}ms`.padStart(7);
      const imp = `${result.improvementPercent}`.padStart(10);
      
      console.log(`║ ${op} │ ${without} │ ${withOpt} │ ${imp}    ║`);
    }

    console.log('╚══════════════════════════════════════════════════════════════════════╝');

    // Summary statistics
    const totalImprovement = this.results.reduce((sum, r) => sum + r.improvement, 0);
    const avgImprovement = totalImprovement / this.results.length;
    const avgPercent = this.results.reduce((sum, r) => 
      sum + parseFloat(r.improvementPercent), 0) / this.results.length;

    console.log('\n📊 Summary:');
    console.log(`   Average time saved: ${avgImprovement.toFixed(0)}ms`);
    console.log(`   Average improvement: ${avgPercent.toFixed(1)}%`);

    // Resource metrics
    this.optimizer.getStatistics().then(stats => {
      console.log('\n📈 Resource Usage:');
      console.log(`   Cache hit rate: ${(stats.cache.hitRate * 100).toFixed(1)}%`);
      console.log(`   Cache size: ${stats.cache.size}/${stats.cache.maxSize}`);
      console.log(`   CPU usage: ${(stats.resources.cpu * 100).toFixed(1)}%`);
      console.log(`   Memory usage: ${(stats.resources.memory * 100).toFixed(1)}%`);
    });
  }
}

// Run benchmarks if called directly
if (require.main === module) {
  const benchmark = new PerformanceBenchmark();
  benchmark.runAllBenchmarks().catch(error => {
    logger.error('Benchmark failed', 'BENCHMARK', {}, error as Error);
    process.exit(1);
  });
}