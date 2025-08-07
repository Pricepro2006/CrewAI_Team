/**
 * Test NLP search functionality end-to-end
 */

import axios from "axios";

const API_URL = "http://localhost:3001/api/nlp/process";

interface TestCase {
  name: string;
  query: string;
  expectedIntent: string;
  expectedAction: string;
}

const testCases: TestCase[] = [
  {
    name: "Add single item",
    query: "add milk to my cart",
    expectedIntent: "add_items",
    expectedAction: "add"
  },
  {
    name: "Add with quantity",
    query: "I need 2 gallons of whole milk",
    expectedIntent: "add_items",
    expectedAction: "add"
  },
  {
    name: "Search for product",
    query: "show me organic vegetables",
    expectedIntent: "search_products",
    expectedAction: "search"
  },
  {
    name: "Complex grocery list",
    query: "add bread, eggs, butter, and 3 apples to my shopping list",
    expectedIntent: "add_items",
    expectedAction: "add"
  },
  {
    name: "View cart",
    query: "what's in my cart?",
    expectedIntent: "view_cart",
    expectedAction: "view"
  },
  {
    name: "Checkout",
    query: "I'm ready to checkout",
    expectedIntent: "checkout",
    expectedAction: "checkout"
  },
  {
    name: "Clear cart",
    query: "empty my shopping cart",
    expectedIntent: "clear_cart",
    expectedAction: "clear"
  },
  {
    name: "Remove item",
    query: "remove eggs from my cart",
    expectedIntent: "remove_items",
    expectedAction: "remove"
  }
];

async function testNLPSearch() {
  console.log("=== NLP Search Functionality Test ===\n");
  
  const results = {
    passed: 0,
    failed: 0,
    errors: 0
  };

  for (const test of testCases) {
    console.log(`Testing: ${test.name}`);
    console.log(`Query: "${test.query}"`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(API_URL, {
        text: test.query,
        userId: "test-user",
        sessionId: "test-session-" + Date.now()
      }, {
        timeout: 10000
      });
      
      const endTime = Date.now();
      const data = response.data;
      
      // Check intent
      const intentMatch = data.intent === test.expectedIntent;
      const actionMatch = data.action === test.expectedAction;
      
      if (intentMatch && actionMatch) {
        console.log(`✅ PASSED`);
        results.passed++;
      } else {
        console.log(`❌ FAILED`);
        console.log(`   Expected: intent=${test.expectedIntent}, action=${test.expectedAction}`);
        console.log(`   Got: intent=${data.intent}, action=${data.action}`);
        results.failed++;
      }
      
      console.log(`   Confidence: ${data.confidence}`);
      console.log(`   Time: ${endTime - startTime}ms`);
      
      // Show extracted items
      if (data.items && data.items.length > 0) {
        console.log(`   Items: ${data.items.join(", ")}`);
      }
      
      // Show products if found
      if (data.products && data.products.length > 0) {
        console.log(`   Products found: ${data.products.length}`);
        data.products.slice(0, 2).forEach((p: any) => {
          console.log(`     - ${p.name} ($${p.price})`);
        });
      }
      
    } catch (error: any) {
      console.log(`❌ ERROR: ${error.message}`);
      results.errors++;
    }
    
    console.log("");
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log("=== Test Summary ===");
  console.log(`Total tests: ${testCases.length}`);
  console.log(`Passed: ${results.passed} (${((results.passed/testCases.length)*100).toFixed(1)}%)`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Errors: ${results.errors}`);
  
  // Overall result
  if (results.passed === testCases.length) {
    console.log("\n🎉 All tests passed! NLP search is working correctly.");
  } else if (results.passed > testCases.length * 0.7) {
    console.log("\n⚠️  Most tests passed, but some issues need attention.");
  } else {
    console.log("\n❌ Many tests failed. NLP search needs debugging.");
  }
}

// Check if server is running first
async function checkServer() {
  try {
    await axios.get("http://localhost:3001/api/nlp/health");
    return true;
  } catch (error) {
    console.error("❌ Server is not running on port 3001");
    console.log("Please start the server first with: npm run dev:server");
    return false;
  }
}

// Main execution
(async () => {
  if (await checkServer()) {
    await testNLPSearch();
  }
})();