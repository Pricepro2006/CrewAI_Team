import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';

interface QuickTestResult {
  model: string;
  scenario1Time: number;
  scenario2Time: number;
  scenario1Success: boolean;
  scenario2Success: boolean;
  scenario1Steps?: number;
  scenario2Steps?: number;
  consistency: 'Consistent' | 'Inconsistent' | 'Failed';
  summary: string;
}

// Focus on most promising models from previous tests
const quickTestModels = [
  'granite3.3:2b',      // Previous winner
  'qwen3:1.7b',         // Fast performer
  'qwen2.5:0.5b'        // Fastest but basic
];

// Simplified prompts for faster testing
const simplePrompt1 = `Create a JSON plan with 3-6 steps to explain TypeScript basics:
{
  "steps": [
    {"id": "step-1", "description": "...", "agentType": "WriterAgent"},
    {"id": "step-2", "description": "...", "agentType": "ResearchAgent"}
  ]
}`;

const simplePrompt2 = `Create a JSON plan with 3-6 steps for building an e-commerce platform:
{
  "steps": [
    {"id": "step-1", "description": "...", "agentType": "CodeAgent"},
    {"id": "step-2", "description": "...", "agentType": "DataAnalysisAgent"}
  ]
}`;

async function quickTestScenario(modelName: string, prompt: string, scenarioName: string): Promise<{time: number, success: boolean, steps?: number}> {
  console.log(`   🎯 ${scenarioName}...`);
  
  const llm = new OllamaProvider({
    model: modelName,
    baseUrl: 'http://localhost:11434',
  });

  const startTime = Date.now();
  
  try {
    const response = await Promise.race([
      llm.generate(prompt, {
        temperature: 0.3,
        maxTokens: 1000,  // Reduced for speed
      }),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 60000)  // 1 minute timeout
      )
    ]);
    
    const time = (Date.now() - startTime) / 1000;
    
    // Quick JSON validation
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.steps && Array.isArray(parsed.steps)) {
          console.log(`   ✅ ${scenarioName}: ${time.toFixed(1)}s, ${parsed.steps.length} steps`);
          return { time, success: true, steps: parsed.steps.length };
        }
      } catch {}
    }
    
    console.log(`   ❌ ${scenarioName}: ${time.toFixed(1)}s, invalid JSON`);
    return { time, success: false };
    
  } catch (error: any) {
    const time = (Date.now() - startTime) / 1000;
    console.log(`   ❌ ${scenarioName}: ${time.toFixed(1)}s, ${error.message}`);
    return { time, success: false };
  }
}

async function quickTestModel(modelName: string): Promise<QuickTestResult> {
  console.log(`\n=== Quick Testing ${modelName} ===`);
  
  const result: QuickTestResult = {
    model: modelName,
    scenario1Time: 0,
    scenario2Time: 0,
    scenario1Success: false,
    scenario2Success: false,
    consistency: 'Failed',
    summary: 'Not tested'
  };

  try {
    // Test Scenario 1: TypeScript
    const scenario1 = await quickTestScenario(modelName, simplePrompt1, 'TypeScript');
    result.scenario1Time = scenario1.time;
    result.scenario1Success = scenario1.success;
    result.scenario1Steps = scenario1.steps;

    // Test Scenario 2: E-commerce  
    const scenario2 = await quickTestScenario(modelName, simplePrompt2, 'E-commerce');
    result.scenario2Time = scenario2.time;
    result.scenario2Success = scenario2.success;
    result.scenario2Steps = scenario2.steps;

    // Analyze consistency
    if (result.scenario1Success && result.scenario2Success) {
      result.consistency = 'Consistent';
      const avgTime = ((result.scenario1Time + result.scenario2Time) / 2).toFixed(1);
      result.summary = `🎯 SUCCESS: Both scenarios work, avg ${avgTime}s`;
    } else if (result.scenario1Success || result.scenario2Success) {
      result.consistency = 'Inconsistent';
      const working = result.scenario1Success ? 'TypeScript' : 'E-commerce';
      result.summary = `⚠️  PARTIAL: Only ${working} works`;
    } else {
      result.consistency = 'Failed';
      result.summary = `❌ FAILED: Both scenarios failed`;
    }

  } catch (error: any) {
    result.summary = `❌ Error: ${error.message}`;
  }

  return result;
}

async function runQuickConsistencyTest() {
  console.log('⚡ QUICK MODEL CONSISTENCY TEST');
  console.log('🎯 Testing top models with simplified prompts for speed');
  console.log('📊 Two scenarios: TypeScript explanation vs E-commerce planning\n');
  
  const results: QuickTestResult[] = [];
  
  for (const model of quickTestModels) {
    const result = await quickTestModel(model);
    results.push(result);
  }

  // Quick results table
  console.log('\n' + '='.repeat(90));
  console.log('⚡ QUICK CONSISTENCY TEST RESULTS');
  console.log('='.repeat(90));
  
  console.log('Model'.padEnd(15) + ' | S1 Time | S1 Steps | S2 Time | S2 Steps | Status    | Summary');
  console.log('-'.repeat(90));
  
  results.forEach(r => {
    const row = [
      r.model.padEnd(14),
      r.scenario1Time > 0 ? `${r.scenario1Time.toFixed(1)}s`.padEnd(7) : 'N/A'.padEnd(7),
      r.scenario1Steps ? r.scenario1Steps.toString().padEnd(8) : 'N/A'.padEnd(8),
      r.scenario2Time > 0 ? `${r.scenario2Time.toFixed(1)}s`.padEnd(7) : 'N/A'.padEnd(7),
      r.scenario2Steps ? r.scenario2Steps.toString().padEnd(8) : 'N/A'.padEnd(8),
      r.consistency.padEnd(9),
      r.summary.substring(0, 25)
    ].join(' | ');
    
    console.log(row);
  });
  
  console.log('-'.repeat(90));

  // Quick analysis
  const consistentModels = results.filter(r => r.consistency === 'Consistent');
  
  console.log('\n⚡ QUICK ANALYSIS:');
  if (consistentModels.length > 0) {
    console.log('🏆 CONSISTENT MODELS:');
    consistentModels
      .sort((a, b) => (a.scenario1Time + a.scenario2Time) - (b.scenario1Time + b.scenario2Time))
      .forEach(r => {
        const avgTime = ((r.scenario1Time + r.scenario2Time) / 2).toFixed(1);
        console.log(`   🥇 ${r.model}: ${avgTime}s average (${r.scenario1Steps}-${r.scenario2Steps} steps)`);
      });
  } else {
    console.log('❌ No models showed consistent performance across both scenarios');
  }

  // Validate granite3.3:2b specifically
  const graniteResult = results.find(r => r.model === 'granite3.3:2b');
  if (graniteResult && graniteResult.consistency === 'Consistent') {
    console.log('\n✅ CONFIRMED: granite3.3:2b maintains consistency in quick test');
  } else if (graniteResult) {
    console.log(`\n⚠️  WARNING: granite3.3:2b shows ${graniteResult.consistency.toLowerCase()} behavior`);
  }

  // Save results
  writeFileSync(
    'quick-consistency-results.json',
    JSON.stringify({
      testInfo: {
        timestamp: new Date().toISOString(),
        testType: 'Quick Consistency Validation',
        modelstested: quickTestModels,
        simplifiedPrompts: true
      },
      results
    }, null, 2)
  );
  
  console.log('\n💾 Results saved to quick-consistency-results.json');
  return results;
}

// Run quick test
runQuickConsistencyTest().catch(console.error);