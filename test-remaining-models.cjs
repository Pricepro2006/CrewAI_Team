#!/usr/bin/env node

/**
 * Test Remaining Models - 4-Step Confidence RAG Testing
 * Tests the 7 remaining untested models using a simplified approach
 */

const { Ollama } = require('ollama');
const fs = require('fs');
const path = require('path');

// Models that need testing (based on todo list)
const REMAINING_MODELS = [
  "hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
  "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF", 
  "alibayram/smollm3",
  "gemma3n:e2b",
  "gemma3n:e4b", 
  "phi4-mini-reasoning:3.8b",
  "granite3.3:8b"
];

// Test queries from the original irrigation specialist test
const TEST_QUERIES = [
  {
    id: "irrigation_specialist",
    query: "Find irrigation specialists for 278 Wycliff Dr. Spartanburg, SC 29301. Issue: Cracked, leaking sprinkler head from root damage",
    type: "service_search",
    expectedSteps: 4,
    complexity: "medium"
  },
  {
    id: "simple_date",
    query: "What is the current date?",
    type: "simple_query", 
    expectedSteps: 1,
    complexity: "simple"
  },
  {
    id: "complex_research",
    query: "Research the latest developments in quantum computing and explain how they might impact enterprise AI systems in the next 5 years",
    type: "research",
    expectedSteps: 4,
    complexity: "complex"
  },
  {
    id: "code_generation", 
    query: "Write a Python function to calculate the Fibonacci sequence",
    type: "code",
    expectedSteps: 3,
    complexity: "medium"
  }
];

class SimplifiedModelTester {
  constructor() {
    this.ollama = new Ollama({ host: "http://localhost:11434" });
    this.results = [];
  }

