#!/usr/bin/env tsx
/**
 * Test script for IntelligentCacheWarmer
 * 
 * This script tests the cache warming functionality for:
 * - Grocery item caching
 * - Ollama query pattern analysis
 * - Time-based warming strategies
 * - Memory management
 */

import Redis from 'ioredis';
import { IntelligentCacheWarmer } from '../src/core/cache/IntelligentCacheWarmer.js';
import { LLMResponseCache } from '../src/core/cache/LLMResponseCache.js';
import { RedisCacheManager } from '../src/core/cache/RedisCacheManager.js';
import { logger } from '../src/utils/logger.js';
import chalk from 'chalk';

// Test configuration
const TEST_CONFIG = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0
  },
  warming: {
    enabled: true,
    memoryLimit: 50 * 1024 * 1024, // 50MB for testing
    batchSize: 5,
    concurrency: 2
  }
};

class CacheWarmerTester {
  private redis: Redis;
  private cacheManager: RedisCacheManager;
  private llmCache: LLMResponseCache;
  private cacheWarmer: IntelligentCacheWarmer;
  
  constructor() {
    // Initialize Redis
    this.redis = new Redis({
      host: TEST_CONFIG.redis.host,
      port: TEST_CONFIG.redis.port,
      db: TEST_CONFIG.redis.db
    });
    
    // Initialize cache managers
    this.cacheManager = RedisCacheManager.getInstance();
    this.llmCache = LLMResponseCache.getInstance();
    
    // Initialize cache warmer
    this.cacheWarmer = new IntelligentCacheWarmer(
      TEST_CONFIG.warming,
      this.redis,
      this.cacheManager,
      this.llmCache
    );
    
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    this.cacheWarmer.on('initialized', (data) => {
      console.log(chalk.green('✓ Cache warmer initialized'), data);
    });
    
    this.cacheWarmer.on('warming_started', (data) => {
      console.log(chalk.blue('→ Warming started'), data);
    });
    
    this.cacheWarmer.on('warming_completed', (result) => {
      console.log(chalk.green('✓ Warming completed'), result);
    });
    
    this.cacheWarmer.on('item_warmed', (data) => {
      console.log(chalk.gray(`  • Warmed: ${data.itemId} (${data.size} bytes)`));
    });
    
    this.cacheWarmer.on('warming_error', (data) => {
      console.log(chalk.red(`  ✗ Error: ${data.itemId} - ${data.error}`));
    });
  }
  
  async testOllamaQueryRecording(): Promise<void> {
    console.log(chalk.yellow('\n📊 Testing Ollama Query Recording...'));
    
    const testQueries = [
      { query: "Add milk to my grocery list", responseTime: 250, cached: false },
      { query: "What's the price of eggs?", responseTime: 180, cached: false },
      { query: "Add milk to my grocery list", responseTime: 15, cached: true }, // Repeat - cached
      { query: "Show me chicken recipes", responseTime: 320, cached: false },
      { query: "Find organic vegetables", responseTime: 290, cached: false },
      { query: "What's the price of eggs?", responseTime: 12, cached: true }, // Repeat - cached
      { query: "Compare bread prices", responseTime: 210, cached: false },
      { query: "Add bananas to cart", responseTime: 195, cached: false },
      { query: "Show me chicken recipes", responseTime: 18, cached: true }, // Repeat - cached
      { query: "What's on sale today?", responseTime: 380, cached: false }
    ];
    
    // Record queries
    for (const testQuery of testQueries) {
      this.cacheWarmer.recordOllamaQuery(
        testQuery.query,
        testQuery.responseTime,
        testQuery.cached,
        testQuery.cached ? `Cached response for: ${testQuery.query}` : undefined
      );
    }
    
    console.log(chalk.green(`✓ Recorded ${testQueries.length} Ollama queries`));
    
    // Check statistics
    const stats = this.cacheWarmer.getStatistics();
    console.log(chalk.blue('Ollama Stats:'), stats.ollamaStats);
  }
  
