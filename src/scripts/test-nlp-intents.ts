/**
 * Test script for NLP intent detection
 * Tests various query patterns and intents
 */

import axios from "axios";

const API_URL = "http://localhost:3001/api/nlp/process";

interface TestCase {
  query: string;
  expectedIntent: string;
  description: string;
}

const testCases: TestCase[] = [
  // Add items tests
  { query: "add milk", expectedIntent: "add_items", description: "Simple add" },
  { query: "I need 2 gallons of milk", expectedIntent: "add_items", description: "Add with quantity" },
  { query: "add bread and eggs to my cart", expectedIntent: "add_items", description: "Multiple items" },
  { query: "put 3 apples in my shopping list", expectedIntent: "add_items", description: "Alternative phrasing" },
  
  // Remove items tests
  { query: "remove milk", expectedIntent: "remove_items", description: "Simple remove" },
  { query: "delete eggs from my cart", expectedIntent: "remove_items", description: "Delete variant" },
  { query: "take out the bread", expectedIntent: "remove_items", description: "Take out variant" },
  
  // Search tests
  { query: "show me milk options", expectedIntent: "search_products", description: "Search products" },
  { query: "what milk do you have?", expectedIntent: "search_products", description: "Question search" },
  { query: "find organic milk", expectedIntent: "search_products", description: "Find variant" },
  
  // View cart tests
  { query: "show my cart", expectedIntent: "view_cart", description: "View cart" },
  { query: "what's in my shopping list?", expectedIntent: "view_cart", description: "Question cart" },
  
  // Checkout tests
  { query: "checkout", expectedIntent: "checkout", description: "Simple checkout" },
  { query: "I'm ready to pay", expectedIntent: "checkout", description: "Ready to pay" },
  
  // Clear cart tests
  { query: "clear my cart", expectedIntent: "clear_cart", description: "Clear cart" },
  { query: "empty my shopping list", expectedIntent: "clear_cart", description: "Empty variant" },
];

async function testIntent(testCase: TestCase) {
  try {
    const startTime = Date.now();
    const response = await axios.post(API_URL, { text: testCase.query }, {
      timeout: 35000,
      headers: { "Content-Type": "application/json" },
      // Handle connection issues
      maxRedirects: 5,
      validateStatus: (status: any) => status < 500
    });
    const endTime = Date.now();
    
    if (!response.data || response.status !== 200) {
      throw new Error(`Invalid response: ${response.status}`);
    }
    
    const result = response?.data;
    const passed = result.intent === testCase.expectedIntent;
    
    console.log(`${passed ? "✅" : "❌"} ${testCase.description}`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Expected: ${testCase.expectedIntent}, Got: ${result.intent}`);
    console.log(`   Confidence: ${result.confidence}, Time: ${endTime - startTime}ms`);
    if (result.items?.length > 0) {
      console.log(`   Items: ${result?.items?.join(", ")}`);
    }
    if (result.quantities?.length > 0) {
      console.log(`   Quantities: ${result?.quantities?.join(", ")}`);
    }
    console.log("");
    
    return { passed, time: endTime - startTime };
  } catch (error: any) {
    // Handle EPIPE and connection errors gracefully
    if (error.code === 'EPIPE' || error.code === 'ECONNRESET') {
      console.log(`⚠️  ${testCase.description} - CONNECTION RESET`);
      console.log(`   Query: "${testCase.query}"`);
      console.log(`   Retrying after delay...`);
      console.log("");
      // Wait a bit and return for retry
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { passed: false, time: 0, retry: true };
    }
    
    console.log(`❌ ${testCase.description} - ERROR`);
    console.log(`   Query: "${testCase.query}"`);
    console.log(`   Error: ${error.message}`);
    console.log("");
    return { passed: false, time: 0 };
  }
}

async function runTests() {
  console.log("=== NLP Intent Detection Test Suite ===\n");
  
  let passed = 0;
  let failed = 0;
  let totalTime = 0;
  
  for (const testCase of testCases) {
    let result = await testIntent(testCase);
    
    // Retry once if connection was reset
    if (result.retry) {
      console.log("   Retrying test...\n");
      result = await testIntent(testCase);
    }
    
    if (result.passed) passed++;
    else failed++;
    totalTime += result.time;
    
    // Small delay between tests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log("=== Test Summary ===");
  console.log(`Total: ${testCases?.length || 0}`);
  console.log(`Passed: ${passed} (${((passed/testCases?.length || 0)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);
  console.log(`Average time: ${(totalTime/testCases?.length || 0).toFixed(0)}ms`);
}

runTests().catch(console.error);