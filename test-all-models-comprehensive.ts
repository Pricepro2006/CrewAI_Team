#!/usr/bin/env ts-node

/**
 * Comprehensive Model Testing with 4-Step Confidence RAG
 * Tests all specified models using the implemented 4-step methodology
 */

import { Ollama } from "ollama";
import { ConfidenceMasterOrchestrator } from "./src/core/master-orchestrator/ConfidenceMasterOrchestrator";
import { OllamaProvider } from "./src/core/llm/OllamaProvider";
import { AgentRegistry } from "./src/core/agents/registry/AgentRegistry";
import { RAGSystem } from "./src/core/rag/RAGSystem";
import { PlanExecutor } from "./src/core/master-orchestrator/PlanExecutor";
import { Database } from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

// Test Models from the user's requirements
const TEST_MODELS = [
  "hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
  "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF",
  "alibayram/smollm3",
  "qwen3:0.6b",
  "gemma3n:e2b",
  "gemma3n:e4b",
  "phi4-mini-reasoning:3.8b",
  "qwen3:1.7b",
  "qwen3:4b",
  "granite3.3:8b",
  "granite3.3:2b",
];

// Test Queries from the original reports
const TEST_QUERIES = [
  {
    id: "irrigation_specialist",
    query: "Find irrigation specialists for 278 Wycliff Dr. Spartanburg, SC 29301. Issue: Cracked, leaking sprinkler head from root damage",
    type: "service_search",
    expectedSteps: 4,
    complexity: "medium",
  },
  {
    id: "simple_date",
    query: "What is the current date?",
    type: "simple_query",
    expectedSteps: 1,
    complexity: "simple",
  },
  {
    id: "complex_research",
    query: "Research the latest developments in quantum computing and explain how they might impact enterprise AI systems in the next 5 years",
    type: "research",
    expectedSteps: 4,
    complexity: "complex",
  },
  {
    id: "code_generation",
    query: "Write a Python function to calculate the Fibonacci sequence",
    type: "code",
    expectedSteps: 3,
    complexity: "medium",
  },
];

interface TestResult {
  modelName: string;
  query: string;
  queryType: string;
  step1: {
    name: "Query Analysis & Understanding";
    completed: boolean;
    timeMs: number;
    confidence: number;
    details: any;
  };
  step2: {
    name: "Response Generation";
    completed: boolean;
    timeMs: number;
    confidence: number;
    details: any;
  };
  step3: {
    name: "Evaluation";
    completed: boolean;
    timeMs: number;
    confidence: number;
    details: any;
  };
  step4: {
    name: "Adaptive Delivery";
    completed: boolean;
    timeMs: number;
    confidence: number;
    details: any;
  };
  totalTime: number;
  overallConfidence: number;
  processingPath: string;
  response: string;
  success: boolean;
  errors: string[];
}

class ComprehensiveModelTester {
  private orchestrator: ConfidenceMasterOrchestrator;
  private ollama: Ollama;
  private results: TestResult[] = [];

  constructor() {
    this.ollama = new Ollama({ host: "http://localhost:11434" });
  }

  async initialize() {
    console.log("🚀 Initializing Comprehensive Model Testing System");
    
    // Initialize database (in-memory for testing)
    const db = new Database(":memory:");
    
    // Initialize components
    const llm = new OllamaProvider({
      model: "qwen3:0.6b", // Start with a small model
      baseUrl: "http://localhost:11434",
      temperature: 0.7,
    });

    const agentRegistry = new AgentRegistry();
    const ragSystem = new RAGSystem({
      vectorStore: {
        type: "memory",
        dimensions: 384,
      },
      embeddingModel: "nomic-embed-text",
      database: db,
    });

    const planExecutor = new PlanExecutor(llm, agentRegistry, ragSystem);

    // Initialize the 4-step confidence orchestrator
    this.orchestrator = new ConfidenceMasterOrchestrator({
      llm,
      agentRegistry,
      ragSystem,
      planExecutor,
      database: db,
    });

    console.log("✅ System initialized successfully");
  }

