import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

interface ModelTestResult {
  model: string;
  available: boolean;
  scenario1Time: number;
  scenario2Time: number;
  scenario1Success: boolean;
  scenario2Success: boolean;
  scenario1Steps?: number;
  scenario2Steps?: number;
  consistency: 'Consistent' | 'Inconsistent' | 'Failed';
  overallQuality: string;
  error?: string;
}

// Available models based on previous testing results
const testModels = [
  'phi3:mini',           // Baseline (FAILED previously)
  'gemma3n:e2b',        // 5.6GB - Your requested model
  'gemma3n:e4b',        // 7.5GB - Your requested model  
  'granite3.3:8b',      // 4.9GB - Your requested model
  'granite3.3:2b',      // 1.5GB - Your requested model (WINNER from previous test)
  'qwen3:1.7b',         // 1.4GB - Your requested model
  'qwen3:4b'            // 2.6GB - Your requested model
];

// Test Scenario 1: TypeScript explanation (original prompt that broke phi3:mini)
const scenario1Prompt = `
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

// Test Scenario 2: E-commerce project planning (new complex scenario)
const scenario2Prompt = `
You are the Master Orchestrator. Create a detailed plan to address this query:
"I need to build a complete e-commerce platform with user authentication, product catalog, shopping cart, payment processing, and admin dashboard. Can you help me plan this project?"

Query Analysis Context:
- Intent: plan_project
- Complexity: 8/10
- Required domains: development, architecture, database, security, payments
- Priority: high
- Estimated duration: 240 seconds
- Resource requirements: {"memory": "high", "computation": "high", "network": true}
- Detected entities: {"topics": ["e-commerce", "authentication", "payments", "database"], "intent": "plan_project"}

Agent Routing Plan:
- Selected agents: CodeAgent (priority: 1, confidence: 0.95), ResearchAgent (priority: 2, confidence: 0.9), DataAnalysisAgent (priority: 3, confidence: 0.85)
- Execution strategy: parallel_then_sequential
- Overall confidence: 0.9
- Risk level: medium
- Risk factors: complex architecture, security requirements, payment integration
- Fallback agents available: ToolExecutorAgent, WriterAgent

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
  } catch (error: any) {
    console.log(`   ❌ Failed to pull ${modelName}: ${error.message}`);
    return false;
  }
}

async function testScenario(modelName: string, prompt: string, scenarioName: string): Promise<{time: number, success: boolean, steps?: number, error?: string}> {
  console.log(`   🎯 Testing ${scenarioName}...`);
  
  const llm = new OllamaProvider({
    model: modelName,
    baseUrl: 'http://localhost:11434',
  });

  const startTime = Date.now();
  
  try {
    const response = await Promise.race([
      llm.generate(prompt, {
        temperature: 0.3,
        maxTokens: 3000,
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout after 5 minutes')), 300000)
      )
    ]);
    
    const time = (Date.now() - startTime) / 1000;
    console.log(`   ⏱️  ${scenarioName}: ${time.toFixed(1)}s`);
    
    // Parse and validate response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.steps && Array.isArray(parsed.steps)) {
          return {
            time,
            success: true,
            steps: parsed.steps.length
          };
        } else {
          return {
            time,
            success: false,
            error: 'Invalid JSON structure (missing steps array)'
          };
        }
      } else {
        return {
          time,
          success: false,
          error: 'No JSON found in response'
        };
      }
    } catch (parseError: any) {
      return {
        time,
        success: false,
        error: `JSON parse error: ${parseError.message}`
      };
    }
  } catch (error: any) {
    const time = (Date.now() - startTime) / 1000;
    
    if (error.message.includes('Timeout')) {
      return {
        time,
        success: false,
        error: 'TIMEOUT (5+ minutes)'
      };
    } else {
      return {
        time,
        success: false,
        error: `Generation failed: ${error.message}`
      };
    }
  }
}

