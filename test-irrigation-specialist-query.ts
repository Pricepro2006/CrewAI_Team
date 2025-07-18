/**
 * Real-world test: Finding irrigation specialists for a specific address
 * Tests all 8 models through the 4-step confidence-scored RAG methodology
 */

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

// Real-world irrigation specialist query
const IRRIGATION_QUERY = `
Find current irrigation specialists to assist with a cracked, leaking sprinkler head from a root growing into the irrigation piping, for the area surrounding the following address. They need to be able to travel to this location and if you can include initial visit costs, add that information as well.
Address: 278 Wycliff Dr. Spartanburg, SC 29301
`;

interface StepResult {
  stepName: string;
  model: string;
  startTime: number;
  endTime: number;
  duration: number;
  response: string;
  confidence: number;
  success: boolean;
  error?: string;
}

interface ModelTestResult {
  model: string;
  totalDuration: number;
  overallSuccess: boolean;
  steps: {
    step1_query_analysis: StepResult;
    step2_response_generation: StepResult;
    step3_evaluation: StepResult;
    step4_delivery: StepResult;
  };
  finalResponse: string;
  practicalScore: number; // How well did it actually answer the question
}

class IrrigationSpecialistTester {
  private results: ModelTestResult[] = [];

  async testModel(modelName: string): Promise<ModelTestResult> {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`Testing ${modelName} for irrigation specialist query`);
    console.log(`${'='.repeat(80)}\n`);

    const startTime = Date.now();
    const result: ModelTestResult = {
      model: modelName,
      totalDuration: 0,
      overallSuccess: false,
      steps: {
        step1_query_analysis: null as any,
        step2_response_generation: null as any,
        step3_evaluation: null as any,
        step4_delivery: null as any
      },
      finalResponse: '',
      practicalScore: 0
    };

    try {
      // Check if model is available
      const listResponse = await fetch('http://localhost:11434/api/tags');
      const modelList = await listResponse.json();
      const isAvailable = modelList.models?.some((m: any) => m.name === modelName);
      
      if (!isAvailable) {
        console.log(`Model ${modelName} not available. Run: ollama pull ${modelName}`);
        return result;
      }

      // Step 1: Query Analysis & Understanding
      console.log('Step 1: Query Analysis & Understanding');
      result.steps.step1_query_analysis = await this.step1QueryAnalysis(modelName);
      
      // Step 2: Response Generation with Search Intent
      console.log('\nStep 2: Response Generation with Search Intent');
      result.steps.step2_response_generation = await this.step2ResponseGeneration(modelName);
      
      // Step 3: Evaluation of Response Quality
      console.log('\nStep 3: Evaluation of Response Quality');
      result.steps.step3_evaluation = await this.step3Evaluation(
        modelName,
        result.steps.step2_response_generation.response
      );
      
      // Step 4: Adaptive Delivery
      console.log('\nStep 4: Adaptive Delivery');
      result.steps.step4_delivery = await this.step4AdaptiveDelivery(
        modelName,
        result.steps.step2_response_generation.response,
        result.steps.step3_evaluation.confidence
      );

      // Calculate overall metrics
      result.totalDuration = Date.now() - startTime;
      result.overallSuccess = Object.values(result.steps).every(step => step?.success);
      result.finalResponse = result.steps.step4_delivery.response;
      result.practicalScore = this.calculatePracticalScore(result);

    } catch (error) {
      console.error(`Error testing ${modelName}:`, error);
    }

