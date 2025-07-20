#!/usr/bin/env node
import { EmailAnalysisAgent } from '../src/core/agents/specialized/EmailAnalysisAgent';
import { EmailAnalysisCache } from '../src/core/cache/EmailAnalysisCache';
import { EmailBatchProcessor } from '../src/core/processors/EmailBatchProcessor';
import { logger } from '../src/utils/logger';
import { performance } from 'perf_hooks';

interface BenchmarkResult {
  testName: string;
  totalEmails: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  cacheHitRate?: number;
  confidenceScores: number[];
  errors: number;
}

class EmailAnalysisBenchmark {
  private agent: EmailAnalysisAgent;
  private cache: EmailAnalysisCache;
  private batchProcessor: EmailBatchProcessor;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.agent = new EmailAnalysisAgent();
    this.cache = new EmailAnalysisCache({ maxSize: 1000 });
    this.batchProcessor = new EmailBatchProcessor(this.agent, this.cache);
  }

  async initialize() {
    await this.agent.initialize();
    logger.info('Benchmark suite initialized', 'BENCHMARK');
  }

  /**
   * Generate synthetic emails for testing
   */
  private generateTestEmails(count: number): any[] {
    const emails = [];
    const types = ['order', 'quote', 'shipping', 'support', 'urgent'];
    const priorities = ['low', 'medium', 'high', 'critical'];
    
    for (let i = 0; i < count; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      const priority = priorities[Math.floor(Math.random() * priorities.length)];
      
      emails.push({
        id: `test-email-${i}`,
        subject: this.generateSubject(type, priority),
        body: this.generateBody(type),
        bodyPreview: '',
        from: {
          emailAddress: {
            name: 'Test Sender',
            address: `${type}@tdsynnex.com`
          }
        },
        receivedDateTime: new Date().toISOString(),
        isRead: Math.random() > 0.5,
        categories: [],
        importance: priority === 'critical' ? 'high' : 'normal'
      });
    }
    
    return emails;
  }

  private generateSubject(type: string, priority: string): string {
    const subjects = {
      order: [
        `${priority === 'critical' ? 'URGENT: ' : ''}Order PO #${Math.floor(Math.random() * 100000000)}`,
        'Order Confirmation - HP Products',
        'Order Status Update'
      ],
      quote: [
        `Quote CAS${Math.floor(Math.random() * 1000000)} Ready`,
        'Quote Request - Dell Systems',
        'Updated Quote Available'
      ],
      shipping: [
        'Shipment Notification - Tracking Available',
        'Delivery Update - Order Shipped',
        `Tracking: 1Z${Math.random().toString(36).substring(7).toUpperCase()}`
      ],
      support: [
        `Case #INC${Math.floor(Math.random() * 1000000)}`,
        'Support Ticket Update',
        'Return Authorization Request'
      ],
      urgent: [
        'URGENT: Action Required',
        'CRITICAL: System Down',
        'Immediate Response Needed'
      ]
    };
    
    const typeSubjects = subjects[type as keyof typeof subjects] || subjects.order;
    return typeSubjects[Math.floor(Math.random() * typeSubjects.length)];
  }

  private generateBody(type: string): string {
    const bodies = {
      order: 'Your order has been processed. PO #12345678. Total: $5,432.10 USD',
      quote: 'Quote available for review. Quote number: TS123456. Valid until next month.',
      shipping: 'Your package has shipped. Tracking: FEDEX1234567890. Expected delivery in 2 days.',
      support: 'Support case updated. Please review the latest comments in the portal.',
      urgent: 'This requires immediate attention. Please respond within 24 hours.'
    };
    
    return bodies[type as keyof typeof bodies] || bodies.order;
  }

  /**
   * Benchmark individual email processing
   */
  async benchmarkIndividualProcessing(emailCount: number): Promise<BenchmarkResult> {
    logger.info(`Starting individual processing benchmark with ${emailCount} emails`, 'BENCHMARK');
    
    const emails = this.generateTestEmails(emailCount);
    const times: number[] = [];
    const confidenceScores: number[] = [];
    let errors = 0;
    
    const startTotal = performance.now();
    
    for (const email of emails) {
      const startTime = performance.now();
      
      try {
        const analysis = await this.agent.analyzeEmail(email);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        confidenceScores.push(analysis.confidence);
      } catch (error) {
        errors++;
        logger.error(`Failed to analyze email ${email.id}`, 'BENCHMARK', { error });
      }
    }
    
    const endTotal = performance.now();
    const totalTime = endTotal - startTotal;
    
    const result: BenchmarkResult = {
      testName: 'Individual Processing',
      totalEmails: emailCount,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      confidenceScores,
      errors
    };
    
    this.results.push(result);
    return result;
  }

  /**
   * Benchmark batch processing
   */
  async benchmarkBatchProcessing(emailCount: number, concurrency: number): Promise<BenchmarkResult> {
    logger.info(`Starting batch processing benchmark with ${emailCount} emails (concurrency: ${concurrency})`, 'BENCHMARK');
    
    const emails = this.generateTestEmails(emailCount);
    const processor = new EmailBatchProcessor(this.agent, this.cache, { concurrency });
    
    const startTime = performance.now();
    const results = await processor.processBatch(emails);
    const endTime = performance.now();
    
    const totalTime = endTime - startTime;
    const times = results.map(r => r.processingTime || 0);
    const confidenceScores = results
      .filter(r => r.success && r.analysis)
      .map(r => r.analysis!.confidence);
    const errors = results.filter(r => !r.success).length;
    
    const result: BenchmarkResult = {
      testName: `Batch Processing (concurrency: ${concurrency})`,
      totalEmails: emailCount,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      confidenceScores,
      errors
    };
    
    this.results.push(result);
    return result;
  }

  /**
   * Benchmark cache performance
   */
  async benchmarkCachePerformance(emailCount: number): Promise<BenchmarkResult> {
    logger.info(`Starting cache performance benchmark`, 'BENCHMARK');
    
    // First pass - populate cache
    const emails = this.generateTestEmails(emailCount);
    await this.benchmarkIndividualProcessing(emailCount);
    
    // Clear previous results
    this.results.pop();
    
    // Second pass - should hit cache
    const times: number[] = [];
    const confidenceScores: number[] = [];
    let errors = 0;
    let cacheHits = 0;
    
    const startTotal = performance.now();
    
    for (const email of emails) {
      const startTime = performance.now();
      const cacheStatsBefore = this.cache.getStats();
      
      try {
        const analysis = await this.agent.analyzeEmail(email);
        const endTime = performance.now();
        const cacheStatsAfter = this.cache.getStats();
        
        if (cacheStatsAfter.hits > cacheStatsBefore.hits) {
          cacheHits++;
        }
        
        times.push(endTime - startTime);
        confidenceScores.push(analysis.confidence);
      } catch (error) {
        errors++;
      }
    }
    
    const endTotal = performance.now();
    const totalTime = endTotal - startTotal;
    
    const result: BenchmarkResult = {
      testName: 'Cache Performance',
      totalEmails: emailCount,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      cacheHitRate: cacheHits / emailCount,
      confidenceScores,
      errors
    };
    
    this.results.push(result);
    return result;
  }

  /**
   * Benchmark model switching performance
   */
  async benchmarkModelSwitching(emailCount: number): Promise<BenchmarkResult> {
    logger.info(`Starting model switching benchmark`, 'BENCHMARK');
    
    // Generate emails that will trigger model switching (low confidence)
    const emails = this.generateTestEmails(emailCount).map(email => ({
      ...email,
      subject: 'Ambiguous request needs clarification',
      body: 'This is a complex multi-part request that might need deeper analysis.'
    }));
    
    const times: number[] = [];
    const confidenceScores: number[] = [];
    let errors = 0;
    
    const startTotal = performance.now();
    
    for (const email of emails) {
      const startTime = performance.now();
      
      try {
        const analysis = await this.agent.analyzeEmail(email);
        const endTime = performance.now();
        
        times.push(endTime - startTime);
        confidenceScores.push(analysis.confidence);
      } catch (error) {
        errors++;
      }
    }
    
    const endTotal = performance.now();
    const totalTime = endTotal - startTotal;
    
    const result: BenchmarkResult = {
      testName: 'Model Switching',
      totalEmails: emailCount,
      totalTime,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      confidenceScores,
      errors
    };
    
    this.results.push(result);
    return result;
  }

  /**
   * Generate benchmark report
   */
  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('EMAIL ANALYSIS PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80));
    
    for (const result of this.results) {
      console.log(`\n📊 ${result.testName}`);
      console.log('-'.repeat(50));
      console.log(`Total Emails: ${result.totalEmails}`);
      console.log(`Total Time: ${result.totalTime.toFixed(2)}ms`);
      console.log(`Average Time: ${result.avgTime.toFixed(2)}ms`);
      console.log(`Min Time: ${result.minTime.toFixed(2)}ms`);
      console.log(`Max Time: ${result.maxTime.toFixed(2)}ms`);
      console.log(`Throughput: ${(result.totalEmails / (result.totalTime / 1000)).toFixed(2)} emails/sec`);
      
      if (result.cacheHitRate !== undefined) {
        console.log(`Cache Hit Rate: ${(result.cacheHitRate * 100).toFixed(1)}%`);
      }
      
      const avgConfidence = result.confidenceScores.reduce((a, b) => a + b, 0) / result.confidenceScores.length;
      console.log(`Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`Errors: ${result.errors}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('CACHE STATISTICS');
    console.log('='.repeat(80));
    const cacheStats = this.cache.getStats();
    console.log(`Size: ${cacheStats.size}`);
    console.log(`Hits: ${cacheStats.hits}`);
    console.log(`Misses: ${cacheStats.misses}`);
    console.log(`Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`Evictions: ${cacheStats.evictions}`);
  }
}

// Run benchmarks
async function runBenchmarks() {
  const benchmark = new EmailAnalysisBenchmark();
  
  try {
    await benchmark.initialize();
    
    // Run various benchmarks
    await benchmark.benchmarkIndividualProcessing(50);
    await benchmark.benchmarkBatchProcessing(100, 5);
    await benchmark.benchmarkBatchProcessing(100, 10);
    await benchmark.benchmarkCachePerformance(50);
    await benchmark.benchmarkModelSwitching(20);
    
    // Generate report
    benchmark.generateReport();
    
  } catch (error) {
    logger.error('Benchmark failed', 'BENCHMARK', { error });
    console.error('❌ Benchmark execution failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  console.log('🚀 Starting Email Analysis Performance Benchmarks...\n');
  
  runBenchmarks()
    .then(() => {
      console.log('\n✅ Benchmarks completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Benchmark execution failed:', error);
      process.exit(1);
    });
}