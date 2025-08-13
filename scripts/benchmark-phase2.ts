#!/usr/bin/env tsx
/**
 * Phase 2 Performance Benchmark
 * Tests various optimization strategies for Phase 2 processing
 */

import { performance } from "perf_hooks";
import { Logger } from "../src/utils/logger.js";
import { EmailProcessingOptimizer } from "../src/core/services/EmailProcessingOptimizer.js";
import { promptOptimizer } from "../src/core/prompts/PromptOptimizer.js";
import axios from "axios";
import type { EmailInput, Phase1Results } from "../src/core/services/EmailThreePhaseAnalysisService.js";

const logger = new Logger("Phase2Benchmark");

interface BenchmarkResult {
  strategy: string;
  avgResponseTime: number;
  minTime: number;
  maxTime: number;
  successRate: number;
  tokensUsed: number;
  promptLength: number;
}

class Phase2Benchmark {
  private optimizer: EmailProcessingOptimizer;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.optimizer = new EmailProcessingOptimizer({
      maxConnections: 10,
      enableSmartCaching: false, // Disable for accurate benchmarks
    });
  }

  async runBenchmarks(): Promise<void> {
    logger.info("Starting Phase 2 benchmarks...");

    // Generate test data
    const testEmails = this.generateTestEmails(20);
    const testPhase1Results = testEmails.map(email => this.generatePhase1Results(email));

    // Benchmark different strategies
    await this.benchmarkStrategy("baseline", testEmails, testPhase1Results, {
      optimization: "none",
      promptCompression: "none",
      temperature: 0.7,
      maxTokens: 1200,
    });

    await this.benchmarkStrategy("optimized_prompt", testEmails, testPhase1Results, {
      optimization: "prompt",
      promptCompression: "high",
      temperature: 0.1,
      maxTokens: 800,
    });

    await this.benchmarkStrategy("parallel_processing", testEmails, testPhase1Results, {
      optimization: "parallel",
      promptCompression: "medium",
      temperature: 0.1,
      maxTokens: 800,
      parallel: 5,
    });

    await this.benchmarkStrategy("ultra_compressed", testEmails, testPhase1Results, {
      optimization: "ultra",
      promptCompression: "high",
      temperature: 0.05,
      maxTokens: 500,
      jsonOnly: true,
    });

    await this.benchmarkStrategy("cached_templates", testEmails, testPhase1Results, {
      optimization: "cached",
      promptCompression: "medium",
      temperature: 0.1,
      maxTokens: 800,
      useTemplates: true,
    });

    // Display results
    this.displayResults();
  }

  private async benchmarkStrategy(
    name: string,
    emails: EmailInput[],
    phase1Results: Phase1Results[],
    config: any
  ): Promise<void> {
    logger.info(`\nBenchmarking strategy: ${name}`);
    
    const times: number[] = [];
    let successCount = 0;
    let totalTokens = 0;
    let totalPromptLength = 0;

    for (let i = 0; i < emails.length; i++) {
      const startTime = performance.now();
      
      try {
        const prompt = this.buildPrompt(emails[i], phase1Results[i], config);
        totalPromptLength += prompt.length;

        const response = await this.callOllama(prompt, config);
        
        if (response) {
          successCount++;
          totalTokens += response.tokens || 0;
        }

        const elapsed = performance.now() - startTime;
        times.push(elapsed);
        
        // Brief delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        logger.debug(`Strategy ${name} failed for email ${i}:`, error);
        times.push(30000); // Penalty for failure
      }
    }

    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const successRate = (successCount / emails.length) * 100;

    this.results.push({
      strategy: name,
      avgResponseTime: avgTime,
      minTime,
      maxTime,
      successRate,
      tokensUsed: Math.round(totalTokens / emails.length),
      promptLength: Math.round(totalPromptLength / emails.length),
    });

    logger.info(`  Average: ${avgTime.toFixed(0)}ms, Success: ${successRate.toFixed(1)}%`);
  }

  private buildPrompt(email: EmailInput, phase1: Phase1Results, config: any): string {
    if (config.optimization === "none") {
      // Baseline - full prompt
      return `Analyze this email and provide a comprehensive response.

Email Subject: ${email.subject}
Email Body: ${email.body || email.body_preview}
Sender: ${email.sender_email}

Phase 1 Analysis:
${JSON.stringify(phase1, null, 2)}

Please provide a detailed JSON response with the following fields:
- workflow_validation: Detailed validation of the workflow state
- missed_entities: Any entities that might have been missed in Phase 1
- action_items: List of action items with owners and deadlines
- risk_assessment: Comprehensive risk assessment
- initial_response: Draft response to the email
- confidence: Your confidence level (0-1)
- business_process: The identified business process`;
    }

    if (config.optimization === "prompt") {
      // Use prompt optimizer
      return promptOptimizer.optimizePhase2Prompt(email, phase1, {
        maxTokens: config.maxTokens,
        compressionLevel: config.promptCompression,
      });
    }

    if (config.optimization === "ultra") {
      // Ultra-compressed prompt
      return `${email.subject?.substring(0, 50)}
${phase1.workflow_state}/${phase1.priority}
Entities:${phase1.entities.po_numbers.length}PO,${phase1.entities.quote_numbers.length}Q
JSON:{workflow_validation,missed_entities,action_items,risk_assessment,initial_response,confidence,business_process}`;
    }

    if (config.optimization === "cached") {
      // Template-based prompt
      const template = this.getTemplateForWorkflow(phase1.workflow_state);
      return template
        .replace("{SUBJECT}", email.subject?.substring(0, 100) || "")
        .replace("{PRIORITY}", phase1.priority)
        .replace("{ENTITIES}", `PO:${phase1.entities.po_numbers.length}`);
    }

    // Default to optimized
    return promptOptimizer.optimizePhase2Prompt(email, phase1);
  }

  private async callOllama(prompt: string, config: any): Promise<any> {
    try {
      const response = await axios.post(
        "http://localhost:11434/api/generate",
        {
          model: "llama3.2:3b",
          prompt,
          stream: false,
          format: config.jsonOnly ? "json" : undefined,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
            num_ctx: 4096,
            seed: 42, // Fixed seed for reproducibility
          },
        },
        {
          timeout: 30000,
        }
      );

      return {
        text: response.data.response,
        tokens: response.data.eval_count || 0,
      };
    } catch (error) {
      throw error;
    }
  }

  private generateTestEmails(count: number): EmailInput[] {
    const templates = [
      {
        subject: "Urgent: PO 12345678 delayed - need immediate action",
        body: "Customer ABC Corp is extremely unhappy about the delay. They're threatening to cancel the entire order worth $50,000. We need to expedite shipping immediately.",
        priority: "high",
      },
      {
        subject: "Quote request for enterprise servers",
        body: "Please provide pricing for 10x DL380 Gen11 servers with max RAM configuration. Customer needs delivery by end of month.",
        priority: "medium",
      },
      {
        subject: "Order confirmation #98765432",
        body: "Thank you for your order. Your items will be shipped within 2-3 business days. Tracking information will be sent separately.",
        priority: "low",
      },
    ];

    const emails: EmailInput[] = [];
    for (let i = 0; i < count; i++) {
      const template = templates[i % templates.length];
      emails.push({
        id: `test_${i}`,
        subject: template.subject,
        body: template.body,
        sender_email: `customer${i}@example.com`,
        recipient_emails: "orders@company.com",
        received_at: new Date().toISOString(),
        importance: template.priority === "high" ? "high" : "normal",
      });
    }

    return emails;
  }

  private generatePhase1Results(email: EmailInput): Phase1Results {
    const isUrgent = email.subject?.toLowerCase().includes("urgent") || false;
    const hasOrder = email.body?.match(/PO \d+/i) || email.subject?.match(/PO \d+/i);
    
    return {
      workflow_state: hasOrder ? "ORDER_MANAGEMENT" : "QUOTE_PROCESSING",
      priority: isUrgent ? "high" : "medium",
      entities: {
        po_numbers: hasOrder ? ["12345678"] : [],
        quote_numbers: email.subject?.includes("quote") ? ["Q123456"] : [],
        case_numbers: [],
        part_numbers: ["DL380-G11"],
        dollar_amounts: ["$50,000"],
        dates: ["2024-12-31"],
        contacts: [email.sender_email],
      },
      key_phrases: isUrgent ? ["urgent", "immediate action"] : ["quote request"],
      sender_category: "customer",
      urgency_score: isUrgent ? 8 : 3,
      financial_impact: 50000,
      processing_time: 50,
      detected_patterns: isUrgent ? ["high_urgency", "customer_dissatisfaction"] : [],
      chain_analysis: {
        chain_id: `chain_${email.id}`,
        is_complete_chain: Math.random() > 0.5,
        chain_length: 3,
        completeness_score: 0.75,
        chain_type: "order_workflow",
        missing_elements: [],
      },
    };
  }

  private getTemplateForWorkflow(workflow: string): string {
    const templates: Record<string, string> = {
      ORDER_MANAGEMENT: "Order {SUBJECT} Priority:{PRIORITY} {ENTITIES} - provide order validation and next steps",
      QUOTE_PROCESSING: "Quote request {SUBJECT} {ENTITIES} - analyze and provide pricing response",
      SHIPPING: "Shipping {SUBJECT} - validate shipping details and timeline",
    };

    return templates[workflow] || "Analyze {SUBJECT} Priority:{PRIORITY}";
  }

  private displayResults(): void {
    console.log("\n=== Phase 2 Benchmark Results ===\n");
    
    // Sort by average response time
    this.results.sort((a, b) => a.avgResponseTime - b.avgResponseTime);

    console.log("Strategy               | Avg Time | Min Time | Max Time | Success | Tokens | Prompt Size");
    console.log("-----------------------|----------|----------|----------|---------|--------|------------");
    
    this.results.forEach(result => {
      console.log(
        `${result.strategy.padEnd(22)} | ${
          this.formatTime(result.avgResponseTime).padStart(8)
        } | ${
          this.formatTime(result.minTime).padStart(8)
        } | ${
          this.formatTime(result.maxTime).padStart(8)
        } | ${
          (result.successRate.toFixed(1) + '%').padStart(7)
        } | ${
          result.tokensUsed.toString().padStart(6)
        } | ${
          result.promptLength.toString().padStart(11)
        }`
      );
    });

    // Calculate improvements
    const baseline = this.results.find(r => r.strategy === "baseline");
    const best = this.results[0];
    
    if (baseline && best && baseline !== best) {
      const improvement = ((baseline.avgResponseTime - best.avgResponseTime) / baseline.avgResponseTime) * 100;
      const tokenReduction = ((baseline.tokensUsed - best.tokensUsed) / baseline.tokensUsed) * 100;
      
      console.log(`\n✨ Best strategy: ${best.strategy}`);
      console.log(`   Performance improvement: ${improvement.toFixed(1)}%`);
      console.log(`   Token reduction: ${tokenReduction.toFixed(1)}%`);
      console.log(`   Throughput estimate: ${Math.round(60000 / best.avgResponseTime)} emails/minute`);
    }
  }

  private formatTime(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    } else {
      return `${(ms / 1000).toFixed(1)}s`;
    }
  }
}

// Main execution
async function main() {
  const benchmark = new Phase2Benchmark();
  
  try {
    await benchmark.runBenchmarks();
  } catch (error) {
    logger.error("Benchmark failed:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { Phase2Benchmark };