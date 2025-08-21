/**
 * Performance Benchmark Tests for CrewAI Agent System
 * 
 * This test suite measures and benchmarks the performance of each agent
 * under various load conditions and generates detailed metrics.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';

// Import agents and core services
import { MasterOrchestrator } from '../../src/core/master-orchestrator/MasterOrchestrator';
import { ResearchAgent } from '../../src/core/agents/specialized/ResearchAgent';
import { CodeAgent } from '../../src/core/agents/specialized/CodeAgent';
import { DataAnalysisAgent } from '../../src/core/agents/specialized/DataAnalysisAgent';
import { WriterAgent } from '../../src/core/agents/specialized/WriterAgent';
import { ToolExecutorAgent } from '../../src/core/agents/specialized/ToolExecutorAgent';
import { EmailAnalysisAgent } from '../../src/core/agents/specialized/EmailAnalysisAgent';
import { RAGSystem } from '../../src/core/rag/RAGSystem';
import { LLMProviderManager } from '../../src/core/llm/LLMProviderManager';

interface BenchmarkResult {
  agentName: string;
  operation: string;
  iterations: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50: number;
  p95: number;
  p99: number;
  throughput: number;
  errorRate: number;
  memoryUsage: {
    initial: NodeJS.MemoryUsage;
    peak: NodeJS.MemoryUsage;
    final: NodeJS.MemoryUsage;
  };
}

class BenchmarkRunner {
  private results: BenchmarkResult[] = [];

  async runBenchmark(
    name: string,
    operation: string,
    fn: () => Promise<any>,
    iterations: number = 100
  ): Promise<BenchmarkResult> {
    const responseTimes: number[] = [];
    let errors = 0;
    const initialMemory = process.memoryUsage();
    let peakMemory = initialMemory;

    console.log(`\\nRunning benchmark: ${name} - ${operation} (${iterations} iterations)`);

    for (let i = 0; i < iterations; i++) {
      if (i % 10 === 0) {
        process.stdout.write(`\\rProgress: ${i}/${iterations}`);
      }

      const startTime = performance.now();
      
      try {
        await fn();
        const responseTime = performance.now() - startTime;
        responseTimes.push(responseTime);
      } catch (error) {
        errors++;
        responseTimes.push(performance.now() - startTime);
      }

      // Track peak memory
      const currentMemory = process.memoryUsage();
      if (currentMemory.heapUsed > peakMemory.heapUsed) {
        peakMemory = currentMemory;
      }
    }

    process.stdout.write(`\\rProgress: ${iterations}/${iterations} - Complete\\n`);

    const finalMemory = process.memoryUsage();

    // Calculate statistics
    responseTimes.sort((a, b) => a - b);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = responseTimes[0];
    const maxResponseTime = responseTimes[responseTimes.length - 1];
    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)];
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    const p99 = responseTimes[Math.floor(responseTimes.length * 0.99)];
    const totalTime = responseTimes.reduce((a, b) => a + b, 0);
    const throughput = (iterations / totalTime) * 1000; // ops per second

    const result: BenchmarkResult = {
      agentName: name,
      operation,
      iterations,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p50,
      p95,
      p99,
      throughput,
      errorRate: (errors / iterations) * 100,
      memoryUsage: {
        initial: initialMemory,
        peak: peakMemory,
        final: finalMemory
      }
    };

    this.results.push(result);
    return result;
  }

  generateReport(): string {
    let report = '\\n=== PERFORMANCE BENCHMARK REPORT ===\\n';
    report += `Generated: ${new Date().toISOString()}\\n\\n`;

    // Group results by agent
    const agentGroups = new Map<string, BenchmarkResult[]>();
    this.results.forEach(result => {
      if (!agentGroups.has(result.agentName)) {
        agentGroups.set(result.agentName, []);
      }
      agentGroups.get(result.agentName)!.push(result);
    });

    // Generate report for each agent
    agentGroups.forEach((results, agentName) => {
      report += `\\n## ${agentName}\\n`;
      report += '─'.repeat(50) + '\\n';

      results.forEach(result => {
        report += `\\n### Operation: ${result.operation}\\n`;
        report += `Iterations: ${result.iterations}\\n`;
        report += `\\nResponse Times (ms):\\n`;
        report += `  Average: ${result.avgResponseTime.toFixed(2)}\\n`;
        report += `  Min: ${result.minResponseTime.toFixed(2)}\\n`;
        report += `  Max: ${result.maxResponseTime.toFixed(2)}\\n`;
        report += `  P50: ${result.p50.toFixed(2)}\\n`;
        report += `  P95: ${result.p95.toFixed(2)}\\n`;
        report += `  P99: ${result.p99.toFixed(2)}\\n`;
        report += `\\nPerformance:\\n`;
        report += `  Throughput: ${result.throughput.toFixed(2)} ops/sec\\n`;
        report += `  Error Rate: ${result.errorRate.toFixed(2)}%\\n`;
        report += `\\nMemory Usage:\\n`;
        report += `  Initial: ${(result.memoryUsage.initial.heapUsed / 1024 / 1024).toFixed(2)} MB\\n`;
        report += `  Peak: ${(result.memoryUsage.peak.heapUsed / 1024 / 1024).toFixed(2)} MB\\n`;
        report += `  Final: ${(result.memoryUsage.final.heapUsed / 1024 / 1024).toFixed(2)} MB\\n`;
        report += `  Delta: ${((result.memoryUsage.final.heapUsed - result.memoryUsage.initial.heapUsed) / 1024 / 1024).toFixed(2)} MB\\n`;
      });
    });

    // Overall summary
    report += '\\n## SUMMARY\\n';
    report += '─'.repeat(50) + '\\n';
    
    const totalOps = this.results.reduce((sum, r) => sum + r.iterations, 0);
    const avgThroughput = this.results.reduce((sum, r) => sum + r.throughput, 0) / this.results.length;
    const avgErrorRate = this.results.reduce((sum, r) => sum + r.errorRate, 0) / this.results.length;
    
    report += `Total Operations: ${totalOps}\\n`;
    report += `Average Throughput: ${avgThroughput.toFixed(2)} ops/sec\\n`;
    report += `Average Error Rate: ${avgErrorRate.toFixed(2)}%\\n`;

    return report;
  }

  saveReport(filename: string): void {
    const report = this.generateReport();
    const reportPath = path.join(process.cwd(), 'tests', 'performance', 'reports', filename);
    
    // Ensure directory exists
    const dir = path.dirname(reportPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(reportPath, report);
    console.log(`\\nReport saved to: ${reportPath}`);
  }

  getResults(): BenchmarkResult[] {
    return this.results;
  }
}

describe('Agent System Performance Benchmarks', () => {
  let benchmarkRunner: BenchmarkRunner;
  let db: Database.Database;
  let ragSystem: RAGSystem;
  let llmManager: LLMProviderManager;
  let masterOrchestrator: MasterOrchestrator;

  beforeAll(async () => {
    benchmarkRunner = new BenchmarkRunner();
    
    // Initialize test database
    db = new Database(':memory:');
    
    // Initialize RAG system
    ragSystem = new RAGSystem({
      provider: 'in-memory',
      embeddingModel: 'test'
    });

    // Initialize LLM provider
    llmManager = LLMProviderManager.getInstance();
    await llmManager.initialize({
      primary: 'ollama',
      fallback: 'mock',
      models: {
        primary: 'llama3.2:3b',
        fallback: 'mock-model'
      }
    });

    // Initialize master orchestrator
    masterOrchestrator = new MasterOrchestrator({
      llmProvider: llmManager,
      ragSystem
    });

    // Warm up the system
    console.log('Warming up system...');
    await masterOrchestrator.createPlan('test query');
  });

  afterAll(async () => {
    // Save benchmark report
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    benchmarkRunner.saveReport(`benchmark-report-${timestamp}.txt`);
    
    // Cleanup
    if (db) db.close();
  });

  describe('MasterOrchestrator Benchmarks', () => {
    it('should benchmark plan creation', async () => {
      const queries = [
        'Simple task',
        'Analyze email data and generate report',
        'Complex multi-step workflow with code generation and testing'
      ];

      for (const query of queries) {
        await benchmarkRunner.runBenchmark(
          'MasterOrchestrator',
          `plan-creation-${query.length}chars`,
          async () => {
            await masterOrchestrator.createPlan(query);
          },
          50
        );
      }
    });

    it('should benchmark plan execution', async () => {
      const plan = await masterOrchestrator.createPlan('Generate test data');
      
      await benchmarkRunner.runBenchmark(
        'MasterOrchestrator',
        'plan-execution',
        async () => {
          await masterOrchestrator.executePlan(plan);
        },
        20
      );
    });
  });

  describe('ResearchAgent Benchmarks', () => {
    let researchAgent: ResearchAgent;

    beforeAll(() => {
      researchAgent = new ResearchAgent({
        llmProvider: llmManager,
        ragSystem
      });
    });

    it('should benchmark semantic search', async () => {
      // Add test documents
      for (let i = 0; i < 1000; i++) {
        await ragSystem.addDocument({
          id: `doc-${i}`,
          content: `Document ${i} contains information about topic ${i % 10}`,
          metadata: { category: `cat-${i % 5}` }
        });
      }

      await benchmarkRunner.runBenchmark(
        'ResearchAgent',
        'semantic-search',
        async () => {
          await researchAgent.search('topic 5');
        },
        100
      );
    });

    it('should benchmark document retrieval', async () => {
      await benchmarkRunner.runBenchmark(
        'ResearchAgent',
        'document-retrieval',
        async () => {
          await researchAgent.retrieveDocuments({
            query: 'information',
            limit: 10
          });
        },
        100
      );
    });
  });

  describe('CodeAgent Benchmarks', () => {
    let codeAgent: CodeAgent;

    beforeAll(() => {
      codeAgent = new CodeAgent({
        llmProvider: llmManager,
        ragSystem
      });
    });

    it('should benchmark code generation', async () => {
      const tasks = [
        { complexity: 'simple', description: 'Add two numbers' },
        { complexity: 'medium', description: 'Sort an array using quicksort' },
        { complexity: 'complex', description: 'Implement a binary search tree with all operations' }
      ];

      for (const task of tasks) {
        await benchmarkRunner.runBenchmark(
          'CodeAgent',
          `code-generation-${task.complexity}`,
          async () => {
            await codeAgent.generateCode({
              task: task.description,
              language: 'typescript'
            });
          },
          30
        );
      }
    });

    it('should benchmark code review', async () => {
      const codeSnippet = `
        function processData(data: any[]) {
          for (let i = 0; i < data.length; i++) {
            console.log(data[i]);
          }
        }
      `;

      await benchmarkRunner.runBenchmark(
        'CodeAgent',
        'code-review',
        async () => {
          await codeAgent.reviewCode(codeSnippet);
        },
        50
      );
    });
  });

  describe('DataAnalysisAgent Benchmarks', () => {
    let dataAnalysisAgent: DataAnalysisAgent;

    beforeAll(() => {
      dataAnalysisAgent = new DataAnalysisAgent({
        llmProvider: llmManager,
        database: db
      });

      // Create test data
      db.exec(`
        CREATE TABLE IF NOT EXISTS test_data (
          id INTEGER PRIMARY KEY,
          value REAL,
          category TEXT,
          timestamp INTEGER
        )
      `);

      const stmt = db.prepare('INSERT INTO test_data VALUES (?, ?, ?, ?)');
      for (let i = 0; i < 10000; i++) {
        stmt.run(i, Math.random() * 100, `cat-${i % 10}`, Date.now() - i * 1000);
      }
    });

    it('should benchmark data analysis', async () => {
      await benchmarkRunner.runBenchmark(
        'DataAnalysisAgent',
        'data-analysis',
        async () => {
          await dataAnalysisAgent.analyzePatterns({
            table: 'test_data',
            metrics: ['average', 'distribution', 'trends']
          });
        },
        50
      );
    });

    it('should benchmark report generation', async () => {
      await benchmarkRunner.runBenchmark(
        'DataAnalysisAgent',
        'report-generation',
        async () => {
          await dataAnalysisAgent.generateReport({
            type: 'statistical',
            timeframe: 'all',
            metrics: ['summary', 'charts']
          });
        },
        30
      );
    });
  });

  describe('EmailAnalysisAgent Benchmarks', () => {
    let emailAgent: EmailAnalysisAgent;

    beforeAll(() => {
      emailAgent = new EmailAnalysisAgent({
        database: db,
        llmProvider: llmManager
      });

      // Create email table
      db.exec(`
        CREATE TABLE IF NOT EXISTS emails (
          id TEXT PRIMARY KEY,
          subject TEXT,
          body TEXT,
          sender TEXT,
          timestamp INTEGER
        )
      `);

      // Insert test emails
      const stmt = db.prepare('INSERT INTO emails VALUES (?, ?, ?, ?, ?)');
      for (let i = 0; i < 1000; i++) {
        stmt.run(
          `email-${i}`,
          `Subject ${i}`,
          `Email body with content about topic ${i % 20}`,
          `sender${i % 50}@example.com`,
          Date.now() - i * 3600000
        );
      }
    });

    it('should benchmark email analysis', async () => {
      await benchmarkRunner.runBenchmark(
        'EmailAnalysisAgent',
        'email-analysis',
        async () => {
          await emailAgent.analyzeEmail({
            id: 'email-1',
            subject: 'Test Subject',
            body: 'Test email body with important content',
            sender: 'test@example.com',
            timestamp: new Date()
          });
        },
        100
      );
    });

    it('should benchmark batch processing', async () => {
      const emails = Array.from({ length: 10 }, (_, i) => ({
        id: `batch-${i}`,
        subject: `Batch Subject ${i}`,
        body: `Batch email body ${i}`,
        sender: `batch${i}@example.com`,
        timestamp: new Date()
      }));

      await benchmarkRunner.runBenchmark(
        'EmailAnalysisAgent',
        'batch-processing',
        async () => {
          await emailAgent.processBatch(emails);
        },
        20
      );
    });

    it('should benchmark chain detection', async () => {
      await benchmarkRunner.runBenchmark(
        'EmailAnalysisAgent',
        'chain-detection',
        async () => {
          await emailAgent.detectChains({
            timeWindow: 7 * 24 * 3600000, // 7 days
            minChainLength: 2
          });
        },
        30
      );
    });
  });

  describe('Concurrent Agent Benchmarks', () => {
    it('should benchmark concurrent agent execution', async () => {
      const agents = [
        new ResearchAgent({ llmProvider: llmManager, ragSystem }),
        new CodeAgent({ llmProvider: llmManager, ragSystem }),
        new DataAnalysisAgent({ llmProvider: llmManager, database: db })
      ];

      await benchmarkRunner.runBenchmark(
        'MultiAgent',
        'concurrent-execution',
        async () => {
          await Promise.all(agents.map(agent => 
            agent.execute({ task: 'concurrent test' })
          ));
        },
        50
      );
    });

    it('should benchmark agent pipeline', async () => {
      await benchmarkRunner.runBenchmark(
        'MultiAgent',
        'pipeline-execution',
        async () => {
          // Research -> Analysis -> Writing pipeline
          const researchResult = await new ResearchAgent({ 
            llmProvider: llmManager, 
            ragSystem 
          }).search('test topic');
          
          const analysisResult = await new DataAnalysisAgent({ 
            llmProvider: llmManager, 
            database: db 
          }).analyzeData(researchResult);
          
          await new WriterAgent({ 
            llmProvider: llmManager 
          }).generateContent({
            type: 'report',
            data: analysisResult
          });
        },
        20
      );
    });
  });

  describe('Memory and Resource Benchmarks', () => {
    it('should benchmark memory usage under load', async () => {
      const iterations = 100;
      const memorySnapshots: NodeJS.MemoryUsage[] = [];

      for (let i = 0; i < iterations; i++) {
        // Perform various operations
        await masterOrchestrator.createPlan(`Query ${i}`);
        
        // Take memory snapshot every 10 iterations
        if (i % 10 === 0) {
          memorySnapshots.push(process.memoryUsage());
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Analyze memory growth
      const initialMemory = memorySnapshots[0].heapUsed;
      const finalMemory = memorySnapshots[memorySnapshots.length - 1].heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      console.log(`\\nMemory Growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB over ${iterations} iterations`);
      
      expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024); // Less than 100MB growth
    });

    it('should benchmark recovery from memory pressure', async () => {
      // Create memory pressure
      const largeDataSets: any[] = [];
      for (let i = 0; i < 100; i++) {
        largeDataSets.push(new Array(10000).fill(`data-${i}`));
      }

      const beforeMemory = process.memoryUsage().heapUsed;

      // Clear large datasets
      largeDataSets.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait for memory to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      const afterMemory = process.memoryUsage().heapUsed;
      const memoryRecovered = beforeMemory - afterMemory;

      console.log(`\\nMemory Recovered: ${(memoryRecovered / 1024 / 1024).toFixed(2)} MB`);
      
      expect(memoryRecovered).toBeGreaterThan(0);
    });
  });

  describe('Latency Distribution Analysis', () => {
    it('should analyze latency distribution', async () => {
      const operations = [
        { name: 'quick', fn: async () => new Promise(r => setTimeout(r, 10)) },
        { name: 'medium', fn: async () => new Promise(r => setTimeout(r, 50)) },
        { name: 'slow', fn: async () => new Promise(r => setTimeout(r, 200)) }
      ];

      for (const op of operations) {
        const latencies: number[] = [];
        
        for (let i = 0; i < 100; i++) {
          const start = performance.now();
          await op.fn();
          latencies.push(performance.now() - start);
        }

        // Calculate distribution
        latencies.sort((a, b) => a - b);
        const distribution = {
          min: latencies[0],
          p25: latencies[Math.floor(latencies.length * 0.25)],
          p50: latencies[Math.floor(latencies.length * 0.50)],
          p75: latencies[Math.floor(latencies.length * 0.75)],
          p90: latencies[Math.floor(latencies.length * 0.90)],
          p95: latencies[Math.floor(latencies.length * 0.95)],
          p99: latencies[Math.floor(latencies.length * 0.99)],
          max: latencies[latencies.length - 1]
        };

        console.log(`\\nLatency Distribution for ${op.name}:`);
        console.log(JSON.stringify(distribution, null, 2));
      }
    });
  });
});