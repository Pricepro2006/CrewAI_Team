/**
 * Test script for Ollama log probability extraction
 */

import { OllamaProvider } from './OllamaProvider';

async function testLogProbExtraction() {
  console.log('🧪 Testing Ollama Log Probability Extraction...\n');

  // Initialize provider
  const provider = new OllamaProvider({
    model: 'qwen2.5:0.5b', // Using smaller model for testing
    baseUrl: 'http://localhost:11434',
    temperature: 0.7
  });

  try {
    await provider.initialize();
    console.log('✅ Ollama initialized successfully\n');

    // Test 1: Simple generation with log probs
    console.log('Test 1: Simple text generation with log probabilities');
    const prompt1 = 'What is the capital of France? Answer in one word:';
    
    const result1 = await provider.generateWithLogProbs(prompt1, {
      maxTokens: 10,
      temperature: 0.1 // Low temperature for more deterministic output
    });

    console.log('Response:', result1.text);
    console.log('Tokens:', result1.tokens?.slice(0, 10));
    console.log('Log Probs:', result1.logProbs?.slice(0, 10));
    console.log('Metadata:', result1.metadata);
    console.log('');

    // Test 2: Test confidence variation with uncertain prompt
    console.log('Test 2: Uncertain prompt to test confidence variation');
    const prompt2 = 'What might be the weather tomorrow in an unknown location?';
    
    const result2 = await provider.generateWithLogProbs(prompt2, {
      maxTokens: 30,
      temperature: 0.8
    });

    console.log('Response:', result2.text.substring(0, 100) + '...');
    if (result2.logProbs) {
      const avgLogProb = result2.logProbs.reduce((a, b) => a + b, 0) / result2.logProbs.length;
      console.log('Average log probability:', avgLogProb);
      console.log('Min log probability:', Math.min(...result2.logProbs));
      console.log('Max log probability:', Math.max(...result2.logProbs));
    }
    console.log('');

    // Test 3: Fallback handling
    console.log('Test 3: Testing fallback when log probs not available');
    const result3 = await provider.generate(prompt1, {
      maxTokens: 10,
      extractLogProbs: false
    });
    console.log('Standard generation result:', result3);
    console.log('');

    console.log('✅ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Error during testing:', error);
    
    // Test fallback behavior
    if (error instanceof Error && error.message.includes('Ollama is not running')) {
      console.log('\n⚠️  Ollama is not running. This is expected in some environments.');
      console.log('The generateWithLogProbs method includes proper fallback handling.');
    }
  }
}

// Run test if executed directly
if (require.main === module) {
  testLogProbExtraction().catch(console.error);
}