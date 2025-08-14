/**
 * EmailIngestionService Usage Examples
 * 
 * Demonstrates how to use the EmailIngestionService in different scenarios
 */

import { 
  EmailIngestionServiceFactory,
  EmailIngestionConfigPresets,
  EmailIngestionEnvironmentValidator
} from '../EmailIngestionServiceFactory.js';
import {
  IngestionMode,
  IngestionSource
} from '../EmailIngestionService.js';
import type {
  RawEmailData
} from '../EmailIngestionService.js';
import { logger } from '../../../utils/logger.js';

/**
 * Example 1: Basic Manual Ingestion
 */
async function basicManualIngestionExample(): Promise<void> {
  console.log('=== Basic Manual Ingestion Example ===\n');

  // Create service with manual mode configuration
  const service = await EmailIngestionServiceFactory.create({
    mode: IngestionMode.MANUAL,
    processing: {
      batchSize: 20,
      concurrency: 5,
      maxRetries: 3,
      retryDelay: 2000,
      deduplicationWindow: 24,
      priorityBoostKeywords: ['urgent', 'critical', 'emergency']
    }
  });

  try {
    // Example email data
    const sampleEmail: RawEmailData = {
      messageId: 'msg-001@example.com',
      subject: 'URGENT: System Alert - Immediate Action Required',
      body: {
        content: 'Dear Team,\n\nWe have detected a critical issue that requires immediate attention.\n\nBest regards,\nSystem Monitor',
        contentType: 'text'
      },
      from: {
        address: 'system@company.com',
        name: 'System Monitor'
      },
      to: [
        {
          address: 'team@company.com',
          name: 'Development Team'
        }
      ],
      receivedDateTime: new Date().toISOString(),
      hasAttachments: false,
      importance: 'high'
    };

    // Ingest single email
    console.log('Ingesting single email...');
    const result = await service.ingestEmail(sampleEmail, IngestionSource.JSON_FILE);
    
    if (result.success) {
      console.log(`✅ Email ingested successfully: ${result.data.emailId}`);
      console.log(`   Status: ${result.data.status}`);
      console.log(`   Processing time: ${result.data.processingTime}ms`);
    } else {
      console.log(`❌ Failed to ingest email: ${result.error}`);
    }

    // Get current metrics
    const metrics = await service.getMetrics();
    console.log('\nCurrent Metrics:');
    console.log(`   Total ingested: ${metrics.totalIngested}`);
    console.log(`   Duplicates detected: ${metrics.duplicatesDetected}`);
    console.log(`   Failed ingestions: ${metrics.failedIngestions}`);
    console.log(`   Average processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);

  } finally {
    await service.shutdown();
  }
}

/**
 * Example 2: Batch Processing from JSON File
 */
async function batchProcessingExample(): Promise<void> {
  console.log('\n=== Batch Processing Example ===\n');

  // Use high-throughput preset configuration
  const config = EmailIngestionConfigPresets.getHighThroughputConfig();
  const service = await EmailIngestionServiceFactory.create(config);

  try {
    // Create sample batch of emails
    const emailBatch: RawEmailData[] = [];
    for (let i = 1; i <= 50; i++) {
      emailBatch.push({
        messageId: `batch-msg-${i.toString().padStart(3, '0')}@example.com`,
        subject: `Email ${i} - ${i % 5 === 0 ? 'URGENT' : 'Regular'} Message`,
        body: {
          content: `This is email number ${i} in the batch processing example.`,
          contentType: 'text'
        },
        from: {
          address: `sender-${i}@example.com`,
          name: `Sender ${i}`
        },
        to: [
          {
            address: 'batch-recipient@company.com',
            name: 'Batch Recipient'
          }
        ],
        receivedDateTime: new Date(Date.now() - (i * 60000)).toISOString(), // Spread over last 50 minutes
        hasAttachments: i % 3 === 0, // Every 3rd email has attachments
        importance: i % 5 === 0 ? 'high' : 'normal' // Every 5th email is high importance
      });
    }

    console.log(`Processing batch of ${emailBatch.length} emails...`);
    const startTime = Date.now();
    
    const batchResult = await service.ingestBatch(emailBatch, IngestionSource.JSON_FILE);
    
    const totalTime = Date.now() - startTime;

    if (batchResult.success) {
      console.log(`✅ Batch processing completed in ${totalTime}ms`);
      console.log(`   Total emails: ${batchResult.data.totalEmails}`);
      console.log(`   Processed: ${batchResult.data.processed}`);
      console.log(`   Duplicates: ${batchResult.data.duplicates}`);
      console.log(`   Failed: ${batchResult.data.failed}`);
      console.log(`   Throughput: ${batchResult.data.throughput.toFixed(2)} emails/min`);
    } else {
      console.log(`❌ Batch processing failed: ${batchResult.error}`);
    }

    // Check queue status
    const queueStatus = await service.getQueueStatus();
    console.log('\nQueue Status:');
    console.log(`   Waiting: ${queueStatus.waiting}`);
    console.log(`   Active: ${queueStatus.active}`);
    console.log(`   Completed: ${queueStatus.completed}`);
    console.log(`   Failed: ${queueStatus.failed}`);

  } finally {
    await service.shutdown();
  }
}

/**
 * Example 3: Auto-Pull Configuration
 */
async function autoPullExample(): Promise<void> {
  console.log('\n=== Auto-Pull Example ===\n');

  // Use auto-pull preset configuration
  const config = EmailIngestionConfigPresets.getAutoPullConfig();
  const service = await EmailIngestionServiceFactory.create(config);

  try {
    console.log('Starting auto-pull service...');
    
    // Start auto-pull (this would normally run continuously)
    await service.startAutoPull();
    console.log(`✅ Auto-pull started - pulling every ${config.autoPull?.interval} minutes`);
    console.log(`   Sources: ${config.autoPull?.sources?.join(', ')}`);
    console.log(`   Max emails per pull: ${config.autoPull?.maxEmailsPerPull}`);

    // Simulate running for a short time
    console.log('\nSimulating auto-pull operation for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Check if auto-pull is active
    console.log(`Auto-pull active: ${service.isAutoPullActive()}`);

    // Stop auto-pull
    await service.stopAutoPull();
    console.log('✅ Auto-pull stopped');

  } finally {
    await service.shutdown();
  }
}

/**
 * Example 4: Error Handling and Recovery
 */
async function errorHandlingExample(): Promise<void> {
  console.log('\n=== Error Handling Example ===\n');

  const service = await EmailIngestionServiceFactory.create();

  try {
    // Example 1: Duplicate email handling
    console.log('Testing duplicate email handling...');
    const duplicateEmail: RawEmailData = {
      messageId: 'duplicate-test@example.com',
      subject: 'Duplicate Test Email',
      body: { content: 'This email will be sent twice', contentType: 'text' },
      from: { address: 'test@example.com', name: 'Test User' },
      to: [{ address: 'recipient@example.com', name: 'Recipient' }],
      receivedDateTime: new Date().toISOString(),
      hasAttachments: false
    };

    // First ingestion should succeed
    const firstResult = await service.ingestEmail(duplicateEmail, IngestionSource.JSON_FILE);
    console.log(`First attempt: ${firstResult.success ? 'Success' : 'Failed'} - Status: ${firstResult.data?.status}`);

    // Second ingestion should detect duplicate
    const secondResult = await service.ingestEmail(duplicateEmail, IngestionSource.JSON_FILE);
    console.log(`Second attempt: ${secondResult.success ? 'Success' : 'Failed'} - Status: ${secondResult.data?.status}`);

    // Example 2: Health monitoring
    console.log('\nPerforming health check...');
    const health = await service.healthCheck();
    console.log(`Overall health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`Status: ${health.status}`);
    console.log('Component Health:');
    for (const [component, status] of Object.entries(health.components)) {
      console.log(`   ${component}: ${status.healthy ? '✅' : '❌'} ${status.message || ''}`);
    }

    // Example 3: Queue management
    console.log('\nTesting queue management...');
    await service.pauseIngestion();
    console.log('✅ Ingestion paused');

    await service.resumeIngestion();
    console.log('✅ Ingestion resumed');

    // Example 4: Retry failed jobs
    console.log('\nRetrying any failed jobs...');
    const retriedCount = await service.retryFailedJobs(10);
    console.log(`Retried ${retriedCount} failed jobs`);

  } finally {
    await service.shutdown();
  }
}

