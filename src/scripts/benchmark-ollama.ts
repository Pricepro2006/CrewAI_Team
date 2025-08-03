#!/usr/bin/env node
/**
 * Ollama Performance Benchmark Script
 * Tests throughput capabilities for email processing
 */

import axios from "axios";
import { performance } from "perf_hooks";
import { logger } from "../utils/logger.js";
import { OllamaOptimizer } from "../core/services/OllamaOptimizer.js";

interface BenchmarkConfig {
  models: string[];
  testSizes: number[];
  iterations: number;
  concurrencyLevels: number[];
}

interface BenchmarkResult {
  model: string;
  concurrency: number;
  batchSize: number;
  totalEmails: number;
  totalTime: number;
  throughput: number; // emails per second
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
  successRate: number;
}

class OllamaBenchmark {
  private optimizer: OllamaOptimizer;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.optimizer = new OllamaOptimizer();
  }

  async run(config: BenchmarkConfig): Promise<void> {
    logger.info("Starting Ollama benchmark...");

    // Test each combination
    for (const model of config.models) {
      for (const concurrency of config.concurrencyLevels) {
        for (const batchSize of config.testSizes) {
          await this.runBenchmark(model, concurrency, batchSize, config.iterations);
        }
      }
    }

    // Print results
    this.printResults();
    
    // Save results
    await this.saveResults();
  }

  private async runBenchmark(
    model: string,
    concurrency: number,
    batchSize: number,
    iterations: number
  ): Promise<void> {
    logger.info(`\nBenchmarking ${model} with concurrency=${concurrency}, batch=${batchSize}`);

    // Update optimizer config
    this.optimizer.updateConfig({
      maxConcurrentInference: concurrency,
      queueConcurrency: concurrency,
      maxBatchSize: batchSize
    });

    const totalEmails = batchSize * iterations;
    const latencies: number[] = [];
    let successCount = 0;
    const startTime = performance.now();

    // Generate test emails
    const testEmails = this.generateTestEmails(totalEmails);

    // Process emails
    const promises = testEmails.map(async (email, index) => {
      const emailStart = performance.now();
      
      try {
        await this.optimizer.generate(
          this.buildEmailPrompt(email),
          model,
          {
            temperature: 0.1,
            num_predict: 500,
            format: "json"
          }
        );
        
        const latency = performance.now() - emailStart;
        latencies.push(latency);
        successCount++;
        
        if ((index + 1) % 10 === 0) {
          logger.debug(`Processed ${index + 1}/${totalEmails} emails`);
        }
      } catch (error) {
        logger.debug(`Failed email ${index}: ${error}`);
      }
    });

    // Wait for all to complete
    await Promise.all(promises);

    const totalTime = performance.now() - startTime;
    const throughput = (successCount / totalTime) * 1000; // per second

    // Calculate latency percentiles
    const sortedLatencies = latencies.sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;

    // Store result
    const result: BenchmarkResult = {
      model,
      concurrency,
      batchSize,
      totalEmails,
      totalTime: totalTime / 1000, // seconds
      throughput,
      avgLatency,
      p95Latency,
      p99Latency,
      successRate: (successCount / totalEmails) * 100
    };

    this.results.push(result);

    // Print immediate result
    logger.info(`Results for ${model}:`);
    logger.info(`  Throughput: ${throughput.toFixed(2)} emails/sec (${(throughput * 60).toFixed(0)} emails/min)`);
    logger.info(`  Success Rate: ${result.successRate.toFixed(1)}%`);
    logger.info(`  Avg Latency: ${avgLatency.toFixed(0)}ms`);
    logger.info(`  P95 Latency: ${p95Latency.toFixed(0)}ms`);
    logger.info(`  P99 Latency: ${p99Latency.toFixed(0)}ms`);
  }

  private generateTestEmails(count: number): any[] {
    const templates = [
      {
        subject: "Urgent: Quote needed for HP servers",
        body: "We need pricing for 10x HP ProLiant DL380 Gen11 servers with expedited shipping to our Dallas datacenter by Friday."
      },
      {
        subject: "Order Status Update Request",
        body: "Can you provide an update on PO #12345678? The customer is asking about delivery timeline for their critical project."
      },
      {
        subject: "RE: Warranty claim for damaged equipment",
        body: "Following up on case #98765. The replacement parts have not arrived yet and production is impacted. Please escalate."
      },
      {
        subject: "New customer onboarding - TechCorp Inc",
        body: "Please set up account for TechCorp Inc. They need pricing on Cisco switches, Dell servers, and Microsoft licenses."
      },
      {
        subject: "Invoice discrepancy - Account #54321",
        body: "There's a $5,432.10 difference between the quote and invoice. Please review and correct before month-end closing."
      }
    ];

    const emails = [];
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      emails.push({
        id: `test-${i}`,
        ...template,
        received_at: new Date().toISOString()
      });
    }

    return emails;
  }

  private buildEmailPrompt(email: any): string {
    return `Analyze this email for business workflow:

Subject: ${email.subject}
Body: ${email.body}

Extract and return in JSON format:
- workflow_state: The current workflow state
- priority: Email priority (low/medium/high/critical)
- entities: Key entities found (PO numbers, amounts, etc)
- confidence: Your confidence score (0-1)
- action_items: Required actions

Respond with JSON only.`;
  }

  private printResults(): void {
    console.log("\n=== BENCHMARK RESULTS ===");
    console.log("========================");
    
    // Sort by throughput
    const sorted = [...this.results].sort((a, b) => b.throughput - a.throughput);
    
    console.log("\nTop Configurations by Throughput:");
    sorted.slice(0, 5).forEach((r, i) => {
      console.log(`\n${i + 1}. ${r.model} (C=${r.concurrency}, B=${r.batchSize})`);
      console.log(`   Throughput: ${r.throughput.toFixed(2)} emails/sec (${(r.throughput * 60).toFixed(0)} emails/min)`);
      console.log(`   Latency: ${r.avgLatency.toFixed(0)}ms avg, ${r.p95Latency.toFixed(0)}ms p95`);
      console.log(`   Success: ${r.successRate.toFixed(1)}%`);
    });

    console.log("\n\nDetailed Results Table:");
    console.log("Model                          | Conc | Batch | Throughput | Avg Latency | Success");
    console.log("-----------------------------|------|-------|------------|-------------|--------");
    
    this.results.forEach(r => {
      const modelName = r.model.padEnd(30);
      const conc = r.concurrency.toString().padEnd(5);
      const batch = r.batchSize.toString().padEnd(6);
      const throughput = `${r.throughput.toFixed(2)} e/s`.padEnd(11);
      const latency = `${r.avgLatency.toFixed(0)}ms`.padEnd(12);
      const success = `${r.successRate.toFixed(1)}%`.padEnd(7);
      
      console.log(`${modelName}| ${conc}| ${batch}| ${throughput}| ${latency}| ${success}`);
    });

    // Check if target is met
    const best = sorted[0];
    if (best && best.throughput >= 1.0) {
      console.log("\n✅ TARGET ACHIEVED! 60+ emails/minute capability confirmed!");
      console.log(`Best configuration: ${best.model} with ${best.concurrency} concurrency`);
    } else {
      console.log("\n⚠️  Target not met. Consider:");
      console.log("- Using faster hardware (GPU)");
      console.log("- Reducing model size");
      console.log("- Increasing concurrency");
      console.log("- Enabling more aggressive batching");
    }
  }

  private async saveResults(): Promise<void> {
    const fs = await import("fs/promises");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `benchmark-results-${timestamp}.json`;
    
    await fs.writeFile(
      filename,
      JSON.stringify({
        timestamp: new Date().toISOString(),
        results: this.results,
        summary: {
          bestThroughput: Math.max(...this.results.map(r => r.throughput)),
          avgSuccessRate: this.results.reduce((sum, r) => sum + r.successRate, 0) / this.results.length
        }
      }, null, 2)
    );
    
    logger.info(`Results saved to ${filename}`);
  }
}

// CLI configuration
if (require.main === module) {
  const benchmark = new OllamaBenchmark();
  
  const config: BenchmarkConfig = {
    models: [
      "llama3.2:3b",
      "qwen3:0.6b",
      "phi3:mini"
    ],
    testSizes: [10, 20, 50], // Batch sizes
    iterations: 5, // Number of batches
    concurrencyLevels: [10, 15, 20, 25] // Concurrent requests
  };

  benchmark.run(config).catch(console.error);
}

export { OllamaBenchmark };