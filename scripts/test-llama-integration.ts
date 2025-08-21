#!/usr/bin/env tsx

import { SafeLlamaCppProvider } from "../src/core/llm/SafeLlamaCppProvider.js";
import * as path from "path";
import * as fs from "fs";

async function testLlamaIntegration() {
  console.log("🧪 Testing llama.cpp integration...\n");
  
  const modelPath = "./models/Llama-3.2-3B-Instruct-Q4_K_M.gguf";
  
  // Check if model exists
  if (!fs.existsSync(modelPath)) {
    console.error("❌ Model file not found:", modelPath);
    process.exit(1);
  }
  
  console.log("✅ Model file found:", modelPath);
  
  try {
    // Create provider instance
    const provider = new SafeLlamaCppProvider({
      modelPath: modelPath,
      contextSize: 2048,
      threads: 4,
      temperature: 0.7,
      maxTokens: 50,
      processTimeout: 30000,
    });
    
    console.log("📦 Initializing llama.cpp provider...");
    
    // Initialize (verify model loads)
    await provider.initialize();
    console.log("✅ Provider initialized successfully");
    
    // Test generation
    console.log("\n🤖 Testing text generation...");
    console.log("Prompt: 'What is artificial intelligence?'");
    
    const response = await provider.generate(
      "What is artificial intelligence?",
      {
        maxTokens: 50,
        temperature: 0.7
      }
    );
    
    console.log("\n📝 Response:");
    console.log("-------------");
    console.log(response.response);
    console.log("-------------");
    
    console.log("\n📊 Metrics:");
    console.log(`- Tokens generated: ${response.tokensGenerated}`);
    console.log(`- Tokens per second: ${response.tokensPerSecond?.toFixed(2)}`);
    console.log(`- Total duration: ${response.totalDuration}ms`);
    
    // Test with system prompt
    console.log("\n🤖 Testing with system prompt...");
    const response2 = await provider.generate(
      "List 3 benefits",
      {
        maxTokens: 50,
        temperature: 0.7,
        systemPrompt: "You are a helpful assistant. Be concise."
      }
    );
    
    console.log("\n📝 Response with system prompt:");
    console.log("-------------");
    console.log(response2.response);
    console.log("-------------");
    
    // Cleanup
    await provider.cleanup();
    console.log("\n✅ Cleanup completed");
    
    console.log("\n🎉 All tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testLlamaIntegration().catch(console.error);