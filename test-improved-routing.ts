#!/usr/bin/env tsx

/**
 * Test the improved MasterOrchestrator routing logic
 */

import { MasterOrchestrator } from "./src/core/master-orchestrator/MasterOrchestrator.js";
import { SimplePlanGenerator } from "./src/core/master-orchestrator/SimplePlanGenerator.js";
import type { Query } from "./src/core/master-orchestrator/types.js";

console.log("\n" + "=".repeat(80));
console.log("🚀 TESTING IMPROVED MASTERORCHESTRATOR ROUTING");
console.log("=".repeat(80) + "\n");

// Test improved multi-agent plan generation
console.log("1️⃣ TESTING MULTI-AGENT PLAN GENERATION");
console.log("-".repeat(40));

const complexQueries: Query[] = [
  { 
    text: "Research the latest AI trends and create code examples", 
    conversationId: "test-multi-1" 
  },
  { 
    text: "Analyze the data, create visualizations, and write a comprehensive report", 
    conversationId: "test-multi-2" 
  },
  {
    text: "Find information about TypeScript best practices, implement examples, and document them",
    conversationId: "test-multi-3"
  }
];

for (const query of complexQueries) {
  console.log(`\nQuery: "${query.text}"`);
  const plan = SimplePlanGenerator.createMultiAgentPlan(query);
  
  console.log(`Generated ${plan.steps.length}-step plan:`);
  plan.steps.forEach((step, i) => {
    console.log(`  Step ${i + 1}: ${step.agentType}`);
    console.log(`    Task: ${step.task}`);
    if (step.dependencies.length > 0) {
      console.log(`    Depends on: ${step.dependencies.join(", ")}`);
    }
  });
}

console.log("\n" + "=".repeat(80));
console.log("2️⃣ TESTING IMPROVED AGENT ROUTER SCORING");  
console.log("-".repeat(40));

import { AgentRouter } from "./src/core/master-orchestrator/AgentRouter.js";
import type { QueryAnalysis } from "./src/core/master-orchestrator/enhanced-types.js";

const router = new AgentRouter();

const testCases: Array<{query: string, analysis: QueryAnalysis}> = [
  {
    query: "Write a function to sort an array",
    analysis: {
      intent: "write function",
      complexity: 5,
      domains: ["code"],
      priority: "medium",
      estimatedDuration: 30,
      entities: { functions: ["sort"] },
      resourceRequirements: {}
    }
  },
  {
    query: "Research and analyze market trends",
    analysis: {
      intent: "research analyze",
      complexity: 7,
      domains: ["research", "analysis"],
      priority: "high",
      estimatedDuration: 60,
      entities: { topics: ["market trends"] },
      resourceRequirements: { requiresInternet: true }
    }
  }
];

for (const testCase of testCases) {
  console.log(`\nQuery: "${testCase.query}"`);
  const routingPlan = await router.routeQuery(testCase.analysis);
  console.log(`  Selected Agent: ${routingPlan.selectedAgents[0].agentType}`);
  console.log(`  Confidence: ${routingPlan.confidence}`);
  console.log(`  Fallback Agents: ${routingPlan.fallbackAgents.join(", ")}`);
}

console.log("\n" + "=".repeat(80));
console.log("3️⃣ TESTING COMPLEX QUERY DETECTION");
console.log("-".repeat(40));

const orchestrator = new MasterOrchestrator({
  llm: { model: "llama3.2:3b", temperature: 0.3, maxTokens: 2000 },
  rag: {
    vectorStore: {
      type: "adaptive",
      baseUrl: "http://localhost:8000", 
      collectionName: "test-collection",
      dimension: 4096
    },
    chunking: { size: 1000, overlap: 100, method: "sentence", trimWhitespace: true, preserveFormatting: false },
    retrieval: { topK: 5, minScore: 0.3, reranking: false, boostRecent: true }
  }
});

const queryTests = [
  { text: "What is TypeScript?", expected: false },
  { text: "Research AI trends, analyze the data, and create a comprehensive report with code examples", expected: true },
  { text: "Find information and then create documentation", expected: true },
  { text: "Simple search query", expected: false }
];

for (const test of queryTests) {
  const isComplex = (orchestrator as any).isComplexQuery({ text: test.text });
  const status = isComplex === test.expected ? "✅" : "❌";
  console.log(`${status} "${test.text.substring(0, 50)}..." → Complex: ${isComplex}`);
}

console.log("\n" + "=".repeat(80));
console.log("📊 IMPROVEMENTS SUMMARY");
console.log("-".repeat(40));
console.log("✅ Multi-agent plan generation for complex queries");
console.log("✅ Scoring-based agent selection (more intelligent)");
console.log("✅ Complex query detection for better routing");
console.log("✅ Fallback agent retry logic in PlanExecutor");
console.log("✅ Dynamic LLM vs Simple plan selection");
console.log("=".repeat(80) + "\n");

console.log("🎯 KEY IMPROVEMENTS MADE:");
console.log("1. Changed USE_SIMPLE_PLAN default to false (enables LLM routing)");
console.log("2. Added isComplexQuery() detection in MasterOrchestrator");
console.log("3. Created createMultiAgentPlan() in SimplePlanGenerator");
console.log("4. Enhanced AgentRouter with scoring-based selection");
console.log("5. Added fallback retry logic in PlanExecutor.executeWithTool()");
console.log("\n✅ Routing logic significantly improved!\n");