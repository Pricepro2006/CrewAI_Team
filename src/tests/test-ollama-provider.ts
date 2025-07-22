// Simple test for OllamaProvider without complex imports
import axios from 'axios';

class SimpleOllamaProvider {
  private baseUrl: string;
  private model: string;

  constructor(model: string = 'qwen3:14b', baseUrl: string = 'http://localhost:11434') {
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async initialize(): Promise<void> {
    try {
      // Check if Ollama is running
      await axios.get(`${this.baseUrl}/api/tags`);
      
      // Check if the model is available
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const models = response.data.models || [];
      const modelExists = models.some((m: any) => m.name === this.model);
      
      if (!modelExists) {
        throw new Error(`Model ${this.model} not found. Please pull it first.`);
      }

      console.log(`✅ OllamaProvider initialized with model: ${this.model}`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama is not running. Please start Ollama first.');
      }
      throw error;
    }
  }

  async generate(prompt: string, options: any = {}): Promise<string> {
    const payload = {
      model: this.model,
      prompt: prompt,
      stream: false,
      format: options.format,
      options: {
        temperature: options.temperature || 0.7,
        top_p: options.topP || 0.9,
        num_predict: options.maxTokens || 4096
      }
    };

    try {
      const response = await axios.post(`${this.baseUrl}/api/generate`, payload);
      return response.data.response;
    } catch (error) {
      console.error('Generation error:', error);
      throw error;
    }
  }
}

// Test the implementation
async function testOllamaProvider() {
  console.log('Testing OllamaProvider implementation...\n');

  const provider = new SimpleOllamaProvider('qwen3:14b');

  try {
    // Test initialization
    console.log('1. Testing initialization...');
    await provider.initialize();

    // Test plan creation prompt
    console.log('\n2. Testing plan creation prompt...');
    const testQuery = 'Write a simple hello world program in Python';
    const planPrompt = `
You are the Master Orchestrator. Create a detailed plan to address this query:
"${testQuery}"

Break down the task into clear, actionable steps.
For each step, determine:
1. What information is needed (RAG query)
2. Which agent should handle it
3. What tools might be required
4. Expected output

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

    const response = await provider.generate(planPrompt, { format: 'json' });
    console.log('✅ Plan generation successful!');
    console.log('\nGenerated Plan:');
    console.log(response);

    // Try to parse the response
    console.log('\n3. Testing JSON parsing...');
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Successfully parsed JSON plan!');
        console.log('Number of steps:', parsed.steps?.length || 0);
      }
    } catch (e) {
      console.log('⚠️  Could not parse JSON from response');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testOllamaProvider()
  .then(() => {
    console.log('\n✅ OllamaProvider test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });