#!/usr/bin/env tsx
/**
 * End-to-End Test for Walmart Grocery Agent
 * Tests the complete flow from NLP to pricing
 */

import axios from "axios";

const NLP_SERVICE = "http://localhost:3008";
const PRICING_SERVICE = "http://localhost:3007";
const CACHE_SERVICE = "http://localhost:3006";

interface TestResult {
  test: string;
  passed: boolean;
  details: any;
  duration: number;
}

const tests: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<boolean>): Promise<void> {
  const start = Date.now();
  try {
    const passed = await testFn();
    const duration = Date.now() - start;
    tests.push({ test: name, passed, details: null, duration });
    console.log(`${passed ? "✅" : "❌"} ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    tests.push({ test: name, passed: false, details: error.message, duration });
    console.log(`❌ ${name} - ${error.message} (${duration}ms)`);
  }
}

async function main() {
  console.log("=== Walmart Grocery Agent E2E Testing ===\n");

  // Test 1: Service Health Checks
  await runTest("All services are healthy", async () => {
    const services = [
      { url: `${NLP_SERVICE}/health`, name: "NLP" },
      { url: `${PRICING_SERVICE}/health`, name: "Pricing" },
      { url: `${CACHE_SERVICE}/health`, name: "Cache" }
    ];

    for (const service of services) {
      const response = await axios.get(service.url);
      if (response?.data?.status !== "healthy") {
        throw new Error(`${service.name} service not healthy`);
      }
    }
    return true;
  });

  // Test 2: NLP Intent Detection - Add Items
  await runTest("NLP detects 'add items' intent", async () => {
    const response = await axios.post(`${NLP_SERVICE}/process`, {
      text: "Add 3 gallons of milk to my shopping list"
    });

    return response?.data?.intent === "add_items" && 
           response?.data?.items.includes("milk") &&
           response?.data?.quantities.includes("3 gallons");
  });

  // Test 3: NLP Intent Detection - Check Price
  await runTest("NLP detects 'check price' intent", async () => {
    const response = await axios.post(`${NLP_SERVICE}/process`, {
      text: "What's the price of Great Value milk?"
    });

    return response?.data?.intent === "check_price" && 
           response?.data?.items.includes("milk");
  });

  // Test 4: Pricing Calculation
  await runTest("Pricing service calculates correctly", async () => {
    const response = await axios.post(`${PRICING_SERVICE}/calculate`, {
      productId: "prod_001",
      quantity: 2
    });

    const expected = 3.98 * 2; // Base price * quantity
    const hasDiscount = response?.data?.discount > 0;
    const correctTotal = Math.abs(response?.data?.totalPrice - expected) < 0.01;
    
    return hasDiscount && correctTotal && response?.data?.currency === "USD";
  });

  // Test 5: Bulk Pricing
  await runTest("Bulk pricing with discount", async () => {
    const response = await axios.post(`${PRICING_SERVICE}/bulk`, {
      items: [
        { productId: "prod_001", quantity: 4 },
        { productId: "prod_002", quantity: 2 }
      ]
    });

    return response?.data?.items?.length || 0 === 2 && 
           response?.data?.items.every((item: any) => item.finalPrice > 0);
  });

  // Test 6: Active Promotions
  await runTest("Get active promotions", async () => {
    const response = await axios.get(`${PRICING_SERVICE}/promotions`);
    
    return response?.data?.promotions?.length || 0 > 0 &&
           response?.data?.promotions.some((p: any) => p.id === "MILK_PROMO");
  });

  // Test 7: Cache Warming
  await runTest("Cache warmer warms popular items", async () => {
    const response = await axios.post(`${CACHE_SERVICE}/warm`, {
      category: "popular"
    });

    return response?.data?.itemsWarmed > 0;
  });

  // Test 8: Cache Status
  await runTest("Cache status shows items", async () => {
    const response = await axios.get(`${CACHE_SERVICE}/status`);
    
    return response?.data?.totalItems > 0 && 
           response?.data?.active > 0;
  });

  // Test 9: Complete Flow - NLP to Pricing
  await runTest("Complete flow: NLP → Pricing", async () => {
    // Step 1: Process natural language
    const nlpResponse = await axios.post(`${NLP_SERVICE}/process`, {
      text: "I want to buy 5 gallons of milk"
    });

    if (nlpResponse?.data?.intent !== "add_items") {
      throw new Error("Wrong intent detected");
    }

    // Step 2: Get pricing for the item
    const pricingResponse = await axios.post(`${PRICING_SERVICE}/calculate`, {
      productId: "prod_001", // Great Value Whole Milk
      quantity: 5
    });

    // Verify we got a price with bulk discount
    return pricingResponse?.data?.quantity === 5 &&
           pricingResponse?.data?.discount > 0 &&
           pricingResponse?.data?.finalPrice < pricingResponse?.data?.totalPrice;
  });

  // Test 10: Error Handling
  await runTest("Services handle invalid requests gracefully", async () => {
    try {
      // Invalid NLP request
      await axios.post(`${NLP_SERVICE}/process`, {});
    } catch (error: any) {
      if (error.response?.status !== 400) {
        throw new Error("NLP should return 400 for invalid request");
      }
    }

    try {
      // Invalid pricing request
      await axios.post(`${PRICING_SERVICE}/calculate`, {
        quantity: 1 // Missing productId
      });
    } catch (error: any) {
      if (error.response?.status !== 400) {
        throw new Error("Pricing should return 400 for invalid request");
      }
    }

    return true;
  });

  // Summary
  console.log("\n=== Test Summary ===");
  const passed = tests?.filter(t => t.passed).length;
  const failed = tests?.filter(t => !t.passed).length;
  const totalDuration = tests.reduce((sum: any, t: any) => sum + t.duration, 0);

  console.log(`Total Tests: ${tests?.length || 0}`);
  console.log(`Passed: ${passed} (${((passed/tests?.length || 0)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Average: ${(totalDuration/tests?.length || 0).toFixed(1)}ms per test`);

  if (failed > 0) {
    console.log("\n=== Failed Tests ===");
    tests?.filter(t => !t.passed).forEach(t => {
      console.log(`❌ ${t.test}: ${t.details || "Failed"}`);
    });
  }

  // Performance metrics
  console.log("\n=== Performance Metrics ===");
  const fastTests = tests?.filter(t => t.duration < 100);
  const slowTests = tests?.filter(t => t.duration > 500);
  
  console.log(`Fast (<100ms): ${fastTests?.length || 0} tests`);
  console.log(`Slow (>500ms): ${slowTests?.length || 0} tests`);
  
  if (slowTests?.length || 0 > 0) {
    console.log("\nSlow tests:");
    slowTests.forEach(t => {
      console.log(`  - ${t.test}: ${t.duration}ms`);
    });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});