#!/usr/bin/env node
/**
 * Test Qwen3:0.6b NLP Model Integration
 * Validates the model can process grocery-related queries
 */

import axios from "axios";
import { logger } from "../utils/logger";
import { walmartConfig } from "../config/walmart.config";

interface TestQuery {
  input: string;
  expectedIntent: string;
  expectedEntities: string[];
}

const testQueries: TestQuery[] = [
  {
    input: "Add 2 gallons of milk to my list",
    expectedIntent: "add_item",
    expectedEntities: ["milk", "2 gallons"]
  },
  {
    input: "Remove bread from shopping cart",
    expectedIntent: "remove_item",
    expectedEntities: ["bread"]
  },
  {
    input: "What's the price of organic eggs?",
    expectedIntent: "check_price",
    expectedEntities: ["organic eggs", "organic", "eggs"]
  },
  {
    input: "Find substitutes for almond milk",
    expectedIntent: "find_substitute",
    expectedEntities: ["almond milk"]
  },
  {
    input: "Show me deals on dairy products",
    expectedIntent: "search_deals",
    expectedEntities: ["dairy products", "dairy"]
  },
  {
    input: "Create a new grocery list for weekly shopping",
    expectedIntent: "create_list",
    expectedEntities: ["weekly shopping"]
  }
];

async function testQwen3Model() {
  logger.info("Starting Qwen3:0.6b NLP model tests...", "TEST_NLP");
  
  const ollamaUrl = `${walmartConfig?.nlp?.host}:${walmartConfig?.nlp?.port}`;
  const modelName = walmartConfig?.nlp?.model;
  
  // First, verify the model is available
  try {
    const response = await axios.get(`${ollamaUrl}/api/tags`);
    const models = response?.data?.models || [];
    const modelExists = models.some((m: any) => m.name === modelName);
    
    if (!modelExists) {
      logger.error(`Model ${modelName} not found. Please run: ollama pull ${modelName}`, "TEST_NLP");
      process.exit(1);
    }
    
    logger.info(`✅ Model ${modelName} is available`, "TEST_NLP");
  } catch (error) {
    logger.error(`Failed to connect to Ollama: ${error}`, "TEST_NLP");
    process.exit(1);
  }
  
  // Test each query
  let successCount = 0;
  const results: any[] = [];
  
  for (const test of testQueries) {
    logger.info(`Testing: "${test.input}"`, "TEST_NLP");
    
    const prompt = `You are a grocery shopping assistant. Analyze this input and extract the intent and entities.

Input: "${test.input}"

Identify the intent (one of: add_item, remove_item, check_price, find_substitute, search_deals, create_list, view_list, checkout)
Also identify any products, quantities, and brands mentioned.

Respond in JSON format:
{
  "intent": "detected_intent",
  "entities": {
    "products": ["product1"],
    "quantities": ["quantity1"],
    "brands": ["brand1"]
  }
}

Response:`;

    try {
      const startTime = Date.now();
      
      const response = await axios.post(`${ollamaUrl}/api/generate`, {
        model: modelName,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          top_p: 0.9,
          num_predict: 150
        }
      });
      
      const elapsed = Date.now() - startTime;
      const modelResponse = response?.data?.response;
      
      // Try to parse JSON from response
      let parsedResponse;
      try {
        const jsonMatch = modelResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedResponse = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        logger.warn(`Failed to parse JSON response: ${modelResponse}`, "TEST_NLP");
      }
      
      const result = {
        query: test.input,
        expectedIntent: test.expectedIntent,
        detectedIntent: parsedResponse?.intent || "unknown",
        intentMatch: parsedResponse?.intent === test.expectedIntent,
        responseTime: elapsed,
        rawResponse: modelResponse
      };
      
      results.push(result);
      
      if (result.intentMatch) {
        successCount++;
        logger.info(`✅ Intent matched: ${result.detectedIntent} (${elapsed}ms)`, "TEST_NLP");
      } else {
        logger.warn(`❌ Intent mismatch: expected ${test.expectedIntent}, got ${result.detectedIntent}`, "TEST_NLP");
      }
      
      // Log the extracted entities
      if (parsedResponse?.entities) {
        logger.info(`   Entities: ${JSON.stringify(parsedResponse.entities)}`, "TEST_NLP");
      }
      
    } catch (error) {
      logger.error(`Failed to process query: ${error}`, "TEST_NLP");
      results.push({
        query: test.input,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${testQueries?.length || 0}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${testQueries?.length || 0 - successCount}`);
  console.log(`Success Rate: ${((successCount / testQueries?.length || 0) * 100).toFixed(1)}%`);
  
  // Performance metrics
  const avgResponseTime = results
    .filter(r => r.responseTime)
    .reduce((sum: any, r: any) => sum + r.responseTime, 0) / results?.filter(r => r.responseTime).length;
  
  console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);
  console.log("=".repeat(60));
  
  // Detailed results
  console.log("\nDetailed Results:");
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. "${r.query}"`);
    if (r.error) {
      console.log(`   ERROR: ${r.error}`);
    } else {
      console.log(`   Expected: ${r.expectedIntent}`);
      console.log(`   Detected: ${r.detectedIntent}`);
      console.log(`   Match: ${r.intentMatch ? "✅" : "❌"}`);
      console.log(`   Time: ${r.responseTime}ms`);
    }
  });
}

// Run the tests
testQwen3Model().catch(console.error);