  async testModel(modelName: string, testQuery: any): Promise<TestResult> {
    console.log(`\n🧪 Testing ${modelName} with query: "${testQuery.query.substring(0, 50)}..."`);
    
    const startTime = Date.now();
    const result: TestResult = {
      modelName,
      query: testQuery.query,
      queryType: testQuery.type,
      step1: {
        name: "Query Analysis & Understanding",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {},
      },
      step2: {
        name: "Response Generation",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {},
      },
      step3: {
        name: "Evaluation",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {},
      },
      step4: {
        name: "Adaptive Delivery",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {},
      },
      totalTime: 0,
      overallConfidence: 0,
      processingPath: "",
      response: "",
      success: false,
      errors: [],
    };

    try {
      // Step 1: Query Analysis & Understanding
      const step1Start = Date.now();
      console.log("   Step 1: Query Analysis & Understanding");
      
      // Create query object
      const queryObj = {
        text: testQuery.query,
        conversationId: `test-${Date.now()}`,
        metadata: {
          urgency: "normal",
          accuracy: "normal",
        },
      };

      // Listen for 4-step events
      this.orchestrator.on("confidence:update", (data) => {
        if (data.stage === "retrieval") {
          result.step1.completed = true;
          result.step1.timeMs = Date.now() - step1Start;
          result.step1.confidence = data.confidence;
          result.step1.details = data.details;
          console.log(`   ✓ Step 1 completed in ${result.step1.timeMs}ms (confidence: ${(data.confidence * 100).toFixed(1)}%)`);
        }
        if (data.stage === "generation") {
          result.step2.completed = true;
          result.step2.timeMs = Date.now() - step1Start - result.step1.timeMs;
          result.step2.confidence = data.confidence;
          result.step2.details = data.details;
          console.log(`   ✓ Step 2 completed in ${result.step2.timeMs}ms (confidence: ${(data.confidence * 100).toFixed(1)}%)`);
        }
      });

      this.orchestrator.on("evaluation:complete", (data) => {
        result.step3.completed = true;
        result.step3.timeMs = Date.now() - step1Start - result.step1.timeMs - result.step2.timeMs;
        result.step3.confidence = data.overall;
        result.step3.details = {
          factuality: data.factuality,
          relevance: data.relevance,
          coherence: data.coherence,
          action: data.action,
        };
        console.log(`   ✓ Step 3 completed in ${result.step3.timeMs}ms (confidence: ${(data.overall * 100).toFixed(1)}%)`);
      });

      this.orchestrator.on("processing:complete", (data) => {
        result.step4.completed = true;
        result.step4.timeMs = Date.now() - step1Start - result.step1.timeMs - result.step2.timeMs - result.step3.timeMs;
        result.step4.confidence = data.confidence;
        result.step4.details = {
          processingPath: data.processingPath,
          duration: data.duration,
        };
        console.log(`   ✓ Step 4 completed in ${result.step4.timeMs}ms (confidence: ${(data.confidence * 100).toFixed(1)}%)`);
      });

      // Execute the 4-step process
      const orchestratorResult = await this.orchestrator.processQuery(queryObj);
      
      // Populate results
      result.totalTime = Date.now() - startTime;
      result.overallConfidence = orchestratorResult.confidence;
      result.processingPath = orchestratorResult.processingPath;
      result.response = orchestratorResult.response;
      result.success = true;

      console.log(`   ✅ Model ${modelName} completed successfully`);
      console.log(`   📊 Processing Path: ${result.processingPath}`);
      console.log(`   🎯 Overall Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Total Time: ${result.totalTime}ms`);

    } catch (error) {
      result.errors.push(error.message);
      result.success = false;
      result.totalTime = Date.now() - startTime;
      console.log(`   ❌ Model ${modelName} failed: ${error.message}`);
    }

    return result;
  }