  async testAccessPatternRecording(): Promise<void> {
    console.log(chalk.yellow('\n📊 Testing Access Pattern Recording...'));
    
    const accessPatterns = [
      { itemId: 'grocery:milk', loadTime: 45, hit: true, metadata: { category: 'dairy' } },
      { itemId: 'grocery:bread', loadTime: 38, hit: true, metadata: { category: 'bakery' } },
      { itemId: 'grocery:eggs', loadTime: 120, hit: false, metadata: { category: 'dairy' } },
      { itemId: 'grocery:chicken', loadTime: 95, hit: false, metadata: { category: 'meat' } },
      { itemId: 'grocery:milk', loadTime: 12, hit: true, metadata: { category: 'dairy' } },
      { itemId: 'grocery:bananas', loadTime: 52, hit: true, metadata: { category: 'produce' } },
      { itemId: 'ollama:query_abc123', loadTime: 280, hit: false },
      { itemId: 'grocery:bread', loadTime: 15, hit: true, metadata: { category: 'bakery' } },
      { itemId: 'grocery:cheese', loadTime: 88, hit: false, metadata: { category: 'dairy' } },
      { itemId: 'ollama:query_abc123', loadTime: 22, hit: true }
    ];
    
    // Record access patterns
    for (const pattern of accessPatterns) {
      this.cacheWarmer.recordAccess(
        pattern.itemId,
        pattern.loadTime,
        pattern.hit,
        pattern.metadata
      );
    }
    
    console.log(chalk.green(`✓ Recorded ${accessPatterns.length} access patterns`));
    
    // Check statistics
    const stats = this.cacheWarmer.getStatistics();
    console.log(chalk.blue('Top Items:'));
    stats.topItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.itemId} - Score: ${item.score.toFixed(3)}, Accesses: ${item.accessCount}`);
    });
  }
  
  async testGroceryCategoryWarming(): Promise<void> {
    console.log(chalk.yellow('\n🛒 Testing Grocery Category Warming...'));
    
    const categories = ['dairy', 'breakfast', 'dinner'];
    
    for (const category of categories) {
      console.log(chalk.blue(`\nWarming category: ${category}`));
      const result = await this.cacheWarmer.warmGroceryCategory(category);
      
      console.log(chalk.green('Result:'), {
        warmed: result.warmedItems,
        failed: result.failedItems,
        duration: `${result.duration}ms`,
        memory: `${(result.memoryUsed / 1024).toFixed(2)} KB`
      });
    }
  }
  
  async testCommonNLPWarming(): Promise<void> {
    console.log(chalk.yellow('\n💬 Testing Common NLP Query Warming...'));
    
    const result = await this.cacheWarmer.warmCommonNLPQueries();
    
    console.log(chalk.green('NLP Warming Result:'), {
      total: result.totalCandidates,
      warmed: result.warmedItems,
      failed: result.failedItems,
      duration: `${result.duration}ms`,
      memory: `${(result.memoryUsed / 1024).toFixed(2)} KB`
    });
  }
  
  async testAutoWarming(): Promise<void> {
    console.log(chalk.yellow('\n🔄 Testing Auto Warming...'));
    
    // Trigger auto warming
    const result = await this.cacheWarmer.warmCache('auto');
    
    console.log(chalk.green('Auto Warming Result:'), {
      total: result.totalCandidates,
      warmed: result.warmedItems,
      failed: result.failedItems,
      duration: `${result.duration}ms`,
      memory: `${(result.memoryUsed / 1024).toFixed(2)} KB`,
      errors: result.errors
    });
  }
  
  async testMemoryManagement(): Promise<void> {
    console.log(chalk.yellow('\n💾 Testing Memory Management...'));
    
    const stats = this.cacheWarmer.getStatistics();
    console.log(chalk.blue('Memory Usage:'), {
      current: `${(stats.memoryUsage / 1024).toFixed(2)} KB`,
      limit: `${(TEST_CONFIG.warming.memoryLimit / 1024 / 1024).toFixed(2)} MB`,
      percentage: `${((stats.memoryUsage / TEST_CONFIG.warming.memoryLimit) * 100).toFixed(2)}%`
    });
    
    // Test force warming specific items
    const itemsToWarm = [
      'grocery:milk',
      'grocery:bread',
      'grocery:eggs',
      'ollama:test_query_1',
      'ollama:test_query_2'
    ];
    
    console.log(chalk.blue('\nForce warming specific items...'));
    const result = await this.cacheWarmer.forceWarm(itemsToWarm);
    
    console.log(chalk.green('Force Warming Result:'), {
      requested: itemsToWarm.length,
      warmed: result.warmedItems,
      failed: result.failedItems,
      duration: `${result.duration}ms`
    });
  }
  
  async testTimeBasedWarming(): Promise<void> {
    console.log(chalk.yellow('\n⏰ Testing Time-Based Warming...'));
    
    const currentHour = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    
    console.log(chalk.blue('Current Time Context:'), {
      hour: currentHour,
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isMorning: currentHour >= 6 && currentHour <= 10,
      isLunch: currentHour >= 11 && currentHour <= 14,
      isDinner: currentHour >= 16 && currentHour <= 19
    });
    
    // The warmer will automatically select items based on current time
    const result = await this.cacheWarmer.warmCache('auto');
    
    console.log(chalk.green('Time-Based Warming Applied:'), {
      itemsWarmed: result.warmedItems,
      strategy: result.strategy
    });
  }
  
  async runAllTests(): Promise<void> {
    console.log(chalk.bold.cyan('\n🚀 Starting Cache Warmer Tests\n'));
    console.log(chalk.gray('═'.repeat(50)));
    
    try {
      // Run tests in sequence
      await this.testOllamaQueryRecording();
      await this.testAccessPatternRecording();
      await this.testGroceryCategoryWarming();
      await this.testCommonNLPWarming();
      await this.testAutoWarming();
      await this.testMemoryManagement();
      await this.testTimeBasedWarming();
      
      // Final statistics
      console.log(chalk.gray('\n' + '═'.repeat(50)));
      console.log(chalk.bold.cyan('\n📈 Final Statistics\n'));
      
      const finalStats = this.cacheWarmer.getStatistics();
      console.log(chalk.green('Overall Stats:'), {
        patternsTracked: finalStats.patternsTracked,
        memoryUsage: `${(finalStats.memoryUsage / 1024 / 1024).toFixed(2)} MB`,
        isWarming: finalStats.isWarming,
        lastWarmingRun: finalStats.lastWarmingRun
      });
      
      console.log(chalk.green('\nOllama Stats:'), finalStats.ollamaStats);
      console.log(chalk.green('\nGrocery Stats:'), finalStats.groceryStats);
      
      console.log(chalk.bold.green('\n✅ All tests completed successfully!\n'));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Test failed:'), error);
      throw error;
    }
  }
  
  async cleanup(): Promise<void> {
    console.log(chalk.yellow('\n🧹 Cleaning up...'));
    
    // Clear cache
    this.cacheWarmer.clearCache();
    
    // Shutdown
    await this.cacheWarmer.shutdown();
    await this.redis.quit();
    
    console.log(chalk.green('✓ Cleanup completed'));
  }
}

// Run tests
async function main() {
  const tester = new CacheWarmerTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  } finally {
    await tester.cleanup();
    process.exit(0);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CacheWarmerTester };