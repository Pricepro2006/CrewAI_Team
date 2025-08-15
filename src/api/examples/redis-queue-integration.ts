#!/usr/bin/env tsx

/**
 * Redis Message Queue Integration Example
 * 
 * Complete setup and demonstration of the Redis-based message queue
 * system for async grocery data processing.
 */

import type { Express } from 'express';
import { RedisMessageQueue } from '../services/RedisMessageQueue.js';
import { GroceryDataPipeline } from '../services/GroceryDataPipeline.js';
import { UnifiedCacheManager } from '../services/UnifiedCacheManager.js';
import { GroceryQueueRouter } from '../routes/grocery-queue.router.js';

/**
 * Complete Redis Queue System Setup
 */
export async function setupRedisQueueSystem(app?: Express): Promise<{
  messageQueue: RedisMessageQueue;
  groceryPipeline: GroceryDataPipeline;
  cacheManager: UnifiedCacheManager;
  router: GroceryQueueRouter;
}> {
  console.log('🚀 Initializing Redis Message Queue System...');

  // 1. Initialize Redis Message Queue
  const messageQueue = new RedisMessageQueue({
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_QUEUE_DB || '1'), // Separate DB for queues
      keyPrefix: 'grocery_queue:',
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableOfflineQueue: false
    },
    queues: {
      defaultTtl: 86400, // 24 hours
      maxLength: 50000, // Larger queue for grocery data
      trimStrategy: 'MAXLEN', // Required property for queue management
      retryLimit: 5,
      retryBackoff: 'exponential',
      deadLetterQueue: true
    },
    processing: {
      batchSize: 25, // Optimized for grocery data
      concurrency: 8, // Higher concurrency for grocery processing
      processingTimeout: 45000, // 45 seconds for complex operations
      idleTimeout: 2000, // 2 seconds idle time
      blockTimeout: 1000 // 1 second block timeout
    }
  });

  // 2. Initialize Unified Cache Manager (reuse from previous setup)
  const cacheManager = new UnifiedCacheManager({
    cache: {
      memory: {
        maxSize: 75000, // Increased for grocery data
        ttl: 300
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        ttl: 3600
      },
      sqlite: {
        path: './data/grocery_cache.db',
        ttl: 86400
      }
    },
    integration: {
      enablePricingCache: true,
      enableListCache: true,
      warmOnStartup: false,
      invalidationStrategy: 'immediate'
    },
    monitoring: {
      enableMetrics: true,
      metricsInterval: 30000, // More frequent monitoring
      healthCheckInterval: 15000
    }
  });

  // 3. Initialize Grocery Data Pipeline
  const groceryPipeline = new GroceryDataPipeline(messageQueue, cacheManager, {
    queues: {
      priceUpdates: 'grocery_price_updates',
      inventorySync: 'grocery_inventory_sync',
      productMatching: 'grocery_product_matching',
      dealAnalysis: 'grocery_deal_analysis',
      nutritionFetch: 'grocery_nutrition_fetch',
      reviewAnalysis: 'grocery_review_analysis',
      recommendations: 'grocery_recommendations'
    },
    processing: {
      batchSize: 25,
      concurrency: 6, // Conservative concurrency for stable processing
      enableCaching: true,
      cacheInvalidation: true,
      dependencyProcessing: true,
      deadLetterRetention: 604800 // 7 days
    },
    integrations: {
      walmartApi: true,
      nutritionApi: true,
      reviewSentiment: true,
      priceComparison: true
    }
  });

  // 4. Set up event monitoring
  setupEventMonitoring(messageQueue, groceryPipeline, cacheManager);

  // 5. Initialize all systems
  await messageQueue.connect();
  await cacheManager.initialize();

  console.log('✅ Redis queue system initialized successfully');

  // 6. Create API router
  const router = new GroceryQueueRouter({
    groceryPipeline,
    messageQueue
  });

  // 7. Mount API endpoints if Express app provided
  if (app) {
    app.use('/api/grocery-queue', router.getRouter());
    console.log('🌐 Grocery queue API endpoints mounted at /api/grocery-queue');
  }

  return {
    messageQueue,
    groceryPipeline,
    cacheManager,
    router
  };
}

