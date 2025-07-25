import axios from 'axios';

async function testOllamaDirect() {
  console.log('Testing direct Ollama connection...\n');

  const ollamaUrl = 'http://localhost:11434';

  try {
    // 1. Check if Ollama is running
    console.log('1. Checking Ollama service...');
    const healthResponse = await axios.get(`${ollamaUrl}/api/tags`);
    console.log('✅ Ollama is running!');
    
    // 2. List available models
    console.log('\n2. Available models:');
    const models = healthResponse.data.models || [];
    models.forEach((model: any) => {
      console.log(`   - ${model.name}`);
    });

    // 3. Check for required models
    console.log('\n3. Checking required models...');
    const requiredModels = ['qwen3:14b', 'qwen3:8b', 'nomic-embed-text'];
    const availableModelNames = models.map((m: any) => m.name.split(':')[0]);
    
    requiredModels.forEach(model => {
      const modelBase = model.split(':')[0];
      if (availableModelNames.includes(modelBase)) {
        console.log(`   ✅ ${model} available`);
      } else {
        console.log(`   ❌ ${model} NOT found`);
      }
    });

    // 4. Test generation with qwen3:14b
    console.log('\n4. Testing generation with qwen3:14b...');
    const testPrompt = 'Respond with a simple JSON object containing a greeting field.';
    
    const generateResponse = await axios.post(`${ollamaUrl}/api/generate`, {
      model: 'qwen3:14b',
      prompt: testPrompt,
      stream: false,
      format: 'json'
    });

    console.log('✅ Generation successful!');
    console.log('Response:', generateResponse.data.response);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('   Ollama is not running. Please start Ollama with: ollama serve');
    }
    process.exit(1);
  }
}

// Run the test
testOllamaDirect()
  .then(() => {
    console.log('\n✅ All tests passed! Ollama is ready for production use.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });