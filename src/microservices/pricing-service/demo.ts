#!/usr/bin/env tsx

/**
 * Pricing Service Demo
 * Demonstrates the 3-tier cache hierarchy functionality
 */

import { PricingService } from './PricingService.js';

async function demonstratePricingService() {
  console.log('🚀 Starting Pricing Service Demo...\n');

  // Initialize with demo configuration
  const pricingService = new PricingService({
    cache: {
      memory: {
        maxSize: 100,
        ttl: 30 // 30 seconds for demo
      },
      redis: {
        ttl: 300, // 5 minutes
        keyPrefix: 'demo:'
      },
      sqlite: {
        ttl: 3600, // 1 hour
        tableName: 'demo_price_cache'
      }
    },
    api: {
      baseUrl: 'https://api?.walmart.com',
      apiKey: 'demo-key',
      rateLimit: 5,
      timeout: 5000,
      retries: 2
    }
  });

  // Set up event listeners
  pricingService.on('cache:hit', (data: any) => {
    console.log(`✅ Cache HIT at ${data.level}: ${data.key} (${data.latency}ms)`);
  });

  pricingService.on('api:fetch', (data: any) => {
    console.log(`🌐 API fetch for ${data.productId} (${data.latency}ms)`);
  });

  try {
    console.log('📊 Initial Metrics:');
    console.log(JSON.stringify(pricingService.getMetrics(), null, 2));
    console.log('\n');

    // Demo 1: First price lookup (should go to API)
    console.log('🔍 Demo 1: First price lookup for PROD123...');
    const price1 = await pricingService.getPrice({
      productId: 'PROD123',
      storeId: 'store1',
      quantity: 1,
      includePromotions: true
    });
    console.log(`💰 Price: $${price1.price} (source: ${price1.source})`);
    console.log('');

    // Demo 2: Second lookup (should hit memory cache)
    console.log('🔍 Demo 2: Second lookup for same product...');
    const price2 = await pricingService.getPrice({
      productId: 'PROD123',
      storeId: 'store1',
      quantity: 1,
      includePromotions: true
    });
    console.log(`💰 Price: $${price2.price} (source: ${price2.source})`);
    console.log('');

    // Demo 3: Cache warming
    console.log('🔥 Demo 3: Cache warming with multiple products...');
    await pricingService.warmCache(['PROD456', 'PROD789'], ['store1']);
    console.log('Cache warming completed!');
    console.log('');

    // Demo 4: Batch pricing
    console.log('📦 Demo 4: Batch price lookup...');
    const requests = [
      { productId: 'PROD456', storeId: 'store1', quantity: 1, includePromotions: true },
      { productId: 'PROD789', storeId: 'store1', quantity: 2, includePromotions: false },
      { productId: 'PROD999', storeId: 'store1', quantity: 1, includePromotions: true }
    ];

    const startTime = Date.now();
    const batchResults = await Promise.all(
      requests?.map(req => pricingService.getPrice(req))
    );
    const batchTime = Date.now() - startTime;

    console.log(`Batch lookup completed in ${batchTime}ms:`);
    batchResults.forEach((result, i) => {
      console.log(`  ${requests[i].productId}: $${result.price} (${result.source})`);
    });
    console.log('');

    // Demo 5: Final metrics
    console.log('📈 Final Metrics:');
    const finalMetrics = pricingService.getMetrics();
    console.log(`Memory Cache: ${finalMetrics?.cacheSize?.memory}/${finalMetrics?.cacheSize?.memoryMax} items`);
    console.log(`Hit Rates: Memory ${finalMetrics?.hitRate?.memory.toFixed(1)}%, Overall ${finalMetrics?.hitRate?.overall.toFixed(1)}%`);
    console.log(`API Calls: ${finalMetrics?.hits?.api}`);
    console.log(`Avg Latency: Memory ${finalMetrics?.avgLatency?.memory.toFixed(1)}ms, API ${finalMetrics?.avgLatency?.api.toFixed(1)}ms`);
    console.log('');

    // Demo 6: Cache invalidation
    console.log('🗑️  Demo 6: Cache invalidation...');
    const invalidated = await pricingService.invalidateCache({ productId: 'PROD123' });
    console.log(`Invalidated ${invalidated} cache entries for PROD123`);
    
    // Verify cache was cleared
    console.log('Fetching PROD123 again (should go to API)...');
    const price3 = await pricingService.getPrice({
      productId: 'PROD123',
      storeId: 'store1',
      quantity: 1,
      includePromotions: true
    });
    console.log(`💰 Price: $${price3.price} (source: ${price3.source})`);

  } catch (error) {
    console.error('❌ Demo failed:', error);
  } finally {
    console.log('\n🧹 Cleaning up...');
    await pricingService.close();
    console.log('✅ Pricing service demo completed!');
  }
}

// Run the demo if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstratePricingService().catch(console.error);
}

export { demonstratePricingService };