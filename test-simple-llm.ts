import { OllamaProvider } from './src/core/llm/OllamaProvider';

async function testSimpleLLM() {
  console.log('Testing simple LLM call...');
  
  const llm = new OllamaProvider({
    model: 'qwen2.5:0.5b',
    baseUrl: 'http://localhost:11434',
  });
  
  try {
    console.time('LLM Response');
    const response = await llm.generate('Say hello in 5 words', {
      temperature: 0.7,
      maxTokens: 100,
    });
    console.timeEnd('LLM Response');
    console.log('Response:', response);
  } catch (error) {
    console.error('Error:', error);
  }
}

testSimpleLLM();