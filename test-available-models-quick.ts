import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';

interface ModelTestResult {
  model: string;
  planCreationTime: number;
  success: boolean;
  stepsGenerated?: number;
  responseQuality: string;
  error?: string;
}

// Available models from your request list
const availableModels = [
  'phi3:mini',           // Baseline (FAILED)
  'gemma3n:e2b',        // 5.6GB - Your requested model
  'gemma3n:e4b',        // 7.5GB - Your requested model  
  'granite3.3:8b',      // 4.9GB - Your requested model
  'granite3.3:2b',      // 1.5GB - Your requested model
  'qwen3:1.7b',         // 1.4GB - Your requested model
  'qwen3:4b'            // 2.6GB - Your requested model
];

// Complex 6-step planning prompt (same one that broke phi3:mini)
const complexPlanningPrompt = `
You are the Master Orchestrator. Create a detailed plan to address this query:
"Hello, can you help me understand TypeScript?"

Query Analysis Context:
- Intent: explain
- Complexity: 1/10
- Required domains: development
- Priority: medium
- Estimated duration: 45 seconds
- Resource requirements: {"memory": "low", "computation": "medium", "network": false}
- Detected entities: {"topics": ["TypeScript"], "intent": "explain"}

Agent Routing Plan:
- Selected agents: WriterAgent (priority: 1, confidence: 0.9), ResearchAgent (priority: 2, confidence: 0.8)
- Execution strategy: sequential
- Overall confidence: 0.8
- Risk level: low
- Risk factors: minimal
- Fallback agents available: ToolExecutorAgent

Break down the task into clear, actionable steps considering the analysis and routing context.
For each step, determine:
1. What information is needed (RAG query)
2. Which agent should handle it - PRIORITIZE agents from the routing plan
3. What tools might be required based on resource requirements
4. Expected output

Agent Selection Guidelines (follow routing plan recommendations):
- ResearchAgent: For research, web search, information gathering
- CodeAgent: For programming, debugging, code analysis
- DataAnalysisAgent: For data processing, analysis, metrics
- WriterAgent: For documentation, explanations, summaries
- ToolExecutorAgent: For tool coordination and complex workflows

IMPORTANT: Use the recommended agents from the routing plan unless there's a compelling reason not to.

Return a structured plan in JSON format with the following structure:
{
  "steps": [
    {
      "id": "step-1",
      "description": "Description of the step",
      "agentType": "ResearchAgent|CodeAgent|DataAnalysisAgent|WriterAgent|ToolExecutorAgent",
      "requiresTool": boolean,
      "toolName": "tool_name" (if requiresTool is true),
      "ragQuery": "Query for RAG system",
      "expectedOutput": "Description of expected output",
      "dependencies": ["step-ids"] (optional)
    }
  ]
}`;

async function testModel(modelName: string): Promise<ModelTestResult> {
  console.log(`\n=== Testing ${modelName} ===`);
  
  const result: ModelTestResult = {
    model: modelName,
    planCreationTime: 0,
    success: false,
    responseQuality: 'Not tested'
  };

  try {
    const llm = new OllamaProvider({
      model: modelName,
      baseUrl: 'http://localhost:11434',
    });

    console.log('   🎯 Testing complex 6-step plan creation...');
    const planStart = Date.now();
    
    try {
      const planResponse = await Promise.race([
        llm.generate(complexPlanningPrompt, {
          temperature: 0.3,
          maxTokens: 3000,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 5 minutes')), 300000)
        )
      ]);
      
      result.planCreationTime = (Date.now() - planStart) / 1000;
      console.log(`   ⏱️  Plan creation: ${result.planCreationTime.toFixed(1)}s`);
      
      // Parse and validate response
      try {
        const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            result.stepsGenerated = parsed.steps.length;
            result.success = true;
            
            // Compare to phi3:mini baseline (FAILED at 90.8s with JSON error)
            if (result.stepsGenerated >= 6) {
              result.responseQuality = `🎯 SUCCESS: ${result.stepsGenerated} steps in ${result.planCreationTime.toFixed(1)}s (phi3:mini FAILED)`;
            } else if (result.stepsGenerated >= 3) {
              result.responseQuality = `✅ PARTIAL: ${result.stepsGenerated} steps in ${result.planCreationTime.toFixed(1)}s (phi3:mini FAILED)`;
            } else {
              result.responseQuality = `⚠️  MINIMAL: ${result.stepsGenerated} step(s) (phi3:mini FAILED completely)`;
            }
          } else {
            result.responseQuality = '❌ Invalid JSON structure (missing steps array)';
          }
        } else {
          result.responseQuality = '❌ No JSON found in response';
        }
      } catch (parseError) {
        result.responseQuality = `❌ JSON parse error (like phi3:mini): ${parseError.message}`;
      }
    } catch (error) {
      result.planCreationTime = (Date.now() - planStart) / 1000;
      result.error = error.message;
      
      if (error.message.includes('Timeout')) {
        result.responseQuality = '⏰ TIMEOUT (5+ minutes)';
      } else {
        result.responseQuality = `❌ Generation failed: ${error.message}`;
      }
    }

  } catch (error) {
    console.error(`   💥 Error testing ${modelName}:`, error);
    result.error = error.message;
    result.responseQuality = `❌ Test failed: ${error.message}`;
  }

  return result;
}

async function runAvailableModelTests() {
  console.log('🎯 TESTING AVAILABLE REQUESTED MODELS');
  console.log('📊 Baseline: phi3:mini FAILED (90.8s, JSON parse error, 0 steps)');
  console.log('🎯 Goal: Find models that can successfully complete the 6-step plan');
  console.log(`📋 Testing ${availableModels.length} available models\n`);
  
  const results: ModelTestResult[] = [];
  
  for (const model of availableModels) {
    const result = await testModel(model);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate table
  console.log('\n' + '='.repeat(100));
  console.log('🏆 AVAILABLE REQUESTED MODELS vs phi3:mini BASELINE');
  console.log('='.repeat(100));
  
  // Table headers
  const headers = ['Model', 'Time (s)', 'Steps', 'Success', 'Assessment'];
  const colWidths = [20, 10, 8, 8, 45];
  
  // Print header
  let headerRow = '';
  headers.forEach((header, i) => {
    headerRow += header.padEnd(colWidths[i]) + ' | ';
  });
  console.log(headerRow);
  console.log('-'.repeat(100));
  
  // Print results
  results.forEach(r => {
    const row = [
      r.model,
      r.planCreationTime > 0 ? r.planCreationTime.toFixed(1) : 'N/A',
      r.stepsGenerated ? r.stepsGenerated.toString() : 'N/A',
      r.success ? '✅' : '❌',
      r.responseQuality.substring(0, 43) + (r.responseQuality.length > 43 ? '...' : '')
    ];
    
    let resultRow = '';
    row.forEach((cell, i) => {
      resultRow += cell.toString().padEnd(colWidths[i]) + ' | ';
    });
    console.log(resultRow);
  });
  
  console.log('-'.repeat(100));

  // Analysis
  const successfulModels = results.filter(r => r.success && r.stepsGenerated >= 6);
  const partialSuccessModels = results.filter(r => r.success && r.stepsGenerated >= 3 && r.stepsGenerated < 6);
  
  console.log('\n🎯 SUMMARY:');
  console.log(`✅ Models with 6+ steps: ${successfulModels.length}`);
  console.log(`⚠️  Models with 3-5 steps: ${partialSuccessModels.length}`);
  
  if (successfulModels.length > 0) {
    console.log('\n🏆 MODELS THAT BEAT phi3:mini (6+ steps):');
    successfulModels
      .sort((a, b) => a.planCreationTime - b.planCreationTime)
      .forEach(r => {
        console.log(`   🥇 ${r.model}: ${r.planCreationTime.toFixed(1)}s, ${r.stepsGenerated} steps`);
      });
  }
  
  if (partialSuccessModels.length > 0) {
    console.log('\n✅ MODELS WITH PARTIAL SUCCESS (3-5 steps):');
    partialSuccessModels
      .sort((a, b) => a.planCreationTime - b.planCreationTime)
      .forEach(r => {
        console.log(`   • ${r.model}: ${r.planCreationTime.toFixed(1)}s, ${r.stepsGenerated} steps`);
      });
  }

  // Save results
  writeFileSync(
    'available-models-results.json',
    JSON.stringify({
      testInfo: {
        timestamp: new Date().toISOString(),
        baseline: 'phi3:mini FAILED (90.8s, JSON parse error, 0 steps)',
        goal: 'Complete 6-step complex planning task'
      },
      results: results
    }, null, 2)
  );
  console.log('\n💾 Results saved to available-models-results.json');
  
  return results;
}

// Run the test
runAvailableModelTests().catch(console.error);