#!/usr/bin/env node
/**
 * Product Matching Algorithm Performance Benchmark
 * 
 * Compares the performance of the original and optimized algorithms
 * Measures:
 * - Speed improvements
 * - Cache hit rates
 * - Accuracy metrics
 * - Memory usage
 * - Batch processing capabilities
 */

import { performance } from 'perf_hooks';
import { ProductMatchingAlgorithm } from '../api/services/ProductMatchingAlgorithm.js';
import { OptimizedProductMatchingAlgorithm } from '../api/services/OptimizedProductMatchingAlgorithm.js';
import { logger } from '../utils/logger.js';
import type { SmartMatchingOptions } from '../api/services/SmartMatchingService.js';

interface BenchmarkResult {
  algorithm: string;
  totalTime: number;
  avgTimePerMatch: number;
  minTime: number;
  maxTime: number;
  cacheHitRate?: number;
  memoryUsed: number;
  accuracyScore: number;
}

interface TestCase {
  query: string;
  products: string[];
  expectedBestMatch: string;
  expectedMinScore: number;
}

class ProductMatchingBenchmark {
  private originalAlgorithm: ProductMatchingAlgorithm;
  private optimizedAlgorithm: OptimizedProductMatchingAlgorithm;
  private testCases: TestCase[];
  
  constructor() {
    this.originalAlgorithm = ProductMatchingAlgorithm.getInstance();
    this.optimizedAlgorithm = OptimizedProductMatchingAlgorithm.getOptimizedInstance();
    this.testCases = this.generateTestCases();
  }
  
  /**
   * Generate comprehensive test cases
   */
  private generateTestCases(): TestCase[] {
    return [
      // Exact matches
      {
        query: "Great Value Whole Milk",
        products: [
          "Great Value Whole Milk 1 Gallon",
          "Great Value 2% Milk 1 Gallon",
          "Horizon Organic Whole Milk",
          "Store Brand Whole Milk"
        ],
        expectedBestMatch: "Great Value Whole Milk 1 Gallon",
        expectedMinScore: 0.9
      },
      
      // Misspellings
      {
        query: "chiken brest",
        products: [
          "Tyson Chicken Breast 2lb",
          "Great Value Chicken Thighs",
          "Perdue Chicken Wings",
          "Beef Steak"
        ],
        expectedBestMatch: "Tyson Chicken Breast 2lb",
        expectedMinScore: 0.7
      },
      
      // Brand variations
      {
        query: "coca cola",
        products: [
          "Coca-Cola Classic 12 Pack",
          "Coke Zero Sugar 2L",
          "Pepsi Cola 12 Pack",
          "Dr Pepper 12 Pack"
        ],
        expectedBestMatch: "Coca-Cola Classic 12 Pack",
        expectedMinScore: 0.8
      },
      
      // Size variations
      {
        query: "eggs dozen",
        products: [
          "Great Value Large Eggs 12 ct",
          "Eggland's Best Eggs 18 ct",
          "Great Value Large Eggs 6 ct",
          "Organic Free Range Eggs 12 ct"
        ],
        expectedBestMatch: "Great Value Large Eggs 12 ct",
        expectedMinScore: 0.75
      },
      
      // Category matching
      {
        query: "breakfast cereal",
        products: [
          "Kellogg's Corn Flakes",
          "General Mills Cheerios",
          "Quaker Oats",
          "Wonder Bread"
        ],
        expectedBestMatch: "Kellogg's Corn Flakes",
        expectedMinScore: 0.6
      },
      
      // Complex queries
      {
        query: "organic gluten free pasta",
        products: [
          "Barilla Gluten Free Pasta",
          "Ancient Harvest Organic Quinoa Pasta",
          "Great Value Regular Pasta",
          "Organic Brown Rice"
        ],
        expectedBestMatch: "Ancient Harvest Organic Quinoa Pasta",
        expectedMinScore: 0.7
      },
      
      // Abbreviations
      {
        query: "gv milk",
        products: [
          "Great Value Whole Milk",
          "Great Value 2% Milk",
          "Generic Milk",
          "Horizon Milk"
        ],
        expectedBestMatch: "Great Value Whole Milk",
        expectedMinScore: 0.75
      },
      
      // Multiple words
      {
        query: "low fat greek yogurt vanilla",
        products: [
          "Chobani Low-Fat Greek Yogurt Vanilla",
          "Yoplait Greek Yogurt Strawberry",
          "Great Value Greek Yogurt Plain",
          "Dannon Vanilla Yogurt"
        ],
        expectedBestMatch: "Chobani Low-Fat Greek Yogurt Vanilla",
        expectedMinScore: 0.85
      }
    ];
  }
  
