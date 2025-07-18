import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

interface ModelTestResult {
  model: string;
  available: boolean;
  modelSize?: string;
  planCreationTime: number;
  success: boolean;
  stepsGenerated?: number;
  responseQuality: string;
  memoryUsage?: string;
  error?: string;
}

// Models to test - including larger ones that can fit in 50GB RAM
const models = [
  'phi3:mini',           // 2.2GB - Already available
  'qwen2.5:0.5b',        // 397MB - Already available  
  'qwen2.5:1.5b',        // ~1GB - Fast and capable
  'qwen2.5:3b',          // ~2GB - Good balance
  'qwen2.5:7b',          // ~4.7GB - Already available
  'qwen2.5:14b',         // ~9GB - Already available
  'qwen3:1.7b',          // ~1.7GB - Fast
  'qwen3:4b',            // ~4GB - Good capability
  'qwen3:8b',            // ~5.2GB - Already available, good for complex tasks
  'mistral:7b',          // ~4.1GB - Already available
  'granite3-dense:2b',   // ~2GB - IBM's efficient model
  'granite3-dense:8b',   // ~8GB - Larger capability
  'gemma:2b',            // ~2GB - Google's efficient model
  'gemma2:2b',           // ~2GB - Updated version
  'phi4:3.8b'            // ~3.8GB - Latest from Microsoft
];

// The exact complex planning prompt from the system
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

async function checkModelSize(modelName: string): Promise<string> {
  try {
    const { stdout } = await exec(`ollama list | grep "^${modelName}" | awk '{print $2}'`);
    return stdout.trim() || 'Unknown';
  } catch {
    return 'Not available';
  }
}