  async testModel(modelName, testQuery) {
    console.log(`\n🧪 Testing ${modelName} with query: "${testQuery.query.substring(0, 50)}..."`);
    
    const startTime = Date.now();
    const result = {
      modelName,
      query: testQuery.query,
      queryType: testQuery.type,
      step1: {
        name: "Query Analysis & Understanding",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {}
      },
      step2: {
        name: "Response Generation", 
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {}
      },
      step3: {
        name: "Evaluation",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {}
      },
      step4: {
        name: "Adaptive Delivery",
        completed: false,
        timeMs: 0,
        confidence: 0,
        details: {}
      },
      totalTime: 0,
      overallConfidence: 0,
      processingPath: "",
      response: "",
      success: false,
      errors: []
    };

    try {
      // Step 1: Query Analysis & Understanding
      const step1Start = Date.now();
      console.log("   Step 1: Query Analysis & Understanding");
      
      // Simulate query complexity analysis
      const complexity = this.analyzeQueryComplexity(testQuery.query);
      result.step1.completed = true;
      result.step1.timeMs = Date.now() - step1Start;
      result.step1.confidence = complexity.confidence;
      result.step1.details = {
        complexity: complexity.level,
        factors: complexity.factors,
        reasoning: complexity.reasoning
      };
      
      console.log(`   ✓ Step 1 completed in ${result.step1.timeMs}ms (confidence: ${(complexity.confidence * 100).toFixed(1)}%)`);

      // Step 2: Response Generation
      const step2Start = Date.now();
      console.log("   Step 2: Response Generation");
      
      const prompt = this.buildPrompt(testQuery.query, complexity);
      const response = await this.ollama.generate({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      });
      
      result.step2.completed = true;
      result.step2.timeMs = Date.now() - step2Start;
      result.step2.confidence = 0.85; // Simplified confidence
      result.step2.details = {
        responseLength: response.response.length,
        promptTokens: prompt.length,
        model: modelName
      };
      result.response = response.response;
      
      console.log(`   ✓ Step 2 completed in ${result.step2.timeMs}ms (confidence: ${(result.step2.confidence * 100).toFixed(1)}%)`);

      // Step 3: Evaluation
      const step3Start = Date.now();
      console.log("   Step 3: Evaluation");
      
      const evaluation = this.evaluateResponse(testQuery.query, response.response, testQuery.type);
      result.step3.completed = true;
      result.step3.timeMs = Date.now() - step3Start;
      result.step3.confidence = evaluation.overall;
      result.step3.details = {
        factuality: evaluation.factuality,
        relevance: evaluation.relevance, 
        coherence: evaluation.coherence,
        completeness: evaluation.completeness
      };
      
      console.log(`   ✓ Step 3 completed in ${result.step3.timeMs}ms (confidence: ${(evaluation.overall * 100).toFixed(1)}%)`);

      // Step 4: Adaptive Delivery
      const step4Start = Date.now();
      console.log("   Step 4: Adaptive Delivery");
      
      const delivery = this.adaptiveDelivery(result, testQuery);
      result.step4.completed = true;
      result.step4.timeMs = Date.now() - step4Start;
      result.step4.confidence = delivery.confidence;
      result.step4.details = {
        processingPath: delivery.processingPath,
        adaptations: delivery.adaptations,
        finalConfidence: delivery.confidence
      };
      
      result.processingPath = delivery.processingPath;
      result.overallConfidence = this.calculateOverallConfidence(result);
      result.totalTime = Date.now() - startTime;
      result.success = true;
      
      console.log(`   ✓ Step 4 completed in ${result.step4.timeMs}ms (confidence: ${(delivery.confidence * 100).toFixed(1)}%)`);
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

  analyzeQueryComplexity(query) {
    const words = query.split(/\s+/).length;
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'].filter(w => 
      query.toLowerCase().includes(w)).length;
    
    let complexityScore = 0;
    const factors = {};
    
    // Length factor
    if (words > 20) {
      complexityScore += 0.3;
      factors.length = 'long';
    } else if (words > 10) {
      complexityScore += 0.1; 
      factors.length = 'medium';
    } else {
      factors.length = 'short';
    }
    
    // Question complexity
    if (questionWords > 1) {
      complexityScore += 0.2;
      factors.multipleQuestions = true;
    }
    
    // Technical terms
    const techTerms = ['algorithm', 'function', 'quantum', 'enterprise', 'AI', 'systems'].filter(term =>
      query.toLowerCase().includes(term.toLowerCase())).length;
    if (techTerms > 0) {
      complexityScore += 0.2;
      factors.technicalTerms = techTerms;
    }
    
    // Domain specificity  
    if (query.includes('specialists') || query.includes('irrigation') || query.includes('address')) {
      complexityScore += 0.1;
      factors.domainSpecific = true;
    }
    
    const level = complexityScore <= 0.3 ? 'simple' : complexityScore <= 0.6 ? 'medium' : 'complex';
    const confidence = Math.max(0.6, 1.0 - complexityScore * 0.5);
    
    return {
      level,
      confidence,
      factors,
      reasoning: `Query classified as ${level} based on ${Object.keys(factors).join(', ')}`
    };
  }

  buildPrompt(query, complexity) {
    let prompt = "";
    
    if (complexity.level === 'simple') {
      prompt = `Please provide a direct, concise answer to this question:\n\n${query}\n\nAnswer:`;
    } else if (complexity.level === 'medium') {
      prompt = `Please provide a comprehensive answer to this question, including relevant details and context:\n\n${query}\n\nAnswer:`;
    } else {
      prompt = `Please provide a detailed, well-structured answer to this complex question. Break down your response into clear sections and provide thorough analysis:\n\n${query}\n\nAnswer:`;
    }
    
    return prompt;
  }

  evaluateResponse(query, response, queryType) {
    const responseLength = response.length;
    const words = response.split(/\s+/).length;
    
    // Factuality (simplified heuristic)
    let factuality = 0.8; // Base score
    if (response.includes('I don\'t know') || response.includes('unclear')) {
      factuality -= 0.2;
    }
    if (response.includes('research') || response.includes('study') || response.includes('data')) {
      factuality += 0.1;
    }
    
    // Relevance (keyword matching)
    const queryKeywords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const responseKeywords = response.toLowerCase().split(/\s+/);
    const matchingKeywords = queryKeywords.filter(kw => 
      responseKeywords.some(rw => rw.includes(kw) || kw.includes(rw))).length;
    const relevance = Math.min(1.0, matchingKeywords / Math.max(queryKeywords.length, 1));
    
    // Coherence (structure and flow)
    let coherence = 0.7; // Base score
    if (response.includes('\n') || response.includes('.')) {
      coherence += 0.1; // Has structure
    }
    if (words > 50) {
      coherence += 0.1; // Substantial response
    }
    if (response.includes('?') && !query.includes('?')) {
      coherence -= 0.1; // Asking questions in response
    }
    
    // Completeness (response adequacy)
    let completeness = 0.8;
    if (queryType === 'service_search' && !response.includes('specialist')) {
      completeness -= 0.2;
    }
    if (queryType === 'code' && !response.includes('def ')) {
      completeness -= 0.2;
    }
    if (words < 20) {
      completeness -= 0.2;
    }
    
    const overall = (factuality + relevance + coherence + completeness) / 4;
    
    return {
      factuality: Math.max(0, Math.min(1, factuality)),
      relevance: Math.max(0, Math.min(1, relevance)),
      coherence: Math.max(0, Math.min(1, coherence)),
      completeness: Math.max(0, Math.min(1, completeness)),
      overall: Math.max(0, Math.min(1, overall))
    };
  }

  adaptiveDelivery(result, testQuery) {
    const avgConfidence = (result.step1.confidence + result.step2.confidence + result.step3.confidence) / 3;
    
    let processingPath = 'standard';
    let adaptations = [];
    let finalConfidence = avgConfidence;
    
    if (avgConfidence > 0.8) {
      processingPath = 'high-confidence';
      adaptations.push('direct-delivery');
      finalConfidence += 0.05;
    } else if (avgConfidence < 0.6) {
      processingPath = 'low-confidence';
      adaptations.push('uncertainty-acknowledgment');
      finalConfidence -= 0.05;
    }
    
    if (testQuery.complexity === 'complex') {
      processingPath += '-complex';
      adaptations.push('detailed-explanation');
    }
    
    if (result.step2.details.responseLength > 500) {
      adaptations.push('structured-formatting');
    }
    
    return {
      processingPath,
      adaptations,
      confidence: Math.max(0, Math.min(1, finalConfidence))
    };
  }

  calculateOverallConfidence(result) {
    const stepConfidences = [
      result.step1.confidence,
      result.step2.confidence, 
      result.step3.confidence,
      result.step4.confidence
    ];
    
    return stepConfidences.reduce((sum, conf) => sum + conf, 0) / stepConfidences.length;
  }

  async runAllTests() {
    console.log("\n🧪 Starting Tests for Remaining Models");
    console.log("=" * 60);
    
    for (const model of REMAINING_MODELS) {
      console.log(`\n🔄 Testing Model: ${model}`);
      console.log("-" * 40);
      
      // Test if model is available
      try {
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

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `remaining-models-test-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);
    
    // Display summary
    this.displaySummary();
  }

  displaySummary() {
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
      
      // Show top performers
      const topPerformers = successful.sort((a, b) => b.overallConfidence - a.overallConfidence).slice(0, 3);
      console.log("\n🏆 TOP PERFORMERS:");
      topPerformers.forEach((result, index) => {
        console.log(`${index + 1}. ${result.modelName} - ${(result.overallConfidence * 100).toFixed(1)}% confidence (${(result.totalTime / 1000).toFixed(2)}s)`);
      });
    }
  }
}

async function main() {
  const tester = new SimplifiedModelTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}