/**
 * Event Monitoring Setup
 */
function setupEventMonitoring(
  messageQueue: RedisMessageQueue,
  groceryPipeline: GroceryDataPipeline,
  cacheManager: UnifiedCacheManager
): void {
  console.log('📊 Setting up event monitoring...');

  // Message Queue Events
  messageQueue.on('connected', () => {
    console.log('🔗 Redis message queue connected');
  });

  messageQueue.on('message:enqueued', (data: any) => {
    console.log(`📤 Job enqueued: ${data.messageId} [${data.type}] in ${data.queueName}`);
  });

  messageQueue.on('message:completed', (data: any) => {
    console.log(`✅ Job completed: ${data.messageId} (${data.processingTime}ms)`);
  });

  messageQueue.on('message:error', (data: any) => {
    console.error(`❌ Job error: ${data.messageId} - ${data.error?.message || 'Unknown error'}`);
  });

  messageQueue.on('message:retry', (data: any) => {
    console.warn(`🔄 Job retry: ${data.messageId} (attempt ${data.retryCount})`);
  });

  messageQueue.on('message:dead_letter', (data: any) => {
    console.error(`💀 Job moved to dead letter queue: ${data.messageId} - ${data.error}`);
  });

  // Grocery Pipeline Events
  groceryPipeline.on('pipeline:started', () => {
    console.log('🚀 Grocery processing pipeline started');
  });

  groceryPipeline.on('pipeline:stopped', () => {
    console.log('🛑 Grocery processing pipeline stopped');
  });

  groceryPipeline.on('price:updated', (data: any) => {
    console.log(`💰 Price updated: ${data?.result?.productId} in ${data?.result?.storeId} (${data?.result?.priceChange})`);
  });

  groceryPipeline.on('inventory:updated', (data: any) => {
    console.log(`📦 Inventory updated: ${data?.result?.productId} - ${data?.result?.inStock ? 'In Stock' : 'Out of Stock'}`);
  });

  groceryPipeline.on('product:matched', (data: any) => {
    console.log(`🔗 Product matched: confidence ${(data?.result?.confidence * 100).toFixed(1)}%`);
  });

  groceryPipeline.on('deal:analyzed', (data: any) => {
    console.log(`🎯 Deal analyzed: quality ${(data?.result?.quality * 100).toFixed(1)}%`);
  });

  groceryPipeline.on('nutrition:fetched', (data: any) => {
    console.log(`🥗 Nutrition data fetched: ${data?.result?.productId}`);
  });

  groceryPipeline.on('reviews:analyzed', (data: any) => {
    console.log(`⭐ Reviews analyzed: ${data?.result?.overallSentiment} sentiment`);
  });

  groceryPipeline.on('recommendations:generated', (data: any) => {
    console.log(`🎁 Recommendations generated: ${data?.result?.recommendations?.length || 0} items for user ${data?.result?.userId}`);
  });

  // Cache Manager Events
  cacheManager.on('cache:hit', (data: any) => {
    console.log(`🎯 Cache hit: ${data.source} - ${data.tier} (${data.latency}ms)`);
  });

  cacheManager.on('service:registered', (data: any) => {
    console.log(`📋 Cache service registered: ${data.type}`);
  });

  cacheManager.on('health:alert', (status: any) => {
    console.warn(`⚠️  Cache health alert: ${status.status}`);
  });
}

/**
 * Demonstration of Queue Operations
 */
