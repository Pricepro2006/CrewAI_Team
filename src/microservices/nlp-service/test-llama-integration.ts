#!/usr/bin/env ts-node

/**
 * Test script for llama.cpp integration with NLPService
 * Verifies that the Qwen3:0.6b model can be loaded and used
 */

import { NLPService } from './src/services/NLPService';
import { NLPServiceConfig } from './src/types';

async function testLlamaIntegration() {
  console.log('Testing llama.cpp integration with Qwen3:0.6b model...\n');

  // Create minimal config for testing
  const config: NLPServiceConfig = {
    port: 3008,
    grpcPort: 50051,
    host: 'localhost',
    environment: 'test',
    queue: {
      maxConcurrent: 2,
      defaultTimeout: 30000,
      maxRetries: 3,
      persistenceEnabled: false,
      persistencePath: './nlp-queue-persistence'
    },
    monitoring: {
      enabled: false,
      healthCheckInterval: 30000,
      alertThresholds: {
        queueSize: 100,
        errorRate: 0.1,
        processingTime: 5000,
        memoryUsage: 90
      }
    },
    discovery: {
      enabled: false,
      serviceName: 'nlp-service',
      serviceVersion: '1.0.0',
      heartbeatInterval: 30000
    },
    security: {
      rateLimiting: {
        enabled: false,
        max: 100,
        timeWindow: '1m'
      },
      cors: {
        enabled: false,
        origins: ['*']
      },
      apiKeys: {
        enabled: false,
        required: false
      }
    },
    shutdown: {
      timeout: 30000,
      signals: ['SIGINT', 'SIGTERM']
    }
  };

  const nlpService = new NLPService(config);

  try {
    // Start the service (initializes llama.cpp)
    console.log('Starting NLP service with llama.cpp...');
    await nlpService.start();
    console.log('✅ Service started successfully!\n');

    // Test queries
    const testQueries = [
      'Add 2 pounds of organic bananas',
      'Remove milk from my list',
      'Search for gluten-free bread',
      'Show me all items in my cart',
      'Update apples quantity to 5'
    ];

    console.log('Testing NLP queries:\n');
    for (const query of testQueries) {
      console.log(`Query: "${query}"`);
      try {
        const result = await nlpService.processQuery(query);
        console.log('Result:');
        console.log('  - Intent:', result.intent.action, `(confidence: ${result.intent.confidence})`);
        console.log('  - Entities:', result.entities.length);
        result.entities.forEach(e => {
          console.log(`    • ${e.type}: ${e.value} (${e.confidence})`);
        });
        console.log('  - Model:', result.processingMetadata.model);
        console.log('  - Processing time:', result.processingMetadata.processingTime, 'ms');
        console.log();
      } catch (error) {
        console.error('  ❌ Error processing query:', error);
        console.log();
      }
    }

    // Test batch processing
    console.log('Testing batch processing...');
    const batchResult = await nlpService.processBatch(
      testQueries.slice(0, 3).map(query => ({ query })),
      'normal',
      30000
    );
    console.log(`✅ Batch processed: ${batchResult.completedCount}/${testQueries.slice(0, 3).length} successful`);
    console.log(`   Total time: ${batchResult.totalProcessingTime}ms\n`);

    // Check service status
    const status = nlpService.getStatus();
    console.log('Service Status:');
    console.log('  - Overall:', status.status);
    console.log('  - Dependencies:');
    console.log('    • llama.cpp:', status.dependencies.llamacpp);
    console.log('    • Model:', status.dependencies.model);
    console.log('    • Queue:', status.dependencies.queue);
    console.log();

    // Get metrics
    const metrics = nlpService.getMetrics();
    console.log('Service Metrics:');
    console.log('  - Requests:', metrics.requests.total);
    console.log('  - Success rate:', 
      metrics.requests.total > 0 
        ? `${((metrics.requests.successful / metrics.requests.total) * 100).toFixed(1)}%`
        : 'N/A'
    );
    console.log('  - Avg processing time:', metrics.queue.averageProcessingTime, 'ms');
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('Shutting down service...');
    await nlpService.shutdown();
    console.log('✅ Service shut down successfully');
  }
}

// Run the test
testLlamaIntegration().catch(console.error);