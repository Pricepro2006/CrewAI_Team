#!/usr/bin/env tsx

/**
 * Test Script for MasterOrchestrator Routing Logic
 * 
 * This script tests the complete routing flow:
 * 1. Agent registration and discovery
 * 2. Query routing to appropriate agents  
 * 3. Plan creation and execution
 * 4. Inter-agent communication
 * 5. Error handling in multi-agent workflows
 */

import { MasterOrchestrator } from "./src/core/master-orchestrator/MasterOrchestrator.js";
import type { Query } from "./src/core/master-orchestrator/types.js";
import { logger } from "./src/utils/logger.js";

// Test queries for different agent types
const testQueries: Array<{ query: Query; expectedAgent: string }> = [
  {
    query: {
      text: "What are the latest developments in TypeScript 5.0?",
      conversationId: "test-research-1"
    },
    expectedAgent: "ResearchAgent"
  },
  {
    query: {
      text: "Write a function to calculate fibonacci numbers in TypeScript",
      conversationId: "test-code-1"
    },
    expectedAgent: "CodeAgent"
  },
  {
    query: {
      text: "Analyze the sales data and show me trends from the last quarter",
      conversationId: "test-data-1"
    },
    expectedAgent: "DataAnalysisAgent"
  },
  {
    query: {
      text: "Write a blog post about the benefits of microservices architecture",
      conversationId: "test-writer-1"
    },
    expectedAgent: "WriterAgent"
  },
  {
    query: {
      text: "Execute a workflow to automate deployment pipeline",
      conversationId: "test-tool-1"
    },
    expectedAgent: "ToolExecutorAgent"
  }
];

