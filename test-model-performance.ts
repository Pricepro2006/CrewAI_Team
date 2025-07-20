#!/usr/bin/env ts-node

/**
 * Quick script to test model performance improvements
 * Run with: npx ts-node test-model-performance.ts
 */

import { Ollama } from "ollama";

const ollama = new Ollama({ host: "http://localhost:11434" });

// Test queries of different complexity
const TEST_QUERIES = [
  {
    query: "What is 2+2?",
    expectedModel: "qwen3:1.7b",
    type: "simple",
  },
  {
    query: "Write a Python function to calculate the Fibonacci sequence",
    expectedModel: "qwen3:8b",
    type: "code",
  },
  {
    query: "Research the latest developments in quantum computing",
    expectedModel: "qwen3:8b",
    type: "research",
  },
  {
    query: "Analyze the performance metrics and create a summary",
    expectedModel: "qwen3:4b",
    type: "data",
  },
];

// Models to test
const MODELS = [
  { name: "qwen3:0.6b", size: "522MB" },
  { name: "qwen3:1.7b", size: "1.4GB" },
  { name: "granite3.3:2b", size: "1.5GB" },
  { name: "qwen3:4b", size: "2.6GB" },
  { name: "qwen3:8b", size: "5.2GB" },
];

async function testModel(
  model: string,
  query: string,
): Promise<{ time: number; tokens: number }> {
  const start = Date.now();

  try {
    const response = await ollama.generate({
      model,
      prompt: query,
      options: {
        temperature: 0.7,
        num_predict: 100, // Limit tokens for testing
      },
    });

    const time = Date.now() - start;
    const tokens = response.response.split(" ").length;

    return { time, tokens };
  } catch (error) {
    console.error(`Error with model ${model}:`, error);
    return { time: -1, tokens: 0 };
  }
}

async function preloadModel(model: string) {
  console.log(`Preloading ${model}...`);
  try {
    await ollama.generate({
      model,
      prompt: "",
      options: { num_predict: 1 },
    });
    console.log(`✓ ${model} loaded`);
  } catch (error) {
    console.log(`✗ ${model} failed to load`);
  }
}

async function main() {
  console.log("🚀 CrewAI Model Performance Test\n");
  console.log("System: AMD Ryzen 7 PRO 7840HS, 54GB RAM\n");

  // Preload models
  console.log("Preloading models...");
  for (const model of MODELS.filter((m) =>
    ["qwen3:1.7b", "qwen3:4b", "qwen3:8b"].includes(m.name),
  )) {
    await preloadModel(model.name);
  }
  console.log("\n");

  // Test each query with recommended model
  console.log("Testing queries with recommended models:\n");

  for (const test of TEST_QUERIES) {
    console.log(`Query: "${test.query}"`);
    console.log(`Type: ${test.type}`);
    console.log(`Recommended model: ${test.expectedModel}`);

    const result = await testModel(test.expectedModel, test.query);

    if (result.time > 0) {
      console.log(`✓ Response time: ${(result.time / 1000).toFixed(2)}s`);
      console.log(
        `✓ Tokens/sec: ${(result.tokens / (result.time / 1000)).toFixed(1)}`,
      );
    }
    console.log("---\n");
  }

  // Compare models on same query
  console.log("\nModel comparison on code generation task:\n");
  const testQuery = "Write a Python function to calculate factorial";

  const results: Array<{ model: string; time: number; tokensPerSec: number }> =
    [];

  for (const model of MODELS) {
    if (
      !["qwen3:1.7b", "qwen3:4b", "qwen3:8b", "granite3.3:2b"].includes(
        model.name,
      )
    ) {
      continue;
    }

    console.log(`Testing ${model.name} (${model.size})...`);
    const result = await testModel(model.name, testQuery);

    if (result.time > 0) {
      const tokensPerSec = result.tokens / (result.time / 1000);
      results.push({
        model: model.name,
        time: result.time / 1000,
        tokensPerSec,
      });
      console.log(
        `✓ Time: ${(result.time / 1000).toFixed(2)}s, Tokens/sec: ${tokensPerSec.toFixed(1)}`,
      );
    }
  }

  // Summary
  console.log("\n📊 Performance Summary:\n");
  console.log("Model            | Time (s) | Tokens/sec | vs granite3.3:2b");
  console.log("-----------------|----------|------------|------------------");

  const graniteResult = results.find((r) => r.model === "granite3.3:2b");
  const graniteTime = graniteResult?.time || 1;

  for (const result of results.sort((a, b) => a.time - b.time)) {
    const speedup = ((graniteTime / result.time - 1) * 100).toFixed(0);
    const speedupStr =
      result.model === "granite3.3:2b"
        ? "baseline"
        : result.time < graniteTime
          ? `+${speedup}% faster`
          : `${speedup}% slower`;

    console.log(
      `${result.model.padEnd(16)} | ${result.time.toFixed(2).padStart(8)} | ${result.tokensPerSec
        .toFixed(1)
        .padStart(10)} | ${speedupStr}`,
    );
  }

  console.log("\n✅ Test complete!");
  console.log("\n💡 Recommendations:");
  console.log("1. Use qwen3:1.7b for simple queries (fastest)");
  console.log("2. Use qwen3:4b for balanced performance");
  console.log("3. Use qwen3:8b for complex tasks (best quality)");
  console.log("4. Keep models preloaded with OLLAMA_KEEP_ALIVE=10m");
}

// Run the test
main().catch(console.error);