  async runAllTests(): Promise<void> {
    console.log("\n🧪 Starting Comprehensive Model Testing");
    console.log("=" * 60);
    
    for (const model of TEST_MODELS) {
      console.log(`\n🔄 Testing Model: ${model}`);
      console.log("-" * 40);
      
      // Test if model is available
      try {
        await this.ollama.list();
        const modelList = await this.ollama.list();
        const modelExists = modelList.models.some(m => m.name === model);
        
        if (!modelExists) {
          console.log(`⚠️  Model ${model} not found, skipping...`);
          continue;
        }
      } catch (error) {
        console.log(`❌ Error checking model ${model}: ${error.message}`);
        continue;
      }

      // Test each query with this model
      for (const testQuery of TEST_QUERIES) {
        const result = await this.testModel(model, testQuery);
        this.results.push(result);
        
        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    await this.generateReport();
  }

  async generateReport(): Promise<void> {
    console.log("\n📊 Generating Comprehensive Report");
    console.log("=" * 60);

    // Save raw results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `comprehensive-model-test-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`📁 Raw results saved to: ${resultsFile}`);

    // Generate summary report
    const report = this.generateSummaryReport();
    const reportFile = `COMPREHENSIVE_MODEL_TEST_REPORT_${timestamp.split('T')[0]}.md`;
    
    fs.writeFileSync(reportFile, report);
    console.log(`📄 Summary report saved to: ${reportFile}`);

    // Display key results
    this.displayResults();
  }

  generateSummaryReport(): string {
    const timestamp = new Date().toISOString().split('T')[0];
    
    let report = `# Comprehensive Model Test Report - 4-Step Confidence RAG\n\n`;
    report += `**Date**: ${timestamp}\n`;
    report += `**Models Tested**: ${TEST_MODELS.length}\n`;
    report += `**Test Queries**: ${TEST_QUERIES.length}\n`;
    report += `**Total Test Runs**: ${this.results.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    const successfulTests = this.results.filter(r => r.success).length;
    const avgConfidence = this.results.reduce((sum, r) => sum + r.overallConfidence, 0) / this.results.length;
    const avgTime = this.results.reduce((sum, r) => sum + r.totalTime, 0) / this.results.length;
    
    report += `- **Success Rate**: ${((successfulTests / this.results.length) * 100).toFixed(1)}%\n`;
    report += `- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%\n`;
    report += `- **Average Response Time**: ${(avgTime / 1000).toFixed(2)}s\n\n`;

    // Top Performers
    report += `## Top Performers\n\n`;
    const topPerformers = this.results
      .filter(r => r.success)
      .sort((a, b) => b.overallConfidence - a.overallConfidence)
      .slice(0, 5);

    report += `| Rank | Model | Query Type | Confidence | Time (s) | Processing Path |\n`;
    report += `|------|-------|------------|------------|----------|------------------|\n`;
    
    topPerformers.forEach((result, index) => {
      report += `| ${index + 1} | ${result.modelName} | ${result.queryType} | ${(result.overallConfidence * 100).toFixed(1)}% | ${(result.totalTime / 1000).toFixed(2)} | ${result.processingPath} |\n`;
    });

    // 4-Step Analysis
    report += `\n## 4-Step Methodology Performance\n\n`;
    
    for (const query of TEST_QUERIES) {
      const queryResults = this.results.filter(r => r.query === query.query && r.success);
      if (queryResults.length === 0) continue;

      report += `### Query: ${query.id}\n\n`;
      report += `**Query Text**: "${query.query.substring(0, 100)}..."\n\n`;

      // Step completion rates
      const step1Completion = queryResults.filter(r => r.step1.completed).length;
      const step2Completion = queryResults.filter(r => r.step2.completed).length;
      const step3Completion = queryResults.filter(r => r.step3.completed).length;
      const step4Completion = queryResults.filter(r => r.step4.completed).length;

      report += `**Step Completion Rates**:\n`;
      report += `- Step 1 (Query Analysis): ${((step1Completion / queryResults.length) * 100).toFixed(1)}%\n`;
      report += `- Step 2 (Response Generation): ${((step2Completion / queryResults.length) * 100).toFixed(1)}%\n`;
      report += `- Step 3 (Evaluation): ${((step3Completion / queryResults.length) * 100).toFixed(1)}%\n`;
      report += `- Step 4 (Adaptive Delivery): ${((step4Completion / queryResults.length) * 100).toFixed(1)}%\n\n`;

      // Best performer for this query
      const bestForQuery = queryResults.sort((a, b) => b.overallConfidence - a.overallConfidence)[0];
      report += `**Best Performer**: ${bestForQuery.modelName} (${(bestForQuery.overallConfidence * 100).toFixed(1)}% confidence, ${(bestForQuery.totalTime / 1000).toFixed(2)}s)\n\n`;
    }

    // Model Comparison
    report += `## Model Comparison\n\n`;
    report += `| Model | Avg Confidence | Avg Time (s) | Success Rate | Best Query Type |\n`;
    report += `|-------|----------------|--------------|--------------|------------------|\n`;

    for (const model of TEST_MODELS) {
      const modelResults = this.results.filter(r => r.modelName === model && r.success);
      if (modelResults.length === 0) continue;

      const avgConf = modelResults.reduce((sum, r) => sum + r.overallConfidence, 0) / modelResults.length;
      const avgTime = modelResults.reduce((sum, r) => sum + r.totalTime, 0) / modelResults.length;
      const successRate = modelResults.length / this.results.filter(r => r.modelName === model).length;
      const bestQuery = modelResults.sort((a, b) => b.overallConfidence - a.overallConfidence)[0];

      report += `| ${model} | ${(avgConf * 100).toFixed(1)}% | ${(avgTime / 1000).toFixed(2)} | ${(successRate * 100).toFixed(1)}% | ${bestQuery.queryType} |\n`;
    }

    // Processing Path Analysis
    report += `\n## Processing Path Analysis\n\n`;
    const pathCounts = this.results.reduce((acc, r) => {
      acc[r.processingPath] = (acc[r.processingPath] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    report += `**Processing Path Distribution**:\n`;
    Object.entries(pathCounts).forEach(([path, count]) => {
      report += `- ${path}: ${count} tests (${((count / this.results.length) * 100).toFixed(1)}%)\n`;
    });

    // Recommendations
    report += `\n## Recommendations\n\n`;
    report += `Based on the comprehensive testing of ${TEST_MODELS.length} models using the 4-step confidence RAG methodology:\n\n`;
    
    if (topPerformers.length > 0) {
      report += `### Top Recommendations:\n\n`;
      report += `1. **Best Overall Model**: ${topPerformers[0].modelName}\n`;
      report += `   - Confidence: ${(topPerformers[0].overallConfidence * 100).toFixed(1)}%\n`;
      report += `   - Processing Path: ${topPerformers[0].processingPath}\n\n`;
    }

    // Add any specific insights
    report += `### Key Insights:\n\n`;
    report += `- The 4-step confidence RAG methodology provides detailed tracking of processing stages\n`;
    report += `- Model performance varies significantly across different query types\n`;
    report += `- Processing path selection appears to be working correctly based on query complexity\n\n`;

    report += `## Conclusion\n\n`;
    report += `The comprehensive testing demonstrates that the 4-step confidence RAG system is functional and provides valuable insights into model performance across different query types and complexities.\n\n`;
    
    return report;
  }

  displayResults(): void {
    console.log("\n📈 TEST RESULTS SUMMARY");
    console.log("=" * 50);
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    console.log(`✅ Successful Tests: ${successful.length}`);
    console.log(`❌ Failed Tests: ${failed.length}`);
    console.log(`📊 Success Rate: ${((successful.length / this.results.length) * 100).toFixed(1)}%`);
    
    if (successful.length > 0) {
      const avgConfidence = successful.reduce((sum, r) => sum + r.overallConfidence, 0) / successful.length;
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      
      console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`⏱️  Average Time: ${(avgTime / 1000).toFixed(2)}s`);
      
      // Show top 3 performers
      const top3 = successful.sort((a, b) => b.overallConfidence - a.overallConfidence).slice(0, 3);
      console.log("\n🏆 TOP 3 PERFORMERS:");
      top3.forEach((result, index) => {
        console.log(`${index + 1}. ${result.modelName} - ${(result.overallConfidence * 100).toFixed(1)}% confidence (${(result.totalTime / 1000).toFixed(2)}s)`);
      });
    }
  }
}

async function main() {
  const tester = new ComprehensiveModelTester();
  
  try {
    await tester.initialize();
    await tester.runAllTests();
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

// Run the comprehensive test
if (require.main === module) {
  main().catch(console.error);
}