#!/usr/bin/env node

/**
 * Comprehensive Test for ALL 11 Models - 4-Step Confidence RAG Testing
 * Fixed model names with :latest suffix for complete testing
 */

const { Ollama } = require('ollama');
const fs = require('fs');

// ALL 11 models with corrected names
const ALL_MODELS = [
  "hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF:latest",
  "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF:latest",
  "alibayram/smollm3:latest",
  "qwen3:0.6b",
  "gemma3n:e2b",
  "gemma3n:e4b",
  "phi4-mini-reasoning:3.8b",
  "qwen3:1.7b",
  "qwen3:4b",
  "granite3.3:8b",
  "granite3.3:2b"
];

// Comprehensive test queries covering all complexity levels
const COMPREHENSIVE_QUERIES = [
  {
    id: "irrigation_specialist",
    query: "Find irrigation specialists for 278 Wycliff Dr. Spartanburg, SC 29301. Issue: Cracked, leaking sprinkler head from root damage",
    type: "service_search",
    expectedSteps: 4,
    complexity: "medium",
    category: "practical_search"
  },
  {
    id: "simple_date",
    query: "What is the current date?",
    type: "simple_query",
    expectedSteps: 1,
    complexity: "simple",
    category: "factual"
  },
  {
    id: "complex_research",
    query: "Research the latest developments in quantum computing and explain how they might impact enterprise AI systems in the next 5 years",
    type: "research",
    expectedSteps: 4,
    complexity: "complex",
    category: "analytical"
  },
  {
    id: "code_generation",
    query: "Write a Python function to calculate the Fibonacci sequence",
    type: "code",
    expectedSteps: 3,
    complexity: "medium",
    category: "programming"
  },
  {
    id: "creative_writing",
    query: "Write a short story about a robot who discovers emotions",
    type: "creative",
    expectedSteps: 3,
    complexity: "medium",
    category: "creative"
  },
  {
    id: "mathematical_problem",
    query: "Solve this equation step by step: 3x^2 + 5x - 2 = 0",
    type: "math",
    expectedSteps: 2,
    complexity: "medium",
    category: "mathematical"
  }
];

class ComprehensiveModelTester {
  constructor() {
    this.ollama = new Ollama({ host: "http://localhost:11434" });
    this.results = [];
    this.modelStats = {};
  }

  async testModel(modelName, testQuery) {
    const shortModelName = modelName.replace(':latest', '').split('/').pop();
    console.log(`\n🧪 Testing ${shortModelName} with "${testQuery.id}" query`);
    
    const startTime = Date.now();
    const result = {
      modelName,
      shortName: shortModelName,
      query: testQuery.query,
      queryId: testQuery.id,
      queryType: testQuery.type,
      queryCategory: testQuery.category,
      queryComplexity: testQuery.complexity,
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
      responseLength: 0,
      wordCount: 0,
      success: false,
      errors: [],
      performance: {
        speed: "unknown",
        efficiency: "unknown",
        accuracy: "unknown"
      }
    };

    try {
      // Step 1: Query Analysis & Understanding
      const step1Start = Date.now();
      console.log("   Step 1: Query Analysis & Understanding");
      
      const complexity = this.analyzeQueryComplexity(testQuery.query, testQuery.complexity, testQuery.type);
      result.step1.completed = true;
      result.step1.timeMs = Date.now() - step1Start;
      result.step1.confidence = complexity.confidence;
      result.step1.details = {
        complexity: complexity.level,
        factors: complexity.factors,
        reasoning: complexity.reasoning,
        routingStrategy: complexity.routing
      };
      
      console.log(`   ✓ Step 1 completed in ${result.step1.timeMs}ms (confidence: ${(complexity.confidence * 100).toFixed(1)}%)`);

      // Step 2: Response Generation (with adaptive timeout)
      const step2Start = Date.now();
      console.log("   Step 2: Response Generation");
      
      const prompt = this.buildOptimizedPrompt(testQuery.query, testQuery.type, complexity);
      const timeout = this.calculateTimeout(modelName, testQuery.complexity);
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Response generation timeout')), timeout);
      });

