#!/usr/bin/env node

/**
 * Quick verification of which models actually work
 */

const { Ollama } = require('ollama');

const ALL_MODELS = [
  "hf.co/bartowski/Meta-Llama-3.1-8B-Instruct-GGUF",
  "hf.co/unsloth/DeepSeek-R1-0528-Qwen3-8B-GGUF",
  "alibayram/smollm3",
  "qwen3:0.6b",
  "gemma3n:e2b",
  "gemma3n:e4b",
  "phi4-mini-reasoning:3.8b",
  "qwen3:1.7b",
  "qwen3:4b",
  "granite3.3:8b",
  "granite3.3:2b"
];

async function quickTest() {
  const ollama = new Ollama({ host: "http://localhost:11434" });
  const results = {
    working: [],
    timeout: [],
    notFound: [],
    error: []
  };

  console.log("🔍 Quick verification of working models...\n");

  for (const model of ALL_MODELS) {
    console.log(`Testing ${model}...`);
    
    try {
      // Check if model exists
      const modelList = await ollama.list();
      const modelExists = modelList.models.some(m => m.name === model);
      
      if (!modelExists) {
        console.log(`   ❌ Not found`);
        results.notFound.push(model);
        continue;
      }

      // Quick test with short timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), 5000);
      });

      const generatePromise = ollama.generate({
        model: model,
        prompt: "Say hello",
        stream: false
      });

      await Promise.race([generatePromise, timeoutPromise]);
      console.log(`   ✅ Working`);
      results.working.push(model);

    } catch (error) {
      if (error.message === 'timeout') {
        console.log(`   ⏰ Timeout`);
        results.timeout.push(model);
      } else {
        console.log(`   ❌ Error: ${error.message}`);
        results.error.push(model);
      }
    }
  }

  console.log(`\n📊 VERIFICATION RESULTS:`);
  console.log(`✅ Working models: ${results.working.length}`);
  console.log(`⏰ Timeout models: ${results.timeout.length}`);
  console.log(`❌ Not found: ${results.notFound.length}`);
  console.log(`💥 Error models: ${results.error.length}`);

  console.log(`\n✅ WORKING MODELS:`);
  results.working.forEach(m => console.log(`  - ${m}`));

  console.log(`\n⏰ SLOW/TIMEOUT MODELS:`);
  results.timeout.forEach(m => console.log(`  - ${m}`));

  console.log(`\n❌ NOT FOUND MODELS:`);
  results.notFound.forEach(m => console.log(`  - ${m}`));

  return results;
}

quickTest().catch(console.error);