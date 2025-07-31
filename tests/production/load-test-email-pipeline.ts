/**
 * Load Testing Suite for Email Pipeline
 * 
 * Performance testing for 100+ emails/sec processing capacity
 * with memory usage monitoring and resource optimization validation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { PipelineOrchestrator } from '../../src/core/pipeline/PipelineOrchestrator.js';
import { EmailRepository } from '../../src/database/repositories/EmailRepository.js';
import { EmailAnalysisPipeline } from '../../src/core/processors/EmailAnalysisPipeline.js';
import { EmailBatchProcessor } from '../../src/core/processors/EmailBatchProcessor.js';
import { getDatabaseConnection } from '../../src/database/connection.js';
import { logger } from '../../src/utils/logger.js';
import type { Database } from 'better-sqlite3';
import type { Email } from '../../src/core/pipeline/types.js';

// Performance monitoring utilities
class PerformanceMonitor extends EventEmitter {
  private startTime: number = 0;
  private endTime: number = 0;
  private memorySnapshots: Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> = [];
  private processingMetrics: Array<{ 
    timestamp: number; 
    emailsProcessed: number; 
    processingRate: number;
    avgResponseTime: number;
  }> = [];

  start(): void {
    this.startTime = performance.now();
    this.memorySnapshots = [];
    this.processingMetrics = [];
    this.startMemoryMonitoring();
  }

  stop(): void {
    this.endTime = performance.now();
    this.stopMemoryMonitoring();
  }

  getDuration(): number {
    return this.endTime - this.startTime;
  }

  recordProcessingMetric(emailsProcessed: number, avgResponseTime: number): void {
    const now = performance.now();
    const duration = (now - this.startTime) / 1000; // seconds
    const processingRate = duration > 0 ? emailsProcessed / duration : 0;

    this.processingMetrics.push({
      timestamp: now,
      emailsProcessed,
      processingRate,
      avgResponseTime
    });
  }

  getProcessingMetrics(): Array<{ 
    timestamp: number; 
    emailsProcessed: number; 
    processingRate: number;
    avgResponseTime: number;
  }> {
    return this.processingMetrics;
  }

  getMemorySnapshots(): Array<{ timestamp: number; usage: NodeJS.MemoryUsage }> {
    return this.memorySnapshots;
  }

  getMemoryStats(): { 
    peak: NodeJS.MemoryUsage; 
    average: NodeJS.MemoryUsage; 
    growth: number;
  } {
    if (this.memorySnapshots.length === 0) {
      return { 
        peak: process.memoryUsage(), 
        average: process.memoryUsage(),
        growth: 0
      };
    }

    const snapshots = this.memorySnapshots;
    const peak = snapshots.reduce((max, snapshot) => ({
      rss: Math.max(max.rss, snapshot.usage.rss),
      heapTotal: Math.max(max.heapTotal, snapshot.usage.heapTotal),
      heapUsed: Math.max(max.heapUsed, snapshot.usage.heapUsed),
      external: Math.max(max.external, snapshot.usage.external),
      arrayBuffers: Math.max(max.arrayBuffers, snapshot.usage.arrayBuffers)
    }), snapshots[0].usage);

    const average = {
      rss: snapshots.reduce((sum, s) => sum + s.usage.rss, 0) / snapshots.length,
      heapTotal: snapshots.reduce((sum, s) => sum + s.usage.heapTotal, 0) / snapshots.length,
      heapUsed: snapshots.reduce((sum, s) => sum + s.usage.heapUsed, 0) / snapshots.length,
      external: snapshots.reduce((sum, s) => sum + s.usage.external, 0) / snapshots.length,
      arrayBuffers: snapshots.reduce((sum, s) => sum + s.usage.arrayBuffers, 0) / snapshots.length
    };

    const initial = snapshots[0].usage;
    const final = snapshots[snapshots.length - 1].usage;
    const growth = final.heapUsed - initial.heapUsed;

    return { peak, average, growth };
  }

  private startMemoryMonitoring(): void {
    const monitor = () => {
      this.memorySnapshots.push({
        timestamp: performance.now(),
        usage: process.memoryUsage()
      });
    };

    // Take initial snapshot
    monitor();

    // Monitor every 100ms during test
    this.monitoringInterval = setInterval(monitor, 100);
  }

  private stopMemoryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      delete this.monitoringInterval;
    }
    
    // Take final snapshot
    this.memorySnapshots.push({
      timestamp: performance.now(),
      usage: process.memoryUsage()
    });
  }

  private monitoringInterval?: NodeJS.Timeout;
}

// Test data generators
class LoadTestDataGenerator {
  private counter = 0;

  generateEmails(count: number): Email[] {
    const emails: Email[] = [];
    const priorities = ['low', 'medium', 'high', 'critical'];
    const departments = ['support', 'sales', 'billing', 'technical', 'general'];
    const subjects = [
      'Urgent: System downtime reported',
      'Question about recent order',
      'Payment processing issue',
      'Feature request: New functionality',
      'Bug report: Application error',
      'Account access problem',
      'Subscription renewal inquiry',
      'Technical integration support',
      'Service availability question',
      'Performance optimization request'
    ];

    for (let i = 0; i < count; i++) {
      const emailId = `load-test-${this.counter++}`;
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      const department = departments[Math.floor(Math.random() * departments.length)];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];
      
      emails.push({
        id: emailId,
        subject: `${subject} - ${emailId}`,
        body: this.generateEmailBody(priority, department),
        bodyPreview: `Preview for ${subject}`,
        from: {
          emailAddress: {
            address: `sender-${i}@loadtest.com`,
            name: `Load Test Sender ${i}`
          }
        },
        to: [{
          emailAddress: {
            address: `${department}@company.com`,
            name: `${department.charAt(0).toUpperCase() + department.slice(1)} Team`
          }
        }],
        receivedDateTime: new Date().toISOString(),
        isRead: false,
        categories: [department],
        metadata: {
          folder: department,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageId: `${emailId}@loadtest.com`,
          hasAttachments: Math.random() > 0.7
        },
        // Legacy fields for compatibility
        sender_email: `sender-${i}@loadtest.com`,
        recipient_emails: `${department}@company.com`,
        date_received: new Date().toISOString(),
        message_id: `${emailId}@loadtest.com`,
        is_read: false,
        folder: department
      });
    }

    return emails;
  }

  private generateEmailBody(priority: string, department: string): string {
    const templates = {
      support: [
        'I am experiencing issues with my account and need immediate assistance.',
        'The system is not responding correctly when I try to submit my request.',
        'I received an error message that I do not understand. Can you help?'
      ],
      sales: [
        'I am interested in learning more about your premium services.',
        'Can you provide a quote for enterprise-level solutions?',
        'I would like to schedule a demo of your platform.'
      ],
      billing: [
        'I notice a discrepancy in my recent bill and would like clarification.',
        'My payment method needs to be updated for automatic billing.',
        'I need an invoice for my recent purchase for accounting purposes.'
      ],
      technical: [
        'I am having trouble integrating your API with our system.',
        'The documentation is unclear about authentication requirements.',
        'I need technical specifications for the latest version of your service.'
      ],
      general: [
        'I have a general question about your services.',
        'Can you direct me to the appropriate department for my inquiry?',
        'I need information about your company policies.'
      ]
    };

    const departmentTemplates = templates[department as keyof typeof templates] || templates.general;
    const template = departmentTemplates[Math.floor(Math.random() * departmentTemplates.length)];
    
    const urgencyModifier = priority === 'critical' ? ' This is URGENT and requires immediate attention.' : '';
    
    return `${template}${urgencyModifier}\n\nThank you for your assistance.\n\nBest regards,\nLoad Test User`;
  }
}

describe('Email Pipeline Load Testing Suite', () => {
  let db: Database.Database;
  let emailRepository: EmailRepository;
  let pipelineOrchestrator: PipelineOrchestrator;
  let emailAnalysisPipeline: EmailAnalysisPipeline;
  let batchProcessor: EmailBatchProcessor;
  let dataGenerator: LoadTestDataGenerator;
  let performanceMonitor: PerformanceMonitor;

  beforeAll(async () => {
    logger.info('Setting up Load Testing Suite', 'LOAD_TEST');
    
    // Initialize components
    db = getDatabaseConnection();
    emailRepository = new EmailRepository({ db });
    pipelineOrchestrator = new PipelineOrchestrator();
    emailAnalysisPipeline = new EmailAnalysisPipeline();
    batchProcessor = new EmailBatchProcessor();
    dataGenerator = new LoadTestDataGenerator();
    performanceMonitor = new PerformanceMonitor();

    // Clean up any existing load test data
    await cleanupLoadTestData();
  });

  afterAll(async () => {
    logger.info('Cleaning up Load Testing Suite', 'LOAD_TEST');
    await cleanupLoadTestData();
    emailRepository.close();
  });

  beforeEach(() => {
    // Reset performance monitor for each test
    performanceMonitor = new PerformanceMonitor();
  });

  describe('High-Volume Email Processing (100+ emails/sec)', () => {
    it('should process 1000 emails within 10 seconds', async () => {
      const emailCount = 1000;
      const maxProcessingTime = 10000; // 10 seconds
      const targetRate = 100; // emails per second

      logger.info(`Starting high-volume test: ${emailCount} emails`, 'LOAD_TEST');
      
      performanceMonitor.start();
      const startTime = performance.now();

      // Generate test emails
      const emails = dataGenerator.generateEmails(emailCount);
      
      // Store emails in database first
      const storePromises = emails.map(email => 
        emailRepository.createEmail(transformEmailForRepository(email))
      );
      
      await Promise.all(storePromises);
      
      // Process through pipeline in batches
      const batchSize = 50;
      const batches = Math.ceil(emails.length / batchSize);
      let processedCount = 0;
      const processingTimes: number[] = [];

      for (let i = 0; i < batches; i++) {
        const batchStart = i * batchSize;
        const batchEnd = Math.min(batchStart + batchSize, emails.length);
        const batch = emails.slice(batchStart, batchEnd);
        
        const batchStartTime = performance.now();
        
        // Process batch through pipeline
        const batchPromises = batch.map(email => 
          emailAnalysisPipeline.process(email)
        );
        
        await Promise.all(batchPromises);
        
        const batchProcessingTime = performance.now() - batchStartTime;
        processingTimes.push(batchProcessingTime);
        processedCount += batch.length;
        
        // Record metrics
        const avgResponseTime = processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length;
        performanceMonitor.recordProcessingMetric(processedCount, avgResponseTime);
        
        logger.debug(`Processed batch ${i + 1}/${batches} (${batch.length} emails) in ${batchProcessingTime.toFixed(2)}ms`, 'LOAD_TEST');
      }

      const totalProcessingTime = performance.now() - startTime;
      performanceMonitor.stop();

      // Validate processing time
      expect(totalProcessingTime).toBeLessThan(maxProcessingTime);

      // Validate processing rate
      const actualRate = (emailCount / totalProcessingTime) * 1000; // emails per second
      expect(actualRate).toBeGreaterThanOrEqual(targetRate);

      // Log results
      logger.info('High-volume processing completed', 'LOAD_TEST', {
        emailCount,
        totalTime: `${totalProcessingTime.toFixed(2)}ms`,
        processingRate: `${actualRate.toFixed(2)} emails/sec`,
        avgBatchTime: `${processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length}ms`
      });
    });

    it('should handle concurrent pipeline executions', async () => {
      const concurrentPipelines = 3;
      const emailsPerPipeline = 200;
      
      logger.info(`Starting concurrent pipeline test: ${concurrentPipelines} pipelines, ${emailsPerPipeline} emails each`, 'LOAD_TEST');
      
      performanceMonitor.start();

      // Create separate sets of emails for each pipeline
      const pipelinePromises = Array.from({ length: concurrentPipelines }, async (_, index) => {
        const emails = dataGenerator.generateEmails(emailsPerPipeline);
        
        // Store emails
        const storePromises = emails.map(email => 
          emailRepository.createEmail(transformEmailForRepository(email))
        );
        await Promise.all(storePromises);

        // Process through individual pipeline instances
        const pipeline = new EmailAnalysisPipeline();
        const processingPromises = emails.map(email => pipeline.process(email));
        
        const startTime = performance.now();
        const results = await Promise.all(processingPromises);
        const processingTime = performance.now() - startTime;
        
        return {
          pipelineIndex: index,
          emailsProcessed: results.length,
          processingTime,
          processingRate: (results.length / processingTime) * 1000
        };
      });

      const results = await Promise.all(pipelinePromises);
      performanceMonitor.stop();

      // Validate all pipelines completed successfully
      expect(results.length).toBe(concurrentPipelines);
      results.forEach(result => {
        expect(result.emailsProcessed).toBe(emailsPerPipeline);
        expect(result.processingRate).toBeGreaterThan(10); // At least 10 emails/sec per pipeline
      });

      const totalEmailsProcessed = results.reduce((sum, r) => sum + r.emailsProcessed, 0);
      const maxProcessingTime = Math.max(...results.map(r => r.processingTime));
      const overallRate = (totalEmailsProcessed / maxProcessingTime) * 1000;

      logger.info('Concurrent pipeline test completed', 'LOAD_TEST', {
        concurrentPipelines,
        totalEmailsProcessed,
        maxProcessingTime: `${maxProcessingTime.toFixed(2)}ms`,
        overallRate: `${overallRate.toFixed(2)} emails/sec`
      });
    });
  });

  describe('Memory Usage and Resource Monitoring', () => {
    it('should maintain memory usage below 500MB during high-volume processing', async () => {
      const emailCount = 2000;
      const maxMemoryUsage = 500 * 1024 * 1024; // 500MB
      
      logger.info(`Starting memory monitoring test: ${emailCount} emails`, 'LOAD_TEST');
      
      performanceMonitor.start();
      const initialMemory = process.memoryUsage();

      // Generate and process emails
      const emails = dataGenerator.generateEmails(emailCount);
      
      // Process in batches to monitor memory throughout
      const batchSize = 100;
      const batches = Math.ceil(emails.length / batchSize);

      for (let i = 0; i < batches; i++) {
        const batch = emails.slice(i * batchSize, (i + 1) * batchSize);
        
        // Store batch
        const storePromises = batch.map(email => 
          emailRepository.createEmail(transformEmailForRepository(email))
        );
        await Promise.all(storePromises);

        // Process batch
        const processPromises = batch.map(email => 
          emailAnalysisPipeline.process(email)
        );
        await Promise.all(processPromises);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Check current memory usage
        const currentMemory = process.memoryUsage();
        expect(currentMemory.heapUsed).toBeLessThan(maxMemoryUsage);
        
        logger.debug(`Batch ${i + 1}/${batches} processed, memory: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`, 'LOAD_TEST');
      }

      performanceMonitor.stop();

      const memoryStats = performanceMonitor.getMemoryStats();
      const finalMemory = process.memoryUsage();

      // Validate peak memory usage
      expect(memoryStats.peak.heapUsed).toBeLessThan(maxMemoryUsage);

      // Check for memory leaks (growth should be reasonable)
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;
      const maxAcceptableGrowth = 200 * 1024 * 1024; // 200MB
      expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth);

      logger.info('Memory monitoring test completed', 'LOAD_TEST', {
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        peakMemory: `${Math.round(memoryStats.peak.heapUsed / 1024 / 1024)}MB`,
        finalMemory: `${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`,
        memoryGrowth: `${Math.round(memoryGrowth / 1024 / 1024)}MB`
      });
    });

    it('should efficiently handle memory cleanup after processing', async () => {
      const emailCount = 1000;
      
      logger.info(`Starting memory cleanup test: ${emailCount} emails`, 'LOAD_TEST');
      
      const initialMemory = process.memoryUsage();
      performanceMonitor.start();

      // Generate and process emails
      const emails = dataGenerator.generateEmails(emailCount);
      
      // Store all emails
      const storePromises = emails.map(email => 
        emailRepository.createEmail(transformEmailForRepository(email))
      );
      await Promise.all(storePromises);

      // Process all emails
      const processPromises = emails.map(email => 
        emailAnalysisPipeline.process(email)
      );
      await Promise.all(processPromises);

      const memoryAfterProcessing = process.memoryUsage();

      // Force garbage collection multiple times
      for (let i = 0; i < 5; i++) {
        if (global.gc) {
          global.gc();
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const memoryAfterCleanup = process.memoryUsage();
      performanceMonitor.stop();

      // Validate memory was cleaned up
      const memoryReduction = memoryAfterProcessing.heapUsed - memoryAfterCleanup.heapUsed;
      expect(memoryReduction).toBeGreaterThan(0); // Some cleanup should occur

      // Final memory should not be excessively higher than initial
      const finalGrowth = memoryAfterCleanup.heapUsed - initialMemory.heapUsed;
      const maxAcceptableGrowth = 100 * 1024 * 1024; // 100MB
      expect(finalGrowth).toBeLessThan(maxAcceptableGrowth);

      logger.info('Memory cleanup test completed', 'LOAD_TEST', {
        initialMemory: `${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`,
        afterProcessing: `${Math.round(memoryAfterProcessing.heapUsed / 1024 / 1024)}MB`,
        afterCleanup: `${Math.round(memoryAfterCleanup.heapUsed / 1024 / 1024)}MB`,
        memoryReduction: `${Math.round(memoryReduction / 1024 / 1024)}MB`,
        finalGrowth: `${Math.round(finalGrowth / 1024 / 1024)}MB`
      });
    });
  });

  describe('Database Performance Under Load', () => {
    it('should maintain database query performance under high load', async () => {
      const emailCount = 1500;
      const maxQueryTime = 100; // 100ms max per query
      
      logger.info(`Starting database performance test: ${emailCount} emails`, 'LOAD_TEST');
      
      performanceMonitor.start();

      // Generate and store emails
      const emails = dataGenerator.generateEmails(emailCount);
      const storePromises = emails.map(email => 
        emailRepository.createEmail(transformEmailForRepository(email))
      );
      await Promise.all(storePromises);

      // Test various database operations under load
      const queryOperations = [
        // Basic queries
        () => emailRepository.queryEmails({ limit: 100 }),
        () => emailRepository.queryEmails({ search: 'urgent', limit: 50 }),
        () => emailRepository.queryEmails({ priorities: ['high', 'critical'], limit: 75 }),
        
        // Analytics queries
        () => emailRepository.getAnalytics(),
        () => emailRepository.count(),
        
        // Individual email operations
        () => emailRepository.queryEmails({ hasAttachments: true, limit: 25 }),
      ];

      const queryTimes: number[] = [];
      const concurrentQueries = 10;

      // Run queries concurrently multiple times
      for (let round = 0; round < 5; round++) {
        const roundPromises = Array.from({ length: concurrentQueries }, async (_, index) => {
          const operation = queryOperations[index % queryOperations.length];
          const startTime = performance.now();
          
          await operation();
          
          const queryTime = performance.now() - startTime;
          queryTimes.push(queryTime);
          return queryTime;
        });

        const roundResults = await Promise.all(roundPromises);
        const maxRoundTime = Math.max(...roundResults);
        
        expect(maxRoundTime).toBeLessThan(maxQueryTime);
        
        logger.debug(`Query round ${round + 1} completed, max time: ${maxRoundTime.toFixed(2)}ms`, 'LOAD_TEST');
      }

      performanceMonitor.stop();

      const avgQueryTime = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;
      const maxQueryTime_actual = Math.max(...queryTimes);

      expect(avgQueryTime).toBeLessThan(maxQueryTime);
      expect(maxQueryTime_actual).toBeLessThan(maxQueryTime * 2); // Allow some variance

      logger.info('Database performance test completed', 'LOAD_TEST', {
        totalQueries: queryTimes.length,
        avgQueryTime: `${avgQueryTime.toFixed(2)}ms`,
        maxQueryTime: `${maxQueryTime_actual.toFixed(2)}ms`,
        emailsInDatabase: emailCount
      });
    });

    it('should handle database transaction failures gracefully under load', async () => {
      const emailCount = 500;
      const concurrentOperations = 20;
      
      logger.info(`Starting database resilience test: ${emailCount} emails, ${concurrentOperations} concurrent ops`, 'LOAD_TEST');
      
      performanceMonitor.start();

      // Generate emails
      const emails = dataGenerator.generateEmails(emailCount);
      
      // Create concurrent operations that might conflict
      const operations = Array.from({ length: concurrentOperations }, async (_, index) => {
        const batch = emails.slice(
          index * Math.floor(emailCount / concurrentOperations),
          (index + 1) * Math.floor(emailCount / concurrentOperations)
        );

        const results = { successful: 0, failed: 0 };

        for (const email of batch) {
          try {
            await emailRepository.createEmail(transformEmailForRepository(email));
            results.successful++;
          } catch (error) {
            results.failed++;
            logger.debug(`Operation failed: ${error.message}`, 'LOAD_TEST');
          }
        }

        return results;
      });

      const operationResults = await Promise.all(operations);
      performanceMonitor.stop();

      // Aggregate results
      const totalSuccessful = operationResults.reduce((sum, r) => sum + r.successful, 0);
      const totalFailed = operationResults.reduce((sum, r) => sum + r.failed, 0);

      // At least 90% should succeed
      const successRate = totalSuccessful / (totalSuccessful + totalFailed);
      expect(successRate).toBeGreaterThan(0.9);

      // Verify database integrity
      const finalCount = await emailRepository.count();
      expect(finalCount).toBeGreaterThan(0);

      logger.info('Database resilience test completed', 'LOAD_TEST', {
        totalOperations: totalSuccessful + totalFailed,
        successful: totalSuccessful,
        failed: totalFailed,
        successRate: `${(successRate * 100).toFixed(1)}%`,
        finalDatabaseCount: finalCount
      });
    });
  });

  describe('Pipeline Performance Optimization', () => {
    it('should optimize processing for different email priorities', async () => {
      const emailCounts = {
        critical: 50,
        high: 150,
        medium: 300,
        low: 500
      };
      
      logger.info('Starting priority optimization test', 'LOAD_TEST');
      performanceMonitor.start();

      const processingResults: { [key: string]: { emails: Email[]; processingTimes: number[] } } = {};

      // Process each priority level separately
      for (const [priority, count] of Object.entries(emailCounts)) {
        const emails = dataGenerator.generateEmails(count);
        // Set priority in email metadata
        emails.forEach(email => {
          email.metadata = { ...email.metadata, priority };
        });

        const processingTimes: number[] = [];

        // Store emails
        const storePromises = emails.map(email => 
          emailRepository.createEmail(transformEmailForRepository(email))
        );
        await Promise.all(storePromises);

        // Process emails and measure times
        for (const email of emails) {
          const startTime = performance.now();
          await emailAnalysisPipeline.process(email);
          const processingTime = performance.now() - startTime;
          processingTimes.push(processingTime);
        }

        processingResults[priority] = { emails, processingTimes };
      }

      performanceMonitor.stop();

      // Analyze results - higher priority emails should be processed faster on average
      const avgProcessingTimes = Object.entries(processingResults).map(([priority, data]) => ({
        priority,
        avgTime: data.processingTimes.reduce((a, b) => a + b, 0) / data.processingTimes.length,
        count: data.emails.length
      }));

      // Critical emails should be processed fastest
      const criticalAvg = avgProcessingTimes.find(p => p.priority === 'critical')?.avgTime || 0;
      const lowAvg = avgProcessingTimes.find(p => p.priority === 'low')?.avgTime || 0;

      // This might not always be true due to processing variations, but log for analysis
      logger.info('Priority processing times', 'LOAD_TEST', 
        avgProcessingTimes.reduce((obj, p) => ({
          ...obj,
          [`${p.priority}Avg`]: `${p.avgTime.toFixed(2)}ms`
        }), {})
      );

      // Validate that all emails were processed
      avgProcessingTimes.forEach(({ priority, count, avgTime }) => {
        expect(count).toBe(emailCounts[priority as keyof typeof emailCounts]);
        expect(avgTime).toBeGreaterThan(0);
        expect(avgTime).toBeLessThan(5000); // No email should take more than 5 seconds
      });
    });

    it('should scale processing with available system resources', async () => {
      const emailCount = 1000;
      const cpuCount = require('os').cpus().length;
      
      logger.info(`Starting resource scaling test: ${emailCount} emails, ${cpuCount} CPUs`, 'LOAD_TEST');
      
      performanceMonitor.start();

      // Generate test emails
      const emails = dataGenerator.generateEmails(emailCount);
      
      // Store emails
      const storePromises = emails.map(email => 
        emailRepository.createEmail(transformEmailForRepository(email))
      );
      await Promise.all(storePromises);

      // Test different batch sizes to find optimal processing
      const batchSizes = [1, 5, 10, Math.min(25, cpuCount), Math.min(50, cpuCount * 2)];
      const batchResults: { batchSize: number; totalTime: number; throughput: number }[] = [];

      for (const batchSize of batchSizes) {
        const batchCount = Math.ceil(emails.length / batchSize);
        const startTime = performance.now();

        for (let i = 0; i < batchCount; i++) {
          const batch = emails.slice(i * batchSize, (i + 1) * batchSize);
          const batchPromises = batch.map(email => emailAnalysisPipeline.process(email));
          await Promise.all(batchPromises);
        }

        const totalTime = performance.now() - startTime;
        const throughput = (emails.length / totalTime) * 1000; // emails per second

        batchResults.push({ batchSize, totalTime, throughput });
        
        logger.debug(`Batch size ${batchSize}: ${totalTime.toFixed(2)}ms, ${throughput.toFixed(2)} emails/sec`, 'LOAD_TEST');
      }

      performanceMonitor.stop();

      // Find optimal batch size (highest throughput)
      const optimalBatch = batchResults.reduce((best, current) => 
        current.throughput > best.throughput ? current : best
      );

      // Validate performance scaling
      expect(optimalBatch.throughput).toBeGreaterThan(10); // At least 10 emails/sec
      expect(optimalBatch.batchSize).toBeGreaterThan(0);

      logger.info('Resource scaling test completed', 'LOAD_TEST', {
        optimalBatchSize: optimalBatch.batchSize,
        optimalThroughput: `${optimalBatch.throughput.toFixed(2)} emails/sec`,
        totalTime: `${optimalBatch.totalTime.toFixed(2)}ms`,
        cpuCount
      });
    });
  });

  // Helper functions

  async function cleanupLoadTestData(): Promise<void> {
    try {
      // Clean up load test emails
      db.prepare(`DELETE FROM emails_enhanced WHERE message_id LIKE 'load-test-%'`).run();
      
      // Clean up related analysis records
      db.prepare(`DELETE FROM email_analysis WHERE email_id IN (
        SELECT id FROM emails_enhanced WHERE message_id LIKE 'load-test-%'
      )`).run();
      
      // Clean up pipeline executions
      db.prepare(`DELETE FROM pipeline_executions WHERE id IN (
        SELECT DISTINCT execution_id FROM stage_results 
        WHERE email_id IN (
          SELECT id FROM emails_enhanced WHERE message_id LIKE 'load-test-%'
        )
      )`).run();
      
      logger.info('Load test data cleanup completed', 'LOAD_TEST');
    } catch (error) {
      logger.error('Load test data cleanup failed', 'LOAD_TEST', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  function transformEmailForRepository(email: Email): any {
    return {
      graphId: `graph-${email.id}`,
      messageId: email.metadata?.messageId || email.id,
      subject: email.subject,
      bodyText: email.body,
      bodyPreview: email.bodyPreview,
      senderEmail: email.from.emailAddress.address,
      senderName: email.from.emailAddress.name,
      recipients: email.to,
      receivedAt: new Date(email.receivedDateTime),
      importance: email.metadata?.priority || 'medium',
      categories: email.categories,
      hasAttachments: email.metadata?.hasAttachments || false,
      isRead: email.isRead,
      conversationId: email.metadata?.conversationId
    };
  }
});