async function testModel(modelName: string): Promise<ModelTestResult> {
  console.log(`\n=== Testing ${modelName} ===`);
  
  const result: ModelTestResult = {
    model: modelName,
    available: false,
    planCreationTime: 0,
    success: false,
    responseQuality: 'Not tested'
  };

  try {
    // Check if model is available
    console.log(`Checking availability of ${modelName}...`);
    try {
      const { stdout } = await exec(`ollama list | grep "^${modelName}"`);
      if (stdout.trim()) {
        result.available = true;
        result.modelSize = await checkModelSize(modelName);
        console.log(`✅ Model ${modelName} is available (${result.modelSize})`);
      } else {
        console.log(`❌ Model ${modelName} not found`);
        result.responseQuality = 'Model not available';
        return result;
      }
    } catch {
      console.log(`❌ Model ${modelName} not found`);
      result.responseQuality = 'Model not available';
      return result;
    }

    const llm = new OllamaProvider({
      model: modelName,
      baseUrl: 'http://localhost:11434',
    });

    // Test complex plan creation with timeout
    console.log('🔄 Testing complex plan creation...');
    const planStart = Date.now();
    
    try {
      const planResponse = await Promise.race([
        llm.generate(complexPlanningPrompt, {
          temperature: 0.3,
          maxTokens: 2000,
        }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout after 5 minutes')), 300000)
        )
      ]);
      
      result.planCreationTime = (Date.now() - planStart) / 1000;
      console.log(`⏱️  Plan creation completed in ${result.planCreationTime.toFixed(2)}s`);
      
      // Parse and validate response
      try {
        const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            result.stepsGenerated = parsed.steps.length;
            result.success = true;
            result.responseQuality = `✅ Valid JSON with ${parsed.steps.length} steps`;
            
            // Check quality of generated steps
            const hasValidStructure = parsed.steps.every(step => 
              step.id && step.description && step.agentType
            );
            
            if (hasValidStructure) {
              result.responseQuality += ' - Well structured';
            } else {
              result.responseQuality += ' - Missing required fields';
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
        result.responseQuality = '⏰ Timeout (5+ minutes)';
      } else {
        result.responseQuality = `❌ Generation failed: ${error.message}`;
      }
    }

  } catch (error) {
    console.error(`Error testing ${modelName}:`, error);
    result.error = error.message;
    result.responseQuality = `❌ Test failed: ${error.message}`;
  }

  return result;
}

async function runComplexPlanningTests() {
  console.log('🚀 Starting Complex Planning Performance Tests');
  console.log('📊 Testing with 50GB RAM available for model loading');
  console.log(`📋 Models to test: ${models.length} total`);
  console.log('⚡ Using 5-minute timeout per model\n');
  
  const results: ModelTestResult[] = [];
  
  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
    
    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate performance table
  console.log('\n' + '='.repeat(120));
  console.log('📊 COMPLEX PLANNING PERFORMANCE COMPARISON RESULTS');
  console.log('='.repeat(120));
  
  // Table headers
  const headers = [
    'Model',
    'Size',
    'Available',
    'Plan Time (s)',
    'Steps',
    'Success',
    'Quality Assessment'
  ];
  
  const colWidths = [20, 10, 10, 15, 8, 8, 35];
  
  // Print header
  let headerRow = '';
  headers.forEach((header, i) => {
    headerRow += header.padEnd(colWidths[i]) + ' | ';
  });
  console.log(headerRow);
  console.log('-'.repeat(120));
  
  // Print results
  results.forEach(r => {
    const row = [
      r.model,
      r.modelSize || 'N/A',
      r.available ? '✅' : '❌',
      r.planCreationTime > 0 ? r.planCreationTime.toFixed(1) : 'N/A',
      r.stepsGenerated ? r.stepsGenerated.toString() : 'N/A',
      r.success ? '✅' : '❌',
      r.responseQuality
    ];
    
    let resultRow = '';
    row.forEach((cell, i) => {
      resultRow += cell.toString().padEnd(colWidths[i]) + ' | ';
    });
    console.log(resultRow);
  });
  
  console.log('-'.repeat(120));

  // Summary statistics
  const availableModels = results.filter(r => r.available);
  const successfulModels = results.filter(r => r.success);
  
  console.log('\n📈 SUMMARY STATISTICS:');
  console.log(`📦 Total models tested: ${results.length}`);
  console.log(`✅ Models available: ${availableModels.length}`);
  console.log(`🎯 Successful completions: ${successfulModels.length}`);
  
  if (successfulModels.length > 0) {
    const avgTime = successfulModels.reduce((sum, r) => sum + r.planCreationTime, 0) / successfulModels.length;
    const fastest = successfulModels.reduce((prev, curr) => 
      curr.planCreationTime < prev.planCreationTime ? curr : prev
    );
    const slowest = successfulModels.reduce((prev, curr) => 
      curr.planCreationTime > prev.planCreationTime ? curr : prev
    );
    
    console.log(`⚡ Average completion time: ${avgTime.toFixed(1)}s`);
    console.log(`🏆 Fastest model: ${fastest.model} (${fastest.planCreationTime.toFixed(1)}s)`);
    console.log(`🐌 Slowest model: ${slowest.model} (${slowest.planCreationTime.toFixed(1)}s)`);
    
    // Find models with good step generation
    const goodStepGeneration = successfulModels.filter(r => r.stepsGenerated >= 3);
    if (goodStepGeneration.length > 0) {
      console.log(`\n🎯 RECOMMENDED MODELS (3+ steps generated):`);
      goodStepGeneration
        .sort((a, b) => a.planCreationTime - b.planCreationTime)
        .forEach(r => {
          console.log(`   • ${r.model}: ${r.planCreationTime.toFixed(1)}s, ${r.stepsGenerated} steps`);
        });
    }
  }

  // Save detailed results
  const detailedResults = {
    testInfo: {
      timestamp: new Date().toISOString(),
      totalModels: results.length,
      availableModels: availableModels.length,
      successfulModels: successfulModels.length,
      systemSpecs: {
        ram: '50GB',
        cpu: 'AMD Ryzen 7 PRO 7840HS',
        gpu: 'Radeon 780M (integrated)',
        npu: 'Available (PCI bus 100)'
      }
    },
    results: results
  };
  
  writeFileSync(
    'complex-planning-results.json',
    JSON.stringify(detailedResults, null, 2)
  );
  console.log('\n💾 Detailed results saved to complex-planning-results.json');
  
  return results;
}

// Run the comprehensive test
runComplexPlanningTests().catch(console.error);