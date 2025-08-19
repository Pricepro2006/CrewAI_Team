#!/usr/bin/env tsx

/**
 * Unified Cache System Integration Example
 * 
 * Demonstrates how to set up and integrate the unified 3-tier cache system
 * with existing microservices in the CrewAI Team application.
 */

import { UnifiedCacheManager } from '../services/UnifiedCacheManager.js';
import { PricingService } from '../../microservices/pricing-service/PricingService.js';
import { ListManagementService } from '../services/ListManagementService.js';
import type { Express } from 'express';

/**
 * Initialize the unified cache system for the application
 */
export async function setupUnifiedCacheSystem(app?: Express): Promise<UnifiedCacheManager> {
  console.log('🚀 Initializing Unified Cache System...');

  // 1. Create the unified cache manager with configuration
  const cacheManager = new UnifiedCacheManager({
    cache: {
      memory: {
        maxSize: 50000,        // 50K items in memory
        ttl: 300,              // 5 minute default TTL
        checkInterval: 60000   // Check for expired items every minute
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_CACHE_DB || '0'), // Default DB for cache
        ttl: 3600,             // 1 hour in Redis
        keyPrefix: 'cache:',   // Default cache prefix
        maxRetries: 3          // Maximum retry attempts
      },
      sqlite: {
        path: './data/unified_cache.db',
        ttl: 86400,            // 24 hours in SQLite
        tableName: 'unified_cache', // Default table name
        maxEntries: 1000000,   // 1M entries default
        cleanupInterval: 3600000 // Clean up every hour
      }
    },
    integration: {
      enablePricingCache: true,
      enableListCache: true,
      pricingCacheTtl: 3600,   // 1 hour for pricing data
      listCacheTtl: 1800,       // 30 minutes for list data
      enableCacheWarm: true,    // Enable cache warming feature
      warmOnStartup: false,     // Don't warm on startup for demo
      cacheKeyPrefix: 'integrated:', // Prefix for integrated cache keys
      invalidationStrategy: 'immediate'
    },
    monitoring: {
      enableMetrics: true,
      metricsInterval: 60000,  // 1 minute metrics
      healthCheckInterval: 30000 // 30 second health checks
    }
  });

  // 2. Set up event handlers for monitoring
  cacheManager.on('initialization:complete', () => {
    console.log('✅ Unified cache system initialized successfully');
  });

  cacheManager.on('cache:hit', (data: any) => {
    console.log(`🎯 Cache HIT: ${data.source} - ${data.tier} (${data.latency}ms)`);
  });

  cacheManager.on('service:registered', (data: any) => {
    console.log(`📋 Service registered: ${data.type}`);
  });

  cacheManager.on('health:alert', (status: any) => {
    console.warn('⚠️  Cache system health alert:', status.status);
  });

  cacheManager.on('cache:error', (error: any) => {
    console.error('❌ Cache error:', error.source, error.error?.message || error);
  });

  // 3. Initialize the cache system
  await cacheManager.initialize();

  // 4. Create and register microservices
  console.log('🔧 Setting up microservices...');

  // Initialize pricing service
  const pricingService = new PricingService({
    cache: {
      memory: { maxSize: 10000, ttl: 300 },
      redis: { ttl: 3600, keyPrefix: 'pricing:' },
      sqlite: { ttl: 86400, tableName: 'pricing_cache' }
    },
    api: {
      baseUrl: process.env.WALMART_API_URL || 'https://api?.walmart.com',
      apiKey: process.env.WALMART_API_KEY || 'demo-key',
      rateLimit: 10,
      timeout: 5000,
      retries: 3
    }
  });

  // Initialize list management service
  const listService = new ListManagementService({
    reactive: {
      maxCacheSize: 10000,
      syncInterval: 100,
      conflictResolution: 'last-write-wins'
    }
  });

  // Register services with the unified cache manager
  cacheManager.registerPricingService(pricingService);
  cacheManager.registerListService(listService);

  // 5. Add Express middleware if app is provided
  if (app) {
    app.use('/api', cacheManager.createCacheMiddleware());
    
    // Add cache management endpoints
    app.get('/api/cache/status', async (req, res) => {
      try {
        const status = await cacheManager.getStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get cache status' });
      }
    });

    app.get('/api/cache/metrics', (req, res) => {
      try {
        const metrics = cacheManager.getMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get cache metrics' });
      }
    });

    app.post('/api/cache/warm', async (req, res) => {
      try {
        const { pricing, lists } = req.body;
        const results = await cacheManager.warmCache({ pricing, lists });
        res.json({ message: 'Cache warming initiated', results });
      } catch (error) {
        res.status(500).json({ error: 'Failed to warm cache' });
      }
    });

    app.post('/api/cache/invalidate', async (req, res) => {
      try {
        const options = req?.body;
        await cacheManager.invalidateCache(options);
        res.json({ message: 'Cache invalidation completed' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to invalidate cache' });
      }
    });

    console.log('🌐 Cache management endpoints added to Express app');
  }

  console.log('🎉 Unified cache system setup complete!');
  return cacheManager;
}

/**
 * Demonstration of cache operations
 */
export async function demonstrateUnifiedCache(cacheManager: UnifiedCacheManager): Promise<void> {
  console.log('\n📊 Demonstrating Unified Cache Operations...');

  try {
    // Show initial status
    console.log('📈 Initial Status:');
    const initialStatus = await cacheManager.getStatus();
    console.log(`  System: ${initialStatus.status}`);
    console.log(`  Services: ${Object.keys(initialStatus.services).filter(k => initialStatus.services[k as keyof typeof initialStatus.services]).join(', ')}`);
    console.log(`  Hit Ratio: ${initialStatus?.performance?.cacheHitRatio.toFixed(1)}%`);

    // Cache warming demonstration
    console.log('\n🔥 Cache Warming:');
    const warmResults = await cacheManager.warmCache({
      pricing: {
        productIds: ['PROD001', 'PROD002', 'PROD003'],
        storeIds: ['store1', 'store2']
      }
    });
    console.log(`  Pricing cache warmed: ${warmResults.pricing?.warmed || 0} items`);

    // Show metrics after warming
    console.log('\n📊 Metrics after warming:');
    const metrics = cacheManager.getMetrics();
    console.log(`  Memory cache size: ${metrics?.central?.sizes.memory}`);
    console.log(`  Total operations: ${metrics?.central?.hits.memory + metrics?.central?.misses.memory}`);

    // Cache invalidation demonstration
    console.log('\n🗑️  Cache Invalidation:');
    await cacheManager.invalidateCache({
      pricing: { productId: 'PROD001' }
    });
    console.log('  Invalidated cache for PROD001');

    // Final status
    console.log('\n📈 Final Status:');
    const finalStatus = await cacheManager.getStatus();
    console.log(`  System: ${finalStatus.status}`);
    console.log(`  Uptime: ${Math.floor(finalStatus.uptime / 1000)}s`);
    console.log(`  Total Requests: ${finalStatus?.performance?.totalRequests}`);
    console.log(`  Hit Ratio: ${finalStatus?.performance?.cacheHitRatio.toFixed(1)}%`);
    console.log(`  Avg Latency: ${finalStatus?.performance?.averageLatency.toFixed(1)}ms`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

/**
 * Production setup function for integration into main application
 */
export async function setupProductionCache(): Promise<UnifiedCacheManager> {
  const cacheManager = await setupUnifiedCacheSystem();
  
  // Add production-specific configurations
  cacheManager.on('metrics:collected', (metrics: any) => {
    // Log metrics to your monitoring system
    // console.log('Metrics:', metrics);
  });

  cacheManager.on('health:alert', (status: any) => {
    // Send alerts to your monitoring system
    console.warn('Cache health alert:', status);
  });

  // Graceful shutdown handling
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down cache system...');
    await cacheManager.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down cache system...');
    await cacheManager.shutdown();
    process.exit(0);
  });

  return cacheManager;
}

// Run demonstration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const cacheManager = await setupUnifiedCacheSystem();
      await demonstrateUnifiedCache(cacheManager);
      
      console.log('\n🧹 Cleaning up...');
      await cacheManager.shutdown();
      console.log('✅ Demo completed successfully!');
    } catch (error) {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    }
  })();
}

export { UnifiedCacheManager };