export async function demonstrateQueueOperations(
  groceryPipeline: GroceryDataPipeline
): Promise<void> {
  console.log('\n📊 Demonstrating Queue Operations...');

  try {
    // Start the processing pipeline
    console.log('🚀 Starting processing pipeline...');
    await groceryPipeline.start();

    // Wait for startup
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 1. Submit price updates
    console.log('\n💰 Submitting price updates...');
    const priceJobs = [];
    for (let i = 0; i < 5; i++) {
      const jobId = await groceryPipeline.submitPriceUpdate({
        productId: `PROD_${1000 + i}`,
        storeId: `STORE_${i % 3 + 1}`,
        newPrice: Math.random() * 50 + 10,
        oldPrice: Math.random() * 60 + 15,
        currency: 'USD',
        effectiveDate: Date.now(),
        source: 'walmart_api',
        confidence: Math.random() * 0.3 + 0.7
      });
      priceJobs.push(jobId);
      console.log(`  📤 Price update job submitted: ${jobId}`);
    }

    // 2. Submit inventory updates
    console.log('\n📦 Submitting inventory updates...');
    const inventoryJobs = [];
    for (let i = 0; i < 3; i++) {
      const jobId = await groceryPipeline.submitInventorySync({
        productId: `PROD_${1000 + i}`,
        storeId: `STORE_${i % 3 + 1}`,
        quantity: Math.floor(Math.random() * 100),
        inStock: Math.random() > 0.2,
        lastUpdated: Date.now(),
        source: 'inventory_system',
        threshold: 10
      });
      inventoryJobs.push(jobId);
      console.log(`  📤 Inventory sync job submitted: ${jobId}`);
    }

    // 3. Submit product matching
    console.log('\n🔗 Submitting product matching jobs...');
    const matchingJobs = [];
    for (let i = 0; i < 2; i++) {
      const jobId = await groceryPipeline.submitProductMatch({
        sourceProductId: `PROD_${1000 + i}`,
        targetProductId: `PROD_${2000 + i}`,
        confidence: Math.random() * 0.4 + 0.6,
        matchType: 'fuzzy',
        attributes: {
          brand: 'Test Brand',
          category: 'Grocery',
          size: '12oz'
        },
        verificationStatus: 'pending'
      });
      matchingJobs.push(jobId);
      console.log(`  📤 Product matching job submitted: ${jobId}`);
    }

    // 4. Submit nutrition fetch requests
    console.log('\n🥗 Submitting nutrition fetch jobs...');
    const nutritionJobs = [];
    for (let i = 0; i < 2; i++) {
      const jobId = await groceryPipeline.submitNutritionFetch(`PROD_${1000 + i}`);
      nutritionJobs.push(jobId);
      console.log(`  📤 Nutrition fetch job submitted: ${jobId}`);
    }

    // 5. Wait for processing
    console.log('\n⏳ Waiting for jobs to process...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 seconds

    // 6. Show processing statistics
    console.log('\n📈 Processing Statistics:');
    const stats = groceryPipeline.getProcessingStats();
    for (const [queueName, queueStats] of stats) {
      console.log(`  ${queueName}:`);
      console.log(`    ✅ Completed: ${queueStats.completed || 0}`);
      console.log(`    ❌ Failed: ${queueStats.failed || 0}`);
      console.log(`    🔄 Retries: ${queueStats.retry || 0}`);
      console.log(`    ⏱️  Avg Time: ${(queueStats.avgProcessingTime || 0).toFixed(1)}ms`);
    }

    // 7. Show queue statistics
    console.log('\n📊 Queue Statistics:');
    const queueStats = await groceryPipeline.getQueueStats();
    for (const queue of queueStats) {
      console.log(`  ${queue.name}:`);
      console.log(`    📋 Length: ${queue?.length || 0}`);
      console.log(`    🔄 Processing: ${queue.processing}`);
      console.log(`    ✅ Completed: ${queue.completed}`);
      console.log(`    ❌ Failed: ${queue.failed}`);
    }

    console.log('\n✅ Queue operations demonstration completed!');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Load Testing Function
 */
export async function performLoadTest(
  groceryPipeline: GroceryDataPipeline,
  jobCount: number = 100
): Promise<void> {
  console.log(`\n🧪 Performing load test with ${jobCount} jobs...`);

  const startTime = Date.now();
  const promises = [];

  // Submit various types of jobs
  for (let i = 0; i < jobCount; i++) {
    const jobType = i % 4;
    
    switch (jobType) {
      case 0:
        promises.push(groceryPipeline.submitPriceUpdate({
          productId: `LOAD_TEST_PROD_${i}`,
          storeId: `STORE_${i % 10}`,
          newPrice: Math.random() * 100 + 5,
          oldPrice: Math.random() * 120 + 10,
          currency: 'USD',
          effectiveDate: Date.now(),
          source: 'load_test',
          confidence: 1.0
        }));
        break;
      case 1:
        promises.push(groceryPipeline.submitInventorySync({
          productId: `LOAD_TEST_PROD_${i}`,
          storeId: `STORE_${i % 10}`,
          quantity: Math.floor(Math.random() * 1000),
          inStock: Math.random() > 0.1,
          lastUpdated: Date.now(),
          source: 'load_test',
          threshold: 50
        }));
        break;
      case 2:
        promises.push(groceryPipeline.submitProductMatch({
          sourceProductId: `LOAD_TEST_PROD_${i}`,
          targetProductId: `TARGET_PROD_${i}`,
          confidence: Math.random() * 0.5 + 0.5,
          matchType: 'category',
          attributes: { loadTest: true },
          verificationStatus: 'pending'
        }));
        break;
      case 3:
        promises.push(groceryPipeline.submitNutritionFetch(`LOAD_TEST_PROD_${i}`));
        break;
    }
  }

  const jobIds = await Promise.all(promises);
  const submissionTime = Date.now() - startTime;

  console.log(`📤 Submitted ${jobIds?.length || 0} jobs in ${submissionTime}ms`);
  console.log(`⚡ Submission rate: ${(jobIds?.length || 0 / (submissionTime / 1000)).toFixed(1)} jobs/sec`);

  // Wait for processing
  console.log('⏳ Waiting for processing to complete...');
  await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds

  const totalTime = Date.now() - startTime;
  const stats = groceryPipeline.getProcessingStats();
  
  let totalCompleted = 0;
  let totalFailed = 0;
  
  for (const queueStats of stats.values()) {
    totalCompleted += queueStats.completed || 0;
    totalFailed += queueStats.failed || 0;
  }

  console.log('\n🏁 Load Test Results:');
  console.log(`  📊 Total Jobs: ${jobCount}`);
  console.log(`  ✅ Completed: ${totalCompleted}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(`  ⏱️  Total Time: ${totalTime}ms`);
  console.log(`  🚀 Processing Rate: ${(totalCompleted / (totalTime / 1000)).toFixed(1)} jobs/sec`);
  console.log(`  📈 Success Rate: ${((totalCompleted / jobCount) * 100).toFixed(1)}%`);
}

/**
 * Production Setup Function
 */
export async function setupProductionQueueSystem(): Promise<{
  messageQueue: RedisMessageQueue;
  groceryPipeline: GroceryDataPipeline;
  cacheManager: UnifiedCacheManager;
}> {
  const { messageQueue, groceryPipeline, cacheManager } = await setupRedisQueueSystem();

  // Production-specific event handlers
  messageQueue.on('error', (error: any) => {
    console.error('[PROD] Queue error:', error);
    // Send to monitoring system
  });

  groceryPipeline.on('job:failed', (data: any) => {
    console.error('[PROD] Job failed:', data);
    // Send alert to operations team
  });

  cacheManager.on('health:alert', (status: any) => {
    console.warn('[PROD] Cache health issue:', status);
    // Send to monitoring system
  });

  // Graceful shutdown handling
  const gracefulShutdown = async () => {
    console.log('\n🛑 Shutting down queue system...');
    await groceryPipeline.stop();
    await messageQueue.shutdown();
    await cacheManager.shutdown();
    process.exit(0);
  };

  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);

  // Start the pipeline
  await groceryPipeline.start();

  return { messageQueue, groceryPipeline, cacheManager };
}

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const { groceryPipeline } = await setupRedisQueueSystem();
      
      console.log('\n🎯 Running queue operations demo...');
      await demonstrateQueueOperations(groceryPipeline);
      
      console.log('\n🧪 Running load test...');
      await performLoadTest(groceryPipeline, 50);
      
      console.log('\n🧹 Cleaning up...');
      await groceryPipeline.shutdown();
      console.log('✅ Redis queue demo completed successfully!');
      
    } catch (error) {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    }
  })();
}