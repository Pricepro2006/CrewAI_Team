/**
 * Quick test of irrigation specialist query on fastest models
 */

import fs from 'fs/promises';
import path from 'path';

// Test fastest models first
const QUICK_MODELS = [
  'qwen3:0.6b',
  'granite3.3:2b',
  'qwen3:1.7b',
  'qwen3:4b'
];

const IRRIGATION_QUERY = `Find current irrigation specialists to assist with a cracked, leaking sprinkler head from a root growing into the irrigation piping, for the area surrounding the following address. They need to be able to travel to this location and if you can include initial visit costs, add that information as well.
Address: 278 Wycliff Dr. Spartanburg, SC 29301`;

interface QuickResult {
  model: string;
  responseTime: number;
  response: string;
  score: number;
}

async function quickTest(model: string): Promise<QuickResult> {
  console.log(`\nTesting ${model}...`);
  const startTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `Help find irrigation specialists for this request: "${IRRIGATION_QUERY}"
        
Provide practical advice including:
1. How to find local specialists in Spartanburg, SC
2. What to look for in a specialist
3. Typical service call costs
4. Questions to ask when calling`,
        stream: false,
        options: { 
          temperature: 0.7, 
          num_predict: 512,
          timeout: 30000 // 30 second timeout
        }
      })
    });

    const result = await response.json();
    const responseTime = Date.now() - startTime;
    
    // Quick scoring
    let score = 0;
    const text = (result.response || '').toLowerCase();
    
    // Essential elements
    if (text.includes('irrigation')) score += 0.2;
    if (text.includes('spartanburg') || text.includes('29301')) score += 0.2;
    if (text.includes('root')) score += 0.1;
    if (text.match(/\$\d+/) || text.includes('cost')) score += 0.2;
    if (text.includes('call') || text.includes('contact')) score += 0.1;
    if (text.includes('license') || text.includes('insur')) score += 0.1;
    if (text.length > 200) score += 0.1;
    
    return {
      model,
      responseTime,
      response: result.response,
      score: Math.min(1, score)
    };
    
  } catch (error) {
    console.error(`Error with ${model}:`, error.message);
    return {
      model,
      responseTime: Date.now() - startTime,
      response: `Error: ${error.message}`,
      score: 0
    };
  }
}

async function main() {
  console.log('Quick Irrigation Specialist Test');
  console.log('Address: 278 Wycliff Dr. Spartanburg, SC 29301\n');
  
  const results: QuickResult[] = [];
  
  for (const model of QUICK_MODELS) {
    const result = await quickTest(model);
    results.push(result);
    
    console.log(`Response time: ${(result.responseTime / 1000).toFixed(2)}s`);
    console.log(`Score: ${(result.score * 100).toFixed(0)}%`);
    console.log(`Response preview: ${result.response.substring(0, 150)}...`);
  }
  
  // Save results
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  await fs.writeFile(
    `quick-irrigation-results-${timestamp}.json`,
    JSON.stringify(results, null, 2)
  );
  
  // Generate quick report
  console.log('\n' + '='.repeat(80));
  console.log('QUICK TEST RESULTS');
  console.log('='.repeat(80));
  
  const sorted = [...results].sort((a, b) => b.score - a.score);
  
  console.log('\nBest Responses:');
  sorted.forEach((r, i) => {
    console.log(`${i + 1}. ${r.model}: ${(r.score * 100).toFixed(0)}% in ${(r.responseTime / 1000).toFixed(2)}s`);
  });
  
  console.log('\nBest Response:');
  console.log('-'.repeat(80));
  console.log(sorted[0].response);
}

main().catch(console.error);