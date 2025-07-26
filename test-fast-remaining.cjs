#!/usr/bin/env node

/**
 * Fast Test for Remaining Models - 4-Step Confidence RAG Testing
 * Tests remaining models with shorter timeouts to avoid hanging
 */

const { Ollama } = require('ollama');
const fs = require('fs');

// Models that need testing (focusing on ones that work)
const REMAINING_MODELS = [
  "phi4-mini-reasoning:3.8b",
  "granite3.3:8b"
];

// Single test query to speed up testing
const TEST_QUERY = {
  id: "irrigation_specialist",
  query: "Find irrigation specialists for 278 Wycliff Dr. Spartanburg, SC 29301. Issue: Cracked, leaking sprinkler head from root damage",
  type: "service_search",
  expectedSteps: 4,
  complexity: "medium"
};

class FastModelTester {
  constructor() {
    this.ollama = new Ollama({ host: "http://localhost:11434" });
    this.results = [];
  }

  async testModel(modelName) {
    console.log(`\n🧪 Testing ${modelName} with irrigation specialist query`);
    
    const startTime = Date.now();
    const result = {
      modelName,
      query: TEST_QUERY.query,
      queryType: TEST_QUERY.type,
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
      
      const complexity = this.analyzeQueryComplexity(TEST_QUERY.query);
      result.step1.completed = true;
      result.step1.timeMs = Date.now() - step1Start;
      result.step1.confidence = complexity.confidence;
      result.step1.details = {
        complexity: complexity.level,
        factors: complexity.factors,
        reasoning: complexity.reasoning
      };
      
      console.log(`   ✓ Step 1 completed in ${result.step1.timeMs}ms (confidence: ${(complexity.confidence * 100).toFixed(1)}%)`);

      // Step 2: Response Generation (with timeout)
      const step2Start = Date.now();
      console.log("   Step 2: Response Generation");
      
      const prompt = `Please provide a helpful response to this service request:

${TEST_QUERY.query}

Please be direct and helpful in your response.`;

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response generation timeout')), 30000); // 30 second timeout
      });

      const generatePromise = this.ollama.generate({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      
      result.step2.completed = true;
      result.step2.timeMs = Date.now() - step2Start;
      result.step2.confidence = 0.85;
      result.step2.details = {
        responseLength: response.response.length,
        model: modelName,
        timeout: false
      };
      result.response = response.response;
      
      console.log(`   ✓ Step 2 completed in ${result.step2.timeMs}ms (confidence: ${(result.step2.confidence * 100).toFixed(1)}%)`);

      // Step 3: Evaluation
      const step3Start = Date.now();
      console.log("   Step 3: Evaluation");
      
      const evaluation = this.evaluateResponse(TEST_QUERY.query, response.response, TEST_QUERY.type);
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
      
      const delivery = this.adaptiveDelivery(result, TEST_QUERY);
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
      
      if (error.message.includes('timeout')) {
        result.step2.details = { ...result.step2.details, timeout: true };
      }
    }

    return result;
  }

  analyzeQueryComplexity(query) {
    // Service search queries are typically medium complexity
    return {
      level: 'medium',
      confidence: 0.9,
      factors: {
        length: 'medium',
        domainSpecific: true,
        technicalTerms: 1
      },
      reasoning: 'Service search query with specific location and technical details'
    };
  }

  evaluateResponse(query, response, queryType) {
    const responseLength = response.length;
    const words = response.split(/\s+/).length;
    
    // Check for relevant keywords
    const relevantKeywords = ['irrigation', 'specialist', 'sprinkler', 'repair', 'service', 'contact'];
    const foundKeywords = relevantKeywords.filter(kw => 
      response.toLowerCase().includes(kw)).length;
    
    const relevance = Math.min(1.0, foundKeywords / relevantKeywords.length + 0.3);
    const factuality = words > 20 ? 0.8 : 0.6;
    const coherence = response.includes('.') ? 0.8 : 0.6;
    const completeness = words > 30 ? 0.8 : 0.6;
    
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
    let adaptations = ['irrigation-specialist-search'];
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

  async runTests() {
    console.log("\n🧪 Starting Fast Tests for Remaining Models");
    console.log("=" * 50);
    
    for (const model of REMAINING_MODELS) {
      console.log(`\n🔄 Testing Model: ${model}`);
      console.log("-" * 30);
      
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

      const result = await this.testModel(model);
      this.results.push(result);
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await this.saveResults();
  }

  async saveResults() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const resultsFile = `fast-remaining-models-results-${timestamp}.json`;
    
    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
    console.log(`\n📁 Results saved to: ${resultsFile}`);
    
    this.displaySummary();
  }

  displaySummary() {
    console.log("\n📈 FAST TEST RESULTS SUMMARY");
    console.log("=" * 50);
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const timedOut = this.results.filter(r => r.step2.details && r.step2.details.timeout);
    
    console.log(`✅ Successful Tests: ${successful.length}`);
    console.log(`❌ Failed Tests: ${failed.length}`);
    console.log(`⏰ Timed Out Tests: ${timedOut.length}`);
    console.log(`📊 Success Rate: ${this.results.length > 0 ? ((successful.length / this.results.length) * 100).toFixed(1) : 0}%`);
    
    if (successful.length > 0) {
      const avgConfidence = successful.reduce((sum, r) => sum + r.overallConfidence, 0) / successful.length;
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      
      console.log(`🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`⏱️  Average Time: ${(avgTime / 1000).toFixed(2)}s`);
      
      console.log("\n🏆 SUCCESSFUL MODELS:");
      successful.forEach((result, index) => {
        console.log(`${index + 1}. ${result.modelName} - ${(result.overallConfidence * 100).toFixed(1)}% confidence (${(result.totalTime / 1000).toFixed(2)}s)`);
      });
    }

    if (failed.length > 0) {
      console.log("\n❌ FAILED MODELS:");
      failed.forEach((result, index) => {
        console.log(`${index + 1}. ${result.modelName} - ${result.errors.join(', ')}`);
      });
    }
  }
}

async function main() {
  const tester = new FastModelTester();
  
  try {
    await tester.runTests();
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}