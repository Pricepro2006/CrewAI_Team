import { OllamaProvider } from './src/core/llm/OllamaProvider';
import { writeFileSync } from 'fs';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execCallback);

interface ModelTestResult {
  model: string;
  success: boolean;
  queryAnalysisTime: number;
  planCreationTime: number;
  totalTime: number;
  error?: string;
  responseQuality?: string;
}

// Models requested by user for testing
const models = [
  'qwen3:0.6b',
  'gemma3n:e2b',
  'gemma3n:e4b',
  'phi4-mini-reasoning:3.8b',
  'qwen3:1.7b',
  'qwen3:4b',
  'granite3.3:8b',
  'granite3.3:2b'
];

// Complex microservices architecture query for testing
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

// Complex planning prompt similar to what the system uses
const complexPlanningPrompt = `
Create a step-by-step plan to address this query: "${COMPLEX_QUERY}"

Query Analysis Context:
- Intent: analyze and recommend
- Complexity: 9/10
- Required domains: software architecture, distributed systems, security
- Priority: high
- Estimated duration: 180 seconds

Agent Routing Plan:
- Selected agents: ResearchAgent (priority: 1, confidence: 0.9), CodeAgent (priority: 2, confidence: 0.8), WriterAgent (priority: 3, confidence: 0.9)
- Execution strategy: sequential with parallel research
- Overall confidence: 0.85
- Risk level: medium

For each step, determine:
1. What information is needed (RAG query)
2. Which agent should handle it
3. What tools might be required
4. Expected output

Agent Selection Guidelines:
- ResearchAgent: For research, web search, information gathering
- CodeAgent: For programming, debugging, code analysis
- DataAnalysisAgent: For data processing, analysis, metrics
- WriterAgent: For documentation, explanations, summaries
- ToolExecutorAgent: For tool coordination and complex workflows

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
    success: false,
    queryAnalysisTime: 0,
    planCreationTime: 0,
    totalTime: 0
  };

  try {
    // First, check if model exists
    console.log(`Checking if ${modelName} is available...`);
    const checkStart = Date.now();
    
    // Check if model is already available
    try {
      const { stdout } = await exec(`ollama list | grep "^${modelName}"`);
      console.log(`Model ${modelName} is already available`);
    } catch {
      console.log(`Model ${modelName} not found, skipping (to avoid large downloads)...`);
      result.error = 'Model not available';
      return result;
    }

    const llm = new OllamaProvider({
      model: modelName,
      baseUrl: 'http://localhost:11434',
    });

    // Test 1: Query Analysis (simpler prompt)
    console.log('Testing query analysis...');
    const queryStart = Date.now();
    
    const queryAnalysisPrompt = `Analyze this query and return JSON with intent, complexity, and domains: "${COMPLEX_QUERY}"
Return only valid JSON like: {"intent": "analyze", "complexity": 9, "domains": ["architecture", "distributed-systems", "security"]}`;

    try {
      const queryResponse = await llm.generate(queryAnalysisPrompt, {
        temperature: 0.3,
        maxTokens: 200,
      });
      result.queryAnalysisTime = (Date.now() - queryStart) / 1000;
      console.log(`Query analysis completed in ${result.queryAnalysisTime.toFixed(2)}s`);
    } catch (error) {
      console.log('Query analysis failed:', error);
      result.queryAnalysisTime = -1;
    }

    // Test 2: Complex Plan Creation
    console.log('Testing complex plan creation...');
    const planStart = Date.now();
    
    try {
      const planResponse = await llm.generate(complexPlanningPrompt, {
        temperature: 0.3,
        maxTokens: 2000,
      });
      result.planCreationTime = (Date.now() - planStart) / 1000;
      console.log(`Plan creation completed in ${result.planCreationTime.toFixed(2)}s`);
      
      // Try to parse the response to check quality
      try {
        const jsonMatch = planResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            result.responseQuality = `Valid JSON with ${parsed.steps.length} steps`;
            result.success = true;
          }
        }
      } catch {
        result.responseQuality = 'Invalid JSON response';
      }
    } catch (error) {
      console.log('Plan creation failed:', error);
      result.planCreationTime = -1;
      result.error = error.message;
    }

    result.totalTime = (Date.now() - checkStart) / 1000;

  } catch (error) {
    console.error(`Error testing ${modelName}:`, error);
    result.error = error.message;
  }

  return result;
}

async function runAllTests() {
  console.log('Starting comprehensive model performance tests...');
  console.log('Models to test:', models.join(', '));
  
  const results: ModelTestResult[] = [];
  
  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
    
    // Wait a bit between tests to let the system cool down
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Display results in a table
  console.log('\n\n=== PERFORMANCE COMPARISON RESULTS ===\n');
  console.log('Model                | Query Analysis | Plan Creation | Total Time | Success | Quality');
  console.log('---------------------|----------------|---------------|------------|---------|--------');
  
  results.forEach(r => {
    const qa = r.queryAnalysisTime === -1 ? 'FAILED' : `${r.queryAnalysisTime.toFixed(2)}s`;
    const pc = r.planCreationTime === -1 ? 'FAILED' : `${r.planCreationTime.toFixed(2)}s`;
    const total = `${r.totalTime.toFixed(2)}s`;
    const success = r.success ? 'YES' : 'NO';
    const quality = r.responseQuality || r.error || 'N/A';
    
    console.log(
      `${r.model.padEnd(20)} | ${qa.padEnd(14)} | ${pc.padEnd(13)} | ${total.padEnd(10)} | ${success.padEnd(7)} | ${quality}`
    );
  });

  // Save results to file
  writeFileSync(
    'model-performance-results.json',
    JSON.stringify(results, null, 2)
  );
  console.log('\nResults saved to model-performance-results.json');

  // Find the best model
  const successfulModels = results.filter(r => r.success);
  if (successfulModels.length > 0) {
    const fastest = successfulModels.reduce((prev, current) => 
      (current.planCreationTime < prev.planCreationTime) ? current : prev
    );
    console.log(`\nBest performing model: ${fastest.model} (${fastest.planCreationTime.toFixed(2)}s for plan creation)`);
  } else {
    console.log('\nNo models successfully completed the complex planning task!');
  }

  // Show recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  console.log('Based on your CPU performance with integrated 780M GPU:');
  console.log('1. phi3:mini - Currently the best balance (4.3 min total)');
  console.log('2. Consider smaller models like qwen2.5:0.5b for faster response but limited capability');
  console.log('3. Enable GPU acceleration if possible - check `ollama serve` logs');
  console.log('4. Use SimplePlanGenerator for production to bypass complex planning');
}

// Check if Ollama is running with GPU support
async function checkGPUSupport() {
  try {
    const { stdout } = await exec('nvidia-smi');
    console.log('NVIDIA GPU detected! Ollama should use GPU acceleration.');
    console.log(stdout);
  } catch {
    console.log('No NVIDIA GPU detected. Checking for integrated GPU...');
    try {
      const { stdout } = await exec('lspci | grep -i vga');
      console.log('Graphics hardware:', stdout);
      
      // Check if Ollama is using GPU
      console.log('\nChecking Ollama GPU usage...');
      try {
        const { stdout: ollamaInfo } = await exec('ps aux | grep ollama');
        console.log('Ollama process info:', ollamaInfo);
      } catch {}
    } catch {
      console.log('Could not detect GPU information');
    }
  }
}

// Run the tests
checkGPUSupport().then(() => runAllTests());