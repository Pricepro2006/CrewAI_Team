#!/usr/bin/env tsx
/**
 * Integration Test Suite for CrewAI Team Backend
 * Tests core functionality across all major components
 */

import { SimpleLLMProvider } from './src/core/llm/SimpleLLMProvider.js';
import { LLMProviderManager } from './src/core/llm/LLMProviderManager.js';
import { logger } from './src/utils/logger.js';

async function runIntegrationTests() {
  console.log("=".repeat(60));
  console.log("      CrewAI Team - Integration Test Suite");
  console.log("=".repeat(60));
  console.log();

  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{name: string, status: 'pass' | 'fail', message?: string}>
  };

  // Test 1: LLM Provider Manager Initialization
  console.log("Test 1: LLM Provider Manager Initialization");
  try {
    const manager = LLMProviderManager.getInstance();
    await manager.initialize();
    console.log("  ✅ LLM Provider Manager initialized successfully");
    results.tests.push({name: "LLM Provider Manager Init", status: 'pass'});
    results.passed++;
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "LLM Provider Manager Init", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 2: Fallback Provider Functionality
  console.log("Test 2: Fallback Provider Functionality");
  try {
    const provider = new SimpleLLMProvider();
    const response = await provider.generate("Test prompt");
    if (response && response.response) {
      console.log("  ✅ Fallback provider generated response");
      results.tests.push({name: "Fallback Provider", status: 'pass'});
      results.passed++;
    } else {
      throw new Error("No response generated");
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "Fallback Provider", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 3: Email Analysis Prompt Handling
  console.log("Test 3: Email Analysis Prompt Handling");
  try {
    const provider = new SimpleLLMProvider();
    const emailPrompt = "Analyze this email: Customer is asking about order status for PO#12345";
    const response = await provider.generate(emailPrompt);
    if (response.response.includes("analysis") || response.response.includes("email")) {
      console.log("  ✅ Email analysis prompt handled correctly");
      results.tests.push({name: "Email Analysis", status: 'pass'});
      results.passed++;
    } else {
      throw new Error("Response doesn't match email analysis pattern");
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "Email Analysis", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 4: Entity Extraction Handling
  console.log("Test 4: Entity Extraction Handling");
  try {
    const provider = new SimpleLLMProvider();
    const extractPrompt = "Extract entities from: John Smith ordered 5 laptops, PO#67890, from Dell";
    const response = await provider.generate(extractPrompt);
    if (response.response.includes("entities") || response.response.includes("extracted")) {
      console.log("  ✅ Entity extraction handled correctly");
      results.tests.push({name: "Entity Extraction", status: 'pass'});
      results.passed++;
    } else {
      throw new Error("Response doesn't match entity extraction pattern");
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "Entity Extraction", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 5: System Prompt Integration
  console.log("Test 5: System Prompt Integration");
  try {
    const provider = new SimpleLLMProvider();
    const response = await provider.generate("Process this request", {
      systemPrompt: "You are a specialized email processor"
    });
    if (response.response.includes("[System:")) {
      console.log("  ✅ System prompt integrated into response");
      results.tests.push({name: "System Prompt", status: 'pass'});
      results.passed++;
    } else {
      throw new Error("System prompt not included in response");
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "System Prompt", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 6: Performance Metrics
  console.log("Test 6: Performance Metrics");
  try {
    const provider = new SimpleLLMProvider();
    const startTime = Date.now();
    const response = await provider.generate("Quick test");
    const elapsed = Date.now() - startTime;
    
    if (elapsed < 500 && response.tokensPerSecond > 0) {
      console.log(`  ✅ Response generated in ${elapsed}ms (${response.tokensPerSecond.toFixed(1)} tokens/sec)`);
      results.tests.push({name: "Performance Metrics", status: 'pass'});
      results.passed++;
    } else {
      throw new Error(`Response too slow: ${elapsed}ms`);
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "Performance Metrics", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Test 7: Multiple Request Types
  console.log("Test 7: Multiple Request Types");
  try {
    const provider = new SimpleLLMProvider();
    const requestTypes = [
      "Summarize this document",
      "What are the action items?",
      "Extract key information",
      "Analyze the workflow"
    ];
    
    let allHandled = true;
    for (const request of requestTypes) {
      const response = await provider.generate(request);
      if (!response.response || response.response.length < 10) {
        allHandled = false;
        break;
      }
    }
    
    if (allHandled) {
      console.log("  ✅ All request types handled successfully");
      results.tests.push({name: "Multiple Request Types", status: 'pass'});
      results.passed++;
    } else {
      throw new Error("Some request types not handled properly");
    }
  } catch (error) {
    console.log("  ❌ Failed:", error);
    results.tests.push({name: "Multiple Request Types", status: 'fail', message: String(error)});
    results.failed++;
  }
  console.log();

  // Print Summary
  console.log("=".repeat(60));
  console.log("                    TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed} ✅`);
  console.log(`Failed: ${results.failed} ❌`);
  console.log(`Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  console.log();

  // Detailed Results
  console.log("Detailed Results:");
  console.log("-".repeat(40));
  for (const test of results.tests) {
    const icon = test.status === 'pass' ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
    if (test.message) {
      console.log(`   Error: ${test.message}`);
    }
  }
  console.log();

  // Final Assessment
  if (results.failed === 0) {
    console.log("🎉 ALL INTEGRATION TESTS PASSED! 🎉");
    console.log("The CrewAI Team backend is functioning correctly.");
    process.exit(0);
  } else {
    console.log("⚠️  Some tests failed. Review the errors above.");
    process.exit(1);
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error("Fatal error during integration tests:", error);
  process.exit(1);
});