/**
 * Example 5: Environment Validation
 */
function environmentValidationExample(): void {
  console.log('\n=== Environment Validation Example ===\n');

  // Validate current environment
  const validation = EmailIngestionEnvironmentValidator.validateEnvironment();
  
  if (validation.valid) {
    console.log('✅ Environment validation passed');
  } else {
    console.log('❌ Environment validation failed:');
    validation.errors.forEach(error => console.log(`   - ${error}`));
  }

  // Get recommendations
  const recommendations = EmailIngestionEnvironmentValidator.getRecommendations();
  if (recommendations.length > 0) {
    console.log('\n💡 Configuration Recommendations:');
    recommendations.forEach(rec => console.log(`   - ${rec}`));
  } else {
    console.log('\n✅ No additional configuration recommendations');
  }
}

/**
 * Example 6: Performance Monitoring
 */
async function performanceMonitoringExample(): Promise<void> {
  console.log('\n=== Performance Monitoring Example ===\n');

  const service = await EmailIngestionServiceFactory.create(
    EmailIngestionConfigPresets.getHighThroughputConfig()
  );

  try {
    // Generate test load
    console.log('Generating test load...');
    const promises: Promise<any>[] = [];
    
    for (let i = 0; i < 20; i++) {
      const email: RawEmailData = {
        messageId: `perf-test-${i}@example.com`,
        subject: `Performance Test Email ${i}`,
        body: { content: `Performance test content ${i}`, contentType: 'text' },
        from: { address: 'perf-test@example.com', name: 'Performance Tester' },
        to: [{ address: 'recipient@example.com', name: 'Recipient' }],
        receivedDateTime: new Date().toISOString(),
        hasAttachments: false
      };

      promises.push(service.ingestEmail(email, IngestionSource.JSON_FILE));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;

    // Analyze results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const throughput = (successful / totalTime) * 1000 * 60; // emails per minute

    console.log(`\nPerformance Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Throughput: ${throughput.toFixed(2)} emails/min`);

    // Get detailed metrics
    const metrics = await service.getMetrics();
    console.log(`\nDetailed Metrics:`);
    console.log(`   Average processing time: ${metrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`   Current queue size: ${metrics.currentQueueSize}`);
    console.log(`   Source breakdown:`, metrics.bySource);

  } finally {
    await service.shutdown();
  }
}

/**
 * Example 7: Complete Integration Workflow
 */
async function completeIntegrationExample(): Promise<void> {
  console.log('\n=== Complete Integration Workflow ===\n');

  // 1. Environment validation
  console.log('1. Validating environment...');
  environmentValidationExample();

  // 2. Create service with hybrid mode
  console.log('\n2. Initializing service in hybrid mode...');
  const service = await EmailIngestionServiceFactory.create(
    EmailIngestionConfigPresets.getHybridConfig()
  );

  try {
    // 3. Health check
    console.log('\n3. Performing initial health check...');
    const initialHealth = await service.healthCheck();
    console.log(`   System health: ${initialHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

    // 4. Process a variety of emails
    console.log('\n4. Processing diverse email types...');
    const diverseEmails: RawEmailData[] = [
      {
        messageId: 'critical-alert@system.com',
        subject: 'CRITICAL: Database Connection Lost',
        body: { content: 'Critical system alert requiring immediate attention', contentType: 'text' },
        from: { address: 'alerts@system.com', name: 'System Alerts' },
        to: [{ address: 'oncall@company.com', name: 'On-Call Team' }],
        receivedDateTime: new Date().toISOString(),
        hasAttachments: false,
        importance: 'high'
      },
      {
        messageId: 'customer-inquiry@support.com',
        subject: 'Customer Support Request - ID #12345',
        body: { content: 'Customer needs help with product setup', contentType: 'text' },
        from: { address: 'customer@example.com', name: 'Customer' },
        to: [{ address: 'support@company.com', name: 'Support Team' }],
        receivedDateTime: new Date().toISOString(),
        hasAttachments: true,
        importance: 'normal'
      },
      {
        messageId: 'newsletter@marketing.com',
        subject: 'Weekly Newsletter - Product Updates',
        body: { content: 'Latest product updates and announcements', contentType: 'html' },
        from: { address: 'newsletter@company.com', name: 'Marketing Team' },
        to: [{ address: 'subscribers@company.com', name: 'Subscribers' }],
        receivedDateTime: new Date().toISOString(),
        hasAttachments: false,
        importance: 'low'
      }
    ];

    const batchResult = await service.ingestBatch(diverseEmails, IngestionSource.JSON_FILE);
    console.log(`   Processed ${batchResult.data?.processed} emails successfully`);

    // 5. Monitor performance
    console.log('\n5. Monitoring performance metrics...');
    const finalMetrics = await service.getMetrics();
    console.log(`   Total processed: ${finalMetrics.totalIngested}`);
    console.log(`   Average processing time: ${finalMetrics.averageProcessingTime.toFixed(2)}ms`);
    console.log(`   Throughput: ${finalMetrics.throughput.lastMinute} emails/min (last minute)`);

    // 6. Final health check
    console.log('\n6. Final health check...');
    const finalHealth = await service.healthCheck();
    console.log(`   Final system health: ${finalHealth.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);

    console.log('\n🎉 Integration workflow completed successfully!');

  } finally {
    await service.shutdown();
  }
}

/**
 * Run all examples
 */
export async function runAllExamples(): Promise<void> {
  console.log('🚀 EmailIngestionService Examples\n');
  console.log('=' .repeat(50));

  try {
    await basicManualIngestionExample();
    await batchProcessingExample();
    await autoPullExample();
    await errorHandlingExample();
    await performanceMonitoringExample();
    await completeIntegrationExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Example execution failed:', error);
    throw error;
  }
}

// Export all examples for use in other modules
export {
  basicManualIngestionExample,
  batchProcessingExample,
  autoPullExample,
  errorHandlingExample,
  environmentValidationExample,
  performanceMonitoringExample,
  completeIntegrationExample
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(console.error);
}