      const generatePromise = this.ollama.generate({
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: testQuery.type === 'creative' ? 0.9 : 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: testQuery.type === 'simple_query' ? 50 : 500
        }
      });

      const response = await Promise.race([generatePromise, timeoutPromise]);
      
      result.step2.completed = true;
      result.step2.timeMs = Date.now() - step2Start;
      result.step2.confidence = this.calculateGenerationConfidence(response.response, testQuery.type);
      result.step2.details = {
        responseLength: response.response.length,
        model: shortModelName,
        timeout: false,
        promptLength: prompt.length,
        generationSpeed: response.response.length / (result.step2.timeMs / 1000)
      };
      result.response = response.response;
      result.responseLength = response.response.length;
      result.wordCount = response.response.split(/\s+/).length;
      
      console.log(`   ✓ Step 2 completed in ${result.step2.timeMs}ms (confidence: ${(result.step2.confidence * 100).toFixed(1)}%)`);

      // Step 3: Comprehensive Evaluation
      const step3Start = Date.now();
      console.log("   Step 3: Comprehensive Evaluation");
      
      const evaluation = this.comprehensiveEvaluation(testQuery.query, response.response, testQuery);
      result.step3.completed = true;
      result.step3.timeMs = Date.now() - step3Start;
      result.step3.confidence = evaluation.overall;
      result.step3.details = {
        factuality: evaluation.factuality,
        relevance: evaluation.relevance, 
        coherence: evaluation.coherence,
        completeness: evaluation.completeness,
        specificity: evaluation.specificity,
        usability: evaluation.usability,
        categorySpecific: evaluation.categorySpecific
      };
      
      console.log(`   ✓ Step 3 completed in ${result.step3.timeMs}ms (confidence: ${(evaluation.overall * 100).toFixed(1)}%)`);

      // Step 4: Adaptive Delivery & Performance Analysis
      const step4Start = Date.now();
      console.log("   Step 4: Adaptive Delivery & Performance Analysis");
      
      const delivery = this.adaptiveDeliveryWithAnalysis(result, testQuery);
      result.step4.completed = true;
      result.step4.timeMs = Date.now() - step4Start;
      result.step4.confidence = delivery.confidence;
      result.step4.details = {
        processingPath: delivery.processingPath,
        adaptations: delivery.adaptations,
        performanceGrade: delivery.performanceGrade,
        recommendations: delivery.recommendations
      };
      
      result.processingPath = delivery.processingPath;
      result.performance = delivery.performance;
      result.overallConfidence = this.calculateOverallConfidence(result);
      result.totalTime = Date.now() - startTime;
      result.success = true;
      
      // Update model statistics
      this.updateModelStats(modelName, result);
      
      console.log(`   ✓ Step 4 completed in ${result.step4.timeMs}ms (confidence: ${(delivery.confidence * 100).toFixed(1)}%)`);
      console.log(`   ✅ Model ${shortModelName} completed successfully`);
      console.log(`   📊 Processing Path: ${result.processingPath}`);
      console.log(`   🎯 Overall Confidence: ${(result.overallConfidence * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Total Time: ${result.totalTime}ms`);
      console.log(`   📝 Response: ${result.wordCount} words, ${result.responseLength} chars`);

    } catch (error) {
      result.errors.push(error.message);
      result.success = false;
      result.totalTime = Date.now() - startTime;
      console.log(`   ❌ Model ${shortModelName} failed: ${error.message}`);
      
      if (error.message.includes('timeout')) {
        result.step2.details = { timeout: true, timeoutMs: this.calculateTimeout(modelName, testQuery.complexity) };
      }
    }

    return result;
  }

  analyzeQueryComplexity(query, expectedComplexity, queryType) {
    const words = query.split(/\s+/).length;
    const sentences = query.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'which', 'who'].filter(w => 
      query.toLowerCase().includes(w)).length;
    
    let complexityScore = 0;
    const factors = {
      wordCount: words,
      sentenceCount: sentences,
      questionWords: questionWords,
      expectedComplexity: expectedComplexity
    };
    
    // Base complexity from query type
    const typeComplexity = {
      'simple_query': 0.2,
      'service_search': 0.5,
      'code': 0.6,
      'creative': 0.6,
      'math': 0.7,
      'research': 0.9
    };
    
    complexityScore = typeComplexity[queryType] || 0.5;
    
    // Adjust based on content
    if (words > 30) complexityScore += 0.2;
    if (sentences > 2) complexityScore += 0.1;
    if (questionWords > 1) complexityScore += 0.1;
    
    const level = complexityScore <= 0.3 ? 'simple' : complexityScore <= 0.7 ? 'medium' : 'complex';
    const confidence = Math.max(0.7, 1.0 - complexityScore * 0.3);
    
    const routing = complexityScore > 0.7 ? 'complex-path' : 
                   complexityScore > 0.4 ? 'standard-path' : 'fast-path';
    
    return {
      level,
      confidence,
      factors,
      routing,
      reasoning: `${queryType} query classified as ${level} (score: ${complexityScore.toFixed(2)})`
    };
  }

  buildOptimizedPrompt(query, queryType, complexity) {
    const prompts = {
      'simple_query': `Please provide a direct, concise answer:\n\n${query}\n\nAnswer:`,
      
      'service_search': `You are a helpful assistant that helps find local services. Please provide practical information for this request:\n\n${query}\n\nPlease provide helpful guidance including:\n- Service type needed\n- Location considerations\n- Next steps\n\nResponse:`,
      
      'code': `Please write clean, well-commented code for this request:\n\n${query}\n\nProvide the code with explanations:\n\nCode:`,
      
      'creative': `Please write an engaging and creative response to this request:\n\n${query}\n\nBe creative and engaging:\n\nStory:`,
      
      'math': `Please solve this mathematical problem step by step:\n\n${query}\n\nShow your work clearly:\n\nSolution:`,
      
      'research': `Please provide a comprehensive research-based response to this question:\n\n${query}\n\nProvide detailed analysis with:\n- Current state\n- Key developments\n- Future implications\n- Supporting reasoning\n\nAnalysis:`
    };
    
    return prompts[queryType] || prompts['service_search'];
  }

  calculateTimeout(modelName, complexity) {
    const baseTimeouts = {
      'simple': 15000,
      'medium': 45000,
      'complex': 90000
    };
    
    const modelMultipliers = {
      'Meta-Llama-3.1-8B': 2.0,
      'DeepSeek-R1': 2.0,
      'phi4-mini-reasoning': 1.8,
      'granite3.3:8b': 1.5,
      'gemma3n:e4b': 1.3,
      'gemma3n:e2b': 1.2,
      'qwen3:4b': 1.1,
      'qwen3:1.7b': 1.0,
      'granite3.3:2b': 0.9,
      'qwen3:0.6b': 0.8,
      'smollm3': 0.9
    };
    
    const shortName = modelName.replace(':latest', '').split('/').pop();
    const multiplier = Object.entries(modelMultipliers).find(([key]) => 
      shortName.includes(key.split(':')[0]) || shortName.includes(key.split('-')[0]))?.[1] || 1.0;
    
    return Math.floor(baseTimeouts[complexity] * multiplier);
  }

  calculateGenerationConfidence(response, queryType) {
    let confidence = 0.7; // Base confidence
    
    const length = response.length;
    const words = response.split(/\s+/).length;
    
    // Length appropriateness
    const expectedLengths = {
      'simple_query': [10, 100],
      'service_search': [100, 500],
      'code': [100, 1000],
      'creative': [200, 1500],
      'math': [100, 800],
      'research': [300, 2000]
    };
    
    const [minLen, maxLen] = expectedLengths[queryType] || [50, 500];
    if (length >= minLen && length <= maxLen) confidence += 0.1;
    
    // Content quality indicators
    if (response.includes('\n') || response.includes('.')) confidence += 0.05;
    if (words > 20) confidence += 0.05;
    if (!response.includes('I don\'t know') && !response.includes('unclear')) confidence += 0.1;
    
    return Math.min(1.0, confidence);
  }

  comprehensiveEvaluation(query, response, testQuery) {
    const queryWords = query.toLowerCase().split(/\s+/);
    const responseWords = response.toLowerCase().split(/\s+/);
    const responseLength = response.length;
    const wordCount = responseWords.length;
    
    // 1. Factuality Assessment
    let factuality = 0.8;
    if (response.includes('I don\'t know') || response.includes('I cannot')) factuality -= 0.2;
    if (response.includes('according to') || response.includes('based on')) factuality += 0.1;
    if (testQuery.type === 'simple_query' && wordCount < 10) factuality -= 0.1;
    
    // 2. Relevance Scoring (keyword matching + semantic)
    const keywordMatches = queryWords.filter(qw => 
      qw.length > 3 && responseWords.some(rw => rw.includes(qw) || qw.includes(rw))).length;
    const relevance = Math.min(1.0, (keywordMatches / Math.max(queryWords.length, 1)) + 0.3);
    
    // 3. Coherence Analysis  
    let coherence = 0.7;
    if (response.includes('\n\n') || response.match(/\d+\./)) coherence += 0.1; // Structure
    if (wordCount > 30) coherence += 0.1; // Substantial content
    if (response.split('.').length > 2) coherence += 0.1; // Multiple sentences
    
    // 4. Completeness Evaluation
    let completeness = 0.7;
    const expectedElements = {
      'service_search': ['specialist', 'contact', 'service', 'repair'],
      'code': ['def ', 'function', 'return', '()'],
      'creative': ['story', 'character', 'plot'],
      'math': ['=', 'solve', 'answer', 'step'],
      'research': ['development', 'impact', 'future', 'analysis'],
      'simple_query': ['date', 'today', 'current']
    };
    
    const expected = expectedElements[testQuery.type] || [];
    const foundElements = expected.filter(elem => response.toLowerCase().includes(elem)).length;
    if (expected.length > 0) {
      completeness = Math.min(1.0, (foundElements / expected.length) + 0.3);
    }
    
    // 5. Specificity (detailed vs generic)
    let specificity = 0.6;
    if (response.includes('specific') || response.match(/\d+/)) specificity += 0.2;
    if (responseLength > 200) specificity += 0.1;
    if (response.includes('example') || response.includes('for instance')) specificity += 0.1;
    
    // 6. Usability (actionable information)
    let usability = 0.6;
    if (testQuery.type === 'service_search' && response.includes('contact')) usability += 0.2;
    if (testQuery.type === 'code' && response.includes('def ')) usability += 0.2;
    if (testQuery.type === 'math' && response.includes('=')) usability += 0.2;
    if (response.includes('step') || response.includes('how to')) usability += 0.1;
    
    // 7. Category-specific evaluation
    let categorySpecific = 0.7;
    switch (testQuery.category) {
      case 'practical_search':
        if (response.includes('location') || response.includes('contact')) categorySpecific += 0.2;
        break;
      case 'programming':
        if (response.includes('function') && response.includes('return')) categorySpecific += 0.2;
        break;
      case 'analytical':
        if (response.includes('analysis') || response.includes('research')) categorySpecific += 0.2;
        break;
      case 'creative':
        if (response.length > 200 && response.includes('story')) categorySpecific += 0.2;
        break;
      case 'mathematical':
        if (response.includes('equation') && response.includes('solution')) categorySpecific += 0.2;
        break;
    }
    
    const overall = (factuality + relevance + coherence + completeness + specificity + usability + categorySpecific) / 7;
    
    return {
      factuality: Math.max(0, Math.min(1, factuality)),
      relevance: Math.max(0, Math.min(1, relevance)),
      coherence: Math.max(0, Math.min(1, coherence)),
      completeness: Math.max(0, Math.min(1, completeness)),
      specificity: Math.max(0, Math.min(1, specificity)),
      usability: Math.max(0, Math.min(1, usability)),
      categorySpecific: Math.max(0, Math.min(1, categorySpecific)),
      overall: Math.max(0, Math.min(1, overall))
    };
  }

  adaptiveDeliveryWithAnalysis(result, testQuery) {
    const avgConfidence = (result.step1.confidence + result.step2.confidence + result.step3.confidence) / 3;
    
    let processingPath = 'standard';
    let adaptations = [];
    let finalConfidence = avgConfidence;
    
    // Determine processing path
    if (avgConfidence > 0.85) {
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
    
    // Performance grading
    const speed = result.totalTime < 10000 ? 'fast' : result.totalTime < 30000 ? 'medium' : 'slow';
    const efficiency = result.responseLength > 100 && result.totalTime < 20000 ? 'high' : 
                      result.responseLength > 50 && result.totalTime < 40000 ? 'medium' : 'low';
    const accuracy = avgConfidence > 0.85 ? 'high' : avgConfidence > 0.7 ? 'medium' : 'low';
    
    const performanceGrade = speed === 'fast' && efficiency === 'high' && accuracy === 'high' ? 'A' :
                           speed !== 'slow' && efficiency !== 'low' && accuracy !== 'low' ? 'B' :
                           'C';
    
    const recommendations = [];
    if (speed === 'slow') recommendations.push('optimize-response-time');
    if (efficiency === 'low') recommendations.push('improve-response-quality');
    if (accuracy === 'low') recommendations.push('enhance-accuracy');
    
    return {
      processingPath,
      adaptations,
      performanceGrade,
      recommendations,
      performance: { speed, efficiency, accuracy },
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

  updateModelStats(modelName, result) {
    const shortName = result.shortName;
    if (!this.modelStats[shortName]) {
      this.modelStats[shortName] = {
        totalTests: 0,
        successfulTests: 0,
        totalTime: 0,
        totalConfidence: 0,
        totalWords: 0,
        categories: {},
        performance: { speed: [], efficiency: [], accuracy: [] }
      };
    }
    
    const stats = this.modelStats[shortName];
    stats.totalTests++;
    if (result.success) {
      stats.successfulTests++;
      stats.totalTime += result.totalTime;
      stats.totalConfidence += result.overallConfidence;
      stats.totalWords += result.wordCount;
      
      if (!stats.categories[result.queryCategory]) {
        stats.categories[result.queryCategory] = { count: 0, avgConfidence: 0 };
      }
      stats.categories[result.queryCategory].count++;
      stats.categories[result.queryCategory].avgConfidence = 
        (stats.categories[result.queryCategory].avgConfidence + result.overallConfidence) / 2;
      
      stats.performance.speed.push(result.performance.speed);
      stats.performance.efficiency.push(result.performance.efficiency);
      stats.performance.accuracy.push(result.performance.accuracy);
    }
  }

  async runComprehensiveTests() {
    console.log("\n🚀 Starting COMPREHENSIVE Tests for ALL 11 Models");
    console.log("=" * 80);
    console.log(`📋 Testing ${ALL_MODELS.length} models with ${COMPREHENSIVE_QUERIES.length} queries each`);
    console.log(`🎯 Total test runs: ${ALL_MODELS.length * COMPREHENSIVE_QUERIES.length}`);
    console.log("=" * 80);
    
    let completedTests = 0;
    const totalTests = ALL_MODELS.length * COMPREHENSIVE_QUERIES.length;
    
    for (const model of ALL_MODELS) {
      const shortName = model.replace(':latest', '').split('/').pop();
      console.log(`\n🔄 Testing Model: ${shortName}`);
      console.log("-" * 60);
      
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

      // Test with all comprehensive queries
      for (const testQuery of COMPREHENSIVE_QUERIES) {
        const result = await this.testModel(model, testQuery);
        this.results.push(result);
        completedTests++;
        
        console.log(`   📊 Progress: ${completedTests}/${totalTests} tests completed (${((completedTests/totalTests)*100).toFixed(1)}%)`);
        
        // Small delay between tests to prevent overload
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await this.generateComprehensiveReport();
  }

  async generateComprehensiveReport() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save raw results
    const resultsFile = `comprehensive-all-models-results-${timestamp}.json`;
    fs.writeFileSync(resultsFile, JSON.stringify({
      results: this.results,
      modelStats: this.modelStats,
      metadata: {
        totalModels: ALL_MODELS.length,
        totalQueries: COMPREHENSIVE_QUERIES.length,
        totalTests: this.results.length,
        timestamp: new Date().toISOString()
      }
    }, null, 2));
    
    console.log(`\n📁 Raw results saved to: ${resultsFile}`);
    
    // Generate comprehensive markdown report
    const report = this.generateDetailedReport();
    const reportFile = `COMPREHENSIVE_ALL_MODELS_REPORT_${timestamp.split('T')[0]}.md`;
    
    fs.writeFileSync(reportFile, report);
    console.log(`📄 Comprehensive report saved to: ${reportFile}`);
    
    // Display summary
    this.displayComprehensiveSummary();
  }

  generateDetailedReport() {
    const timestamp = new Date().toISOString().split('T')[0];
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    let report = `# COMPREHENSIVE MODEL COMPARISON REPORT - 4-Step Confidence RAG\n\n`;
    report += `**Date**: ${timestamp}\n`;
    report += `**Models Tested**: ${ALL_MODELS.length}\n`;
    report += `**Test Queries**: ${COMPREHENSIVE_QUERIES.length}\n`;
    report += `**Total Test Runs**: ${this.results.length}\n`;
    report += `**Successful Tests**: ${successful.length}\n`;
    report += `**Failed Tests**: ${failed.length}\n`;
    report += `**Overall Success Rate**: ${((successful.length / this.results.length) * 100).toFixed(1)}%\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    if (successful.length > 0) {
      const avgConfidence = successful.reduce((sum, r) => sum + r.overallConfidence, 0) / successful.length;
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      const avgWords = successful.reduce((sum, r) => sum + r.wordCount, 0) / successful.length;
      
      report += `- **Average Confidence**: ${(avgConfidence * 100).toFixed(1)}%\n`;
      report += `- **Average Response Time**: ${(avgTime / 1000).toFixed(2)} seconds\n`;
      report += `- **Average Response Length**: ${avgWords.toFixed(0)} words\n\n`;
    }

    // Model Performance Comparison
    report += `## Model Performance Comparison\n\n`;
    report += `| Model | Success Rate | Avg Confidence | Avg Time (s) | Avg Words | Best Category | Performance Grade |\n`;
    report += `|-------|--------------|----------------|--------------|-----------|---------------|-------------------|\n`;
    
    for (const [modelName, stats] of Object.entries(this.modelStats)) {
      if (stats.successfulTests > 0) {
        const successRate = (stats.successfulTests / stats.totalTests * 100).toFixed(1);
        const avgConf = (stats.totalConfidence / stats.successfulTests * 100).toFixed(1);
        const avgTime = (stats.totalTime / stats.successfulTests / 1000).toFixed(2);
        const avgWords = (stats.totalWords / stats.successfulTests).toFixed(0);
        
        const bestCategory = Object.entries(stats.categories)
          .sort((a, b) => b[1].avgConfidence - a[1].avgConfidence)[0]?.[0] || 'N/A';
          
        const speeds = stats.performance.speed;
        const avgGrade = speeds.filter(s => s === 'fast').length > speeds.length/2 ? 'A' :
                        speeds.filter(s => s === 'medium').length > speeds.length/2 ? 'B' : 'C';
        
        report += `| ${modelName} | ${successRate}% | ${avgConf}% | ${avgTime} | ${avgWords} | ${bestCategory} | ${avgGrade} |\n`;
      }
    }

    // Detailed Query Performance
    report += `\n## Query Performance Analysis\n\n`;
    for (const query of COMPREHENSIVE_QUERIES) {
      const queryResults = this.results.filter(r => r.queryId === query.id && r.success);
      if (queryResults.length === 0) continue;

      report += `### ${query.id} (${query.complexity} complexity, ${query.category} category)\n\n`;
      report += `**Query**: "${query.query.substring(0, 100)}..."\n\n`;
      
      const avgConf = queryResults.reduce((sum, r) => sum + r.overallConfidence, 0) / queryResults.length;
      const avgTime = queryResults.reduce((sum, r) => sum + r.totalTime, 0) / queryResults.length;
      
      report += `**Overall Performance**: ${(avgConf * 100).toFixed(1)}% confidence, ${(avgTime / 1000).toFixed(2)}s average\n\n`;
      
      report += `| Model | Confidence | Time (s) | Words | Processing Path | Grade |\n`;
      report += `|-------|------------|----------|-------|-----------------|-------|\n`;
      
      queryResults.sort((a, b) => b.overallConfidence - a.overallConfidence).forEach(result => {
        const grade = result.step4.details?.performanceGrade || 'N/A';
        report += `| ${result.shortName} | ${(result.overallConfidence * 100).toFixed(1)}% | ${(result.totalTime / 1000).toFixed(2)} | ${result.wordCount} | ${result.processingPath} | ${grade} |\n`;
      });
      
      report += `\n`;
    }

    // 4-Step Methodology Performance
    report += `## 4-Step Methodology Analysis\n\n`;
    
    const step1Success = this.results.filter(r => r.step1.completed).length;
    const step2Success = this.results.filter(r => r.step2.completed).length;
    const step3Success = this.results.filter(r => r.step3.completed).length;
    const step4Success = this.results.filter(r => r.step4.completed).length;
    
    report += `**Step Completion Rates**:\n`;
    report += `- Step 1 (Query Analysis): ${((step1Success / this.results.length) * 100).toFixed(1)}%\n`;
    report += `- Step 2 (Response Generation): ${((step2Success / this.results.length) * 100).toFixed(1)}%\n`;
    report += `- Step 3 (Evaluation): ${((step3Success / this.results.length) * 100).toFixed(1)}%\n`;
    report += `- Step 4 (Adaptive Delivery): ${((step4Success / this.results.length) * 100).toFixed(1)}%\n\n`;

    // Recommendations
    report += `## Recommendations\n\n`;
    
    const topPerformers = successful.sort((a, b) => b.overallConfidence - a.overallConfidence).slice(0, 3);
    if (topPerformers.length > 0) {
      report += `### Top Performing Models:\n\n`;
      topPerformers.forEach((result, index) => {
        report += `${index + 1}. **${result.shortName}** - ${(result.overallConfidence * 100).toFixed(1)}% confidence\n`;
        report += `   - Best for: ${result.queryCategory} queries\n`;
        report += `   - Performance: ${result.performance.speed}/${result.performance.efficiency}/${result.performance.accuracy}\n\n`;
      });
    }

    report += `### Use Case Recommendations:\n\n`;
    report += `- **For Speed**: Choose models with <10s response times\n`;
    report += `- **For Accuracy**: Choose models with >85% confidence scores\n`;
    report += `- **For Complex Queries**: Use high-confidence-complex processing path\n`;
    report += `- **For Production**: Consider models with 'A' performance grades\n\n`;

    report += `## Conclusion\n\n`;
    report += `The comprehensive testing demonstrates successful implementation of the 4-step confidence RAG methodology across ${ALL_MODELS.length} diverse models. `;
    report += `The system successfully evaluated ${this.results.length} total interactions with a ${((successful.length / this.results.length) * 100).toFixed(1)}% success rate.\n\n`;

    return report;
  }

  displayComprehensiveSummary() {
    console.log("\n📈 COMPREHENSIVE TEST RESULTS SUMMARY");
    console.log("=" * 80);
    
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    
    console.log(`📊 Test Statistics:`);
    console.log(`   ✅ Successful Tests: ${successful.length}`);
    console.log(`   ❌ Failed Tests: ${failed.length}`);
    console.log(`   📈 Success Rate: ${((successful.length / this.results.length) * 100).toFixed(1)}%`);
    console.log(`   🎯 Total Tests: ${this.results.length}`);
    
    if (successful.length > 0) {
      const avgConfidence = successful.reduce((sum, r) => sum + r.overallConfidence, 0) / successful.length;
      const avgTime = successful.reduce((sum, r) => sum + r.totalTime, 0) / successful.length;
      const avgWords = successful.reduce((sum, r) => sum + r.wordCount, 0) / successful.length;
      
      console.log(`\n📋 Performance Metrics:`);
      console.log(`   🎯 Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Average Time: ${(avgTime / 1000).toFixed(2)}s`);
      console.log(`   📝 Average Response: ${avgWords.toFixed(0)} words`);
      
      // Top performers by model
      console.log(`\n🏆 TOP PERFORMING MODELS:`);
      const modelPerformance = Object.entries(this.modelStats)
        .filter(([_, stats]) => stats.successfulTests > 0)
        .map(([name, stats]) => ({
          name,
          avgConfidence: stats.totalConfidence / stats.successfulTests,
          successRate: stats.successfulTests / stats.totalTests,
          avgTime: stats.totalTime / stats.successfulTests
        }))
        .sort((a, b) => b.avgConfidence - a.avgConfidence)
        .slice(0, 5);
        
      modelPerformance.forEach((model, index) => {
        console.log(`   ${index + 1}. ${model.name}`);
        console.log(`      📊 ${(model.avgConfidence * 100).toFixed(1)}% confidence, ${(model.successRate * 100).toFixed(1)}% success rate`);
        console.log(`      ⏱️  ${(model.avgTime / 1000).toFixed(2)}s average response time`);
      });
    }

    console.log(`\n✅ COMPREHENSIVE TESTING COMPLETED SUCCESSFULLY!`);
    console.log(`📄 Detailed reports generated with full comparisons`);
    console.log("=" * 80);
  }
}

async function main() {
  const tester = new ComprehensiveModelTester();
  
  try {
    await tester.runComprehensiveTests();
  } catch (error) {
    console.error("❌ Comprehensive test execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}