async function testModel(modelName: string): Promise<ModelTestResult> {
  console.log(`\n=== Testing ${modelName} ===`);
  
  const result: ModelTestResult = {
    model: modelName,
    available: false,
    scenario1Time: 0,
    scenario2Time: 0,
    scenario1Success: false,
    scenario2Success: false,
    consistency: 'Failed',
    overallQuality: 'Not tested'
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
      result.overallQuality = 'Model unavailable/failed to pull';
      return result;
    }
    
    result.available = true;
    console.log(`   ✅ Model ${modelName} is ready`);

    // Test Scenario 1: TypeScript explanation
    const scenario1Result = await testScenario(modelName, scenario1Prompt, 'Scenario 1 (TypeScript)');
    result.scenario1Time = scenario1Result.time;
    result.scenario1Success = scenario1Result.success;
    result.scenario1Steps = scenario1Result.steps;

    // Brief pause between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test Scenario 2: E-commerce planning
    const scenario2Result = await testScenario(modelName, scenario2Prompt, 'Scenario 2 (E-commerce)');
    result.scenario2Time = scenario2Result.time;
    result.scenario2Success = scenario2Result.success;
    result.scenario2Steps = scenario2Result.steps;

    // Analyze consistency
    if (result.scenario1Success && result.scenario2Success) {
      // Both succeeded - check if step counts are reasonable
      const stepDiff = Math.abs((result.scenario1Steps || 0) - (result.scenario2Steps || 0));
      if (stepDiff <= 3) {
        result.consistency = 'Consistent';
        result.overallQuality = `🎯 EXCELLENT: Both scenarios successful (${result.scenario1Steps} vs ${result.scenario2Steps} steps)`;
      } else {
        result.consistency = 'Inconsistent';
        result.overallQuality = `⚠️  INCONSISTENT: Both work but very different step counts (${result.scenario1Steps} vs ${result.scenario2Steps})`;
      }
    } else if (result.scenario1Success || result.scenario2Success) {
      result.consistency = 'Inconsistent';
      const workingScenario = result.scenario1Success ? 'TypeScript' : 'E-commerce';
      const failingScenario = result.scenario1Success ? 'E-commerce' : 'TypeScript';
      result.overallQuality = `⚠️  PARTIAL: ${workingScenario} works, ${failingScenario} fails`;
    } else {
      result.consistency = 'Failed';
      result.overallQuality = `❌ FAILED: Both scenarios failed`;
      result.error = `S1: ${scenario1Result.error || 'Unknown'}, S2: ${scenario2Result.error || 'Unknown'}`;
    }

  } catch (error: any) {
    console.error(`   💥 Error testing ${modelName}:`, error);
    result.error = error.message;
    result.overallQuality = `❌ Test failed: ${error.message}`;
  }

  return result;
}

