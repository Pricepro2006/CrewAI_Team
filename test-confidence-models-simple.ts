/**
 * Simplified test of confidence-scored RAG methodology across multiple models
 * Tests each model's performance on complex queries without full system dependencies
 */

import { OllamaProvider } from './src/core/llm/OllamaProvider.js';
import { QueryComplexityAnalyzer } from './src/core/rag/confidence/QueryComplexityAnalyzer.js';
import { ConfidenceResponseGenerator } from './src/core/rag/confidence/ConfidenceResponseGenerator.js';
import { MultiModalEvaluator } from './src/core/rag/confidence/MultiModalEvaluator.js';
import { AdaptiveDeliveryManager } from './src/core/rag/confidence/AdaptiveDeliveryManager.js';
import fs from 'fs/promises';
import path from 'path';

// Models to test
const MODELS_TO_TEST = [
  'qwen3:0.6b',
  'gemma3n:e2b',
  'gemma3n:e4b',
  'phi4-mini-reasoning:3.8b',
  'qwen3:1.7b',
  'qwen3:4b',
  'granite3.3:8b',
  'granite3.3:2b'
];

// Complex test query that exercises all 4 steps of our methodology
const COMPLEX_QUERY = `
I need a comprehensive analysis of implementing a microservices architecture for our e-commerce platform. 
Please analyze:
1. The key components needed (authentication, catalog, cart, payment, inventory)
2. Inter-service communication patterns (REST vs gRPC vs message queues)
3. Data consistency strategies across services
4. Deployment and scaling considerations
5. Security implications and best practices
Provide specific recommendations with confidence levels for each aspect.
`;

interface StepResult {
  stepName: string;
  startTime: number;
  endTime: number;
  duration: number;
  response: any;
  confidence: number;
  error?: string;
}

interface ModelTestResult {
  model: string;
  totalDuration: number;
  stepsCompleted: number;
  steps: StepResult[];
  finalResponse: string;
  finalConfidence: number;
  overallScore: number;
  error?: string;
}

class SimpleConfidenceModelTester {
  private results: ModelTestResult[] = [];

