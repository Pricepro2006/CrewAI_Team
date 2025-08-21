#!/usr/bin/env tsx
/**
 * Test script for the MasterOrchestrator API endpoints
 * Tests the newly created orchestrator router functionality
 */

import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../api/trpc/router.js";
import superjson from "superjson";

const API_URL = process.env.API_URL || "http://localhost:3001";

// Create tRPC client
const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_URL}/api/trpc`,
      transformer: superjson,
      headers: () => ({
        "Content-Type": "application/json",
      }),
    }),
  ],
});

async function testOrchestratorEndpoints() {
  console.log("🔍 Testing MasterOrchestrator API Endpoints...\n");

  try {
    // Test 1: Check orchestrator status
    console.log("📊 Test 1: Checking orchestrator status...");
    const status = await trpc.orchestrator.status.query();
    console.log("✅ Orchestrator Status:", JSON.stringify(status, null, 2));
    console.log("");

    // Test 2: Test endpoint
    console.log("🧪 Test 2: Running test endpoint...");
    const testResult = await trpc.orchestrator.test.query({ 
      message: "Testing orchestrator connectivity" 
    });
    console.log("✅ Test Result:", JSON.stringify(testResult, null, 2));
    console.log("");

    // Test 3: Get available agents
    console.log("🤖 Test 3: Getting available agents...");
    const agents = await trpc.orchestrator.getAgents.query();
    console.log("✅ Available Agents:");
    agents.forEach((agent: any) => {
      console.log(`  - ${agent.type}: ${agent.description}`);
      console.log(`    Status: ${agent.available ? 'Available' : 'Unavailable'}`);
      console.log(`    Capabilities: ${agent.capabilities.join(', ')}`);
    });
    console.log("");

    // Test 4: Analyze a query
    console.log("🔎 Test 4: Analyzing a sample query...");
    const analysis = await trpc.orchestrator.analyzeQuery.mutate({
      query: "Find information about the latest AI developments and create a summary report"
    });
    console.log("✅ Query Analysis:", JSON.stringify(analysis, null, 2));
    console.log("");

    // Test 5: Process a simple query
    console.log("⚡ Test 5: Processing a simple query...");
    const queryResult = await trpc.orchestrator.processQuery.mutate({
      query: "What is the current status of the system?",
      options: {
        useRAG: false,
        maxAgents: 1,
        timeout: 30000
      }
    });
    console.log("✅ Query Result:");
    console.log(`  Query ID: ${queryResult.queryId}`);
    console.log(`  Success: ${queryResult.result.success}`);
    console.log(`  Summary: ${queryResult.result.summary}`);
    console.log(`  Processing Time: ${queryResult.processingTime}ms`);
    console.log("");

    // Test 6: Create a plan (without execution)
    console.log("📋 Test 6: Creating an execution plan...");
    const plan = await trpc.orchestrator.createPlan.mutate({
      query: "Research the top 3 programming languages in 2025 and compare their features",
      constraints: {
        maxSteps: 5,
        agents: ["ResearchAgent", "WriterAgent"],
        executionStrategy: "sequential"
      }
    });
    console.log("✅ Execution Plan Created:");
    console.log(`  Plan ID: ${plan.planId}`);
    console.log(`  Steps: ${plan.plan.steps.length}`);
    plan.plan.steps.forEach((step: any, index: number) => {
      console.log(`  Step ${index + 1}: ${step.description}`);
      console.log(`    Agent: ${step.agentType}`);
      console.log(`    Expected Output: ${step.expectedOutput}`);
    });
    console.log("");

    console.log("✨ All tests completed successfully!");

  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

// Run tests
console.log("=====================================");
console.log("MasterOrchestrator API Test Suite");
console.log("=====================================\n");

testOrchestratorEndpoints()
  .then(() => {
    console.log("\n✅ All orchestrator endpoints are working correctly!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Tests failed:", error);
    process.exit(1);
  });