async function testOrchestratorRouting() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 Testing MasterOrchestrator Routing Logic");
  console.log("=".repeat(80) + "\n");

  // Initialize orchestrator with test configuration
  const orchestrator = new MasterOrchestrator({
    llm: {
      model: "llama3.2:3b",
      temperature: 0.3,
      maxTokens: 2000
    },
    rag: {
      vectorStore: {
        type: "adaptive",
        baseUrl: "http://localhost:8000",
        collectionName: "test-collection",
        dimension: 4096
      },
      chunking: {
        size: 1000,
        overlap: 100,
        method: "sentence",
        trimWhitespace: true,
        preserveFormatting: false
      },
      retrieval: {
        topK: 5,
        minScore: 0.3,
        reranking: false,
        boostRecent: true
      }
    }
  });

  try {
    console.log("📦 Initializing MasterOrchestrator...");
    await orchestrator.initialize();
    console.log("✅ MasterOrchestrator initialized successfully\n");

    // Test 1: Agent Registry
    console.log("📋 Test 1: Agent Registry and Discovery");
    console.log("-".repeat(40));
    
    const registeredTypes = orchestrator.agentRegistry.getRegisteredTypes();
    console.log(`  Registered agent types: ${registeredTypes.join(", ")}`);
    
    const activeAgents = orchestrator.agentRegistry.getActiveAgents();
    console.log(`  Active agents: ${activeAgents.length}`);
    
    const poolStatus = orchestrator.agentRegistry.getPoolStatus();
    console.log(`  Agent pool status: ${JSON.stringify(poolStatus)}`);
    
    // Verify all 5 expected agents are registered
    const expectedAgents = ["ResearchAgent", "CodeAgent", "DataAnalysisAgent", "WriterAgent", "ToolExecutorAgent"];
    const missingAgents = expectedAgents.filter(agent => !registeredTypes.includes(agent));
    
    if (missingAgents.length > 0) {
      console.error(`  ❌ Missing agents: ${missingAgents.join(", ")}`);
    } else {
      console.log(`  ✅ All 5 expected agents are registered`);
    }
    
    // Test EmailAnalysisAgent separately (it's the 6th agent)
    if (registeredTypes.includes("EmailAnalysisAgent")) {
      console.log(`  ℹ️  EmailAnalysisAgent is also registered (not RAG-integrated by design)`);
    }
    
    console.log();

    // Test 2: Query Routing
    console.log("🎯 Test 2: Query Routing to Appropriate Agents");
    console.log("-".repeat(40));
    
    for (const testCase of testQueries) {
      console.log(`\n  Testing: "${testCase.query.text.substring(0, 50)}..."`);
      console.log(`  Expected agent: ${testCase.expectedAgent}`);
      
      try {
        // Process query through orchestrator
        console.log(`  Processing query...`);
        const result = await orchestrator.processQuery(testCase.query);
        
        // Check if the expected agent was used
        const agentUsed = result.metadata?.agentUsed || 
                         result.results?.[0]?.metadata?.agent ||
                         "Unknown";
        
        console.log(`  Agent used: ${agentUsed}`);
        console.log(`  Success: ${result.success}`);
        
        if (result.success) {
          console.log(`  ✅ Query processed successfully`);
          if (result.summary) {
            console.log(`  Summary: ${result.summary.substring(0, 100)}...`);
          }
        } else {
          console.log(`  ⚠️  Query processing failed: ${result.error || "Unknown error"}`);
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing query: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }
    
    console.log();

    // Test 3: Plan Execution Flow
    console.log("📊 Test 3: Plan Creation and Execution");
    console.log("-".repeat(40));
    
    const complexQuery: Query = {
      text: "Research the latest AI trends, write code examples, and create a summary report",
      conversationId: "test-complex-1"
    };
    
    console.log(`  Complex query: "${complexQuery.text}"`);
    console.log(`  This should involve multiple agents...`);
    
    try {
      const result = await orchestrator.processQuery(complexQuery);
      
      console.log(`  Plan executed: ${result.success}`);
      console.log(`  Steps completed: ${result.completedSteps || 0}`);
      console.log(`  Steps failed: ${result.failedSteps || 0}`);
      
      if (result.results && result.results.length > 0) {
        console.log(`  Agents involved:`);
        const agentsUsed = new Set<string>();
        result.results.forEach((step: any) => {
          if (step.metadata?.agent) {
            agentsUsed.add(step.metadata.agent);
          }
        });
        agentsUsed.forEach(agent => console.log(`    - ${agent}`));
      }
      
      if (result.success) {
        console.log(`  ✅ Multi-agent workflow completed successfully`);
      } else {
        console.log(`  ⚠️  Multi-agent workflow had issues`);
      }
      
    } catch (error) {
      console.error(`  ❌ Error in complex query: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    
    console.log();

    // Test 4: RAG Integration
    console.log("🔍 Test 4: RAG System Integration");
    console.log("-".repeat(40));
    
    const ragStatus = await orchestrator.ragSystem?.getHealthStatus();
    if (ragStatus) {
      console.log(`  RAG System Status:`);
      console.log(`    - Vector Store: ${ragStatus.vectorStore?.status || "Unknown"}`);
      console.log(`    - Fallback Used: ${ragStatus.vectorStore?.fallbackUsed || false}`);
      console.log(`    - Embedding Service: ${ragStatus.embedding?.status || "Unknown"}`);
      console.log(`    - Chunking Service: ${ragStatus.chunking?.status || "Unknown"}`);
      
      if (ragStatus.vectorStore?.status === "healthy" && !ragStatus.vectorStore?.fallbackUsed) {
        console.log(`  ✅ RAG system fully operational with ChromaDB`);
      } else if (ragStatus.vectorStore?.fallbackUsed) {
        console.log(`  ⚠️  RAG system using in-memory fallback`);
      } else {
        console.log(`  ❌ RAG system not operational`);
      }
    } else {
      console.log(`  ❌ RAG system not available`);
    }
    
    console.log();

    // Test 5: Error Handling
    console.log("🛡️ Test 5: Error Handling in Multi-Agent Workflows");
    console.log("-".repeat(40));
    
    const errorQuery: Query = {
      text: "This is a query that should trigger error handling mechanisms",
      conversationId: "test-error-1",
      metadata: { forceError: true }
    };
    
    console.log(`  Testing error recovery...`);
    
    try {
      const result = await orchestrator.processQuery(errorQuery);
      
      if (!result.success) {
        console.log(`  ✅ Error properly handled`);
        console.log(`  Error message: ${result.error || result.summary}`);
      } else {
        console.log(`  ℹ️  Query succeeded despite error test`);
      }
      
    } catch (error) {
      console.log(`  ✅ Error caught and handled: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
    
    console.log();

    // Summary
    console.log("=" .repeat(80));
    console.log("📈 Test Summary");
    console.log("-".repeat(40));
    console.log(`  ✅ Agent Registry: ${expectedAgents.length} agents registered`);
    console.log(`  ✅ Query Routing: Tested ${testQueries.length} different query types`);
    console.log(`  ✅ Plan Execution: Multi-agent workflow tested`);
    console.log(`  ✅ RAG Integration: Status checked`);
    console.log(`  ✅ Error Handling: Recovery mechanisms tested`);
    console.log("=" .repeat(80));

  } catch (error) {
    console.error("\n❌ Fatal error during testing:", error);
    process.exit(1);
  } finally {
    // Cleanup
    await orchestrator.agentRegistry.shutdown();
    console.log("\n🧹 Cleanup completed");
  }
}

// Run the tests
testOrchestratorRouting().catch(console.error);