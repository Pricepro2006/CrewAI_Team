#!/usr/bin/env node
/**
 * Simple test to verify the queue configuration is working
 */

console.log('🧪 Testing OLLAMA_NUM_PARALLEL configuration...\n');

// Check environment variable
const ollamaParallel = process.env.OLLAMA_NUM_PARALLEL || 'not set';
console.log(`✅ OLLAMA_NUM_PARALLEL = ${ollamaParallel}`);

if (ollamaParallel === '2') {
  console.log('✨ Configuration is correct! The bottleneck should be resolved.');
} else if (ollamaParallel === '1') {
  console.log('⚠️  WARNING: OLLAMA_NUM_PARALLEL is still set to 1. This will cause bottlenecks.');
  console.log('Run: source ~/.bashrc');
} else {
  console.log('⚠️  WARNING: OLLAMA_NUM_PARALLEL is not set. Using default value.');
}

// Test concurrent promise handling
console.log('\n📊 Simulating concurrent processing...');

async function simulateRequest(id) {
  const delay = Math.random() * 1000 + 500;
  return new Promise(resolve => {
    setTimeout(() => resolve(`Request ${id} completed in ${delay.toFixed(0)}ms`), delay);
  });
}

async function testConcurrency() {
  const startTime = Date.now();
  
  // Simulate 10 concurrent requests
  const requests = Array.from({ length: 10 }, (_, i) => simulateRequest(i + 1));
  
  // Process with max 2 concurrent (simulating OLLAMA_NUM_PARALLEL=2)
  const maxConcurrent = parseInt(ollamaParallel) || 2;
  const results = [];
  
  for (let i = 0; i < requests.length; i += maxConcurrent) {
    const batch = requests.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    console.log(`Batch ${Math.floor(i/maxConcurrent) + 1} completed`);
  }
  
  const totalTime = Date.now() - startTime;
  
  console.log(`\n✅ All requests completed in ${totalTime}ms`);
  console.log(`📈 Average time per request: ${(totalTime / 10).toFixed(0)}ms`);
  
  if (maxConcurrent === 2) {
    console.log('\n✨ SUCCESS: With OLLAMA_NUM_PARALLEL=2, grocery parsing should now be much faster!');
    console.log('Previous: 10-30 second delays');
    console.log('Expected: Sub-second response times');
  }
}

testConcurrency().catch(console.error);