async function runComprehensiveTests() {
  console.log('🎯 COMPREHENSIVE MODEL TESTING WITH TWO SCENARIOS');
  console.log('📊 Scenario 1: TypeScript explanation (simple, previous baseline)');
  console.log('📊 Scenario 2: E-commerce platform planning (complex, new test)');
  console.log('🎯 Goal: Find models that work consistently across different prompt types');
  console.log(`📋 Testing ${testModels.length} models\n`);
  
  const results: ModelTestResult[] = [];
  
  for (const model of testModels) {
    const result = await testModel(model);
    results.push(result);
    
    // Brief pause between model tests
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Generate comprehensive comparison table
  console.log('\n' + '='.repeat(150));
  console.log('🏆 COMPREHENSIVE MODEL COMPARISON - TWO SCENARIOS');
  console.log('='.repeat(150));
  
  // Table headers
  const headers = [
    'Model',
    'Available',
    'S1 Time (s)',
    'S1 Steps', 
    'S2 Time (s)',
    'S2 Steps',
    'Consistency',
    'Overall Assessment'
  ];
  
  const colWidths = [20, 10, 12, 10, 12, 10, 12, 50];
  
  // Print header
  let headerRow = '';
  headers.forEach((header, i) => {
    headerRow += header.padEnd(colWidths[i]) + ' | ';
  });
  console.log(headerRow);
  console.log('-'.repeat(150));
  
  // Print results
  results.forEach(r => {
    const row = [
      r.model,
      r.available ? '✅' : '❌',
      r.scenario1Time > 0 ? r.scenario1Time.toFixed(1) : 'N/A',
      r.scenario1Steps ? r.scenario1Steps.toString() : 'N/A',
      r.scenario2Time > 0 ? r.scenario2Time.toFixed(1) : 'N/A',
      r.scenario2Steps ? r.scenario2Steps.toString() : 'N/A',
      r.consistency,
      r.overallQuality.substring(0, 48) + (r.overallQuality.length > 48 ? '...' : '')
    ];
    
    let resultRow = '';
    row.forEach((cell, i) => {
      resultRow += cell.toString().padEnd(colWidths[i]) + ' | ';
    });
    console.log(resultRow);
  });
  
  console.log('-'.repeat(150));

  // Analysis summary
  const availableModels = results.filter(r => r.available);
  const consistentModels = results.filter(r => r.consistency === 'Consistent');
  const partialModels = results.filter(r => r.consistency === 'Inconsistent');
  const failedModels = results.filter(r => r.consistency === 'Failed');
  
  console.log('\n🎯 COMPREHENSIVE ANALYSIS:');
  console.log(`📦 Total models tested: ${testModels.length}`);
  console.log(`✅ Available for testing: ${availableModels.length}`);
  console.log(`🎯 Consistent across scenarios: ${consistentModels.length}`);
  console.log(`⚠️  Inconsistent performance: ${partialModels.length}`);
  console.log(`❌ Failed both scenarios: ${failedModels.length}`);
  
  if (consistentModels.length > 0) {
    console.log('\n🏆 CONSISTENTLY RELIABLE MODELS:');
    consistentModels
      .sort((a, b) => (a.scenario1Time + a.scenario2Time) - (b.scenario1Time + b.scenario2Time))
      .forEach(r => {
        const avgTime = ((r.scenario1Time + r.scenario2Time) / 2).toFixed(1);
        console.log(`   🥇 ${r.model}: Avg ${avgTime}s (S1: ${r.scenario1Steps} steps, S2: ${r.scenario2Steps} steps)`);
      });
  }
  
  if (partialModels.length > 0) {
    console.log('\n⚠️  MODELS WITH PARTIAL SUCCESS:');
    partialModels.forEach(r => {
      const s1Status = r.scenario1Success ? `✅ ${r.scenario1Steps}` : '❌';
      const s2Status = r.scenario2Success ? `✅ ${r.scenario2Steps}` : '❌';
      console.log(`   • ${r.model}: S1 ${s1Status}, S2 ${s2Status}`);
    });
  }

  if (failedModels.length > 0) {
    console.log('\n❌ MODELS THAT FAILED BOTH SCENARIOS:');
    failedModels.forEach(r => {
      console.log(`   • ${r.model}: ${r.overallQuality}`);
    });
  }

  // Specific comparison to previous winner (granite3.3:2b)
  const graniteResult = results.find(r => r.model === 'granite3.3:2b');
  if (graniteResult) {
    console.log('\n🏆 PREVIOUS WINNER VALIDATION (granite3.3:2b):');
    console.log(`   Status: ${graniteResult.consistency}`);
    console.log(`   Performance: ${graniteResult.overallQuality}`);
    if (graniteResult.consistency === 'Consistent') {
      console.log('   ✅ CONFIRMED: granite3.3:2b maintains consistency across scenarios');
    } else {
      console.log('   ⚠️  WARNING: granite3.3:2b shows inconsistent behavior');
    }
  }

  // Save detailed results
  const detailedResults = {
    testInfo: {
      timestamp: new Date().toISOString(),
      testType: 'Comprehensive Two-Scenario Validation',
      scenario1: 'TypeScript explanation (simple)',
      scenario2: 'E-commerce platform planning (complex)',
      goal: 'Find models with consistent performance across different prompt types',
      systemSpecs: {
        ram: '50GB',
        cpu: 'AMD Ryzen 7 PRO 7840HS',
        gpu: 'Radeon 780M + NPU'
      }
    },
    results: results
  };
  
  writeFileSync(
    'comprehensive-consistency-test-results.json',
    JSON.stringify(detailedResults, null, 2)
  );
  console.log('\n💾 Detailed results saved to comprehensive-consistency-test-results.json');
  
  return results;
}

// Run the comprehensive test
runComprehensiveTests().catch(console.error);