  /**
   * Run benchmark for single algorithm
   */
  private async benchmarkAlgorithm(
    algorithm: ProductMatchingAlgorithm | OptimizedProductMatchingAlgorithm,
    name: string
  ): Promise<BenchmarkResult> {
    const startMemory = process.memoryUsage().heapUsed;
    const startTime = performance.now();
    const times: number[] = [];
    let correctMatches = 0;
    let totalScore = 0;
    
    // Run through all test cases
    for (const testCase of this.testCases) {
      const matchStartTime = performance.now();
      let bestMatch = '';
      let bestScore = 0;
      
      // Find best matching product
      for (const product of testCase.products) {
        const score = await algorithm.calculateSimilarity(testCase.query, product);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }
      
      const matchTime = performance.now() - matchStartTime;
      times.push(matchTime);
      
      // Check accuracy
      if (bestMatch === testCase.expectedBestMatch) {
        correctMatches++;
      }
      
      if (bestScore >= testCase.expectedMinScore) {
        totalScore += 1;
      }
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    // Calculate statistics
    const totalTime = endTime - startTime;
    const avgTime = times.reduce((a: any, b: any) => a + b, 0) / times?.length || 0;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const memoryUsed = (endMemory - startMemory) / 1024 / 1024; // MB
    const accuracyScore = (correctMatches / this?.testCases?.length) * 0.5 + 
                         (totalScore / this?.testCases?.length) * 0.5;
    
    // Get cache hit rate if available (for optimized algorithm)
    let cacheHitRate: number | undefined;
    if ('getPerformanceStats' in algorithm) {
      const stats = (algorithm as OptimizedProductMatchingAlgorithm).getPerformanceStats();
      cacheHitRate = stats.cacheHitRate;
    }
    
    return {
      algorithm: name,
      totalTime,
      avgTimePerMatch: avgTime,
      minTime,
      maxTime,
      cacheHitRate,
      memoryUsed,
      accuracyScore
    };
  }
  
  /**
   * Run batch processing benchmark (optimized algorithm only)
   */
  private async benchmarkBatchProcessing(): Promise<void> {
    console.log('\n=== Batch Processing Benchmark ===\n');
    
    const queries = this?.testCases?.map(tc => tc.query);
    const allProducts = [...new Set(this?.testCases?.flatMap(tc => tc.products))];
    
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    const batchResult = await this?.optimizedAlgorithm?.processBatch({
      queries,
      products: allProducts
    });
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    console.log('Batch Processing Results:');
    console.log(`  Total Time: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`  Queries Processed: ${queries?.length || 0}`);
    console.log(`  Products Compared: ${allProducts?.length || 0}`);
    console.log(`  Total Comparisons: ${queries?.length || 0 * allProducts?.length || 0}`);
    console.log(`  Cache Hit Rate: ${(batchResult.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`  Memory Used: ${((endMemory - startMemory) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Avg Time per Comparison: ${(batchResult.executionTime / (queries?.length || 0 * allProducts?.length || 0)).toFixed(2)}ms`);
  }
  
  /**
   * Test cache warming effectiveness
   */
  private async testCacheWarming(): Promise<void> {
    console.log('\n=== Cache Warming Test ===\n');
    
    // Clear caches first
    await this?.optimizedAlgorithm?.clearCaches();
    
    // First run - cold cache
    const coldStart = performance.now();
    for (const testCase of this?.testCases?.slice(0, 3)) {
      for (const product of testCase.products) {
        await this?.optimizedAlgorithm?.calculateSimilarity(testCase.query, product);
      }
    }
    const coldTime = performance.now() - coldStart;
    
    // Second run - warm cache
    const warmStart = performance.now();
    for (const testCase of this?.testCases?.slice(0, 3)) {
      for (const product of testCase.products) {
        await this?.optimizedAlgorithm?.calculateSimilarity(testCase.query, product);
      }
    }
    const warmTime = performance.now() - warmStart;
    
    const stats = this?.optimizedAlgorithm?.getPerformanceStats();
    
    console.log('Cache Warming Results:');
    console.log(`  Cold Cache Time: ${coldTime.toFixed(2)}ms`);
    console.log(`  Warm Cache Time: ${warmTime.toFixed(2)}ms`);
    console.log(`  Speed Improvement: ${((1 - warmTime/coldTime) * 100).toFixed(2)}%`);
    console.log(`  Final Cache Hit Rate: ${(stats.cacheHitRate * 100).toFixed(2)}%`);
    console.log(`  Cache Size: ${stats.cacheSize} entries`);
  }
  
  /**
   * Test accuracy with misspellings
   */
  private async testMisspellingHandling(): Promise<void> {
    console.log('\n=== Misspelling Handling Test ===\n');
    
    const misspellingTests = [
      { query: 'chese', expected: 'cheese' },
      { query: 'chiken', expected: 'chicken' },
      { query: 'yoghurt', expected: 'yogurt' },
      { query: 'spagetti', expected: 'spaghetti' },
      { query: 'tomatoe', expected: 'tomato' }
    ];
    
    const products = [
      'Kraft Cheese Slices',
      'Tyson Chicken Breast',
      'Chobani Greek Yogurt',
      'Barilla Spaghetti',
      'Fresh Tomatoes'
    ];
    
    console.log('Original Algorithm:');
    let originalCorrect = 0;
    for (const test of misspellingTests) {
      let bestMatch = '';
      let bestScore = 0;
      
      for (const product of products) {
        const score = await this?.originalAlgorithm?.calculateSimilarity(test.query, product);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }
      
      const isCorrect = bestMatch.toLowerCase().includes(test.expected);
      if (isCorrect) originalCorrect++;
      console.log(`  ${test.query} -> ${bestMatch} (${bestScore.toFixed(3)}) ${isCorrect ? '✓' : '✗'}`);
    }
    
    console.log('\nOptimized Algorithm:');
    let optimizedCorrect = 0;
    for (const test of misspellingTests) {
      let bestMatch = '';
      let bestScore = 0;
      
      for (const product of products) {
        const score = await this?.optimizedAlgorithm?.calculateSimilarity(test.query, product);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = product;
        }
      }
      
      const isCorrect = bestMatch.toLowerCase().includes(test.expected);
      if (isCorrect) optimizedCorrect++;
      console.log(`  ${test.query} -> ${bestMatch} (${bestScore.toFixed(3)}) ${isCorrect ? '✓' : '✗'}`);
    }
    
    console.log('\nAccuracy Comparison:');
    console.log(`  Original: ${originalCorrect}/${misspellingTests?.length || 0} (${(originalCorrect/misspellingTests?.length || 0 * 100).toFixed(0)}%)`);
    console.log(`  Optimized: ${optimizedCorrect}/${misspellingTests?.length || 0} (${(optimizedCorrect/misspellingTests?.length || 0 * 100).toFixed(0)}%)`);
  }
  
  /**
   * Run all benchmarks
   */
  async runBenchmarks(): Promise<void> {
    console.log('========================================');
    console.log('Product Matching Algorithm Benchmark');
    console.log('========================================\n');
    
    // Warm up both algorithms
    console.log('Warming up algorithms...\n');
    for (let i = 0; i < 5; i++) {
      await this?.originalAlgorithm?.calculateSimilarity('test', 'test product');
      await this?.optimizedAlgorithm?.calculateSimilarity('test', 'test product');
    }
    
    // Run main benchmarks
    console.log('=== Performance Comparison ===\n');
    
    const originalResult = await this.benchmarkAlgorithm(
      this.originalAlgorithm,
      'Original Algorithm'
    );
    
    const optimizedResult = await this.benchmarkAlgorithm(
      this.optimizedAlgorithm,
      'Optimized Algorithm'
    );
    
    // Display results
    this.displayResults(originalResult, optimizedResult);
    
    // Run additional tests
    await this.benchmarkBatchProcessing();
    await this.testCacheWarming();
    await this.testMisspellingHandling();
    
    // Summary
    this.displaySummary(originalResult, optimizedResult);
  }
  
  /**
   * Display benchmark results
   */
  private displayResults(original: BenchmarkResult, optimized: BenchmarkResult): void {
    console.log('Original Algorithm:');
    console.log(`  Total Time: ${original?.totalTime?.toFixed(2)}ms`);
    console.log(`  Avg Time per Match: ${original?.avgTimePerMatch?.toFixed(2)}ms`);
    console.log(`  Min/Max Time: ${original?.minTime?.toFixed(2)}ms / ${original?.maxTime?.toFixed(2)}ms`);
    console.log(`  Memory Used: ${original?.memoryUsed?.toFixed(2)}MB`);
    console.log(`  Accuracy Score: ${(original.accuracyScore * 100).toFixed(2)}%`);
    
    console.log('\nOptimized Algorithm:');
    console.log(`  Total Time: ${optimized?.totalTime?.toFixed(2)}ms`);
    console.log(`  Avg Time per Match: ${optimized?.avgTimePerMatch?.toFixed(2)}ms`);
    console.log(`  Min/Max Time: ${optimized?.minTime?.toFixed(2)}ms / ${optimized?.maxTime?.toFixed(2)}ms`);
    console.log(`  Memory Used: ${optimized?.memoryUsed?.toFixed(2)}MB`);
    console.log(`  Accuracy Score: ${(optimized.accuracyScore * 100).toFixed(2)}%`);
    if (optimized.cacheHitRate !== undefined) {
      console.log(`  Cache Hit Rate: ${(optimized.cacheHitRate * 100).toFixed(2)}%`);
    }
    
    console.log('\nImprovement Metrics:');
    const speedImprovement = ((original.totalTime - optimized.totalTime) / original.totalTime) * 100;
    const memoryDiff = optimized.memoryUsed - original.memoryUsed;
    const accuracyDiff = (optimized.accuracyScore - original.accuracyScore) * 100;
    
    console.log(`  Speed Improvement: ${speedImprovement.toFixed(2)}% ${speedImprovement > 0 ? '✓' : '✗'}`);
    console.log(`  Memory Difference: ${memoryDiff > 0 ? '+' : ''}${memoryDiff.toFixed(2)}MB`);
    console.log(`  Accuracy Difference: ${accuracyDiff > 0 ? '+' : ''}${accuracyDiff.toFixed(2)}%`);
  }
  
  /**
   * Display final summary
   */
  private displaySummary(original: BenchmarkResult, optimized: BenchmarkResult): void {
    console.log('\n========================================');
    console.log('BENCHMARK SUMMARY');
    console.log('========================================\n');
    
    const speedup = original.avgTimePerMatch / optimized.avgTimePerMatch;
    const stats = this?.optimizedAlgorithm?.getPerformanceStats();
    
    console.log('Key Performance Indicators:');
    console.log(`  ✓ Speed: ${speedup.toFixed(2)}x faster`);
    console.log(`  ✓ Cache Efficiency: ${(stats.cacheHitRate * 100).toFixed(2)}% hit rate`);
    console.log(`  ✓ Accuracy: ${(optimized.accuracyScore * 100).toFixed(2)}%`);
    console.log(`  ✓ Avg Response Time: ${optimized?.avgTimePerMatch?.toFixed(2)}ms`);
    
    console.log('\nOptimization Benefits:');
    console.log('  ✓ Multi-layer caching (Redis + LRU)');
    console.log('  ✓ Memoization for expensive calculations');
    console.log('  ✓ Batch processing capabilities');
    console.log('  ✓ Spell correction and synonym handling');
    console.log('  ✓ ML-based adaptive scoring');
    console.log('  ✓ Phonetic matching for fuzzy search');
    
    console.log('\nRecommendations:');
    if (speedup > 2) {
      console.log('  ★ Optimized algorithm shows significant performance gains');
      console.log('  ★ Recommended for production use');
    }
    if (stats.cacheHitRate > 0.5) {
      console.log('  ★ Cache strategy is highly effective');
      console.log('  ★ Consider increasing cache size for better performance');
    }
    if (optimized.accuracyScore > original.accuracyScore) {
      console.log('  ★ Accuracy improvements validate optimization approach');
    }
    
    console.log('\n========================================\n');
  }
}

// Run benchmarks
async function main() {
  try {
    const benchmark = new ProductMatchingBenchmark();
    await benchmark.runBenchmarks();
    
    logger.info('Benchmark completed successfully', 'BENCHMARK');
    process.exit(0);
  } catch (error) {
    logger.error('Benchmark failed', 'BENCHMARK', { error });
    console.error('Benchmark failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { ProductMatchingBenchmark };