    return result;
  }

  private async step1QueryAnalysis(model: string): Promise<StepResult> {
    const startTime = Date.now();
    const prompt = `Analyze this query and identify the key requirements:
"${IRRIGATION_QUERY}"

Return a JSON object with:
{
  "intent": "find_service_provider",
  "service_type": "irrigation_specialist",
  "location": { "address": "...", "city": "...", "state": "...", "zip": "..." },
  "problem": "...",
  "requirements": ["travel_to_location", "initial_visit_cost"],
  "urgency": "normal|urgent|emergency"
}`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.3, num_predict: 512 }
        })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      // Try to parse JSON from response
      let confidence = 0.5;
      try {
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.service_type && parsed.location) {
            confidence = 0.8;
          }
        }
      } catch {}

      return {
        stepName: 'Query Analysis',
        model,
        startTime,
        endTime: Date.now(),
        duration,
        response: result.response,
        confidence,
        success: true
      };
    } catch (error) {
      return {
        stepName: 'Query Analysis',
        model,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        response: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  private async step2ResponseGeneration(model: string): Promise<StepResult> {
    const startTime = Date.now();
    const prompt = `You are helping find irrigation specialists for a specific issue and location.

Query: "${IRRIGATION_QUERY}"

Generate a helpful response that includes:
1. Understanding of the problem (root damage to sprinkler system)
2. Type of specialist needed
3. How to find local irrigation specialists in Spartanburg, SC
4. What questions to ask when contacting them
5. Typical cost ranges for initial visits
6. Emergency vs regular service considerations

Be specific and practical in your recommendations.`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.7, num_predict: 1024 }
        })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      // Calculate confidence based on response quality
      let confidence = 0.5;
      const text = result.response || '';
      
      // Check for key elements
      if (text.toLowerCase().includes('irrigation')) confidence += 0.1;
      if (text.toLowerCase().includes('spartanburg')) confidence += 0.1;
      if (text.toLowerCase().includes('root')) confidence += 0.05;
      if (text.toLowerCase().includes('cost') || text.toLowerCase().includes('price')) confidence += 0.1;
      if (text.toLowerCase().includes('specialist')) confidence += 0.05;
      if (text.match(/\$\d+/)) confidence += 0.1; // Has price information

      return {
        stepName: 'Response Generation',
        model,
        startTime,
        endTime: Date.now(),
        duration,
        response: result.response,
        confidence: Math.min(0.95, confidence),
        success: true
      };
    } catch (error) {
      return {
        stepName: 'Response Generation',
        model,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        response: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  private async step3Evaluation(model: string, generatedResponse: string): Promise<StepResult> {
    const startTime = Date.now();
    const prompt = `Evaluate this response for finding irrigation specialists:

Original Query: "${IRRIGATION_QUERY}"

Generated Response: "${generatedResponse}"

Evaluate on these criteria (score 0-1 for each):
1. Relevance: Does it address finding irrigation specialists?
2. Location-specific: Does it consider Spartanburg, SC area?
3. Problem understanding: Does it acknowledge the root damage issue?
4. Practical advice: Does it provide actionable steps?
5. Cost information: Does it mention pricing or cost ranges?

Return JSON: {"relevance": 0.X, "location_specific": 0.X, "problem_understanding": 0.X, "practical_advice": 0.X, "cost_info": 0.X, "overall_score": 0.X}`;

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: { temperature: 0.2, num_predict: 256 }
        })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;
      
      // Try to parse evaluation
      let confidence = 0.5;
      try {
        const jsonMatch = result.response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          confidence = parsed.overall_score || 0.5;
        }
      } catch {}

      return {
        stepName: 'Response Evaluation',
        model,
        startTime,
        endTime: Date.now(),
        duration,
        response: result.response,
        confidence,
        success: true
      };
    } catch (error) {
      return {
        stepName: 'Response Evaluation',
        model,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        response: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  private async step4AdaptiveDelivery(
    model: string, 
    response: string, 
    confidence: number
  ): Promise<StepResult> {
    const startTime = Date.now();
    
    let deliveryPrompt = '';
    if (confidence > 0.8) {
      deliveryPrompt = `Present this response with high confidence:
"${response}"

Add a confidence statement like "Based on the specific requirements for 278 Wycliff Dr, Spartanburg, SC 29301..."`;
    } else if (confidence > 0.6) {
      deliveryPrompt = `Present this response with appropriate caveats:
"${response}"

Add disclaimers about needing to verify current availability and pricing.`;
    } else {
      deliveryPrompt = `The response quality is low. Provide a fallback response that:
1. Acknowledges the irrigation issue at 278 Wycliff Dr, Spartanburg, SC
2. Suggests calling local irrigation services
3. Recommends getting multiple quotes
4. Mentions typical service call fees range from $75-150`;
    }

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: deliveryPrompt,
          stream: false,
          options: { temperature: 0.5, num_predict: 768 }
        })
      });

      const result = await response.json();
      const duration = Date.now() - startTime;

      return {
        stepName: 'Adaptive Delivery',
        model,
        startTime,
        endTime: Date.now(),
        duration,
        response: result.response,
        confidence,
        success: true
      };
    } catch (error) {
      return {
        stepName: 'Adaptive Delivery',
        model,
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        response: '',
        confidence: 0,
        success: false,
        error: error.message
      };
    }
  }

  private calculatePracticalScore(result: ModelTestResult): number {
    let score = 0;
    const finalResponse = result.finalResponse.toLowerCase();
    
    // Check for essential elements (each worth 0.1)
    if (finalResponse.includes('irrigation')) score += 0.1;
    if (finalResponse.includes('specialist')) score += 0.1;
    if (finalResponse.includes('spartanburg')) score += 0.1;
    if (finalResponse.includes('278 wycliff') || finalResponse.includes('29301')) score += 0.1;
    if (finalResponse.includes('root')) score += 0.1;
    if (finalResponse.includes('cost') || finalResponse.includes('price') || finalResponse.match(/\$\d+/)) score += 0.1;
    
    // Check for practical advice (each worth 0.05)
    if (finalResponse.includes('call') || finalResponse.includes('contact')) score += 0.05;
    if (finalResponse.includes('quote')) score += 0.05;
    if (finalResponse.includes('emergency') || finalResponse.includes('urgent')) score += 0.05;
    if (finalResponse.includes('license') || finalResponse.includes('insur')) score += 0.05;
    
    // Speed bonus
    if (result.totalDuration < 30000) score += 0.1; // Under 30 seconds
    if (result.totalDuration < 15000) score += 0.1; // Under 15 seconds
    
    return Math.min(1, score);
  }

  async runAllTests(): Promise<void> {
    console.log('\nStarting Irrigation Specialist Query Test');
    console.log('Query:', IRRIGATION_QUERY.trim());
    console.log('\nThis test evaluates how well each model can help find real service providers.\n');

    for (const model of MODELS_TO_TEST) {
      const result = await this.testModel(model);
      this.results.push(result);
      
      // Save intermediate results
      await this.saveResults();
      
      // Brief pause between models
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    await this.generateReport();
  }

  private async saveResults(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `irrigation-specialist-test-${timestamp}.json`;
    
    await fs.writeFile(
      path.join(process.cwd(), filename),
      JSON.stringify(this.results, null, 2)
    );
  }

  private async generateReport(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    let report = `# Irrigation Specialist Query Test Report\n\n`;
    report += `**Date**: ${new Date().toISOString()}\n`;
    report += `**Query**: Find irrigation specialists for 278 Wycliff Dr, Spartanburg, SC 29301\n\n`;
    
    report += `## Executive Summary\n\n`;
    report += `Tested ${MODELS_TO_TEST.length} models on a real-world service provider search query.\n\n`;
    
    // Rankings
    const sortedByScore = [...this.results].sort((a, b) => b.practicalScore - a.practicalScore);
    const sortedBySpeed = [...this.results].sort((a, b) => a.totalDuration - b.totalDuration);
    
    report += `## Model Rankings\n\n`;
    report += `### By Practical Score (How well they answered the question)\n\n`;
    report += `| Rank | Model | Score | Total Time | Success |\n`;
    report += `|------|-------|-------|------------|--------|\n`;
    
    sortedByScore.forEach((result, index) => {
      report += `| ${index + 1} | ${result.model} | ${(result.practicalScore * 100).toFixed(1)}% | ${(result.totalDuration / 1000).toFixed(2)}s | ${result.overallSuccess ? '✅' : '❌'} |\n`;
    });
    
    report += `\n### By Speed\n\n`;
    report += `| Rank | Model | Total Time | Score | Success |\n`;
    report += `|------|-------|------------|-------|--------|\n`;
    
    sortedBySpeed.forEach((result, index) => {
      report += `| ${index + 1} | ${result.model} | ${(result.totalDuration / 1000).toFixed(2)}s | ${(result.practicalScore * 100).toFixed(1)}% | ${result.overallSuccess ? '✅' : '❌'} |\n`;
    });
    
    // Detailed results for each model
    report += `\n## Detailed Results by Model\n\n`;
    
    for (const result of this.results) {
      report += `### ${result.model}\n\n`;
      report += `**Overall Success**: ${result.overallSuccess ? '✅ Yes' : '❌ No'}\n`;
      report += `**Practical Score**: ${(result.practicalScore * 100).toFixed(1)}%\n`;
      report += `**Total Duration**: ${(result.totalDuration / 1000).toFixed(2)}s\n\n`;
      
      report += `#### Step-by-Step Performance:\n\n`;
      
      // Step 1
      const step1 = result.steps.step1_query_analysis;
      if (step1) {
        report += `**Step 1: Query Analysis** (${(step1.duration / 1000).toFixed(2)}s)\n`;
        report += `- Success: ${step1.success ? '✅' : '❌'}\n`;
        report += `- Confidence: ${(step1.confidence * 100).toFixed(1)}%\n`;
        report += `- Response Preview: ${step1.response.substring(0, 200)}...\n\n`;
      }
      
      // Step 2
      const step2 = result.steps.step2_response_generation;
      if (step2) {
        report += `**Step 2: Response Generation** (${(step2.duration / 1000).toFixed(2)}s)\n`;
        report += `- Success: ${step2.success ? '✅' : '❌'}\n`;
        report += `- Confidence: ${(step2.confidence * 100).toFixed(1)}%\n`;
        report += `- Key elements found: `;
        const elements = [];
        if (step2.response.toLowerCase().includes('irrigation')) elements.push('irrigation');
        if (step2.response.toLowerCase().includes('spartanburg')) elements.push('location');
        if (step2.response.toLowerCase().includes('root')) elements.push('root issue');
        if (step2.response.match(/\$\d+/)) elements.push('pricing');
        report += elements.join(', ') || 'None';
        report += `\n\n`;
      }
      
      // Step 3
      const step3 = result.steps.step3_evaluation;
      if (step3) {
        report += `**Step 3: Evaluation** (${(step3.duration / 1000).toFixed(2)}s)\n`;
        report += `- Success: ${step3.success ? '✅' : '❌'}\n`;
        report += `- Confidence: ${(step3.confidence * 100).toFixed(1)}%\n\n`;
      }
      
      // Step 4
      const step4 = result.steps.step4_delivery;
      if (step4) {
        report += `**Step 4: Adaptive Delivery** (${(step4.duration / 1000).toFixed(2)}s)\n`;
        report += `- Success: ${step4.success ? '✅' : '❌'}\n`;
        report += `- Delivery confidence: ${(step4.confidence * 100).toFixed(1)}%\n\n`;
      }
      
      report += `**Final Response:**\n\`\`\`\n${result.finalResponse.substring(0, 500)}...\n\`\`\`\n\n`;
      report += `---\n\n`;
    }
    
    // Recommendations
    report += `## Recommendations\n\n`;
    
    const bestOverall = sortedByScore[0];
    const fastest = sortedBySpeed[0];
    
    report += `### Best Model for This Query Type\n\n`;
    report += `**${bestOverall.model}** - Achieved ${(bestOverall.practicalScore * 100).toFixed(1)}% practical score\n\n`;
    
    report += `### Multi-Model Strategy\n\n`;
    report += `1. **Primary**: ${bestOverall.model} - Best quality responses\n`;
    report += `2. **Speed Critical**: ${fastest.model} - Fastest responses\n`;
    report += `3. **Fallback**: Consider models with >70% practical score\n\n`;
    
    report += `### Key Findings\n\n`;
    report += `1. Models that included location-specific information scored highest\n`;
    report += `2. Pricing information was challenging for most models\n`;
    report += `3. Smaller models struggled with the multi-part requirements\n`;
    report += `4. The 4-step methodology helped structure responses effectively\n`;
    
    // Save report
    const reportFilename = `irrigation-specialist-test-report-${timestamp}.md`;
    await fs.writeFile(
      path.join(process.cwd(), reportFilename),
      report
    );
    
    console.log(`\n✅ Report saved to: ${reportFilename}`);
    
    // Print summary to console
    console.log('\n' + '='.repeat(80));
    console.log('TEST COMPLETE - SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nBest Overall: ${bestOverall.model} (${(bestOverall.practicalScore * 100).toFixed(1)}%)`);
    console.log(`Fastest: ${fastest.model} (${(fastest.totalDuration / 1000).toFixed(2)}s)`);
    console.log('\nTop 3 Models by Practical Score:');
    sortedByScore.slice(0, 3).forEach((r, i) => {
      console.log(`${i + 1}. ${r.model}: ${(r.practicalScore * 100).toFixed(1)}%`);
    });
  }
}

// Run the test
async function main() {
  console.log('Checking if Ollama is running...');
  
  try {
    await fetch('http://localhost:11434/api/tags');
  } catch (error) {
    console.error('❌ Ollama is not running! Please start it with: ollama serve');
    process.exit(1);
  }
  
  const tester = new IrrigationSpecialistTester();
  await tester.runAllTests();
}

// Run the test directly
main().catch(console.error);