  async testModel(modelName: string): Promise<ModelTestResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing model: ${modelName}`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();
    const steps: StepResult[] = [];
    let stepsCompleted = 0;

    try {
      // Initialize LLM provider for this model
      const llmProvider = new OllamaProvider({ 
        baseUrl: 'http://localhost:11434',
        model: modelName,
        temperature: 0.7
      });

      // Test model availability
      console.log(`Checking model availability...`);
      try {
        await llmProvider.initialize();
      } catch (error) {
        throw new Error(`Model ${modelName} not available. Please run: ollama pull ${modelName}`);
      }

      // Initialize confidence components
      const queryAnalyzer = new QueryComplexityAnalyzer();
      const responseGenerator = new ConfidenceResponseGenerator(llmProvider);
      const evaluator = new MultiModalEvaluator();
      const deliveryManager = new AdaptiveDeliveryManager();

      // Step 1: Query Processing & Analysis
      console.log('\nStep 1: Query Processing & Analysis');
      const step1Start = Date.now();
      let queryComplexity: any;
      
      try {
        queryComplexity = await queryAnalyzer.assessComplexity(COMPLEX_QUERY);
        console.log(`Query complexity: ${queryComplexity.score}/10`);
        console.log(`Domains detected: ${queryComplexity.factors.domains.length}`);
        console.log(`Technical terms: ${queryComplexity.factors.technicalTerms.length}`);
        
        steps.push({
          stepName: 'Query Processing & Analysis',
          startTime: step1Start,
          endTime: Date.now(),
          duration: Date.now() - step1Start,
          response: queryComplexity,
          confidence: queryComplexity.score / 10
        });
        stepsCompleted++;
      } catch (error) {
        steps.push({
          stepName: 'Query Processing & Analysis',
          startTime: step1Start,
          endTime: Date.now(),
          duration: Date.now() - step1Start,
          response: null,
          confidence: 0,
          error: error.message
        });
      }

      // Step 2: Response Generation with Confidence Tracking
      console.log('\nStep 2: Response Generation with Confidence Tracking');
      const step2Start = Date.now();
      let generationResult: any;
      
      try {
        const context = {
          query: COMPLEX_QUERY,
          queryComplexity: queryComplexity?.score || 5,
          documents: [], // No documents for this simple test
          retrievalConfidence: 0.5
        };
        
        generationResult = await responseGenerator.generateWithConfidence(
          context,
          { temperature: 0.7, extractConfidence: true }
        );
        
        console.log(`Generated response with confidence: ${generationResult.aggregatedConfidence.toFixed(3)}`);
        console.log(`Response length: ${generationResult.response.length} characters`);
        console.log(`Uncertainty markers: ${generationResult.uncertaintyMarkers.length}`);
        
        steps.push({
          stepName: 'Response Generation with Confidence Tracking',
          startTime: step2Start,
          endTime: Date.now(),
          duration: Date.now() - step2Start,
          response: {
            responseLength: generationResult.response.length,
            uncertaintyMarkers: generationResult.uncertaintyMarkers.length,
            tokensGenerated: generationResult.generationMetrics.tokensGenerated
          },
          confidence: generationResult.aggregatedConfidence
        });
        stepsCompleted++;
      } catch (error) {
        steps.push({
          stepName: 'Response Generation with Confidence Tracking',
          startTime: step2Start,
          endTime: Date.now(),
          duration: Date.now() - step2Start,
          response: null,
          confidence: 0,
          error: error.message
        });
      }

      // Step 3: Multi-Modal Evaluation & Calibration
      console.log('\nStep 3: Multi-Modal Evaluation & Calibration');
      const step3Start = Date.now();
      let evaluationResult: any;
      
      try {
        evaluationResult = await evaluator.evaluate(
          COMPLEX_QUERY,
          generationResult?.response || '',
          [], // No sources for this simple test
          generationResult?.aggregatedConfidence || 0.5
        );
        
        console.log(`Factuality score: ${evaluationResult.factuality.score.toFixed(3)}`);
        console.log(`Relevance score: ${evaluationResult.relevance.score.toFixed(3)}`);
        console.log(`Coherence score: ${evaluationResult.coherence.score.toFixed(3)}`);
        console.log(`Calibrated confidence: ${evaluationResult.confidence.calibrated.toFixed(3)}`);
        
        steps.push({
          stepName: 'Multi-Modal Evaluation & Calibration',
          startTime: step3Start,
          endTime: Date.now(),
          duration: Date.now() - step3Start,
          response: {
            factuality: evaluationResult.factuality.score,
            relevance: evaluationResult.relevance.score,
            coherence: evaluationResult.coherence.score,
            rawConfidence: evaluationResult.confidence.raw,
            calibratedConfidence: evaluationResult.confidence.calibrated
          },
          confidence: evaluationResult.confidence.calibrated
        });
        stepsCompleted++;
      } catch (error) {
        steps.push({
          stepName: 'Multi-Modal Evaluation & Calibration',
          startTime: step3Start,
          endTime: Date.now(),
          duration: Date.now() - step3Start,
          response: null,
          confidence: 0,
          error: error.message
        });
      }

      // Step 4: Adaptive Response Delivery
      console.log('\nStep 4: Adaptive Response Delivery');
      const step4Start = Date.now();
      let deliveryResult: any;
      
      try {
        deliveryResult = await deliveryManager.deliver(
          evaluationResult || {
            confidence: { calibrated: 0.5 },
            action: 'fallback',
            factuality: { score: 0.5 },
            relevance: { score: 0.5 },
            coherence: { score: 0.5 }
          },
          generationResult?.response || 'Unable to generate response',
          { includeEvidence: true, includeConfidenceBreakdown: true }
        );
        
        console.log(`Delivery action: ${deliveryResult.action}`);
        console.log(`Confidence level: ${deliveryResult.confidenceLevel}`);
        
        steps.push({
          stepName: 'Adaptive Response Delivery',
          startTime: step4Start,
          endTime: Date.now(),
          duration: Date.now() - step4Start,
          response: {
            action: deliveryResult.action,
            confidenceLevel: deliveryResult.confidenceLevel,
            warnings: deliveryResult.warnings?.length || 0
          },
          confidence: evaluationResult?.confidence.calibrated || 0.5
        });
        stepsCompleted++;
      } catch (error) {
        steps.push({
          stepName: 'Adaptive Response Delivery',
          startTime: step4Start,
          endTime: Date.now(),
          duration: Date.now() - step4Start,
          response: null,
          confidence: 0,
          error: error.message
        });
      }

      // Calculate overall score
      const overallScore = this.calculateOverallScore(steps, stepsCompleted);
      
      return {
        model: modelName,
        totalDuration: Date.now() - startTime,
        stepsCompleted,
        steps,
        finalResponse: deliveryResult?.formattedResponse || generationResult?.response || 'No response generated',
        finalConfidence: evaluationResult?.confidence.calibrated || 0,
        overallScore
      };

    } catch (error) {
      return {
        model: modelName,
        totalDuration: Date.now() - startTime,
        stepsCompleted,
        steps,
        finalResponse: '',
        finalConfidence: 0,
        overallScore: 0,
        error: error.message
      };
    }
  }

  private calculateOverallScore(steps: StepResult[], stepsCompleted: number): number {
    // Score based on:
    // - Steps completed (40%)
    // - Average confidence (30%)
    // - Speed (20%)
    // - No errors (10%)
    
    const completionScore = (stepsCompleted / 4) * 0.4;
    
    const avgConfidence = steps
      .filter(s => !s.error)
      .reduce((sum, s) => sum + s.confidence, 0) / Math.max(1, steps.filter(s => !s.error).length);
    const confidenceScore = avgConfidence * 0.3;
    
    const totalDuration = steps.reduce((sum, s) => sum + s.duration, 0);
    const speedScore = Math.max(0, 1 - (totalDuration / 60000)) * 0.2; // Penalize if > 60s
    
    const errorCount = steps.filter(s => s.error).length;
    const errorScore = (1 - (errorCount / 4)) * 0.1;
    
    return completionScore + confidenceScore + speedScore + errorScore;
  }

  async runAllTests(): Promise<void> {
    console.log('\nStarting simplified confidence model testing for 4-step methodology');
    console.log(`Testing query: ${COMPLEX_QUERY.trim()}\n`);

    for (const model of MODELS_TO_TEST) {
      try {
        const result = await this.testModel(model);
        this.results.push(result);
        
        // Save intermediate results
        await this.saveResults();
      } catch (error) {
        console.error(`Failed to test model ${model}:`, error.message);
        this.results.push({
          model,
          totalDuration: 0,
          stepsCompleted: 0,
          steps: [],
          finalResponse: '',
          finalConfidence: 0,
          overallScore: 0,
          error: error.message
        });
      }
    }

    await this.generateReport();
  }

  private async saveResults(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `confidence-model-test-results-${timestamp}.json`;
    
    await fs.writeFile(
      path.join(process.cwd(), filename),
      JSON.stringify(this.results, null, 2)
    );
  }

  private async generateReport(): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('COMPREHENSIVE MODEL TESTING REPORT');
    console.log('='.repeat(80));
    
    // Sort results by overall score
    const sortedResults = [...this.results].sort((a, b) => b.overallScore - a.overallScore);
    
    console.log('\nMODEL RANKINGS:');
    console.log('-'.repeat(80));
    
    sortedResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.model}`);
      console.log(`   Overall Score: ${(result.overallScore * 100).toFixed(2)}%`);
      console.log(`   Steps Completed: ${result.stepsCompleted}/4`);
      console.log(`   Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);
      console.log(`   Final Confidence: ${(result.finalConfidence * 100).toFixed(2)}%`);
      
      if (result.error) {
        console.log(`   ERROR: ${result.error}`);
      }
      
      // Step breakdown
      console.log(`   Step Performance:`);
      result.steps.forEach((step, stepIndex) => {
        console.log(`     ${stepIndex + 1}. ${step.stepName}:`);
        console.log(`        Duration: ${(step.duration / 1000).toFixed(2)}s`);
        console.log(`        Confidence: ${(step.confidence * 100).toFixed(2)}%`);
        if (step.error) {
          console.log(`        ERROR: ${step.error}`);
        }
      });
    });
    
    // Best model analysis
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS & RECOMMENDATIONS:');
    console.log('='.repeat(80));
    
    const bestOverall = sortedResults[0];
    const fastestModel = [...this.results].sort((a, b) => a.totalDuration - b.totalDuration)[0];
    const mostConfident = [...this.results].sort((a, b) => b.finalConfidence - a.finalConfidence)[0];
    const mostComplete = [...this.results].sort((a, b) => b.stepsCompleted - a.stepsCompleted)[0];
    
    console.log(`\nBest Overall Model: ${bestOverall.model}`);
    console.log(`Fastest Model: ${fastestModel.model} (${(fastestModel.totalDuration / 1000).toFixed(2)}s)`);
    console.log(`Most Confident Model: ${mostConfident.model} (${(mostConfident.finalConfidence * 100).toFixed(2)}%)`);
    console.log(`Most Complete Model: ${mostComplete.model} (${mostComplete.stepsCompleted}/4 steps)`);
    
    // Multi-model recommendation
    console.log('\nMULTI-MODEL STRATEGY RECOMMENDATION:');
    const topModels = sortedResults.slice(0, 3);
    if (topModels.length >= 2) {
      console.log(`Consider using a multi-model approach with:`);
      console.log(`- Primary: ${topModels[0].model} (highest overall score)`);
      console.log(`- Fallback: ${topModels[1].model} (second best)`);
      if (fastestModel.model !== topModels[0].model && fastestModel.model !== topModels[1].model) {
        console.log(`- Speed-critical: ${fastestModel.model} (for time-sensitive queries)`);
      }
    }
    
    // Save report
    const reportContent = this.generateMarkdownReport(sortedResults);
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const reportFilename = `confidence-model-test-report-${timestamp}.md`;
    
    await fs.writeFile(
      path.join(process.cwd(), reportFilename),
      reportContent
    );
    
    console.log(`\nDetailed report saved to: ${reportFilename}`);
  }

  private generateMarkdownReport(sortedResults: ModelTestResult[]): string {
    let report = `# Confidence-Scored RAG Model Testing Report\n\n`;
    report += `**Date**: ${new Date().toISOString()}\n\n`;
    report += `**Test Query**: ${COMPLEX_QUERY.trim()}\n\n`;
    
    report += `## Executive Summary\n\n`;
    report += `Tested ${MODELS_TO_TEST.length} models using our 4-step confidence-scored RAG methodology.\n\n`;
    
    report += `## Model Rankings\n\n`;
    report += `| Rank | Model | Overall Score | Steps Completed | Duration | Final Confidence |\n`;
    report += `|------|-------|---------------|-----------------|----------|------------------|\n`;
    
    sortedResults.forEach((result, index) => {
      report += `| ${index + 1} | ${result.model} | ${(result.overallScore * 100).toFixed(2)}% | ${result.stepsCompleted}/4 | ${(result.totalDuration / 1000).toFixed(2)}s | ${(result.finalConfidence * 100).toFixed(2)}% |\n`;
    });
    
    report += `\n## Detailed Results\n\n`;
    
    sortedResults.forEach((result) => {
      report += `### ${result.model}\n\n`;
      
      if (result.error) {
        report += `**ERROR**: ${result.error}\n\n`;
      }
      
      report += `**Performance Metrics**:\n`;
      report += `- Overall Score: ${(result.overallScore * 100).toFixed(2)}%\n`;
      report += `- Steps Completed: ${result.stepsCompleted}/4\n`;
      report += `- Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s\n`;
      report += `- Final Confidence: ${(result.finalConfidence * 100).toFixed(2)}%\n\n`;
      
      report += `**Step-by-Step Breakdown**:\n\n`;
      
      result.steps.forEach((step, index) => {
        report += `#### Step ${index + 1}: ${step.stepName}\n`;
        report += `- Duration: ${(step.duration / 1000).toFixed(2)}s\n`;
        report += `- Confidence: ${(step.confidence * 100).toFixed(2)}%\n`;
        
        if (step.error) {
          report += `- Error: ${step.error}\n`;
        } else if (step.response) {
          report += `- Response Details: ${JSON.stringify(step.response, null, 2)}\n`;
        }
        report += `\n`;
      });
      
      if (result.finalResponse) {
        report += `**Final Response** (truncated to 500 chars):\n`;
        report += `\`\`\`\n${result.finalResponse.substring(0, 500)}...\n\`\`\`\n\n`;
      }
      
      report += `---\n\n`;
    });
    
    report += `## Recommendations\n\n`;
    
    const bestOverall = sortedResults[0];
    const fastestModel = [...this.results].sort((a, b) => a.totalDuration - b.totalDuration)[0];
    const mostConfident = [...this.results].sort((a, b) => b.finalConfidence - a.finalConfidence)[0];
    
    report += `### Single Model Recommendation\n`;
    report += `**${bestOverall.model}** - Best overall performance with ${(bestOverall.overallScore * 100).toFixed(2)}% score\n\n`;
    
    report += `### Multi-Model Strategy\n`;
    report += `For optimal results, consider:\n`;
    report += `1. **Primary Model**: ${sortedResults[0].model}\n`;
    report += `2. **Fallback Model**: ${sortedResults[1]?.model || 'N/A'}\n`;
    report += `3. **Speed-Critical**: ${fastestModel.model}\n`;
    report += `4. **High-Confidence**: ${mostConfident.model}\n\n`;
    
    report += `### Model Selection Criteria\n`;
    report += `- For general queries: Use ${bestOverall.model}\n`;
    report += `- For time-sensitive queries: Use ${fastestModel.model}\n`;
    report += `- For critical decisions: Use ${mostConfident.model}\n`;
    
    return report;
  }
}

// Run the tests
async function main() {
  const tester = new SimpleConfidenceModelTester();
  
  try {
    await tester.runAllTests();
    console.log('\nTesting complete!');
  } catch (error) {
    console.error('Testing failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}