// Test OllamaProvider with better prompting
import axios from 'axios';

async function testPlanGeneration() {
  console.log('Testing plan generation with qwen3:14b...\n');

  const ollamaUrl = 'http://localhost:11434';
  const model = 'qwen3:14b';

  // Test 1: Simple text generation
  console.log('1. Testing simple text generation...');
  try {
    const simpleResponse = await axios.post(`${ollamaUrl}/api/generate`, {
      model: model,
      prompt: 'Say hello in JSON format like {"greeting": "hello"}',
      stream: false
    });
    console.log('Response:', simpleResponse.data.response);
  } catch (error) {
    console.error('Simple generation failed:', error);
  }

  // Test 2: Plan generation without JSON format
  console.log('\n2. Testing plan generation (no format constraint)...');
  const planPrompt = `You are the Master Orchestrator. Create a detailed plan to address this query:
"Write a simple hello world program in Python"

Break down the task into clear, actionable steps. For each step, determine:
1. What information is needed
2. Which agent should handle it (ResearchAgent, CodeAgent, DataAnalysisAgent, WriterAgent, or ToolExecutorAgent)
3. What tools might be required
4. Expected output

Provide a structured response.`;

  try {
    const planResponse = await axios.post(`${ollamaUrl}/api/generate`, {
      model: model,
      prompt: planPrompt,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 2000
      }
    });
    console.log('Plan Response:');
    console.log(planResponse.data.response);
  } catch (error) {
    console.error('Plan generation failed:', error);
  }

  // Test 3: JSON generation with explicit example
  console.log('\n3. Testing JSON plan generation with example...');
  const jsonPrompt = `Create a plan in JSON format. Here's an example of the expected format:

{
  "steps": [
    {
      "id": "step-1",
      "description": "Understand the requirements",
      "agentType": "ResearchAgent",
      "requiresTool": false,
      "ragQuery": "Python hello world examples",
      "expectedOutput": "Understanding of hello world program requirements"
    }
  ]
}

Now create a plan for: "Write a simple hello world program in Python"

Return ONLY the JSON object.`;

  try {
    const jsonResponse = await axios.post(`${ollamaUrl}/api/generate`, {
      model: model,
      prompt: jsonPrompt,
      stream: false,
      options: {
        temperature: 0.3,
        num_predict: 2000
      }
    });
    console.log('JSON Response:');
    console.log(jsonResponse.data.response);
    
    // Try to parse
    try {
      const jsonMatch = jsonResponse.data.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('\n✅ Successfully parsed JSON!');
        console.log('Steps:', parsed.steps.length);
      }
    } catch (e) {
      console.log('\n⚠️  Could not parse JSON');
    }
  } catch (error) {
    console.error('JSON generation failed:', error);
  }
}

// Run the test
testPlanGeneration()
  .then(() => {
    console.log('\n✅ All tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });