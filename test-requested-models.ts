import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

interface ModelTestResult {
  model: string;
  available: boolean;
  modelSize?: string;
  queryAnalysisTime: number;
  planCreationTime: number;
  totalTime: number;
  success: boolean;
  stepsGenerated?: number;
  responseQuality: string;
  error?: string;
  comparison: 'Better' | 'Worse' | 'Similar' | 'Failed';
}

// Exact models requested by user
const requestedModels = [
  'mistral-small3.2:24b',
  'gemma3n:e2b', 
  'gemma3n:e4b',
  'phi4-mini-reasoning:3.8b',
  'qwen3:1.7b',
  'qwen3:4b', 
  'granite3.3:8b',
  'granite3.3:2b',
  'phi3:mini'  // Baseline for comparison
];

// The actual complex planning prompt that generates 6 steps
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

async function checkModelAvailability(modelName: string): Promise<boolean> {
  try {
    const { stdout } = await exec(`ollama list | grep "^${modelName}"`);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function pullModel(modelName: string): Promise<boolean> {
  try {
    console.log(`   📥 Pulling ${modelName}...`);
    await exec(`ollama pull ${modelName}`, { timeout: 600000 }); // 10 minute timeout for pulls
    return true;
  } catch (error) {
    console.log(`   ❌ Failed to pull ${modelName}: ${error.message}`);
    return false;
  }
}

async function testModel(modelName: string): Promise<ModelTestResult> {
  console.log(`\n=== Testing ${modelName} ===`);
  
  const result: ModelTestResult = {
    model: modelName,
    available: false,
    queryAnalysisTime: 0,
    planCreationTime: 0,
    totalTime: 0,
    success: false,
    responseQuality: 'Not tested',
    comparison: 'Failed'
  };

  try {
    // Check availability and pull if needed
    console.log(`   🔍 Checking availability...`);
    let available = await checkModelAvailability(modelName);
    
    if (!available) {
      console.log(`   ⬇️  Model not found, attempting to pull...`);
      available = await pullModel(modelName);
    }
    
    if (!available) {
      result.responseQuality = 'Model unavailable/failed to pull';
      return result;
    }
    
    result.available = true;
    console.log(`   ✅ Model ${modelName} is ready`);

    const llm = new OllamaProvider({
      model: modelName,
      baseUrl: 'http://localhost:11434',
    });

    const testStartTime = Date.now();

    // Test 1: Query Analysis (like phi3:mini baseline: 7.8s)
    console.log('   🔄 Testing query analysis...');
    const queryStart = Date.now();
    
    const queryAnalysisPrompt = `Analyze this query and return JSON with intent, complexity, and domains: "Hello, can you help me understand TypeScript?"
Return only valid JSON like: {"intent": "explain", "complexity": 1, "domains": ["development"]}`;

    try {
      await llm.generate(queryAnalysisPrompt, {
        temperature: 0.3,
        maxTokens: 200,
      });
      result.queryAnalysisTime = (Date.now() - queryStart) / 1000;
      console.log(`   ⏱️  Query analysis: ${result.queryAnalysisTime.toFixed(1)}s`);
    } catch (error) {
      console.log(`   ❌ Query analysis failed: ${error.message}`);
      result.queryAnalysisTime = -1;
    }

    // Test 2: Complex Plan Creation (baseline: 91.4s for 6 steps)
    console.log('   🎯 Testing complex 6-step plan creation...');
    const planStart = Date.now();
    
    try {
      const planResponse = await Promise.race([
        llm.generate(complexPlanningPrompt, {
          temperature: 0.3,
          maxTokens: 3000, // Increased for complex plans
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
            
            // Compare to phi3:mini baseline (FAILED - 90.8s, JSON parse error, 0 steps)
            if (result.stepsGenerated >= 6) {
              result.comparison = 'Better';
              result.responseQuality = `🎯 SUCCESS: ${result.stepsGenerated} steps in ${result.planCreationTime.toFixed(1)}s (phi3:mini FAILED)`;
            } else if (result.stepsGenerated >= 3) {
              result.comparison = 'Better';
              result.responseQuality = `✅ PARTIAL SUCCESS: ${result.stepsGenerated} steps in ${result.planCreationTime.toFixed(1)}s (phi3:mini FAILED)`;
            } else if (result.stepsGenerated >= 1) {
              result.comparison = 'Similar';
              result.responseQuality = `⚠️  MINIMAL: ${result.stepsGenerated} step(s) but at least works (phi3:mini FAILED)`;
            } else {
              result.comparison = 'Worse';
              result.responseQuality = `❌ FAILED: No valid steps generated`;
            }
          } else {
            result.responseQuality = '❌ Invalid JSON structure (missing steps array)';
          }
        } else {
          result.responseQuality = '❌ No JSON found in response';
        }
      } catch (parseError) {
        result.responseQuality = `❌ JSON parse error: ${parseError.message}`;
      }
    } catch (error) {
      result.planCreationTime = (Date.now() - planStart) / 1000;
      result.error = error.message;
      
      if (error.message.includes('Timeout')) {
        result.responseQuality = '⏰ TIMEOUT (5+ minutes) - Failed to complete';
      } else {
        result.responseQuality = `❌ Generation failed: ${error.message}`;
      }
    }

    result.totalTime = (Date.now() - testStartTime) / 1000;

  } catch (error) {
    console.error(`   💥 Error testing ${modelName}:`, error);
    result.error = error.message;
    result.responseQuality = `❌ Test failed: ${error.message}`;
  }

  return result;
}

async function runRequestedModelTests() {
  console.log('🎯 TESTING REQUESTED MODELS AGAINST COMPLEX 6-STEP PLANNING');
  console.log('📊 Baseline: phi3:mini FAILED (90.8s, JSON parse error, 0 steps completed)');
  console.log('🎯 Goal: Find models that can successfully generate 6+ steps (phi3:mini failed)');
  console.log(`📋 Testing ${requestedModels.length} specific models\n`);
  
  const results: ModelTestResult[] = [];
  
  for (const model of requestedModels) {
    const result = await testModel(model);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Generate comparison table
  console.log('\n' + '='.repeat(140));
  console.log('🏆 REQUESTED MODELS PERFORMANCE COMPARISON vs phi3:mini BASELINE');
  console.log('='.repeat(140));
  
  // Table headers
  const headers = [
    'Model',
    'Available',
    'Query (s)',
    'Plan (s)', 
    'Total (s)',
    'Steps',
    'vs Baseline',
    'Assessment'
  ];
  
  const colWidths = [25, 10, 10, 10, 10, 6, 12, 40];
  
  // Print header
  let headerRow = '';
  headers.forEach((header, i) => {
    headerRow += header.padEnd(colWidths[i]) + ' | ';
  });
  console.log(headerRow);
  console.log('-'.repeat(140));
  
  // Print results
  results.forEach(r => {
    const row = [
      r.model,
      r.available ? '✅' : '❌',
      r.queryAnalysisTime > 0 ? r.queryAnalysisTime.toFixed(1) : 'N/A',
      r.planCreationTime > 0 ? r.planCreationTime.toFixed(1) : 'N/A',
      r.totalTime > 0 ? r.totalTime.toFixed(1) : 'N/A',
      r.stepsGenerated ? r.stepsGenerated.toString() : 'N/A',
      r.comparison,
      r.responseQuality.substring(0, 38) + (r.responseQuality.length > 38 ? '...' : '')
    ];
    
    let resultRow = '';
    row.forEach((cell, i) => {
      resultRow += cell.toString().padEnd(colWidths[i]) + ' | ';
    });
    console.log(resultRow);
  });
  
  console.log('-'.repeat(140));

  // Analysis summary
  const availableModels = results.filter(r => r.available);
  const successfulModels = results.filter(r => r.success && r.stepsGenerated >= 6);
  const betterModels = results.filter(r => r.comparison === 'Better');
  
  console.log('\n🎯 SUMMARY ANALYSIS:');
  console.log(`📦 Requested models: ${requestedModels.length}`);
  console.log(`✅ Available for testing: ${availableModels.length}`);
  console.log(`🎯 Successful 6+ step plans: ${successfulModels.length}`);
  console.log(`🏆 Better than phi3:mini: ${betterModels.length}`);
  
  if (betterModels.length > 0) {
    console.log('\n🏆 MODELS BETTER THAN phi3:mini:');
    betterModels.forEach(r => {
      const speedup = ((91.4 - r.planCreationTime) / 91.4 * 100).toFixed(1);
      console.log(`   🥇 ${r.model}: ${r.planCreationTime.toFixed(1)}s (${speedup}% faster), ${r.stepsGenerated} steps`);
    });
  }
  
  if (successfulModels.length > 0) {
    console.log('\n✅ ALL MODELS WITH 6+ STEPS:');
    successfulModels
      .sort((a, b) => a.planCreationTime - b.planCreationTime)
      .forEach(r => {
        console.log(`   • ${r.model}: ${r.planCreationTime.toFixed(1)}s, ${r.stepsGenerated} steps`);
      });
  }

  // Save detailed results
  const detailedResults = {
    testInfo: {
      timestamp: new Date().toISOString(),
      baseline: 'phi3:mini (7.8s query + 91.4s plan = 6 steps)',
      goal: 'Find models generating 6+ steps faster than 91.4s',
      requestedModels: requestedModels,
      systemSpecs: {
        ram: '50GB',
        cpu: 'AMD Ryzen 7 PRO 7840HS',
        gpu: 'Radeon 780M + NPU'
      }
    },
    results: results
  };
  
  writeFileSync(
    'requested-models-comparison.json',
    JSON.stringify(detailedResults, null, 2)
  );
  console.log('\n💾 Detailed results saved to requested-models-comparison.json');
  
  return results;
}

// Run the test
runRequestedModelTests().catch(console.error);